// shots.js — deterministic staged scenes for the four store screenshots.
// When the URL carries ?shot=N&seed=S, main boots straight into one of these
// scenes instead of the title screen, simulates a while, then flags
// window.__shotReady so the capture tool knows the frame is settled.
// Scenes are staged for the v3 camera (zoom 1.6, vista 0.55) and the
// illustrated art set: sprite cars, rooftop plates, beach dressing.
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

function parkedPed(state, x, y) {
  const ped = makePed(x, y, state.rng);
  ped.parked = true; // staged crowd stays put for the capture
  state.peds.push(ped);
  return ped;
}

export function stageShot(state, n) {
  const p = state.player;
  state.cars.length = 0;
  state.peds.length = 0;
  state.camZoom = 1.6;
  state.shotCover = false;

  if (n === 1) {
    // Cover: no staged world — main boots shot 1 into the real title
    // screen, which draws the illustrated coastal vista (assets/cover.jpg)
    // with the full title treatment and menu.
    state.wanted = 0;
    state.missionIndex = 0; state.stageIndex = 0;
  } else if (n === 2) {
    // Street: driving downtown in traffic, three stars, police closing in
    // from behind and from the crossing avenue, crowds on the sidewalks.
    const car = makeCar(1424, 820, Math.PI / 2, "#f6c90e", "traffic");
    car.speed = 3.1;
    car.sprite = "coupe"; // the hero wears the yellow coupe sprite
    state.cars.push(car);
    p.car = car; car.occupied = true;
    p.x = car.x; p.y = car.y; p.angle = Math.PI / 2;
    const ahead = makeCar(1424, 990, Math.PI / 2, "#e74c3c", "traffic");
    ahead.speed = 2.2;
    state.cars.push(ahead);
    trafficRow(state, 976, [1050, 1780], 0);
    trafficRow(state, 1024, [1180, 1700], Math.PI);
    const cop = makeCar(1424, 655, Math.PI / 2, "#f4f6f8", "police");
    cop.parked = true;
    state.cars.push(cop);
    const cop2 = makeCar(1620, 976, Math.PI, "#f4f6f8", "police");
    cop2.parked = true;
    state.cars.push(cop2);
    const spots = [[1346, 880], [1454, 920], [1346, 1020], [1454, 1040], [1260, 946], [1560, 1054], [1210, 1054], [1600, 946]];
    for (const [sx2, sy2] of spots) parkedPed(state, sx2, sy2);
    const officer = spawnOfficer(state, 1330, 1000);
    officer.parked = true;
    state.wanted = 3;
    state.missionIndex = 0; state.stageIndex = 0;
  } else if (n === 3) {
    // Mission: the Hot Cargo drop at the Coral Beach Club — a firefight on
    // the promenade beside the marked car, crowd scattering, heat inbound.
    state.missionIndex = 1; state.stageIndex = 1;
    p.x = PLACES.beachClub.x - 120; p.y = PLACES.beachClub.y - 60;
    p.car = null; p.health = 55;
    p.angle = 0.15;
    const drop = makeCar(PLACES.beachClub.x + 30, PLACES.beachClub.y - 52, 0, "#f6c90e", "parked");
    drop.marked = true;
    state.cars.push(drop);
    const rival = makePed(p.x + 105, p.y + 66, state.rng);
    rival.color = "#8e44ad";
    state.peds.push(rival);
    state.shotRival = rival;
    p.angle = Math.atan2(66, 105);
    for (let i = 0; i < 5; i++) parkedPed(state, p.x - 110 + i * 30, p.y + 44);
    parkedPed(state, p.x + 248, p.y + 64);
    parkedPed(state, p.x + 60, p.y + 52);
    const cop = makeCar(p.x - 330, 2116, 0, "#f4f6f8", "police");
    cop.parked = true;
    state.cars.push(cop);
    trafficRow(state, 2164, [p.x + 330, p.x + 560], 0);
    state.wanted = 2;
  } else if (n === 4) {
    // Vista: pulled back over the city — rooftops, avenues, the beach
    // strip, moored boats and the sea along the bottom of the frame.
    state.camZoom = 0.55;
    p.x = 1600; p.y = 1880; p.car = null;
    trafficRow(state, 1400 - 24, [1250, 1700, 2050], 0);
    trafficRow(state, 1800 + 24, [1100, 1900], 0);
    trafficRow(state, 2116, [900, 2300], Math.PI);
    trafficRow(state, 2164, [1500, 2600], 0);
    for (let i = 0; i < 8; i++) parkedPed(state, 1450 + i * 36, 1462);
    for (let i = 0; i < 6; i++) parkedPed(state, 1250 + i * 44, 2072);
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
