// render.js — the camera and all world drawing: ground, roads, beach,
// buildings with shadows, palms, props, cars (with flashing police
// lightbars), people, tracers, muzzle flashes, skid marks and markers.
import {
  WORLD_W, WORLD_H, ROAD_W, BEACH_Y, WATER_Y, COLORS,
} from "./config.js";
import { roadCentersX, roadCentersY, PLACES } from "./world.js";
import { markerTarget } from "./missions.js";

export function makeCamera() {
  return { x: 0, y: 0, zoom: 1 };
}

export function updateCamera(cam, state, W, H) {
  const p = state.player;
  cam.x = Math.max(0, Math.min(WORLD_W - W / cam.zoom, p.x - W / cam.zoom / 2));
  cam.y = Math.max(0, Math.min(WORLD_H - H / cam.zoom, p.y - H / cam.zoom / 2));
}

function drawGround(ctx, state, cam, W, H) {
  const vw = W / cam.zoom, vh = H / cam.zoom;
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, W, H);
  // Checkerboard grass mow stripes.
  ctx.fillStyle = COLORS.grassAlt;
  const tile = 200;
  for (let gx = Math.floor(cam.x / tile) * tile; gx < cam.x + vw; gx += tile) {
    for (let gy = Math.floor(cam.y / tile) * tile; gy < cam.y + vh; gy += tile) {
      if (((gx / tile) + (gy / tile)) % 2 === 0) {
        ctx.fillRect((gx - cam.x) * cam.zoom, (gy - cam.y) * cam.zoom, tile * cam.zoom, tile * cam.zoom);
      }
    }
  }
  // Beach sand and sea along the south edge.
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(0, (BEACH_Y - cam.y) * cam.zoom, W, (WATER_Y - BEACH_Y) * cam.zoom + 4);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(0, (WATER_Y - cam.y) * cam.zoom, W, H);
  ctx.fillStyle = COLORS.waterDeep;
  for (let i = 0; i < 7; i++) {
    const wy = WATER_Y + 26 + i * 26 + Math.sin(state.frame * 0.02 + i) * 4;
    ctx.fillRect(0, (wy - cam.y) * cam.zoom, W, 5 * cam.zoom);
  }
  // Plaza paving at downtown.
  ctx.fillStyle = COLORS.plaza;
  const pl = PLACES.downtown;
  ctx.fillRect((pl.x - 120 - cam.x) * cam.zoom, (pl.y - 120 - cam.y) * cam.zoom, 240 * cam.zoom, 240 * cam.zoom);
}

function drawRoads(ctx, state, cam, W, H) {
  ctx.fillStyle = COLORS.sidewalk;
  for (const cx of roadCentersX()) {
    ctx.fillRect((cx - ROAD_W / 2 - 10 - cam.x) * cam.zoom, 0, (ROAD_W + 20) * cam.zoom, (BEACH_Y + 60 - cam.y) * cam.zoom);
  }
  for (const cy of roadCentersY()) {
    ctx.fillRect(0, (cy - ROAD_W / 2 - 10 - cam.y) * cam.zoom, W, (ROAD_W + 20) * cam.zoom);
  }
  ctx.fillStyle = COLORS.road;
  for (const cx of roadCentersX()) ctx.fillRect((cx - ROAD_W / 2 - cam.x) * cam.zoom, 0, ROAD_W * cam.zoom, (BEACH_Y + 60 - cam.y) * cam.zoom);
  for (const cy of roadCentersY()) ctx.fillRect(0, (cy - ROAD_W / 2 - cam.y) * cam.zoom, W, ROAD_W * cam.zoom);
  // Dashed centrelines.
  ctx.fillStyle = COLORS.roadLine;
  for (const cx of roadCentersX()) {
    for (let y = 10; y < BEACH_Y + 40; y += 46) ctx.fillRect((cx - 2 - cam.x) * cam.zoom, (y - cam.y) * cam.zoom, 4 * cam.zoom, 24 * cam.zoom);
  }
  for (const cy of roadCentersY()) {
    for (let x = 10; x < WORLD_W; x += 46) ctx.fillRect((x - cam.x) * cam.zoom, (cy - 2 - cam.y) * cam.zoom, 24 * cam.zoom, 4 * cam.zoom);
  }
}

function drawBuilding(ctx, b, cam) {
  const x = (b.x - cam.x) * cam.zoom, y = (b.y - cam.y) * cam.zoom;
  const w = b.w * cam.zoom, h = b.h * cam.zoom;
  // Shadow, offset toward the south-east.
  ctx.fillStyle = "rgba(30,40,30,0.28)";
  ctx.fillRect(x + 9, y + 11, w, h);
  ctx.fillStyle = b.color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = b.roof;
  ctx.fillRect(x + 5, y + 5, w - 10, h - 10);
  // Windows grid hints at the floor count.
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  const cols = Math.max(2, Math.floor(b.w / 34));
  const rows = Math.max(2, Math.floor(b.h / 34));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    ctx.fillRect(x + 10 + i * ((w - 18) / cols), y + 10 + j * ((h - 18) / rows), 7, 5);
  }
}

function drawPalm(ctx, palm, cam) {
  const x = (palm.x - cam.x) * cam.zoom, y = (palm.y - cam.y) * cam.zoom;
  const s = palm.s * cam.zoom;
  ctx.strokeStyle = "#8a6b45";
  ctx.lineWidth = 4 * s;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3 * s, y - 13 * s); ctx.stroke();
  ctx.strokeStyle = "#2e9e4f";
  ctx.lineWidth = 3 * s;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.moveTo(x + 3 * s, y - 13 * s);
    ctx.lineTo(x + 3 * s + Math.cos(a) * 13 * s, y - 13 * s + Math.sin(a) * 7 * s + 3 * s);
    ctx.stroke();
  }
}

function drawProp(ctx, prop, cam) {
  const x = (prop.x - cam.x) * cam.zoom, y = (prop.y - cam.y) * cam.zoom;
  ctx.fillStyle = prop.color;
  if (prop.kind === "hydrant") { ctx.fillRect(x - 3, y - 6, 6, 10); ctx.fillRect(x - 5, y - 3, 10, 3); }
  else if (prop.kind === "stall") { ctx.fillRect(x - 12, y - 8, 24, 16); ctx.fillStyle = "#ffffff"; ctx.fillRect(x - 13, y - 12, 26, 5); }
  else if (prop.kind === "bin") { ctx.fillRect(x - 5, y - 5, 10, 11); }
  else { ctx.fillRect(x - 7, y - 7, 14, 14); ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.strokeRect(x - 7, y - 7, 14, 14); }
}

export function drawCar(ctx, car, cam, frame) {
  const x = (car.x - cam.x) * cam.zoom, y = (car.y - cam.y) * cam.zoom;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(car.angle);
  const z = cam.zoom;
  // Shadow.
  ctx.fillStyle = "rgba(20,25,20,0.3)";
  ctx.fillRect(-20 * z + 3, -10 * z + 4, 44 * z, 22 * z);
  // Body.
  ctx.fillStyle = car.color;
  ctx.fillRect(-22 * z, -11 * z, 44 * z, 22 * z);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(-22 * z, -11 * z, 44 * z, 4 * z);
  // Cabin and glass.
  ctx.fillStyle = "#bfe8f5";
  ctx.fillRect(-6 * z, -8 * z, 14 * z, 16 * z);
  ctx.fillStyle = "rgba(20,30,40,0.85)";
  ctx.fillRect(8 * z, -8 * z, 4 * z, 16 * z);
  ctx.fillRect(-12 * z, -8 * z, 4 * z, 16 * z);
  // Wheels.
  ctx.fillStyle = "#14181d";
  ctx.fillRect(-16 * z, -13 * z, 10 * z, 4 * z);
  ctx.fillRect(7 * z, -13 * z, 10 * z, 4 * z);
  ctx.fillRect(-16 * z, 9 * z, 10 * z, 4 * z);
  ctx.fillRect(7 * z, 9 * z, 10 * z, 4 * z);
  // Headlights.
  ctx.fillStyle = "#fff7ae";
  ctx.fillRect(20 * z, -8 * z, 3 * z, 4 * z);
  ctx.fillRect(20 * z, 4 * z, 3 * z, 4 * z);
  if (car.kind === "police") {
    ctx.fillStyle = "#173a8a";
    ctx.fillRect(-22 * z, -11 * z, 12 * z, 22 * z);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${9 * z}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText("PD", -2 * z, 3 * z);
    // Flashing lightbar: alternating red / blue.
    const phase = Math.floor(frame / 9 + car.lightPhase) % 2 === 0;
    ctx.fillStyle = phase ? "#ff2d2d" : "#7a0d0d";
    ctx.fillRect(-4 * z, -7 * z, 6 * z, 6 * z);
    ctx.fillStyle = phase ? "#0d2a7a" : "#2d6bff";
    ctx.fillRect(2 * z, -7 * z, 6 * z, 6 * z);
    if (phase) { ctx.fillStyle = "rgba(255,45,45,0.13)"; ctx.beginPath(); ctx.arc(0, 0, 27 * z, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = "rgba(45,107,255,0.13)"; ctx.beginPath(); ctx.arc(0, 0, 27 * z, 0, Math.PI * 2); ctx.fill(); }
  }
  if (car.marked) {
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = 3 * z;
    ctx.strokeRect(-25 * z, -14 * z, 50 * z, 28 * z);
  }
  ctx.restore();
}

export function drawPerson(ctx, person, cam, isPlayer = false) {
  const x = (person.x - cam.x) * cam.zoom, y = (person.y - cam.y) * cam.zoom;
  const z = cam.zoom;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(20,25,20,0.3)";
  ctx.beginPath(); ctx.ellipse(1, 4 * z, 9 * z, 5 * z, 0, 0, Math.PI * 2); ctx.fill();
  if (person.state === "down") {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = person.color;
    ctx.fillRect(-11 * z, -5 * z, 22 * z, 10 * z);
    ctx.fillStyle = "#f2c79b";
    ctx.beginPath(); ctx.arc(13 * z, 0, 5 * z, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const swing = Math.sin(person.legPhase || 0) * 4 * z;
  ctx.strokeStyle = "#2c3e50";
  ctx.lineWidth = 3.4 * z;
  ctx.beginPath(); ctx.moveTo(0, 2 * z); ctx.lineTo(-3 * z + swing * 0.4, 10 * z); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 2 * z); ctx.lineTo(3 * z - swing * 0.4, 10 * z); ctx.stroke();
  // Torso (shoulders seen from above) and head.
  ctx.fillStyle = person.color;
  ctx.beginPath(); ctx.arc(0, 0, 9.5 * z, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f2c79b";
  ctx.beginPath(); ctx.arc(0, 0, 5 * z, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(60,40,20,0.85)";
  ctx.beginPath(); ctx.arc(0, -1 * z, 3.4 * z, 0, Math.PI * 2); ctx.fill();
  if (person.kind === "officer") {
    ctx.fillStyle = "#173a8a";
    ctx.beginPath(); ctx.arc(0, -1 * z, 5 * z, Math.PI, Math.PI * 2); ctx.fill();
  }
  if (isPlayer) {
    // Direction tick and a ring so the player is unmistakable.
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.6 * z;
    ctx.beginPath(); ctx.arc(0, 0, 12 * z, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#222222";
    ctx.beginPath();
    ctx.moveTo(Math.cos(person.angle) * 6 * z, Math.sin(person.angle) * 6 * z);
    ctx.lineTo(Math.cos(person.angle) * 14 * z, Math.sin(person.angle) * 14 * z);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMarker(ctx, state, cam) {
  const target = markerTarget(state);
  if (!target) return;
  const x = (target.x - cam.x) * cam.zoom;
  const y = (target.y - cam.y) * cam.zoom + Math.sin(state.frame * 0.08) * 5;
  ctx.save();
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath();
  ctx.arc(x, y - 34, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 25); ctx.lineTo(x + 9, y - 25); ctx.lineTo(x, y - 8); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#7a5b00";
  ctx.font = "bold 15px Arial";
  ctx.textAlign = "center";
  ctx.fillText("!", x, y - 28);
  ctx.strokeStyle = "rgba(255,210,63,0.75)";
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc((target.x - cam.x) * cam.zoom, (target.y - cam.y) * cam.zoom, 30 + Math.sin(state.frame * 0.08) * 4, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

export function drawWorld(ctx, state, cam, W, H) {
  drawGround(ctx, state, cam, W, H);
  drawRoads(ctx, state, cam, W, H);

  // Skid marks under everything mobile.
  ctx.fillStyle = "rgba(25,25,25,0.4)";
  for (const s of state.skids) {
    ctx.fillRect((s.x - cam.x) * cam.zoom - 2, (s.y - cam.y) * cam.zoom - 2, 4, 4);
  }

  const world = state.world;
  for (const prop of world.props) drawProp(ctx, prop, cam);
  for (const b of world.buildings) drawBuilding(ctx, b, cam);
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
    ctx.moveTo((t.x - cam.x) * cam.zoom, (t.y - cam.y) * cam.zoom);
    ctx.lineTo((t.tx - cam.x) * cam.zoom, (t.ty - cam.y) * cam.zoom);
    ctx.stroke();
  }
  if (state.muzzle && state.muzzle.life > 0) {
    const mx = (state.muzzle.x - cam.x) * cam.zoom, my = (state.muzzle.y - cam.y) * cam.zoom;
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
    ctx.moveTo((t.x - cam.x) * cam.zoom, (t.y - cam.y) * cam.zoom);
    ctx.lineTo((t.tx - cam.x) * cam.zoom, (t.ty - cam.y) * cam.zoom);
    ctx.stroke();
  }
}
