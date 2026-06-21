const { Client, Databases, Query } = require("node-appwrite");

const ENDPOINT          = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID        = process.env.APPWRITE_PROJECT_ID;
const API_KEY           = process.env.APPWRITE_API_KEY;
const DATABASE_ID       = process.env.APPWRITE_DATABASE_ID;
const REVIEWS_COLLECTION_ID = process.env.APPWRITE_MODERATOR_REVIEWS_COLLECTION_ID;
const APPLICATIONS_COLLECTION_ID = process.env.APPWRITE_APPLICATIONS_COLLECTION_ID;
const OVERWRITES_COLLECTION_ID = "6a3802542e74947140f0";

function getServerClient() {
  const client = new Client();
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return client;
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

function formatApplication(doc) {
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

  let body;
  try {
    body = JSON.parse(req.body || "{}");
  } catch {
    return res.json({ error: "Invalid JSON payload." }, 400);
  }

  const { applicationId } = body;
  if (!applicationId || typeof applicationId !== "string") {
    return res.json({ error: "Missing applicationId." }, 400);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    let application = null;
    try {
      const appDoc = await databases.getDocument(
        DATABASE_ID,
        APPLICATIONS_COLLECTION_ID,
        applicationId
      );
      application = formatApplication(appDoc);
    } catch (appErr) {
      log("Could not fetch application:", appErr.message);
    }

    let reviews = [];
    try {
      const reviewsResult = await databases.listDocuments(
        DATABASE_ID,
        REVIEWS_COLLECTION_ID,
        [
          Query.equal("applicationId", applicationId),
          Query.orderDesc("reviewedAt"),
          Query.limit(10),
        ]
      );
      reviews = reviewsResult.documents.map((doc) => ({
        id: doc.$id,
        applicationId: doc.applicationId,
        moderatorUserId: doc.moderatorUserId,
        moderatorDiscordId: doc.moderatorDiscordId,
        moderatorDiscordUsername: doc.moderatorDiscordUsername,
        rating: doc.rating,
        ratingZone: doc.ratingZone,
        moderatorNote: doc.moderatorNote || null,
        reviewedAt: doc.reviewedAt,
        overwrittenBy: doc.overwrittenBy || null,
      }));
    } catch (revErr) {
      log("Could not fetch reviews:", revErr.message);
    }

    let overwrite = null;
    try {
      const overwritesResult = await databases.listDocuments(
        DATABASE_ID,
        OVERWRITES_COLLECTION_ID,
        [
          Query.equal("applicationId", applicationId),
          Query.orderDesc("overwrittenAt"),
          Query.limit(1),
        ]
      );
      if (overwritesResult.documents.length > 0) {
        const doc = overwritesResult.documents[0];
        overwrite = {
          id: doc.$id,
          applicationId: doc.applicationId,
          overwriterUserId: doc.overwriterUserId,
          rating: doc.rating,
          ratingZone: doc.ratingZone,
          note: doc.note || null,
          overwrittenAt: doc.overwrittenAt,
        };
      }
    } catch (owErr) {
      log("Could not fetch overwrites:", owErr.message);
    }

    return res.json({ application, reviews, overwrite });
  } catch (e) {
    error("Failed to fetch conflict detail:", e.message);
    return res.json({ error: "Failed to load conflict detail." }, 500);
  }
};
