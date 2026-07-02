const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT                      = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID                    = process.env.APPWRITE_PROJECT_ID;
const API_KEY                       = process.env.APPWRITE_API_KEY;
const DATABASE_ID                   = process.env.APPWRITE_DATABASE_ID;
const APPLICATIONS_COLLECTION_ID    = process.env.APPWRITE_APPLICATIONS_COLLECTION_ID;
const ACCEPTED_EVENT_COLLECTION_ID  = process.env.APPWRITE_ACCEPTED_EVENT_COLLECTION_ID;
const ROLE_EMBED_STATE_COLLECTION_ID = process.env.APPWRITE_ROLE_EMBED_STATE_COLLECTION_ID;
const DISCORD_BOT_TOKEN             = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID              = process.env.DISCORD_GUILD_ID;
const ADMIN_ROLE_ID                 = process.env.ADMIN_ROLE_ID;

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

async function getDiscordIdForUser(users, userId) {
  try {
    const { identities: identityList } = await users.listIdentities([
      Query.equal("userId", userId)
    ]);
    const discordIdentity = identityList.find((id) => id.provider === "discord");
    return discordIdentity?.providerUid || null;
  } catch {
    return null;
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
      description: `You have been accepted to the OutCraft Underground event!\n\nYour application has been reviewed and you are now on the accepted list. Welcome to Underground!`,
      color: 0x22c55e,
      fields: [
        {
          name: "Minecraft IGN",
          value: minecraftIGN || "N/A",
          inline: true,
        },
      ],
      footer: {
        text: "OutCraft Applications",
      },
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

async function getAcceptedUsers(databases) {
  try {
    const result = await databases.listDocuments(
      DATABASE_ID,
      ACCEPTED_EVENT_COLLECTION_ID,
      [Query.limit(10000), Query.orderAsc("minecraftIGN")]
    );
    return result.documents;
  } catch {
    return [];
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
      return { channelId: doc.channelId, messageId: doc.messageId, documentId: doc.$id };
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

async function addAcceptedLabel(users, databases, userId, adminUsername, log) {
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
    return { alreadyAccepted: true, discordUsername: existing.documents[0].discordUsername };
  }

  const apps = await databases.listDocuments(
    DATABASE_ID,
    APPLICATIONS_COLLECTION_ID,
    [Query.equal("userID", userId), Query.limit(1)]
  );

  const app = apps.documents[0] || {};

  await databases.createDocument(
    DATABASE_ID,
    ACCEPTED_EVENT_COLLECTION_ID,
    "unique()",
    {
      userId,
      discordUsername: app.discordUsername || userDoc.name || "",
      discordId: app.discordId || "",
      minecraftIGN: app.minecraftIGN || "",
      rating: app.rating || 0,
      assignedAt: new Date().toISOString(),
      assignedBy: adminUsername || "manual",
      dmSent: false,
    }
  );

  return {
    alreadyAccepted: false,
    discordId: app.discordId || "",
    minecraftIGN: app.minecraftIGN || "",
    discordUsername: app.discordUsername || "",
  };
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

  const { action, targetUserId, channelId } = body;

  const adminCheck = await verifyAdmin(userId);
  if (!adminCheck.isAdmin) {
    log("Admin access denied:", userId);
    return res.json({ success: false, error: "Insufficient permissions." }, 403);
  }

  const adminUsername = adminCheck.discordUsername;

  try {
    const client = getServerClient();
    const databases = new Databases(client);
    const userSvc = new Users(client);

    switch (action) {
      case "accept": {
        if (!targetUserId || typeof targetUserId !== "string") {
          return res.json({ success: false, error: "Missing targetUserId." }, 400);
        }

        const result = await addAcceptedLabel(userSvc, databases, targetUserId, adminUsername, log);

        if (result.alreadyAccepted) {
          return res.json({
            success: true,
            alreadyAccepted: true,
            user: { username: result.discordUsername },
          });
        }

        let dmResult = { success: false, error: "No Discord ID" };
        const discordId = result.discordId || await getDiscordIdForUser(userSvc, targetUserId);
        if (discordId) {
          dmResult = await sendDM(discordId, result.minecraftIGN);
          log(`DM sent to ${result.discordUsername}: ${dmResult.success ? "ok" : dmResult.error}`);
        }

        if (dmResult.success) {
          try {
            const acceptedDocs = await databases.listDocuments(
              DATABASE_ID,
              ACCEPTED_EVENT_COLLECTION_ID,
              [Query.equal("userId", targetUserId), Query.limit(1)]
            );
            for (const doc of acceptedDocs.documents) {
              await databases.updateDocument(DATABASE_ID, ACCEPTED_EVENT_COLLECTION_ID, doc.$id, { dmSent: true });
            }
          } catch (e) {
            log(`Failed to update dmSent: ${e.message}`);
          }
        }

        const embedState = await getEmbedState(databases);
        await updateEmbedInDiscord(embedState, await getAcceptedUsers(databases), log);

        return res.json({
          success: true,
          alreadyAccepted: false,
          dmSent: dmResult.success,
          dmError: dmResult.error || null,
          user: {
            username: result.discordUsername,
            minecraftIGN: result.minecraftIGN,
          },
        });
      }

      case "create-embed": {
        if (!channelId || typeof channelId !== "string") {
          return res.json({ success: false, error: "Missing channelId." }, 400);
        }
        if (!ROLE_EMBED_STATE_COLLECTION_ID) {
          return res.json({ success: false, error: "ROLE_EMBED_STATE_COLLECTION_ID not configured." }, 500);
        }

        const existingState = await getEmbedState(databases);
        if (existingState) {
          return res.json({
            success: false,
            error: "Embed already exists. Delete it first before creating a new one.",
            state: existingState,
          });
        }

        const acceptedUsers = await getAcceptedUsers(databases);

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

        const msgBody = {
          content: `Accepted players list (${acceptedUsers.length} total)`,
          embeds: [embed],
          allowed_mentions: { parse: [] },
        };

        const discordRes = await fetch(
          `https://discord.com/api/v10/channels/${channelId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(msgBody),
          }
        );

        if (!discordRes.ok) {
          const resText = await discordRes.text();
          return res.json({ success: false, error: `Discord API ${discordRes.status}: ${resText}` });
        }

        const msg = await discordRes.json();

        await databases.createDocument(
          DATABASE_ID,
          ROLE_EMBED_STATE_COLLECTION_ID,
          "unique()",
          {
            channelId,
            messageId: msg.id,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            createdBy: adminUsername,
          }
        );

        log(`Embed created in channel ${channelId}, message ${msg.id}`);
        return res.json({
          success: true,
          channelId,
          messageId: msg.id,
        });
      }

      case "delete-embed": {
        const embedState = await getEmbedState(databases);
        if (!embedState) {
          return res.json({ success: false, error: "No embed to delete." });
        }

        try {
          await fetch(
            `https://discord.com/api/v10/channels/${embedState.channelId}/messages/${embedState.messageId}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
              },
            }
          );
        } catch (e) {
          log(`Failed to delete Discord message: ${e.message}`);
        }

        try {
          await databases.deleteDocument(
            DATABASE_ID,
            ROLE_EMBED_STATE_COLLECTION_ID,
            embedState.documentId
          );
        } catch (e) {
          log(`Failed to delete embed state document: ${e.message}`);
        }

        log("Embed deleted");
        return res.json({ success: true });
      }

      case "get-embed-status": {
        const embedState = await getEmbedState(databases);
        return res.json({
          success: true,
          exists: !!embedState,
          channelId: embedState?.channelId || null,
          messageId: embedState?.messageId || null,
        });
      }

      default:
        return res.json({ success: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    error("Manage manual roles failed:", e.message);
    return res.json({ success: false, error: "Operation failed." }, 500);
  }
};
