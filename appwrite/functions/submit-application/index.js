const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT    = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID  = process.env.APPWRITE_PROJECT_ID;
const API_KEY     = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const APPLICATIONS_COLLECTION_ID = process.env.APPWRITE_COLLECTION_ID;
const SETTINGS_COLLECTION_ID = process.env.APPWRITE_SETTINGS_COLLECTION_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID  = process.env.DISCORD_GUILD_ID;
const DISCORD_VIP_ROLE_ID = process.env.DISCORD_VIP_ROLE_ID;

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

  const userId = req.headers?.["x-appwrite-user-id"];

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
  let discordJoinDate = "";

  try {
    const client = getServerClient();
    const users = new Users(client);
    const user = await users.get(userId);
    discordUsername = user.name || "";
    discordEmail = user.email || "";

    const { identities: identityList } = await users.listIdentities([
      Query.equal("userId", userId)
    ]);
    const discordIdentity = identityList.find(
      (id) => id.provider === "discord"
    );
    if (discordIdentity) {
      discordId = discordIdentity.providerUid || "";
    }
  } catch (e) {
    log("Could not fetch user from Appwrite:", e.message);
    return res.json({ success: false, error: "Invalid user." }, 401);
  }

  try {
    if (discordId && DISCORD_BOT_TOKEN && DISCORD_GUILD_ID) {
      const memberRes = await fetch(
        `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}`,
        { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" } }
      );
      if (memberRes.ok) {
        const member = await memberRes.json();
        discordJoinDate = (member.joined_at || "").substring(0, 30);
      }
    }
  } catch {
    // non-critical
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    const existingByUser = await databases.listDocuments(
      DATABASE_ID,
      APPLICATIONS_COLLECTION_ID,
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
      APPLICATIONS_COLLECTION_ID,
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

  try {
    const settingsClient = getServerClient();
    const settingsDb = new Databases(settingsClient);
    const settings = await settingsDb.getDocument(
      DATABASE_ID,
      SETTINGS_COLLECTION_ID,
      "global"
    );
    if (settings.appsPaused) {
      return res.json(
        { success: false, error: "Applications are currently paused. Please check back later." },
        423
      );
    }
  } catch (e) {
    log("Pause check error (allowing through):", e.message);
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
      APPLICATIONS_COLLECTION_ID,
      "unique()",
      {
        userID: userId,
        discordUsername,
        discordEmail,
        discordId,
        discordJoinDate,
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

    // VIP mode notification: check if VIP mode is enabled and user has VIP role
    try {
      const settings = await databases.getDocument(
        DATABASE_ID,
        SETTINGS_COLLECTION_ID,
        "global"
      );
      if (settings.vipEnabled && settings.vipChannelId && DISCORD_VIP_ROLE_ID) {
        const memberRes = await fetch(
          `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}`,
          { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" } }
        );
        if (memberRes.ok) {
          const member = await memberRes.json();
          if (member.roles?.includes(DISCORD_VIP_ROLE_ID)) {
            const embed = {
              title: "New VIP Application",
              description: `A VIP member has submitted a new application.`,
              color: 0xf59e0b,
              fields: [
                { name: "Discord", value: discordUsername || "Unknown", inline: true },
                { name: "Minecraft IGN", value: ign, inline: true },
              ],
              footer: { text: "OutCraft Applications" },
              timestamp: new Date().toISOString(),
            };
            await fetch(
              `https://discord.com/api/v10/channels/${settings.vipChannelId}/messages`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ embeds: [embed] }),
              }
            );
            log(`VIP notification sent for ${discordUsername} to channel ${settings.vipChannelId}`);
          }
        }
      }
    } catch (vipErr) {
      log("VIP notification check failed (non-critical):", vipErr.message);
    }

    return res.json({ success: true, documentId: doc.$id });
  } catch (e) {
    error("Failed to write application:", e.message);
    return res.json(
      { success: false, error: "Failed to save your application. Please try again." },
      500
    );
  }
};
