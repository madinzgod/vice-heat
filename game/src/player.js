// player.js — articulated low-poly people: the player, pedestrians, NPCs.
// Limbs are separate meshes swung by code, so walking reads as walking.
const M = (c) => new THREE.MeshLambertMaterial({ color: c });
function limb(parent, w, h, d, mat, x, y, z) {
  const geo = new THREE.BoxGeometry(w, h, d); geo.translate(0, -h / 2, 0); // pivot at top
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m;
}
export const SKIN = [0xf2c49b, 0xc98d5e, 0x8a5a34, 0x6e4226, 0xffd9b3];
export const SHIRTS = [0xff5e78, 0x37c8d9, 0xffb347, 0x9be15d, 0xf8f9fa, 0x8338ec, 0xff7ad9, 0x2a9d8f, 0xe63946, 0x4361ee];

export function makePerson({ skin = 0xf2c49b, shirt = 0xff5e78, pants = 0x2b3a55, hair = 0x2a1a12, cap = 0 } = {}) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), M(shirt));
  torso.position.y = 1.12; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.4), M(skin));
  head.position.y = 1.74; g.add(head);
  const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.44), M(hair));
  hairM.position.y = 1.97; g.add(hairM);
  if (cap) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.6), M(cap)); c.position.set(0, 1.96, -0.06); g.add(c); }
  const armL = limb(g, 0.17, 0.68, 0.17, M(shirt), -0.41, 1.46, 0);
  const armR = limb(g, 0.17, 0.68, 0.17, M(shirt), 0.41, 1.46, 0);
  const legL = limb(g, 0.21, 0.78, 0.21, M(pants), -0.17, 0.76, 0);
  const legR = limb(g, 0.21, 0.78, 0.21, M(pants), 0.17, 0.76, 0);
  // gun prop, shown when aiming
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.44), M(0x14181f));
  gun.position.set(0, -0.66, -0.2); armR.add(gun); gun.visible = false;
  g.userData = { armL, armR, legL, legR, gun, phase: Math.random() * 6 };
  return g;
}
export function animatePerson(g, speed, dt, aiming = false) {
  const u = g.userData; u.phase += dt * (4 + speed * 1.6);
  const s = Math.min(1, speed / 3) * 0.75, ph = u.phase;
  u.legL.rotation.x = Math.sin(ph) * s; u.legR.rotation.x = -Math.sin(ph) * s;
  if (aiming) { u.armR.rotation.x = -1.5; u.armL.rotation.x = -1.35; }
  else { u.armL.rotation.x = -Math.sin(ph) * s * 0.8; u.armR.rotation.x = Math.sin(ph) * s * 0.8; }
  g.position.y = Math.abs(Math.sin(ph)) * 0.05 * Math.min(1, speed / 3);
}

// The player: Rico Alvarez, recently back in Costa Azul.
export class Player {
  constructor(scene) {
    this.mesh = makePerson({ skin: 0xc98d5e, shirt: 0xff7a3c, pants: 0x24344d, hair: 0x14100c, cap: 0xe63946 });
    this.mesh.position.set(10, 0, 52); scene.add(this.mesh);
    this.x = 10; this.z = 52; this.ry = 0; this.health = 100; this.armour = 50;
    this.inCar = null; this.aiming = false; this.speedNow = 0;
  }
  get pos() { return this.mesh.position; }
  update(dt, input, camYaw, collideFn) {
    if (this.inCar) { this.mesh.visible = false; this.x = this.inCar.x; this.z = this.inCar.z; this.ry = this.inCar.ry; return; }
    this.mesh.visible = true;
    let mx = 0, mz = 0;
    if (input.up) mz -= 1; if (input.down) mz += 1;
    if (input.left) mx -= 1; if (input.right) mx += 1;
    const moving = (mx !== 0 || mz !== 0);
    const spd = input.run ? 8.2 : 4.4;
    this.speedNow = moving ? spd : 0;
    if (moving) {
      const len = Math.hypot(mx, mz); mx /= len; mz /= len;
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      const wx = mx * cos - mz * sin, wz = mx * sin + mz * cos;
      this.x += wx * spd * dt; this.z += wz * spd * dt;
      const target = Math.atan2(wx, wz);
      let d = target - this.ry;
      while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      this.ry += d * Math.min(1, dt * 12);
    }
    if (this.aiming) this.ry = camYaw + Math.PI;
    const [cx, cz] = collideFn(this.x, this.z, 0.55);
    this.x = cx; this.z = cz;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.ry;
    animatePerson(this.mesh, this.speedNow, dt, this.aiming);
  }
  hurt(n) {
    const absorbed = Math.min(this.armour, n * 0.6);
    this.armour -= absorbed; this.health -= (n - absorbed);
    return this.health <= 0;
  }
}

// Pedestrians strolling the sidewalks and the market.
export class Crowd {
  constructor(scene, count = 16) {
    this.peds = [];
    const walks = [
      { axis: 'x', from: -80, to: 80, fixed: 53.5 }, { axis: 'x', from: -80, to: 80, fixed: 70.5 },
      { axis: 'z', from: -80, to: 52, fixed: -14.5 }, { axis: 'z', from: -80, to: 52, fixed: 29.5 },
      { axis: 'x', from: 26, to: 76, fixed: -14.6 }, { axis: 'x', from: -80, to: 80, fixed: -29.5 },
    ];
    for (let i = 0; i < count; i++) {
      const mesh = makePerson({
        skin: SKIN[i % SKIN.length], shirt: SHIRTS[(i * 3) % SHIRTS.length],
        pants: [0x2b3a55, 0x55422b, 0x333333, 0x704214][i % 4], hair: [0x14100c, 0x4a2c14, 0x888888, 0xd9b23c][i % 4],
      });
      scene.add(mesh);
      const w = walks[i % walks.length];
      this.peds.push({ mesh, w, t: Math.random(), dir: i % 2 ? 1 : -1, speed: 1.1 + (i % 5) * 0.22 });
    }
  }
  update(dt) {
    for (const p of this.peds) {
      const span = p.w.to - p.w.from;
      p.t += p.dir * p.speed * dt / span;
      if (p.t > 1) { p.t = 1; p.dir = -1; } if (p.t < 0) { p.t = 0; p.dir = 1; }
      const v = p.w.from + span * p.t;
      if (p.w.axis === 'x') { p.mesh.position.set(v, 0, p.w.fixed); p.mesh.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { p.mesh.position.set(p.w.fixed, 0, v); p.mesh.rotation.y = p.dir > 0 ? Math.PI : 0; }
      animatePerson(p.mesh, p.speed, dt);
    }
  }
}
