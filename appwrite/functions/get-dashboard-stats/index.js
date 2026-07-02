const { Client, Databases, Users, Query } = require("node-appwrite");

const ENDPOINT    = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID  = process.env.APPWRITE_PROJECT_ID;
const API_KEY     = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const APPLICATIONS_COLLECTION_ID = process.env.APPWRITE_APPLICATIONS_COLLECTION_ID;
const REVIEWS_COLLECTION_ID      = process.env.APPWRITE_MODERATOR_REVIEWS_COLLECTION_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID  = process.env.DISCORD_GUILD_ID;
const DISCORD_STAFF_ROLE_ID = process.env.DISCORD_STAFF_ROLE_ID;

function getServerClient() {
  const client = new Client();
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return client;
}

async function verifyStaffRole(userId) {
  try {
    const client = getServerClient();
    const users = new Users(client);
    const { identities: identityList } = await users.listIdentities([
      Query.equal("userId", userId)
    ]);

    const discordIdentity = identityList.find(
      (id) => id.provider === "discord"
    );

    if (!discordIdentity) return { isStaff: false };

    const discordId = discordIdentity.providerUid;
    if (!discordId) return { isStaff: false };

    const res = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}`,
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) return { isStaff: false };

    const member = await res.json();
    const hasStaffRole = member.roles?.includes(DISCORD_STAFF_ROLE_ID) || false;

    return {
      isStaff: hasStaffRole,
      discordId,
      discordUsername: member.nick || member.user?.username || "",
    };
  } catch {
    return { isStaff: false };
  }
}

async function getAllApplications(databases) {
  const allApps = [];
  let offset = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const result = await databases.listDocuments(
      DATABASE_ID,
      APPLICATIONS_COLLECTION_ID,
      [Query.limit(limit), Query.offset(offset), Query.orderAsc("createdAt")]
    );
    allApps.push(...result.documents);
    hasMore = result.documents.length === limit;
    offset += result.documents.length;
  }

  return allApps;
}

async function getAllReviews(databases) {
  const allReviews = [];
  let offset = 0;
  const limit = 5000;
  let hasMore = true;

  while (hasMore) {
    const result = await databases.listDocuments(
      DATABASE_ID,
      REVIEWS_COLLECTION_ID,
      [Query.limit(limit), Query.offset(offset)]
    );
    allReviews.push(...result.documents);
    hasMore = result.documents.length === limit;
    offset += result.documents.length;
  }

  return allReviews;
}

function computeStatusDistribution(applications) {
  const distribution = {
    pending: 0,
    pending_2nd: 0,
    in_review: 0,
    reviewed: 0,
    closed: 0,
  };

  for (const app of applications) {
    const status = app.status;
    if (distribution.hasOwnProperty(status)) {
      distribution[status]++;
    }
  }

  return distribution;
}

function computeApplicationsOverTime(applications) {
  const byDay = {};

  for (const app of applications) {
    if (!app.createdAt) continue;
    const date = app.createdAt.split("T")[0];
    byDay[date] = (byDay[date] || 0) + 1;
  }

  const sorted = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return sorted;
}

function computeRatingDistribution(reviews) {
  const buckets = new Array(10).fill(0);

  for (const review of reviews) {
    const rating = review.rating || 0;
    if (rating < 0) continue;
    const bucketIndex = Math.min(Math.floor(rating / 10), 9);
    if (rating === 100) {
      buckets[9]++;
    } else {
      buckets[bucketIndex]++;
    }
  }

  return buckets.map((count, i) => {
    const start = i * 10;
    const end = i === 9 ? 100 : start + 9;
    return { bucket: `${start}-${end}`, count };
  }).filter(b => b.count > 0);
}

function computeReviewsPerModerator(reviews) {
  const byModerator = {};

  for (const review of reviews) {
    const username = review.moderatorDiscordUsername || "Unknown";
    if (!byModerator[username]) {
      byModerator[username] = { total: 0, sum: 0 };
    }
    byModerator[username].total++;
    byModerator[username].sum += review.rating || 0;
  }

  return Object.entries(byModerator)
    .map(([username, data]) => ({
      username,
      count: data.total,
      averageRating: Math.round(data.sum / data.total),
    }))
    .sort((a, b) => b.count - a.count);
}

function computeTimezoneDistribution(applications) {
  const byTimezone = {};

  for (const app of applications) {
    const tz = app.timezone || "Unknown";
    byTimezone[tz] = (byTimezone[tz] || 0) + 1;
  }

  return Object.entries(byTimezone)
    .map(([timezone, count]) => ({ timezone, count }))
    .sort((a, b) => b.count - a.count);
}

function computeRatingZoneDistribution(reviews) {
  const distribution = {
    green: 0,
    yellow: 0,
    orange: 0,
    red: 0,
  };

  for (const review of reviews) {
    const zone = review.ratingZone;
    if (distribution.hasOwnProperty(zone)) {
      distribution[zone]++;
    }
  }

  return Object.entries(distribution).map(([zone, count]) => ({ zone, count }));
}

function computeReviewsOverTime(reviews) {
  const byDay = {};

  for (const review of reviews) {
    if (!review.reviewedAt) continue;
    const date = review.reviewedAt.split("T")[0];
    byDay[date] = (byDay[date] || 0) + 1;
  }

  const sorted = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return sorted;
}

module.exports = async function (context) {
  const { req, res, log, error } = context;

  const userId = req.headers?.["x-appwrite-user-id"];

  if (!userId) {
    return res.json({ error: "Unauthorized." }, 401);
  }

  const staffCheck = await verifyStaffRole(userId);
  if (!staffCheck.isStaff) {
    log("Staff access denied for dashboard stats:", userId);
    return res.json({ error: "Insufficient permissions." }, 403);
  }

  try {
    const client = getServerClient();
    const databases = new Databases(client);

    const [applications, reviews] = await Promise.all([
      getAllApplications(databases),
      getAllReviews(databases),
    ]);

    const statusDistribution = computeStatusDistribution(applications);

    const total = applications.length;
    const open = statusDistribution.pending + statusDistribution.pending_2nd;
    const reviewedCount = statusDistribution.reviewed;
    const totalReviews = reviews.length;

    const reviewers = new Set();
    for (const review of reviews) {
      if (review.moderatorUserId) reviewers.add(review.moderatorUserId);
    }

    const sumRatings = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
    const averageRating = totalReviews > 0 ? Math.round(sumRatings / totalReviews) : 0;

    const ratedApps = new Map();
    for (const review of reviews) {
      if (!ratedApps.has(review.applicationId)) {
        ratedApps.set(review.applicationId, []);
      }
      ratedApps.get(review.applicationId).push(review.rating || 0);
    }

    let acceptedCount = 0;
    for (const [appId, ratings] of ratedApps) {
      const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
      if (avg >= 51) acceptedCount++;
    }

    const acceptanceRate = ratedApps.size > 0
      ? Math.round((acceptedCount / ratedApps.size) * 100)
      : 0;

    return res.json({
      overview: {
        totalApplications: total,
        openApplications: open,
        inReview: statusDistribution.in_review,
        reviewedApplications: reviewedCount,
        closedApplications: statusDistribution.closed,
        averageRating,
        totalReviews,
        uniqueModerators: reviewers.size,
        acceptanceRate,
      },
      statusDistribution,
      applicationsOverTime: computeApplicationsOverTime(applications),
      ratingDistribution: computeRatingDistribution(reviews),
      reviewsPerModerator: computeReviewsPerModerator(reviews),
      timezoneDistribution: computeTimezoneDistribution(applications),
      ratingZoneDistribution: computeRatingZoneDistribution(reviews),
      reviewsOverTime: computeReviewsOverTime(reviews),
    });
  } catch (e) {
    error("Failed to fetch dashboard stats:", e.message);
    return res.json({ error: "Failed to load dashboard stats." }, 500);
  }
};
