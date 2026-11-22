// vehicles.js — car objects, player driving physics, and traffic AI that
// cruises the road grid in lanes, turns at intersections and brakes for
// anything in the way.
import { ROAD_W, TUNING, CAR_COLORS } from "./config.js";
import { roadCentersX, roadCentersY, collidesAt } from "./world.js";
import { pick, clamp, dist, angleLerp } from "./random.js";

let nextCarId = 1;

export function makeCar(x, y, angle, color, kind = "traffic") {
  return {
    id: nextCarId++, x, y, angle, speed: 0, color, kind,
    w: 44, h: 22, health: 100, driver: null, occupied: false,
    steer: 0, skid: 0, lightPhase: Math.random() * 6,
  };
}

// Spawn a traffic car travelling along a random road, in the right-hand lane.
export function spawnTrafficCar(state, rng, nearX, nearY) {
  const xs = roadCentersX();
  const ys = roadCentersY();
  const vertical = rng() < 0.5;
  let x, y, angle;
  if (vertical) {
    const cx = pick(rng, xs);
    x = cx + ROAD_W / 4;
    y = nearY + (rng() < 0.5 ? -1 : 1) * (500 + rng() * 700);
    angle = y < nearY ? Math.PI / 2 : -Math.PI / 2;
    if (angle < 0) x = cx - ROAD_W / 4;
  } else {
    const cy = pick(rng, ys);
    y = cy + ROAD_W / 4;
    x = nearX + (rng() < 0.5 ? -1 : 1) * (500 + rng() * 700);
    angle = x < nearX ? 0 : Math.PI;
    if (angle === Math.PI) y = cy - ROAD_W / 4;
  }
  y = clamp(y, 60, 2180);
  x = clamp(x, 60, 3140);
  const car = makeCar(x, y, angle, pick(rng, CAR_COLORS), "traffic");
  car.speed = TUNING.trafficSpeed;
  state.cars.push(car);
  return car;
}

// Is there a car, ped or officer close ahead of this car?
function obstacleAhead(state, car, lookAhead) {
  const fx = car.x + Math.cos(car.angle) * lookAhead;
  const fy = car.y + Math.sin(car.angle) * lookAhead;
  for (const other of state.cars) {
    if (other === car) continue;
    if (dist(fx, fy, other.x, other.y) < 34) return true;
  }
  for (const p of state.peds) if (dist(fx, fy, p.x, p.y) < 22) return true;
  if (state.player.car !== car && dist(fx, fy, state.player.x, state.player.y) < 22) return true;
  return false;
}

export function updateTrafficCar(state, car, dt) {
  const ahead = obstacleAhead(state, car, 58);
  const target = ahead ? 0 : TUNING.trafficSpeed;
  car.speed += clamp(target - car.speed, -0.12 * dt, 0.05 * dt);
  if (car.speed < 0.05 && !ahead) car.speed = 0.4;

  // At an intersection, sometimes turn onto the crossing road.
  const xs = roadCentersX();
  const ys = roadCentersY();
  const nearX = xs.some((cx) => Math.abs(cx - car.x) < 8);
  const nearY = ys.some((cy) => Math.abs(cy - car.y) < 8);
  if (nearX && nearY && state.rng() < 0.012 * dt) {
    const turns = [0, Math.PI / 2, -Math.PI / 2];
    car.angle += pick(state.rng, turns);
  }

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!collidesAt(state.world, nx, ny, 16)) {
    car.x = nx; car.y = ny;
  } else {
    car.angle += Math.PI / 2; // blocked by a building corner: turn away
  }
  car.angle = Math.atan2(Math.sin(car.angle), Math.cos(car.angle));
}

// Player driving: acceleration, braking, reverse and speed-sensitive steering.
export function updatePlayerCar(state, car, input, dt) {
  const up = input.down("w", "arrowup");
  const down = input.down("s", "arrowdown");
  const left = input.down("a", "arrowleft");
  const right = input.down("d", "arrowright");
  if (up) car.speed += TUNING.carAccel * dt;
  if (down) {
    if (car.speed > 0.4) car.speed -= TUNING.carBrake * dt;
    else car.speed -= TUNING.carAccel * 0.7 * dt;
  }
  if (!up && !down) car.speed *= Math.pow(0.985, dt);
  car.speed = clamp(car.speed, -TUNING.carMaxReverse, TUNING.carMaxSpeed);
  const steerInput = (left ? -1 : 0) + (right ? 1 : 0);
  car.steer = steerInput;
  if (steerInput !== 0 && Math.abs(car.speed) > 0.1) {
    const grip = clamp(Math.abs(car.speed) / 3, 0.35, 1);
    car.angle += steerInput * 0.045 * grip * dt * Math.sign(car.speed);
    if (Math.abs(car.speed) > 4) car.skid = Math.min(1, car.skid + 0.1 * dt);
  }
  car.skid = Math.max(0, car.skid - 0.08 * dt);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!collidesAt(state.world, nx, car.y, 17)) car.x = nx;
  else car.speed *= 0.3;
  if (!collidesAt(state.world, car.x, ny, 17)) car.y = ny;
  else car.speed *= 0.3;

  // Leave fading skid marks when cornering hard.
  if (car.skid > 0.4 && Math.abs(car.speed) > 3) {
    state.skids.push({ x: car.x, y: car.y, life: 300 });
    if (state.skids.length > 220) state.skids.shift();
  }
  state.player.x = car.x;
  state.player.y = car.y;
}

export function carSpeedMph(car) {
  return Math.round(Math.abs(car.speed) * 9);
}
