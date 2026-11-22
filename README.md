# vice-heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/madinzgod/vice-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/madinzgod/vice-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Vice Heat: Costa Azul** (v4) is an original **3D third-person open-world
crime game** that runs in the browser. You are Rico Alvarez, back in the
island city of Costa Azul after three years away, working jobs for fixer
Marisol Vega across a full city: an art-deco beachfront boulevard with palms,
a marina with boats, a neon night market, downtown blocks with lit windows,
and a beach on the south shore.

Play it on foot or behind the wheel: walk and run in third person, aim and
shoot with the mouse, steal and drive cars with a chase camera, and outrun a
five-star wanted system — police cars that pursue and box you in, and a
patrol helicopter with a spotlight at four stars and up. A three-mission
story chain (First Wheels, Hot Cargo, Cool Down) with staged objectives,
dialogue, cash rewards and glowing objective beacons drives the progression,
under a full HUD: minimap, health and armour bars, cash, wanted stars,
weapon/ammo, mission panel and speedometer. Progress saves to a local save
slot from the title screen.

The city is rendered in real-time 3D with a vendored Three.js build
(`game/vendor/three.min.js`); every other file is hand-written for this game,
and the game itself makes no network requests. Day, dusk and night lighting
presets cover the boulevard, the downtown run and the night market.

## Run it

```sh
node serve.ts
```

Then open http://127.0.0.1:8080/ in a browser. Move with WASD or the arrow
keys, hold Shift to run, press E to enter or leave a car, aim with the mouse
and click to shoot, advance dialogue with Space, and pause with Esc or P.
To build the submission dossier instead, run `node main.ts` and read the
generated `dossier.json`.

## Layout

- `game/index.html` + `game/style.css` — page, HUD and title-screen styling
- `game/src/world.js` — the Costa Azul city: roads, blocks, marina, beach
- `game/src/vehicles.js` — car factory, arcade driving, traffic AI
- `game/src/player.js` — articulated characters, pedestrians, the player
- `game/src/police.js` — pursuit cars and the patrol helicopter
- `game/src/missions.js` — the three-mission story chain and dialogue
- `game/src/hud.js` — HUD, dialogue box and minimap
- `game/src/audio.js` — WebAudio engine, shots, coins and sirens
- `game/src/main.js` — game loop, cameras, combat and save flow

---
<sub>Entered on [make.fun](https://make.fun/?ref=nnk13219&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
