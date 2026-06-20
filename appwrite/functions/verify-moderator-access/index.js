const { Client, Users } = require("node-appwrite");

const ENDPOINT          = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID        = process.env.APPWRITE_PROJECT_ID;
const API_KEY           = process.env.APPWRITE_API_KEY;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID  = process.env.DISCORD_GUILD_ID;
const DISCORD_STAFF_ROLE_ID = process.env.DISCORD_STAFF_ROLE_ID;

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

  if (!res.ok) {
    return null;
  }

  return res.json();
}

async function verifyStaffRole(userId) {
  try {
    const client = getServerClient();
    const users = new Users(client);
    const user = await users.get(userId);

    const identities = user.identities || [];
    const discordIdentity = identities.find(
      (id) => id.provider === "discord" || id.providerEmail?.includes("discord")
    );

    if (!discordIdentity) return { isStaff: false };

    const discordId = discordIdentity.identityId || discordIdentity.id;
    if (!discordId) return { isStaff: false };

    const member = await getDiscordGuildMember(discordId);

    if (!member || !member.roles) return { isStaff: false };

    const hasStaffRole = member.roles.includes(DISCORD_STAFF_ROLE_ID);

    return {
      isStaff: hasStaffRole,
      discordId,
      discordUsername: member.nick || member.user?.username || "",
    };
  } catch {
    return { isStaff: false };
  }
}

module.exports = async function (context) {
  const { req, res, log, error } = context;

  const userId = req.headers?.["x-appwrite-user"];

  if (!userId) {
    return res.json({ allowed: false, error: "Unauthorized." }, 401);
  }

  const staffCheck = await verifyStaffRole(userId);
  if (!staffCheck.isStaff) {
    log("Staff access denied for user:", userId);
    return res.json({ allowed: false }, 200);
  }

  log(`Staff access verified for user ${userId} (Discord: ${staffCheck.discordId})`);

  return res.json({
    allowed: true,
    userId,
    discordId: staffCheck.discordId,
    discordUsername: staffCheck.discordUsername,
  });
};
