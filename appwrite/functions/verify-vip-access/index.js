const { Client, Users, Query } = require("node-appwrite");

const ENDPOINT          = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID        = process.env.APPWRITE_PROJECT_ID;
const API_KEY           = process.env.APPWRITE_API_KEY;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID  = process.env.DISCORD_GUILD_ID;
const DISCORD_VIP_ROLE_ID = process.env.DISCORD_VIP_ROLE_ID;

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

async function verifyVipRole(userId, log) {
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
      return { isVip: false };
    }

    const discordId = discordIdentity.providerUid;
    if (!discordId) return { isVip: false };

    if (!DISCORD_VIP_ROLE_ID) {
      log("DISCORD_VIP_ROLE_ID not configured");
      return { isVip: false };
    }

    const member = await getDiscordGuildMember(discordId);

    if (!member || !member.roles) return { isVip: false };

    const hasVipRole = member.roles.includes(DISCORD_VIP_ROLE_ID);

    return {
      isVip: hasVipRole,
      discordId,
      discordUsername: member.nick || member.user?.username || "",
    };
  } catch (e) {
    log("verifyVipRole error:", e.message);
    return { isVip: false };
  }
}

module.exports = async function (context) {
  const { req, res, log } = context;

  const userId = req.headers?.["x-appwrite-user-id"];

  if (!userId) {
    return res.json({ allowed: false, error: "Unauthorized." }, 401);
  }

  const vipCheck = await verifyVipRole(userId, log);

  return res.json({
    allowed: vipCheck.isVip,
    discordId: vipCheck.discordId || null,
    discordUsername: vipCheck.discordUsername || null,
  });
};
