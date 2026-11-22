// hud.js — DOM HUD: bars, cash, wanted stars, mission panel, dialogue,
// toast prompts, and the 2D canvas minimap (roads, blips, player arrow).
import { ROAD_X, ROAD_Z, BOULEVARD_Z } from './world.js';

const $ = (id) => document.getElementById(id);
export class Hud {
  constructor() {
    this.el = {
      hud: $('hud'), cash: $('cash'), stars: $('stars'), weapon: $('weapon'),
      health: $('health'), armour: $('armour'), mission: $('mission'),
      mTitle: $('mission-title'), mStage: $('mission-stage'), mObj: $('mission-obj'), mFill: $('mission-fill'),
      speedo: $('speedo'), speed: $('speed'), gear: $('gear'), dialogue: $('dialogue'),
      speaker: $('speaker'), line: $('line'), toast: $('toast'), prompt: $('prompt'),
      crosshair: $('crosshair'), clock: $('clockchip'),
    };
    this.map = $('minimap').getContext('2d');
    this.dlgQueue = null; this.dlgIdx = 0; this.onDlgDone = null; this.toastT = 0;
    this.castNames = {};
  }
  show() { this.el.hud.classList.remove('hidden'); }
  setCast(cast) { for (const k in cast) this.castNames[k] = cast[k].name; }
  setStats({ cash, wanted, health, armour, ammo, clock }) {
    this.el.cash.textContent = '$ ' + cash.toLocaleString();
    this.el.stars.innerHTML = [1, 2, 3, 4, 5].map(i => i <= wanted ? '★' : '<span class="off">★</span>').join('');
    this.el.health.style.width = Math.max(0, health) + '%';
    this.el.armour.style.width = Math.max(0, armour) + '%';
    this.el.weapon.textContent = 'PISTOL · ' + ammo + ' / ∞';
    if (clock) this.el.clock.textContent = clock;
  }
  setSpeed(kmh, driving) {
    this.el.speedo.classList.toggle('hidden', !driving);
    if (driving) { this.el.speed.textContent = Math.round(kmh); this.el.gear.textContent = kmh < 1 ? 'N' : 'D'; }
    this.el.crosshair.classList.toggle('hidden', driving);
  }
  showMission(n, title, stage, total, obj) {
    this.el.mission.classList.remove('hidden');
    this.el.mTitle.textContent = `MISSION ${n} — ${title}`;
    this.el.mStage.textContent = `STAGE ${stage}/${total}`;
    this.el.mObj.textContent = obj;
    this.el.mFill.style.width = ((stage - 1) / total * 100) + '%';
  }
  hideMission() { this.el.mission.classList.add('hidden'); }
  showDialogue(lines, onDone) {
    this.dlgQueue = lines; this.dlgIdx = 0; this.onDlgDone = onDone || null;
    this.el.dialogue.classList.remove('hidden'); this.renderLine();
  }
  renderLine() {
    const [who, text] = this.dlgQueue[this.dlgIdx];
    this.el.speaker.textContent = this.castNames[who] || who.toUpperCase();
    this.el.line.textContent = text;
  }
  advanceDialogue() {
    if (!this.dlgQueue) return false;
    this.dlgIdx++;
    if (this.dlgIdx >= this.dlgQueue.length) {
      this.dlgQueue = null; this.el.dialogue.classList.add('hidden');
      const cb = this.onDlgDone; this.onDlgDone = null; if (cb) cb();
    } else this.renderLine();
    return true;
  }
  get dialogueOpen() { return !!this.dlgQueue; }
  toast(text, secs = 3.2) {
    this.el.toast.textContent = text; this.el.toast.classList.remove('hidden');
    this.toastT = secs;
  }
  setPrompt(text) {
    if (text) { this.el.prompt.textContent = text; this.el.prompt.classList.remove('hidden'); }
    else this.el.prompt.classList.add('hidden');
  }
  update(dt) { if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.el.toast.classList.add('hidden'); } }
  // minimap: world -100..115 maps onto the 190px canvas
  drawMap(player, marker, cars, police, wanted) {
    const g = this.map, S = 190, W2M = S / 215, ox = 100, oz = 100;
    const X = (x) => (x + ox) * W2M, Z = (z) => (z + 100) * W2M + (115 - 100) * W2M - 15 * W2M;
    g.fillStyle = '#274b2e'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#f2d492'; g.fillRect(0, Z(86), S, Z(112) - Z(86));
    g.fillStyle = '#1d7fa8'; g.fillRect(0, Z(112), S, S - Z(112));
    g.strokeStyle = '#454e59'; g.lineWidth = 5; g.beginPath();
    for (const x of ROAD_X) { g.moveTo(X(x), 0); g.lineTo(X(x), S); }
    for (const z of [...ROAD_Z, BOULEVARD_Z]) { g.moveTo(0, Z(z)); g.lineTo(S, Z(z)); }
    g.stroke();
    // road labels + north indicator
    g.fillStyle = 'rgba(230,240,248,0.85)'; g.font = '700 8px Verdana'; g.textAlign = 'center';
    g.fillText('BLVD', X(0), Z(BOULEVARD_Z) - 7);
    g.fillText('MARKET', X(45), Z(-22) - 7);
    g.fillText('MARINA', X(52), Z(100) + 3);
    g.font = '900 12px Verdana'; g.fillStyle = '#ffffff';
    g.fillText('N', S / 2, 14);
    g.beginPath(); g.moveTo(S / 2, 16); g.lineTo(S / 2 - 3.4, 23); g.lineTo(S / 2 + 3.4, 23); g.closePath(); g.fill();
    g.textAlign = 'left';
    const dot = (x, z, c, r) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Z(z), r, 0, 7); g.fill(); };
    for (const c of cars) dot(c.x, c.z, '#cfd8e3', 2);
    if (wanted > 0) for (const c of police) dot(c.x, c.z, (performance.now() % 600 < 300) ? '#ff4444' : '#4488ff', 2.6);
    if (marker) { // pulsing mission marker
      g.strokeStyle = '#ffcf4d'; g.lineWidth = 2;
      g.beginPath(); g.arc(X(marker[0]), Z(marker[1]), 5 + Math.sin(performance.now() * 0.008) * 1.6, 0, 7); g.stroke();
      dot(marker[0], marker[1], '#ffcf4d', 2.4);
    }
    // player arrow
    g.save(); g.translate(X(player.x), Z(player.z)); g.rotate(-(player.ry || 0));
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 5); g.lineTo(0, 2.6); g.lineTo(-4, 5); g.closePath(); g.fill();
    g.restore();
  }
}
