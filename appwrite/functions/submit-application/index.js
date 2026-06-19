const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT    = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID  = process.env.APPWRITE_PROJECT_ID;
const API_KEY     = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const COLLECTION_ID = process.env.APPWRITE_COLLECTION_ID;

function getServerClient() {
  const client = new Client();
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return client;
}

module.exports = async function (context) {
  const { req, res, log, error } = context;

  let body;
  try {
    body = JSON.parse(req.body || "{}");
  } catch {
    return res.json({ success: false, error: "Invalid JSON payload." }, 400);
  }

  const userId = body.userId;

  if (!userId || typeof userId !== "string") {
    return res.json({ success: false, error: "Missing userId." }, 401);
  }

  const {
    minecraftIGN = "",
    timezone = "",
    yesNoAnswers = {},
    textAnswers = {},
    dropdownAnswers = {},
  } = body;

  const ign = minecraftIGN.trim();
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(ign)) {
    return res.json(
      { success: false, error: "Invalid Minecraft username format." },
      400
    );
  }

  if (!timezone || typeof timezone !== "string") {
    return res.json(
      { success: false, error: "Timezone is required." },
      400
    );
  }

  let discordUsername = "";
  let discordEmail = "";

  try {
    const client = getServerClient();
    const users = new Users(client);
    const user = await users.get(userId);
    discordUsername = user.name || "";
    discordEmail = user.email || "";
  } catch (e) {
    log("Could not fetch user from Appwrite:", e.message);
    return res.json({ success: false, error: "Invalid user." }, 401);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    const existing = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_ID,
      [Query.equal("userID", userId)]
    );

    if (existing.total > 0) {
      return res.json(
        { success: false, error: "You have already submitted an application." },
        409
      );
    }
  } catch (e) {
    log("Duplicate check error:", e.message);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    const doc = await databases.createDocument(
      DATABASE_ID,
      COLLECTION_ID,
      "unique()",
      {
        userID: userId,
        discordUsername,
        discordEmail,
        minecraftIGN: ign,
        timezone,
        yesNoAnswers: JSON.stringify(yesNoAnswers),
        textAnswers: JSON.stringify(textAnswers),
        dropdownAnswers: JSON.stringify(dropdownAnswers),
        status: "pending",
        createdAt: new Date().toISOString(),
      }
    );

    log(`Application submitted by ${discordUsername} (IGN: ${ign}), docId: ${doc.$id}`);

    return res.json({ success: true, documentId: doc.$id });
  } catch (e) {
    error("Failed to write application:", e.message);
    return res.json(
      { success: false, error: "Failed to save your application. Please try again." },
      500
    );
  }
};
