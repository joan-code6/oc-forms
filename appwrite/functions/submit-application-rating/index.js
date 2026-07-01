const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT    = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID  = process.env.APPWRITE_PROJECT_ID;
const API_KEY     = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const APPLICATIONS_COLLECTION_ID = process.env.APPWRITE_APPLICATIONS_COLLECTION_ID;
const CLAIMS_COLLECTION_ID       = process.env.APPWRITE_CLAIMS_COLLECTION_ID;
const REVIEWS_COLLECTION_ID      = process.env.APPWRITE_MODERATOR_REVIEWS_COLLECTION_ID;
const SETTINGS_COLLECTION_ID     = process.env.APPWRITE_SETTINGS_COLLECTION_ID;
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

  const { applicationId, rating, moderatorNote } = body;

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

    // Prevent same moderator from reviewing the same app twice
    {
      const existingReviews = await databases.listDocuments(
        DATABASE_ID,
        REVIEWS_COLLECTION_ID,
        [
          Query.equal("applicationId", applicationId),
          Query.equal("moderatorUserId", userId),
          Query.limit(1),
        ]
      );
      if (existingReviews.total > 0) {
        return res.json({ success: false, error: "You have already reviewed this application." }, 409);
      }
    }

    // Read double review setting
    let doubleReviewEnabled = false;
    try {
      const settingsDoc = await databases.getDocument(
        DATABASE_ID,
        SETTINGS_COLLECTION_ID,
        "global"
      );
      doubleReviewEnabled = settingsDoc.doubleReviewEnabled || false;
    } catch {
      // Settings not found — default to single review
    }

    const ratingZone = getRatingZone(rating);

    const reviewData = {
      applicationId,
      moderatorUserId: userId,
      moderatorDiscordId: staffCheck.discordId,
      moderatorDiscordUsername: staffCheck.discordUsername,
      rating,
      ratingZone,
      reviewedAt: new Date().toISOString(),
    };

    if (moderatorNote && typeof moderatorNote === "string" && moderatorNote.trim()) {
      reviewData.moderatorNote = moderatorNote.trim();
    }

    // Create the review document first (atomic via unique())
    const reviewId = "unique()";
    await databases.createDocument(
      DATABASE_ID,
      REVIEWS_COLLECTION_ID,
      reviewId,
      reviewData
    );

    // COUNT reviews AFTER creating this one, so the count includes the new review.
    // This avoids the race condition where two simultaneous first reviews both see count=0.
    let reviewCount = 1;
    try {
      const countResult = await databases.listDocuments(
        DATABASE_ID,
        REVIEWS_COLLECTION_ID,
        [
          Query.equal("applicationId", applicationId),
          Query.limit(100),
        ]
      );
      reviewCount = countResult.total;
    } catch {
      // If we can't count, assume our own review exists (count ≥ 1)
    }

    // Determine new status:
    // - If double review is enabled AND this is the first review → pending_2nd
    // - Otherwise → reviewed
    let newStatus = "reviewed";
    if (doubleReviewEnabled && reviewCount < 2) {
      newStatus = "pending_2nd";
    }

    const appUpdateData = {
      status: newStatus,
      reviewedAt: new Date().toISOString(),
      reviewedBy: userId,
      rating,
      ratingZone,
    };

    if (moderatorNote && typeof moderatorNote === "string" && moderatorNote.trim()) {
      appUpdateData.moderatorNote = moderatorNote.trim();
    }

    try {
      await databases.updateDocument(
        DATABASE_ID,
        APPLICATIONS_COLLECTION_ID,
        applicationId,
        appUpdateData
      );
    } catch (updateErr) {
      // Rollback: delete the review we just created since the app update failed
      try {
        // We used "unique()" so we need to find the actual review document
        const createdReviews = await databases.listDocuments(
          DATABASE_ID,
          REVIEWS_COLLECTION_ID,
          [
            Query.equal("applicationId", applicationId),
            Query.equal("moderatorUserId", userId),
            Query.orderDesc("reviewedAt"),
            Query.limit(1),
          ]
        );
        if (createdReviews.documents.length > 0) {
          await databases.deleteDocument(
            DATABASE_ID,
            REVIEWS_COLLECTION_ID,
            createdReviews.documents[0].$id
          );
        }
      } catch (rollbackErr) {
        error("Rollback failed — review document may be orphaned:", rollbackErr.message);
      }
      error("Failed to update application after review:", updateErr.message);
      return res.json({ success: false, error: "Failed to save rating." }, 500);
    }

    // Clean up the claim document
    try {
      await databases.deleteDocument(
        DATABASE_ID,
        CLAIMS_COLLECTION_ID,
        applicationId
      );
    } catch {
      // Ignore cleanup failures — stale claim will be cleaned by scheduler
    }

    log(`Application ${applicationId} rated ${rating}% (${ratingZone}) by ${staffCheck.discordUsername}, new status: ${newStatus}`);

    return res.json({ success: true });
  } catch (e) {
    error("Failed to submit rating:", e.message);
    return res.json({ success: false, error: "Failed to save rating." }, 500);
  }
};
