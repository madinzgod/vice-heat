// world.js — deterministic generation of Costa Azul: road grid, sidewalks,
// city blocks with buildings (and their collision rects), the southern beach
// and water, palm trees, props, and named landmark locations.
import {
  WORLD_W, WORLD_H, ROAD_SPACING, ROAD_W, BEACH_Y, WATER_Y, BUILDING_COLORS,
} from "./config.js";
import { mulberry32, pick, randRange } from "./random.js";

// Road centrelines: vertical roads at x = 200 + i*400, horizontal likewise.
export function roadCentersX() {
  const out = [];
  for (let x = ROAD_SPACING / 2; x < WORLD_W; x += ROAD_SPACING) out.push(x);
  return out;
}
export function roadCentersY() {
  const out = [];
  for (let y = ROAD_SPACING / 2; y < BEACH_Y; y += ROAD_SPACING) out.push(y);
  out.push(2140); // coastal avenue running along the beach
  return out;
}
export function isOnRoadX(x) {
  return roadCentersX().some((cx) => Math.abs(x - cx) < ROAD_W / 2);
}
export function isOnRoadY(y) {
  return roadCentersY().some((cy) => Math.abs(y - cy) < ROAD_W / 2);
}
export function nearestRoadX(x) {
  let best = roadCentersX()[0];
  for (const cx of roadCentersX()) if (Math.abs(cx - x) < Math.abs(best - x)) best = cx;
  return best;
}
export function nearestRoadY(y) {
  let best = roadCentersY()[0];
  for (const cy of roadCentersY()) if (Math.abs(cy - y) < Math.abs(best - y)) best = cy;
  return best;
}

// Named places used by missions, respawns and markers. All hand-placed on
// road intersections so they are always reachable.
export const PLACES = {
  policeStation: { x: 600, y: 600, name: "Costa Azul PD" },
  hospital: { x: 2600, y: 600, name: "Sunset General Hospital" },
  marinaGarage: { x: 3000, y: 2140, name: "Marina Garage" },
  downtown: { x: 1400, y: 1000, name: "Downtown Plaza" },
  beachClub: { x: 1000, y: 2140, name: "Coral Beach Club" },
  safehouse: { x: 220, y: 220, name: "Old Town Safehouse" },
  startCar: { x: 2600, y: 1400, name: "Marked Car" },
  start: { x: 600, y: 1060, name: "Palm Court" },
};

export function generateWorld(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const palms = [];
  const props = [];
  const xs = roadCentersX();
  const ys = roadCentersY().filter((y) => y < BEACH_Y);

  // Blocks sit between neighbouring roads; fill each with 1-4 buildings.
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const bx = xs[i] + ROAD_W / 2 + 14;
      const by = ys[j] + ROAD_W / 2 + 14;
      const bw = xs[i + 1] - xs[i] - ROAD_W - 28;
      const bh = ys[j + 1] - ys[j] - ROAD_W - 28;
      const cols = bw > 240 ? 2 : 1;
      const rows = bh > 240 ? 2 : 1;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const w = (bw / cols) * randRange(rng, 0.62, 0.86);
          const h = (bh / rows) * randRange(rng, 0.62, 0.86);
          const x = bx + (bw / cols) * c + (bw / cols - w) / 2;
          const y = by + (bh / rows) * r + (bh / rows - h) / 2;
          buildings.push({
            x, y, w, h,
            color: pick(rng, BUILDING_COLORS),
            roof: pick(rng, ["#c96f4a", "#a8a29e", "#7fb3c8", "#e0a458", "#8fbc94"]),
            floors: 2 + Math.floor(rng() * 6),
          });
        }
      }
      // A palm or two in the block corners.
      if (rng() < 0.7) palms.push({ x: bx + 6, y: by + 6, s: randRange(rng, 0.8, 1.25) });
      if (rng() < 0.5) palms.push({ x: bx + bw - 6, y: by + bh - 6, s: randRange(rng, 0.8, 1.25) });
    }
  }

  // Palms lining the beach and the coastal avenue.
  for (let x = 60; x < WORLD_W - 40; x += 90) {
    palms.push({ x: x + randRange(rng, -14, 14), y: BEACH_Y + 46 + randRange(rng, -8, 8), s: randRange(rng, 0.9, 1.4) });
    if (rng() < 0.6) palms.push({ x: x + 40, y: 2070, s: randRange(rng, 0.8, 1.2) });
  }

  // Street props: crates, hydrants and market stalls near sidewalks.
  for (let k = 0; k < 90; k++) {
    const cx = pick(rng, xs) + randRange(rng, -70, 70);
    const cy = pick(rng, ys) + randRange(rng, -70, 70);
    props.push({
      x: cx, y: cy,
      kind: pick(rng, ["crate", "hydrant", "stall", "bin"]),
      color: pick(rng, ["#e67e22", "#c0392b", "#16a085", "#8e6e53"]),
    });
  }

  return { buildings, palms, props, seed };
}

// Solid-rect collision test used by the player and by cars.
export function collidesAt(world, x, y, r) {
  if (x < r || y < r || x > WORLD_W - r || y > WORLD_H - r) return true;
  if (y > WATER_Y + 10) return true; // nobody drives into the sea
  for (const b of world.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

// Try to move a circle from (x,y) by (dx,dy), sliding along building faces.
export function moveWithCollision(world, x, y, dx, dy, r) {
  let nx = x + dx;
  if (collidesAt(world, nx, y, r)) nx = x;
  let ny = y + dy;
  if (collidesAt(world, nx, ny, r)) ny = y;
  return { x: nx, y: ny };
}
