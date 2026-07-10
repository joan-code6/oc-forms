const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT                     = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID                   = process.env.APPWRITE_PROJECT_ID;
const API_KEY                      = process.env.APPWRITE_API_KEY;
const DATABASE_ID                  = process.env.APPWRITE_DATABASE_ID;
const ACCEPTED_EVENT_COLLECTION_ID = process.env.APPWRITE_ACCEPTED_EVENT_COLLECTION_ID;
const DISCORD_BOT_TOKEN            = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID             = process.env.DISCORD_GUILD_ID;
const DISCORD_VIP_ROLE_ID          = process.env.DISCORD_VIP_ROLE_ID;

function getServerClient() {
  const client = new Client();
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return client;
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
    if (!discordIdentity) return { isVip: false };

    const discordId = discordIdentity.providerUid;
    if (!discordId) return { isVip: false };

    if (!DISCORD_VIP_ROLE_ID) {
      log("DISCORD_VIP_ROLE_ID not configured");
      return { isVip: false };
    }

    const res = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}`,
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) return { isVip: false };

    const member = await res.json();
    const hasVipRole = member.roles?.includes(DISCORD_VIP_ROLE_ID) || false;

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
  const { req, res, log, error } = context;

  const userId = req.headers?.["x-appwrite-user-id"];
  if (!userId) {
    return res.json({ success: false, error: "Unauthorized." }, 401);
  }

  let body;
  try {
    body = JSON.parse(req.body || "{}");
  } catch {
    return res.json({ success: false, error: "Invalid JSON payload." }, 400);
  }

  const { minecraftIGN } = body;
  const ign = (minecraftIGN || "").trim();

  if (!/^[a-zA-Z0-9_]{3,16}$/.test(ign)) {
    return res.json(
      { success: false, error: "Invalid Minecraft username format. Use 3-16 characters (letters, numbers, underscores)." },
      400
    );
  }

  const vipCheck = await verifyVipRole(userId, log);
  if (!vipCheck.isVip) {
    log("VIP access denied for user:", userId);
    return res.json({ success: false, error: "You do not have the VIP role." }, 403);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);
    const users = new Users(client);

    const userDoc = await users.get(userId);
    const currentLabels = userDoc.labels || [];
    if (!currentLabels.includes("undergroundEventAccepted")) {
      await users.updateLabels(userId, [...currentLabels, "undergroundEventAccepted"]);
    }

    const existing = await databases.listDocuments(
      DATABASE_ID,
      ACCEPTED_EVENT_COLLECTION_ID,
      [Query.equal("userId", userId), Query.limit(1)]
    );

    if (existing.total > 0) {
      return res.json({
        success: true,
        alreadyAccepted: true,
        discordUsername: vipCheck.discordUsername,
        minecraftIGN: existing.documents[0].minecraftIGN,
      });
    }

    await databases.createDocument(
      DATABASE_ID,
      ACCEPTED_EVENT_COLLECTION_ID,
      "unique()",
      {
        userId,
        discordUsername: vipCheck.discordUsername || userDoc.name || "",
        discordId: vipCheck.discordId || "",
        minecraftIGN: ign,
        rating: 100,
        assignedAt: new Date().toISOString(),
        assignedBy: "vip",
        dmSent: false,
      }
    );

    log(`VIP user ${vipCheck.discordUsername} (IGN: ${ign}) added to acceptedEvent`);

    return res.json({
      success: true,
      alreadyAccepted: false,
      discordUsername: vipCheck.discordUsername,
      discordId: vipCheck.discordId,
      minecraftIGN: ign,
    });
  } catch (e) {
    error("Failed to submit VIP:", e.message);
    return res.json({ success: false, error: "Failed to process VIP registration." }, 500);
  }
};
