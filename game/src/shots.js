// shots.js — deterministic staged scenes for the four store screenshots.
// When the URL carries ?shot=N&seed=S, main boots straight into one of these
// scenes instead of the title screen, simulates a while, then flags
// window.__shotReady so the capture tool knows the frame is settled.
import { PLACES } from "./world.js";
import { makeCar } from "./vehicles.js";
import { makePed, spawnOfficer } from "./people.js";

function trafficRow(state, y, xs, angle) {
  const colors = ["#e74c3c", "#2ecc71", "#9b59b6", "#ecf0f1"];
  xs.forEach((x, i) => {
    const car = makeCar(x, y, angle, colors[i % colors.length], "traffic");
    car.speed = 2.2;
    state.cars.push(car);
  });
}

export function stageShot(state, n) {
  const p = state.player;
  state.cars.length = 0;
  state.peds.length = 0;
  state.camZoom = 1;

  if (n === 1) {
    // Cover: driving the coastal avenue in traffic, police on the tail.
    const car = makeCar(1100, 2164, 0, "#f6c90e", "traffic");
    car.speed = 3.4;
    state.cars.push(car);
    p.car = car; car.occupied = true;
    p.x = car.x; p.y = car.y;
    trafficRow(state, 2164, [1330, 1560], 0);
    trafficRow(state, 2116, [880, 1420], Math.PI);
    const cop = makeCar(905, 2164, 0, "#f4f6f8", "police");
    cop.speed = 3.2;
    state.cars.push(cop);
    state.wanted = 2;
    state.missionIndex = 0; state.stageIndex = 0;
  } else if (n === 2) {
    // Street: on foot in the downtown plaza crowd, police at the edge.
    p.x = PLACES.downtown.x - 30; p.y = PLACES.downtown.y + 10;
    p.angle = 0.4; p.car = null;
    // Absolute spots on the sidewalk bands of the downtown intersection
    // (54 px from a road centreline) so nobody stands on a rooftop.
    const spots = [[1346, 880], [1346, 1070], [1454, 920], [1454, 1140], [1260, 946], [1490, 946], [1210, 1054], [1560, 1054], [1346, 820], [1454, 815], [1600, 946], [1150, 1054], [1346, 1185], [1520, 1054]];
    for (const [sx, sy] of spots) {
      const ped = makePed(sx, sy, state.rng);
      ped.parked = true; // staged crowd stays put for the capture
      state.peds.push(ped);
    }
    const cop = makeCar(1900, PLACES.downtown.y + 24, Math.PI, "#f4f6f8", "police");
    cop.parked = true;
    state.cars.push(cop);
    trafficRow(state, 624, [p.x - 300, p.x + 180], 0);
    const officer = spawnOfficer(state, 1845, PLACES.downtown.y + 72);
    officer.parked = true;
    state.wanted = 2;
    state.shotObjective = "Mission 1 — First Wheels: Reach the marked car across town";
  } else if (n === 3) {
    // Mission: the Hot Cargo delivery, mid firefight beside the drop car.
    state.missionIndex = 1; state.stageIndex = 1;
    p.x = PLACES.beachClub.x - 120; p.y = PLACES.beachClub.y - 60;
    p.car = null; p.health = 55;
    p.angle = 0.15;
    const drop = makeCar(PLACES.beachClub.x + 30, PLACES.beachClub.y - 52, 0, "#f6c90e", "parked");
    drop.marked = true;
    state.cars.push(drop);
    const rival = makePed(p.x + 120, p.y + 18, state.rng);
    rival.color = "#8e44ad";
    state.peds.push(rival);
    state.shotRival = rival;
    for (let i = 0; i < 4; i++) state.peds.push(makePed(p.x - 90 + i * 26, p.y + 120, state.rng));
    const cop = makeCar(p.x - 430, 2116, 0, "#f4f6f8", "police");
    cop.parked = true;
    state.cars.push(cop);
    state.wanted = 2;
  } else if (n === 4) {
    // Vista: zoomed out over the city, beach strip along the bottom.
    state.camZoom = 0.5;
    p.x = 1600; p.y = 1560; p.car = null;
    trafficRow(state, 1400 - 24, [1250, 1700, 2050], 0);
    trafficRow(state, 1800 + 24, [1100, 1900], 0);
    trafficRow(state, 2116, [900, 2300], Math.PI);
    for (let i = 0; i < 8; i++) {
      const ped = makePed(1450 + i * 36, 1462, state.rng);
      ped.parked = true;
      state.peds.push(ped);
    }
    state.wanted = 0;
  }
  state.playerSeen = state.wanted > 0;
}

// Re-applied every frame in shot mode so effects (the shot-3 tracer and
// muzzle flash) are guaranteed visible in the captured frame.
export function applyShotFx(state, n) {
  if (n !== 3 || !state.shotRival) return;
  const p = state.player;
  const r = state.shotRival;
  state.tracers.length = 0;
  state.tracers.push({ x: p.x + 14, y: p.y, tx: r.x, ty: r.y, life: 4 });
  state.muzzle = { x: p.x + 16, y: p.y, life: 4 };
}
