// people.js — pedestrians who stroll the sidewalks and plazas, flee from
// danger, and police officers who pursue the player on foot.
import { SHIRT_COLORS, TUNING } from "./config.js";
import { moveWithCollision, nearestRoadX, nearestRoadY } from "./world.js";
import { pick, randRange, dist } from "./random.js";

let nextPedId = 1;

export function makePed(x, y, rng, kind = "civilian") {
  return {
    id: nextPedId++, x, y, kind,
    angle: rng() * Math.PI * 2,
    speed: kind === "officer" ? 2.5 : randRange(rng, 0.7, 1.3),
    color: kind === "officer" ? "#2456c8" : pick(rng, SHIRT_COLORS),
    health: kind === "officer" ? 70 : 40,
    state: "wander", // wander | flee | chase | down
    wanderT: randRange(rng, 60, 300),
    shootCd: 0, legPhase: rng() * 6,
  };
}

// Scatter a crowd along the sidewalks near a point.
export function spawnCrowd(state, cx, cy, count, rng) {
  const made = [];
  for (let i = 0; i < count; i++) {
    const onVertical = rng() < 0.5;
    const x = onVertical ? nearestRoadX(cx) + (rng() < 0.5 ? -58 : 58) + randRange(rng, -8, 8) : cx + randRange(rng, -190, 190);
    const y = onVertical ? cy + randRange(rng, -190, 190) : nearestRoadY(cy) + (rng() < 0.5 ? -58 : 58) + randRange(rng, -8, 8);
    const ped = makePed(x, y, rng);
    state.peds.push(ped);
    made.push(ped);
  }
  return made;
}

export function spawnOfficer(state, x, y) {
  const ped = makePed(x, y, state.rng, "officer");
  ped.state = "chase";
  state.peds.push(ped);
  return ped;
}

function fleeFrom(ped, threatX, threatY) {
  ped.angle = Math.atan2(ped.y - threatY, ped.x - threatX);
  ped.state = "flee";
}

export function updatePed(state, ped, dt) {
  if (ped.state === "down" || ped.parked) return;
  ped.legPhase += dt * 0.25 * ped.speed;
  ped.shootCd = Math.max(0, ped.shootCd - dt);
  const player = state.player;
  const dPlayer = dist(ped.x, ped.y, player.x, player.y);
  const danger = state.recentDanger; // {x,y,t} of the last shot / hit nearby

  if (ped.kind === "officer") {
    updateOfficer(state, ped, dPlayer, dt);
    return;
  }

  if (danger && danger.t > 0 && dist(ped.x, ped.y, danger.x, danger.y) < 190) {
    fleeFrom(ped, danger.x, danger.y);
  } else if (ped.state === "flee" && dPlayer > 190) {
    ped.state = "wander";
  }

  if (ped.state === "flee") {
    const step = 2.3 * dt;
    const moved = moveWithCollision(state.world, ped.x, ped.y, Math.cos(ped.angle) * step, Math.sin(ped.angle) * step, 9);
    ped.x = moved.x; ped.y = moved.y;
    return;
  }

  // Wander: stroll, occasionally picking a new heading along the sidewalk.
  ped.wanderT -= dt;
  if (ped.wanderT <= 0) {
    ped.wanderT = randRange(state.rng, 90, 320);
    ped.angle = state.rng() * Math.PI * 2;
  }
  const step = ped.speed * dt;
  const moved = moveWithCollision(state.world, ped.x, ped.y, Math.cos(ped.angle) * step, Math.sin(ped.angle) * step, 9);
  if (moved.x === ped.x && moved.y === ped.y) ped.angle += Math.PI * 0.75;
  ped.x = moved.x; ped.y = moved.y;
}

function updateOfficer(state, ped, dPlayer, dt) {
  const player = state.player;
  if (state.wanted === 0) { ped.state = "wander"; }
  if (ped.state === "wander") {
    ped.wanderT -= dt;
    if (ped.wanderT <= 0) { ped.wanderT = 200; ped.angle = state.rng() * Math.PI * 2; }
    const moved = moveWithCollision(state.world, ped.x, ped.y, Math.cos(ped.angle) * 0.8 * dt, Math.sin(ped.angle) * 0.8 * dt, 9);
    ped.x = moved.x; ped.y = moved.y;
    return;
  }
  // Chase the player; keep a little distance and shoot when armed and close.
  ped.angle = Math.atan2(player.y - ped.y, player.x - ped.x);
  if (dPlayer > 26) {
    const step = ped.speed * dt;
    const moved = moveWithCollision(state.world, ped.x, ped.y, Math.cos(ped.angle) * step, Math.sin(ped.angle) * step, 9);
    ped.x = moved.x; ped.y = moved.y;
  }
  if (state.wanted >= 3 && dPlayer < 240 && ped.shootCd <= 0 && !player.car) {
    ped.shootCd = 55 + state.rng() * 40;
    state.enemyShots.push({ x: ped.x, y: ped.y, tx: player.x, ty: player.y, life: 6 });
    if (state.rng() < 0.55) player.health -= TUNING.copBulletDamage;
    state.audio.play("shot");
  }
}
