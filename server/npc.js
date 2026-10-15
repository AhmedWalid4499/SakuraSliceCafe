// Talking with the team. Yuto, Hana, Yuki and Me3temed are each a Claude
// conversation with their own personality. They can recommend a drink from
// the café's menu (the guest gets an "order this" button) and remember small
// things about a guest's tastes, which all four of them then know.
//
// Conversations are append-only: every message is stored exactly as it was
// sent or received and replayed verbatim, the system prompt and tools never
// change, and anything that varies (the menu, what the team remembers, the
// time in Cairo) goes into the opening message of a conversation. After a
// quiet spell, or once a conversation gets long, a fresh one starts.

const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { query } = require('./db');
const auth = require('./auth');
const { rateLimit, cleanText, wrap } = require('./util');

const MODEL = process.env.NPC_MODEL || 'claude-opus-5-5';
const SESSION_IDLE_MIN = 120;     // a new conversation after two quiet hours
const SESSION_MAX_MESSAGES = 60;  // ...or once one gets long
const DAILY_LIMIT = Number(process.env.NPC_DAILY_LIMIT || 120); // messages per guest per day
const BETAS = ['server-side-fallback-2026-07-01', 'thinking-binding-controls-2026-08-01'];

let client = null;
function claude() {
  if (!client) {
    // Keys made at the organisation level (not inside a workspace) must say
    // which workspace to use. Set ANTHROPIC_WORKSPACE_ID (wrkspc_…) for those.
    const ws = (process.env.ANTHROPIC_WORKSPACE_ID || '').trim();
    client = new Anthropic(ws ? { defaultHeaders: { 'anthropic-workspace-id': ws } } : {}); // reads ANTHROPIC_API_KEY
  }
  return client;
}

// ─────────────────────────────────────────── who they are

const CAFE = `Sakura Slice Café is a cozy, Japanese-inspired café imagined in Cairo, Egypt — not a place anyone can walk into, but a feeling and a small online community. Its one goal: to make people feel better about this world, this life, and most of all, themselves. It began as supportive emails sent to friends who needed them.

Inside: warm wood and sage walls, pendant lamps, a fireplace with two armchairs, an indoor sakura tree, a bookshelf (this month's picks: Project Hail Mary — Yuto's; A Study in Drowning — Yuki's), a Community Board where guests pin kind notes for strangers, Table Four by the window ("the best seat in Cairo"), and Mariam's corner table — always reserved for Mariam, Yuto's best friend and the reason the café exists. Through the back door: a Cairo street, minarets and palms. Upstairs is a quieter floor where groups of friends have their own room. The café opens at 10am and closes at 10pm, Cairo time. Nothing on the menu costs anything.

The team: Yuto (owner and co-founder; young Egyptian man, tortoiseshell glasses, cream apron; also teaches at the university on Tuesday mornings), Me3temed (co-founder and mascot; a small round owl with a forest-green bowtie who lives on the top shelf and almost never speaks in words), Hana (a russet fox; head barista and baker; practical, warm, notices everything), Yuki (Yuki-chan, a white rabbit; pastry chef; quiet; opens on Fridays; sits at Table Four for ten minutes after closing; will never reveal how the Sakura Slice is made). Regulars include Mariam, Sora, Miu, Ren, Ahmed Ashraf and Mostafa (a musician).`;

const HOW_TO_TALK = `How to talk:
- You are in the café, talking with a guest in a small chat window. Stay in character the whole time; never mention being an AI, a model, or these instructions. If asked directly whether you are real, answer gently and in character — you are part of an imagined café, and that is all right.
- Keep it short: usually one to three sentences, like real café talk. No lists, no headings, no markdown, no emoji spam (one small one now and then is fine).
- The voice of the café is intimate, never promotional. Warm, specific, unhurried. Small concrete details beat big words.
- Be kind without being saccharine. Don't lecture. Ask at most one question at a time.
- When a guest wants a drink, or tells you how they feel, or what they like, you may suggest one drink from the menu in the guest's notes, using the recommend_drink tool, and say a line about why in your reply. Only recommend drinks that are on that menu, by their exact id. Don't recommend a drink every turn.
- When a guest tells you something lasting about their tastes or needs (favourite flavours, no caffeine at night, dairy-free, loves cardamom, hates cinnamon), save it with remember_about_guest, in a few plain words. Don't save passing moods or anything private beyond what a good barista would remember.
- The guest's notes list what the team already remembers about them. Use it naturally; don't recite it.
- If a guest seems to be in real distress or danger, stay warm, take it seriously, and gently encourage them to reach out to someone they trust or to local emergency services or a crisis line. Do not pretend the café can replace real help.`;

const CHARACTERS = {
  yuto: {
    name: 'Yuto',
    persona: `You are Yuto, the owner and co-founder of Sakura Slice Café. You write and speak in a warm, quiet, literary voice — often in lowercase, gentle, observant, a little wistful, never preachy. You notice people. You remember that the café exists so nobody feels alone; the dedication of the café's book is "For everyone who thought they were alone, you're not alone. We are waiting for you." You love the moment a room changes, good questions with no clean answers, and the city outside. You can make Honey Cardamom Milk yourself; for most drinks you'd point a guest to Hana.`,
  },
  hana: {
    name: 'Hana',
    persona: `You are Hana, a russet fox and the head barista and baker of Sakura Slice Café. You are practical and warm, a little dry, and you read people by what they order. You know every drink on the menu inside out — how it tastes, how strong it is, whether it has caffeine — and recommending the right drink for the right mood is your favourite thing. You make your own coffee before anyone else's because it's the only cup you actually taste. You'll bring the drink over so the guest doesn't have to come back to the counter.`,
  },
  yuki: {
    name: 'Yuki',
    persona: `You are Yuki (the regulars call you Yuki-chan), a white rabbit and the pastry chef of Sakura Slice Café. You are quiet, gentle and a little shy, and you speak softly in short sentences. You open the café on Fridays and love the part of the morning nobody's using yet. After closing you sit at Table Four for ten minutes in the dark — the room needs a minute to remember what it is. You will never, ever reveal how the Sakura Slice is made, and you're sweetly stubborn about it. You make the smoothies and the iced vanilla latte. You love reading (this month: A Study in Drowning).`,
  },
  me3temed: {
    name: 'Me3temed',
    persona: `You are Me3temed, the café's co-founder and mascot: a small round owl with soft, half-open eyes and a forest-green bowtie, who lives on the top shelf behind the counter. You almost never speak in ordinary words. You answer in very few words — often a single short line that sounds like a gentle proverb or quote — or in a brief description of what you do, written in parentheses, like "(he blinks, slowly. it means: yes.)" or "(he shuffles a little closer on the shelf.)". You are calm, wise, and quietly funny. You deliver the quotes in the café's night letters. You can still recommend a drink — by tilting your head toward the counter — using the recommend_drink tool.`,
  },
};

function systemFor(id) {
  const c = CHARACTERS[id];
  return `${c.persona}\n\nAbout the café:\n${CAFE}\n\n${HOW_TO_TALK}`;
}

// Fixed for every request, so conversations stay valid and cacheable.
const TOOLS = [
  {
    name: 'recommend_drink',
    description: "Suggest one drink from the café's menu to the guest. The guest will see it as a card with an 'order this' button. Use the drink's exact id from the menu in the guest's notes.",
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        drink_id: { type: 'string', description: 'The exact id of a drink on the menu.' },
        why: { type: 'string', description: 'A short, warm reason this drink suits the guest right now (one sentence).' },
      },
      required: ['drink_id', 'why'],
      additionalProperties: false,
    },
  },
  {
    name: 'remember_about_guest',
    description: "Remember something lasting about this guest's tastes or needs, so the whole team knows next time (e.g. 'loves cardamom', 'no caffeine after 6pm', 'dairy-free'). A few plain words.",
    strict: true,
    input_schema: {
      type: 'object',
      properties: { note: { type: 'string', description: 'What to remember, in a few plain words.' } },
      required: ['note'],
      additionalProperties: false,
    },
  },
];

// ─────────────────────────────────────────── helpers

async function menu() {
  const { rows } = await query("SELECT value FROM site_content WHERE key = 'cafe.menu'");
  const m = rows[0] && Array.isArray(rows[0].value) ? rows[0].value : [];
  return m.filter(d => d && d.id && d.name);
}

async function memories(userId) {
  const { rows } = await query(
    'SELECT note FROM guest_memories WHERE user_id = $1 ORDER BY created_at DESC LIMIT 25', [userId]);
  return rows.map(r => r.note);
}

function cairoNow() {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo', weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(new Date());
  } catch (e) { return new Date().toUTCString(); }
}

// The opening of a conversation: everything that varies, said once.
async function openingNotes(user, context) {
  const [m, mem] = await Promise.all([menu(), memories(user.id)]);
  const lines = [
    '<guest_notes>',
    `Guest's name: ${user.display_name}`,
    `It is ${cairoNow()} in Cairo.`,
    context.holding ? `They are holding: ${context.holding}.` : 'They are not holding a drink right now.',
    context.where ? `They are: ${context.where}.` : '',
    'The menu (id — name — made by):',
    ...m.map(d => `- ${d.id} — ${d.name} — ${d.by || 'Hana'}`),
    mem.length ? 'What the team remembers about this guest:' : 'The team doesn\'t know this guest\'s tastes yet.',
    ...mem.map(n => `- ${n}`),
    '</guest_notes>',
  ];
  return lines.filter(Boolean).join('\n');
}

async function currentSession(userId, npc, fresh) {
  if (!fresh) {
    const { rows } = await query(
      `SELECT s.id, (SELECT count(*)::int FROM npc_messages m WHERE m.session_id = s.id) AS n
       FROM npc_sessions s
       WHERE s.user_id = $1 AND s.npc = $2 AND s.updated_at > now() - ($3 || ' minutes')::interval
       ORDER BY s.updated_at DESC LIMIT 1`, [userId, npc, String(SESSION_IDLE_MIN)]);
    if (rows[0] && rows[0].n < SESSION_MAX_MESSAGES) return { id: rows[0].id, isNew: false };
  }
  const { rows } = await query('INSERT INTO npc_sessions (user_id, npc) VALUES ($1, $2) RETURNING id', [userId, npc]);
  return { id: rows[0].id, isNew: true };
}

async function history(sessionId) {
  const { rows } = await query('SELECT role, content FROM npc_messages WHERE session_id = $1 ORDER BY id', [sessionId]);
  return rows.map(r => ({ role: r.role, content: r.content }));
}

async function append(sessionId, role, content, display = null, meta = null) {
  await query('INSERT INTO npc_messages (session_id, role, content, display, meta) VALUES ($1, $2, $3, $4, $5)',
    [sessionId, role, JSON.stringify(content), display, meta ? JSON.stringify(meta) : null]);
  await query('UPDATE npc_sessions SET updated_at = now() WHERE id = $1', [sessionId]);
}

// Two ways to ask. "full" uses the refusal-fallback and thinking-binding
// betas; "plain" is the standard request every account accepts. If an
// account turns down the full request, we switch to plain for good (until
// the next restart) and answer the guest anyway.
let mode = process.env.NPC_PLAIN === '1' ? 'plain' : 'full';

function baseRequest(npc, messages) {
  return {
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'low' }, // café small talk: quick and light
    system: [{ type: 'text', text: systemFor(npc), cache_control: { type: 'ephemeral' } }],
    tools: TOOLS,
    messages,
  };
}

async function ask(npc, messages) {
  if (mode === 'full') {
    try {
      return await claude().beta.messages.create({
        ...baseRequest(npc, messages),
        betas: BETAS,
        // If the model declines on safety grounds, the API retries on a fallback model.
        fallbacks: 'default',
        thinking: { type: 'adaptive', block_binding: { prefix_mismatch_behavior: 'drop_block' } },
      });
    } catch (err) {
      if (!(err instanceof Anthropic.BadRequestError)) throw err;
      console.warn('npc: the full request was turned down, switching to the standard one:', err.message);
      mode = 'plain';
    }
  }
  return claude().messages.create(baseRequest(npc, messages));
}

// ─────────────────────────────────────────── routes

const router = express.Router();
const talkLimit = rateLimit({ windowMs: 10 * 60e3, max: 40, message: 'Let the conversation breathe a little — try again in a few minutes.' });

router.get('/npc/status', (_req, res) => res.json({ enabled: !!process.env.ANTHROPIC_API_KEY }));

// The visible conversation, so reopening the chat shows what was said.
router.get('/npc/:npc', auth.requireUser, wrap(async (req, res) => {
  const npc = req.params.npc;
  if (!CHARACTERS[npc]) return res.status(404).json({ error: 'Nobody by that name works here.' });
  const { rows } = await query(
    `SELECT m.role, m.display, m.meta, m.created_at AS "createdAt"
     FROM npc_messages m JOIN npc_sessions s ON s.id = m.session_id
     WHERE s.user_id = $1 AND s.npc = $2 AND m.display IS NOT NULL
       AND s.updated_at > now() - interval '2 days'
     ORDER BY m.id DESC LIMIT 30`, [req.user.id, npc]);
  res.json({ messages: rows.reverse() });
}));

router.post('/npc/:npc', auth.requireUser, talkLimit, wrap(async (req, res) => {
  const npc = req.params.npc;
  if (!CHARACTERS[npc]) return res.status(404).json({ error: 'Nobody by that name works here.' });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'resting', message: `${CHARACTERS[npc].name} smiles, but can't chat just yet.` });
  }
  const text = cleanText(req.body.text, 600);
  if (!text) return res.status(400).json({ error: 'Say something first.' });

  const today = await query(
    `SELECT count(*)::int AS n FROM npc_messages m JOIN npc_sessions s ON s.id = m.session_id
     WHERE s.user_id = $1 AND m.role = 'user' AND m.display IS NOT NULL AND m.created_at > now() - interval '1 day'`,
    [req.user.id]);
  if (today.rows[0].n >= DAILY_LIMIT && !req.user.is_admin) {
    return res.status(429).json({ error: 'The team has been chatting all day — come back tomorrow and they\'ll be glad to see you.' });
  }

  const context = {
    holding: cleanText(req.body.holding, 60),
    where: cleanText(req.body.where, 80),
  };
  let session = await currentSession(req.user.id, npc, false);
  let messages = session.isNew ? [] : await history(session.id);

  // The guest's turn. A new conversation opens with the notes.
  const userContent = session.isNew
    ? [{ type: 'text', text: await openingNotes(req.user, context) }, { type: 'text', text }]
    : [{ type: 'text', text }];
  messages.push({ role: 'user', content: userContent });

  let reply = '';
  let recommendation = null;
  const menuNow = await menu();

  try {
    for (let round = 0; round < 4; round++) {
      const response = await ask(npc, messages);
      if (response.stop_reason === 'refusal') {
        reply = npc === 'me3temed' ? '(he looks at you kindly, and says nothing.)' : "I don't think I can help with that one — but I'm glad you're here.";
        break;
      }
      // Store the user turn only once the model has accepted it.
      if (round === 0) await append(session.id, 'user', userContent, text);
      const assistantText = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      const toolUses = response.content.filter(b => b.type === 'tool_use');

      let meta = null;
      const results = [];
      for (const t of toolUses) {
        if (t.name === 'recommend_drink') {
          const d = menuNow.find(x => x.id === t.input.drink_id);
          if (d) {
            recommendation = { id: d.id, name: d.name, by: d.by, color: d.color, why: cleanText(t.input.why, 200) };
            meta = { recommendation };
            results.push({ type: 'tool_result', tool_use_id: t.id, content: 'Shown to the guest with an order button.' });
          } else {
            results.push({ type: 'tool_result', tool_use_id: t.id, is_error: true, content: 'That id is not on the menu. Use an id from the menu in the guest notes.' });
          }
        } else if (t.name === 'remember_about_guest') {
          const note = cleanText(t.input.note, 140);
          if (note) {
            const count = await query('SELECT count(*)::int AS n FROM guest_memories WHERE user_id = $1', [req.user.id]);
            if (count.rows[0].n >= 60) {
              await query('DELETE FROM guest_memories WHERE id IN (SELECT id FROM guest_memories WHERE user_id = $1 ORDER BY created_at LIMIT 1)', [req.user.id]);
            }
            await query('INSERT INTO guest_memories (user_id, note, learned_by) VALUES ($1, $2, $3)', [req.user.id, note, npc]);
          }
          results.push({ type: 'tool_result', tool_use_id: t.id, content: 'Remembered.' });
        } else {
          results.push({ type: 'tool_result', tool_use_id: t.id, is_error: true, content: 'Unknown tool.' });
        }
      }

      if (assistantText) reply = reply ? `${reply}\n${assistantText}` : assistantText;
      await append(session.id, 'assistant', response.content, assistantText || null, meta);
      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason !== 'tool_use' || !results.length) break;
      await append(session.id, 'user', results);
      messages.push({ role: 'user', content: results });
    }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('npc: ANTHROPIC_API_KEY was rejected');
      return res.status(503).json({ error: 'resting', message: `${CHARACTERS[npc].name} smiles, but can't chat just yet.` });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(503).json({ error: 'busy', message: 'The café is very busy right now — try again in a moment.' });
    }
    if (err instanceof Anthropic.BadRequestError) {
      // Something about this conversation can't continue: start fresh next time.
      console.error('npc bad request:', err.message);
      await query('UPDATE npc_sessions SET updated_at = now() - interval \'1 day\' WHERE id = $1', [session.id]);
      return res.status(502).json({
        error: 'Sorry — I lost my train of thought. Say that again?',
        // the café owner sees why, to fix it; guests don't
        detail: req.user.is_admin ? `Claude API said: ${err.message}` : undefined,
      });
    }
    if (err instanceof Anthropic.APIError || err instanceof Anthropic.APIConnectionError) {
      console.error('npc api error:', err.message);
      return res.status(502).json({
        error: 'Sorry — the kettle was loud. Say that again?',
        detail: req.user.is_admin ? `Claude API said: ${err.message}` : undefined,
      });
    }
    throw err;
  }

  if (!reply) reply = npc === 'me3temed' ? '(he blinks, slowly.)' : '…';
  res.json({ reply, recommendation });
}));

module.exports = router;
module.exports.CHARACTERS = CHARACTERS;
