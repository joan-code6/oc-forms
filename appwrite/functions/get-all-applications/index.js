const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT                    = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID                  = process.env.APPWRITE_PROJECT_ID;
const API_KEY                     = process.env.APPWRITE_API_KEY;
const DATABASE_ID                 = process.env.APPWRITE_DATABASE_ID;
const APPLICATIONS_COLLECTION_ID  = process.env.APPWRITE_APPLICATIONS_COLLECTION_ID;
const REVIEWS_COLLECTION_ID       = process.env.APPWRITE_MODERATOR_REVIEWS_COLLECTION_ID;
const ACCEPTED_EVENT_COLLECTION_ID = process.env.APPWRITE_ACCEPTED_EVENT_COLLECTION_ID;
const DISCORD_BOT_TOKEN           = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID            = process.env.DISCORD_GUILD_ID;
const ADMIN_ROLE_ID               = process.env.ADMIN_ROLE_ID;

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

async function getAllApplications(databases) {
  const allApps = [];
  let offset = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const result = await databases.listDocuments(
      DATABASE_ID,
      APPLICATIONS_COLLECTION_ID,
      [Query.limit(limit), Query.offset(offset), Query.orderAsc("createdAt")]
    );
    allApps.push(...result.documents);
    hasMore = result.documents.length === limit;
    offset += result.documents.length;
  }

  return allApps;
}

async function getAllReviews(databases) {
  const reviewsByApp = {};
  let offset = 0;
  const limit = 5000;
  let hasMore = true;

  while (hasMore) {
    const result = await databases.listDocuments(
      DATABASE_ID,
      REVIEWS_COLLECTION_ID,
      [Query.limit(limit), Query.offset(offset)]
    );
    for (const doc of result.documents) {
      const appId = doc.applicationId;
      if (appId) {
        if (!reviewsByApp[appId]) reviewsByApp[appId] = [];
        reviewsByApp[appId].push({
          moderatorUsername: doc.moderatorDiscordUsername || "Unknown",
          rating: doc.rating || 0,
          ratingZone: doc.ratingZone || "",
          note: doc.moderatorNote || null,
          reviewedAt: doc.reviewedAt || "",
        });
      }
    }
    hasMore = result.documents.length === limit;
    offset += result.documents.length;
  }

  return reviewsByApp;
}

async function getAcceptedUsers(databases) {
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
    return res.json({ error: "Unauthorized." }, 401);
  }

  const adminCheck = await verifyAdmin(userId);
  if (!adminCheck.isAdmin) {
    log("Admin access denied:", userId);
    return res.json({ error: "Insufficient permissions." }, 403);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    const [applications, reviewsByApp, acceptedUserIds] = await Promise.all([
      getAllApplications(databases),
      getAllReviews(databases),
      getAcceptedUsers(databases),
    ]);

    const formatted = applications.map((app) => {
      const reviews = reviewsByApp[app.$id] || [];
      const avgRating = reviews.length > 0
        ? Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length)
        : 0;
      const avgZone = avgRating >= 76 ? "green" : avgRating >= 51 ? "yellow" : avgRating >= 26 ? "orange" : "red";
      return {
        id: app.$id,
        userId: app.userID,
        minecraftIGN: app.minecraftIGN || "",
        skinUrl: `https://mc-heads.net/body/${encodeURIComponent(app.minecraftIGN || "steve")}`,
        discordUsername: app.discordUsername || "",
        discordId: app.discordId || "",
        timezone: app.timezone || "",
        createdAt: app.createdAt || "",
        status: app.status || "",
        rating: avgRating,
        ratingZone: avgZone,
        isAccepted: acceptedUserIds.has(app.userID),
        reviews,
      };
    });

    log(`Fetched ${formatted.length} applications with review data`);
    return res.json({
      applications: formatted,
      total: formatted.length,
    });
  } catch (e) {
    error("Failed to fetch applications:", e.message);
    return res.json({ error: "Failed to load applications." }, 500);
  }
};
