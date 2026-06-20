# OutCraft Moderator Review Plan

This plan describes the moderator side of the OutCraft application form. The scope is intentionally small: two moderator pages inside the current npm app, fully backed by Appwrite Auth, Appwrite Database, and Appwrite Functions.

## Goal

Players apply through the existing form. Moderators sign in with Discord, Appwrite verifies whether they have the required Discord staff role, and staff members can review one application at a time.

The moderator flow is:

1. Sign in with Discord.
2. Verify Discord server staff role through an Appwrite Function.
3. Show the moderator dashboard.
4. Click `Evaluate Applications`.
5. Review one player application.
6. Give the player a percentage rating with the red/orange/yellow/green slider.
7. Click `Continue`.
8. Save the review through an Appwrite Function.
9. Load the next pending application or return to the dashboard.

## Required Pages

### Page 1: Moderator Dashboard

Route:

```txt
/moderator
```

Purpose:

Show basic moderator stats and let the moderator enter the review flow.

The page should contain only:

```txt
Moderator Dashboard

[Open Applications] [Total Closed] [Closed By You]

[Evaluate Applications ->]
```

Stats:

- `Open Applications`: number of applications where `status === "pending"`.
- `Total Closed`: number of applications that have already been reviewed or closed.
- `Closed By You`: number of applications reviewed by the current moderator.

Button behavior:

- `Evaluate Applications` calls an Appwrite Function to get the next available pending application.
- If an application exists, navigate to `/moderator/review`.
- If no application exists, stay on the dashboard and show a simple empty state:

```txt
No applications waiting for review.
```

### Page 2: Review Page

Route:

```txt
/moderator/review
```

Purpose:

Show one applicant at a time, let the moderator read their application, rate them, and continue.

Layout:

```txt
Review Application

Left:
- Application questions and answers
- Scrollable if the answers are long

Right:
- Minecraft skin preview
- Minecraft username
- Discord username
- Timezone
- Discord join date, if available
- Other personal/application metadata, if available

Bottom:
[0-100% rating slider with red/orange/yellow/green zones]
[Continue ->]
```

The left side is the main content area. It should show every question the player answered and the answer below it.

The right side is the applicant profile overview. It should stay visible while the moderator scrolls through the answers on desktop.

The bottom rating area should stay easy to reach. The moderator must choose a rating before `Continue` is enabled.

## Rating Slider

The slider is a percentage from `0` to `100`.

Color orientation:

```txt
0-25%    Red
26-50%   Orange
51-75%   Yellow
76-100%  Green
```

Meaning:

```txt
0%   = very bad application / strong reject direction
100% = very good application / strong accept direction
```

The color sections are only orientation for moderators. The actual saved value should be the exact percentage.

When the moderator clicks `Continue`, save:

```ts
{
  applicationId: string,
  moderatorUserId: string,
  moderatorDiscordId: string,
  rating: number,
  ratingZone: "red" | "orange" | "yellow" | "green",
  reviewedAt: string
}
```

## Appwrite-First Architecture

Use the full Appwrite ecosystem:

- Appwrite Auth for Discord sign-in.
- Appwrite Database for applications and reviews.
- Appwrite Functions for every protected moderator action.
- Appwrite environment variables for secrets, database IDs, Discord guild ID, and staff role ID.

The frontend must not directly decide whether someone is staff. It can ask Appwrite for the result, but the real permission checks must happen inside Appwrite Functions.

Every moderator-only Function must verify the current Appwrite user and confirm the required Discord staff role before returning or changing application data.

## Authentication And Staff Verification

Discord login is already set up through Appwrite Auth.

Access flow:

```txt
User opens /moderator
↓
If not logged in:
  redirect to Discord OAuth login
↓
After login:
  call verify-moderator-access Appwrite Function
↓
Function checks the user's Discord identity and Discord server roles
↓
If user has staff role:
  allow access to moderator pages
↓
If user does not have staff role:
  show no-access state
```

The staff role check should use Discord role IDs, not role names.

Required Appwrite Function environment variables:

```txt
APPWRITE_ENDPOINT
APPWRITE_PROJECT_ID
APPWRITE_API_KEY
APPWRITE_DATABASE_ID
APPWRITE_APPLICATIONS_COLLECTION_ID
APPWRITE_MODERATOR_REVIEWS_COLLECTION_ID
DISCORD_BOT_TOKEN
DISCORD_GUILD_ID
DISCORD_STAFF_ROLE_ID
```

The Discord bot token is only used in Appwrite Functions. It must never be exposed to the frontend.

## Database Collections

### Existing Applications Collection

The existing `submit-application` Function already creates application documents with fields like:

```ts
{
  userId: string,
  discordUsername: string,
  discordEmail: string,
  minecraftIGN: string,
  timezone: string,
  yesNoAnswers: string,
  textAnswers: string,
  dropdownAnswers: string,
  status: "pending",
  createdAt: string
}
```

Keep using this collection as the source of truth for submitted applications.

Recommended additions:

```ts
{
  reviewedAt?: string,
  reviewedBy?: string,
  rating?: number,
  ratingZone?: "red" | "orange" | "yellow" | "green",
  closedAt?: string
}
```

Status values:

```txt
pending
reviewed
closed
```

For this first version, `Continue` should move the current application from `pending` to `reviewed`.

### Moderator Reviews Collection

Create a separate collection for the moderator's submitted rating.

Example document:

```ts
{
  applicationId: string,
  moderatorUserId: string,
  moderatorDiscordId: string,
  moderatorDiscordUsername: string,
  rating: number,
  ratingZone: "red" | "orange" | "yellow" | "green",
  reviewedAt: string
}
```

This keeps a review history even if the application document stores the latest or final review state.

### Optional Moderator Access Cache

Optional, but useful to avoid calling Discord on every page load.

Example document:

```ts
{
  userId: string,
  discordId: string,
  hasStaffRole: boolean,
  checkedAt: string
}
```

Cache should expire quickly, for example after 5 to 15 minutes, so removed staff roles do not keep access for long.

## Required Appwrite Functions

### 1. verify-moderator-access

Purpose:

Check whether the current Appwrite user has the Discord staff role.

Frontend use:

- Called when entering `/moderator`.
- Called when entering `/moderator/review`.

Function behavior:

1. Read the current Appwrite user from request headers.
2. Fetch the user's Appwrite account/identity data.
3. Get the linked Discord user ID.
4. Use the Discord bot token to fetch the guild member from `DISCORD_GUILD_ID`.
5. Check whether the member has `DISCORD_STAFF_ROLE_ID`.
6. Return access result.

Example response:

```ts
{
  allowed: true,
  userId: "appwrite-user-id",
  discordId: "discord-user-id",
  discordUsername: "ModeratorName"
}
```

If the user is not staff:

```ts
{
  allowed: false
}
```

### 2. get-moderator-stats

Purpose:

Return the three dashboard numbers.

This Function must verify staff access before reading moderator data.

Example response:

```ts
{
  openApplications: 18,
  totalClosed: 42,
  closedByYou: 7
}
```

Counts:

- `openApplications`: applications with `status === "pending"`.
- `totalClosed`: applications with `status !== "pending"`.
- `closedByYou`: review documents where `moderatorUserId` is the current Appwrite user.

### 3. get-next-application

Purpose:

Return the next pending application to review.

This Function must verify staff access before returning application data.

Behavior:

1. Find the oldest application where `status === "pending"`.
2. Return applicant profile data and answers.
3. If there is no pending application, return `application: null`.

Example response:

```ts
{
  application: {
    id: "application-doc-id",
    minecraftIGN: "PlayerName",
    skinUrl: "https://mc-heads.net/body/PlayerName",
    discordUsername: "player",
    timezone: "Europe/Berlin",
    createdAt: "2026-06-20T10:00:00.000Z",
    answers: [
      {
        question: "Why do you want to join OutCraft?",
        answer: "..."
      }
    ]
  }
}
```

The Function should parse the existing JSON string fields:

- `yesNoAnswers`
- `textAnswers`
- `dropdownAnswers`

and return one normalized `answers` array for the frontend.

### 4. submit-application-rating

Purpose:

Save the moderator's slider rating and move the application forward.

This Function must verify staff access before writing anything.

Request:

```ts
{
  applicationId: string,
  rating: number
}
```

Validation:

- `applicationId` must exist.
- `rating` must be a number from `0` to `100`.
- Application must still be `pending`.
- Current user must have the Discord staff role.

Behavior:

1. Calculate `ratingZone`.
2. Create a document in the moderator reviews collection.
3. Update the application:

```ts
{
  status: "reviewed",
  reviewedAt: new Date().toISOString(),
  reviewedBy: currentUserId,
  rating,
  ratingZone
}
```

4. Return success.

Example response:

```ts
{
  success: true
}
```

After success, the frontend should request the next application or navigate back to the dashboard if none are left.

## Frontend Implementation Plan

### Routes

Add these routes inside the current React app:

```txt
/moderator
/moderator/review
/no-access
```

### Shared Moderator Guard

Create a reusable guard/hook, for example:

```txt
useModeratorAccess()
```

Responsibilities:

- Check current Appwrite auth session.
- If no session exists, start Discord login.
- Call `verify-moderator-access`.
- Return loading, allowed, and denied states.

All moderator pages must use this guard.

### Dashboard Component

The dashboard should:

1. Use `useModeratorAccess()`.
2. Call `get-moderator-stats`.
3. Render the three stat cards.
4. Render `Evaluate Applications`.
5. On click, call `get-next-application`.
6. If an application exists, store its ID in route state or navigate to `/moderator/review`.
7. If no application exists, show the empty state.

### Review Component

The review page should:

1. Use `useModeratorAccess()`.
2. Load the current application through `get-next-application`.
3. Show questions and answers on the left.
4. Show the Minecraft skin and user info on the right.
5. Show the rating slider at the bottom.
6. Keep `Continue` disabled until a rating is selected.
7. On `Continue`, call `submit-application-rating`.
8. After success, load the next application.
9. If no next application exists, return to `/moderator`.

## UI Details

### Dashboard

Keep it simple and close to the wireframe:

```txt
Moderator Dashboard

Open Applications    Total Closed    Closed By You
18                   42              7

[Evaluate Applications ->]
```

### Review

Desktop layout:

```txt
-------------------------------------------------------
Review Application

Questions / Answers                       Profile
---------------------------------         -------------
Question 1                                Minecraft skin
Answer                                    Minecraft name
                                          Discord name
Question 2                                Timezone
Answer                                    Created date

Question 3
Answer

-------------------------------------------------------
Rating: [red | orange | yellow | green slider]  78%

                                      [Continue ->]
-------------------------------------------------------
```

Mobile layout:

```txt
Profile
Questions / Answers
Rating Slider
Continue
```

Design rules:

- Dark UI is fine and fits the wireframe.
- Keep the app clean, not decorative.
- Use red/orange/yellow/green only for the rating slider.
- Keep the right profile panel sticky on desktop.
- Make long answers readable and scrollable.
- The moderator should never have to search for the `Continue` button.

## Security Requirements

The frontend must never directly read all pending applications from the database.

Protected actions must go through Appwrite Functions:

- checking staff access
- reading moderator stats
- reading the next application
- saving a rating

Each Function must independently verify staff access. Do not rely on a previous frontend check.

Database permissions should be strict:

- Normal users can create their own application only through the existing submit flow.
- Normal users cannot read other applications.
- Moderators should not need broad direct database read/write permissions from the frontend.
- Functions use the Appwrite API key to perform privileged reads/writes after role verification.

## Minimal Build Order

1. Add database collection for moderator reviews.
2. Add required Appwrite environment variables.
3. Create `verify-moderator-access` Function.
4. Create `get-moderator-stats` Function.
5. Create `get-next-application` Function.
6. Create `submit-application-rating` Function.
7. Add frontend Function caller helper.
8. Add `useModeratorAccess()`.
9. Add `/moderator` dashboard page.
10. Add `/moderator/review` page.
11. Test with:
    - logged-out user
    - logged-in non-staff user
    - logged-in staff user
    - empty application queue
    - successful review submission

## Final Behavior

The final moderator experience should be:

```txt
Discord Sign In
-> Appwrite Function verifies staff role
-> Moderator Dashboard
-> Evaluate Applications
-> Review one applicant
-> Set 0-100% rating
-> Continue
-> Save through Appwrite Function
-> Next application or dashboard
```

Nothing else is required for the first version.
