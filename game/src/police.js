// police.js — the wanted system: stars 0-5, crime reporting, police car
// pursuit AI, foot officers, the bust meter, and wanted decay while unseen.
import { TUNING } from "./config.js";
import { makeCar } from "./vehicles.js";
import { spawnOfficer } from "./people.js";
import { collidesAt } from "./world.js";
import { clamp, dist, angleLerp } from "./random.js";

export function reportCrime(state, stars) {
  state.wanted = clamp(state.wanted + stars, 0, 5);
  state.seenTimer = 0;
  state.decayTimer = 0;
}

// Can any police unit currently see the player?
export function policeCanSee(state) {
  for (const car of state.cars) {
    if (car.kind === "police" && dist(car.x, car.y, state.player.x, state.player.y) < 430) return true;
  }
  for (const ped of state.peds) {
    if (ped.kind === "officer" && ped.state !== "down" && dist(ped.x, ped.y, state.player.x, state.player.y) < 260) return true;
  }
  return false;
}

function spawnPoliceCar(state) {
  const a = state.rng() * Math.PI * 2;
  const d = 620;
  const x = clamp(state.player.x + Math.cos(a) * d, 80, 3120);
  const y = clamp(state.player.y + Math.sin(a) * d, 80, 2180);
  const car = makeCar(x, y, a + Math.PI, "#f4f6f8", "police");
  car.speed = TUNING.policeSpeed;
  state.cars.push(car);
}

function updatePoliceCar(state, car, dt) {
  if (car.parked) { car.lightPhase += dt * 0.35; return; }
  const player = state.player;
  const d = dist(car.x, car.y, player.x, player.y);
  const desired = Math.atan2(player.y - car.y, player.x - car.x);
  car.angle = angleLerp(car.angle, desired, d > 60 ? 0.06 * dt : 0.03 * dt);
  const targetSpeed = d > 70 ? TUNING.policeSpeed + state.wanted * 0.22 : 0.6;
  car.speed += clamp(targetSpeed - car.speed, -0.1 * dt, 0.07 * dt);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!collidesAt(state.world, nx, ny, 17)) { car.x = nx; car.y = ny; }
  else { car.speed = 0; car.angle += 0.5; }
  car.lightPhase += dt * 0.35;

  // An officer hops out when the chase gets close and slow.
  if (d < 130 && Math.abs(car.speed) < 1 && state.wanted >= 2 && state.rng() < 0.004 * dt) {
    const officers = state.peds.filter((p) => p.kind === "officer" && p.state !== "down").length;
    if (officers < 4) spawnOfficer(state, car.x + 24, car.y + 10);
  }
}

export function updatePolice(state, dt) {
  const wanted = state.wanted;
  const policeCars = state.cars.filter((c) => c.kind === "police");

  // Keep the heat proportional to the stars.
  const desiredCars = wanted === 0 ? 0 : wanted + 1;
  if (policeCars.length < desiredCars && state.frame % 90 === 0) spawnPoliceCar(state);
  if (wanted === 0 && policeCars.length) {
    // Heat is off: police peel away and despawn at range.
    for (const car of policeCars) {
      car.angle += 0.01 * dt;
      car.x += Math.cos(car.angle) * 2 * dt;
      car.y += Math.sin(car.angle) * 2 * dt;
      if (dist(car.x, car.y, state.player.x, state.player.y) > 700) {
        state.cars.splice(state.cars.indexOf(car), 1);
      }
    }
  }
  for (const car of state.cars) if (car.kind === "police" && wanted > 0) updatePoliceCar(state, car, dt);

  // Sight and decay.
  const seen = wanted > 0 && policeCanSee(state);
  state.playerSeen = seen;
  if (seen) { state.seenTimer += dt; state.decayTimer = 0; }
  else if (wanted > 0) {
    state.decayTimer += dt;
    const need = TUNING.wantedDecaySeconds * 60;
    if (state.decayTimer >= need) {
      state.wanted -= 1;
      state.decayTimer = 0;
      if (state.wanted === 0) state.bust = 0;
    }
  }

  // Bust meter: sustained close, slow contact with police fills it.
  const player = state.player;
  const playerSpeed = player.car ? Math.abs(player.car.speed) : 0;
  let contact = false;
  if (playerSpeed < 1.6) {
    for (const car of state.cars) {
      if (car.kind === "police" && dist(car.x, car.y, player.x, player.y) < 64) contact = true;
    }
    for (const ped of state.peds) {
      if (ped.kind === "officer" && ped.state !== "down" && dist(ped.x, ped.y, player.x, player.y) < 30) contact = true;
    }
  }
  if (wanted > 0 && contact) state.bust = clamp(state.bust + TUNING.bustFillRate * dt * 0.06, 0, 1);
  else state.bust = clamp(state.bust - TUNING.bustDrainRate * dt * 0.06, 0, 1);
  if (state.bust >= 1) state.pendingBust = true;
}
