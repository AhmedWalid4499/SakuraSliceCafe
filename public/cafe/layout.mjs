// The café's floor plan grew from 22 × 16 m to 30 × 22 m. Everything was
// first laid out on the old plan; this maps old positions onto the new one.
//
// - Things against a wall stay the same distance from that wall.
// - Everything else spreads out evenly, so there's more room to walk.
// - Things that belong together (a table and its chairs, the counter and
//   everything on it, a door and its frame) move together, so nothing
//   drifts apart.
//
// Pure functions with no dependencies: the server uses this too, to move
// notes that were pinned before the café grew.

export const OLD = { hx: 11, hz: 8 };
export const NEW = { hx: 15, hz: 11 };

function mapAxis(v, half, newHalf) {
  const a = Math.abs(v);
  const s = Math.sign(v) || 1;
  if (a >= half - 1) return s * (newHalf - (half - a));    // the band along a wall
  return v * (newHalf - 1) / (half - 1);                   // the open floor
}
export const mapX = x => mapAxis(x, OLD.hx, NEW.hx);
export const mapZ = z => mapAxis(z, OLD.hz, NEW.hz);

// Groups that move as one: [x, z, radius] in old coordinates.
export const ANCHORS = {
  main: [
    [-5.5, 1.2, 1.4], [-2.2, 4.4, 2.0], [1.6, 1.0, 1.4], [4.6, 4.8, 1.4], [-5.6, -3.6, 1.4], [-1.8, -1.2, 1.4],
    [-9.6, -3.5, 1.4],   // Table Four
    [-9.6, 6.6, 1.4],    // Mariam's corner
    [8.6, 1.5, 1.7],     // the armchairs by the fire
    [6.5, -4.7, 3.8],    // the counter and everything on and behind it
    [-8, -8.05, 1.3],    // the back door
    [0, 8.05, 1.3],      // the front door
    [-2.8, -7.96, 2.4],  // the community board
    [7.6, 6.4, 1.0],     // the sakura tree
  ],
  up: [
    [-1, 1.6, 3.3],      // the long table
    [-5.6, -4.5, 1.7],   // the sofa nook
    [-9.4, -5.6, 1.2],   // the corner sofa
    [7.4, -7.55, 1.3],   // the sideboard
    [10.96, 0.5, 2.4],   // the group's board
  ],
};

// How far something at old (x, z) on this floor moves.
export function deltaAt(floor, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const [ax, az, r] of ANCHORS[floor] || []) {
    const d = Math.hypot(x - ax, z - az);
    if (d <= r && d < bestD) { best = [ax, az]; bestD = d; }
  }
  const [rx, rz] = best || [x, z];
  return [mapX(rx) - rx, mapZ(rz) - rz];
}
