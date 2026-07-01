const { Client, Databases, Query } = require("node-appwrite");

const ENDPOINT    = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID  = process.env.APPWRITE_PROJECT_ID;
const API_KEY     = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const APPLICATIONS_COLLECTION_ID = process.env.APPWRITE_APPLICATIONS_COLLECTION_ID;
const CLAIMS_COLLECTION_ID       = process.env.APPWRITE_CLAIMS_COLLECTION_ID;

const CLAIM_TIMEOUT_MINUTES = 30;
const PENDING_2ND_STALE_HOURS = 48;

function getServerClient() {
  const client = new Client();
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return client;
}

module.exports = async function (context) {
  const { log, error } = context;

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    const threshold = new Date(Date.now() - CLAIM_TIMEOUT_MINUTES * 60 * 1000).toISOString();

    const staleClaims = await databases.listDocuments(
      DATABASE_ID,
      CLAIMS_COLLECTION_ID,
      [Query.lessThan("claimedAt", threshold)]
    );

    if (staleClaims.total > 0) {
      log(`Found ${staleClaims.total} stale claims to clean up (threshold: ${CLAIM_TIMEOUT_MINUTES} min).`);

      for (const claim of staleClaims.documents) {
        const appId = claim.$id;
        const restoreStatus = claim.originalStatus || "pending";

        try {
          const app = await databases.getDocument(
            DATABASE_ID,
            APPLICATIONS_COLLECTION_ID,
            appId
          );

          if (app.status === "in_review") {
            await databases.updateDocument(
              DATABASE_ID,
              APPLICATIONS_COLLECTION_ID,
              appId,
              { status: restoreStatus, reviewedBy: null, reviewStartedAt: null }
            );
            log(`Released app ${appId} back to "${restoreStatus}" (was claimed for >${CLAIM_TIMEOUT_MINUTES} min).`);
          } else {
            log(`App ${appId} status is "${app.status}" — skipping reset (claim will be deleted).`);
          }
        } catch (e) {
          log(`App ${appId} not found or error: ${e.message}`);
        }

        try {
          await databases.deleteDocument(DATABASE_ID, CLAIMS_COLLECTION_ID, appId);
          log(`Deleted claim ${appId}.`);
        } catch (e) {
          error(`Failed to delete claim ${appId}: ${e.message}`);
        }
      }
    } else {
      log("No stale claims to clean up.");
    }

    // Check for stranded pending_2nd applications
    const pending2ndThreshold = new Date(Date.now() - PENDING_2ND_STALE_HOURS * 60 * 60 * 1000).toISOString();

    const strandedApps = await databases.listDocuments(
      DATABASE_ID,
      APPLICATIONS_COLLECTION_ID,
      [
        Query.equal("status", "pending_2nd"),
        Query.lessThan("reviewedAt", pending2ndThreshold),
      ]
    );

    if (strandedApps.total > 0) {
      log(`WARNING: ${strandedApps.total} applications have been stuck in "pending_2nd" for over ${PENDING_2ND_STALE_HOURS} hours. They have one review but never received a second. Consider manually reviewing or disabling double review.`);
      for (const app of strandedApps.documents) {
        log(`  Stranded: ${app.$id} (${app.minecraftIGN || "unknown"}) — reviewedAt: ${app.reviewedAt}`);
      }
    }
  } catch (e) {
    error("Cleanup failed:", e.message);
  }
};
