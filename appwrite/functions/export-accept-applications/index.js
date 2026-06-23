const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT          = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID        = process.env.APPWRITE_PROJECT_ID;
const API_KEY           = process.env.APPWRITE_API_KEY;
const DATABASE_ID       = process.env.APPWRITE_DATABASE_ID;
const APPLICATIONS_COLLECTION_ID = process.env.APPWRITE_APPLICATIONS_COLLECTION_ID;
const ACCEPTED_EVENT_COLLECTION_ID = process.env.APPWRITE_ACCEPTED_EVENT_COLLECTION_ID;
const DISCORD_BOT_TOKEN      = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID       = process.env.DISCORD_GUILD_ID;
const DISCORD_STAFF_ROLE_ID  = process.env.DISCORD_STAFF_ROLE_ID;
const ADMIN_ROLE_ID          = process.env.ADMIN_ROLE_ID;

function getServerClient() {
  const client = new Client();
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return client;
}

async function verifyAdmin(userId) {
  try {
    const client = getServerClient();
    const users = new Users(client);
    const { identities: identityList } = await users.listIdentities([
      Query.equal("userId", userId)
    ]);

    const discordIdentity = identityList.find(
      (id) => id.provider === "discord"
    );
    if (!discordIdentity) return { isAdmin: false };

    const discordId = discordIdentity.providerUid;
    if (!discordId) return { isAdmin: false };

    const res = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}`,
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) return { isAdmin: false };

    const member = await res.json();
    const hasAdminRole = ADMIN_ROLE_ID ? member.roles?.includes(ADMIN_ROLE_ID) || false : false;

    return {
      isAdmin: hasAdminRole,
      discordId,
      discordUsername: member.nick || member.user?.username || "",
    };
  } catch {
    return { isAdmin: false };
  }
}

async function getAlreadyAcceptedUserIds(databases) {
  try {
    const result = await databases.listDocuments(
      DATABASE_ID,
      ACCEPTED_EVENT_COLLECTION_ID,
      [Query.limit(10000)]
    );
    return new Set(result.documents.map((d) => d.userId));
  } catch {
    return new Set();
  }
}

module.exports = async function (context) {
  const { req, res, log, error } = context;

  const userId = req.headers?.["x-appwrite-user-id"];
  if (!userId) {
    return res.json({ success: false, error: "Unauthorized." }, 401);
  }

  let body;
  try {
    body = JSON.parse(req.body || "{}");
  } catch {
    return res.json({ success: false, error: "Invalid JSON payload." }, 400);
  }

  const { maxPlayers, minPercentage } = body;

  if (typeof maxPlayers !== "number" || maxPlayers < 1 || !Number.isInteger(maxPlayers)) {
    return res.json({ success: false, error: "maxPlayers must be a positive integer." }, 400);
  }
  if (typeof minPercentage !== "number" || minPercentage < 0 || minPercentage > 100) {
    return res.json({ success: false, error: "minPercentage must be a number between 0 and 100." }, 400);
  }

  const adminCheck = await verifyAdmin(userId);
  if (!adminCheck.isAdmin) {
    log("Admin access denied:", userId);
    return res.json({ success: false, error: "Insufficient permissions." }, 403);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);
    const users = new Users(client);

    const alreadyAcceptedIds = await getAlreadyAcceptedUserIds(databases);

    let allApps = [];
    for (const status of ["reviewed", "closed"]) {
      try {
        const result = await databases.listDocuments(
          DATABASE_ID,
          APPLICATIONS_COLLECTION_ID,
          [
            Query.equal("status", status),
            Query.limit(10000),
          ]
        );
        allApps = allApps.concat(result.documents);
      } catch {
        // skip
      }
    }

    allApps.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    const accepted = [];
    let skipped = 0;

    for (const app of allApps) {
      if (accepted.length >= maxPlayers) break;
      if ((app.rating || 0) < minPercentage) break;
      if (!app.userID) continue;
      if (alreadyAcceptedIds.has(app.userID)) {
        skipped++;
        continue;
      }

      try {
        const userDoc = await users.get(app.userID);
        const currentLabels = userDoc.labels || [];
        if (!currentLabels.includes("undergroundEventAccepted")) {
          await users.updateLabels(app.userID, [...currentLabels, "undergroundEventAccepted"]);
        }

        await databases.createDocument(
          DATABASE_ID,
          ACCEPTED_EVENT_COLLECTION_ID,
          "unique()",
          {
            userId: app.userID,
            discordUsername: app.discordUsername || "",
            discordId: app.discordId || "",
            minecraftIGN: app.minecraftIGN || "",
            rating: app.rating || 0,
            assignedAt: new Date().toISOString(),
            assignedBy: adminCheck.discordUsername,
          }
        );

        accepted.push({
          userId: app.userID,
          discordUsername: app.discordUsername,
          minecraftIGN: app.minecraftIGN,
          rating: app.rating,
        });
      } catch (e) {
        error(`Failed to process user ${app.userID}: ${e.message}`);
      }
    }

    log(`Export completed: ${accepted.length} accepted, ${skipped} skipped`);
    return res.json({ success: true, accepted: accepted.length, skipped, users: accepted });
  } catch (e) {
    error("Export failed:", e.message);
    return res.json({ success: false, error: "Failed to run export." }, 500);
  }
};
