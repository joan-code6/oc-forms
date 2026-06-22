# Appwrite Deployment Guide

## Global Variables (Project-Level)

All shared configuration is set ONCE at the project level via the Appwrite CLI.
All 17 functions inherit these variables automatically — no more per-function duplication.

### Set up global variables

1. Fill in missing values in `scripts/global-vars.env`
2. Run the setup script:

```powershell
pwsh scripts/set-global-vars.ps1
```

This pushes all variables as project-level globals. You can verify them in:
**Appwrite Console > Project > Variables**

### Global variable list

| Variable | Source | Notes |
|----------|--------|-------|
| `APPWRITE_ENDPOINT` | `all_creds_you_will_ever_need` | |
| `APPWRITE_PROJECT_ID` | `all_creds_you_will_ever_need` | |
| `APPWRITE_API_KEY` | `all_creds_you_will_ever_need` | Rotate this to change all functions at once |
| `APPWRITE_DATABASE_ID` | `all_creds_you_will_ever_need` | `outcraft` |
| `APPWRITE_APPLICATIONS_COLLECTION_ID` | Console > Databases | |
| `APPWRITE_CLAIMS_COLLECTION_ID` | Console > Databases | |
| `APPWRITE_MODERATOR_REVIEWS_COLLECTION_ID` | Console > Databases | |
| `APPWRITE_SETTINGS_COLLECTION_ID` | Console > Databases | |
| `APPWRITE_INVITE_LINKS_COLLECTION_ID` | Console > Databases | |
| `APPWRITE_OVERWRITES_COLLECTION_ID` | Console > Databases | |
| `DISCORD_BOT_TOKEN` | Discord Developer Portal | Rotate in one place |
| `DISCORD_GUILD_ID` | Discord Server Settings | |
| `DISCORD_STAFF_ROLE_ID` | Discord Role Context Menu | |
| `DISCORD_FASTTRACK_ROLE_ID` | Discord Role Context Menu | `1294806863438676106` |
| `ADMIN_ROLE_ID` | Discord Role Context Menu | |
| `FRONTEND_URL` | Your deployed frontend URL | Used by `create-invite-link` to generate invite URLs |

### To rotate credentials

Just update the value in `scripts/global-vars.env` and re-run the script:

```powershell
pwsh scripts/set-global-vars.ps1
```

All functions pick up the new value immediately on next execution.

### To fetch existing collection IDs from current functions

If you don't know your collection IDs, you can pull them from an existing function:

```powershell
appwrite client --endpoint "https://fra.cloud.appwrite.io/v1" --projectId "69be75ef00267961b515"
appwrite functions list-variables --function-id submit-application
```

## Frontend (.env)

```env
VITE_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=69be75ef00267961b515
VITE_APPWRITE_DATABASE_ID=outcraft
VITE_APPWRITE_COLLECTION_ID=applications
VITE_APPWRITE_FUNCTION_SUBMIT_ID=submit-application
VITE_APPWRITE_FUNCTION_VERIFY_MOD_ID=verify-moderator-access
VITE_APPWRITE_FUNCTION_STATS_ID=get-moderator-stats
VITE_APPWRITE_FUNCTION_NEXT_APP_ID=get-next-application
VITE_APPWRITE_FUNCTION_RATING_ID=submit-application-rating
VITE_APPWRITE_FUNCTION_REVIEWS_ID=get-mod-reviews
VITE_APPWRITE_FUNCTION_REVIEW_ID=get-mod-review
VITE_APPWRITE_FUNCTION_UPDATE_REVIEW_ID=update-mod-review
VITE_APPWRITE_FUNCTION_VERIFY_INVITE_ID=verify-invite-access
VITE_APPWRITE_FUNCTION_CREATE_INVITE_ID=create-invite-link
VITE_APPWRITE_FUNCTION_REDEEM_INVITE_ID=redeem-invite-link
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

### Invite Links Collection

Fields:
- `code` (string) — Unique invite code (UUID)
- `createdBy` (string) — Appwrite user ID of the creator
- `createdByDiscordId` (string) — Discord user ID of the creator
- `createdByDiscordUsername` (string) — Discord display name of the creator
- `used` (boolean) — Whether the invite has been redeemed
- `usedBy` (string, optional) — Appwrite user ID of who redeemed it
- `usedAt` (string, optional) — ISO date when redeemed
- `createdAt` (string) — ISO date when created

## Appwrite Functions

Deploy all functions at once:
```bash
appwrite push functions --all
```

Or deploy a single function:
```bash
appwrite push functions --function-id submit-application
```

All 17 functions in `appwrite/functions/`:

| Function | Role Required | Description |
|----------|--------------|-------------|
| verify-moderator-access | Staff | Checks Discord staff role |
| verify-invite-access | Fasttrack | Checks Discord fasttrack role |
| submit-application | None | Handles player form submissions |
| get-next-application | Staff | Fetches/claims next pending application |
| submit-application-rating | Staff | Saves rating, marks app reviewed |
| get-moderator-stats | Staff | Returns dashboard counts |
| create-invite-link | Fasttrack | Generates single-use invite links |
| redeem-invite-link | None | Redeems invite, creates auto-reviewed application |
| get-mod-reviews | Admin | Lists recent moderator reviews |
| get-mod-review | Admin | Gets single review detail |
| update-mod-review | Admin | Updates review rating/note |
| get-review-conflicts | Admin | Finds conflicting reviews |
| get-conflict-detail | None | Gets application and review detail for conflict |
| resolve-conflict | Admin | Resolves review conflict with admin rating |
| get-app-settings | Public/Admin | Gets app settings (paused status for public) |
| update-app-settings | Admin | Updates app settings |
| cleanup-stale-claims | None (scheduled) | Releases expired review claims |

Each function requires `node-appwrite` as a dependency. Run `npm install` in each function directory before deploying.

### No per-function env vars needed

All configuration is now global (project-level variables). The only exception is if you have function-specific overrides, but none of the current functions require this. All 17 functions read from the same set of global variables.

### Function: verify-moderator-access
- Verifies the user has the Discord staff role
- Returns `{ allowed: boolean, userId, discordId, discordUsername }`

### Function: get-moderator-stats
- Requires staff role verification
- Returns `{ openApplications, totalClosed, reviewedByYou }`

### Function: get-next-application
- Requires staff role verification
- Accepts optional `{ applicationId }` in body
- If `applicationId` provided: returns that specific app (or null if already reviewed/not found)
- If no `applicationId`: claims oldest pending app using atomic claim document (up to 5 attempts)
- Stale claims (>30 min based on `claimedAt`) are automatically cleaned up
- Uses stored `discordId` field for reliable guild role lookup (not username search)
- Returns `{ application: { id, minecraftIGN, skinUrl, discordUsername, discordRoles, discordRolesUnavailable, timezone, createdAt, status, answers: [{question, answer}] } | null }`
- `discordRolesUnavailable: true` when Discord API could not be reached for role lookup
- Reads settings collection ID from `APPWRITE_SETTINGS_COLLECTION_ID` env var

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
- Uses `APPWRITE_APPLICATIONS_COLLECTION_ID` (not the old `APPWRITE_COLLECTION_ID`)

### Function: verify-invite-access
- Verifies the user has the Discord fasttrack role (`DISCORD_FASTTRACK_ROLE_ID = 1294806863438676106`)
- Returns `{ allowed: boolean, userId, discordId, discordUsername }`

### Function: create-invite-link
- Requires fasttrack role verification
- Generates a unique UUID invite code
- Creates a document in the Invite Links collection
- Returns `{ success: boolean, code, url }`

### Function: redeem-invite-link
- Requires user authentication (any Discord user)
- Accepts `{ code, minecraftIGN }` in body
- Validates the code exists and is unused
- Checks for duplicate user and duplicate Minecraft IGN
- Creates an application document with `status: "closed"`, `rating: 100`, empty answers
- Creates a moderator review entry (100%, "Generated through custom invite link")
- Marks the invite link as used
- Returns `{ success: boolean, documentId }`

## Application Status Flow

```
pending → in_review → reviewed
          ↓ (expired claim)
        pending
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
