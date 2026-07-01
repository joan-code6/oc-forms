const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT          = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID        = process.env.APPWRITE_PROJECT_ID;
const API_KEY           = process.env.APPWRITE_API_KEY;
const DATABASE_ID       = process.env.APPWRITE_DATABASE_ID;
const ACCEPTED_EVENT_COLLECTION_ID = process.env.APPWRITE_ACCEPTED_EVENT_COLLECTION_ID;
const DISCORD_BOT_TOKEN      = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID       = process.env.DISCORD_GUILD_ID;
const DISCORD_STAFF_ROLE_ID  = process.env.DISCORD_STAFF_ROLE_ID;
const ADMIN_ROLE_ID          = process.env.ADMIN_ROLE_ID;

function getServerClient() {
  const client = new Client();
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return client;
}

async function verifyAdmin(userId) {
  try {
    const client = getServerClient();
    const users = new Users(client);
    const { identities: identityList } = await users.listIdentities([
      Query.equal("userId", userId)
    ]);

    const discordIdentity = identityList.find(
      (id) => id.provider === "discord"
    );
    if (!discordIdentity) return { isAdmin: false };

    const discordId = discordIdentity.providerUid;
    if (!discordId) return { isAdmin: false };

    const res = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}`,
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) return { isAdmin: false };

    const member = await res.json();
    const hasAdminRole = ADMIN_ROLE_ID ? member.roles?.includes(ADMIN_ROLE_ID) || false : false;

    return {
      isAdmin: hasAdminRole,
      discordId,
      discordUsername: member.nick || member.user?.username || "",
    };
  } catch {
    return { isAdmin: false };
  }
}

async function getAcceptedUsers(databases, offset = 0, limit = 50) {
  try {
    const queries = [Query.orderDesc("assignedAt"), Query.limit(limit)];
    if (offset > 0) {
      queries.push(Query.offset(offset));
    }
    const result = await databases.listDocuments(
      DATABASE_ID,
      ACCEPTED_EVENT_COLLECTION_ID,
      queries
    );
    const users = result.documents.map((doc) => ({
      id: doc.$id,
      userId: doc.userId,
      discordUsername: doc.discordUsername || "",
      discordId: doc.discordId || "",
      minecraftIGN: doc.minecraftIGN || "",
      rating: doc.rating || 0,
    }));
    return { users, total: result.total };
  } catch {
    return { users: [], total: 0 };
  }
}

async function getAllAcceptedUsers(databases) {
  const allUsers = [];
  let offset = 0;
  const pageLimit = 200;
  let hasMore = true;
  while (hasMore) {
    const result = await databases.listDocuments(
      DATABASE_ID,
      ACCEPTED_EVENT_COLLECTION_ID,
      [Query.orderDesc("assignedAt"), Query.limit(pageLimit), Query.offset(offset)]
    );
    for (const doc of result.documents) {
      allUsers.push({
        id: doc.$id,
        userId: doc.userId,
        discordUsername: doc.discordUsername || "",
        discordId: doc.discordId || "",
        minecraftIGN: doc.minecraftIGN || "",
        rating: doc.rating || 0,
      });
    }
    hasMore = result.documents.length === pageLimit;
    offset += result.documents.length;
  }
  return allUsers;
}

async function createDmChannel(discordUserId) {
  const res = await fetch(
    "https://discord.com/api/v10/users/@me/channels",
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: discordUserId }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create DM channel (${res.status}): ${text}`);
  }
  const channel = await res.json();
  return channel.id;
}

async function sendDmToChannel(channelId, message) {
  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: message }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to send DM (${res.status}): ${text}`);
  }
  return true;
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

  const { action, message, targetDiscordIds, offset, limit } = body;

  if (!["preview", "send", "send-test"].includes(action)) {
    return res.json({ success: false, error: "action must be 'preview', 'send', or 'send-test'." }, 400);
  }

  const adminCheck = await verifyAdmin(userId);
  if (!adminCheck.isAdmin) {
    log("Admin access denied:", userId);
    return res.json({ success: false, error: "Insufficient permissions." }, 403);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    if (action === "preview") {
      const pageOffset = typeof offset === "number" ? offset : 0;
      const pageLimit = Math.min(typeof limit === "number" ? limit : 50, 100);
      const { users: acceptedUsers, total } = await getAcceptedUsers(databases, pageOffset, pageLimit);
      return res.json({
        success: true,
        action: "preview",
        total,
        users: acceptedUsers,
        hasMore: pageOffset + pageLimit < total,
      });
    }

    if (action === "send-test") {
      if (!message || !targetDiscordIds || !Array.isArray(targetDiscordIds) || targetDiscordIds.length === 0) {
        return res.json({ success: false, error: "message and targetDiscordIds are required for send-test." }, 400);
      }

      let sent = 0;
      let failed = 0;
      const details = [];

      for (const discordId of targetDiscordIds) {
        try {
          const channelId = await createDmChannel(discordId);
          await sendDmToChannel(channelId, message);
          sent++;
          details.push({ discordId, status: "ok" });
        } catch (e) {
          failed++;
          details.push({ discordId, error: e.message });
        }
      }

      log(`Test DMs: ${sent} sent, ${failed} failed`);
      return res.json({ success: true, action: "send-test", sent, failed, details });
    }

    if (action === "send") {
      if (!message) {
        return res.json({ success: false, error: "message is required for send." }, 400);
      }

      const acceptedUsers = await getAllAcceptedUsers(databases);

      let recipients;
      if (targetDiscordIds && Array.isArray(targetDiscordIds) && targetDiscordIds.length > 0) {
        recipients = acceptedUsers.filter((u) => targetDiscordIds.includes(u.discordId));
      } else {
        recipients = acceptedUsers;
      }

      if (recipients.length === 0) {
        return res.json({ success: false, error: "No recipients found." }, 400);
      }

      let sent = 0;
      let failed = 0;
      const details = [];

      for (const user of recipients) {
        if (!user.discordId) {
          failed++;
          details.push({ userId: user.userId, discordUsername: user.discordUsername, error: "No Discord ID" });
          continue;
        }

        try {
          const channelId = await createDmChannel(user.discordId);
          await sendDmToChannel(channelId, message);
          sent++;
          details.push({ userId: user.userId, discordUsername: user.discordUsername, discordId: user.discordId, status: "ok" });
        } catch (e) {
          failed++;
          details.push({ userId: user.userId, discordUsername: user.discordUsername, discordId: user.discordId, error: e.message });
        }
      }

      log(`DMs: ${sent} sent, ${failed} failed out of ${recipients.length} recipients`);
      return res.json({ success: true, action: "send", sent, failed, total: recipients.length, details });
    }
  } catch (e) {
    error("Discord DM action failed:", e.message);
    return res.json({ success: false, error: "Failed to process Discord DM action." }, 500);
  }
};
