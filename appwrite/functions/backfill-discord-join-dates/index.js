const { Client, Databases, Query } = require("node-appwrite");

const ENDPOINT          = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID        = process.env.APPWRITE_PROJECT_ID;
const API_KEY           = process.env.APPWRITE_API_KEY;
const DATABASE_ID       = process.env.APPWRITE_DATABASE_ID;
const APPLICATIONS_COLLECTION_ID = process.env.APPWRITE_APPLICATIONS_COLLECTION_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID  = process.env.DISCORD_GUILD_ID;

function getServerClient() {
  const client = new Client();
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return client;
}

module.exports = async function (context) {
  const { res, log, error } = context;

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    let allApplications = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const result = await databases.listDocuments(
        DATABASE_ID,
        APPLICATIONS_COLLECTION_ID,
        [
          Query.limit(limit),
          Query.offset(offset),
        ]
      );
      allApplications = allApplications.concat(result.documents);
      hasMore = result.documents.length === limit;
      offset += result.documents.length;
    }

    const needsBackfill = allApplications.filter(
      (doc) => doc.discordId && !doc.discordJoinDate
    );

    log(`Found ${needsBackfill.length} applications needing backfill out of ${allApplications.length} total`);

    const concurrency = 5;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < needsBackfill.length; i += concurrency) {
      const batch = needsBackfill.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (doc) => {
          try {
            const discordRes = await fetch(
              `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${doc.discordId}`,
              {
                headers: {
                  Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
                  "Content-Type": "application/json",
                },
              }
            );

            let discordJoinDate = null;
            if (discordRes.ok) {
              const member = await discordRes.json();
              if (member.joined_at) {
                discordJoinDate = member.joined_at.substring(0, 19) + "Z";
              }
            }

            await databases.updateDocument(
              DATABASE_ID,
              APPLICATIONS_COLLECTION_ID,
              doc.$id,
              { discordJoinDate }
            );

            return { success: true };
          } catch (e) {
            log(`Failed to backfill ${doc.$id}: ${e.message}`);
            return { success: false };
          }
        })
      );

      for (const r of batchResults) {
        if (r.success) updated++;
        else failed++;
      }

      if (i + concurrency < needsBackfill.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    log(`Backfill complete: ${updated} updated, ${failed} failed`);
    return res.json({ updated, failed, total: needsBackfill.length });
  } catch (e) {
    error("Backfill failed:", e.message);
    return res.json({ error: "Backfill failed." }, 500);
  }
};
