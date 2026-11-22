// world.js — Costa Azul: road grid, art-deco blocks, boulevard, marina, beach.
// Everything is built from flat-shaded boxes/planes; window and sign faces use
// small canvas textures drawn in code (original art, no external assets).
export const ROAD_X = [-66, -22, 22, 66];       // north-south road centre lines
export const ROAD_Z = [-66, -22, 22];           // east-west road centre lines
export const BOULEVARD_Z = 62;                  // beachfront boulevard
export const CITY = 86;                         // half-extent of the built city
export const colliders = [];                    // {x,z,hw,hd} building footprints

const M = (c, e = 0x000000, ei = 0) =>
  new THREE.MeshLambertMaterial({ color: c, emissive: e, emissiveIntensity: ei });
function box(w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.y = ry; return m;
}
function mulberry(seed) { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---- canvas textures: lit windows + shop signs (drawn, original) ----
function windowTexture(base, litRatio, rng) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 120; y += 12) for (let x = 6; x < 58; x += 12) {
    const lit = rng() < litRatio;
    g.fillStyle = lit ? (rng() < .5 ? '#ffd98a' : '#bfe8ff') : '#1d2a3d';
    g.fillRect(x, y, 7, 8);
  }
  const t = new THREE.CanvasTexture(c); return t;
}
function signTexture(text, bg, fg) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 256, 64);
  g.font = '900 34px Verdana'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = fg; g.shadowBlur = 16; g.fillStyle = fg; g.fillText(text, 128, 34);
  return new THREE.CanvasTexture(c);
}

export function applyLighting(scene, lights, preset) {
  const P = {
    day:  { sky: 0x8fd8ff, fog: 0xaadcf5, fogD: 0.0016, sun: 0xfff2d8, sunI: 1.05, amb: 0.75, sunPos: [60, 90, 40] },
    dusk: { sky: 0x3a2b5e, fog: 0x6b4a7a, fogD: 0.0022, sun: 0xff9a5c, sunI: 0.75, amb: 0.5,  sunPos: [-80, 26, 60] },
    night:{ sky: 0x0a1226, fog: 0x0d1830, fogD: 0.0026, sun: 0x8fb4ff, sunI: 0.32, amb: 0.34, sunPos: [-40, 70, -30] },
  }[preset];
  scene.background = new THREE.Color(P.sky);
  scene.fog = new THREE.FogExp2(P.fog, P.fogD);
  lights.sun.color.setHex(P.sun); lights.sun.intensity = P.sunI;
  lights.sun.position.set(...P.sunPos);
  lights.hemi.intensity = P.amb;
  return P;
}

export function buildWorld(scene) {
  const rng = mulberry(20261122);
  const grp = new THREE.Group(); scene.add(grp);
  const animated = { water: null, beacons: [], lampHeads: [] };

  // ---------- ground, beach, sea ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), M(0x77b06a));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; grp.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(420, 30), M(0xf2d492));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.0, 99); grp.add(sand);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(420, 190),
    new THREE.MeshLambertMaterial({ color: 0x1d7fa8, transparent: true, opacity: 0.92 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0.12, 208); grp.add(water);
  animated.water = water;
  // beach umbrellas + towels
  const umbCols = [0xff5e78, 0xffb347, 0x37c8d9, 0xff7ad9];
  for (let i = 0; i < 14; i++) {
    const x = -78 + i * 12 + rng() * 4, z = 92 + rng() * 8;
    const pole = box(0.18, 2.2, 0.18, M(0xe8e8e8), x, 1.1, z); grp.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.8, 8), M(umbCols[i % 4]));
    top.position.set(x, 2.3, z); grp.add(top);
    grp.add(box(1.8, 0.06, 0.9, M(umbCols[(i + 1) % 4]), x + 1.4, 0.05, z + 0.6, rng()));
  }

  // ---------- roads ----------
  const roadMat = M(0x333a44), lineMat = M(0xf5f2e4), laneMat = M(0xffcf4d);
  function road(cx, cz, w, l, vertical) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? w : l, vertical ? l : w), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(cx, 0.02, cz); grp.add(r);
    // dashed centre line
    const n = Math.floor(l / 6);
    for (let i = 0; i < n; i++) {
      const off = -l / 2 + 3 + i * 6;
      const d = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? 0.35 : 3, vertical ? 3 : 0.35), laneMat);
      d.rotation.x = -Math.PI / 2;
      d.position.set(vertical ? cx : cx + off, 0.035, vertical ? cz + off : cz); grp.add(d);
    }
    // edge lines
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? 0.25 : l, vertical ? l : 0.25), lineMat);
      e.rotation.x = -Math.PI / 2;
      e.position.set(vertical ? cx + s * (w / 2 - 0.4) : cx, 0.033, vertical ? cz : cz + s * (w / 2 - 0.4)); grp.add(e);
    }
  }
  for (const x of ROAD_X) road(x, 0, 12, 172, true);
  for (const z of ROAD_Z) road(0, z, 12, 172, false);
  road(0, BOULEVARD_Z, 15, 190, false);
  // crosswalks at every intersection
  for (const x of ROAD_X) for (const z of [...ROAD_Z, BOULEVARD_Z])
    for (let i = -2; i <= 2; i++) {
      const s = box(0.8, 0.02, 3.4, lineMat, x + i * 1.7, 0.04, z - 7.6); grp.add(s);
      const s2 = box(3.4, 0.02, 0.8, lineMat, x - 7.6, 0.04, z + i * 1.7); grp.add(s2);
    }
  // sidewalks: light slabs framing each block
  const walkMat = M(0xb9c0c7);
  for (let bx = 0; bx < 3; bx++) for (let bz = 0; bz < 4; bz++) {
    const x0 = ROAD_X[bx] + 8, x1 = (ROAD_X[bx + 1] ?? 92) - 8;
    const zs = [...ROAD_Z, BOULEVARD_Z, 92];
    const z0 = zs[bz] + (bz === 3 ? 9.5 : 8), z1 = zs[bz + 1] - 8;
    if (x1 - x0 < 8 || z1 - z0 < 8) continue;
    const slab = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 3, z1 - z0 + 3), walkMat);
    slab.rotation.x = -Math.PI / 2; slab.position.set((x0 + x1) / 2, 0.045, (z0 + z1) / 2); grp.add(slab);
  }

  // ---------- buildings ----------
  const palette = [0xf6e3c5, 0xf9c6c0, 0xbfe3dd, 0xfde68a, 0xd6c8f0, 0xffd9a0, 0xcfe8ff, 0xf3f0e6];
  const signs = [['AZUL HOTEL', '#2b1055', '#ff7ad9'], ['CAFÉ SOL', '#3d1c02', '#ffb347'], ['MARINA INN', '#02283d', '#7ce7ff'],
    ['CLUB NEÓN', '#26043d', '#c77dff'], ['PALMA SUITES', '#33200a', '#ffe9b0'], ['BANCO AZUL', '#0a2436', '#9fd8ff']];
  const shopSigns = [['FRUTAS', '#123524', '#9be15d'], ['TACOS SOL', '#3d1c02', '#ffb347'], ['BAR AZUL', '#0a2436', '#7ce7ff'],
    ['DISCOS', '#26043d', '#ff7ad9'], ['HELADOS', '#3d0a24', '#ffd1e8'], ['FARMACIA', '#0d2b1a', '#8affc1'],
    ['LIBROS', '#2b1a05', '#ffe9b0'], ['SURF SHOP', '#02283d', '#7ce7ff']];
  let signIdx = 0;
  for (let bx = 0; bx < 3; bx++) for (let bz = 0; bz < 4; bz++) {
    const x0 = ROAD_X[bx] + 9, x1 = (ROAD_X[bx + 1] ?? 90) - 9;
    const zs = [...ROAD_Z, BOULEVARD_Z, 90];
    const z0 = zs[bz] + 9, z1 = zs[bz + 1] - 9;
    const bw = x1 - x0, bd = z1 - z0; if (bw < 10 || bd < 10) continue;
    const downtown = bx === 1 && bz <= 1;
    const cols = downtown ? 2 : 1, rows = downtown ? 2 : 1;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const w = bw / cols - 3, d = bd / rows - 3;
      const cx = x0 + (i + .5) * bw / cols, cz = z0 + (j + .5) * bd / rows;
      const h = downtown ? 15 + rng() * 25 : 6.5 + rng() * 13.5;
      const base = '#' + palette[Math.floor(rng() * palette.length)].toString(16).padStart(6, '0');
      const tex = windowTexture(base, downtown ? .55 : .35, rng);
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(cx, h / 2, cz); grp.add(b);
      grp.add(box(w + 0.7, 0.5, d + 0.7, M(0x8a5a3b), cx, h + 0.25, cz)); // roof lip
      if (rng() < .5) grp.add(box(2.4, 1.1, 2.4, M(0x9aa4ae), cx + w / 4, h + 0.8, cz)); // roof unit
      colliders.push({ x: cx, z: cz, hw: w / 2 + 0.4, hd: d / 2 + 0.4 });
      // ---- street-level detail: glassy storefront band, warm glow strip,
      // fascia, striped awnings on all four faces, balcony/cornice strips ----
      const trim = M(palette[Math.floor(rng() * palette.length)]);
      const awnM = M([0xe63946, 0x2a9d8f, 0xffb347, 0x4361ee, 0xff7ad9][Math.floor(rng() * 5)]);
      grp.add(box(w + 0.35, 1.7, d + 0.35, M(0x22344c), cx, 0.9, cz)); // storefront glass
      grp.add(box(w + 0.42, 0.42, d + 0.42, M(0xffca7a, 0xff9a3c, 0.5), cx, 1.32, cz)); // glow strip
      grp.add(box(w + 0.5, 0.22, d + 0.5, trim, cx, 1.88, cz)); // fascia
      for (const s of [-1, 1]) {
        const a1 = box(w * 0.74, 0.1, 1.2, awnM, cx, 2.2, cz + s * (d / 2 + 0.55)); a1.rotation.x = s * 0.34; grp.add(a1);
        const a2 = box(1.2, 0.1, d * 0.74, awnM, cx + s * (w / 2 + 0.55), 2.2, cz); a2.rotation.z = -s * 0.34; grp.add(a2);
      }
      for (let f = 1; f <= 3; f++) { // balcony strips: perimeter frame only, never a solid slab
        const by = h * f / 3.4;
        if (by > 3.2 && by < h - 1.4) {
          grp.add(box(w + 0.6, 0.26, 0.6, trim, cx, by, cz - d / 2 - 0.05));
          grp.add(box(w + 0.6, 0.26, 0.6, trim, cx, by, cz + d / 2 + 0.05));
          grp.add(box(0.6, 0.26, d + 0.6, trim, cx - w / 2 - 0.05, by, cz));
          grp.add(box(0.6, 0.26, d + 0.6, trim, cx + w / 2 + 0.05, by, cz));
        }
      }
      if (signIdx < shopSigns.length && rng() < .8) { // small shop sign over the storefront
        const [txt, bg, fg] = shopSigns[signIdx++];
        const s = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * .62, 7.5), 1.05),
          new THREE.MeshBasicMaterial({ map: signTexture(txt, bg, fg) }));
        s.position.set(cx, 2.55, cz - d / 2 - 0.24); s.rotation.y = Math.PI; grp.add(s);
      }
      if (h > 13 && signIdx < signs.length) { // neon sign facing the nearest road
        const [txt, bg, fg] = signs[signIdx++];
        const s = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * .9, 13), 3),
          new THREE.MeshBasicMaterial({ map: signTexture(txt, bg, fg) }));
        s.position.set(cx, h - 2.2, cz - d / 2 - 0.06); s.rotation.y = Math.PI; grp.add(s);
      }
    }
  }

  // ---------- palms + street lamps ----------
  const trunkM = M(0x8a6a42), leafM = M(0x2f9e57);
  const leafGeo = new THREE.BoxGeometry(3.0, 0.07, 0.4); leafGeo.translate(1.45, 0, 0); // pivot at frond base
  const tipGeo = new THREE.BoxGeometry(1.25, 0.06, 0.3); tipGeo.translate(0.6, 0, 0);
  const leafM2 = M(0x37b268);
  function palm(x, z, s = 1) {
    const g = new THREE.Group();
    const trunk = box(0.32, 4.6, 0.32, trunkM, 0, 2.3, 0); trunk.rotation.z = 0.09; g.add(trunk);
    const crown = new THREE.Group(); crown.position.set(0.42, 4.68, 0); g.add(crown);
    for (let i = 0; i < 8; i++) { // eight drooped fronds, each with a downturned tip
      const yaw = new THREE.Group(); yaw.rotation.y = i * Math.PI / 4 + (i % 2) * 0.16;
      const frond = new THREE.Group(); frond.rotation.z = -0.3 - (i % 3) * 0.16; // gentle arc
      const leaf = new THREE.Mesh(leafGeo, i % 2 ? leafM : leafM2); frond.add(leaf);
      const tip = new THREE.Mesh(tipGeo, i % 2 ? leafM2 : leafM);
      tip.position.set(2.88, -0.2, 0); tip.rotation.z = -0.95; frond.add(tip); // tip droops hard
      yaw.add(frond); crown.add(yaw);
    }
    for (let i = 0; i < 3; i++) { // coconuts
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.21, 7, 6), trunkM);
      nut.position.set(Math.cos(i * 2.1) * 0.3, -0.22, Math.sin(i * 2.1) * 0.3); crown.add(nut);
    }
    g.position.set(x, 0, z); g.scale.setScalar(s); grp.add(g);
    colliders.push({ x, z, hw: 0.5, hd: 0.5 });
  }
  for (let x = -82; x <= 82; x += 11) { palm(x + rng() * 2, BOULEVARD_Z - 10.5, .95 + rng() * .3); palm(x + 5, BOULEVARD_Z + 10.5, .95 + rng() * .3); }
  for (let x = -78; x <= 78; x += 16) palm(x, 88.5, 1 + rng() * .3);
  for (const x of ROAD_X) for (let z = -78; z <= 50; z += 26) palm(x + 8.6, z, .85 + rng() * .25);
  const lampM = M(0x3a4149), headM = new THREE.MeshBasicMaterial({ color: 0xffe6a3 });
  for (const x of ROAD_X) for (let z = -78; z <= 78; z += 24) for (const s of [-1, 1]) {
    grp.add(box(0.22, 5.4, 0.22, lampM, x + s * 7, 2.7, z));
    const head = box(0.5, 0.3, 1.5, headM, x + s * 7, 5.5, z); grp.add(head); animated.lampHeads.push(head);
  }

  // ---------- night market: two stall rows facing each other over the z=-22 road ----------
  const stallCols = [0xff5e78, 0xffb347, 0x37c8d9, 0x9be15d, 0xff7ad9, 0xffe066];
  const market = new THREE.Group(); grp.add(market);
  function stall(x, z, i) {
    const col = stallCols[i % stallCols.length];
    market.add(box(3.6, 1.05, 2, M(0x9a6a44), x, 0.55, z));
    market.add(box(3.9, 0.14, 2.4, M(col), x, 2.25, z));
    for (const sx of [-1.7, 1.7]) market.add(box(0.14, 2.25, 0.14, M(0x6b4a2f), x + sx, 1.1, z));
    for (let k = 0; k < 6; k++) market.add(box(0.5, 0.35, 0.5, M(stallCols[(i + k) % 6]), x - 1.55 + k * 0.62, 1.25, z + rng() * 0.5));
    market.add(box(0.55, 0.7, 0.55, M(0x7a4a26), x + 2.2, 0.35, z + 0.4)); // crate beside the stall
    colliders.push({ x, z, hw: 2, hd: 1.3 });
  }
  for (let i = 0; i < 8; i++) stall(27 + i * 4.6, -14.6, i);          // north row
  for (let i = 0; i < 7; i++) stall(29.5 + i * 4.8, -29.6, i + 3);    // south row
  for (let i = 0; i < 6; i++) { // barrels + crate clusters in the gaps
    const bx = 30 + i * 6.8, bz = i % 2 ? -17.4 : -26.8;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.95, 9), M(stallCols[i % 6]));
    barrel.position.set(bx, 0.48, bz); market.add(barrel);
    market.add(box(0.8, 0.5, 0.8, M(0x9a6a44), bx + 0.8, 0.25, bz + 0.3, rng()));
  }
  // warm light pools on the ground + real point lights so the market glows at night
  const poolM = new THREE.MeshBasicMaterial({ color: 0xffb45e, transparent: true, opacity: 0.16, depthWrite: false });
  for (const [px, pz] of [[36, -18], [48, -22], [60, -26], [42, -27], [56, -16]]) {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(3.4, 18), poolM);
    pool.rotation.x = -Math.PI / 2; pool.position.set(px, 0.06, pz); market.add(pool);
  }
  for (const [px, pz] of [[40, -16], [52, -24], [58, -29]]) { // three real lights, kept few for perf
    const pl = new THREE.PointLight(0xffb45e, 0.85, 19); pl.position.set(px, 3.3, pz); market.add(pl);
  }
  // string lights ON visible sagging wires: two runs along the rows, three across the road
  const bulbM = new THREE.MeshBasicMaterial({ color: 0xffca7a });
  const wireM = new THREE.LineBasicMaterial({ color: 0x14100c });
  function stringWire(x0, z0, x1, z1, y) {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const f = i / 20;
      pts.push(new THREE.Vector3(x0 + (x1 - x0) * f, y - Math.sin(f * Math.PI) * 0.55, z0 + (z1 - z0) * f));
    }
    market.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM));
    for (let i = 1; i < 20; i += 2) {
      const p = pts[i];
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 5), bulbM);
      b.position.set(p.x, p.y - 0.16, p.z); market.add(b);
    }
  }
  stringWire(25.5, -14.6, 61.5, -14.6, 3.7);
  stringWire(28, -29.6, 60, -29.6, 3.7);
  stringWire(36, -14.6, 36, -29.6, 3.9);
  stringWire(48, -14.6, 48, -29.6, 3.9);
  stringWire(60, -14.6, 60, -29.6, 3.9);

  // ---------- marina: docks + boats on the south shore ----------
  const dockM = M(0x8a6a44), hullCols = [0xffffff, 0xff5e78, 0x37c8d9, 0xffb347, 0x7ce7ff];
  for (let i = 0; i < 4; i++) {
    const x = 38 + i * 11;
    grp.add(box(2.2, 0.3, 16, dockM, x, 0.35, 118));
    for (const s of [-1, 1]) {
      const bx2 = x + s * 3.4, bz = 116 + (i % 2) * 5;
      const boat = new THREE.Group();
      boat.add(box(2.4, 0.9, 6.4, M(hullCols[i % 5]), 0, 0.55, 0));
      boat.add(box(1.7, 0.8, 2.4, M(0xf3f0e6), 0, 1.35, -0.7));
      boat.add(box(0.12, 3.6, 0.12, M(0xcccccc), 0, 2.6, 1.2));
      boat.add(box(0.06, 1.7, 2.6, M(0xffffff), 0.1, 2.7, 1.2));
      boat.position.set(bx2, 0.15, bz); boat.rotation.y = s * 0.06; grp.add(boat);
    }
  }

  // ---------- mission beacon (glowing pillar, moved by missions) ----------
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 26, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffcf4d, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
  beacon.position.set(48, 13, 108); grp.add(beacon); animated.beacons.push(beacon);
  const beaconRing = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.2, 28),
    new THREE.MeshBasicMaterial({ color: 0xffcf4d, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  beaconRing.rotation.x = -Math.PI / 2; beaconRing.position.set(48, 0.08, 108); grp.add(beaconRing);

  animated.update = (dt, t) => {
    water.position.y = 0.12 + Math.sin(t * 0.8) * 0.05;
    beacon.material.opacity = 0.32 + Math.sin(t * 3) * 0.12;
    beaconRing.scale.setScalar(1 + Math.sin(t * 3) * 0.12);
  };
  animated.setBeacon = (x, z, color = 0xffcf4d) => {
    beacon.position.set(x, 13, z); beaconRing.position.set(x, 0.08, z);
    beacon.material.color.setHex(color); beaconRing.material.color.setHex(color);
  };
  return animated;
}

// rectangle loop the traffic follows (road centres, right-hand lanes)
export const TRAFFIC_LOOP = [
  { x: -59.5, z: -66 }, { x: 59.5, z: -66 }, { x: 66, z: -59 }, { x: 66, z: 55 },
  { x: 59.5, z: 62 }, { x: -59.5, z: 62 }, { x: -66, z: 55 }, { x: -66, z: -59 },
];
export function collide(px, pz, r) { // push a circle out of every building AABB
  for (const c of colliders) {
    const dx = px - c.x, dz = pz - c.z;
    const ox = c.hw + r - Math.abs(dx), oz = c.hd + r - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) px = c.x + (dx > 0 ? c.hw + r : -c.hw - r);
      else pz = c.z + (dz > 0 ? c.hd + r : -c.hd - r);
    }
  }
  return [Math.max(-96, Math.min(96, px)), Math.max(-96, Math.min(112, pz))];
}
