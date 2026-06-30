# OC form the application site for OutCraft :D

hey !! this is the site where people apply to join outcraft.net, a minecraft civilization/survival event thing. instead of managing a google form or random discord channel, players fill out a multi-page app, mods rate them 0-100%, and admins export the whitelist. all through one website.

**live at [apply.outcraft.net](https://apply.outcraft.net/)**

<br>

## what it does

- **players** log in with discord, fill out a 6-page form (mc username, timezone, yes/no questions, a bunch of long text answers). auto-saves as you go :p
- **moderators** grab a random application, read through everything, and slide a rating from 0-100% (red/orange/yellow/green). apps get "claimed" so two mods don't review the same one
- **admins** check audit logs, resolve conflicts when mods disagree, pause/unpause applications, manage discord event roles, and export the final whitelist
- **fast-track** mods with a special role can generate single-use invite links. people who redeem one skip the whole review process and get auto-accepted at 100%


## screenshots :D

some shots of the site (the background is ingame cave screenshots btw):

<img width="1526" height="863" alt="grafik" src="https://github.com/user-attachments/assets/227cd7f4-0988-4801-bf85-d5b5b58f37dd" />
<img width="1527" height="863" alt="grafik" src="https://github.com/user-attachments/assets/36c74e13-e1cc-4f6d-9b4d-004042d492de" />


## how it was made

this took way longer than i expected lol. i spent most of my time on:

- **mod review claiming**  making sure two mods can't review the same app at the same time. i used a separate appwrite collection just for "claims" with a 30-minute timer, then a scheduled function cleans up stale ones every 5 minutes. took like 3 rewrites to get right
- **session storage everywhere**  if your browser eats your session (looking at you opera gx and brave), the app tries to recover from both localStorage AND sessionStorage. if it fails 3 times in a row it tells you to go ask for help on discord
- **the rating slider**  getting the color zones (red 0-25, orange 26-50, yellow 51-75, green 76-100) to look good and feel responsive was annoying. tailwind doesn't have great slider support so i styled a native range input
- **minecraft username validation**  checks the format `[a-zA-Z0-9_]` (3-16 chars) and then pings a mojang api to make sure the account actually exists
- **background slideshow**  uses `import.meta.glob` to load all screenshots from `/public/screenshots/` with a 2-second crossfade. looks sick on desktop, had to tone it down on mobile

## running it yourself

### 1. clone + install
```sh
git clone https://github.com/<you>/oc-forms && cd oc-forms
npm install
```

### 2. set up appwrite

you need an appwrite project with all 23 functions deployed. copy the example env:

```sh
cp .env.example .env
```

fill in your appwrite endpoint, project id, database id, and all the function ids. the `.env.example` shows every variable you need.

if you also want the discord event role management to work, set `DISCORD_Underground_Event_Participant_ROLE_ID`.

### 3. deploy the appwrite functions
```sh
appwrite push functions --all
```

### 4. run the dev server
```sh
npm run dev
```

build for prod:

```sh
npm run build
npm run preview
```


## license

idk MIT? idk tbh

## AI Decleration
I use AI heavily but not irresponsibly!
I do not VibeCode as i review all code, have a good understanding of the projects structure and decide over the main aspects of the project.
