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
├── index.html              ← The entire website (single file)
└── sakura-guestbook.gs     ← OPTIONAL Apps Script — makes Table Four shared
```

The whole site lives in **one self-contained HTML file** — no frameworks, no build tools, no dependencies beyond Google Fonts. Just vanilla HTML, CSS, and JavaScript.

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
A guestbook, seeded with five notes already "on the table."

- **Works with no backend** — notes are kept in the visitor's browser
- Held in memory as well as `localStorage`, so notes still appear in private windows and other storage-blocked contexts
- All note text is rendered with `textContent`, so pasted markup can never execute
- Optional: deploy `sakura-guestbook.gs` and set `GUESTBOOK_URL` to make the table **shared across all visitors**

### 🍵 The Menu
Its own full section, not a card. **No prices** — the café doesn't exist, so nothing costs anything.

- 16 items across Matcha & Tea, Coffee, Sweet, Savory — each with a description in the café's voice and who makes it
- **Every item has a real method.** A `How it's made` toggle opens step-by-step instructions — actual technique, written in the café's voice. Native `<details>`, no JavaScript.
- Two items answer in prose instead of steps: the **Sakura Slice** (Yuki won't say) and **Seasonal Something** (the recipe is written after the shopping)
- **"What do you need today?"** — six moods (tired, heartbroken, can't sleep, celebrating, overwhelmed, just arrived), each answered with a drink and a note from Hana. Edit the `MOODS` object.

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

## ⚙️ Google Apps Script Setup

The email signup requires a small backend to write to Google Sheets.

### Step 1 — Deploy the script

1. Go to [script.google.com](https://script.google.com)
2. Create a new project and paste your email-collector script
3. Click **Deploy → New deployment**
4. Set type to **Web app**, execute as **Me**, access **Anyone**
5. Copy the generated Web App URL

### Step 2 — Connect to the HTML

In `index.html`, find this line and replace the URL:

```js
const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
```

### How it works

```
User enters email → clicks Join
        ↓
fetch() POST → Apps Script Web App
        ↓
Script checks for duplicates in Column A
        ↓
Writes email to next empty row (starting A2)
        ↓
Returns success → page shows "🌸 You're in!"
```

> **Note:** The request uses `mode: 'no-cors'` so the browser can't read the response. The page optimistically shows success after the request fires.

---

## 🪑 Table Four Setup (optional)

Table Four works out of the box — notes are stored in each visitor's own browser. Deploy this only when you want **everyone to see the same notes**.

1. Make a Google Sheet, name the first tab **`TableFour`**, headers in row 1: `Timestamp | Name | Note`
2. Paste `sakura-guestbook.gs` into a new [script.google.com](https://script.google.com) project
3. Set `SHEET_ID` at the top of the script to your sheet's ID
4. **Deploy → New deployment → Web app**, execute as **Me**, access **Anyone**
5. Paste the URL into `index.html`:

```js
const GUESTBOOK_URL = 'https://script.google.com/macros/s/..../exec';
```

`doPost` appends a note; `doGet` returns the latest 60 as JSON. If the fetch fails for any reason, the card quietly falls back to the seed notes plus whatever this visitor wrote.

---

## 🔄 Updating the Daily Story

The story modal is designed to be updated every day. Here's what to change:

```html
<!-- 1. Swap the cover image src -->
<img class="story-cover"
  src="https://drive.google.com/thumbnail?id=YOUR_NEW_IMAGE_ID&sz=w1200"
  ...>

<!-- 2. Update the story title -->
<h2 class="story-title">Your New Story Title</h2>

<!-- 3. Replace the story paragraphs -->
<div class="story-text">
  <p>Your new story goes here...</p>
</div>
```

The date auto-generates from the user's system clock — no changes needed there.

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
HTML5          → Structure
CSS3           → Layout (bento grid, flexbox), animations, custom properties
Vanilla JS     → Petals, email submission, modal, date generation
Google Fonts   → Playfair Display, Nunito, Dancing Script
Google Drive   → Image hosting
Google Sheets  → Email collection backend
Apps Script    → Serverless POST endpoint
```

No frameworks. No build step. No node_modules. Just one file. 🌸

---

<div align="center">

*© 2024 Ahmed El-Bourgy &nbsp;·&nbsp; Made with 🌸 & matcha*

</div>
