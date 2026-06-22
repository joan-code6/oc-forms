import { Client, Databases, Users } from "appwrite";

// Environment variables set in Appwrite Console → Functions → Settings
const ENDPOINT    = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID  = process.env.APPWRITE_PROJECT_ID;
const API_KEY     = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const APPLICATIONS_COLLECTION_ID = process.env.APPWRITE_APPLICATIONS_APPLICATIONS_COLLECTION_ID;

function getServerClient() {
  const client = new Client();
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return client;
}

export default async function (context) {
  const { req, res, log, error } = context;

  // ── 1. Verify the user is authenticated ───────────────────────────
  const userId = req.headers?.["x-appwrite-user"];
  const sessionId = req.headers?.["x-appwrite-session"];

  if (!userId) {
    return res.json({ success: false, error: "Unauthorized. Please log in again." }, 401);
  }

  // ── 2. Parse and validate the payload ─────────────────────────────
  let body;
  try {
    body = JSON.parse(req.body || "{}");
  } catch {
    return res.json({ success: false, error: "Invalid JSON payload." }, 400);
  }

  const {
    minecraftIGN = "",
    timezone = "",
    yesNoAnswers = {},
    textAnswers = {},
    dropdownAnswers = {},
  } = body;

  // Minecraft username validation
  const ign = minecraftIGN.trim();
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(ign)) {
    return res.json(
      { success: false, error: "Invalid Minecraft username format." },
      400
    );
  }

  // Timezone validation
  if (!timezone || typeof timezone !== "string") {
    return res.json(
      { success: false, error: "Timezone is required." },
      400
    );
  }

  // ── 3. Fetch the user's Discord info from Appwrite ────────────────
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
    // Continue anyway — we have the userId
  }

  // ── 4. Check for duplicate submission ─────────────────────────────
  try {
    const client = getServerClient();
    const databases = new Databases(client);

    const existingByUser = await databases.listDocuments(
      DATABASE_ID,
      APPLICATIONS_COLLECTION_ID,
      [`equal("userId", "${userId}")`]
    );

    if (existingByUser.total > 0) {
      return res.json(
        { success: false, error: "You have already submitted an application." },
        409
      );
    }

    const existingByIGN = await databases.listDocuments(
      DATABASE_ID,
      APPLICATIONS_COLLECTION_ID,
      [`equal("minecraftIGN", "${ign}")`]
    );

    if (existingByIGN.total > 0) {
      return res.json(
        { success: false, error: "This Minecraft username has already been used in an application." },
        409
      );
    }
  } catch (e) {
    log("Duplicate check error:", e.message);
  }

  // ── 5. Write the application to the database ──────────────────────
  try {
    const client = getServerClient();
    const databases = new Databases(client);

    const doc = await databases.createDocument(
      DATABASE_ID,
      APPLICATIONS_COLLECTION_ID,
      "unique()",
      {
        userId,
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
}
