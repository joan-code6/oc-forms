const { Client, Users, Query, ID } = require("node-appwrite");

const ENDPOINT    = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID  = process.env.APPWRITE_PROJECT_ID;
const API_KEY     = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const INVITE_LINKS_COLLECTION_ID = process.env.APPWRITE_INVITE_LINKS_COLLECTION_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID  = process.env.DISCORD_GUILD_ID;
const DISCORD_FASTTRACK_ROLE_ID = process.env.DISCORD_FASTTRACK_ROLE_ID;

function getServerClient() {
  const client = new Client();
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return client;
}

function generateCode() {
  return ID.unique();
}

async function verifyFasttrackRole(userId, log) {
  try {
    const client = getServerClient();
    const users = new Users(client);
    const { identities: identityList } = await users.listIdentities([
      Query.equal("userId", userId)
    ]);

    const discordIdentity = identityList.find(
      (id) => id.provider === "discord"
    );

    if (!discordIdentity) return { allowed: false };

    const discordId = discordIdentity.providerUid;
    if (!discordId) return { allowed: false };

    const res = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}`,
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) return { allowed: false };

    const member = await res.json();
    const hasRole = member.roles?.includes(DISCORD_FASTTRACK_ROLE_ID) || false;

    return {
      allowed: hasRole,
      discordId,
      discordUsername: member.nick || member.user?.username || "",
    };
  } catch (e) {
    log("verifyFasttrackRole error:", e.message);
    return { allowed: false };
  }
}

module.exports = async function (context) {
  const { req, res, log, error } = context;

  const userId = req.headers?.["x-appwrite-user-id"];
  if (!userId) {
    return res.json({ success: false, error: "Unauthorized." }, 401);
  }

  const roleCheck = await verifyFasttrackRole(userId, log);
  if (!roleCheck.allowed) {
    return res.json({ success: false, error: "Insufficient permissions." }, 403);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);
    const code = generateCode();

    await databases.createDocument(
      DATABASE_ID,
      INVITE_LINKS_COLLECTION_ID,
      "unique()",
      {
        code,
        createdBy: userId,
        createdByDiscordId: roleCheck.discordId,
        createdByDiscordUsername: roleCheck.discordUsername,
        used: false,
        createdAt: new Date().toISOString(),
      }
    );

    const inviteUrl = `${process.env.FRONTEND_URL || "https://your-frontend-url.com"}/invite/${code}`;

    log(`Invite link created by ${roleCheck.discordUsername}, code: ${code}`);

    return res.json({ success: true, code, url: inviteUrl });
  } catch (e) {
    error("Failed to create invite link:", e.message);
    return res.json({ success: false, error: "Failed to create invite link." }, 500);
  }
};
