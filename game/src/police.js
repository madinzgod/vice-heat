// police.js — Costa Azul PD: pursuit cars that chase and box the player,
// plus the patrol helicopter that joins at four stars and up.
import { Car } from './vehicles.js';

const M = (c, e = 0, ei = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e, emissiveIntensity: ei });

export function makeHelicopter() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.7, 4.4), M(0xf4f6f8)); g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 1.2), M(0x9fd8e8)); nose.position.set(0, -0.1, -2.6); g.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.6), M(0x2456a6)); tail.position.set(0, 0.25, 4.2); g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.3, 0.7), M(0x2456a6)); fin.position.set(0, 0.7, 6.3); g.add(fin);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.4, 4.44), M(0x2456a6)); stripe.position.y = -0.45; g.add(stripe);
  const rotor = new THREE.Group(); rotor.position.y = 1.15;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.07, 0.5), M(0x22262c)); rotor.add(blade);
  const blade2 = blade.clone(); blade2.rotation.y = Math.PI / 2; rotor.add(blade2); g.add(rotor);
  const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 3.4, 16, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  spot.position.y = -8.6; g.add(spot);
  g.userData = { rotor, spot };
  return g;
}

export class Police {
  constructor(scene) {
    this.scene = scene; this.cars = []; this.wanted = 0;
    this.heli = makeHelicopter(); this.heli.visible = false; scene.add(this.heli);
    this.heliAngle = 0; this.flash = 0; this.heat = 0;
  }
  setWanted(n) { this.wanted = Math.max(0, Math.min(5, n)); }
  crime(points = 1) { this.heat += points; if (this.heat > 2.2) { this.setWanted(this.wanted + 1); this.heat = 0; } }
  update(dt, target, allCars, t) {
    const want = this.wanted === 0 ? 0 : [0, 1, 2, 3, 4, 5][this.wanted];
    // spawn / retire units to match the wanted level
    while (this.cars.length < want) {
      const a = Math.random() * Math.PI * 2, d = 34 + Math.random() * 14;
      const x = Math.max(-92, Math.min(92, target.x + Math.sin(a) * d));
      const z = Math.max(-92, Math.min(104, target.z + Math.cos(a) * d));
      this.cars.push(new Car(this.scene, x, z, a, 0x1c2733, 'police'));
    }
    while (this.cars.length > want) { const c = this.cars.pop(); this.scene.remove(c.mesh); }
    const all = [...allCars, ...this.cars];
    this.cars.forEach((c, i) => {
      // aim ahead of the target so units cut it off and box it in
      const lead = 0.55, off = (i - (this.cars.length - 1) / 2) * 3.4;
      const tx = target.x + Math.sin(target.ry || 0) * -lead * (target.speed || 0) + off;
      const tz = target.z + Math.cos(target.ry || 0) * -lead * (target.speed || 0);
      c.seek(dt, tx, tz, c.maxSpeed * (0.82 + this.wanted * 0.05), all);
      const lb = c.mesh.userData.lightbar;
      if (lb) { this.flash += dt * 9; const on = Math.sin(this.flash + i * 2) > 0; lb[0].material.emissiveIntensity = on ? 2.4 : 0.1; lb[1].material.emissiveIntensity = on ? 0.1 : 2.4; }
      // ramming contact drains the player's health slowly
      const d = Math.hypot(c.x - target.x, c.z - target.z);
      if (d < 2.6 && target.onRam) target.onRam(dt, c);
    });
    // helicopter at 4+ stars: circles the target with its spotlight
    this.heli.visible = this.wanted >= 4;
    if (this.heli.visible) {
      this.heliAngle += dt * 0.55;
      const hx = target.x + Math.cos(this.heliAngle) * 13, hz = target.z + Math.sin(this.heliAngle) * 13;
      this.heli.position.set(hx, 15.5 + Math.sin(t * 1.3) * 0.7, hz);
      this.heli.rotation.y = Math.atan2(-(target.x - hx), -(target.z - hz));
      this.heli.userData.rotor.rotation.y += dt * 28;
    }
    // heat decays when no police can see the player
    if (this.wanted > 0 && this.cars.every(c => Math.hypot(c.x - target.x, c.z - target.z) > 46)) {
      this.heat -= dt * 0.25;
      if (this.heat < -6) { this.setWanted(this.wanted - 1); this.heat = 0; }
    }
  }
}
