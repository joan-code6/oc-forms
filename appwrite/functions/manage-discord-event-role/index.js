const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT          = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID        = process.env.APPWRITE_PROJECT_ID;
const API_KEY           = process.env.APPWRITE_API_KEY;
const DATABASE_ID       = process.env.APPWRITE_DATABASE_ID;
const ACCEPTED_EVENT_COLLECTION_ID = process.env.APPWRITE_ACCEPTED_EVENT_COLLECTION_ID;
const DISCORD_BOT_TOKEN      = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID       = process.env.DISCORD_GUILD_ID;
const DISCORD_STAFF_ROLE_ID  = process.env.DISCORD_STAFF_ROLE_ID;
const ADMIN_ROLE_ID          = process.env.ADMIN_ROLE_ID;
const DISCORD_EVENT_ROLE_ID  = process.env.DISCORD_Underground_Event_Participant_ROLE_ID;

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

  const { action } = body;

  if (action !== "assign" && action !== "remove") {
    return res.json({ success: false, error: "action must be 'assign' or 'remove'." }, 400);
  }

  if (!DISCORD_EVENT_ROLE_ID) {
    return res.json({ success: false, error: "DISCORD_Underground_Event_Participant_ROLE_ID is not configured." }, 500);
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

    const result = await databases.listDocuments(
      DATABASE_ID,
      ACCEPTED_EVENT_COLLECTION_ID,
      [Query.limit(10000)]
    );

    let success = 0;
    let failed = 0;
    const details = [];

    for (const doc of result.documents) {
      try {
        let discordId = doc.discordId;

        if (!discordId) {
          const { identities: identityList } = await users.listIdentities([
            Query.equal("userId", doc.userId)
          ]);
          const discordIdentity = identityList.find((id) => id.provider === "discord");
          discordId = discordIdentity?.providerUid;
        }

        if (!discordId) {
          failed++;
          details.push({ userId: doc.userId, discordUsername: doc.discordUsername, error: "No Discord ID found" });
          continue;
        }

        const method = action === "assign" ? "PUT" : "DELETE";
        const discordRes = await fetch(
          `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}/roles/${DISCORD_EVENT_ROLE_ID}`,
          {
            method,
            headers: {
              Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (discordRes.ok) {
          success++;
          details.push({ userId: doc.userId, discordUsername: doc.discordUsername, status: "ok" });
        } else {
          failed++;
          const resText = await discordRes.text();
          details.push({ userId: doc.userId, discordUsername: doc.discordUsername, error: `Discord API ${discordRes.status}: ${resText}` });
        }
      } catch (e) {
        failed++;
        details.push({ userId: doc.userId, discordUsername: doc.discordUsername, error: e.message });
      }
    }

    log(`Discord role ${action}: ${success} success, ${failed} failed`);
    return res.json({ success: true, action, assigned: success, failed, details });
  } catch (e) {
    error("Discord role management failed:", e.message);
    return res.json({ success: false, error: "Failed to manage Discord roles." }, 500);
  }
};
