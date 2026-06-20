const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT          = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID        = process.env.APPWRITE_PROJECT_ID;
const API_KEY           = process.env.APPWRITE_API_KEY;
const DATABASE_ID       = process.env.APPWRITE_DATABASE_ID;
const REVIEWS_COLLECTION_ID = process.env.APPWRITE_MODERATOR_REVIEWS_COLLECTION_ID;
const APPLICATIONS_COLLECTION_ID = process.env.APPWRITE_APPLICATIONS_COLLECTION_ID;
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

  let body;
  try {
    body = JSON.parse(req.body || "{}");
  } catch {
    return res.json({ error: "Invalid JSON payload." }, 400);
  }

  const { reviewId, rating, moderatorNote, applicationId } = body;

  if (!reviewId || typeof reviewId !== "string") {
    return res.json({ error: "Missing reviewId." }, 400);
  }

  const isAdmin = await verifyAdminRole(userId, log);
  if (!isAdmin) {
    return res.json({ error: "Insufficient permissions." }, 403);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    const updateData = {};
    if (typeof rating === "number" && rating >= 0 && rating <= 100) {
      updateData.rating = rating;
      const zone = rating <= 25 ? "red" : rating <= 50 ? "orange" : rating <= 75 ? "yellow" : "green";
      updateData.ratingZone = zone;
    }
    if (moderatorNote !== undefined) {
      updateData.moderatorNote = typeof moderatorNote === "string" ? moderatorNote.trim() : null;
    }

    await databases.updateDocument(
      DATABASE_ID,
      REVIEWS_COLLECTION_ID,
      reviewId,
      updateData
    );

    if (applicationId && typeof rating === "number" && rating >= 0 && rating <= 100) {
      const appUpdate = { rating, ratingZone: updateData.ratingZone };
      if (moderatorNote !== undefined) {
        appUpdate.moderatorNote = typeof moderatorNote === "string" ? moderatorNote.trim() : null;
      }
      await databases.updateDocument(
        DATABASE_ID,
        APPLICATIONS_COLLECTION_ID,
        applicationId,
        appUpdate
      );
    }

    log(`Review ${reviewId} updated by admin ${userId}`);
    return res.json({ success: true });
  } catch (e) {
    error("Failed to update review:", e.message);
    return res.json({ error: "Failed to update review." }, 500);
  }
};
