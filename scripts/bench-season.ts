/**
 * npm run bench -- [--seasons 10] [--seed soak-1] [--player] [--theme default]
 *
 * Headless performance benchmark of the season engine (05 §8 budgets):
 * per-season wall time, the slowest and median week (advanceWeek plus the
 * autosave, as in the browser), a full state clone, the autosave
 * (createSave + serializeSave; season-end and the slowest week) and the save
 * size (season end and the largest week). With
 * --player the first club is the player's (lineups suggested each week), as
 * in the browser. No soak checks: this measures the engine alone.
 */
import { performance } from 'node:perf_hooks';
import { realGamePorts, createGameEngine } from '../src/core/game';
import type { GameState } from '../src/core/model';
import { createSave, saveMetaFor, serializeSave } from '../src/core/save';
import { cloneJson } from '../src/core/util';
import { intArg, parseArgs, stringArg } from './lib/args';
import { loadThemeOrExit } from './lib/cli-content';

const args = parseArgs(process.argv.slice(2));
const seasons = intArg(args, 'seasons', 10);
const seed = stringArg(args, 'seed', 'soak-1');
const theme = stringArg(args, 'theme', 'default');
const player = args.has('player');
const content = loadThemeOrExit(theme);
const engine = createGameEngine(realGamePorts);

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[(s.length - 1) >> 1]! + s[s.length >> 1]!) / 2 : 0;
};
const autosave = (state: GameState): { ms: number; bytes: number } => {
  const t = performance.now();
  const env = createSave(
    state,
    saveMetaFor(state, { slotId: 'auto-1', kind: 'auto', label: 'bench', savedAt: '1970-01-01T00:00:00Z', playtimeSec: 0, gameVersion: 'bench' }),
    { engineVersion: realGamePorts.sim.engineVersion },
  );
  const json = serializeSave(env);
  return { ms: performance.now() - t, bytes: json.length };
};

const t0 = performance.now();
const created = engine.createWorld(content, { rootSeed: seed });
if (!created.ok) throw new Error(created.error.message);
let state = created.value;
console.log(`createWorld: ${(performance.now() - t0).toFixed(0)} ms`);
if (player) {
  const first = content.clubs.list[0]!.id;
  const r = engine.applyCommand(state, { type: 'club.choose', clubId: first as never }, content);
  if (!r.ok) throw new Error(r.error.message);
  state = r.value.state;
}

console.log('season   total s   week med ms  week max ms  clone ms  autosave ms  (max)  save KB  (max)  fighters  alumni');
const rows: number[] = [];
for (let s = 0; s < seasons; s++) {
  const start = performance.now();
  const weekMs: number[] = [];
  let maxSaveMs = 0;
  let maxSaveBytes = 0;
  while (state.calendar.phase !== 'season-end') {
    if (player && state.playerClubId) {
      const cmd = engine.suggestLineup(state, state.playerClubId, content);
      const r = engine.applyCommand(state, cmd, content);
      if (r.ok) state = r.value.state;
    }
    const w = performance.now();
    const r = engine.advanceWeek(state, content);
    if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
    state = r.value.state;
    const weekSave = autosave(state);
    weekMs.push(performance.now() - w);
    maxSaveMs = Math.max(maxSaveMs, weekSave.ms);
    maxSaveBytes = Math.max(maxSaveBytes, weekSave.bytes);
  }
  const c = performance.now();
  cloneJson(state);
  const cloneMs = performance.now() - c;
  const end = engine.runSeasonEnd(state, content);
  if (!end.ok) throw new Error(`${end.error.code}: ${end.error.message}`);
  state = end.value.state;
  const save = autosave(state);
  const total = (performance.now() - start) / 1000;
  rows.push(total);
  const fighters = Object.values(state.fighters);
  console.log(
    `${String(state.calendar.season - 1).padStart(6)} ${total.toFixed(2).padStart(9)} ${median(weekMs).toFixed(0).padStart(12)} ${Math.max(...weekMs).toFixed(0).padStart(12)} ${cloneMs.toFixed(1).padStart(9)} ${save.ms.toFixed(1).padStart(12)} ${maxSaveMs.toFixed(0).padStart(6)} ${(save.bytes / 1024).toFixed(0).padStart(8)} ${(maxSaveBytes / 1024).toFixed(0).padStart(6)} ${String(fighters.length).padStart(9)} ${String(Object.keys(state.alumni).length).padStart(7)}`,
  );
}
console.log(`median season ${median(rows).toFixed(2)} s; first ${rows[0]?.toFixed(2)} s, last ${rows[rows.length - 1]?.toFixed(2)} s`);
