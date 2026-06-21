const { Client, Databases, Users, Query, ID } = require("node-appwrite");

const ENDPOINT    = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID  = process.env.APPWRITE_PROJECT_ID;
const API_KEY     = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const APPLICATIONS_COLLECTION_ID = process.env.APPWRITE_APPLICATIONS_COLLECTION_ID;
const CLAIMS_COLLECTION_ID = process.env.APPWRITE_CLAIMS_COLLECTION_ID;
const SETTINGS_COLLECTION_ID = process.env.APPWRITE_SETTINGS_COLLECTION_ID;
const REVIEWS_COLLECTION_ID = process.env.APPWRITE_MODERATOR_REVIEWS_COLLECTION_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID  = process.env.DISCORD_GUILD_ID;
const DISCORD_STAFF_ROLE_ID = process.env.DISCORD_STAFF_ROLE_ID;

const LOCK_EXPIRY_MINUTES = 30;
const MAX_CLAIM_RETRIES = 5;
const MAX_STALE_CLEANUP = 100;

function getServerClient() {
  const client = new Client();
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return client;
}

async function getSettings(databases) {
  try {
    const settings = await databases.getDocument(
      DATABASE_ID,
      SETTINGS_COLLECTION_ID,
      "global"
    );
    return {
      appsPaused: settings.appsPaused || false,
      doubleReviewEnabled: settings.doubleReviewEnabled || false,
    };
  } catch {
    return { appsPaused: false, doubleReviewEnabled: false };
  }
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

async function fetchApplicantDiscordRoles(discordId) {
  if (!discordId) return { roles: [], unavailable: true };

  try {
    const memberRes = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}`,
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!memberRes.ok) return { roles: [], unavailable: true };

    const member = await memberRes.json();
    if (!member || !member.roles) return { roles: [], unavailable: true };

    const roleRes = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles`,
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!roleRes.ok) return { roles: [], unavailable: true };

    const guildRoles = await roleRes.json();
    const roleMap = {};
    for (const role of guildRoles) {
      roleMap[role.id] = role.name;
    }

    return {
      roles: member.roles.map((roleId) => roleMap[roleId]).filter(Boolean),
      unavailable: false,
    };
  } catch {
    return { roles: [], unavailable: true };
  }
}

function formatAnswer(val, fallbackId) {
  if (val === null || val === undefined) return "Unanswered";

  if (typeof val === "object" && val !== null) {
    if ("yes" in val) return val.yes ? "Yes" : "No";
    if ("answer" in val) return val.answer || "Unanswered";
    if ("text" in val) return val.text || fallbackId;
    return "Unanswered";
  }

  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "string") return val || "Unanswered";

  return "Unanswered";
}

function formatQuestionText(val, fallbackId) {
  if (val === null || val === undefined) return fallbackId;

  if (typeof val === "object" && val !== null && "text" in val) {
    return val.text || fallbackId;
  }

  return fallbackId;
}

function formatApplication(doc, discordRolesResult) {
  let yesNoAnswers = {};
  let textAnswers = {};
  let dropdownAnswers = {};
  try { yesNoAnswers = JSON.parse(doc.yesNoAnswers || "{}"); } catch { /* ignore */ }
  try { textAnswers = JSON.parse(doc.textAnswers || "{}"); } catch { /* ignore */ }
  try { dropdownAnswers = JSON.parse(doc.dropdownAnswers || "{}"); } catch { /* ignore */ }

  const answers = [
    ...Object.entries(yesNoAnswers).map(([qId, val]) => ({
      question: formatQuestionText(val, qId),
      answer: formatAnswer(val, qId),
    })),
    ...Object.entries(textAnswers).map(([qId, val]) => ({
      question: formatQuestionText(val, qId),
      answer: formatAnswer(val, qId),
    })),
    ...Object.entries(dropdownAnswers).map(([qId, val]) => ({
      question: formatQuestionText(val, qId),
      answer: formatAnswer(val, qId),
    })),
  ];

  const skinUrl = `https://mc-heads.net/body/${encodeURIComponent(doc.minecraftIGN)}`;

  return {
    id: doc.$id,
    minecraftIGN: doc.minecraftIGN,
    skinUrl,
    discordUsername: doc.discordUsername || "",
    discordRoles: discordRolesResult.roles || [],
    discordRolesUnavailable: discordRolesResult.unavailable || false,
    timezone: doc.timezone || "",
    createdAt: doc.createdAt || "",
    status: doc.status,
    answers,
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
    log("Staff access denied for get-next-application:", userId);
    return res.json({ error: "Insufficient permissions." }, 403);
  }

  let body;
  try {
    body = JSON.parse(req.body || "{}");
  } catch {
    return res.json({ error: "Invalid JSON payload." }, 400);
  }

  const { applicationId } = body;

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    // Check settings
    const settings = await getSettings(databases);

    if (settings.appsPaused && !applicationId) {
      return res.json({ application: null, paused: true });
    }

    // --- Specific application requested ---
    if (applicationId) {
      let doc;
      try {
        doc = await databases.getDocument(
          DATABASE_ID,
          APPLICATIONS_COLLECTION_ID,
          applicationId
        );
      } catch {
        return res.json({ application: null, error: "Application not found." });
      }

      if (doc.status === "reviewed" || doc.status === "closed") {
        return res.json({ application: null, error: "Application already reviewed." });
      }

      if (doc.status === "pending_2nd" && !settings.doubleReviewEnabled) {
        return res.json({ application: null, error: "Application already reviewed." });
      }

      // Check if this moderator already has an active claim on this app
      let existingClaim = null;
      try {
        existingClaim = await databases.getDocument(
          DATABASE_ID,
          CLAIMS_COLLECTION_ID,
          applicationId
        );
      } catch {
        // No claim exists
      }

      if (existingClaim && existingClaim.moderatorUserId !== userId) {
        return res.json({ application: null, error: "Application is being reviewed by another moderator." });
      }

      // If no claim exists and app is pending, claim it atomically
      if (!existingClaim && (doc.status === "pending" || doc.status === "pending_2nd")) {
        // If double review is on and app is pending_2nd,
        // check if this moderator already reviewed it
        if (settings.doubleReviewEnabled && doc.status === "pending_2nd") {
          try {
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
              return res.json({ application: null, error: "You have already reviewed this application." });
            }
          } catch {
            // If we can't check, proceed with claim
          }
        }

        const now = new Date().toISOString();
        try {
          await databases.createDocument(
            DATABASE_ID,
            CLAIMS_COLLECTION_ID,
            applicationId,
            {
              moderatorUserId: userId,
              claimedAt: now,
              originalStatus: doc.status,
            }
          );
        } catch {
          return res.json({ application: null, error: "Application was claimed by another moderator." });
        }

        // Update application status; if this fails, clean up the orphaned claim
        try {
          await databases.updateDocument(
            DATABASE_ID,
            APPLICATIONS_COLLECTION_ID,
            applicationId,
            {
              status: "in_review",
              reviewedBy: userId,
              reviewStartedAt: now,
            }
          );
        } catch (updateErr) {
          try {
            await databases.deleteDocument(DATABASE_ID, CLAIMS_COLLECTION_ID, applicationId);
          } catch {
            // Best-effort cleanup
          }
          return res.json({ application: null, error: "Failed to claim application. Please try again." });
        }
      }

      // Re-read to get fresh status after claim/update
      let freshDoc;
      try {
        freshDoc = await databases.getDocument(
          DATABASE_ID,
          APPLICATIONS_COLLECTION_ID,
          applicationId
        );
      } catch {
        freshDoc = doc;
      }

      const discordRolesResult = await fetchApplicantDiscordRoles(freshDoc.discordId);
      return res.json({ application: formatApplication(freshDoc, discordRolesResult) });
    }

    // --- Release any existing claim by this moderator ---
    const myClaims = await databases.listDocuments(
      DATABASE_ID,
      CLAIMS_COLLECTION_ID,
      [Query.equal("moderatorUserId", userId)]
    );

    for (const claim of myClaims.documents) {
      try {
        const app = await databases.getDocument(
          DATABASE_ID,
          APPLICATIONS_COLLECTION_ID,
          claim.$id
        );
        if (app.status === "in_review" && app.reviewedBy === userId) {
          // Restore to the correct pending status
          const restoreStatus = claim.originalStatus || "pending";
          await databases.updateDocument(
            DATABASE_ID,
            APPLICATIONS_COLLECTION_ID,
            claim.$id,
            { status: restoreStatus, reviewedBy: null, reviewStartedAt: null }
          );
        }
      } catch {
        // App may have been deleted
      }
      try {
        await databases.deleteDocument(DATABASE_ID, CLAIMS_COLLECTION_ID, claim.$id);
      } catch {
        // Ignore cleanup failures
      }
    }

    // --- Clean up expired claims ---
    const expiredThreshold = new Date(Date.now() - LOCK_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const expiredClaims = await databases.listDocuments(
      DATABASE_ID,
      CLAIMS_COLLECTION_ID,
      [
        Query.lessThan("claimedAt", expiredThreshold),
        Query.limit(MAX_STALE_CLEANUP),
      ]
    );

    for (const claim of expiredClaims.documents) {
      try {
        const app = await databases.getDocument(
          DATABASE_ID,
          APPLICATIONS_COLLECTION_ID,
          claim.$id
        );
        if (app.status === "in_review") {
          const restoreStatus = claim.originalStatus || "pending";
          await databases.updateDocument(
            DATABASE_ID,
            APPLICATIONS_COLLECTION_ID,
            claim.$id,
            { status: restoreStatus, reviewedBy: null, reviewStartedAt: null }
          );
        }
      } catch {
        // App may have been deleted
      }
      try {
        await databases.deleteDocument(
          DATABASE_ID,
          CLAIMS_COLLECTION_ID,
          claim.$id
        );
      } catch {
        // Ignore cleanup failures
      }
    }

    // --- Claim next pending application ---
    for (let attempt = 0; attempt < MAX_CLAIM_RETRIES; attempt++) {
      // First try pending apps, then pending_2nd if double review is enabled
      let doc = null;
      const pendingResult = await databases.listDocuments(
        DATABASE_ID,
        APPLICATIONS_COLLECTION_ID,
        [
          Query.equal("status", "pending"),
          Query.orderAsc("createdAt"),
          Query.limit(1),
        ]
      );
      doc = pendingResult.documents[0] || null;

      if (!doc && settings.doubleReviewEnabled) {
        const secondResult = await databases.listDocuments(
          DATABASE_ID,
          APPLICATIONS_COLLECTION_ID,
          [
            Query.equal("status", "pending_2nd"),
            Query.orderAsc("createdAt"),
            Query.limit(1),
          ]
        );
        doc = secondResult.documents[0] || null;
      }

      if (!doc) {
        return res.json({ application: null });
      }

      // If double review is on and app is pending_second_review,
      // check if this moderator already reviewed it
      if (settings.doubleReviewEnabled && doc.status === "pending_2nd") {
        try {
          const existingReviews = await databases.listDocuments(
            DATABASE_ID,
            REVIEWS_COLLECTION_ID,
            [
              Query.equal("applicationId", doc.$id),
              Query.equal("moderatorUserId", userId),
              Query.limit(1),
            ]
          );
          if (existingReviews.total > 0) {
            // This moderator already reviewed this app, skip it
            // Release any claim and move on
            log(`Skipping ${doc.$id}: moderator ${userId} already reviewed it`);
            continue;
          }
        } catch {
          // If we can't check, proceed with claim
        }
      }

      const now = new Date().toISOString();

      // Atomic claim: createDocument fails if document with this ID already exists
      try {
        await databases.createDocument(
          DATABASE_ID,
          CLAIMS_COLLECTION_ID,
          doc.$id,
          {
            moderatorUserId: userId,
            claimedAt: now,
            originalStatus: doc.status,
          }
        );
      } catch {
        log(`Claim attempt ${attempt + 1}: ${doc.$id} already claimed, retrying`);
        continue;
      }

      // Claim succeeded — update application status; clean up claim on failure
      try {
        await databases.updateDocument(
          DATABASE_ID,
          APPLICATIONS_COLLECTION_ID,
          doc.$id,
          {
            status: "in_review",
            reviewedBy: userId,
            reviewStartedAt: now,
          }
        );
      } catch (updateErr) {
        try {
          await databases.deleteDocument(DATABASE_ID, CLAIMS_COLLECTION_ID, doc.$id);
        } catch {
          // Best-effort cleanup
        }
        log(`Claim attempt ${attempt + 1}: ${doc.$id} — app update failed after claim, rolling back`);
        continue;
      }

      // Re-read to get fresh status after update
      let freshDoc;
      try {
        freshDoc = await databases.getDocument(
          DATABASE_ID,
          APPLICATIONS_COLLECTION_ID,
          doc.$id
        );
      } catch {
        freshDoc = doc;
      }

      const discordRolesResult = await fetchApplicantDiscordRoles(freshDoc.discordId);
      return res.json({ application: formatApplication(freshDoc, discordRolesResult) });
    }

    return res.json({ application: null, error: "Could not claim an application. Please try again." });
  } catch (e) {
    error("Failed to fetch next application:", e.message);
    return res.json({ error: "Failed to load application." }, 500);
  }
};
