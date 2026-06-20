const { Client, Databases, Query } = require("node-appwrite");

const ENDPOINT    = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID  = process.env.APPWRITE_PROJECT_ID;
const API_KEY     = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const APPLICATIONS_COLLECTION_ID = process.env.APPWRITE_APPLICATIONS_COLLECTION_ID;
const CLAIMS_COLLECTION_ID       = process.env.APPWRITE_CLAIMS_COLLECTION_ID;

const CLAIM_TIMEOUT_MINUTES = 20;

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

    if (staleClaims.total === 0) {
      log("No stale claims to clean up.");
      return;
    }

    log(`Found ${staleClaims.total} stale claims to clean up.`);

    for (const claim of staleClaims.documents) {
      const appId = claim.$id;

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
            { status: "pending", reviewedBy: null, reviewStartedAt: null }
          );
          log(`Released app ${appId} back to pending.`);
        } else {
          log(`App ${appId} status is "${app.status}" — skipping reset.`);
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
  } catch (e) {
    error("Cleanup failed:", e.message);
  }
};
