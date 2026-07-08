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

const BATCH_SIZE = 45;
const MICRO_BATCH_SIZE = 5;
const MICRO_BATCH_DELAY_MS = 600;

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

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
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

async function postAcceptedListMessages(channelId, acceptedUsers, log) {
  const lines = acceptedUsers.map((u, i) => {
    const tag = u.discordId ? `<@${u.discordId}>` : `\`${u.discordUsername || "Unknown"}\``;
    return `${i + 1}. ${tag}`;
  });

  if (lines.length === 0) return [];

  const USERS_PER_PAGE = 75;
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
            allowed_mentions: { parse: ["users"] },
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

  return newMessageIds;
}

async function refreshAcceptedList(databases, log) {
  try {
    const embedState = await getEmbedState(databases);
    if (!embedState || !embedState.channelId) return;

    await deleteMessagesInChannel(embedState.channelId, embedState.messageIds, log);

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

    const newMessageIds = await postAcceptedListMessages(embedState.channelId, allDocs, log);

    if (embedState.documentId) {
      try {
        await databases.updateDocument(DATABASE_ID, ROLE_EMBED_STATE_COLLECTION_ID, embedState.documentId, {
          messageId: newMessageIds.slice(0, 3).join("|"),
          lastUpdated: new Date().toISOString(),
        });
      } catch (e) {
        log(`Failed to update message IDs: ${e.message}`);
      }
    }
  } catch (e) {
    log(`Failed to refresh accepted list: ${e.message}`);
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
    log(`Processing ${allDocs.length} accepted users for role ${action}`);

    let success = 0;
    let failed = 0;
    let dmSuccess = 0;
    let dmFailed = 0;
    const method = action === "assign" ? "PUT" : "DELETE";

    async function processDocRole(doc) {
      try {
        let discordId = doc.discordId;
        if (!discordId) {
          try {
            const { identities: identityList } = await users.listIdentities([
              Query.equal("userId", doc.userId)
            ]);
            const discordIdentity = identityList.find((id) => id.provider === "discord");
            discordId = discordIdentity?.providerUid;
          } catch {
            // identity lookup failed, continue without discordId
          }
        }
        if (!discordId) {
          return { doc, status: "failed", error: "No Discord ID found" };
        }

        const discordRes = await discordRequest(
          `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}/roles/${DISCORD_EVENT_ROLE_ID}`,
          {
            method,
            headers: {
              Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!discordRes.ok) {
          const resText = await discordRes.text();
          return { doc, discordId, status: "failed", error: `Discord API ${discordRes.status}: ${resText}` };
        }

        return { doc, discordId, status: "ok" };
      } catch (e) {
        return { doc, status: "failed", error: e.message };
      }
    }

    async function processBatch(batch) {
      const results = await Promise.allSettled(batch.map(processDocRole));
      for (const r of results) {
        if (r.status === "rejected") {
          failed++;
          log(`Batch item rejected: ${r.reason?.message || r.reason}`);
          continue;
        }
        const result = r.value;
        if (result.status === "ok") {
          success++;
          if (action === "assign" && !result.doc.dmSent) {
            try {
              const dmResult = await sendDM(result.discordId, result.doc.minecraftIGN);
              if (dmResult.success) {
                dmSuccess++;
                try {
                  await databases.updateDocument(DATABASE_ID, ACCEPTED_EVENT_COLLECTION_ID, result.doc.$id, { dmSent: true });
                } catch (e) {
                  log(`Failed to update dmSent for ${result.doc.discordUsername}: ${e.message}`);
                }
              } else {
                dmFailed++;
              }
            } catch (e) {
              dmFailed++;
              log(`DM error for ${result.doc.discordUsername}: ${e.message}`);
            }
          }
        } else {
          failed++;
          log(`Role ${action} failed for ${result.doc.discordUsername}: ${result.error}`);
        }
      }
    }

    let isFirstBatch = true;
    for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
      if (!isFirstBatch) {
        await new Promise((r) => setTimeout(r, 2000));
      }
      isFirstBatch = false;
      const batch = allDocs.slice(i, i + BATCH_SIZE);
      try {
        for (let j = 0; j < batch.length; j += MICRO_BATCH_SIZE) {
          const micro = batch.slice(j, j + MICRO_BATCH_SIZE);
          await processBatch(micro);
          if (j + MICRO_BATCH_SIZE < batch.length) {
            await new Promise((r) => setTimeout(r, MICRO_BATCH_DELAY_MS));
          }
        }
      } catch (e) {
        log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} crashed: ${e.message}`);
        failed += batch.length;
      }
      log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${success} success, ${failed} failed so far (${Math.min(i + BATCH_SIZE, allDocs.length)}/${allDocs.length})`);
    }

    log(`Discord role ${action}: ${success} success, ${failed} failed, DM: ${dmSuccess} sent, ${dmFailed} failed`);
    return res.json({ success: true, action, assigned: success, failed, dmSent: dmSuccess, dmFailed });
  } catch (e) {
    try {
      error("Discord role management failed:", String(e?.message || e));
    } catch (_) {}
    return res.json({ success: false, error: "Failed to manage Discord roles.", detail: String(e?.message || e) }, 500);
  }
};
