// missions.js — the Costa Azul story chain. Original cast and dialogue:
// Marisol Vega (fixer), Rico Alvarez (you), Tito Ferrer (dock rat), Sana Iqbal (driver).
// Each mission is a list of stages: reach a marker, drive somewhere, survive heat.
export const CAST = {
  marisol: { name: 'MARISOL VEGA', skin: 0x8a5a34, shirt: 0xc2185b, pants: 0x1d2733, hair: 0x0e0a08 },
  tito:    { name: 'TITO FERRER', skin: 0xf2c49b, shirt: 0x2a9d8f, pants: 0x55422b, hair: 0x4a2c14 },
  sana:    { name: 'SANA IQBAL', skin: 0x6e4226, shirt: 0xffb347, pants: 0x24344d, hair: 0x14100c },
  rico:    { name: 'RICO ALVAREZ', skin: 0xc98d5e, shirt: 0xff7a3c, pants: 0x24344d, hair: 0x14100c },
};

export const MISSIONS = [
  {
    title: 'FIRST WHEELS', reward: 600, npc: 'marisol', npcPos: [48, 100],
    intro: [
      ['marisol', 'Rico. Three years gone and you walk back onto MY dock like you own the tide.'],
      ['rico', 'I own nothing, Marisol. That is kind of the problem.'],
      ['marisol', 'Then work. Tito left a coupe by the boulevard, keys in, engine warm. Take it. Bring it to the Palma Suites garage.'],
    ],
    stages: [
      { obj: 'Meet Marisol Vega at the marina dock.', at: [48, 100], r: 4, mode: 'foot' },
      { obj: 'Take the orange coupe parked on the boulevard.', at: [44, 71], r: 5, mode: 'any' },
      { obj: 'Deliver the coupe to the Palma Suites garage, downtown.', at: [-30, -38], r: 6, mode: 'car' },
    ],
    outro: [
      ['marisol', 'Clean lines, no scratches. You still drive like the cops owe you money.'],
      ['rico', 'They owe me three years. I am collecting in instalments.'],
    ],
  },
  {
    title: 'HOT CARGO', reward: 1200, npc: 'tito', npcPos: [58, -14.6],
    intro: [
      ['tito', 'Psst. Night market, stall seven — that crate is NOT fruit, entiendes?'],
      ['rico', 'If it ticks, Tito, I am throwing it in the sea.'],
      ['tito', 'It does not tick. It just… must reach the Azul Hotel before the heat notices. Go, go!'],
    ],
    stages: [
      { obj: 'Meet Tito Ferrer at the night-market stalls.', at: [58, -14.6], r: 4, mode: 'foot' },
      { obj: 'Collect the crate from stall seven.', at: [44, -14.6], r: 3.5, mode: 'foot' },
      { obj: 'Lose the heat, then reach the Azul Hotel loading bay.', at: [-38, 14], r: 6, mode: 'any', heat: 2 },
    ],
    outro: [
      ['tito', 'You smell that? That is the smell of a debt shrinking. Sana saw you drive — she wants a word.'],
    ],
  },
  {
    title: 'COOL DOWN', reward: 2000, npc: 'sana', npcPos: [-14, 30],
    intro: [
      ['sana', 'Marisol says you are the wheel this city forgot. Prove it.'],
      ['sana', 'My pickup is loaded and the whole PD is bored tonight. Beach road, marina, home. Survive it.'],
      ['rico', 'Bored cops, loaded truck, one driver. What could go wrong.'],
    ],
    stages: [
      { obj: 'Meet Sana Iqbal by the west avenue.', at: [-14, 30], r: 4, mode: 'foot' },
      { obj: 'Run the beach road checkpoint on the boulevard.', at: [66, 62], r: 7, mode: 'car', heat: 3 },
      { obj: 'Reach the marina with the cargo intact.', at: [48, 100], r: 7, mode: 'car' },
      { obj: 'Shake the heat and park up at the safehouse.', at: [-58, -58], r: 6, mode: 'any' },
    ],
    outro: [
      ['sana', 'Okay. Marisol was right. Costa Azul is yours again, Rico — try not to burn it down.'],
      ['marisol', 'End of the beginning, partner. The city pays people who finish jobs. Keep your phone on.'],
    ],
  },
];

// Mission runner: tracks stage progress against the live game state.
export class MissionRunner {
  constructor(hud, worldFx, audio) {
    this.hud = hud; this.fx = worldFx; this.audio = audio;
    this.idx = -1; this.stage = 0; this.active = false; this.done = 0;
    this.onReward = null; this.onHeat = null;
  }
  start(idx) {
    const m = MISSIONS[idx]; if (!m) { this.active = false; this.hud.hideMission(); return; }
    this.idx = idx; this.stage = 0; this.active = true;
    this.showStage();
    this.hud.showDialogue(m.intro, () => {});
  }
  current() { return this.active ? MISSIONS[this.idx].stages[this.stage] : null; }
  showStage() {
    const m = MISSIONS[this.idx], s = m.stages[this.stage];
    this.hud.showMission(this.idx + 1, m.title, this.stage + 1, m.stages.length, s.obj);
    this.fx.setBeacon(s.at[0], s.at[1], 0xffcf4d);
    if (s.heat && this.onHeat) this.onHeat(s.heat);
  }
  // called every frame; playerPos {x,z,inCar}
  update(p) {
    if (!this.active) return;
    const s = this.current(); if (!s) return;
    const d = Math.hypot(p.x - s.at[0], p.z - s.at[1]);
    const modeOk = s.mode === 'any' || (s.mode === 'car' ? p.inCar : !p.inCar);
    if (d < s.r && modeOk) this.advance();
  }
  advance() {
    const m = MISSIONS[this.idx];
    this.audio?.coin();
    this.stage++;
    if (this.stage >= m.stages.length) {
      this.active = false; this.done++;
      this.hud.toast(`MISSION COMPLETE — $${m.reward.toLocaleString()}`);
      this.hud.showDialogue(m.outro, () => { if (this.onReward) this.onReward(m.reward, this.idx); this.start(this.idx + 1); });
      this.hud.hideMission();
    } else this.showStage();
  }
}
