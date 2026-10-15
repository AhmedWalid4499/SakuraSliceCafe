// The café's full drinks menu: the house drinks (site_content 'cafe.menu')
// plus every drink from the morning letters (site_content 'menu.drinks',
// the same list as the website). Shared by the 3D café and the server, so
// a drink's id is the same everywhere.

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

export function slug(name) {
  return String(name || '').toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

// What colour is it in the cup? The first ingredient that gives it away wins.
const COLOURS = [
  [/matcha/, '#8fbf6a'],
  [/hojicha/, '#a0714f'],
  [/taro/, '#b9a3cf'],
  [/lavender/, '#b8a6d9'],
  [/hibiscus|karkade|pomegranate/, '#c2405a'],
  [/cold brew|espresso|coffee/, '#7a4e33'],
  [/strawberry|watermelon/, '#ee8a99'],
  [/rose|sakura|cherry blossom/, '#f2a7bb'],
  [/blueberry/, '#7b6fb0'],
  [/mango|turmeric|golden|saffron/, '#f0b43c'],
  [/passion/, '#f0a830'],
  [/peach|apricot|cantaloupe/, '#f5b98a'],
  [/lemon|yuzu|lime|pineapple|grapefruit/, '#f3df7a'],
  [/mint|cucumber|basil|green apple|elderflower|thyme|rosemary/, '#bfe3b0'],
  [/jasmine|green tea/, '#cfe3a0'],
  [/caramel|brown sugar|cinnamon|maple|fig|cider|miso|ginger/, '#c8935a'],
  [/cardamom|chamomile|orange blossom|coconut|vanilla|almond|oat|pear|lychee|white grape|milk/, '#efe4cf'],
];
export function colourOf(name) {
  const n = String(name || '').toLowerCase();
  for (const [re, c] of COLOURS) if (re.test(n)) return c;
  return '#d9b48f';
}

// Who makes it: Yuki the cold, blended things; Yuto the warm milks; Hana the rest.
export function makerOf(d) {
  const n = String(d.name || '').toLowerCase();
  if (/smoothie|slush|float/.test(n)) return 'Yuki';
  if (/warm .*milk$|milk$/.test(n) && !/latte/.test(n)) return 'Yuto';
  return 'Hana';
}

export function fullMenu(house = [], letters = []) {
  const out = [];
  const seen = new Set();
  for (const d of Array.isArray(house) ? house : []) {
    if (!d || !d.id || !d.name) continue;
    out.push({ ...d, season: d.season || 'house' });
    seen.add(String(d.name).toLowerCase());
    seen.add(d.id);
  }
  for (const d of Array.isArray(letters) ? letters : []) {
    if (!d || !d.name) continue;
    const id = d.id || slug(d.name);
    if (seen.has(String(d.name).toLowerCase()) || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id, name: d.name, by: d.by || makerOf(d), color: d.color || colourOf(d.name),
      season: SEASONS.includes(d.season) ? d.season : 'house', temp: d.temp, mood: d.mood || '', recipe: d.recipe || null,
    });
  }
  return out;
}
