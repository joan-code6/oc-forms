const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT          = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID        = process.env.APPWRITE_PROJECT_ID;
const API_KEY           = process.env.APPWRITE_API_KEY;
const DATABASE_ID       = process.env.APPWRITE_DATABASE_ID;
const SETTINGS_COLLECTION_ID = process.env.APPWRITE_SETTINGS_COLLECTION_ID;
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

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    let settings;
    try {
      settings = await databases.getDocument(
        DATABASE_ID,
        SETTINGS_COLLECTION_ID,
        "global"
      );
    } catch {
      settings = {
        appsPaused: false,
        doubleReviewEnabled: false,
      };
    }

    return res.json({
      appsPaused: settings.appsPaused || false,
      doubleReviewEnabled: settings.doubleReviewEnabled || false,
    });
  } catch (e) {
    error("Failed to fetch settings:", e.message);
    return res.json({ error: "Failed to load settings." }, 500);
  }
};
