// Keeping the café kind. Everything a guest writes for others to read (the
// chat, notes on the walls, the Table Four guestbook, names of people and
// groups) and everything they say to the team is checked before it goes up:
//
// 1. A quick word list — the obvious slurs and swearing, in English, Arabic
//    and Franco-Arabic. Works even without an API key.
// 2. Claude, for everything the list can't see: insults without bad words,
//    bullying, threats, hate, sexual remarks, mocking someone. Being sad,
//    tired or angry at the world is fine — the café is for that too.
//
// If Claude can't be reached in time, the message goes through on the word
// list alone, so the café never stops working.

const Anthropic = require('@anthropic-ai/sdk');
const { query } = require('./db');

const MODEL = process.env.MODERATION_MODEL || 'claude-haiku-5-5';
const TIMEOUT = Number(process.env.MODERATION_TIMEOUT_MS || 6000);
const OFF = process.env.MODERATION === 'off';

// ── 1. the word list
// Letters people swap in to get past filters: f*ck, sh1t, a$$, b!tch…
const SWAPS = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i' };
function normalise(text) {
  return String(text).toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[01345789@$!|]/g, c => SWAPS[c])
    .replace(/[*_.\-~]+/g, '')     // f.u.c.k, f*ck → fuck / fck
    .replace(/(\p{L})\1{2,}/gu, '$1$1'); // fuuuuck → fuuck
}
// Words that need context (a finger prick, Moby Dick, a history lesson) are left to Claude.
// Franco-Arabic keeps its numbers (3 = ع, 7 = ح), so it is checked on the raw text.
const EN = [
  'fuck', 'fck', 'fuk', 'fuuck', 'motherfucker', 'shit', 'bullshit', 'bitch', 'cunt', 'asshole', 'arsehole', 'bastard',
  'dickhead', 'pussy', 'whore', 'slut', 'faggot', 'nigger', 'nigga', 'retard', 'retarded', 'twat',
  'wanker', 'kys', 'kill yourself', 'go die', 'kill urself', 'neck yourself', 'porn', 'tranny', 'chink', 'kike',
];
const FRANCO = ['a7a', 'kos omak', 'kosomak', 'kos ommak', 'sharmoota', 'sharmota', 'sharmoot', 'khawal', 'metnak', 'mitnak', 'manyak', 'manyok', '3ars', 'yel3an', 'yela3n', 'zeby', 'zebi'];
const AR = ['كس', 'كسمك', 'كس امك', 'شرموط', 'شرموطة', 'خول', 'متناك', 'منيوك', 'عرص', 'يلعن', 'زبي', 'زب', 'طيز', 'احا', 'وسخة', 'قحبة', 'لبوة'];
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const words = list => new RegExp(`(^|[^\\p{L}\\p{N}])(${list.map(esc).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'iu');
const EN_RE = words(EN), FRANCO_RE = words(FRANCO), AR_RE = words(AR);

function wordList(text) {
  const n = normalise(text);
  return EN_RE.test(n) || EN_RE.test(n.replace(/\s+/g, ' ')) || FRANCO_RE.test(String(text).toLowerCase()) || AR_RE.test(String(text));
}

// ── 2. Claude
let client = null;
function claude() {
  if (!client) {
    const ws = (process.env.ANTHROPIC_WORKSPACE_ID || '').trim();
    client = new Anthropic({ timeout: TIMEOUT, maxRetries: 1, ...(ws ? { defaultHeaders: { 'anthropic-workspace-id': ws } } : {}) });
  }
  return client;
}

const PLACES = {
  chat: 'a message in the café\'s public chat, read by everyone in the room',
  note: 'a note pinned on the café wall or board, seen by every visitor',
  guestbook: 'a line in the Table Four guestbook on the café\'s website',
  name: 'the name a guest shows to everyone in the café',
  group: 'the name or description of a group of friends',
  npc: 'a message a guest is saying to one of the café\'s staff characters (Hana, Yuki, Yuto or Me3temed)',
};

const SYSTEM = `You keep Sakura Slice Café kind. It is a cozy, imagined café in Cairo and a small online community whose whole purpose is to make people feel better about the world and themselves. Guests write in English, Arabic, Egyptian Franco-Arabic (3 = ع, 7 = ح, 2 = ء), Japanese, or a mix.

Decide whether a piece of text may be shown. Block it if it is hurtful or rude to anyone — the reader, another guest, the staff, or a group of people:
- insults, name-calling, mocking, belittling or bullying, even without swear words ("you're pathetic", "nobody likes you", "shut up loser")
- swearing and vulgarity, including disguised spellings
- hate or contempt for people because of who they are (religion, nationality, race, gender, sexuality, disability, looks, age)
- threats, wishing harm, telling someone to hurt or kill themselves
- sexual remarks or harassment
- cruel jokes at someone's expense, or content meant to upset or shock

Allow everything else, generously. In particular, allow:
- sadness, loneliness, stress, grief, frustration about life, work, exams or the world — guests come here when they are struggling, and saying so is welcome, never block it
- disagreement and honest opinions said without contempt
- gentle, clearly friendly teasing
- talk about hard topics in a caring way

When in doubt about something that is merely blunt, allow it. When in doubt about something that could hurt someone, block it.
Answer only by calling the verdict tool.`;

const TOOL = {
  name: 'verdict',
  description: 'Whether the text may be shown in the café.',
  input_schema: {
    type: 'object',
    properties: {
      allowed: { type: 'boolean' },
      category: { type: 'string', enum: ['ok', 'insult', 'bullying', 'swearing', 'hate', 'threat', 'self_harm_push', 'sexual', 'cruel', 'other'] },
      reason: { type: 'string', description: 'A few words on why, for the café owner.' },
    },
    required: ['allowed', 'category'],
  },
};

const cache = new Map(); // text → verdict, so the same line isn't asked twice
function remember(key, v) {
  if (cache.size > 3000) cache.delete(cache.keys().next().value);
  cache.set(key, v);
}

async function askClaude(text, where) {
  const res = await claude().messages.create({
    model: MODEL,
    max_tokens: 200,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: 'verdict' },
    messages: [{ role: 'user', content: `Where it will appear: ${PLACES[where] || where}.\n\n<text>\n${text}\n</text>` }],
  });
  const use = (res.content || []).find(c => c.type === 'tool_use');
  if (!use) return null;
  return { allowed: use.input.allowed !== false, category: use.input.category || 'other', reason: String(use.input.reason || '').slice(0, 200) };
}

// The words people see when something isn't let through — gentle, not scolding.
const SAY = {
  chat: 'That one might sting someone. Try saying it more gently 🌸',
  note: 'This note might hurt someone who reads it. The walls here are for kind words 🌸',
  guestbook: 'Let\'s keep Table Four kind 🌸',
  name: 'Please choose a kinder name 🌸',
  group: 'Please choose a kinder name and description for the group 🌸',
  npc: null, // the team answer in character (see npc.js)
};

/**
 * check(text, where, user) → { ok: true } or { ok: false, message, category }
 * where: chat | note | guestbook | name | group | npc
 */
async function check(text, where, user) {
  const t = String(text || '').trim();
  if (OFF || !t) return { ok: true };
  let verdict = null;
  if (wordList(t)) verdict = { allowed: false, category: 'swearing', reason: 'word list', source: 'list' };
  else {
    const key = where + '\u0000' + t.toLowerCase();
    if (cache.has(key)) verdict = cache.get(key);
    else if (process.env.ANTHROPIC_API_KEY) {
      try {
        verdict = await askClaude(t, where);
        if (verdict) { verdict.source = 'claude'; remember(key, verdict); }
      } catch (e) {
        console.warn('moderation: Claude unavailable, the word list decided:', e.message);
      }
    }
  }
  if (!verdict || verdict.allowed) return { ok: true };
  query('INSERT INTO moderation_log (user_id, place, text, category, reason, source) VALUES ($1, $2, $3, $4, $5, $6)',
    [user ? user.id : null, where, t.slice(0, 1000), verdict.category, verdict.reason || '', verdict.source || ''])
    .catch(e => console.warn('moderation: could not log:', e.message));
  return { ok: false, message: SAY[where] || SAY.chat, category: verdict.category };
}

// Express helper: 422 with the gentle message when it isn't let through.
async function guard(res, text, where, user) {
  const r = await check(text, where, user);
  if (r.ok) return true;
  res.status(422).json({ error: r.message, moderated: true });
  return false;
}

module.exports = { check, guard, wordList, normalise };
