# Appwrite Deployment Guide

## Environment Variables

### Frontend (.env)

```env
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your-project-id
VITE_APPWRITE_FUNCTION_SUBMIT_ID=submit-application
VITE_APPWRITE_FUNCTION_VERIFY_MOD_ID=verify-moderator-access
VITE_APPWRITE_FUNCTION_STATS_ID=get-moderator-stats
VITE_APPWRITE_FUNCTION_NEXT_APP_ID=get-next-application
VITE_APPWRITE_FUNCTION_RATING_ID=submit-application-rating
```

### Appwrite Functions (set in Appwrite Console)

```env
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-api-key
APPWRITE_DATABASE_ID=your-database-id
APPWRITE_APPLICATIONS_COLLECTION_ID=your-applications-collection-id
APPWRITE_CLAIMS_COLLECTION_ID=your-claims-collection-id
APPWRITE_MODERATOR_REVIEWS_COLLECTION_ID=your-moderator-reviews-collection-id
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_GUILD_ID=your-discord-guild-id
DISCORD_STAFF_ROLE_ID=your-discord-staff-role-id
```

## Database Collections

### Applications Collection

Fields:
- `userID` (string) — Appwrite user ID (note: capital D, matches existing submit-application Function)
- `discordUsername` (string)
- `discordEmail` (string)
- `discordId` (string) — Discord user ID extracted from Appwrite identity at submission time; used for reliable guild role lookup
- `minecraftIGN` (string)
- `timezone` (string)
- `yesNoAnswers` (string) — JSON with format `{ qId: { text: string, yes: boolean } }`
- `textAnswers` (string) — JSON with format `{ qId: { text: string, answer: string } }`
- `dropdownAnswers` (string) — JSON with format `{ qId: { text: string, answer: string } }`
- `status` (string) — `pending` | `in_review` | `reviewed` | `closed`
- `createdAt` (string) — ISO date
- `reviewedBy` (string, optional) — Appwrite user ID of moderator who claimed it
- `reviewStartedAt` (string, optional) — ISO date when the moderator claimed the application (used for lock expiry)
- `reviewedAt` (string, optional) — ISO date when the rating was submitted
- `rating` (number, optional) — 0-100
- `ratingZone` (string, optional) — `red` | `orange` | `yellow` | `green`

### Applications Claim Collection

Used for atomic claiming — `createDocument` with a deterministic ID (the application ID) fails if a claim already exists, preventing double-claims without retry loops.

Fields:
- `moderatorUserId` (string) — Appwrite user ID of the moderator who claimed the application
- `claimedAt` (string) — ISO date when the claim was made

The document ID is the application ID (`$id = applicationId`). When claiming, `createDocument` with this ID will fail with a conflict if another moderator already claimed it.

Expired claims (older than 30 minutes) are cleaned up automatically by `get-next-application`.

### Moderator Reviews Collection

Fields:
- `applicationId` (string)
- `moderatorUserId` (string)
- `moderatorDiscordId` (string)
- `moderatorDiscordUsername` (string)
- `rating` (number) — 0-100
- `ratingZone` (string) — `red` | `orange` | `yellow` | `green`
- `reviewedAt` (string) — ISO date

## Appwrite Functions

Deploy each function from the `appwrite/functions/` directory:

```
appwrite/functions/
├── submit-application/        # Existing — handles player form submissions
├── verify-moderator-access/   # Checks Discord staff role
├── get-moderator-stats/       # Returns dashboard counts
├── get-next-application/      # Fetches/claims next pending application
└── submit-application-rating/ # Saves rating, marks app reviewed
```

Each function requires `node-appwrite` as a dependency. Run `npm install` in each function directory before deploying.

### Function: verify-moderator-access
- Verifies the user has the Discord staff role
- Returns `{ allowed: boolean, userId, discordId, discordUsername }`

### Function: get-moderator-stats
- Requires staff role verification
- Returns `{ openApplications, totalClosed, closedByYou }`

### Function: get-next-application
- Requires staff role verification
- Accepts optional `{ applicationId }` in body
- If `applicationId` provided: returns that specific app (or null if already reviewed/not found)
- If no `applicationId`: claims oldest pending app using atomic claim document (up to 5 attempts)
- Stale claims (>30 min based on `claimedAt`) are automatically cleaned up
- Uses stored `discordId` field for reliable guild role lookup (not username search)
- Returns `{ application: { id, minecraftIGN, skinUrl, discordUsername, discordRoles, discordRolesUnavailable, timezone, createdAt, status, answers: [{question, answer}] } | null }`
- `discordRolesUnavailable: true` when Discord API could not be reached for role lookup

### Function: submit-application-rating
- Requires staff role verification
- Accepts `{ applicationId, rating }` where rating is 0-100
- Verifies the app is `pending` or `in_review` by the current moderator
- Checks that the review lock has not expired (based on `reviewStartedAt`)
- Creates a review document in the Moderator Reviews collection
- Updates application status to `reviewed` with the rating
- Cleans up the claim document from the Claims Collection

### Function: submit-application
- Gets userId from `x-appwrite-user` header (not request body)
- Extracts Discord ID from user identities and stores as `discordId` field
- Enriches answers with question text snapshots at submission time
- Stores answers as `{ qId: { text: string, yes/answer: value } }` format
- This eliminates the need for a hardcoded question map in moderator Functions

## Application Status Flow

```
pending → in_review → reviewed
```

- `pending`: New application, available for any moderator
- `in_review`: Claimed by a moderator, locked for 30 minutes (tracked via `reviewStartedAt`)
- `reviewed`: Rating submitted, no longer available for review

## Migration Notes

### discordId field

Applications submitted before the `discordId` field was added will not have this value stored. For these older applications, the Discord guild role lookup will fail and the UI will show "Could not load roles." This is acceptable for the initial release. To backfill, run a one-time migration that:

1. Queries all applications where `discordId` is missing or empty
2. For each, looks up the user's Discord identity via the Appwrite Users API
3. Updates the application document with the extracted Discord ID

```js
// Example backfill (run once as an Appwrite Function or script)
const user = await users.get(doc.userID);
const discordIdentity = (user.identities || []).find(
  (id) => id.provider === "discord" || id.providerEmail?.includes("discord")
);
if (discordIdentity) {
  const discordId = discordIdentity.identityId || discordIdentity.id;
  await databases.updateDocument(DATABASE_ID, APPS_COLLECTION, doc.$id, { discordId });
}
```

## API Keys Required

In Appwrite Console, create an API key with these scopes:
- `users.read` — Read user identities for Discord role verification
- `databases.read` — Read applications and reviews
- `databases.write` — Update application status, create review documents
