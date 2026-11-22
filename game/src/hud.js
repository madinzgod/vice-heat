// hud.js — everything overlaid on the playfield: health, cash, wanted stars,
// the objective banner, speed, the bust meter, and the minimap with roads,
// the player arrow, traffic dots, blue police blips and the gold marker.
import { WORLD_W, WORLD_H } from "./config.js";
import { roadCentersX, roadCentersY } from "./world.js";
import { objectiveText, markerTarget } from "./missions.js";
import { carSpeedMph } from "./vehicles.js";

function star(ctx, x, y, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? "#ffd23f" : "rgba(20,20,30,0.55)";
  ctx.fill();
  ctx.strokeStyle = "#ffd23f";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function drawMinimap(ctx, state, x, y, w, h) {
  ctx.save();
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, "rgba(16,30,44,0.92)");
  bg.addColorStop(1, "rgba(10,18,30,0.92)");
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#f5d76e";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  const sx = (wx) => x + (wx / WORLD_W) * w;
  const sy = (wy) => y + (wy / WORLD_H) * h;

  // Roads.
  ctx.strokeStyle = "rgba(230,230,220,0.5)";
  ctx.lineWidth = 1;
  for (const cx of roadCentersX()) { ctx.beginPath(); ctx.moveTo(sx(cx), y + 2); ctx.lineTo(sx(cx), y + h - 2); ctx.stroke(); }
  for (const cy of roadCentersY()) { ctx.beginPath(); ctx.moveTo(x + 2, sy(cy)); ctx.lineTo(x + w - 2, sy(cy)); ctx.stroke(); }
  // Beach strip.
  ctx.fillStyle = "rgba(47,168,201,0.7)";
  ctx.fillRect(x + 2, sy(2240), w - 4, y + h - 2 - sy(2240));

  // Traffic dots.
  ctx.fillStyle = "#dfe6e9";
  for (const car of state.cars) {
    if (car.kind === "traffic") ctx.fillRect(sx(car.x) - 1.5, sy(car.y) - 1.5, 3, 3);
  }
  // Police blips (flashing blue).
  const flash = Math.floor(state.frame / 18) % 2 === 0;
  ctx.fillStyle = flash ? "#3fa9ff" : "#bfe3ff";
  for (const car of state.cars) {
    if (car.kind !== "police") continue;
    ctx.beginPath(); ctx.arc(sx(car.x), sy(car.y), 3.4, 0, Math.PI * 2); ctx.fill();
  }
  for (const ped of state.peds) {
    if (ped.kind !== "officer" || ped.state === "down") continue;
    ctx.beginPath(); ctx.arc(sx(ped.x), sy(ped.y), 2.6, 0, Math.PI * 2); ctx.fill();
  }
  // Gold mission marker.
  const target = markerTarget(state);
  if (target) {
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath(); ctx.arc(sx(target.x), sy(target.y), 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#7a5b00"; ctx.lineWidth = 1.4; ctx.stroke();
  }
  // Player arrow.
  const p = state.player;
  const pa = p.car ? p.car.angle : p.angle;
  ctx.save();
  ctx.translate(sx(p.x), sy(p.y));
  ctx.rotate(pa);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

// A translucent dark panel with a gold hairline — the HUD's shared chrome.
function panel(ctx, x, y, w, h, r = 8) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "rgba(14,18,30,0.82)");
  g.addColorStop(1, "rgba(14,18,30,0.62)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = "rgba(245,215,110,0.75)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();
}

export function drawHUD(ctx, state, W, H) {
  const p = state.player;
  ctx.save();
  ctx.textBaseline = "top";

  // Cash, on its own panel.
  panel(ctx, 10, 8, 148, 34);
  ctx.font = "bold 23px Arial, sans-serif";
  ctx.fillStyle = "#2bff88";
  const cash = `$${state.cash}`;
  ctx.fillText(cash, 20, 13);

  // Health bar, panelled, with a gradient fill.
  panel(ctx, 10, 48, 216, 26);
  const hpW = 200 * Math.max(0, p.health) / 100;
  const hpGrad = ctx.createLinearGradient(18, 0, 218, 0);
  hpGrad.addColorStop(0, p.health > 30 ? "#ff7a5c" : "#ff2222");
  hpGrad.addColorStop(1, p.health > 30 ? "#e33e4e" : "#ff5555");
  ctx.fillStyle = hpGrad;
  if (hpW > 2) { ctx.beginPath(); ctx.roundRect(18, 54, hpW, 14, 4); ctx.fill(); }
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px Arial, sans-serif";
  ctx.fillText("HEALTH", 20, 56);

  // Wanted stars, top-right, filling from the left of the row.
  for (let i = 0; i < 5; i++) star(ctx, W - 186 + i * 38, 30, 15, i < state.wanted);
  if (state.playerSeen && state.wanted > 0) {
    ctx.fillStyle = "#ff5252";
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("POLICE IN PURSUIT", W - 18, 58);
    ctx.textAlign = "left";
  }

  // Objective banner, top-centre.
  const objective = state.shotObjective || objectiveText(state);
  if (objective) {
    ctx.font = "bold 17px Arial, sans-serif";
    const tw = ctx.measureText(objective).width;
    const bx = (W - tw) / 2 - 16;
    panel(ctx, bx, 8, tw + 32, 36, 10);
    ctx.fillStyle = "#ffe9a8";
    ctx.fillText(objective, (W - tw) / 2, 17);
  }

  // Mission-complete / story banner.
  if (state.banner && state.banner.t > 0) {
    ctx.font = "bold 30px Arial, sans-serif";
    const tw = ctx.measureText(state.banner.text).width;
    panel(ctx, (W - tw) / 2 - 22, H * 0.3, tw + 44, 56, 12);
    ctx.fillStyle = "#ffd23f";
    ctx.fillText(state.banner.text, (W - tw) / 2, H * 0.3 + 13);
  }

  // Speed, bottom-right but clear of the minimap, while driving.
  if (p.car) {
    ctx.font = "bold 26px Arial, sans-serif";
    const s = `${carSpeedMph(p.car)} mph`;
    const tw = ctx.measureText(s).width;
    panel(ctx, W - 216 - tw, H - 52, tw + 18, 38, 9);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(s, W - 207 - tw, H - 46);
  }

  // Bust meter, bottom-centre.
  if (state.bust > 0.02) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(W / 2 - 110, H - 40, 220, 16);
    ctx.fillStyle = "#ff5252";
    ctx.fillRect(W / 2 - 108, H - 38, 216 * state.bust, 12);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px Arial, sans-serif";
    ctx.fillText("BUSTED?", W / 2 - 28, H - 62);
  }

  // Context hint.
  ctx.font = "14px Arial, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  if (!p.car && state.nearCar) ctx.fillText("Press E to enter car", 16, H - 28);
  else if (p.car) ctx.fillText("Press E to exit car", 16, H - 28);

  drawMinimap(ctx, state, W - 196, H - 156, 180, 140);
  ctx.restore();
}
