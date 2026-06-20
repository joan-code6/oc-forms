const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT    = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID  = process.env.APPWRITE_PROJECT_ID;
const API_KEY     = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const APPLICATIONS_COLLECTION_ID = process.env.APPWRITE_APPLICATIONS_COLLECTION_ID;
const CLAIMS_COLLECTION_ID       = process.env.APPWRITE_CLAIMS_COLLECTION_ID;
const REVIEWS_COLLECTION_ID      = process.env.APPWRITE_MODERATOR_REVIEWS_COLLECTION_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID  = process.env.DISCORD_GUILD_ID;
const DISCORD_STAFF_ROLE_ID = process.env.DISCORD_STAFF_ROLE_ID;

const LOCK_EXPIRY_MINUTES = 30;

function getServerClient() {
  const client = new Client();
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return client;
}

function getRatingZone(value) {
  if (value <= 25) return "red";
  if (value <= 50) return "orange";
  if (value <= 75) return "yellow";
  return "green";
}

async function verifyStaffRole(userId) {
  try {
    const client = getServerClient();
    const users = new Users(client);
    const user = await users.get(userId);

    const identities = user.identities || [];
    const discordIdentity = identities.find(
      (id) => id.provider === "discord" || id.providerEmail?.includes("discord")
    );

    if (!discordIdentity) return { isStaff: false };

    const discordId = discordIdentity.identityId || discordIdentity.id;
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

module.exports = async function (context) {
  const { req, res, log, error } = context;

  const userId = req.headers?.["x-appwrite-user"];

  if (!userId) {
    return res.json({ success: false, error: "Unauthorized." }, 401);
  }

  let body;
  try {
    body = JSON.parse(req.body || "{}");
  } catch {
    return res.json({ success: false, error: "Invalid JSON payload." }, 400);
  }

  const { applicationId, rating } = body;

  if (!applicationId || typeof applicationId !== "string") {
    return res.json({ success: false, error: "Missing applicationId." }, 400);
  }

  if (typeof rating !== "number" || rating < 0 || rating > 100) {
    return res.json({ success: false, error: "Rating must be a number between 0 and 100." }, 400);
  }

  const staffCheck = await verifyStaffRole(userId);
  if (!staffCheck.isStaff) {
    log("User does not have staff role:", userId);
    return res.json({ success: false, error: "Insufficient permissions." }, 403);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    let application;
    try {
      application = await databases.getDocument(
        DATABASE_ID,
        APPLICATIONS_COLLECTION_ID,
        applicationId
      );
    } catch {
      return res.json({ success: false, error: "Application not found." }, 404);
    }

    if (application.status === "reviewed" || application.status === "closed") {
      return res.json({ success: false, error: "Application already reviewed." }, 409);
    }

    if (application.status === "in_review") {
      if (application.reviewedBy !== userId) {
        return res.json({ success: false, error: "Application is being reviewed by another moderator." }, 409);
      }

      if (application.reviewStartedAt) {
        const lockAge = Date.now() - new Date(application.reviewStartedAt).getTime();
        const lockExpiryMs = LOCK_EXPIRY_MINUTES * 60 * 1000;
        if (lockAge > lockExpiryMs) {
          return res.json({ success: false, error: "Review lock has expired. Please claim the application again." }, 409);
        }
      }
    }

    const ratingZone = getRatingZone(rating);

    await databases.createDocument(
      DATABASE_ID,
      REVIEWS_COLLECTION_ID,
      "unique()",
      {
        applicationId,
        moderatorUserId: userId,
        moderatorDiscordId: staffCheck.discordId,
        moderatorDiscordUsername: staffCheck.discordUsername,
        rating,
        ratingZone,
        reviewedAt: new Date().toISOString(),
      }
    );

    await databases.updateDocument(
      DATABASE_ID,
      APPLICATIONS_COLLECTION_ID,
      applicationId,
      {
        status: "reviewed",
        reviewedAt: new Date().toISOString(),
        reviewedBy: userId,
        rating,
        ratingZone,
      }
    );

    // Clean up the claim document
    try {
      await databases.deleteDocument(
        DATABASE_ID,
        CLAIMS_COLLECTION_ID,
        applicationId
      );
    } catch {
      // Ignore cleanup failures
    }

    log(`Application ${applicationId} rated ${rating}% (${ratingZone}) by ${staffCheck.discordUsername}`);

    return res.json({ success: true });
  } catch (e) {
    error("Failed to submit rating:", e.message);
    return res.json({ success: false, error: "Failed to save rating." }, 500);
  }
};
