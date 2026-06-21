const { Client, Users, Query } = require("node-appwrite");

const ENDPOINT          = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID        = process.env.APPWRITE_PROJECT_ID;
const API_KEY           = process.env.APPWRITE_API_KEY;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID  = process.env.DISCORD_GUILD_ID;
const DISCORD_STAFF_ROLE_ID = process.env.DISCORD_STAFF_ROLE_ID;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;

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

async function verifyStaffRole(userId, log) {
  try {
    const client = getServerClient();
    const users = new Users(client);
    const { identities: identityList } = await users.listIdentities([
      Query.equal("userId", userId)
    ]);
    log("identityList count:", identityList?.length ?? 0);

    const discordIdentity = identityList.find(
      (id) => id.provider === "discord"
    );

    if (!discordIdentity) {
      log("No Discord identity found for user");
      return { isStaff: false, isAdmin: false };
    }

    const discordId = discordIdentity.providerUid;
    log("Discord ID:", discordId);
    if (!discordId) return { isStaff: false, isAdmin: false };

    const member = await getDiscordGuildMember(discordId);
    log("Discord member found:", !!member, "roles:", member?.roles);

    if (!member || !member.roles) return { isStaff: false, isAdmin: false };

    log("ENV_DISCORD_STAFF_ROLE_ID:", JSON.stringify(DISCORD_STAFF_ROLE_ID), "type:", typeof DISCORD_STAFF_ROLE_ID);
    log("User roles:", JSON.stringify(member.roles));
    const hasStaffRole = member.roles.includes(DISCORD_STAFF_ROLE_ID);
    log("hasStaffRole:", hasStaffRole);

    const hasAdminRole = ADMIN_ROLE_ID ? member.roles.includes(ADMIN_ROLE_ID) : false;
    log("hasAdminRole:", hasAdminRole);

    return {
      isStaff: hasStaffRole,
      isAdmin: hasAdminRole,
      discordId,
      discordUsername: member.nick || member.user?.username || "",
    };
  } catch (e) {
    log("verifyStaffRole error:", e.message);
    return { isStaff: false, isAdmin: false };
  }
}

module.exports = async function (context) {
  const { req, res, log, error } = context;



  const userId = req.headers?.["x-appwrite-user-id"];

  if (!userId) {
    return res.json({ allowed: false, error: "Unauthorized." }, 401);
  }

  const staffCheck = await verifyStaffRole(userId, log);
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
    isAdmin: staffCheck.isAdmin || false,
  });
};
