const { Client, Databases, Users, Query, ID } = require("node-appwrite");

const ENDPOINT    = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID  = process.env.APPWRITE_PROJECT_ID;
const API_KEY     = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const APPLICATIONS_COLLECTION_ID = process.env.APPWRITE_APPLICATIONS_COLLECTION_ID;
const REVIEWS_COLLECTION_ID      = process.env.APPWRITE_MODERATOR_REVIEWS_COLLECTION_ID;
const INVITE_LINKS_COLLECTION_ID = process.env.APPWRITE_INVITE_LINKS_COLLECTION_ID;

function getServerClient() {
  const client = new Client();
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return client;
}

function getRatingZone(value) {
  if (value <= 25) return "red";
  if (value <= 50) return "orange";
  if (value <= 75) return "yellow";
  return "green";
}

module.exports = async function (context) {
  const { req, res, log, error } = context;

  const userId = req.headers?.["x-appwrite-user-id"];
  if (!userId) {
    return res.json({ success: false, error: "Unauthorized. Please log in first." }, 401);
  }

  let body;
  try {
    body = JSON.parse(req.body || "{}");
  } catch {
    return res.json({ success: false, error: "Invalid JSON payload." }, 400);
  }

  const { code, minecraftIGN } = body;

  if (!code || typeof code !== "string") {
    return res.json({ success: false, error: "Missing invite code." }, 400);
  }

  if (!minecraftIGN || typeof minecraftIGN !== "string") {
    return res.json({ success: false, error: "Missing Minecraft username." }, 400);
  }

  const ign = minecraftIGN.trim();
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(ign)) {
    return res.json({ success: false, error: "Invalid Minecraft username format." }, 400);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    // 1. Find the invite link by code
    let inviteDoc;
    try {
      const result = await databases.listDocuments(
        DATABASE_ID,
        INVITE_LINKS_COLLECTION_ID,
        [Query.equal("code", code), Query.limit(1)]
      );
      if (result.total === 0) {
        return res.json({ success: false, error: "Invalid or expired invite link." }, 404);
      }
      inviteDoc = result.documents[0];
    } catch (e) {
      log("Failed to find invite link:", e.message);
      return res.json({ success: false, error: "Invalid or expired invite link." }, 404);
    }

    if (inviteDoc.used) {
      return res.json({ success: false, error: "This invite link has already been used." }, 409);
    }

    // 2. Check for duplicate user
    try {
      const existingByUser = await databases.listDocuments(
        DATABASE_ID,
        APPLICATIONS_COLLECTION_ID,
        [Query.equal("userID", userId)]
      );
      if (existingByUser.total > 0) {
        return res.json({ success: false, error: "You have already submitted an application." }, 409);
      }
    } catch (e) {
      log("User duplicate check error:", e.message);
    }

    // 3. Check for duplicate Minecraft IGN
    try {
      const existingByIGN = await databases.listDocuments(
        DATABASE_ID,
        APPLICATIONS_COLLECTION_ID,
        [Query.equal("minecraftIGN", ign)]
      );
      if (existingByIGN.total > 0) {
        return res.json({ success: false, error: "This Minecraft username has already been used in an application." }, 409);
      }
    } catch (e) {
      log("IGN duplicate check error:", e.message);
    }

    // 4. Fetch the redeeming user's Discord info
    let discordUsername = "";
    let discordEmail = "";
    let discordId = "";

    try {
      const users = new Users(client);
      const user = await users.get(userId);
      discordUsername = user.name || "";
      discordEmail = user.email || "";

      const { identities: identityList } = await users.listIdentities([
        Query.equal("userId", userId)
      ]);
      const discordIdentity = identityList.find(
        (id) => id.provider === "discord"
      );
      if (discordIdentity) {
        discordId = discordIdentity.providerUid || "";
      }
    } catch (e) {
      log("Could not fetch user info:", e.message);
      return res.json({ success: false, error: "Failed to verify your account." }, 401);
    }

    const now = new Date().toISOString();
    const rating = 100;
    const ratingZone = getRatingZone(rating);

    // 5. Create application document (auto-reviewed, closed)
    const appDoc = await databases.createDocument(
      DATABASE_ID,
      APPLICATIONS_COLLECTION_ID,
      "unique()",
      {
        userID: userId,
        discordUsername,
        discordEmail,
        discordId,
        minecraftIGN: ign,
        timezone: "UTC",
        yesNoAnswers: JSON.stringify({}),
        textAnswers: JSON.stringify({}),
        dropdownAnswers: JSON.stringify({}),
        status: "closed",
        rating,
        ratingZone,
        reviewedBy: inviteDoc.createdBy,
        reviewStartedAt: now,
        reviewedAt: now,
        createdAt: now,
      }
    );

    // 6. Create review entry
    await databases.createDocument(
      DATABASE_ID,
      REVIEWS_COLLECTION_ID,
      "unique()",
      {
        applicationId: appDoc.$id,
        moderatorUserId: inviteDoc.createdBy,
        moderatorDiscordId: inviteDoc.createdByDiscordId,
        moderatorDiscordUsername: inviteDoc.createdByDiscordUsername,
        rating,
        ratingZone,
        moderatorNote: "Generated through custom invite link",
        reviewedAt: now,
      }
    );

    // 7. Mark invite as used
    await databases.updateDocument(
      DATABASE_ID,
      INVITE_LINKS_COLLECTION_ID,
      inviteDoc.$id,
      {
        used: true,
        usedBy: userId,
        usedAt: now,
      }
    );

    log(`Invite ${code} redeemed by ${discordUsername} (IGN: ${ign}), app: ${appDoc.$id}`);

    return res.json({ success: true, documentId: appDoc.$id });
  } catch (e) {
    error("Failed to redeem invite link:", e.message);
    return res.json({ success: false, error: "Failed to process your application. Please try again." }, 500);
  }
};
