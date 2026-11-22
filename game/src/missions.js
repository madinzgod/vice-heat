// missions.js — the three-mission story chain of Vice Heat, with on-screen
// objectives, world markers, cash rewards and autosave on completion.
import { PLACES } from "./world.js";
import { reportCrime } from "./police.js";
import { dist } from "./random.js";

export const MISSIONS = [
  {
    id: "m1",
    title: "Mission 1 — First Wheels",
    reward: 250,
    stages: [
      { text: "Reach the marked car across town", target: () => PLACES.startCar, mode: "any" },
      { text: "Get in the marked car", target: () => PLACES.startCar, mode: "enterMarkedCar" },
      { text: "Deliver the car to the Marina Garage", target: () => PLACES.marinaGarage, mode: "driveMarkedCar" },
    ],
  },
  {
    id: "m2",
    title: "Mission 2 — Hot Cargo",
    reward: 400,
    stages: [
      { text: "Pick up the package downtown (on foot)", target: () => PLACES.downtown, mode: "onFoot" },
      { text: "Deliver the package to the Coral Beach Club", target: () => PLACES.beachClub, mode: "any", heat: 2 },
    ],
  },
  {
    id: "m3",
    title: "Mission 3 — Cool Down",
    reward: 600,
    stages: [
      { text: "Lose the police: stay unseen until the stars fade", target: () => PLACES.safehouse, mode: "loseHeat", heat: 3 },
      { text: "Reach the Old Town Safehouse", target: () => PLACES.safehouse, mode: "any" },
    ],
  },
];

export function currentStage(state) {
  if (state.storyComplete || state.missionIndex >= MISSIONS.length) return null;
  const mission = MISSIONS[state.missionIndex];
  return { mission, stage: mission.stages[state.stageIndex], missionIndex: state.missionIndex };
}

export function objectiveText(state) {
  const cur = currentStage(state);
  if (!cur) return state.storyComplete ? "Story complete — free roam Costa Azul" : "";
  return `${cur.mission.title}: ${cur.stage.text}`;
}

export function markerTarget(state) {
  const cur = currentStage(state);
  if (!cur) return null;
  if (cur.stage.mode === "loseHeat" && state.wanted > 0) return null; // hide, don't run yet
  return cur.stage.target();
}

function completeMission(state) {
  const mission = MISSIONS[state.missionIndex];
  state.cash += mission.reward;
  state.banner = { text: `${mission.title} complete! +$${mission.reward}`, t: 260 };
  state.audio.play("complete");
  state.missionIndex += 1;
  state.stageIndex = 0;
  if (state.missionIndex >= MISSIONS.length) {
    state.storyComplete = true;
    state.banner = { text: "STORY COMPLETE — Costa Azul is yours. Free roam!", t: 420 };
  }
  state.saveGame();
}

function advanceStage(state) {
  const mission = MISSIONS[state.missionIndex];
  state.stageIndex += 1;
  state.audio.play("pickup");
  if (state.stageIndex >= mission.stages.length) completeMission(state);
}

export function updateMissions(state) {
  const cur = currentStage(state);
  if (!cur) return;
  const { stage } = cur;
  const player = state.player;
  const target = stage.target();
  const d = dist(player.x, player.y, target.x, target.y);

  // Forced heat for the hot stages of M2 and M3.
  if (stage.heat && state.wanted < stage.heat && state.stageIndex === (cur.missionIndex === 2 ? 0 : 1)) {
    // M3 heats up at stage start; M2 heats up once the package is carried.
    if (cur.missionIndex === 2 || state.stageIndex === 1) reportCrime(state, stage.heat - state.wanted);
  }
  if (cur.missionIndex === 2 && state.stageIndex === 0 && !state.m3Heated) {
    state.m3Heated = true;
    reportCrime(state, 3 - state.wanted > 0 ? 3 - state.wanted : 0);
    if (state.wanted < 3) state.wanted = 3;
  }

  switch (stage.mode) {
    case "any":
      if (d < 60) advanceStage(state);
      break;
    case "onFoot":
      if (!player.car && d < 52) advanceStage(state);
      break;
    case "enterMarkedCar":
      if (player.car && player.car.marked) advanceStage(state);
      break;
    case "driveMarkedCar":
      if (player.car && player.car.marked && d < 78) {
        const car = player.car;
        advanceStage(state);
        car.marked = false;
      }
      break;
    case "loseHeat":
      if (state.wanted === 0) advanceStage(state);
      break;
  }
}
