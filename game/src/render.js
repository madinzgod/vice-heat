// render.js — the camera and all world drawing for Vice Heat, rebuilt
// around illustrated art: tiling texture patterns for grass, asphalt, sand
// and sea; generated rooftop plates on every building; chroma-keyed car,
// palm and boat sprites; and detailed code-drawn people. Every illustrated
// surface has a rich procedural fallback so a missing image never leaves a
// flat void behind.
import {
  WORLD_W, WORLD_H, ROAD_W, BEACH_Y, WATER_Y, COLORS,
} from "./config.js";
import { roadCentersX, roadCentersY, PLACES } from "./world.js";
import { markerTarget } from "./missions.js";
import { IMG, imgReady, carSpriteKey, roofKeyFor } from "./assets.js";

export function makeCamera() {
  return { x: 0, y: 0, zoom: 1 };
}

export function updateCamera(cam, state, W, H) {
  const p = state.player;
  cam.x = Math.max(0, Math.min(WORLD_W - W / cam.zoom, p.x - W / cam.zoom / 2));
  cam.y = Math.max(0, Math.min(WORLD_H - H / cam.zoom, p.y - H / cam.zoom / 2));
}

const TILE = 256; // world units covered by one texture tile
const sx = (cam, wx) => (wx - cam.x) * cam.zoom;
const sy = (cam, wy) => (wy - cam.y) * cam.zoom;

// Deterministic speckle so fallback surfaces still have grain.
function speckle(ctx, cam, x0, y0, x1, y1, n, color, seed) {
  ctx.fillStyle = color;
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) {
    const wx = x0 + rnd() * (x1 - x0);
    const wy = y0 + rnd() * (y1 - y0);
    ctx.fillRect(sx(cam, wx), sy(cam, wy), 2.2 * cam.zoom, 2.2 * cam.zoom);
  }
}

// Tile an illustrated texture across the visible world, aligned to the
// world grid so the grain stays fixed to the ground while the camera moves.
function tileFill(ctx, key, cam, W, H, clip) {
  if (!imgReady(key)) return false;
  const img = IMG[key];
  const t = TILE * cam.zoom;
  const vw = W / cam.zoom, vh = H / cam.zoom;
  ctx.save();
  if (clip) { clip(); ctx.clip(); }
  for (let wx = Math.floor(cam.x / TILE) * TILE; wx < cam.x + vw + TILE; wx += TILE) {
    for (let wy = Math.floor(cam.y / TILE) * TILE; wy < cam.y + vh + TILE; wy += TILE) {
      ctx.drawImage(img, sx(cam, wx) - 0.6, sy(cam, wy) - 0.6, t + 1.2, t + 1.2);
    }
  }
  ctx.restore();
  return true;
}

function drawGround(ctx, state, cam, W, H) {
  const vw = W / cam.zoom, vh = H / cam.zoom;
  // Grass base everywhere; the texture carries the variation.
  if (!tileFill(ctx, "grass", cam, W, H)) {
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, W, H);
    speckle(ctx, cam, cam.x, cam.y, cam.x + vw, cam.y + vh, 260, "rgba(46,110,40,0.25)", 1237);
    speckle(ctx, cam, cam.x, cam.y, cam.x + vw, cam.y + vh, 200, "rgba(190,235,150,0.20)", 7331);
  }
  // Downtown plaza paving.
  const pl = PLACES.downtown;
  ctx.fillStyle = "#ddd0ae";
  ctx.fillRect(sx(cam, pl.x - 120), sy(cam, pl.y - 120), 240 * cam.zoom, 240 * cam.zoom);
  ctx.strokeStyle = "rgba(120,100,60,0.35)";
  ctx.lineWidth = 1;
  for (let gx = pl.x - 120; gx <= pl.x + 120; gx += 30) {
    ctx.beginPath(); ctx.moveTo(sx(cam, gx), sy(cam, pl.y - 120)); ctx.lineTo(sx(cam, gx), sy(cam, pl.y + 120)); ctx.stroke();
  }
  for (let gy = pl.y - 120; gy <= pl.y + 120; gy += 30) {
    ctx.beginPath(); ctx.moveTo(sx(cam, pl.x - 120), sy(cam, gy)); ctx.lineTo(sx(cam, pl.x + 120), sy(cam, gy)); ctx.stroke();
  }
  // Beach sand band.
  const sandClip = () => { ctx.beginPath(); ctx.rect(0, sy(cam, BEACH_Y), W, (WATER_Y - BEACH_Y) * cam.zoom + 2); };
  if (!tileFill(ctx, "sand", cam, W, H, sandClip)) {
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(0, sy(cam, BEACH_Y), W, (WATER_Y - BEACH_Y) * cam.zoom + 2);
    speckle(ctx, cam, cam.x, BEACH_Y, cam.x + vw, WATER_Y, 160, "rgba(180,140,70,0.3)", 991);
  }
  // The sea.
  const seaClip = () => { ctx.beginPath(); ctx.rect(0, sy(cam, WATER_Y), W, H); };
  if (!tileFill(ctx, "water", cam, W, H, seaClip)) {
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(0, sy(cam, WATER_Y), W, H);
  }
  // Animated sparkle lanes on the water.
  ctx.fillStyle = "rgba(255,255,255,0.20)";
  for (let i = 0; i < 6; i++) {
    const wy = WATER_Y + 30 + i * 30 + Math.sin(state.frame * 0.02 + i * 1.7) * 4;
    if (wy > cam.y + vh) continue;
    ctx.fillRect(0, sy(cam, wy), W, 3.5 * cam.zoom);
  }
  // Foam band lapping the shoreline.
  const foamY = WATER_Y + Math.sin(state.frame * 0.03) * 3;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(0, sy(cam, foamY), W, 5 * cam.zoom);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(0, sy(cam, foamY + 9), W, 4 * cam.zoom);
}

function roadClipPath(ctx, cam, W, H) {
  ctx.beginPath();
  for (const cx of roadCentersX()) {
    ctx.rect(sx(cam, cx - ROAD_W / 2), 0, ROAD_W * cam.zoom, (BEACH_Y + 60 - cam.y) * cam.zoom);
  }
  for (const cy of roadCentersY()) {
    ctx.rect(0, sy(cam, cy - ROAD_W / 2), W, ROAD_W * cam.zoom);
  }
  // Coastal parking shoulder along the south side of the avenue.
  ctx.rect(0, sy(cam, 2186), W, (WATER_Y - 2186) * cam.zoom);
}

function drawRoads(ctx, state, cam, W, H) {
  // Sidewalk aprons under every road.
  ctx.fillStyle = "#c9c0aa";
  for (const cx of roadCentersX()) {
    ctx.fillRect(sx(cam, cx - ROAD_W / 2 - 11), 0, (ROAD_W + 22) * cam.zoom, (BEACH_Y + 60 - cam.y) * cam.zoom);
  }
  for (const cy of roadCentersY()) {
    ctx.fillRect(0, sy(cam, cy - ROAD_W / 2 - 11), W, (ROAD_W + 22) * cam.zoom);
  }
  // Sidewalk joints and a warm tint so the aprons do not read as flat grey.
  ctx.strokeStyle = "rgba(105,95,70,0.30)";
  ctx.lineWidth = 1;
  for (const cx of roadCentersX()) {
    for (const side of [-1, 1]) {
      const lx = sx(cam, cx + side * (ROAD_W / 2 + 5));
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke();
    }
  }
  // Asphalt texture clipped to the road network.
  if (!tileFill(ctx, "asphalt", cam, W, H, () => roadClipPath(ctx, cam, W, H))) {
    ctx.fillStyle = COLORS.road;
    ctx.save();
    roadClipPath(ctx, cam, W, H);
    ctx.fill();
    ctx.restore();
  }
  // Pale edge lines.
  ctx.fillStyle = "rgba(240,240,230,0.75)";
  for (const cx of roadCentersX()) {
    for (const side of [-1, 1]) {
      ctx.fillRect(sx(cam, cx + side * (ROAD_W / 2 - 3)), 0, 2.4 * cam.zoom, (BEACH_Y + 60 - cam.y) * cam.zoom);
    }
  }
  for (const cy of roadCentersY()) {
    for (const side of [-1, 1]) {
      ctx.fillRect(0, sy(cam, cy + side * (ROAD_W / 2 - 3)), W, 2.4 * cam.zoom);
    }
  }
  // Dashed gold centrelines.
  ctx.fillStyle = COLORS.roadLine;
  for (const cx of roadCentersX()) {
    for (let y = 10; y < BEACH_Y + 40; y += 46) {
      ctx.fillRect(sx(cam, cx - 2), sy(cam, y), 4 * cam.zoom, 24 * cam.zoom);
    }
  }
  for (const cy of roadCentersY()) {
    for (let x = 10; x < WORLD_W; x += 46) {
      ctx.fillRect(sx(cam, x), sy(cam, cy - 2), 24 * cam.zoom, 4 * cam.zoom);
    }
  }
  // Zebra crossings at every intersection.
  ctx.fillStyle = "rgba(245,245,240,0.85)";
  for (const cx of roadCentersX()) {
    for (const cy of roadCentersY()) {
      if (cx < cam.x - 90 || cx > cam.x + W / cam.zoom + 90) continue;
      if (cy < cam.y - 90 || cy > cam.y + H / cam.zoom + 90) continue;
      for (let s = -3; s <= 3; s++) {
        if (s === 0) continue;
        ctx.fillRect(sx(cam, cx + s * 13 - 4), sy(cam, cy - ROAD_W / 2 - 16), 8 * cam.zoom, 12 * cam.zoom);
        ctx.fillRect(sx(cam, cx + s * 13 - 4), sy(cam, cy + ROAD_W / 2 + 4), 8 * cam.zoom, 12 * cam.zoom);
        ctx.fillRect(sx(cam, cx - ROAD_W / 2 - 16), sy(cam, cy + s * 13 - 4), 12 * cam.zoom, 8 * cam.zoom);
        ctx.fillRect(sx(cam, cx + ROAD_W / 2 + 4), sy(cam, cy + s * 13 - 4), 12 * cam.zoom, 8 * cam.zoom);
      }
    }
  }
  // Parking bay ticks along the coastal shoulder.
  ctx.strokeStyle = "rgba(245,245,240,0.6)";
  ctx.lineWidth = 2 * cam.zoom;
  for (let x = 200; x < WORLD_W - 100; x += 148) {
    ctx.beginPath();
    ctx.moveTo(sx(cam, x), sy(cam, 2192));
    ctx.lineTo(sx(cam, x), sy(cam, 2234));
    ctx.stroke();
  }
  // Streetlights: twin dots of warm light hardware along the avenues.
  for (const cx of roadCentersX()) {
    for (let y = 90; y < BEACH_Y; y += 200) {
      for (const side of [-1, 1]) {
        const lx = sx(cam, cx + side * (ROAD_W / 2 + 8));
        const ly = sy(cam, y);
        if (lx < -20 || lx > W + 20 || ly < -20 || ly > H + 20) continue;
        ctx.fillStyle = "rgba(30,30,30,0.35)";
        ctx.beginPath(); ctx.ellipse(lx + 2, ly + 3, 5 * cam.zoom, 3 * cam.zoom, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#3c4148";
        ctx.fillRect(lx - 1.6 * cam.zoom, ly - 1.6 * cam.zoom, 3.2 * cam.zoom, 3.2 * cam.zoom);
        ctx.fillStyle = "#ffe9a8";
        ctx.beginPath(); ctx.arc(lx, ly, 2 * cam.zoom, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

function drawBuilding(ctx, b, cam) {
  const x = sx(cam, b.x), y = sy(cam, b.y);
  const w = b.w * cam.zoom, h = b.h * cam.zoom;
  if (x + w < -30 || y + h < -30 || x > 1400 || y > 900) return;
  // Long soft shadow toward the south-east gives the blocks their height.
  ctx.fillStyle = "rgba(25,35,25,0.30)";
  ctx.fillRect(x + 10 * cam.zoom, y + 13 * cam.zoom, w, h);
  const key = roofKeyFor(b);
  if (imgReady(key)) {
    ctx.drawImage(IMG[key], x, y, w, h);
    ctx.strokeStyle = "rgba(40,30,20,0.45)";
    ctx.lineWidth = 1.6;
    ctx.strokeRect(x, y, w, h);
    return;
  }
  // Procedural fallback: layered roof plate with plant and vents.
  ctx.fillStyle = b.color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = b.roof;
  ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(x + w * 0.18, y + h * 0.2, w * 0.2, h * 0.18);
  ctx.fillRect(x + w * 0.62, y + h * 0.55, w * 0.16, h * 0.14);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  const cols = Math.max(2, Math.floor(b.w / 34));
  const rows = Math.max(2, Math.floor(b.h / 34));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    ctx.fillRect(x + 10 + i * ((w - 18) / cols), y + 10 + j * ((h - 18) / rows), 7, 5);
  }
}

function drawPalm(ctx, palm, cam) {
  const x = sx(cam, palm.x), y = sy(cam, palm.y);
  const s = palm.s * cam.zoom;
  // Ground shadow first so the canopy sits in the world.
  ctx.fillStyle = "rgba(20,40,20,0.28)";
  ctx.beginPath(); ctx.ellipse(x + 6 * s, y + 8 * s, 24 * s, 15 * s, 0.4, 0, Math.PI * 2); ctx.fill();
  if (imgReady("palm")) {
    const d = 62 * s;
    ctx.drawImage(IMG.palm, x - d / 2, y - d / 2, d, d);
    return;
  }
  ctx.strokeStyle = "#2e9e4f";
  ctx.lineWidth = 3.4 * s;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(a) * 10 * s, y + Math.sin(a) * 10 * s,
      x + Math.cos(a) * 17 * s, y + Math.sin(a) * 13 * s + 4 * s,
    );
    ctx.stroke();
  }
  ctx.fillStyle = "#7a5230";
  ctx.beginPath(); ctx.arc(x, y, 3.4 * s, 0, Math.PI * 2); ctx.fill();
}

function drawProp(ctx, prop, cam) {
  const x = sx(cam, prop.x), y = sy(cam, prop.y);
  const z = cam.zoom;
  ctx.fillStyle = "rgba(20,25,20,0.25)";
  ctx.beginPath(); ctx.ellipse(x + 2, y + 4 * z, 8 * z, 4.5 * z, 0, 0, Math.PI * 2); ctx.fill();
  if (prop.kind === "hydrant") {
    ctx.fillStyle = "#d63a2f";
    ctx.fillRect(x - 3 * z, y - 6 * z, 6 * z, 10 * z);
    ctx.fillStyle = "#f2f2f2";
    ctx.fillRect(x - 5 * z, y - 3 * z, 10 * z, 3 * z);
    ctx.fillStyle = "#a8231c";
    ctx.fillRect(x - 2 * z, y - 8.4 * z, 4 * z, 2.6 * z);
  } else if (prop.kind === "stall") {
    ctx.fillStyle = "#8a5a33";
    ctx.fillRect(x - 12 * z, y - 6 * z, 24 * z, 14 * z);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? "#ffffff" : "#e8483f";
      ctx.fillRect(x + (-14 + i * 7) * z, y - 12 * z, 7 * z, 5 * z);
    }
    ctx.fillStyle = "#ffb84d";
    ctx.fillRect(x - 9 * z, y - 3 * z, 6 * z, 4 * z);
    ctx.fillStyle = "#7bed6a";
    ctx.fillRect(x + 2 * z, y - 3 * z, 6 * z, 4 * z);
  } else if (prop.kind === "bin") {
    ctx.fillStyle = "#2e6e4e";
    ctx.fillRect(x - 5 * z, y - 5 * z, 10 * z, 11 * z);
    ctx.fillStyle = "#1e4d35";
    ctx.fillRect(x - 5.6 * z, y - 6.4 * z, 11.2 * z, 2.4 * z);
  } else {
    ctx.fillStyle = "#a9713d";
    ctx.fillRect(x - 7 * z, y - 7 * z, 14 * z, 14 * z);
    ctx.strokeStyle = "rgba(60,35,10,0.55)";
    ctx.lineWidth = 1.4 * z;
    ctx.strokeRect(x - 7 * z, y - 7 * z, 14 * z, 14 * z);
    ctx.beginPath();
    ctx.moveTo(x - 7 * z, y - 7 * z); ctx.lineTo(x + 7 * z, y + 7 * z);
    ctx.moveTo(x + 7 * z, y - 7 * z); ctx.lineTo(x - 7 * z, y + 7 * z);
    ctx.stroke();
  }
}

function drawBeachDressing(ctx, world, cam) {
  const z = cam.zoom;
  for (const u of world.umbrellas || []) {
    const x = sx(cam, u.x), y = sy(cam, u.y);
    if (x < -30 || x > 1310 || y < -30 || y > 830) continue;
    // Towel beside the umbrella.
    ctx.save();
    ctx.translate(x + 13 * z, y + 7 * z);
    ctx.rotate(0.35);
    ctx.fillStyle = u.towel;
    ctx.fillRect(-8 * z, -4.5 * z, 16 * z, 9 * z);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(-8 * z, -1.2 * z, 16 * z, 2.2 * z);
    ctx.restore();
    // Canopy: alternating coloured and white wedges.
    ctx.fillStyle = "rgba(120,90,30,0.3)";
    ctx.beginPath(); ctx.ellipse(x + 3, y + 4, 13 * z, 7 * z, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * Math.PI * 2;
      const a1 = ((i + 1) / 6) * Math.PI * 2;
      ctx.fillStyle = i % 2 ? "#ffffff" : u.color;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, 12.5 * z, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#7a5230";
    ctx.beginPath(); ctx.arc(x, y, 1.8 * z, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBoat(ctx, boat, cam, frame) {
  const x = sx(cam, boat.x), y = sy(cam, boat.y) + Math.sin(frame * 0.03 + boat.x) * 1.6;
  const z = cam.zoom * boat.s;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(boat.angle + Math.PI / 2);
  // Soft wake / shadow on the water.
  ctx.fillStyle = "rgba(10,60,80,0.30)";
  ctx.beginPath(); ctx.ellipse(3, 4, 26 * z, 62 * z, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath(); ctx.ellipse(0, 66 * z, 16 * z, 7 * z, 0, 0, Math.PI * 2); ctx.fill();
  if (imgReady("boat")) {
    const img = IMG.boat;
    const len = 128 * z;
    const wid = len * (img.naturalWidth / img.naturalHeight);
    ctx.drawImage(img, -wid / 2, -len / 2, wid, len);
  } else {
    ctx.fillStyle = "#f4f6f8";
    ctx.beginPath();
    ctx.moveTo(0, -60 * z); ctx.lineTo(16 * z, 10 * z); ctx.lineTo(13 * z, 58 * z);
    ctx.lineTo(-13 * z, 58 * z); ctx.lineTo(-16 * z, 10 * z);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#2f7fc9";
    ctx.fillRect(-10 * z, -6 * z, 20 * z, 22 * z);
  }
  ctx.restore();
}

// Cars are drawn from the keyed sprites. The source art faces up (nose at
// the top of the image), so the sprite is rotated a quarter turn to align
// its nose with the car's heading.
export function drawCar(ctx, car, cam, frame) {
  const x = sx(cam, car.x), y = sy(cam, car.y);
  const z = cam.zoom;
  const key = carSpriteKey(car);
  ctx.save();
  ctx.translate(x, y);
  // Soft shadow ellipse under the body.
  ctx.fillStyle = "rgba(15,20,15,0.32)";
  ctx.beginPath();
  ctx.ellipse(3, 5, 56 * z, 27 * z, car.angle, 0, Math.PI * 2);
  ctx.fill();
  if (imgReady(key)) {
    const img = IMG[key];
    const len = 110 * z;
    const wid = len * (img.naturalWidth / img.naturalHeight);
    ctx.rotate(car.angle + Math.PI / 2);
    ctx.drawImage(img, -wid / 2, -len / 2, wid, len);
    ctx.rotate(-(car.angle + Math.PI / 2));
  } else {
    ctx.rotate(car.angle);
    ctx.fillStyle = car.color || "#cccccc";
    ctx.fillRect(-22 * z, -11 * z, 44 * z, 22 * z);
    ctx.fillStyle = "#bfe8f5";
    ctx.fillRect(-6 * z, -8 * z, 14 * z, 16 * z);
    ctx.fillStyle = "#14181d";
    ctx.fillRect(-16 * z, -13 * z, 10 * z, 4 * z);
    ctx.fillRect(7 * z, -13 * z, 10 * z, 4 * z);
    ctx.fillRect(-16 * z, 9 * z, 10 * z, 4 * z);
    ctx.fillRect(7 * z, 9 * z, 10 * z, 4 * z);
    ctx.rotate(-car.angle);
  }
  if (car.kind === "police") {
    // Flashing halo around the light bar, alternating red and blue.
    const phase = Math.floor(frame / 9 + (car.lightPhase || 0)) % 2 === 0;
    ctx.fillStyle = phase ? "rgba(255,45,45,0.16)" : "rgba(45,107,255,0.16)";
    ctx.beginPath(); ctx.arc(0, 0, 34 * z, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = phase ? "#ff2d2d" : "#2d6bff";
    ctx.beginPath(); ctx.arc(0, 0, 5.5 * z, 0, Math.PI * 2); ctx.fill();
  }
  if (car.marked) {
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = 3 * z;
    ctx.beginPath();
    ctx.ellipse(0, 0, 62 * z, 34 * z, car.angle, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

const SKIN_TONES = ["#f2c79b", "#e8b48c", "#d69c6d", "#b57a4e", "#8d5a3b"];
const HAIR_COLORS = ["#2b1c10", "#4a2f18", "#6e4a22", "#151515", "#8a8a8a", "#b5522e"];

export function drawPerson(ctx, person, cam, isPlayer = false) {
  const x = sx(cam, person.x), y = sy(cam, person.y);
  const z = cam.zoom;
  const seed = Math.abs(person.id || 7);
  const skin = SKIN_TONES[seed % SKIN_TONES.length];
  const hair = HAIR_COLORS[seed % HAIR_COLORS.length];
  ctx.save();
  ctx.translate(x, y);
  // Ground shadow.
  ctx.fillStyle = "rgba(20,25,20,0.30)";
  ctx.beginPath(); ctx.ellipse(2, 6 * z, 11 * z, 6 * z, 0, 0, Math.PI * 2); ctx.fill();
  if (person.state === "down") {
    ctx.rotate(person.angle + Math.PI / 2);
    ctx.fillStyle = "#3a4a5a";
    ctx.fillRect(-4.5 * z, 2 * z, 9 * z, 13 * z);
    ctx.fillStyle = person.color;
    ctx.fillRect(-7 * z, -8 * z, 14 * z, 11 * z);
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, -12 * z, 5.2 * z, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(person.angle);
  const swing = Math.sin(person.legPhase || 0) * 5 * z;
  const bob = Math.abs(Math.sin(person.legPhase || 0)) * 1.1 * z;
  // Legs, swinging behind the torso.
  ctx.strokeStyle = person.kind === "officer" ? "#1d2f52" : "#33424f";
  ctx.lineWidth = 3.6 * z;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-2 * z, 0); ctx.lineTo(-7 * z - swing * 0.5, -4.5 * z + swing); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-2 * z, 0); ctx.lineTo(-7 * z + swing * 0.5, 4.5 * z + swing); ctx.stroke();
  // Arms at the shoulders, counter-swinging.
  ctx.strokeStyle = person.color;
  ctx.lineWidth = 3.2 * z;
  ctx.beginPath(); ctx.moveTo(1 * z, -8 * z); ctx.lineTo(4 * z - swing * 0.45, -11.5 * z); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1 * z, 8 * z); ctx.lineTo(4 * z + swing * 0.45, 11.5 * z); ctx.stroke();
  // Torso: shoulders seen from above, with a shaded trailing edge.
  ctx.fillStyle = person.color;
  ctx.beginPath(); ctx.arc(0, -bob * 0.2, 10 * z, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.beginPath(); ctx.arc(-2.4 * z, -bob * 0.2, 10 * z, Math.PI * 0.55, Math.PI * 1.45); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.20)";
  ctx.beginPath(); ctx.arc(2.6 * z, -bob * 0.2, 8.6 * z, -Math.PI * 0.4, Math.PI * 0.4); ctx.fill();
  if (person.kind === "officer") {
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(3.5 * z, -6 * z, 2.4 * z, 12 * z);
  }
  // Head with a hair cap (or the navy police cap).
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(1.5 * z, -bob * 0.2, 5.6 * z, 0, Math.PI * 2); ctx.fill();
  if (person.kind === "officer") {
    ctx.fillStyle = "#173a8a";
    ctx.beginPath(); ctx.arc(1.5 * z, -bob * 0.2, 5.8 * z, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0f2560";
    ctx.fillRect(6.4 * z, -2.6 * z, 2.6 * z, 5.2 * z);
  } else {
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.arc(0.6 * z, -bob * 0.2, 5.3 * z, Math.PI * 0.35, Math.PI * 1.65); ctx.fill();
    ctx.beginPath(); ctx.arc(-0.6 * z, -bob * 0.2, 4.6 * z, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(2.8 * z, -bob * 0.2, 4.1 * z, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  if (isPlayer) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2 * z;
    ctx.beginPath(); ctx.arc(0, 0, 14.5 * z, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = 1.4 * z;
    ctx.beginPath(); ctx.arc(0, 0, 17 * z, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#222222";
    ctx.lineWidth = 2.2 * z;
    ctx.beginPath();
    ctx.moveTo(Math.cos(person.angle) * 8 * z, Math.sin(person.angle) * 8 * z);
    ctx.lineTo(Math.cos(person.angle) * 19 * z, Math.sin(person.angle) * 19 * z);
    ctx.stroke();
    ctx.restore();
  }
}

function drawMarker(ctx, state, cam) {
  const target = markerTarget(state);
  if (!target) return;
  const x = sx(cam, target.x);
  const y = sy(cam, target.y) + Math.sin(state.frame * 0.08) * 5;
  ctx.save();
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath();
  ctx.arc(x, y - 38, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 28); ctx.lineTo(x + 10, y - 28); ctx.lineTo(x, y - 9); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#7a5b00";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.fillText("!", x, y - 32);
  ctx.strokeStyle = "rgba(255,210,63,0.75)";
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(sx(cam, target.x), sy(cam, target.y), 32 + Math.sin(state.frame * 0.08) * 4, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// Warm golden-hour grade: a soft sunset wash plus a vignette so the frame
// edges fall away and the centre of the action stays lit.
export function drawGrade(ctx, W, H) {
  const warm = ctx.createLinearGradient(0, 0, W, H);
  warm.addColorStop(0, "rgba(255,166,66,0.10)");
  warm.addColorStop(0.55, "rgba(255,120,80,0.04)");
  warm.addColorStop(1, "rgba(64,32,96,0.10)");
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, W, H);
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.78);
  vig.addColorStop(0, "rgba(20,8,24,0)");
  vig.addColorStop(1, "rgba(20,8,24,0.30)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

// Title-screen backdrop: the generated coastal vista, cover-fitted, with a
// deep gradient at the bottom so the menu stays readable.
export function drawCoverBackdrop(ctx, W, H) {
  if (imgReady("cover")) {
    const img = IMG.cover;
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#2b1b4a");
    sky.addColorStop(0.55, "#c94f6d");
    sky.addColorStop(0.8, "#f2a65a");
    sky.addColorStop(1, "#123a5c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
  }
  const shade = ctx.createLinearGradient(0, H * 0.3, 0, H);
  shade.addColorStop(0, "rgba(10,8,26,0)");
  shade.addColorStop(1, "rgba(10,8,26,0.55)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
}

export function drawWorld(ctx, state, cam, W, H) {
  drawGround(ctx, state, cam, W, H);
  drawRoads(ctx, state, cam, W, H);

  // Skid marks under everything mobile.
  ctx.fillStyle = "rgba(25,25,25,0.42)";
  for (const s of state.skids) {
    ctx.fillRect(sx(cam, s.x) - 2.4, sy(cam, s.y) - 2.4, 4.8, 4.8);
  }

  const world = state.world;
  drawBeachDressing(ctx, world, cam);
  for (const boat of world.boats || []) drawBoat(ctx, boat, cam, state.frame);
  for (const prop of world.props) drawProp(ctx, prop, cam);
  for (const b of world.buildings) drawBuilding(ctx, b, cam);
  for (const parked of world.parkedCars || []) drawCar(ctx, parked, cam, state.frame);
  for (const palm of world.palms) drawPalm(ctx, palm, cam);

  drawMarker(ctx, state, cam);

  for (const car of state.cars) drawCar(ctx, car, cam, state.frame);
  for (const ped of state.peds) drawPerson(ctx, ped, cam, false);
  if (!state.player.car) drawPerson(ctx, state.player, cam, true);

  // Player tracers and muzzle flash.
  for (const t of state.tracers) {
    ctx.strokeStyle = "rgba(255,240,150,0.95)";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(sx(cam, t.x), sy(cam, t.y));
    ctx.lineTo(sx(cam, t.tx), sy(cam, t.ty));
    ctx.stroke();
  }
  if (state.muzzle && state.muzzle.life > 0) {
    const mx = sx(cam, state.muzzle.x), my = sy(cam, state.muzzle.y);
    ctx.fillStyle = "#ffe066";
    ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff9f1a";
    ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Enemy tracers, thinner and redder.
  for (const t of state.enemyShots) {
    ctx.strokeStyle = "rgba(255,90,90,0.8)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(sx(cam, t.x), sy(cam, t.y));
    ctx.lineTo(sx(cam, t.tx), sy(cam, t.ty));
    ctx.stroke();
  }

  drawGrade(ctx, W, H);
}
