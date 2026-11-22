// config.js — shared constants for Vice Heat: world size, roads, palette, tuning.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_SPACING = 400;
export const ROAD_W = 92;
export const BEACH_Y = 2040; // sand starts here
export const WATER_Y = 2240; // water starts here

export const COLORS = {
  grass: "#79c25f",
  grassAlt: "#6fb856",
  road: "#3d4148",
  roadLine: "#f5d76e",
  sidewalk: "#cfc8b8",
  curb: "#b7b09e",
  sand: "#f2dd9a",
  water: "#2fa8c9",
  waterDeep: "#1f8fb4",
  plaza: "#ddd3ba",
  player: "#ffcf3f",
  police: "#2456c8",
  policeDark: "#173a8a",
};

export const CAR_COLORS = [
  "#e74c3c", "#f39c12", "#f1c40f", "#2ecc71", "#1abc9c",
  "#9b59b6", "#ecf0f1", "#e67e22", "#fd79a8", "#00cec9",
  "#dfe6e9", "#636e72", "#ff6b81", "#48dbfb",
];
export const BUILDING_COLORS = [
  "#f7e8c9", "#f6cfae", "#eeb4a0", "#d9e6f2", "#cfe3d0",
  "#f2d5e0", "#e8dff5", "#ffe9a8", "#bfe3ea", "#f5f0e1",
  "#e6b8a2", "#a8d8ea", "#f9d5bb", "#d5e8d4",
];
export const SHIRT_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6",
  "#e67e22", "#1abc9c", "#fd79a8", "#ecf0f1", "#95a5a6",
];

export const TUNING = {
  playerWalk: 2.1,
  playerRun: 3.6,
  playerRadius: 11,
  carAccel: 0.16,
  carBrake: 0.3,
  carMaxSpeed: 7.2,
  carMaxReverse: 2.6,
  trafficSpeed: 2.4,
  policeSpeed: 3.4,
  bustFillRate: 0.55,
  bustDrainRate: 0.3,
  wantedDecaySeconds: 14,
  bulletDamage: 34,
  copBulletDamage: 7,
};
