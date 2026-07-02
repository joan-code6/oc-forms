const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT          = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID        = process.env.APPWRITE_PROJECT_ID;
const API_KEY           = process.env.APPWRITE_API_KEY;
const DATABASE_ID       = process.env.APPWRITE_DATABASE_ID;
const ACCEPTED_EVENT_COLLECTION_ID = process.env.APPWRITE_ACCEPTED_EVENT_COLLECTION_ID;
const ROLE_EMBED_STATE_COLLECTION_ID = process.env.APPWRITE_ROLE_EMBED_STATE_COLLECTION_ID;
const DISCORD_BOT_TOKEN      = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID       = process.env.DISCORD_GUILD_ID;
const DISCORD_STAFF_ROLE_ID  = process.env.DISCORD_STAFF_ROLE_ID;
const ADMIN_ROLE_ID          = process.env.ADMIN_ROLE_ID;
const DISCORD_EVENT_ROLE_ID  = process.env.DISCORD_Underground_Event_Participant_ROLE_ID;

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

async function sendDM(discordId, minecraftIGN) {
  try {
    const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: discordId }),
    });
    if (!dmRes.ok) return { success: false, error: `Failed to create DM channel: ${dmRes.status}` };

    const dmChannel = await dmRes.json();

    const embed = {
      title: "OutCraft Underground",
      description: "You have been accepted to the OutCraft Underground event!\n\nYour application has been reviewed and you are now on the accepted list. Welcome to Underground!",
      color: 0x22c55e,
      fields: [
        {
          name: "Minecraft IGN",
          value: minecraftIGN || "N/A",
          inline: true,
        },
      ],
      footer: { text: "OutCraft Applications" },
      timestamp: new Date().toISOString(),
    };

    const msgRes = await fetch(
      `https://discord.com/api/v10/channels/${dmChannel.id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ embeds: [embed] }),
      }
    );

    return msgRes.ok
      ? { success: true }
      : { success: false, error: `Failed to send DM: ${msgRes.status}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getEmbedState(databases) {
  if (!ROLE_EMBED_STATE_COLLECTION_ID) return null;
  try {
    const result = await databases.listDocuments(
      DATABASE_ID,
      ROLE_EMBED_STATE_COLLECTION_ID,
      [Query.limit(1)]
    );
    if (result.documents.length > 0) {
      const doc = result.documents[0];
      return { channelId: doc.channelId, messageId: doc.messageId };
    }
    return null;
  } catch {
    return null;
  }
}

async function updateEmbedInDiscord(embedState, acceptedUsers, log) {
  if (!embedState) return;

  const userList = acceptedUsers
    .map((u, i) => {
      const ign = u.minecraftIGN || "N/A";
      const tag = u.discordId ? `<@${u.discordId}>` : "";
      return `${i + 1}. ${tag} — **${ign}**`;
    })
    .join("\n");

  const description = userList.length > 4000
    ? userList.substring(0, 4000) + "\n\n...and more"
    : userList;

  const embed = {
    title: `Accepted Players (${acceptedUsers.length})`,
    description: description || "No accepted players yet.",
    color: 0x22c55e,
    footer: {
      text: `Last updated: ${new Date().toLocaleString("en-US", { timeZone: "UTC" })} UTC`,
    },
  };

  const body = {
    content: `Accepted players list (${acceptedUsers.length} total)`,
    embeds: [embed],
    allowed_mentions: { parse: [] },
  };

  try {
    const res = await fetch(
      `https://discord.com/api/v10/channels/${embedState.channelId}/messages/${embedState.messageId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      log(`Failed to update embed: ${res.status}`);
    }
  } catch (e) {
    log(`Error updating embed: ${e.message}`);
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

  const { action } = body;

  if (action !== "assign" && action !== "remove") {
    return res.json({ success: false, error: "action must be 'assign' or 'remove'." }, 400);
  }

  if (!DISCORD_EVENT_ROLE_ID) {
    return res.json({ success: false, error: "DISCORD_Underground_Event_Participant_ROLE_ID is not configured." }, 500);
  }

  const adminCheck = await verifyAdmin(userId);
  if (!adminCheck.isAdmin) {
    log("Admin access denied:", userId);
    return res.json({ success: false, error: "Insufficient permissions." }, 403);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);
    const users = new Users(client);

    const result = await databases.listDocuments(
      DATABASE_ID,
      ACCEPTED_EVENT_COLLECTION_ID,
      [Query.limit(10000)]
    );

    let success = 0;
    let failed = 0;
    let dmSuccess = 0;
    let dmFailed = 0;
    const details = [];

    for (const doc of result.documents) {
      try {
        let discordId = doc.discordId;

        if (!discordId) {
          const { identities: identityList } = await users.listIdentities([
            Query.equal("userId", doc.userId)
          ]);
          const discordIdentity = identityList.find((id) => id.provider === "discord");
          discordId = discordIdentity?.providerUid;
        }

        if (!discordId) {
          failed++;
          details.push({ userId: doc.userId, discordUsername: doc.discordUsername, error: "No Discord ID found" });
          continue;
        }

        const method = action === "assign" ? "PUT" : "DELETE";
        const discordRes = await fetch(
          `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}/roles/${DISCORD_EVENT_ROLE_ID}`,
          {
            method,
            headers: {
              Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (discordRes.ok) {
          success++;
          details.push({ userId: doc.userId, discordUsername: doc.discordUsername, status: "ok" });

          if (action === "assign" && !doc.dmSent) {
            const dmResult = await sendDM(discordId, doc.minecraftIGN);
            if (dmResult.success) {
              dmSuccess++;
              try {
                await databases.updateDocument(DATABASE_ID, ACCEPTED_EVENT_COLLECTION_ID, doc.$id, { dmSent: true });
              } catch (e) {
                log(`Failed to update dmSent for ${doc.discordUsername}: ${e.message}`);
              }
            } else {
              dmFailed++;
            }
          }
        } else {
          failed++;
          const resText = await discordRes.text();
          details.push({ userId: doc.userId, discordUsername: doc.discordUsername, error: `Discord API ${discordRes.status}: ${resText}` });
        }
      } catch (e) {
        failed++;
        details.push({ userId: doc.userId, discordUsername: doc.discordUsername, error: e.message });
      }
    }

    if (action === "assign") {
      const embedState = await getEmbedState(databases);
      await updateEmbedInDiscord(embedState, result.documents, log);
    }

    log(`Discord role ${action}: ${success} success, ${failed} failed, DM: ${dmSuccess} sent, ${dmFailed} failed`);
    return res.json({ success: true, action, assigned: success, failed, dmSent: dmSuccess, dmFailed, details });
  } catch (e) {
    error("Discord role management failed:", e.message);
    return res.json({ success: false, error: "Failed to manage Discord roles." }, 500);
  }
};
