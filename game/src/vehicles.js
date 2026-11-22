// vehicles.js — low-poly car factory, arcade driving physics, traffic AI.
import { TRAFFIC_LOOP, collide } from './world.js';

const M = (c, e = 0, ei = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e, emissiveIntensity: ei });
function part(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); parent.add(m); return m;
}
const CAR_COLORS = [0xe63946, 0x2a9d8f, 0xf4a261, 0x4361ee, 0x8338ec, 0xffbe0b, 0xf8f9fa, 0x06d6a0, 0xef476f, 0x118ab2];

// Builds one car. kind: 'sedan' | 'coupe' | 'pickup' | 'police'
export function makeCar(color, kind = 'sedan') {
  const g = new THREE.Group();
  const body = M(color), dark = M(0x14181f), glass = M(0x9fd8e8);
  const L = kind === 'pickup' ? 4.9 : 4.4, W = 1.9;
  part(g, W, 0.55, L, body, 0, 0.55, 0);                       // lower body
  part(g, W - 0.15, 0.3, L * 0.5, body, 0, 0.9, 0.2);          // shoulder
  if (kind === 'pickup') {
    part(g, W - 0.2, 0.75, 1.5, body, 0, 1.25, -L * 0.28);     // cab
    part(g, W - 0.35, 0.5, 1.1, glass, 0, 1.3, -L * 0.28);
    part(g, W - 0.1, 0.35, L * 0.42, dark, 0, 0.95, L * 0.26); // bed
  } else {
    const cabL = kind === 'coupe' ? L * 0.42 : L * 0.5;
    part(g, W - 0.3, 0.62, cabL, glass, 0, 1.18, kind === 'coupe' ? 0.25 : 0);
    part(g, W - 0.45, 0.14, cabL - 0.5, body, 0, 1.55, kind === 'coupe' ? 0.25 : 0); // roof
    if (kind === 'coupe') part(g, W - 0.2, 0.12, 0.7, body, 0, 1.05, L * 0.44);      // spoiler base
  }
  if (kind === 'police') {
    part(g, W + 0.02, 0.4, L * 0.96, M(0xf4f6f8), 0, 0.62, 0); // white band overpaint look
    part(g, W, 0.56, L, body, 0, 0.55, 0);
    const bar = part(g, 1.3, 0.18, 0.5, dark, 0, 1.72, 0);
    const rl = part(g, 0.55, 0.14, 0.4, M(0xff2222, 0xff2222, 1), -0.34, 1.86, 0);
    const bl = part(g, 0.55, 0.14, 0.4, M(0x2266ff, 0x2266ff, 1), 0.34, 1.86, 0);
    g.userData.lightbar = [rl, bl, bar];
    part(g, 0.9, 0.5, 0.1, dark, 0, 0.75, -L / 2 - 0.03);     // push bar
  }
  // lights: headlights + tail lights
  const hl = M(0xfff6c9, 0xffedb0, 0.7), tl = M(0xff2a2a, 0xaa0000, 0.8);
  part(g, 0.42, 0.16, 0.06, hl, -0.6, 0.68, -L / 2 - 0.01);
  part(g, 0.42, 0.16, 0.06, hl, 0.6, 0.68, -L / 2 - 0.01);
  part(g, 0.42, 0.14, 0.06, tl, -0.6, 0.7, L / 2 + 0.01);
  part(g, 0.42, 0.14, 0.06, tl, 0.6, 0.7, L / 2 + 0.01);
  // wheels
  const wg = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
  const wheels = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const w = new THREE.Mesh(wg, dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * (W / 2 - 0.05), 0.36, sz * (L / 2 - 0.85));
    g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels; g.userData.len = L;
  return g;
}

// A drivable car entity wrapping a mesh.
export class Car {
  constructor(scene, x, z, ry, color, kind = 'sedan') {
    this.mesh = makeCar(color, kind); this.mesh.position.set(x, 0, z); this.mesh.rotation.y = ry;
    scene.add(this.mesh);
    this.x = x; this.z = z; this.ry = ry; this.speed = 0; this.kind = kind;
    this.maxSpeed = kind === 'police' ? 34 : kind === 'coupe' ? 32 : 27;
    this.health = 100;
  }
  get pos() { return this.mesh.position; }
  // input: {up,down,left,right}; returns speed km/h
  drive(dt, input, others) {
    const accel = input.up ? 17 : input.down ? (this.speed > 0.5 ? -26 : -9) : 0;
    this.speed += accel * dt;
    if (!input.up && !input.down) this.speed -= this.speed * 0.55 * dt;      // drag
    this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 3.2 * dt); // rolling friction
    this.speed = Math.max(-11, Math.min(this.maxSpeed, this.speed));
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    if (Math.abs(this.speed) > 0.2) this.ry += steer * 1.65 * dt * Math.sign(this.speed) * Math.min(1, Math.abs(this.speed) / 9);
    let nx = this.x - Math.sin(this.ry) * this.speed * dt;
    let nz = this.z - Math.cos(this.ry) * this.speed * dt;
    // soft car-vs-car push
    for (const o of others) {
      if (o === this) continue;
      const dx = nx - o.x, dz = nz - o.z, d2 = dx * dx + dz * dz;
      if (d2 < 9 && d2 > 0.001) { const d = Math.sqrt(d2); nx = o.x + dx / d * 3; nz = o.z + dz / d * 3; this.speed *= 0.55; o.speed = (o.speed || 0) * 0.8; }
    }
    const [cx, cz] = collide(nx, nz, 1.25);
    if (Math.abs(cx - nx) > 0.01 || Math.abs(cz - nz) > 0.01) this.speed *= 0.45; // building scrape
    this.x = cx; this.z = cz;
    this.mesh.position.set(this.x, Math.abs(this.speed) > 1 ? Math.sin(performance.now() * 0.03) * 0.012 : 0, this.z);
    this.mesh.rotation.y = this.ry;
    for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * dt / 0.36;
    return Math.abs(this.speed) * 3.6;
  }
  // simple pursuit / waypoint driving used by traffic and police
  seek(dt, tx, tz, speedCap, others) {
    const dx = tx - this.x, dz = tz - this.z;
    const dist = Math.hypot(dx, dz);
    const targetRy = Math.atan2(-dx, -dz);
    let diff = targetRy - this.ry;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.ry += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 3.2 * dt));
    const want = Math.min(speedCap, dist * 1.2 + 4);
    this.speed += Math.max(-22 * dt, Math.min(13 * dt, want - this.speed));
    let nx = this.x - Math.sin(this.ry) * this.speed * dt;
    let nz = this.z - Math.cos(this.ry) * this.speed * dt;
    for (const o of others) {
      if (o === this) continue;
      const ox = nx - o.x, oz = nz - o.z, d2 = ox * ox + oz * oz;
      if (d2 < 8 && d2 > 0.001) { const d = Math.sqrt(d2); nx = o.x + ox / d * 2.85; nz = o.z + oz / d * 2.85; this.speed *= 0.6; }
    }
    const [cx, cz] = collide(nx, nz, 1.25);
    if (Math.abs(cx - nx) > 0.01 || Math.abs(cz - nz) > 0.01) { this.speed *= 0.4; this.ry += 0.7 * dt; }
    this.x = cx; this.z = cz;
    this.mesh.position.set(this.x, 0, this.z); this.mesh.rotation.y = this.ry;
    for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * dt / 0.36;
    return dist;
  }
}

// Traffic: cars circulating the loop in both directions.
export class Traffic {
  constructor(scene, count = 9) {
    this.cars = [];
    for (let i = 0; i < count; i++) {
      const t = i / count, seg = Math.floor(t * TRAFFIC_LOOP.length);
      const a = TRAFFIC_LOOP[seg], b = TRAFFIC_LOOP[(seg + 1) % TRAFFIC_LOOP.length];
      const f = (t * TRAFFIC_LOOP.length) % 1;
      const x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f;
      const kinds = ['sedan', 'coupe', 'pickup', 'sedan', 'coupe'];
      const car = new Car(scene, x, z, Math.atan2(-(b.x - a.x), -(b.z - a.z)), CAR_COLORS[i % CAR_COLORS.length], kinds[i % kinds.length]);
      car.seg = seg; car.cruise = 10 + (i % 4);
      this.cars.push(car);
    }
  }
  update(dt, playerCar) {
    const all = playerCar ? [...this.cars, playerCar] : this.cars;
    for (const c of this.cars) {
      const wp = TRAFFIC_LOOP[(c.seg + 1) % TRAFFIC_LOOP.length];
      if (c.seek(dt, wp.x, wp.z, c.cruise, all) < 3.5) c.seg = (c.seg + 1) % TRAFFIC_LOOP.length;
    }
  }
}

// Parked cars the player can steal.
export function parkedCars(scene) {
  const spots = [
    [14, 55.5, 0.2, 0xe63946, 'coupe'], [-30, 30, 1.62, 0xffbe0b, 'sedan'], [30, -30, -1.5, 0x4361ee, 'sedan'],
    [-58, -14, 0.1, 0x06d6a0, 'pickup'], [58, 14, 3.1, 0xf8f9fa, 'sedan'], [-14, -58, 1.57, 0xef476f, 'coupe'],
    [44, 71, 1.62, 0x8338ec, 'coupe'], [-44, -71, -1.57, 0x118ab2, 'pickup'],
  ];
  return spots.map(([x, z, ry, c, k]) => new Car(scene, x, z, ry, c, k));
}
