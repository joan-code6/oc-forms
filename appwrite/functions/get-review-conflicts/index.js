const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT          = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID        = process.env.APPWRITE_PROJECT_ID;
const API_KEY           = process.env.APPWRITE_API_KEY;
const DATABASE_ID       = process.env.APPWRITE_DATABASE_ID;
const REVIEWS_COLLECTION_ID = process.env.APPWRITE_MODERATOR_REVIEWS_COLLECTION_ID;
const SETTINGS_COLLECTION_ID = process.env.APPWRITE_SETTINGS_COLLECTION_ID;
const DISCORD_BOT_TOKEN      = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID       = process.env.DISCORD_GUILD_ID;
const ADMIN_ROLE_ID           = process.env.ADMIN_ROLE_ID;

function getServerClient() {
  const client = new Client();
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return client;
}

async function verifyAdminRole(userId, log) {
  try {
    const client = getServerClient();
    const users = new Users(client);
    const { identities: identityList } = await users.listIdentities([
      Query.equal("userId", userId)
    ]);

    const discordIdentity = identityList.find(
      (id) => id.provider === "discord"
    );

    if (!discordIdentity) return false;

    const discordId = discordIdentity.providerUid;
    if (!discordId) return false;

    const res = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}`,
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) return false;

    const member = await res.json();
    return member.roles?.includes(ADMIN_ROLE_ID) || false;
  } catch (e) {
    log("verifyAdminRole error:", e.message);
    return false;
  }
}

module.exports = async function (context) {
  const { req, res, log, error } = context;

  const userId = req.headers?.["x-appwrite-user-id"];

  if (!userId) {
    return res.json({ error: "Unauthorized." }, 401);
  }

  const isAdmin = await verifyAdminRole(userId, log);
  if (!isAdmin) {
    return res.json({ error: "Insufficient permissions." }, 403);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    let body = {};
    try {
      body = JSON.parse(req.body || "{}");
    } catch { /* ignore */ }

    // Pagination: scan through all reviews in batches to find conflicts
    const pageSize = typeof body.limit === "number" ? body.limit : 200;
    const maxPages = typeof body.maxPages === "number" ? body.maxPages : 5;

    let threshold = 30;
    try {
      const settings = await databases.getDocument(
        DATABASE_ID,
        SETTINGS_COLLECTION_ID,
        "global"
      );
      if (typeof settings.conflictThreshold === "number") {
        threshold = settings.conflictThreshold;
      }
    } catch {
      // Use default threshold of 30
    }

    const byApp = {};
    let totalReviewsScanned = 0;
    let hasMore = false;

    for (let page = 0; page < maxPages; page++) {
      const query = [
        Query.orderDesc("reviewedAt"),
        Query.limit(pageSize),
      ];
      if (page > 0) {
        query.push(Query.offset(page * pageSize));
      }

      const allReviews = await databases.listDocuments(
        DATABASE_ID,
        REVIEWS_COLLECTION_ID,
        query
      );

      totalReviewsScanned += allReviews.documents.length;

      for (const review of allReviews.documents) {
        if (!byApp[review.applicationId]) {
          byApp[review.applicationId] = [];
        }
        byApp[review.applicationId].push({
          id: review.$id,
          rating: review.rating,
          ratingZone: review.ratingZone,
          moderatorUserId: review.moderatorUserId,
          moderatorDiscordUsername: review.moderatorDiscordUsername,
          moderatorDiscordId: review.moderatorDiscordId,
          moderatorNote: review.moderatorNote || null,
          reviewedAt: review.reviewedAt,
          overwrittenBy: review.overwrittenBy || null,
        });
      }

      if (allReviews.documents.length < pageSize) {
        break;
      }
      if (page === maxPages - 1 && allReviews.documents.length === pageSize) {
        hasMore = true;
      }
    }

    const conflicts = [];

    for (const [appId, reviews] of Object.entries(byApp)) {
      if (reviews.length < 2) continue;

      // Skip apps that have been overwritten
      if (reviews.some((r) => r.overwrittenBy)) continue;

      const ratings = reviews.map((r) => r.rating);
      const min = Math.min(...ratings);
      const max = Math.max(...ratings);
      const diff = max - min;

      if (diff >= threshold) {
        conflicts.push({
          applicationId: appId,
          reviews,
          minRating: min,
          maxRating: max,
          ratingSpread: diff,
        });
      }
    }

    conflicts.sort((a, b) => b.ratingSpread - a.ratingSpread);

    return res.json({
      conflicts,
      total: conflicts.length,
      conflictThreshold: threshold,
      totalReviewsScanned,
      hasMore,
    });
  } catch (e) {
    error("Failed to find conflicts:", e.message);
    return res.json({ error: "Failed to load conflicts." }, 500);
  }
};
