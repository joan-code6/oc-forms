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

async function fetchDiscordJoinDate(discordId) {
  if (!discordId || !DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) return null;
  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}`,
      { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" } }
    );
    if (!res.ok) return null;
    const member = await res.json();
    return member?.joined_at || null;
  } catch {
    return null;
  }
}

function formatApplication(doc, joinedAt) {
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

  const skinUrl = `https://mc-heads.net/body/${encodeURIComponent(doc.minecraftIGN || "")}`;

  return {
    id: doc.$id,
    minecraftIGN: doc.minecraftIGN || "",
    skinUrl,
    discordUsername: doc.discordUsername || "",
    discordId: doc.discordId || "",
    joinedAt,
    timezone: doc.timezone || "",
    createdAt: doc.createdAt || "",
    status: doc.status || "",
    answers,
  };
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

  let body;
  try {
    body = JSON.parse(req.body || "{}");
  } catch {
    return res.json({ error: "Invalid JSON payload." }, 400);
  }

  const { reviewId } = body;
  if (!reviewId || typeof reviewId !== "string") {
    return res.json({ error: "Missing reviewId." }, 400);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    let reviewDoc;
    try {
      reviewDoc = await databases.getDocument(
        DATABASE_ID,
        REVIEWS_COLLECTION_ID,
        reviewId
      );
    } catch {
      return res.json({ error: "Review not found." }, 404);
    }

    const review = {
      id: reviewDoc.$id,
      applicationId: reviewDoc.applicationId,
      moderatorUserId: reviewDoc.moderatorUserId,
      moderatorDiscordId: reviewDoc.moderatorDiscordId,
      moderatorDiscordUsername: reviewDoc.moderatorDiscordUsername,
      rating: reviewDoc.rating,
      ratingZone: reviewDoc.ratingZone,
      moderatorNote: reviewDoc.moderatorNote || null,
      reviewedAt: reviewDoc.reviewedAt,
    };

    let application = null;
    if (reviewDoc.applicationId) {
      try {
        const appDoc = await databases.getDocument(
          DATABASE_ID,
          APPLICATIONS_COLLECTION_ID,
          reviewDoc.applicationId
        );
        const joinedAt = await fetchDiscordJoinDate(appDoc.discordId);
        application = formatApplication(appDoc, joinedAt);
      } catch (appErr) {
        log("Could not fetch application for review:", appErr.message);
      }
    }

    return res.json({ review, application });
  } catch (e) {
    error("Failed to fetch review:", e.message);
    return res.json({ error: "Failed to load review." }, 500);
  }
};
