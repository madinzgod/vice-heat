// assets.js — loads the illustrated art for Vice Heat and hands the renderer
// ready-to-draw images and tiling patterns. Every image is optional at
// runtime: if one fails to load, the renderer falls back to rich procedural
// painting for that surface, so the game never breaks on a missing file.
const FILES = {
  grass: "tex-grass.jpg",
  asphalt: "tex-asphalt.jpg",
  sand: "tex-sand.jpg",
  water: "tex-water.jpg",
  cover: "cover.jpg",
  roofHotel: "roof-hotel.png",
  roofCondo: "roof-condo.png",
  roofClub: "roof-club.png",
  roofWarehouse: "roof-warehouse.png",
  coupe: "car-coupe.png",
  coupeGreen: "car-coupe-green.png",
  sedan: "car-sedan.png",
  sedanOrange: "car-sedan-orange.png",
  sedanPurple: "car-sedan-purple.png",
  sedanBlue: "car-sedan-blue.png",
  convertible: "car-convertible.png",
  pickup: "car-pickup.png",
  police: "car-police.png",
  palm: "palm.png",
  boat: "boat.png",
};

export const IMG = {};
for (const key of Object.keys(FILES)) {
  const img = new Image();
  img.src = `assets/${FILES[key]}`;
  IMG[key] = img;
}

export function imgReady(key) {
  const img = IMG[key];
  return !!(img && img.complete && img.naturalWidth > 0);
}

// Canvas patterns are built lazily once the source image has arrived.
const patternCache = {};
export function patternFor(ctx, key) {
  if (!imgReady(key)) return null;
  if (!patternCache[key]) patternCache[key] = ctx.createPattern(IMG[key], "repeat");
  return patternCache[key];
}

// Which sprite a car wears. Police always wear the interceptor; the marked
// story car is the yellow coupe; traffic cycles the civilian set.
export const TRAFFIC_SPRITES = [
  "sedan", "coupe", "convertible", "pickup",
  "sedanOrange", "sedanPurple", "sedanBlue", "coupeGreen",
];

export function carSpriteKey(car) {
  if (car.kind === "police") return "police";
  if (car.marked) return "coupe";
  if (car.sprite) return car.sprite;
  return TRAFFIC_SPRITES[Math.abs(car.id || 0) % TRAFFIC_SPRITES.length];
}

export function roofKeyFor(building) {
  switch (building.roofType) {
    case "condo": return "roofCondo";
    case "club": return "roofClub";
    case "warehouse": return "roofWarehouse";
    default: return "roofHotel";
  }
}
