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

async function addLabel(users, databases, userId) {
  const userDoc = await users.get(userId);
  const currentLabels = userDoc.labels || [];
  if (!currentLabels.includes("undergroundEventAccepted")) {
    await users.updateLabels(userId, [...currentLabels, "undergroundEventAccepted"]);
  }

  const existing = await databases.listDocuments(
    DATABASE_ID,
    ACCEPTED_EVENT_COLLECTION_ID,
    [Query.equal("userId", userId), Query.limit(1)]
  );

  if (existing.total > 0) {
    return { alreadyExists: true };
  }

  const apps = await databases.listDocuments(
    DATABASE_ID,
    APPLICATIONS_COLLECTION_ID,
    [Query.equal("userID", userId), Query.limit(1)]
  );

  const app = apps.documents[0] || {};

  await databases.createDocument(
    DATABASE_ID,
    ACCEPTED_EVENT_COLLECTION_ID,
    "unique()",
    {
      userId,
      discordUsername: app.discordUsername || userDoc.name || "",
      discordId: app.discordId || "",
      minecraftIGN: app.minecraftIGN || "",
      rating: app.rating || 0,
      assignedAt: new Date().toISOString(),
      assignedBy: "manual",
      dmSent: false,
    }
  );

  return { added: true };
}

async function removeLabel(users, databases, userId) {
  try {
    const userDoc = await users.get(userId);
    const currentLabels = userDoc.labels || [];
    await users.updateLabels(userId, currentLabels.filter((l) => l !== "undergroundEventAccepted"));
  } catch {
    // ignore label removal failures
  }

  try {
    const existing = await databases.listDocuments(
      DATABASE_ID,
      ACCEPTED_EVENT_COLLECTION_ID,
      [Query.equal("userId", userId), Query.limit(1)]
    );
    for (const doc of existing.documents) {
      await databases.deleteDocument(DATABASE_ID, ACCEPTED_EVENT_COLLECTION_ID, doc.$id);
    }
  } catch {
    // ignore
  }

  return { removed: true };
}

async function removeAllLabels(databases, users) {
  const result = await databases.listDocuments(
    DATABASE_ID,
    ACCEPTED_EVENT_COLLECTION_ID,
    [Query.limit(10000)]
  );

  let count = 0;
  for (const doc of result.documents) {
    try {
      const userDoc = await users.get(doc.userId);
      const currentLabels = userDoc.labels || [];
      await users.updateLabels(doc.userId, currentLabels.filter((l) => l !== "undergroundEventAccepted"));
    } catch {
      // ignore
    }
    try {
      await databases.deleteDocument(DATABASE_ID, ACCEPTED_EVENT_COLLECTION_ID, doc.$id);
    } catch {
      // ignore
    }
    count++;
  }

  return { removed: count };
}

async function searchUsers(databases, query) {
  const searchTerm = (query || "").trim();
  if (!searchTerm) return [];

  const acceptedResult = await databases.listDocuments(
    DATABASE_ID,
    ACCEPTED_EVENT_COLLECTION_ID,
    [Query.limit(10000)]
  );
  const acceptedUserIds = new Set(acceptedResult.documents.map((d) => d.userId));

  const matchingApps = [];
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
      for (const doc of result.documents) {
        const nameMatch = (doc.discordUsername || "").toLowerCase().includes(searchTerm.toLowerCase());
        const ignMatch = (doc.minecraftIGN || "").toLowerCase().includes(searchTerm.toLowerCase());
        if ((nameMatch || ignMatch) && !acceptedUserIds.has(doc.userID)) {
          matchingApps.push({
            userId: doc.userID,
            discordUsername: doc.discordUsername || "",
            minecraftIGN: doc.minecraftIGN || "",
            rating: doc.rating || 0,
            status: doc.status,
          });
        }
      }
    } catch {
      // skip
    }
  }

  return matchingApps.slice(0, 20);
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

  const { action, targetUserId, search } = body;

  const adminCheck = await verifyAdmin(userId);
  if (!adminCheck.isAdmin) {
    log("Admin access denied:", userId);
    return res.json({ success: false, error: "Insufficient permissions." }, 403);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);
    const users = new Users(client);

    switch (action) {
      case "add": {
        if (!targetUserId || typeof targetUserId !== "string") {
          return res.json({ success: false, error: "Missing targetUserId." }, 400);
        }
        const addResult = await addLabel(users, databases, targetUserId);
        return res.json({ success: true, ...addResult });
      }

      case "remove": {
        if (!targetUserId || typeof targetUserId !== "string") {
          return res.json({ success: false, error: "Missing targetUserId." }, 400);
        }
        const removeResult = await removeLabel(users, databases, targetUserId);
        return res.json({ success: true, ...removeResult });
      }

      case "removeAll": {
        const removeAllResult = await removeAllLabels(databases, users);
        log(`All ${removeAllResult.removed} accepted users removed`);
        return res.json({ success: true, ...removeAllResult });
      }

      case "search": {
        const results = await searchUsers(databases, search);
        return res.json({ success: true, results });
      }

      default:
        return res.json({ success: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    error("Manage label failed:", e.message);
    return res.json({ success: false, error: "Failed to manage label." }, 500);
  }
};
