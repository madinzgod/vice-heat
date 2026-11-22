// main.js — Vice Heat: Costa Azul. Game boot, loop, cameras, combat, staging.
// Third-person open world: walk, run, aim, shoot, steal cars, outrun the PD,
// and run Marisol Vega's three-job story chain across the island city.
import { buildWorld, applyLighting, collide, BOULEVARD_Z } from './world.js';
import { Car, Traffic, parkedCars } from './vehicles.js';
import { Player, Crowd, makePerson } from './player.js';
import { Police } from './police.js';
import { MissionRunner, MISSIONS, CAST } from './missions.js';
import { Hud } from './hud.js';
import { GameAudio } from './audio.js';

const params = new URLSearchParams(location.search);
const STAGE = params.get('stage') || '';
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, 16 / 10, 0.1, 600);
const lights = { sun: new THREE.DirectionalLight(0xffffff, 1), hemi: new THREE.HemisphereLight(0xbfe3ff, 0x51683f, 0.7) };
lights.sun.position.set(60, 90, 40); scene.add(lights.sun, lights.hemi, new THREE.AmbientLight(0xffffff, 0.12));

const worldFx = buildWorld(scene);
const hud = new Hud(); hud.setCast(CAST);
const audio = new GameAudio();
const player = new Player(scene);
const traffic = new Traffic(scene, 9);
const parked = parkedCars(scene);
const crowd = new Crowd(scene, 26);
const police = new Police(scene);
const npcs = {};
for (const key of ['marisol', 'tito', 'sana']) {
  const m = MISSIONS.find(mm => mm.npc === key);
  const mesh = makePerson(CAST[key]); mesh.position.set(m.npcPos[0], 0, m.npcPos[1]);
  mesh.rotation.y = Math.PI; scene.add(mesh); npcs[key] = mesh;
}

const state = {
  mode: 'title', paused: false, cash: 1250, ammo: 24, wanted: 0,
  camYaw: Math.PI, camPitch: 0.32, bustT: 0, dayMin: 14 * 60 + 20, preset: 'dusk',
  speedKmh: 0, started: false,
};
const missions = new MissionRunner(hud, worldFx, audio);
missions.onReward = (amt) => { state.cash += amt; saveGame(); audio.coin(); };
missions.onHeat = (n) => { police.setWanted(Math.max(police.wanted, n)); state.wanted = police.wanted; };

// ---------- save / slots ----------
function saveGame() {
  try { localStorage.setItem('viceheat-slot-1', JSON.stringify({ cash: state.cash, done: missions.done, when: Date.now() })); } catch {}
}
function loadSave() { try { return JSON.parse(localStorage.getItem('viceheat-slot-1')); } catch { return null; } }
function refreshSlots() {
  const s = loadSave();
  document.getElementById('slot1').querySelector('span').textContent =
    s ? `$${s.cash.toLocaleString()} · ${s.done}/3 jobs done` : 'Empty';
}

// ---------- input ----------
const input = { up: 0, down: 0, left: 0, right: 0, run: 0 };
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
addEventListener('keydown', (e) => {
  audio.unlock();
  if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = 1;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = 1;
  if (e.code === 'Space' && hud.dialogueOpen) { hud.advanceDialogue(); e.preventDefault(); }
  if (e.code === 'KeyE') toggleCar();
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
});
addEventListener('keyup', (e) => {
  if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = 0;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = 0;
});
let mouseX = 0, mouseY = 0, mouseDown = false;
addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / innerWidth) * 2 - 1; mouseY = (e.clientY / innerHeight) * 2 - 1;
  if (state.mode === 'play' && !player.inCar) { state.camYaw -= e.movementX * 0.0032; state.camPitch = Math.max(0.06, Math.min(1.0, state.camPitch + e.movementY * 0.0026)); }
});
addEventListener('mousedown', (e) => { audio.unlock(); if (e.button === 0) { mouseDown = true; if (state.mode === 'play') shoot(); } });
addEventListener('mouseup', () => mouseDown = false);
canvas.addEventListener('click', () => { if (state.mode === 'play') canvas.requestPointerLock?.(); });

function togglePause() {
  if (state.mode !== 'play') return;
  state.paused = !state.paused;
  document.getElementById('paused').classList.toggle('hidden', !state.paused);
}
function nearestCar() {
  let best = null, bd = 4.2;
  for (const c of [...parked, ...traffic.cars]) { const d = Math.hypot(c.x - player.x, c.z - player.z); if (d < bd) { bd = d; best = c; } }
  return best;
}
function toggleCar() {
  if (state.mode !== 'play' || hud.dialogueOpen) return;
  if (player.inCar) {
    const c = player.inCar; player.inCar = null;
    player.x = c.x + Math.cos(c.ry) * 1.8; player.z = c.z - Math.sin(c.ry) * 1.8;
    player.mesh.position.set(player.x, 0, player.z);
  } else {
    const c = nearestCar();
    if (c) {
      player.inCar = c;
      if (!parked.includes(c)) { police.crime(1.4); hud.toast('VEHICLE STOLEN'); }
      audio.blip(220, 0.15, 'square', 0.05, 160);
    }
  }
}

// ---------- combat ----------
const ray = new THREE.Raycaster();
const flash = new THREE.PointLight(0xffc46b, 0, 18); scene.add(flash);
const tracer = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 1),
  new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 }));
scene.add(tracer);
let tracerT = 0;
function shoot() {
  if (player.inCar || hud.dialogueOpen || state.paused) return;
  if (state.ammo <= 0) { audio.blip(140, 0.05, 'square', 0.04); return; }
  state.ammo--; audio.shot();
  player.aiming = true; setTimeout(() => player.aiming = false, 260);
  const from = new THREE.Vector3(player.x, 1.45, player.z);
  const dir = new THREE.Vector3(-Math.sin(state.camYaw) * Math.cos(state.camPitch - 0.3), 0.25, -Math.cos(state.camYaw) * Math.cos(state.camPitch - 0.3)).normalize();
  // spread toward the mouse a touch
  dir.x += mouseX * 0.12; dir.y += -mouseY * 0.1; dir.normalize();
  ray.set(from, dir); ray.far = 70;
  const hits = ray.intersectObjects(scene.children, true);
  let end = from.clone().add(dir.clone().multiplyScalar(46));
  for (const h of hits) {
    if (h.object === tracer) continue;
    end = h.point;
    let o = h.object; while (o && !o.userData.wheels && o.parent) o = o.parent;
    const car = [...traffic.cars, ...police.cars, ...parked].find(c => c.mesh === o);
    if (car) { car.health -= 26; police.crime(1.2); if (car.health <= 0) { car.health = 40; hud.toast('VEHICLE DISABLED'); police.crime(1.5); } }
    break;
  }
  flash.position.copy(from).add(dir.clone().multiplyScalar(1.2)); flash.intensity = 2.6;
  tracer.position.copy(from.clone().add(end).multiplyScalar(0.5));
  tracer.lookAt(end); tracer.scale.z = from.distanceTo(end); tracer.material.opacity = 0.9; tracerT = 0.07;
}

// ---------- flow ----------
function setPreset(p) { state.preset = p; applyLighting(scene, lights, p); }
function startGame(fresh) {
  document.getElementById('title').style.display = 'none';
  hud.show(); state.mode = 'play'; state.started = true;
  setPreset('day');
  if (!fresh) { const s = loadSave(); if (s) { state.cash = s.cash; missions.done = s.done; } }
  missions.start(fresh ? 0 : Math.min(missions.done, 2));
  hud.toast(fresh ? 'WELCOME TO COSTA AZUL' : 'WELCOME BACK, RICO');
}
document.getElementById('btn-new').addEventListener('click', () => { audio.unlock(); startGame(true); });
document.getElementById('btn-continue').addEventListener('click', () => { audio.unlock(); startGame(false); });
refreshSlots();

// ---------- staging for screenshots (our own debug hook) ----------
function stageScene(name) {
  state.mode = 'play'; state.started = true;
  document.getElementById('title').style.display = name === 'cover' ? 'flex' : 'none';
  if (name === 'cover') { state.mode = 'title'; setPreset('dusk'); return; } // HUD stays hidden under the title
  hud.show();
  if (name === 'street') {
    setPreset('day');
    const car = parked[0]; player.inCar = car;
    car.x = -38; car.z = BOULEVARD_Z; car.ry = -Math.PI / 2; car.speed = 13;
    player.x = car.x; player.z = car.z; player.ry = car.ry;
    police.setWanted(4); state.wanted = 4;
    police.update(0.016, { x: car.x, z: car.z, ry: car.ry, speed: 13 }, [], 0);
    police.cars.forEach((c, i) => { c.x = car.x - 10 - i * 6; c.z = BOULEVARD_Z + (i % 2 ? 3.4 : -3.4); c.ry = -Math.PI / 2; });
    hud.showMission(1, 'FIRST WHEELS', 3, 3, 'Deliver the coupe to the Palma Suites garage, downtown.');
    worldFx.setBeacon(-30, -38); state.cash = 2450; state.dayMin = 15 * 60 + 5;
    state.pin = { car, heli: true, x: car.x, z: car.z, ry: car.ry };
  }
  if (name === 'mission') {
    setPreset('night');
    player.x = 43; player.z = -22; player.ry = Math.PI;
    state.camYaw = 0; state.camPitch = 0.34;
    hud.showMission(2, 'HOT CARGO', 2, 3, 'Collect the crate from stall seven.');
    worldFx.setBeacon(50, -29.6);
    hud.showDialogue([['tito', 'Psst. Night market, stall seven — that crate is NOT fruit, entiendes? Grab it and do not look inside.']], () => {});
    state.cash = 3050; state.wanted = 1; police.setWanted(1); state.dayMin = 21 * 60 + 40;
  }
  if (name === 'vista') {
    setPreset('day');
    const car = parked[6]; player.inCar = car;
    car.x = 34; car.z = BOULEVARD_Z; car.ry = Math.PI / 2; car.speed = 16;
    player.x = car.x; player.z = car.z;
    police.setWanted(3); state.wanted = 3;
    police.update(0.016, { x: car.x, z: car.z, ry: car.ry, speed: 16 }, [], 0);
    police.cars.forEach((c, i) => { c.x = car.x + 9 + i * 7; c.z = BOULEVARD_Z + (i % 2 ? 3.2 : -3.2); c.ry = Math.PI / 2; });
    hud.showMission(3, 'COOL DOWN', 2, 4, 'Run the beach road checkpoint on the boulevard.');
    worldFx.setBeacon(66, 62); state.cash = 4300; state.dayMin = 11 * 60 + 15;
    state.pin = { car, heli: false, x: car.x, z: car.z, ry: car.ry };
  }
  // snap the camera straight to its composed position (no lerp travel in shots)
  if ((name === 'street' || name === 'vista') && player.inCar) {
    const c = player.inCar;
    camera.position.set(c.x + Math.sin(c.ry) * 14.5, 5.4, c.z + Math.cos(c.ry) * 14.5);
  }
  if (name === 'mission') {
    const d = 6.4 * Math.cos(state.camPitch * 0.6);
    camera.position.set(player.x + Math.sin(state.camYaw) * d, 1.7 + state.camPitch * 3.4, player.z + Math.cos(state.camYaw) * d);
  }
}
if (STAGE) stageScene(STAGE);

// ---------- cameras ----------
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  if (state.mode === 'title') { // slow cinematic orbit over the boulevard at dusk
    const t = performance.now() * 0.00004;
    camera.position.set(Math.sin(t) * 46 + 8, 11.5, 116 + Math.cos(t * 0.7) * 4);
    camera.lookAt(-6, 7, 10);
    return;
  }
  const driving = !!player.inCar;
  const px = player.x, pz = player.z;
  if (driving) {
    // chase cam pulled back and raised (v5): the player's car stays the clear
    // subject, pursuers read behind/beside it, the helicopter fits the frame.
    const c = player.inCar, back = 14.5, h = 5.4;
    const bx = c.x + Math.sin(c.ry) * back, bz = c.z + Math.cos(c.ry) * back;
    camera.position.lerp(camTarget.set(bx, h, bz), 1 - Math.pow(0.0001, dt));
    camera.lookAt(c.x - Math.sin(c.ry) * 11, 1.8, c.z - Math.cos(c.ry) * 11);
    state.camYaw = c.ry + Math.PI;
  } else {
    const dist = 6.4, h = 1.7 + state.camPitch * 3.4;
    const bx = px + Math.sin(state.camYaw) * dist * Math.cos(state.camPitch * 0.6);
    const bz = pz + Math.cos(state.camYaw) * dist * Math.cos(state.camPitch * 0.6);
    camera.position.lerp(camTarget.set(bx, h, bz), 1 - Math.pow(0.000001, dt));
    camera.lookAt(px - Math.sin(state.camYaw) * 4, 1.5, pz - Math.cos(state.camYaw) * 4);
  }
}

// ---------- main loop ----------
let last = performance.now(), sirenT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = now / 1000;
  if (!state.paused) {
    worldFx.update(dt, t);
    traffic.update(dt, player.inCar);
    crowd.update(dt);
    for (const k in npcs) { npcs[k].rotation.y += Math.sin(t * 0.7 + npcs[k].position.x) * 0.0008; }
    if (state.mode === 'play') {
      state.dayMin += dt * 1.5;
      if (player.inCar) {
        const c = player.inCar;
        const others = [...traffic.cars, ...police.cars, ...parked];
        state.speedKmh = c.drive(dt, input, others);
        player.x = c.x; player.z = c.z;
        audio.engine(Math.abs(c.speed) / c.maxSpeed, true);
        if (Math.abs(c.speed) > 20) police.crime(dt * 0.35);
      } else {
        player.update(dt, input, state.camYaw, collide);
        state.speedKmh = 0; audio.engine(0, false);
      }
      const tgt = {
        x: player.x, z: player.z, ry: player.inCar ? player.inCar.ry : player.ry,
        speed: player.inCar ? player.inCar.speed : player.speedNow,
        onRam: (d) => { if (player.hurt(d * 14)) wasted(); },
      };
      police.update(dt, tgt, [...traffic.cars, ...parked], t);
      state.wanted = police.wanted;
      if (state.pin) { // staged composition: hold the chase formation for the shot
        const c = state.pin.car, fx = -Math.sin(c.ry), fz = -Math.cos(c.ry);
        c.x = state.pin.x; c.z = state.pin.z; c.ry = state.pin.ry; // anchor: no drift while staged
        player.x = c.x; player.z = c.z;
        c.speed = 13; c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.ry;
        state.speedKmh = 47;
        // v5 formation: every pursuer sits close behind the player's car and
        // offset to a flank, so none of them looms between camera and subject.
        const FORM = [[2.5, -4.1], [5, 4.1], [7.5, -2.7], [8, 2.7], [11, 0]];
        police.cars.forEach((p, i) => {
          const [back, side] = FORM[i % FORM.length];
          p.x = c.x - fx * back - fz * side; p.z = c.z - fz * back + fx * side; p.ry = c.ry; p.speed = 13;
          p.mesh.position.set(p.x, 0, p.z); p.mesh.rotation.y = p.ry;
        });
        if (state.pin.heli) {
          police.heli.visible = true;
          police.heli.position.set(c.x + fx * 19 - fz * 3, 11.5, c.z + fz * 19 + fx * 3);
          police.heli.rotation.y = c.ry;
          police.heli.userData.rotor.rotation.y += dt * 28;
        }
      }
      if (police.wanted >= 3 && (sirenT -= dt) <= 0) { audio.siren(); sirenT = 1.4; }
      missions.update({ x: player.x, z: player.z, inCar: !!player.inCar });
      // bust check: surrounded and slow
      const nearCop = police.cars.some(c => Math.hypot(c.x - player.x, c.z - player.z) < 3);
      if (nearCop && Math.abs(state.speedKmh) < 4 && police.wanted > 0) {
        state.bustT += dt;
        if (state.bustT > 2.6) busted();
      } else state.bustT = 0;
      // HUD refresh
      const hh = Math.floor(state.dayMin / 60) % 24, mm = Math.floor(state.dayMin % 60);
      const icon = state.preset === 'night' ? '☾' : state.preset === 'dusk' ? '☀' : '☀';
      hud.setStats({ cash: state.cash, wanted: state.wanted, health: player.health, armour: player.armour, ammo: state.ammo, clock: `${icon} DAY 1 · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` });
      hud.setSpeed(state.speedKmh, !!player.inCar);
      const near = !player.inCar && nearestCar();
      hud.setPrompt(player.inCar ? '' : near ? 'Press E to enter vehicle' : '');
      const mk = missions.current()?.at;
      hud.drawMap({ x: player.x, z: player.z, ry: player.inCar ? player.inCar.ry + Math.PI : player.ry + Math.PI },
        mk, traffic.cars, police.cars, state.wanted);
      hud.update(dt);
    }
  }
  if (flash.intensity > 0) flash.intensity = Math.max(0, flash.intensity - dt * 30);
  if (tracerT > 0) { tracerT -= dt; if (tracerT <= 0) tracer.material.opacity = 0; }
  updateCamera(dt);
  renderer.render(scene, camera);
}
function wasted() {
  hud.toast('WASTED — the hospital sends its bill');
  state.cash = Math.max(0, state.cash - 250);
  player.health = 100; player.armour = 0; player.inCar = null;
  player.x = -52; player.z = -52; police.setWanted(0);
}
function busted() {
  hud.toast('BUSTED — Costa Azul PD thanks you for stopping');
  state.cash = Math.max(0, state.cash - 400);
  player.inCar = null; player.x = 58; player.z = -58; state.bustT = 0;
  police.setWanted(0); audio.crash();
}
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
requestAnimationFrame(frame);
