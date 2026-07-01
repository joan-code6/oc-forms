const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT          = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID        = process.env.APPWRITE_PROJECT_ID;
const API_KEY           = process.env.APPWRITE_API_KEY;
const DATABASE_ID       = process.env.APPWRITE_DATABASE_ID;
const APPLICATIONS_COLLECTION_ID = process.env.APPWRITE_APPLICATIONS_COLLECTION_ID;
const REVIEWS_COLLECTION_ID      = process.env.APPWRITE_MODERATOR_REVIEWS_COLLECTION_ID;
const DISCORD_BOT_TOKEN      = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID       = process.env.DISCORD_GUILD_ID;
const DISCORD_STAFF_ROLE_ID   = process.env.DISCORD_STAFF_ROLE_ID;

function getServerClient() {
  const client = new Client();
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return client;
}

async function verifyStaffRole(userId) {
  try {
    const client = getServerClient();
    const users = new Users(client);
    const { identities: identityList } = await users.listIdentities([
      Query.equal("userId", userId)
    ]);

    const discordIdentity = identityList.find(
      (id) => id.provider === "discord"
    );

    if (!discordIdentity) return { isStaff: false };

    const discordId = discordIdentity.providerUid;
    if (!discordId) return { isStaff: false };

    const res = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}`,
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) return { isStaff: false };

    const member = await res.json();
    const hasStaffRole = member.roles?.includes(DISCORD_STAFF_ROLE_ID) || false;

    return {
      isStaff: hasStaffRole,
      discordId,
      discordUsername: member.nick || member.user?.username || "",
    };
  } catch {
    return { isStaff: false };
  }
}


async function getAllReviewCounts(databases) {
  try {
    const counts = {};
    let offset = 0;
    const limit = 5000;
    let hasMore = true;

    while (hasMore) {
      const result = await databases.listDocuments(
        DATABASE_ID,
        REVIEWS_COLLECTION_ID,
        [
          Query.limit(limit),
          Query.offset(offset),
        ]
      );
      for (const doc of result.documents) {
        const appId = doc.applicationId;
        if (appId) {
          counts[appId] = (counts[appId] || 0) + 1;
        }
      }
      hasMore = result.documents.length === limit;
      offset += result.documents.length;
    }

    return counts;
  } catch {
    return {};
  }
}

function formatApplication(doc) {
  return {
    id: doc.$id,
    minecraftIGN: doc.minecraftIGN,
    skinUrl: `https://mc-heads.net/body/${encodeURIComponent(doc.minecraftIGN)}`,
    discordUsername: doc.discordUsername || "",
    timezone: doc.timezone || "",
    createdAt: doc.createdAt || "",
    status: doc.status,
    joinedAt: doc.discordJoinDate || null,
  };
}

module.exports = async function (context) {
  const { req, res, log, error } = context;

  const userId = req.headers?.["x-appwrite-user-id"];

  if (!userId) {
    return res.json({ error: "Unauthorized." }, 401);
  }

  const staffCheck = await verifyStaffRole(userId);
  if (!staffCheck.isStaff) {
    log("Staff access denied for unscored apps:", userId);
    return res.json({ error: "Insufficient permissions." }, 403);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    const unscoredStatuses = ["pending", "pending_2nd", "in_review"];
    let allApplications = [];

    for (const status of unscoredStatuses) {
      try {
        const result = await databases.listDocuments(
          DATABASE_ID,
          APPLICATIONS_COLLECTION_ID,
          [
            Query.equal("status", status),
            Query.orderAsc("createdAt"),
            Query.limit(1000),
          ]
        );
        allApplications = allApplications.concat(result.documents);
      } catch {
        // skip
      }
    }

    const reviewCounts = await getAllReviewCounts(databases);

    const formattedApplications = allApplications.map((app) => {
      const formatted = formatApplication(app);
      formatted.reviewerCount = reviewCounts[app.$id] || 0;
      return formatted;
    });

    return res.json({
      applications: formattedApplications,
      total: formattedApplications.length,
    });
  } catch (e) {
    error("Failed to fetch unscored applications:", e.message);
    return res.json({ error: "Failed to load applications." }, 500);
  }
};
