// The furniture catalogue for people's rooms upstairs: what there is, what
// it's called, its footprint, and the colours it comes in. Shared by the 3D
// café (public/cafe/home.js draws it) and the server (server/homes.js checks
// what's placed), so a kind means the same thing everywhere.
//
// w × d: footprint in metres (before turning). onTop: small things that can
// sit on a desk, a dresser or a shelf as well as on the floor. top: the height
// of a surface you can put things on. seats / lie: where you sit or lie.

export const ROOM_SIZE = { minX: -6, maxX: 6, minZ: -4.5, maxZ: 4.5, h: 3.2 };
export const MAX_ITEMS = 80;

export const WALLS = ['#efe6db', '#f3dfe3', '#dfe9dc', '#e1e7f0', '#f1e4c6', '#3b3f4a'];
export const FLOORS = ['oak', 'walnut', 'tatami', 'tile'];

const WOODS = ['#c9a27e', '#9a6a46', '#6e472e', '#f4ece0'];
const FABRICS = ['#f2a7bb', '#93ab8c', '#efe0c4', '#9fb8d6', '#c7605a', '#6f5f8f'];

export const FURNITURE = [
  // sleeping
  { kind: 'bed', name: 'Single bed', cat: 'sleep', w: 1.1, d: 2.1, colors: FABRICS, lie: [{ x: 0, z: 0.75 }], top: 0.55 },
  { kind: 'bed-double', name: 'Double bed', cat: 'sleep', w: 1.75, d: 2.15, colors: FABRICS, lie: [{ x: -0.42, z: 0.78 }, { x: 0.42, z: 0.78 }], top: 0.55 },
  { kind: 'futon', name: 'Floor futon', cat: 'sleep', w: 1.05, d: 2.05, colors: FABRICS, lie: [{ x: 0, z: 0.75 }], top: 0.16 },
  { kind: 'nightstand', name: 'Nightstand', cat: 'sleep', w: 0.46, d: 0.4, colors: WOODS, top: 0.56 },
  // studying
  { kind: 'desk', name: 'Desk', cat: 'study', w: 1.4, d: 0.7, colors: WOODS, top: 0.75, desk: true },
  { kind: 'desk-chair', name: 'Desk chair', cat: 'study', w: 0.55, d: 0.55, colors: FABRICS, seats: [{ x: 0, z: 0, h: 0.5 }] },
  { kind: 'laptop', name: 'Laptop', cat: 'study', w: 0.34, d: 0.25, colors: ['#c9ccd2', '#3a3d44', '#f2c6d0'], onTop: true, desk: true },
  { kind: 'desk-lamp', name: 'Desk lamp', cat: 'study', w: 0.2, d: 0.2, colors: ['#2f5d3a', '#f4ece0', '#d4678a'], onTop: true, light: true },
  { kind: 'bookshelf', name: 'Bookshelf', cat: 'study', w: 1.0, d: 0.34, colors: WOODS, top: 1.8 },
  // storing
  { kind: 'armoire', name: 'Armoire', cat: 'store', w: 1.2, d: 0.6, colors: WOODS.concat(['#93ab8c', '#f2a7bb']) },
  { kind: 'dresser', name: 'Dresser', cat: 'store', w: 1.1, d: 0.5, colors: WOODS.concat(['#93ab8c']), top: 0.86 },
  { kind: 'side-table', name: 'Round side table', cat: 'store', w: 0.55, d: 0.55, colors: WOODS, top: 0.6 },
  // sitting
  { kind: 'armchair', name: 'Armchair', cat: 'sit', w: 0.9, d: 0.85, colors: FABRICS, seats: [{ x: 0, z: 0.05, h: 0.6 }] },
  { kind: 'sofa', name: 'Sofa', cat: 'sit', w: 1.9, d: 0.85, colors: FABRICS, seats: [{ x: -0.45, z: 0.05, h: 0.6 }, { x: 0.45, z: 0.05, h: 0.6 }] },
  { kind: 'beanbag', name: 'Beanbag', cat: 'sit', w: 0.8, d: 0.8, colors: FABRICS, seats: [{ x: 0, z: 0, h: 0.42 }] },
  { kind: 'floor-cushion', name: 'Floor cushion', cat: 'sit', w: 0.6, d: 0.6, colors: FABRICS, seats: [{ x: 0, z: 0, h: 0.2 }] },
  // cosy things
  { kind: 'rug', name: 'Rug', cat: 'cosy', w: 2.4, d: 1.6, colors: FABRICS.concat(['#f4ece0']), flat: true },
  { kind: 'plant', name: 'Big plant', cat: 'cosy', w: 0.6, d: 0.6, colors: ['#d9a07a', '#f4ece0', '#3b3f4a'] },
  { kind: 'plant-small', name: 'Little plant', cat: 'cosy', w: 0.2, d: 0.2, colors: ['#d9a07a', '#f4ece0', '#93ab8c'], onTop: true },
  { kind: 'floor-lamp', name: 'Floor lamp', cat: 'cosy', w: 0.4, d: 0.4, colors: ['#f4ece0', '#f2a7bb', '#93ab8c'], light: true },
  { kind: 'record-player', name: 'Record player', cat: 'cosy', w: 0.42, d: 0.34, colors: WOODS, onTop: true },
  { kind: 'plush', name: 'Me3temed plush', cat: 'cosy', w: 0.25, d: 0.25, colors: ['#9c8a6a'], onTop: true },
  { kind: 'mug', name: 'Favourite mug', cat: 'cosy', w: 0.1, d: 0.1, colors: ['#fffaf4', '#f2a7bb', '#93ab8c', '#9fb8d6'], onTop: true },
];
export const BY_KIND = new Map(FURNITURE.map(f => [f.kind, f]));
export const CATS = [['sleep', '🛏️ Sleep'], ['study', '📚 Study'], ['store', '🗄️ Storage'], ['sit', '🛋️ Sit'], ['cosy', '🪴 Cosy']];

// The axis-aligned box a piece covers once it's turned (ry in radians).
export function footprint(def, x, z, ry) {
  const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
  const hw = (def.w * c + def.d * s) / 2, hd = (def.w * s + def.d * c) / 2;
  return { minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd };
}
