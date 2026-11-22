// main.js — Vice Heat entry point: boot, the game loop, game states
// (title / playing / paused / busted / wasted), entering and leaving cars,
// on-foot movement and shooting, combat resolution, and save / load.
import { TUNING } from "./config.js";
import { mulberry32, clamp, dist } from "./random.js";
import { generateWorld, moveWithCollision, PLACES } from "./world.js";
import { createInput } from "./input.js";
import { makeCar, spawnTrafficCar, updateTrafficCar, updatePlayerCar } from "./vehicles.js";
import { spawnCrowd, updatePed } from "./people.js";
import { updatePolice, reportCrime } from "./police.js";
import { updateMissions } from "./missions.js";
import { createAudio } from "./audio.js";
import { makeCamera, updateCamera, drawWorld } from "./render.js";
import { drawHUD } from "./hud.js";
import { stageShot, applyShotFx } from "./shots.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = 1280;
canvas.height = 800;
const W = canvas.width, H = canvas.height;

const params = new URLSearchParams(location.search);
const shotN = Number(params.get("shot") || 0);
const seed = Number(params.get("seed") || 7);

const input = createInput(canvas);
const cam = makeCamera();

const state = {
  world: generateWorld(1234),
  rng: mulberry32(seed * 7919 + 13),
  frame: 0,
  mode: "title", // title | playing | paused | busted | wasted
  player: {
    x: PLACES.start.x, y: PLACES.start.y, angle: 0, health: 100,
    color: "#ffcf3f", car: null, legPhase: 0, kind: "player", state: "walk",
  },
  cars: [], peds: [], skids: [], tracers: [], enemyShots: [],
  muzzle: null, recentDanger: null,
  wanted: 0, bust: 0, cash: 0,
  missionIndex: 0, stageIndex: 0, storyComplete: false, m3Heated: false,
  banner: null, decayTimer: 0, seenTimer: 0, playerSeen: false,
  pendingBust: false, nearCar: null, shotObjective: null, shotRival: null,
  camZoom: 1, audio: createAudio(), endMessage: "",
};
window.__viceHeat = state;

// ---------- save / load ----------
state.saveGame = function saveGame() {
  try {
    localStorage.setItem("viceHeatSave", JSON.stringify({
      cash: state.cash,
      missionIndex: state.missionIndex,
      storyComplete: state.storyComplete,
      x: state.player.x, y: state.player.y,
    }));
  } catch { /* storage unavailable: play on without saving */ }
};
function loadSave() {
  try {
    const raw = localStorage.getItem("viceHeatSave");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function hasSave() { return !!loadSave(); }

// ---------- world population ----------
function spawnMarkedCar() {
  const car = makeCar(PLACES.startCar.x + 24, PLACES.startCar.y + 24, 0, "#f6c90e", "parked");
  car.marked = true;
  state.cars.push(car);
}
function populate() {
  spawnMarkedCar();
  for (let i = 0; i < 9; i++) spawnTrafficCar(state, state.rng, state.player.x, state.player.y);
  spawnCrowd(state, state.player.x, state.player.y, 16, state.rng);
  spawnCrowd(state, PLACES.downtown.x, PLACES.downtown.y, 10, state.rng);
}
function maintainPopulation() {
  const traffic = state.cars.filter((c) => c.kind === "traffic");
  if (traffic.length < 10 && state.frame % 40 === 0) spawnTrafficCar(state, state.rng, state.player.x, state.player.y);
  state.cars = state.cars.filter((c) => c === state.player.car || c.marked || c.kind === "police" || dist(c.x, c.y, state.player.x, state.player.y) < 1500);
  const alive = state.peds.filter((p) => p.state !== "down");
  if (alive.length < 20 && state.frame % 50 === 0) spawnCrowd(state, state.player.x, state.player.y, 5, state.rng);
  state.peds = state.peds.filter((p) => dist(p.x, p.y, state.player.x, state.player.y) < 1300);
}

// ---------- player actions ----------
function nearestEnterableCar() {
  let best = null, bestD = 52;
  for (const car of state.cars) {
    if (car.occupied) continue;
    const d = dist(car.x, car.y, state.player.x, state.player.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}
function enterCar(car) {
  state.player.car = car;
  car.occupied = true;
  state.audio.play("door");
  // A driver who was sitting in a traffic car bails out and runs.
  const driver = state.peds.find((p) => p.carRef === car);
  if (driver) { driver.state = "flee"; driver.carRef = null; }
}
function exitCar() {
  const car = state.player.car;
  if (!car) return;
  state.player.car = null;
  car.occupied = false;
  car.speed = 0;
  state.player.x = car.x - Math.sin(car.angle) * 26;
  state.player.y = car.y + Math.cos(car.angle) * 26;
  state.audio.play("door");
}

function updatePlayerOnFoot(dt) {
  const p = state.player;
  const run = input.down("shift");
  const speed = (run ? TUNING.playerRun : TUNING.playerWalk) * dt;
  let dx = 0, dy = 0;
  if (input.down("w", "arrowup")) dy -= 1;
  if (input.down("s", "arrowdown")) dy += 1;
  if (input.down("a", "arrowleft")) dx -= 1;
  if (input.down("d", "arrowright")) dx += 1;
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    const moved = moveWithCollision(state.world, p.x, p.y, (dx / len) * speed, (dy / len) * speed, TUNING.playerRadius);
    p.x = moved.x; p.y = moved.y;
    p.legPhase += dt * (run ? 0.5 : 0.32);
  }
  // Aim at the mouse (screen -> world).
  const wx = cam.x + input.mouseX / cam.zoom;
  const wy = cam.y + input.mouseY / cam.zoom;
  p.angle = Math.atan2(wy - p.y, wx - p.x);

  if (input.mouseDown && state.frame % 9 === 0) shoot();
}

function shoot() {
  const p = state.player;
  const range = 640;
  const gx = p.x + Math.cos(p.angle) * 16;
  const gy = p.y + Math.sin(p.angle) * 16;
  let hitX = p.x + Math.cos(p.angle) * range;
  let hitY = p.y + Math.sin(p.angle) * range;
  let bestT = range;

  const testTarget = (tx, ty, radius, apply) => {
    const vx = tx - p.x, vy = ty - p.y;
    const t = vx * Math.cos(p.angle) + vy * Math.sin(p.angle);
    if (t < 0 || t > bestT) return;
    const perp = Math.abs(-vx * Math.sin(p.angle) + vy * Math.cos(p.angle));
    if (perp < radius) { bestT = t; hitX = tx; hitY = ty; apply(); }
  };
  let pending = null;
  for (const ped of state.peds) {
    if (ped.state === "down") continue;
    testTarget(ped.x, ped.y, 15, () => { pending = () => damagePed(ped); });
  }
  for (const car of state.cars) {
    if (car === p.car) continue;
    testTarget(car.x, car.y, 24, () => {
      pending = () => {
        car.health -= TUNING.bulletDamage;
        state.audio.play("hit");
        if (car.kind === "police") reportCrime(state, 1);
      };
    });
  }
  state.tracers.push({ x: gx, y: gy, tx: hitX, ty: hitY, life: 5 });
  state.muzzle = { x: gx, y: gy, life: 4 };
  state.recentDanger = { x: p.x, y: p.y, t: 150 };
  state.audio.play("shot");
  if (pending) pending();
}

function damagePed(ped) {
  ped.health -= TUNING.bulletDamage;
  state.audio.play("hit");
  if (ped.health <= 0) {
    ped.state = "down";
    if (ped.kind === "officer") reportCrime(state, 2);
    else reportCrime(state, 1);
  } else if (ped.kind === "officer") {
    reportCrime(state, 1);
  }
}

// Cars versus people: running someone over is a crime and it shows.
function carHitsPeople(car) {
  if (Math.abs(car.speed) < 1.4) return;
  for (const ped of state.peds) {
    if (ped.state === "down") continue;
    if (dist(car.x, car.y, ped.x, ped.y) < 26) {
      ped.state = "down";
      ped.health = 0;
      state.recentDanger = { x: ped.x, y: ped.y, t: 150 };
      state.audio.play("hit");
      if (car === state.player.car) {
        reportCrime(state, ped.kind === "officer" ? 2 : 1);
        car.speed *= 0.55;
      }
    }
  }
  // Police ramming the player on foot hurts.
  if (!state.player.car && car.kind === "police" && dist(car.x, car.y, state.player.x, state.player.y) < 26) {
    state.player.health -= 0.5;
  }
}

// ---------- end states ----------
function doBust() {
  const fine = Math.min(state.cash, 100 + state.wanted * 50);
  state.cash -= fine;
  state.endMessage = `The Costa Azul PD caught you. Fine paid: $${fine}.`;
  state.mode = "busted";
  state.audio.play("busted");
}
function doWasted() {
  const fee = Math.min(state.cash, 150);
  state.cash -= fee;
  state.endMessage = `You wake up at Sunset General. Medical fee: $${fee}.`;
  state.mode = "wasted";
  state.audio.play("busted");
}
function respawn(place) {
  const p = state.player;
  if (p.car) { p.car.occupied = false; p.car = null; }
  p.x = place.x + 30; p.y = place.y + 56;
  p.health = 100;
  state.wanted = 0; state.bust = 0; state.pendingBust = false;
  state.cars = state.cars.filter((c) => c.kind !== "police");
  state.mode = "playing";
  state.saveGame();
}

// ---------- per-frame update ----------
let eWasDown = false;
let pauseWasDown = false;
function update(dt) {
  state.frame++;
  const p = state.player;

  const pauseDown = input.down("escape", "p");
  if (pauseDown && !pauseWasDown && state.mode === "playing") state.mode = "paused";
  else if (pauseDown && !pauseWasDown && state.mode === "paused") state.mode = "playing";
  pauseWasDown = pauseDown;
  if (state.mode !== "playing") return;

  const eDown = input.down("e");
  if (eDown && !eWasDown) {
    if (p.car) exitCar();
    else { const car = nearestEnterableCar(); if (car) enterCar(car); }
  }
  eWasDown = eDown;
  state.nearCar = p.car ? null : nearestEnterableCar();

  if (p.car) updatePlayerCar(state, p.car, input, dt);
  else updatePlayerOnFoot(dt);

  for (const car of state.cars) {
    if (car === p.car) continue;
    if (car.kind === "traffic") updateTrafficCar(state, car, dt);
  }
  for (const car of state.cars) carHitsPeople(car);
  for (const ped of state.peds) updatePed(state, ped, dt);
  updatePolice(state, dt);
  updateMissions(state);
  maintainPopulation();

  // Effect lifetimes.
  for (const t of state.tracers) t.life -= dt;
  state.tracers = state.tracers.filter((t) => t.life > 0);
  for (const t of state.enemyShots) t.life -= dt;
  state.enemyShots = state.enemyShots.filter((t) => t.life > 0);
  if (state.muzzle) { state.muzzle.life -= dt; if (state.muzzle.life <= 0) state.muzzle = null; }
  if (state.recentDanger) { state.recentDanger.t -= dt; if (state.recentDanger.t <= 0) state.recentDanger = null; }
  for (const s of state.skids) s.life -= dt;
  state.skids = state.skids.filter((s) => s.life > 0);
  if (state.banner) { state.banner.t -= dt; if (state.banner.t <= 0) state.banner = null; }

  state.audio.updateSiren(state.wanted > 0 && state.playerSeen);

  if (state.pendingBust) doBust();
  else if (p.health <= 0) doWasted();
}

// ---------- screens ----------
const buttons = [];
function drawButton(x, y, w, h, label, enabled) {
  buttons.push({ x, y, w, h, label, enabled });
  ctx.fillStyle = enabled ? "#e8483f" : "rgba(90,90,100,0.6)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, y + h / 2 + 8);
  ctx.textAlign = "left";
}
function drawTitle() {
  ctx.fillStyle = "#123a5c";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#f2dd9a";
  ctx.fillRect(0, H - 170, W, 60);
  ctx.fillStyle = "#2fa8c9";
  ctx.fillRect(0, H - 110, W, 110);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd23f";
  ctx.font = "bold 96px Arial, sans-serif";
  ctx.fillText("VICE HEAT", W / 2, 190);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px Arial, sans-serif";
  ctx.fillText("Costa Azul", W / 2, 250);
  ctx.font = "19px Arial, sans-serif";
  ctx.fillText("An original open-city action game — steal cars, run missions, outrun the heat.", W / 2, 300);
  buttons.length = 0;
  drawButton(W / 2 - 130, 360, 260, 56, "New Game", true);
  drawButton(W / 2 - 130, 432, 260, 56, "Continue", hasSave());
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "17px Arial, sans-serif";
  ctx.fillText("WASD / arrows — move & drive · Shift — run · E — enter / exit car", W / 2, 560);
  ctx.fillText("Mouse — aim · Click — shoot · Esc / P — pause", W / 2, 590);
  ctx.textAlign = "left";
}
function drawOverlay(title, sub) {
  ctx.fillStyle = "rgba(8,10,18,0.72)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = title === "BUSTED" ? "#3fa9ff" : title === "WASTED" ? "#ff4040" : "#ffd23f";
  ctx.font = "bold 84px Arial, sans-serif";
  ctx.fillText(title, W / 2, 300);
  ctx.fillStyle = "#ffffff";
  ctx.font = "21px Arial, sans-serif";
  if (sub) ctx.fillText(sub, W / 2, 380);
  buttons.length = 0;
  drawButton(W / 2 - 130, 440, 260, 54, state.mode === "paused" ? "Resume" : "Continue", true);
  ctx.textAlign = "left";
}
function handleClick() {
  if (!input.clicked) return;
  for (const b of buttons) {
    if (!b.enabled) continue;
    if (input.lastClickX >= b.x && input.lastClickX <= b.x + b.w && input.lastClickY >= b.y && input.lastClickY <= b.y + b.h) {
      if (state.mode === "title") {
        if (b.label === "New Game") {
          state.cash = 0; state.missionIndex = 0; state.stageIndex = 0; state.storyComplete = false;
          state.player.x = PLACES.start.x; state.player.y = PLACES.start.y;
          state.mode = "playing";
        } else if (b.label === "Continue") {
          const save = loadSave();
          if (save) {
            state.cash = save.cash; state.missionIndex = save.missionIndex;
            state.storyComplete = save.storyComplete;
            state.player.x = save.x; state.player.y = save.y;
          }
          state.mode = "playing";
        }
      } else if (state.mode === "paused") state.mode = "playing";
      else if (state.mode === "busted") respawn(PLACES.policeStation);
      else if (state.mode === "wasted") respawn(PLACES.hospital);
    }
  }
}

// ---------- boot & loop ----------
populate();
if (shotN >= 1 && shotN <= 4) {
  stageShot(state, shotN);
  state.mode = "playing";
}
let shotFrames = 0;
function frame() {
  const dt = 1; // fixed-step feel: one unit per animation frame
  // In screenshot mode the staged scene freezes once it is flagged ready, so
  // the captured frame is exactly the settled scene however long the capture
  // tool takes to fire.
  const shotFrozen = shotN && window.__shotReady;
  if (state.mode === "playing" || state.mode === "paused") {
    if (state.mode === "playing" && !shotFrozen) update(dt);
    cam.zoom = state.camZoom;
    updateCamera(cam, state, W, H);
    drawWorld(ctx, state, cam, W, H);
    drawHUD(ctx, state, W, H);
    if (state.mode === "paused") drawOverlay("PAUSED", "Take a breath. Costa Azul waits.");
  } else if (state.mode === "title") {
    drawTitle();
  } else if (state.mode === "busted") {
    cam.zoom = state.camZoom;
    updateCamera(cam, state, W, H);
    drawWorld(ctx, state, cam, W, H);
    drawHUD(ctx, state, W, H);
    drawOverlay("BUSTED", state.endMessage);
  } else if (state.mode === "wasted") {
    cam.zoom = state.camZoom;
    updateCamera(cam, state, W, H);
    drawWorld(ctx, state, cam, W, H);
    drawHUD(ctx, state, W, H);
    drawOverlay("WASTED", state.endMessage);
  }
  handleClick();
  if (shotN) {
    applyShotFx(state, shotN);
    // Redraw effects layer for shot 3 so the tracer lands in the final frame.
    if (shotN === 3) { drawWorld(ctx, state, cam, W, H); drawHUD(ctx, state, W, H); }
    shotFrames++;
    if (shotFrames >= 90 && !window.__shotReady) {
      window.__shotReady = true;
      document.title = "SHOT-READY";
    }
  }
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
