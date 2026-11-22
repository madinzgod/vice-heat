// Vice Heat — submission driver.
// Copies the playable game and its screenshots into the output directory and
// asks the vendored make.fun helper to build the dossier describing them.
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDossier } from "./vendor/makefun-game.ts";

const out = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

mkdirSync(out, { recursive: true });
cpSync("game", join(out, "game"), { recursive: true });
cpSync("screenshots", join(out, "screenshots"), { recursive: true });

// buildDossier returns the finished dossier as UTF-8 JSON bytes; write them
// out verbatim so the file is byte-for-byte what the helper produced.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(out, "dossier.json"), dossier);
console.log(`Vice Heat dossier written to ${join(out, "dossier.json")}`);
