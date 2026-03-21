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
sakura-slice/
│
├── sakura-slice-intro.html       ← The entire website (single file)
└── sakura-email-collector.gs     ← Google Apps Script for email collection
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
A 12-column asymmetric bento layout with 6 cards:

| Card | Description |
|------|-------------|
| 🌸 Tagline | The café's core feeling in a single quote |
| 📖 Story | The origin story — a dream born from longing |
| 💭 Imagined in Cairo | Not a real address, but a feeling |
| 🎐 The Vibe | Matcha, lo-fi, sakura, cozy corners |
| 🍃 Menu Peek | 6 featured items with a CTA to the email section |
| 💌 Morning & Evening Letters | Email signup wired to Google Sheets |

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
2. Create a new project and paste the contents of `sakura-email-collector.gs`
3. Click **Deploy → New deployment**
4. Set type to **Web app**, execute as **Me**, access **Anyone**
5. Copy the generated Web App URL

### Step 2 — Connect to the HTML

In `sakura-slice-intro.html`, find this line and replace the URL:

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
