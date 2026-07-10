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
const DISCORD_EVENT_ROLE_ID         = process.env.DISCORD_Underground_Event_Participant_ROLE_ID;

function getServerClient() {
  const client = new Client();
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return client;
}

async function discordRequest(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (fetchErr) {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw fetchErr;
    }

    if (res.status !== 429) return res;

    let retryAfter = 1500;
    const headerVal = res.headers.get("Retry-After");
    if (headerVal) {
      const seconds = parseFloat(headerVal);
      if (!isNaN(seconds) && seconds > 0) {
        retryAfter = Math.ceil(seconds * 1000) + 200;
      }
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, retryAfter));
    } else {
      return res;
    }
  }
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
    const dmRes = await discordRequest("https://discord.com/api/v10/users/@me/channels", {
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

    const msgRes = await discordRequest(
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
    const seen = new Map();
    for (const doc of result.documents) {
      const existing = seen.get(doc.userId);
      if (!existing || doc.$createdAt >= existing.$createdAt) {
        seen.set(doc.userId, doc);
      }
    }
    return Array.from(seen.values());
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
      const messageIds = doc.messageId ? doc.messageId.split("|") : [];
      return { channelId: doc.channelId, messageIds, documentId: doc.$id };
    }
    return null;
  } catch {
    return null;
  }
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function deleteMessagesInChannel(channelId, messageIds, log) {
  for (const mid of messageIds) {
    try {
      await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages/${mid}`,
        { method: "DELETE", headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } }
      );
    } catch (e) {
      log(`Failed to delete old message ${mid}: ${e.message}`);
    }
  }
}

async function postAcceptedListMessages(channelId, acceptedUsers, databases, embedStateDocId, allowPings, log) {
  const seen = new Set();
  const lines = acceptedUsers
    .filter((u) => {
      if (seen.has(u.userId)) return false;
      seen.add(u.userId);
      return true;
    })
    .map((u, i) => {
      const name = u.discordUsername || u.minecraftIGN || "Unknown";
      return `${i + 1}. ${name}`;
    });

  if (lines.length === 0) {
    if (embedStateDocId) {
      try {
        await databases.updateDocument(DATABASE_ID, ROLE_EMBED_STATE_COLLECTION_ID, embedStateDocId, {
          messageId: "",
          lastUpdated: new Date().toISOString(),
        });
      } catch {}
    }
    return [];
  }

  const USERS_PER_PAGE = 50;
  const chunks = chunkArray(lines, USERS_PER_PAGE);
  const newMessageIds = [];

  for (let i = 0; i < chunks.length; i++) {
    const header = `**Accepted Players**\n`;
    const content = header + chunks[i].join("\n");

    try {
      const res = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: content.length > 2000 ? content.substring(0, 1997) + "..." : content,
            allowed_mentions: { parse: allowPings ? ["users"] : [] },
          }),
        }
      );

      if (res.ok) {
        const msg = await res.json();
        newMessageIds.push(msg.id);
      } else {
        log(`Failed to post accepted list page ${i + 1}: ${res.status}`);
      }

      if (i < chunks.length - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (e) {
      log(`Error posting accepted list page ${i + 1}: ${e.message}`);
    }
  }

  if (embedStateDocId) {
    try {
      await databases.updateDocument(DATABASE_ID, ROLE_EMBED_STATE_COLLECTION_ID, embedStateDocId, {
        messageId: newMessageIds.slice(0, 3).join("|"),
        lastUpdated: new Date().toISOString(),
      });
    } catch (e) {
      log(`Failed to update message IDs: ${e.message}`);
    }
  }

  return newMessageIds;
}

async function appendToList(channelId, messageIds, username, acceptedCount, databases, embedStateDocId, log) {
  const lastId = messageIds[messageIds.length - 1];
  if (!lastId) return messageIds;

  const newLine = `${acceptedCount}. ${username}`;

  try {
    const fetchRes = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages/${lastId}`,
      { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } }
    );

    if (fetchRes.ok) {
      const msg = await fetchRes.json();
      const currentContent = msg.content || "";
      const updatedContent = currentContent + "\n" + newLine;

      if (updatedContent.length <= 1950) {
        const patchRes = await fetch(
          `https://discord.com/api/v10/channels/${channelId}/messages/${lastId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: updatedContent,
              allowed_mentions: { parse: [] },
            }),
          }
        );
        if (patchRes.ok) {
          log(`Edited message ${lastId} to append user #${acceptedCount}`);
          return messageIds;
        }
      }
    }
  } catch (e) {
    log(`Could not edit last message, posting new one: ${e.message}`);
  }

  try {
    const postRes = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: `**Accepted Players**\n${newLine}`,
          allowed_mentions: { parse: [] },
        }),
      }
    );
    if (postRes.ok) {
      const newMsg = await postRes.json();
      const updatedIds = [...messageIds, newMsg.id];
      if (embedStateDocId) {
        try {
          await databases.updateDocument(DATABASE_ID, ROLE_EMBED_STATE_COLLECTION_ID, embedStateDocId, {
            messageId: updatedIds.slice(0, 3).join("|"),
            lastUpdated: new Date().toISOString(),
          });
        } catch {}
      }
      log(`Posted new list page for user #${acceptedCount}`);
      return updatedIds;
    } else {
      log(`Failed to post new list message: ${postRes.status}`);
    }
  } catch (e) {
    log(`Error posting new list message: ${e.message}`);
  }

  return messageIds;
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
    rating: app.rating || 0,
  };
}

module.exports = async function (context) {
  const { req, res, log, error } = context;

  const userId = req.headers?.["x-appwrite-user-id"];
  if (!userId) {
    let body;
    try {
      body = JSON.parse(req.body || "{}");
    } catch {
      return res.json({ success: false, error: "Invalid JSON payload." }, 400);
    }
    if (body.action === "migrate" || body.action === "refresh-list") {
      const client = getServerClient();
      const databases = new Databases(client);

      if (body.action === "refresh-list") {
        try {
          const embedState = await getEmbedState(databases);
          if (!embedState || !embedState.channelId) {
            return res.json({ success: false, error: "No accepted list configured." });
          }
          await deleteMessagesInChannel(embedState.channelId, embedState.messageIds, log);
          const acceptedUsers = await getAcceptedUsers(databases);
          await postAcceptedListMessages(embedState.channelId, acceptedUsers, databases, embedState.documentId, false, log);
          log(`Accepted list refreshed (API key), ${acceptedUsers.length} users`);
          return res.json({ success: true, userCount: acceptedUsers.length });
        } catch (e) {
          try { error("Refresh failed:", String(e?.message || e)); } catch (_) {}
          return res.json({ success: false, error: "Refresh failed.", detail: String(e?.message || e) }, 500);
        }
      }

      try {
        let allDocs = [];
        let offset = 0;
        const pageSize = 1000;
        while (true) {
          const page = await databases.listDocuments(
            DATABASE_ID,
            ACCEPTED_EVENT_COLLECTION_ID,
            [Query.limit(pageSize), Query.offset(offset), Query.orderAsc("$id")]
          );
          allDocs = allDocs.concat(page.documents);
          if (page.documents.length < pageSize) break;
          offset += pageSize;
        }
        const seen = new Map();
        const duplicates = [];
        let backfilled = 0;
        for (const doc of allDocs) {
          const existing = seen.get(doc.userId);
          if (existing) {
            duplicates.push(doc);
          } else {
            seen.set(doc.userId, doc);
          }
        }
        for (const dup of duplicates) {
          try {
            await databases.deleteDocument(DATABASE_ID, ACCEPTED_EVENT_COLLECTION_ID, dup.$id);
          } catch (e) {
            log(`Failed to delete duplicate ${dup.$id}: ${e.message}`);
          }
        }
        for (const doc of seen.values()) {
          if (doc.dmSent === undefined || doc.dmSent === null) {
            try {
              await databases.updateDocument(DATABASE_ID, ACCEPTED_EVENT_COLLECTION_ID, doc.$id, { dmSent: false });
              backfilled++;
            } catch (e) {
              log(`Failed to backfill dmSent for ${doc.$id}: ${e.message}`);
            }
          }
        }
        log(`Migration (API key): removed ${duplicates.length} duplicates, backfilled dmSent for ${backfilled} docs`);
        return res.json({
          success: true,
          duplicatesRemoved: duplicates.length,
          dmSentBackfilled: backfilled,
          totalUnique: seen.size,
        });
      } catch (e) {
        try { error("Migration failed:", String(e?.message || e)); } catch (_) {}
        return res.json({ success: false, error: "Migration failed.", detail: String(e?.message || e) }, 500);
      }
    }
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

        if (!DISCORD_EVENT_ROLE_ID) {
          log("DISCORD_Underground_Event_Participant_ROLE_ID is not configured. Skipping Discord role assignment.");
        }

        const result = await addAcceptedLabel(userSvc, databases, targetUserId, adminUsername, log);

        let dmResult = { success: false, error: "No Discord ID" };
        let roleApplied = false;
        let roleError = null;

        const discordId =
          result.discordId ||
          await getDiscordIdForUser(userSvc, targetUserId);

        if (DISCORD_EVENT_ROLE_ID && discordId) {
          try {
            const roleRes = await discordRequest(
              `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}/roles/${DISCORD_EVENT_ROLE_ID}`,
              {
                method: "PUT",
                headers: {
                  Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
                  "Content-Type": "application/json",
                },
              }
            );
            if (roleRes.ok) {
              roleApplied = true;
              log(`Role assigned to ${result.discordUsername}`);
            } else {
              const errText = await roleRes.text();
              roleError = `Discord API ${roleRes.status}: ${errText}`;
              log(`Failed to assign role to ${result.discordUsername}: ${roleError}`);
            }
          } catch (e) {
            roleError = e.message;
            log(`Error assigning role to ${result.discordUsername}: ${e.message}`);
          }
        } else if (!discordId) {
          roleError = "No Discord ID found for user";
          log(`Could not resolve Discord ID for ${result.discordUsername || targetUserId}`);
        }

        if (discordId && !result.alreadyAccepted) {
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
        if (embedState && embedState.channelId && embedState.messageIds.length > 0 && discordId) {
          const acceptedUsers = await getAcceptedUsers(databases);
          const username = result.discordUsername || result.minecraftIGN || "Unknown";
          const count = acceptedUsers.length;
          await appendToList(
            embedState.channelId,
            embedState.messageIds,
            username,
            count,
            databases,
            embedState.documentId,
            log
          );
        }

        return res.json({
          success: true,
          alreadyAccepted: result.alreadyAccepted,
          roleApplied,
          roleError,
          dmSent: dmResult.success,
          dmError: dmResult.error || null,
          user: {
            username: result.discordUsername,
            minecraftIGN: result.minecraftIGN,
          },
        });
      }

      case "refresh-list": {
        const embedState = await getEmbedState(databases);
        if (!embedState || !embedState.channelId) {
          return res.json({ success: false, error: "No accepted list configured." });
        }

        await deleteMessagesInChannel(embedState.channelId, embedState.messageIds, log);
        const acceptedUsers = await getAcceptedUsers(databases);
        await postAcceptedListMessages(embedState.channelId, acceptedUsers, databases, embedState.documentId, false, log);

        log(`Accepted list refreshed, ${acceptedUsers.length} users`);
        return res.json({ success: true, userCount: acceptedUsers.length });
      }

      case "create-embed": {
        if (!channelId || typeof channelId !== "string") {
          return res.json({ success: false, error: "Missing channelId." }, 400);
        }
        if (!ROLE_EMBED_STATE_COLLECTION_ID) {
          return res.json({ success: false, error: "ROLE_EMBED_STATE_COLLECTION_ID not configured." }, 500);
        }

        const existingState = await getEmbedState(databases);
        if (existingState && existingState.messageIds && existingState.messageIds.length > 0) {
          return res.json({
            success: false,
            error: "Accepted list already exists. Delete it first before creating a new one.",
            state: { channelId: existingState.channelId, messageIds: existingState.messageIds },
          });
        }

        const acceptedUsers = await getAcceptedUsers(databases);

        let stateDocId = existingState?.documentId;
        if (!stateDocId) {
          const stateDoc = await databases.createDocument(
            DATABASE_ID,
            ROLE_EMBED_STATE_COLLECTION_ID,
            "unique()",
            {
              channelId,
              messageId: "",
              createdAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
              createdBy: adminUsername,
            }
          );
          stateDocId = stateDoc.$id;
        }

        const messageIds = await postAcceptedListMessages(channelId, acceptedUsers, databases, stateDocId, true, log);

        log(`Accepted list created in channel ${channelId}, ${messageIds.length} messages`);
        return res.json({
          success: true,
          channelId,
          messageIds,
        });
      }

      case "delete-embed": {
        const embedState = await getEmbedState(databases);
        if (!embedState || !embedState.messageIds || embedState.messageIds.length === 0) {
          return res.json({ success: false, error: "No accepted list to delete." });
        }

        await deleteMessagesInChannel(embedState.channelId, embedState.messageIds, log);

        try {
          await databases.deleteDocument(
            DATABASE_ID,
            ROLE_EMBED_STATE_COLLECTION_ID,
            embedState.documentId
          );
        } catch (e) {
          log(`Failed to delete embed state document: ${e.message}`);
        }

        log("Accepted list deleted");
        return res.json({ success: true });
      }

      case "get-embed-status": {
        const embedState = await getEmbedState(databases);
        return res.json({
          success: true,
          exists: !!(embedState && embedState.channelId),
          channelId: embedState?.channelId || null,
          messageIds: embedState?.messageIds || [],
        });
      }

      case "migrate": {
        let allDocs = [];
        let offset = 0;
        const pageSize = 1000;
        while (true) {
          const page = await databases.listDocuments(
            DATABASE_ID,
            ACCEPTED_EVENT_COLLECTION_ID,
            [Query.limit(pageSize), Query.offset(offset), Query.orderAsc("$id")]
          );
          allDocs = allDocs.concat(page.documents);
          if (page.documents.length < pageSize) break;
          offset += pageSize;
        }

        const seen = new Map();
        const duplicates = [];
        let backfilled = 0;

        for (const doc of allDocs) {
          const existing = seen.get(doc.userId);
          if (existing) {
            duplicates.push(doc);
          } else {
            seen.set(doc.userId, doc);
          }
        }

        for (const dup of duplicates) {
          try {
            await databases.deleteDocument(DATABASE_ID, ACCEPTED_EVENT_COLLECTION_ID, dup.$id);
          } catch (e) {
            log(`Failed to delete duplicate ${dup.$id}: ${e.message}`);
          }
        }

        for (const doc of seen.values()) {
          if (doc.dmSent === undefined || doc.dmSent === null) {
            try {
              await databases.updateDocument(DATABASE_ID, ACCEPTED_EVENT_COLLECTION_ID, doc.$id, { dmSent: false });
              backfilled++;
            } catch (e) {
              log(`Failed to backfill dmSent for ${doc.$id}: ${e.message}`);
            }
          }
        }

        log(`Migration: removed ${duplicates.length} duplicates, backfilled dmSent for ${backfilled} docs`);
        return res.json({
          success: true,
          duplicatesRemoved: duplicates.length,
          dmSentBackfilled: backfilled,
          totalUnique: seen.size,
        });
      }

      default:
        return res.json({ success: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    try {
      error("Manage manual roles failed:", String(e?.message || e));
    } catch (_) {}
    return res.json({ success: false, error: "Operation failed.", detail: String(e?.message || e) }, 500);
  }
};
