const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT          = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID        = process.env.APPWRITE_PROJECT_ID;
const API_KEY           = process.env.APPWRITE_API_KEY;
const DATABASE_ID       = process.env.APPWRITE_DATABASE_ID;
const APPLICATIONS_COLLECTION_ID = process.env.APPWRITE_APPLICATIONS_COLLECTION_ID;
const REVIEWS_COLLECTION_ID     = process.env.APPWRITE_MODERATOR_REVIEWS_COLLECTION_ID;
const OVERWRITES_COLLECTION_ID = "6a3802542e74947140f0";
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID  = process.env.DISCORD_GUILD_ID;
const ADMIN_ROLE_ID      = process.env.ADMIN_ROLE_ID;

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

  const { applicationId, chosenReviewId, chosenRating, moderatorNote } = body;

  if (!applicationId || typeof applicationId !== "string") {
    return res.json({ error: "Missing applicationId." }, 400);
  }

  if (!chosenReviewId || typeof chosenReviewId !== "string") {
    return res.json({ error: "Missing chosenReviewId." }, 400);
  }

  if (typeof chosenRating !== "number" || chosenRating < 0 || chosenRating > 100) {
    return res.json({ error: "Invalid rating." }, 400);
  }

  const isAdmin = await verifyAdminRole(userId, log);
  if (!isAdmin) {
    return res.json({ error: "Insufficient permissions." }, 403);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    const ratingZone = chosenRating <= 25 ? "red" : chosenRating <= 50 ? "orange" : chosenRating <= 75 ? "yellow" : "green";
    const now = new Date().toISOString();

    // Create review_overwrites document
    const overwriteData = {
      applicationId,
      overwriterUserId: userId,
      rating: chosenRating,
      ratingZone,
      overwrittenAt: now,
    };
    if (moderatorNote && typeof moderatorNote === "string" && moderatorNote.trim()) {
      overwriteData.note = moderatorNote.trim();
    }

    const overwriteDoc = await databases.createDocument(
      DATABASE_ID,
      OVERWRITES_COLLECTION_ID,
      "unique()",
      overwriteData
    );

    // Mark all moderator reviews for this app as overwritten
    const allReviews = await databases.listDocuments(
      DATABASE_ID,
      REVIEWS_COLLECTION_ID,
      [
        Query.equal("applicationId", applicationId),
        Query.limit(10),
      ]
    );

    for (const review of allReviews.documents) {
      try {
        await databases.updateDocument(
          DATABASE_ID,
          REVIEWS_COLLECTION_ID,
          review.$id,
          { overwrittenBy: overwriteDoc.$id }
        );
      } catch (updateErr) {
        log(`Failed to mark review ${review.$id} as overwritten:`, updateErr.message);
      }
    }

    // Update application with final rating and status
    const appUpdateData = {
      rating: chosenRating,
      ratingZone,
      status: "reviewed",
      reviewedAt: now,
    };

    if (moderatorNote && typeof moderatorNote === "string" && moderatorNote.trim()) {
      appUpdateData.moderatorNote = moderatorNote.trim();
    }

    await databases.updateDocument(
      DATABASE_ID,
      APPLICATIONS_COLLECTION_ID,
      applicationId,
      appUpdateData
    );

    log(`Conflict resolved for ${applicationId}: admin ${userId} (${chosenRating}%)`);

    return res.json({ success: true });
  } catch (e) {
    error("Failed to resolve conflict:", e.message);
    return res.json({ error: "Failed to resolve." }, 500);
  }
};
