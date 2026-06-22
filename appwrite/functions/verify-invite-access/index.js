const { Client, Users, Query } = require("node-appwrite");

const ENDPOINT          = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID        = process.env.APPWRITE_PROJECT_ID;
const API_KEY           = process.env.APPWRITE_API_KEY;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID  = process.env.DISCORD_GUILD_ID;
const DISCORD_FASTTRACK_ROLE_ID = process.env.DISCORD_FASTTRACK_ROLE_ID;

function getServerClient() {
  const client = new Client();
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return client;
}

async function getDiscordGuildMember(discordId) {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}`,
    {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) return null;
  return res.json();
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

    if (!discordIdentity) {
      log("No Discord identity found for user");
      return { allowed: false };
    }

    const discordId = discordIdentity.providerUid;
    if (!discordId) return { allowed: false };

    const member = await getDiscordGuildMember(discordId);
    if (!member || !member.roles) return { allowed: false };

    const hasRole = member.roles.includes(DISCORD_FASTTRACK_ROLE_ID);
    log("hasFasttrackRole:", hasRole);

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
  const { req, res, log } = context;

  const userId = req.headers?.["x-appwrite-user-id"];

  if (!userId) {
    return res.json({ allowed: false, error: "Unauthorized." }, 401);
  }

  const roleCheck = await verifyFasttrackRole(userId, log);
  if (!roleCheck.allowed) {
    log("Fasttrack access denied for user:", userId);
    return res.json({ allowed: false }, 200);
  }

  log(`Fasttrack access verified for user ${userId} (Discord: ${roleCheck.discordId})`);

  return res.json({
    allowed: true,
    userId,
    discordId: roleCheck.discordId,
    discordUsername: roleCheck.discordUsername,
  });
};
