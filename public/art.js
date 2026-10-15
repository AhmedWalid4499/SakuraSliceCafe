// Little drawn pictures of the café's pastries and drinks, shared by the
// website and the 3D café until the pixel-art pictures are on Drive.
// A plain script (not a module) so both pages can load it: window.SakuraArt.
(function () {
  const PLATE = '<ellipse cx="100" cy="112" rx="78" ry="17" fill="#e9dccb"/><ellipse cx="100" cy="108" rx="78" ry="17" fill="#fffaf2"/><ellipse cx="100" cy="108" rx="58" ry="11" fill="none" stroke="#efe2d0" stroke-width="2"/>';
  const dots = (pts, c, r = 1.6) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('');
  const SHAPES = {
    slice: `<path d="M48 96 L150 96 L150 74 L48 74 Z" fill="#fff4f0"/><path d="M48 86 L150 86 L150 80 L48 80 Z" fill="#f5a8b8"/><path d="M48 74 L150 74 L150 68 L48 68 Z" fill="#fbe0e6"/><path d="M48 96 L150 96 L150 92 L48 92 Z" fill="#f0d8c6"/>${[0,72,144,216,288].map(a => `<ellipse cx="99" cy="57" rx="5" ry="8" fill="#f2a7bb" transform="rotate(${a} 99 64)"/>`).join('')}<circle cx="99" cy="64" r="3" fill="#d4678a"/>`,
    domes: [62, 100, 138].map(x => `<path d="M${x-17} 100 Q${x-17} 72 ${x} 72 Q${x+17} 72 ${x+17} 100 Z" fill="#fffdf9" stroke="#eadfd2"/><path d="M${x-10} 92 Q${x} 78 ${x+10} 92 M${x-6} 86 L${x+6} 86 M${x} 80 L${x} 96" stroke="#e3d3c2" stroke-width="1.5" fill="none"/>${dots([[x-8,79],[x+7,83],[x-2,75],[x+11,92],[x-12,93]], '#ffffff', 1.4)}`).join(''),
    square: `<path d="M62 100 L138 100 L138 70 L62 70 Z" fill="#e8b45c"/><path d="M62 70 L138 70 L138 64 L62 64 Z" fill="#8fbf6a"/><path d="M62 100 L138 100 L138 95 L62 95 Z" fill="#cf9640"/>${dots([[75,82],[90,88],[110,79],[124,90],[98,76]], '#d7a24e', 1.3)}<ellipse cx="100" cy="60" rx="8" ry="4.5" fill="#f3e2c4" stroke="#d8c09a"/>`,
    cookies: [100, 92, 84, 76].map((y, i) => `<ellipse cx="${100 + (i % 2 ? 4 : -3)}" cy="${y}" rx="40" ry="10" fill="${i % 2 ? '#e2b77a' : '#d9a865'}" stroke="#c48f4c"/>`).join('') + dots([[82,74],[95,71],[110,73],[118,77],[88,79],[103,78],[74,77],[124,74]], '#fff6e2', 1.5),
    nest: `<ellipse cx="100" cy="88" rx="44" ry="18" fill="#e3a23f"/>${Array.from({length: 18}, (_, i) => { const a = i / 18 * Math.PI * 2; return `<path d="M${100 + Math.cos(a) * 26} ${88 + Math.sin(a) * 10} q${Math.cos(a + 1) * 12} ${Math.sin(a + 1) * 6} ${Math.cos(a) * 16} ${Math.sin(a) * 7}" stroke="#c97f22" stroke-width="2" fill="none"/>`; }).join('')}<ellipse cx="100" cy="83" rx="25" ry="10" fill="#b98a62"/><ellipse cx="96" cy="80" rx="15" ry="5" fill="#cfa47c"/><path d="M84 80 q8 6 16 0 q8 -6 16 2" stroke="#f3c64f" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    melonpan: `<path d="M56 100 Q56 58 100 58 Q144 58 144 100 Z" fill="#f2c56a"/><clipPath id="mpc"><path d="M56 100 Q56 58 100 58 Q144 58 144 100 Z"/></clipPath><g clip-path="url(#mpc)" stroke="#d99e3a" stroke-width="2">${[70, 85, 100, 115, 130].map(x => `<line x1="${x - 20}" y1="100" x2="${x + 20}" y2="58"/><line x1="${x + 20}" y1="100" x2="${x - 20}" y2="58"/>`).join('')}</g>${dots([[80,72],[100,66],[120,74],[92,84],[112,86]], '#fff3d6', 1.4)}`,
    daifuku: `<ellipse cx="100" cy="86" rx="34" ry="24" fill="#f7c3cf"/><ellipse cx="90" cy="76" rx="12" ry="6" fill="#fde3ea"/><path d="M100 60 q8 -9 12 0 q-6 6 -12 0 Z" fill="#e7849f"/><path d="M80 98 q20 8 40 0" stroke="#eba7b7" stroke-width="1.5" fill="none"/>`,
    dorayaki: `<ellipse cx="100" cy="94" rx="44" ry="11" fill="#c9823f"/><ellipse cx="100" cy="88" rx="42" ry="6" fill="#7b3a35"/><ellipse cx="100" cy="80" rx="44" ry="12" fill="#d28d48"/><ellipse cx="100" cy="77" rx="40" ry="9" fill="#e0a35c"/><path d="M78 74 q4 14 2 22 M118 73 q3 10 0 16" stroke="#f0b93a" stroke-width="4" stroke-linecap="round" fill="none"/>`,
    anpan: `<path d="M56 100 Q56 62 96 62 L96 100 Z" fill="#b8763f"/><path d="M104 100 L104 62 Q144 62 144 100 Z" fill="#b8763f"/><path d="M104 100 L104 64 Q140 66 140 100 Z" fill="#f2deba"/><ellipse cx="122" cy="88" rx="12" ry="9" fill="#7c3f6a"/>${dots([[118,85],[125,90],[121,92]], '#a9668f', 1.3)}<ellipse cx="78" cy="68" rx="2.5" ry="1.5" fill="#fff4dc"/>`,
    shells: [64, 100, 136].map((x, i) => `<g transform="rotate(${(i - 1) * 8} ${x} 86)"><path d="M${x - 20} 90 Q${x - 22} 66 ${x} 66 Q${x + 22} 66 ${x + 20} 90 Q${x} 100 ${x - 20} 90 Z" fill="#f3cc6c"/>${[-12, -6, 0, 6, 12].map(d => `<path d="M${x} 94 L${x + d * 1.4} 70" stroke="#ddaa45" stroke-width="1.4"/>`).join('')}<path d="M${x - 15} 74 Q${x} 64 ${x + 15} 74" stroke="#fffbea" stroke-width="3" fill="none" opacity="0.9"/></g>`).join(''),
    waffle: `<rect x="62" y="64" width="76" height="40" rx="12" fill="#e5ad5a"/><g stroke="#c58a37" stroke-width="2">${[78, 92, 106, 120].map(x => `<line x1="${x}" y1="66" x2="${x}" y2="102"/>`).join('')}${[76, 88].map(y => `<line x1="64" y1="${y}" x2="136" y2="${y}"/>`).join('')}</g><path d="M74 64 q12 -12 26 -4 q14 -10 26 4 Z" fill="#a9cf86"/><path d="M106 52 q10 -8 18 -2 q-8 10 -18 2 Z" fill="#5a3826"/><path d="M107 52 L122 51" stroke="#7a5038" stroke-width="1"/>`,
    bites: [[70, 92], [100, 96], [130, 92], [85, 78], [115, 78]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13" fill="#e9cf9e"/>${dots([[x - 5, y - 4], [x + 4, y - 6], [x + 6, y + 3], [x - 3, y + 5], [x, y]], '#b9894b', 1.3)}`).join(''),
  };

  // The pastry on its plate. shape: slice, domes, square, cookies, nest,
  // melonpan, daifuku, dorayaki, anpan, shells, waffle, bites.
  function plateSVG(shape) {
    const body = SHAPES[shape] || SHAPES.daifuku;
    return `<svg viewBox="0 0 200 140" role="img" aria-hidden="true">${PLATE}${body}</svg>`;
  }

  function mix(hex, to, amt) {
    const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const a = /^#[0-9a-f]{6}$/i.test(hex) ? p(hex) : [217, 180, 143];
    const b = p(to);
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amt).toString(16).padStart(2, '0')).join('');
  }

  // warm (a cup on a saucer), iced (a tall glass with ice) or cold (a smoothie jar)
  function drinkTemp(d) {
    if (d.temp) return d.temp;
    const n = (d.name || '') + ' ' + (d.id || '');
    if (/smoothie|slush/i.test(n)) return 'cold';
    if (/iced|cold|lemonade|soda|cooler|fizz|spritzer|sparkl|refresher/i.test(n)) return 'iced';
    return 'warm';
  }

  function drinkSVG(d) {
    const c = /^#[0-9a-f]{6}$/i.test(d.color || '') ? d.color : '#d9b48f';
    const light = mix(c, '#ffffff', 0.55), deep = mix(c, '#000000', 0.18);
    const temp = drinkTemp(d);
    let body;
    if (temp === 'warm') {
      body = `<ellipse cx="100" cy="122" rx="62" ry="11" fill="#e9dccb"/><ellipse cx="100" cy="118" rx="60" ry="11" fill="#fffaf2"/>`
        + `<path d="M136 80 q22 2 18 18 q-4 12 -22 10" fill="none" stroke="#f4ece2" stroke-width="7" stroke-linecap="round"/>`
        + `<path d="M62 70 L138 70 L131 108 Q100 120 69 108 Z" fill="#fffaf4" stroke="#eadfd2" stroke-width="1.5"/>`
        + `<path d="M64 80 L136 80" stroke="#f2a7bb" stroke-width="5" opacity="0.8"/>`
        + `<ellipse cx="100" cy="70" rx="38" ry="8" fill="${deep}"/><ellipse cx="100" cy="70" rx="34" ry="6.5" fill="${c}"/>`
        + `<path d="M100 74 c-9 -6 -9 -12 -2 -12 c2 0 2 2 2 3 c0 -1 0 -3 2 -3 c7 0 7 6 -2 12 Z" fill="${light}"/>`
        + [84, 100, 116].map((x, i) => `<path d="M${x} 56 q-6 -8 0 -16 q6 -8 0 -16" fill="none" stroke="#d8cabd" stroke-width="2.5" stroke-linecap="round" opacity="${0.75 - i * 0.12}"/>`).join('');
    } else {
      const cold = temp === 'cold';
      const top = cold ? 50 : 58, w = cold ? 30 : 25;
      body = `<ellipse cx="100" cy="124" rx="40" ry="7" fill="#e9dccb" opacity="0.8"/>`
        + `<path d="M${100 - w - 3} 30 L${100 + w + 3} 30 L${100 + w - 3} 120 Q100 126 ${100 - w + 3} 120 Z" fill="#ffffff" fill-opacity="0.45" stroke="#d6dfe4" stroke-width="2"/>`
        + `<path d="M${100 - w - 1} ${top} L${100 + w + 1} ${top} L${100 + w - 4} 118 Q100 123 ${100 - w + 4} 118 Z" fill="${c}"/>`
        + `<path d="M${100 - w + 2} ${top + 6} L${100 - w + 6} 114" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.35"/>`
        + (cold
          ? `<path d="M${100 - w - 1} ${top} q8 -9 16 0 q8 -9 16 0 q8 -9 16 0 q8 -9 14 0 Z" fill="${light}"/>`
          : [[88, top + 10, 12], [106, top + 18, -10], [94, top + 32, 20]].map(([x, y, r]) => `<rect x="${x}" y="${y}" width="15" height="15" rx="3" fill="#ffffff" opacity="0.6" transform="rotate(${r} ${x + 7} ${y + 7})"/>`).join('')
            + `<ellipse cx="100" cy="${top}" rx="${w + 1}" ry="4" fill="${light}"/>`)
        + `<path d="M${cold ? 108 : 110} ${top + 30} L${cold ? 124 : 122} 14" stroke="#f2a7bb" stroke-width="6" stroke-linecap="round"/>`
        + (cold ? '' : `<path d="M${100 + w - 6} 32 a9 9 0 1 1 10 6" fill="#f3e27a" stroke="#e6c94a" stroke-width="1.5"/>`);
    }
    return `<svg viewBox="0 0 200 140" role="img" aria-hidden="true">${body}</svg>`;
  }

  window.SakuraArt = { plateSVG, drinkSVG, drinkTemp, shapes: Object.keys(SHAPES) };
})();
