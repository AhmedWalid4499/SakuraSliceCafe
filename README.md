<div align="center">

<img src="https://drive.google.com/thumbnail?id=12VAuqDh5TvAk7vhlrkdd1vTVl2ojpwAh&sz=w120" width="90" style="border-radius:50%" />

# 🌸 Sakura Slice Café
### *A hypothetical café, imagined with love*

[![Made with](https://img.shields.io/badge/Made%20with-HTML%20%2F%20CSS%20%2F%20JS-f2a7bb?style=flat-square&logo=html5&logoColor=white)](https://github.com)
[![Status](https://img.shields.io/badge/Status-Dream%20Café-d4678a?style=flat-square)](https://github.com)
[![Location](https://img.shields.io/badge/Imagined%20in-Cairo%2C%20Egypt-7aab7a?style=flat-square)](https://github.com)
[![Instagram](https://img.shields.io/badge/@sakuraslicecafe-Instagram-f2a7bb?style=flat-square&logo=instagram&logoColor=white)](https://www.instagram.com/sakuraslicecafe/)

---

*Where every cup holds a little story.*

</div>

---

## 🍵 What is this?

Sakura Slice Café is a **hypothetical café concept** — not a real place you can walk into, but a feeling. A dream built from a love of Japanese aesthetics, slow mornings, matcha, and the belief that the right space can change how you feel about your entire day.

This is the **introduction landing page** for the concept — a single HTML file that brings the café to life visually, tells its story, introduces its imagined team, and connects people to a daily email system.

> *"This is for every soul that needed a place to land."*

---

## 🗂️ File Structure

```
SakuraSliceCafe/
│
├── public/
│   ├── index.html          ← The website (single file, now reads content from the database)
│   ├── cafe.html           ← The 3D virtual café — /cafe
│   ├── cafe/               ← The café's modules
│   │   ├── app.js          ←   accounts, walking, sitting, notes, ordering, chat, live presence
│   │   ├── world.js        ←   the room, furniture, the team, Cairo outside, time-of-day light
│   │   ├── avatar.js       ←   smooth rounded characters (people, fox, rabbit, cat, owl)
│   │   ├── notes.js        ←   notes & pins drawn on high-res paper
│   │   └── audio.js        ←   the generated soundscape (music, rain, fire, café hum…)
│   │   (world.js also builds the upstairs loft and the street outside)
│   └── admin.html          ← The back office — /admin
├── server/
│   ├── index.js            ← Express server + WebSocket
│   ├── api.js              ← All /api routes
│   ├── realtime.js         ← Live café: who's here, where they stand, broadcasts
│   ├── npc.js              ← The team's AI conversations (Claude API)
│   ├── groups.js           ← Groups and the rooms upstairs
│   ├── auth.js             ← Accounts + sessions
│   ├── db.js               ← Postgres connection + migrations
│   ├── schema.sql          ← Every table
│   └── seed-content.json   ← The site's starting content (written once, then lives in Postgres)
├── railway.json            ← Railway deploy settings (start command + health check)
└── sakura-guestbook.gs     ← Legacy Apps Script guestbook (no longer needed)
```

---

## 🚂 Deploying on Railway (with Postgres)

1. In the Railway project, add a **Postgres** service (if it isn't there yet).
2. On the website service → **Variables**, add:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `ADMIN_EMAIL` = the email you'll register with (this account becomes the owner)
   - `NODE_ENV` = `production`
   - `ANTHROPIC_API_KEY` = a Claude API key from [console.anthropic.com](https://console.anthropic.com) — gives the team their voices (without it they only use a few set lines), and lets Claude check that what people write is kind (below)
   - `ANTHROPIC_WORKSPACE_ID` *(only for organisation-level keys)* = the workspace ID (`wrkspc_…`) from console.anthropic.com → Settings → Workspaces. Not needed if the key was created inside a workspace.
   - `APPS_SCRIPT_URL` *(optional)* = your old email-collector web-app URL, so new signups also land in the Google Sheet the SendGrid sender reads
3. Deploy. On start the server creates every table and seeds the content — safe to run on every deploy, it never overwrites what you've edited.
4. Visit `/cafe`, register with your `ADMIN_EMAIL`, and `/admin` opens up for you.

Local: `cp .env.example .env`, point `DATABASE_URL` at any Postgres, then `npm install && npm start` → http://localhost:3000.

### What's in the database

| Table | What it holds |
|-------|---------------|
| `users` | Accounts, avatar, personal sound mix & preferences |
| `sessions` | Sign-in sessions (only a hash of each token is stored) |
| `cafe_notes` | Every note & pin left in the 3D café — position, colour, text, author |
| `note_hearts` | Who ♥'d which note |
| `chat_messages` | The café's quiet chat |
| `guestbook_notes` | Table Four notes from the website (can be hidden from /admin) |
| `subscribers` | Morning & evening letter signups (CSV export in /admin) |
| `site_content` | **Everything editable**: today's story, letters, moods, hero text, the pastry counter, the drinks menu, the letters archive, this week's pairing, the book, café menu, welcome card, default sound mix, board sign |
| `site_content_history` | Every earlier version of each content row — nothing is ever lost |
| `npc_sessions` / `npc_messages` | Conversations with the team, stored exactly as sent so each one can continue |
| `guest_memories` | What the team remembers about each guest's tastes |
| `groups` / `group_members` | Groups and who's in them (invite codes for private ones) |

Change a `site_content` row (in `/admin`, or directly in Postgres) and the website and café pick it up immediately — no redeploy. People already inside the café see changes live.

---

## 🪑 The 3D Café — `/cafe`

- **Accounts** — join with a name, username, email and password; sign back in any time.
- **Avatar creator** — a person, fox, rabbit, cat or owl; skin/fur, hair style & colour, outfit, accent, and a little extra (glasses, headphones, scarf, beanie, a sakura flower). Saved to your account.
- **Smooth, not pixelated, and lifelike** — real 3D with antialiasing, soft shadows, filmic tone mapping and rounded geometry. Plaster, wood grain and woven fabric have real surface texture (bump-mapped, so the light rakes across them), the palette is soft and muted, and most of the light comes from the room and its lamps rather than a flat fill. On *Sharpest*, ambient occlusion (GTAO) adds the soft shadows where things meet — under tables, in corners, where a cup sits — and the lamps glow a little. A *Picture* setting (Sharpest / Balanced / Gentle on battery) lives in the sound panel.
- **Relaxing sound, generated live** — a slow electric-piano progression with a wandering melody that never loops the same way, soft rain on the glass, a far-off café hum with the odd cup clink, a fireplace that gets louder as you walk closer (3D audio), sparrows by day and crickets by night, and the door's wind chime. Every channel has its own slider; your mix is saved to your account.
- **Notes & pins everyone sees** — 📌 *Leave a note* on the Community Board, any table (including Mariam's corner), or a wall. Sticky notes or pinned cards, six paper colours. They appear for everyone instantly, can be ♥'d, and only their author (or the owner) can take them down.
- **People, live** — see who else is in, walking and sitting; wave, send a little emoji, or chat. Chat shows as soft bubbles over heads.
- **Sit anywhere** — click a chair or an armchair by the fire.
- **Order a drink** — click Hana or the counter; the drink appears in your hand (and others see it). The menu is the `cafe.menu` content row.
- **The team** — Yuto (tortoiseshell glasses, cream apron with a pencil in the pocket), Hana the fox (bushy cream-tipped tail, dark paws, a sage neckerchief), Yuki the rabbit (one floppy ear, a pink ribbon on the other), and Me3temed on his top shelf with his forest-green bowtie and slow, half-shut blink. Click them.
- **Characters with faces** — everyone (team and visitors) is built in soft chibi proportions: a big round head, eyes with catch-lights that blink, brows, a small smile, rosy cheeks, collars, cuffs and mitten hands, proper fringes and hair, aprons with a bib, waist tie and pocket.
- **Desserts** — ☕ *Order* has a **🍡 Desserts** tab with the twelve pastries from the website's counter (`counter.pastries`). Yours comes on a plate in your other hand (others see it); 🍡 *Take a bite* (or **B**) three times and Me3temed has a word to say. Set the plate down next to your cup and both stay on the table. Hana and Yuki can recommend a pastry in conversation, with an *I'll have it* button.
- **Every drink from the letters** — the Drinks tab has shelves: ☕ House (the `cafe.menu` row) and 🌸 Spring, ☀️ Summer, 🍂 Autumn, ❄️ Winter with every drink from the morning letters (`menu.drinks`, the same list as the website). Colours and who makes each one are worked out from the name (`public/cafe/drinks.mjs`, shared with the server so the team can recommend any of them).
- **Eat and drink** — ☕ *Take a sip* (**C**) four times and the cup is empty; 🍡 *Take a bite* (**B**) three times and the plate is. The cup really goes down, and your hand comes up to your mouth. Both work on what's on your table too.
- **Table service** — sitting at a table? Tick 🛎️ *Bring it to my table* on the menu: Hana (drinks) or Yuki (pastries) carries it across the café and sets it down in front of you.
- **The team moves** — Yuto drifts between the tables and stops to say hello; Hana works the counter and pops into the kitchen; Yuki brings bakes out of the kitchen; Me3temed flies down from his shelf to a table now and then. They walk round the furniture (a walking map built from it, `public/cafe/staff.js`) and stop and turn to you when you talk to them.
- **The kitchen** — the back door is now a pair of sage swinging doors with round portholes that open as you walk up. Behind them: a tiled kitchen with a window onto the street, a long counter and sink, a cream oven glowing warm with a pink kettle steaming on the hob, a mint fridge, shelves of jars, copper pans, a prep table with dough, a rolling pin, Hana's recipe book and pastries cooling, and today's bakes chalked on the wall.
- **Numbered tables** — twelve tables, round ones and little square tables for two, each with a number card (Table 4 is Table Four, by the window); hovering a table shows its number. Along both front windows there's a wooden bar with four stools each — *the window bar* and *the street bar* — and the team bring orders there too.
- **Sitting properly** — every seat knows how high its cushion is, so you sit on it, not in it, and a little forward of the backrest.
- **He / She** — choose *She* or *He* in the avatar creator (lashes and a softer waist, or broader shoulders and fuller brows), and *Trousers* or *A skirt*.
- **🧑‍🤝‍🧑 The regulars** — quiet background guests who make the café feel lived in (`public/cafe/regulars.js`). They come in through the front door, order at the counter (Hana turns to them, the machine grinds and steams, the bell rings), carry their drink to a free table or the window bar, and sit with a book, a laptop, the paper or their phone — sipping now and then, turning a page — before they head off. It's busiest at lunch and after work, nearly empty after closing, and there are fewer of them when real people are in. Who comes and when is worked out from the clock, so everyone sees the same regulars at about the same time. They never take a seat a real person wants: they give it up and leave.
- **🔊 Sounds of a real café** — the espresso machine (grinder, pump, steam wand and the knock of the portafilter) when a drink is made, the counter bell when it's ready, cups set down on tables, chairs scraping as people sit and stand, pages turning — each coming from where it happens. The rain is louder by the windows, and the hum of the room grows with the number of people in it.
- **☀️ Light through the day** — the morning sun comes in low and golden through the front windows, climbs high at midday, and goes down amber through the left windows in the late afternoon, laying long patches of light across the floor. After dark the room is lit by its lamps. The sign on the front door turns from *open* to *closed* at 10pm (Cairo time) and back at 10am, the lamps go a little lower after closing, and anyone who comes in late gets a gentle note that the door is never locked for them.
- **🖼️ The photo wall** — five frames on the left wall, between the windows, for real photos of the café. The owner clicks a frame, uploads a photo (cropped to fit) and adds a line under it; everyone sees it straight away (`cafe.photos`). Until then each frame holds a soft sakura print.
- **🍽️ Tables that look used** — when a regular leaves, their empty cup and plate (crumbs and all) stay on the table — now and then a book or the paper too — until Yuto, Hana or Yuki notice, walk over and carry them back to the counter. A table or two hasn't been cleared yet when you walk in, as in any real café; regulars don't sit at a table still waiting to be cleared. While they sit, regulars have a pastry going down bite by bite.
- **🧾 A real menu board** — the big chalkboard above the counter is written out from the menu every day: six *warm* drinks, six *iced* and six bakes *from the oven*, from this season's letters and the house menu, each one *free* (click it to order). By the counter stands an A-frame with *this week's specials* — the week's own picks, or the owner's in `cafe.specials`.
- **☕ The small things** — steam drifts off hot drinks; iced ones come in a clear glass with ice, a straw and condensation beading on the outside. By the front door: a coat rail (with a BookBeans tote), an umbrella stand that fills up on rainy days, and a *please seat yourself — we'll come to you* stand. On the counter: a tip jar *for kindness* and a card reader that says *free*.
- **🗓️ Seasons, Ramadan and events** — spring bunting in sakura pinks, summer bunting and a bowl of lemons, a garland of autumn leaves, and in winter evergreen, a candle on every table and blankets on the armchairs. In Ramadan (found from the Hijri calendar) fanous lanterns hang through the room, crescents and stars run along the front windows, *Ramadan Kareem* hangs in the middle of the café, the board says *for iftar*, and the hours become noon – 2am; *Eid Mubarak* for the two Eids. The owner can choose the season, switch Ramadan on or off and set the hours in `cafe.season`. The easel by the fire says *what's on* — the story evening (Fridays, 8pm) and book club (Tuesdays, 7pm) to start with; the owner adds or removes events right from the easel (weekly or one-off, Cairo time), and when one starts, everyone in the café is told.
- **🧾 Customer moments** — the regulars queue in an orderly line at the till end of the counter, order one at a time, then wait at the other end until Hana calls them by name (*"Iced Lavender Lemonade for Mostafa! 🌸"*). Order at the counter yourself and you wait your turn if there's a line (*"right after Kenji — won't be long!"*), then hear your own name called. Every drink earns a stamp on your **🎟️ stamp card** (in the order menu; one stamp per drink, a few minutes apart, kept with your account in `loyalty_cards`). Ten stamps and Yuto brings you a slice of the sakura cake — to your table if you're sitting, or into your hands — and you start a fresh card.
- **👋 A welcome tour** — on your first visit, Hana shows you round in about half a minute (`public/cafe/tour.js`): the counter and the menu board, the tables, the community board, the story shelf, the fire and the easel, the stairs up. The camera turns to each as she talks; Back, Next or Skip at any time, and it ends with *"Would you like your first drink?"*. It's remembered on your account (`prefs.toured`); **? → Take the tour again** runs it any time.
- **🎲 Games at the tables** — sit at any table and press **🎲 Games** to set out **tawla** (backgammon, the Cairo way: two dice, fifteen checkers, race them home — `tawla.mjs`) or **chess** (rules by [chess.js](https://github.com/jhlywa/chess.js), served from npm like Three.js). Play whoever sits across from you — they get a nudge to join — or **Yuto**, who plays gently (two moves ahead in chess, a sensible greedy player in tawla). The board sits on the table in 3D for everyone to see; click it to watch. The server keeps one game per table and checks it's the right person's turn (`realtime.js`); regulars leave a table with a game on it alone.
- **🔗 Invites, photos and link previews** — 🔗 at the top makes an invite link (*Share…*, *WhatsApp* or *Copy*). Whoever opens it sees *"Mariam saved you a seat"* at the door, and walks straight over to your table when they come in. 📸 takes a photo of the café as it is, with a little caption, to save or share. Both pages carry link previews (Open Graph) — a picture of the café (`public/og/`), and for an invite link, *"Mariam saved you a seat at Sakura Slice Café 🌸"* — filled in by the server with the site's own address.
- **🌸 Kept kind** — everything a guest writes for others to see (the chat, notes on the walls and board, the Table Four guestbook, their name, group names) and everything they say to Hana, Yuki, Yuto or Me3temed is checked before it goes up. A quick word list catches swearing and slurs in English, Arabic and Franco-Arabic (also spelled sneakily: `f*ck`, `b!tch`, `a7a`); then Claude (`claude-haiku-5-5`, set `MODERATION_MODEL` to change it) reads it for what a list can't see — insults without bad words, bullying, mocking, threats, hate, sexual remarks. Being sad, lonely or fed up with the world is always allowed. Anything held back never appears; the writer gets a gentle note (the team answer in character), and it's listed for the owner in `/admin` → *Held back by the kindness check*. If Claude can't be reached the word list still applies; `MODERATION=off` turns the check off.
- **📻 The café radio** — songs the owner uploads, played on one shared schedule: everyone in the café hears the same song at the same second (someone walking in comes in mid-song). It's in the 🎧 player at the top and comes on as you walk in (▶/⏸ just for you, with its own volume). The owner uploads songs right in the player (mp3, m4a, ogg, wav — up to 30 MB each; "Artist - Title.mp3" names are read as artist and title), moves them ↑↓, takes them off ✕, starts the list again **⏮ From the top**, or turns the radio off. Songs are stored in Postgres (`media` table) and served with byte ranges from `/api/media/:id`; the running order and start time are in `cafe.radio`. Use music you have the rights to play — royalty-free lofi from e.g. Pixabay Music works well. While the radio plays, the café's own piano fades out.
- **🎵 Lofi from Spotify** — the player's second tab. The owner pastes a Spotify playlist, album or track link (or `/admin` → `cafe.spotify`) and it changes for everyone; **▶ Play for everyone** / **⏸ Pause for everyone** start or stop it on everyone's screen. Spotify plays full songs only for people signed in to Spotify in that browser (otherwise 30-second previews), and it isn't in sync between people — that's what the radio is for.
- **📚 The story shelf** — click the bookshelf: every morning ☀️ and bedtime 🌙 story from the letters, to read in the café. The owner pastes the Google Sheet the stories live in (shared as *Anyone with the link → Viewer*) in the shelf's 🗝️ box; columns are found by their headings — **Title**, **Story** (or Text/Body/Letter), **Date**, **Type** (morning/bedtime), **Edition**, **Day** — and it reads the sheet again every 6 hours (**↻ Sync now** for straight away). The stories are kept in `stories.library` (editable by hand in `/admin` too); the sheet's link stays private to the owner.
- **🖼️ The book of the week** — a framed cover hanging above the bookshelf. Click it for the title, author and a line about it; the owner changes it there, uploading the cover picture (or pasting a link to one, which is copied into the café). Stored in `cafe.bookOfWeek`.
- **Smooth with a crowd** — every avatar is built at a sensible level of detail and drawn in a few pieces (about 20k triangles and ~30 draw calls each, down from 120k and ~70), only bigger parts cast shadows, and if a device still struggles the picture steps down a notch by itself (unless you picked one in 🔊).
- **Sounds** — the brass bell over the door rings when you come in (and when someone else does); the team speak in soft little voices (Me3temed hoots); a pop when you send a message and a two-note ding when one arrives; a sip and a crunch when you eat and drink.
- **The front door** — a pair of glazed doors in a proper frame that fills the opening, and the café clock above it on Cairo time.
- **Pictures on the menu** — every drink and dessert has a picture: drawn ones (`public/art.js`, shared with the website) until you add a Google Drive picture as `image` on the item in `/admin` (`cafe.menu` or `counter.pastries`).
- **Cairo, right now** — the light, the sky through the back door and windows, the stars, and whether the lamps carry the room all follow Cairo's real clock.

- **Sit and set your drink down** — 🪑 *Sit* (or click a chair or a table) walks you to the closest free seat; 🍵 *Put drink down* leaves your cup on the table where everyone can see it.
- **Talk with the team (AI)** — click Yuto, Hana, Yuki or Me3temed, or press 🗣️ *Talk*, for a real conversation in each one's own voice. Hana knows the menu by heart and will recommend a drink for your mood (it appears as a card with an *Order this* button). Tell them what you like — "I love cardamom", "no caffeine after six" — and all four remember it next time.
- **Upstairs: rooms for groups** — climb the spiral stairs (or press 🪜 *Upstairs*). Start a group (private with an invite code, or open for anyone), and your group gets its own loft: a long shared table, a sofa nook by the big window onto the mosque, floor cushions, skylights, your group's name over its own board. Notes and chat up there are only for the group.
- **The Common room** — through the double doors at the east end of the hallway upstairs: a room for every resident to chill together, with a big sofa, armchairs, beanbags and floor cushions round a coffee table, a bookshelf, a help-yourself tea counter, lamps and fairy lights, and a big TV. Click the TV to watch; the owner clicks it → 🗝️ *What's on* and pastes a YouTube **playlist** (or a single video) link. Everyone in the room watches together: whoever is already watching reports where the playlist is every few seconds (`/api/tv/pos`), and newcomers join at the same video and moment. Stored as `common.tv` in `site_content`.
- **Film night: a video or a playlist** — the screen in your own room takes a YouTube video link *or* a playlist link, and guests stay in step the same way.
- **Covered stairs** — the stairwells up from the hallway (to your room's floor and the roof garden) have walls, a roof and a skylight, so the rain stays outside.
- **Weather you can see** — the clock and the weather sit top left (tap them for details; the owner also gets a **🗝️ Change the weather** button right there), and outside a Cairo street clock in the front window and a chalkboard by each door show the time and the weather. Cairo's own weather by default — the same seasonal, day-by-day weather as the website — and the street outside shows it: clear skies, haze, warm & still air, cloud, rain on the road, a thunderstorm with lightning and thunder, morning mist, or a khamaseen sandstorm. Night falls with Cairo's real clock. The café owner can set the weather by hand (for an hour, three hours, the rest of the day, or until they change it back); everyone in the café and the website's weather card follow it straight away. Stored as `cafe.weather` in `site_content`.
- **Room to breathe** — the café is 30 × 22 m (it was 22 × 16): tables have space between them, and there's an extra table in the middle.
- **A real street outside** — pavement, a road with cars going slowly by, people strolling, street lamps that come on at dusk, palms, a café terrace, shopfronts with striped awnings, shuttered windows and satellite dishes, the mosque behind the back street, clouds, birds, and Cairo Tower far off.

Controls: **WASD / arrows** or click the floor to walk · **drag** to look · **scroll** to zoom · **Enter** to chat · **E** sit · **Q** put down / pick up · **B** take a bite · **Esc** (or tap the café) to close a menu.

---

## ✨ Features

### 🖼️ Hero Section
- Full-screen cover photo of the café opening moment
- Animated fade-in headline and subtitle
- Floating café logo (top right)
- Scroll hint with a pulsing line

### 🍱 Bento Grid
A 12-column asymmetric bento layout with 8 cards:

| Card | Description |
|------|-------------|
| 🇪🇬 Cairo, Right Now | **Live.** Real Cairo date and time, plus the day's weather |
| 🕐 Right Now at the Café | **Live.** Shows what's happening at the café at Cairo's current hour |
| 🌸 Tagline | *"This is for every soul that needed a place to land."* |
| 💌 Morning & Evening Letters | Readable archive with a morning/evening toggle, plus email signup |
| 📖 Story | The origin story — a dream born from longing |
| 🪑 Table Four | **Interactive.** A guestbook — visitors leave a note on the table |
| 🪟 The Window Seat | A window whose sky shifts with the time of day |
| 🍃 Menu Strip | Six pills and a CTA down to the full menu |

**Desktop** pairs the cards 7/5 across four bands. **Tablet (≤900px)** drops to 4 columns with Tagline + Window pairing up, so it stays a bento. **Mobile (≤600px)** goes full width for readability.

### 🇪🇬 Cairo, Right Now
A live bar across the top of the grid.

- **Clock** — real `Africa/Cairo` time via `Intl`, so Egypt's DST (UTC+2 winter, UTC+3 summer) is handled automatically. Formatted as `30th of August` / `11:40 PM`.
- Ticks every second; the scenes, window and weather only redraw when Cairo's hour actually changes.
- Falls back to the visitor's local time if the browser has no IANA time zone support.

### 🌤️ Cairo Weather
Not a live feed — an imagined Cairo built from the city's real climate.

- **Condition** is seeded from the date, so it holds steady all day and changes tomorrow. Same date always gives the same weather.
- Seasonal pools keep it plausible: khamaseen only in spring, rain only in winter, `warm & still` in summer and autumn.
- **Temperature** follows Cairo's monthly averages on a curve that peaks around 3pm and bottoms out around 3am, plus a steady ±2° day-to-day drift and a per-condition shift (rain runs cooler, khamaseen hotter).
- Day and night icons and notes, and the condition **tints the window card's sky** so the two agree.

Verified across all 12 months: no season violations, July runs 21–33°C and January 11–21°C.

### 🕐 Right Now at the Café
The card that makes the place feel like it's running without you.

**The café opens at 10am and closes at 10pm.** The scenes follow those hours exactly.

- 15 scenes covering all 24 hours, chosen from **Cairo's** clock
- Four weekday variants: **Tuesday 8–10am** (Yuto leaves for the university) and **Tuesday 10am–12pm** (still teaching, back after eleven), plus **Friday 5–8am** (Yuki's five minutes at table four)
- **Not open yet** / Open / Open · quiet / Closing soon / Just closed / Closed — each restyling the card
- Redraws only when Cairo's hour actually changes, so a page left open stays honest without thrashing

Verified across all 168 hour × weekday combinations: every one resolves to exactly one scene, and every `open` flag matches the 10:00–22:00 window.

To add or edit a scene, change the `CAFE_SCENES` array. First scene whose `[from, to)` contains the hour wins; add `day:` (0 = Sunday) for a weekday-specific variant.

### 🪟 The Window Seat
A CSS window — no image needed — whose sky gradient, sun/moon position and glow are set from Cairo's hour via the `SKIES` array. Night, dawn, morning, midday, afternoon, dusk, night. A weather layer over the sky tints it to match the day's condition.

### 💌 The Letters
Six letters (three morning, three evening) live in the `LETTERS` object. The toggle swaps sets; the signup form sits underneath. Add a letter by pushing an object with `meta`, `subject`, `body`, `sign`.

### 🪑 Table Four
A guestbook, seeded with five notes already "on the table" (the `guestbook.seed` content row).

- **Shared through Postgres** — notes are saved via `/api/guestbook`, so every visitor sees the same table
- If the API can't be reached (e.g. the file opened locally), notes fall back to the visitor's browser
- Held in memory as well as `localStorage`, so notes still appear in private windows and other storage-blocked contexts
- All note text is rendered with `textContent`, so pasted markup can never execute

### 🍞 This Week's Pairing
A bento card under the window seat: one pastry from the counter and the drink it belongs with ("Honey Dorayaki with an Iced Honey Vanilla Latte. Friday's order, available all week."). It moves to the next pastry every Sunday, Cairo time. Set it in `/admin` → `counter.pairing`:
- `{"mode":"rotate","from":"2026-10-11","start":"honey-dorayaki"}` — rotate, starting with that pastry in that week
- `{"mode":"set","pastry":"matcha-basbousa","note":"optional line"}` — pin one

### 💌 The Letters archive
"Every morning since March. *Twelve editions, eighty-four mornings.*" One card per edition with its theme. Open one for the week: morning story, night story and drink, Sunday to Saturday (drinks link to their recipe). A second signup form sits under it. Edit `letters.archive`; a `null` day shows as a dash until its title is filled in.

### 🍵 The House Menu
Its own full section, not a card. **No prices** — the café doesn't exist, so nothing costs anything.

- 16 items across Matcha & Tea, Coffee, Sweet, Savory — each with a description in the café's voice and who makes it
- **Every item has a real method.** A `How it's made` toggle opens step-by-step instructions — actual technique, written in the café's voice. Native `<details>`, no JavaScript.
- Two items answer in prose instead of steps: the **Sakura Slice** (Yuki won't say) and **Seasonal Something** (the recipe is written after the shopping)
- **"What do you need today?"** — six moods (tired, heartbroken, can't sleep, celebrating, overwhelmed, just arrived), each answered with a drink and a note from Hana. Edit the `MOODS` object.

### 🥮 The Counter (pastries)
Between The People and the bookshelf. "Small things, made by hand, *lined up like tiny moons.*" Twelve pastries, six from Hana's kitchen and six from Yuki's counter, with tabs **All · Hana's kitchen · Yuki's counter · Seasonal** (the current season is marked *now*).

- Each card: picture, name, maker, Yuto's menu line, and the drink it belongs with
- **Me3temed's line** appears on hover (first tap on a phone); clicking opens the pastry with its pairing
- Until the pixel-art pictures exist, each pastry is drawn on a little plate (SVG, the `shape` field). To use a picture, put its Google Drive file id in the pastry's `image` field in `/admin` → `counter.pastries`
- Seasonal and occasion pastries: `counter.seasonal`
- Hana and Yuki know the counter too: in the 3D café they can talk about any pastry and this week's pairing

### 🍹 The Menu (drinks from the letters)
"Sixty-three drinks and counting." Every drink from the morning letters, sorted into **Spring · Summer · Autumn · Winter** tabs (it opens on Cairo's current season). Click a drink for its recipe in the same frame as Today's Café Story: ingredients, four steps, Me3temed's line, and the pastry it pairs with. Seven drinks have their full recipe on record so far; the rest point to their letter (and to Hana in the 3D café). To add a recipe, give the drink a `recipe` in `/admin` → `menu.drinks`:

```json
"recipe": { "ingredients": ["…"], "steps": ["…", "…", "…", "…"], "me3temed": "…", "pair": "…" }
```

### 📖 Our book on the shelf
*Thirteen Quiet Stories from a Café* is first on the bookshelf, on every tab, with the dedication, all thirteen stories, and a **Read on Kindle** button ([B0H1499X4M](https://www.amazon.com/dp/B0H1499X4M)). Edit `site.book`; add a Drive id as `cover` to replace the drawn cover.

### 🚪 Walk In
The hero button reads **Walk into the café →**, with "Make an avatar. Find Me3temed's shelf. Mariam's table is reserved." underneath on hover. The always-visible *Enter the 3D café* button stays at the top.

### 🌙 Dark mode
The whole site follows the visitor's system setting (`prefers-color-scheme`), with the same evening palette as the letters.

### 👥 Team Section (Bento Grid)
Four equal square cards for the café's imagined characters:

| Character | Role |
|-----------|------|
| **Me3temed** | Founder & Soul |
| **Yuto** | Founder & Soul |
| **Hana** | Head Barista |
| **Yuki** | Pastry Chef |

### 📖 Today's Café Story
- Floating pill button (bottom-right, always visible) with a pulsing dot
- Opens a full-screen modal overlay with blur backdrop
- Cover image + date auto-set to today
- Story text with italic dialogue styling
- Closes via ✕ button, clicking outside, or pressing `Escape`
- **Story updates daily** — just swap the image and text inside the modal

### 💌 Email Signup → Google Sheets
- Collects email addresses via a form in the bento card
- Submits to a **Google Apps Script web app** endpoint
- Emails are written to the Google Sheet starting from **cell A2**
- Duplicate emails are automatically skipped
- Shows a success state on submission (`🌸 You're in!`)

### 🌸 Falling Petals
- 18 petals (`🌸 🌷 🌺 ✿`) fall continuously in the background
- Each has a randomised size, speed, and delay
- Fully CSS animated, pointer-events disabled

---

## 🎨 Design System

### Colour Palette

| Variable | Hex | Use |
|----------|-----|-----|
| `--sakura` | `#f2a7bb` | Accents, highlights |
| `--sakura-light` | `#fde8ef` | Card backgrounds |
| `--sakura-dark` | `#d4678a` | Buttons, CTAs, headings |
| `--matcha` | `#7aab7a` | Secondary accent |
| `--matcha-dark` | `#4d7a4d` | Location badge, success states |
| `--cream` | `#fef9f5` | Page background |
| `--warm-white` | `#fffaf7` | Card backgrounds |
| `--text-dark` | `#2d1f1f` | Primary text, team section bg |

### Typography

| Font | Weight | Use |
|------|--------|-----|
| **Playfair Display** | 400 / 600 / 700 | Headings, card titles, story title |
| **Nunito** | 300 / 400 / 600 | Body text, labels, nav |
| **Dancing Script** | 500 / 700 | Signatures, quotes, subtitles |

---

## 💌 Letter signups

Signups go to `/api/subscribe` and are stored in the `subscribers` table (export from `/admin` as CSV). If `APPS_SCRIPT_URL` is set on Railway, the server also forwards each new address to that Apps Script, so the Google Sheet the SendGrid sender reads stays in step. If the page is ever served without the API (static hosting), it falls back to posting straight to the Apps Script.

---

## 🔄 Updating the Daily Story

Open `/admin` → `story.today` and edit:

```json
{
  "title": "Your New Story Title",
  "image": "GOOGLE_DRIVE_FILE_ID (or a full https:// URL)",
  "paragraphs": [
    "First paragraph. *Italic words* like this.",
    "{{Spoken dialogue,}} she says. {{Like this.}}"
  ]
}
```

Save, and the modal changes for everyone straight away. The date still comes from the visitor's clock. Older versions are kept under **History**.

---

## 🖼️ Images

All images are hosted on **Google Drive** and embedded via the thumbnail URL format:

```
https://drive.google.com/thumbnail?id=FILE_ID&sz=w600
```

> ⚠️ For images to load, each Drive file must be set to **"Anyone with the link can view"** in sharing settings.

| Image | Drive ID |
|-------|----------|
| Hero (café opening) | `1hT-lTkfD3vttM9saWi2GTqza7LAlYefl` |
| Logo | `12VAuqDh5TvAk7vhlrkdd1vTVl2ojpwAh` |
| Me3temed | `1WjlhucHGTK75ByZEb_I2MXO9MG5-Pp1N` |
| Yuto | `1HJjnvzVXNOPEd9S3TI1X_Yp-xY4M_5Cf` |
| Hana | `1VcJRZFXh402vvlGJGc0vJFyXgal83iiL` |
| Yuki | `18pk52yPotIv8ODgDXNBdsDVt_VbJ9vBY` |
| Eid Story Cover | `1DZ9YH1wtwJTIVBHLDypoWYzqd7507hc0` |

---

## 🔗 Links

- 📸 Instagram — [@sakuraslicecafe](https://www.instagram.com/sakuraslicecafe/)
- 📊 Email Sheet — [Google Sheets](https://docs.google.com/spreadsheets/d/1viC4AIitIfWCq6tsPGuCEI1oj-qbnEHP-W-9wN6ie7Y)

---

## 🧠 Tech Stack

```
HTML / CSS / vanilla JS  → The website and the café UI
Three.js (r169, via npm) → The 3D café
Web Audio API            → The generated soundscape — no audio files
Claude API               → The team's conversations, drink recommendations and memory
Node.js + Express        → Server and /api
ws                       → Live presence, chat and note broadcasts
PostgreSQL (Railway)     → Accounts, notes, chat, guestbook, subscribers, all site content
bcryptjs                 → Password hashing
Google Drive             → Image hosting
Apps Script + SendGrid   → The morning & night emails (Sheet kept in sync)
```

---

<div align="center">

*© 2024 Ahmed El-Bourgy &nbsp;·&nbsp; Made with 🌸 & matcha*

</div>
