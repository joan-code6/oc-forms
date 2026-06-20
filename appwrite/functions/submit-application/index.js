const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT    = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID  = process.env.APPWRITE_PROJECT_ID;
const API_KEY     = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const COLLECTION_ID = process.env.APPWRITE_COLLECTION_ID;

const QUESTION_TEXT = {
  q1: "Do you have a working microphone?",
  q2: "Do you have clipping software?",
  q3: "Do you acknowledge that you must be in the discord server to be accepted?",
  q4: "Have you read the event rules and understand the penalties of breaking these rules may result in bans from all future events?",
  d1: "What layer would you like to be apart of?",
  t1: "Are you applying alone or with other people?",
  t2: "What civilization events have you played in the past, what role did you play in them and what did you get up to?",
  t3: "What type of characters do you want to play, what will they get up to?",
  t4: "What are your goals for this event and for your character? What's your lore? How could you relate this with the underground theme?",
  t5: "What are your strongest Minecraft skills? Explain how you would use them.",
  t6: "If you were tasked to make a build for your nation, what would the build theme be? What would the building type be? A castle, a tower, a hotel...",
  t7: "What's your ideal biome to live in or make a kingdom from? It can be a vanilla biome or a custom one.",
  t10: "If you lead a kingdom, what would you value the most: power, membership, builds, reputation?",
  t11: "If you led a team, what would you want your team's reputation to be vs what it would actually end up being?",
  t12: "Your civilization team has been defeated. What legacy will your character leave behind?",
  t13: "Will you be able to play the full event? If there are days you couldn't attend, what days would they be?",
};

function getServerClient() {
  const client = new Client();
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return client;
}

module.exports = async function (context) {
  const { req, res, log, error } = context;

  const userId = req.headers?.["x-appwrite-user"];

  if (!userId) {
    return res.json({ success: false, error: "Unauthorized. Please log in again." }, 401);
  }

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
  let discordId = "";

  try {
    const client = getServerClient();
    const users = new Users(client);
    const user = await users.get(userId);
    discordUsername = user.name || "";
    discordEmail = user.email || "";

    const identities = user.identities || [];
    const discordIdentity = identities.find(
      (id) => id.provider === "discord" || id.providerEmail?.includes("discord")
    );
    if (discordIdentity) {
      discordId = discordIdentity.identityId || discordIdentity.id || "";
    }
  } catch (e) {
    log("Could not fetch user from Appwrite:", e.message);
    return res.json({ success: false, error: "Invalid user." }, 401);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    const existingByUser = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_ID,
      [Query.equal("userID", userId)]
    );

    if (existingByUser.total > 0) {
      return res.json(
        { success: false, error: "You have already submitted an application." },
        409
      );
    }

    const existingByIGN = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_ID,
      [Query.equal("minecraftIGN", ign)]
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

  const enrichedYesNo = {};
  for (const [key, val] of Object.entries(yesNoAnswers)) {
    enrichedYesNo[key] = { text: QUESTION_TEXT[key] || key, yes: !!val };
  }

  const enrichedText = {};
  for (const [key, val] of Object.entries(textAnswers)) {
    enrichedText[key] = { text: QUESTION_TEXT[key] || key, answer: String(val || "") };
  }

  const enrichedDropdown = {};
  for (const [key, val] of Object.entries(dropdownAnswers)) {
    enrichedDropdown[key] = { text: QUESTION_TEXT[key] || key, answer: String(val || "") };
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
        discordId,
        minecraftIGN: ign,
        timezone,
        yesNoAnswers: JSON.stringify(enrichedYesNo),
        textAnswers: JSON.stringify(enrichedText),
        dropdownAnswers: JSON.stringify(enrichedDropdown),
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
