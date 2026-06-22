const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT          = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID        = process.env.APPWRITE_PROJECT_ID;
const API_KEY           = process.env.APPWRITE_API_KEY;
const DATABASE_ID       = process.env.APPWRITE_DATABASE_ID;
const APPLICATIONS_COLLECTION_ID = process.env.APPWRITE_APPLICATIONS_COLLECTION_ID;
const REVIEWS_COLLECTION_ID = process.env.APPWRITE_MODERATOR_REVIEWS_COLLECTION_ID;
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
    log("identityList count:", identityList?.length ?? 0);

    const discordIdentity = identityList.find(
      (id) => id.provider === "discord"
    );

    if (!discordIdentity) {
      log("No Discord identity found");
      return false;
    }

    const discordId = discordIdentity.providerUid;
    log("Discord ID:", discordId);
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

    if (!res.ok) {
      log("Discord API returned", res.status, res.statusText);
      return false;
    }

    const member = await res.json();
    log("Discord member found:", !!member, "roles:", member?.roles?.length ?? 0);
    log("Looking for ADMIN_ROLE_ID:", ADMIN_ROLE_ID);
    const hasAdmin = member.roles?.includes(ADMIN_ROLE_ID) || false;
    log("hasAdmin:", hasAdmin);
    return hasAdmin;
  } catch (e) {
    log("verifyAdminRole error:", e.message);
    return false;
  }
}

module.exports = async function (context) {
  const { req, res, log, error } = context;

  const userId = req.headers?.["x-appwrite-user-id"];
  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch (_) { /* ignore malformed body */ }

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

    const reviews = await databases.listDocuments(
      DATABASE_ID,
      REVIEWS_COLLECTION_ID,
      [
        Query.orderDesc("reviewedAt"),
        Query.limit(50),
      ]
    );

    const formatted = reviews.documents.map((doc) => ({
      id: doc.$id,
      applicationId: doc.applicationId,
      moderatorUserId: doc.moderatorUserId,
      moderatorDiscordId: doc.moderatorDiscordId,
      moderatorDiscordUsername: doc.moderatorDiscordUsername,
      rating: doc.rating,
      ratingZone: doc.ratingZone,
      moderatorNote: doc.moderatorNote || null,
      reviewedAt: doc.reviewedAt,
      application: null,
    }));

    const applicationIds = [...new Set(formatted.map((r) => r.applicationId).filter(Boolean))];
    if (applicationIds.length > 0) {
      const appQueries = [Query.equal("$id", applicationIds), Query.limit(100)];
      if (body.status && typeof body.status === "string") {
        appQueries.push(Query.equal("status", body.status));
      }
      const applications = await databases.listDocuments(
        DATABASE_ID,
        APPLICATIONS_COLLECTION_ID,
        appQueries
      );

      const appMap = new Map();
      for (const app of applications.documents) {
        appMap.set(app.$id, {
          id: app.$id,
          minecraftIGN: app.minecraftIGN || "",
          discordUsername: app.discordUsername || "",
          discordId: app.discordId || "",
          timezone: app.timezone || "",
          status: app.status || "",
          createdAt: app.createdAt || "",
          skinUrl: `https://mc-heads.net/body/${encodeURIComponent(app.minecraftIGN || "")}`,
        });
      }

      for (const review of formatted) {
        review.application = appMap.get(review.applicationId) || null;
      }
    }

    return res.json({ reviews: formatted, total: reviews.total });
  } catch (e) {
    error("Failed to fetch reviews:", e.message);
    return res.json({ error: "Failed to load reviews." }, 500);
  }
};
