/**
 * npm exec tsx scripts/replay.ts -- <state-dump.json | save.json> [--weeks 1] [--theme default]
 *
 * Reproduce weeks headless from a state dump (the UI's "download state dump")
 * or a save file (05 §8 diagnostics; WP5 acceptance "the state-dump replay
 * reproduces a week"). The dump's command log is not re-applied: the save in
 * the dump is the state the commands produced. Each week is advanced twice
 * from the same state and must give identical checksums; a player blocker
 * (e.g. an injured starter) is resolved with the auto-pick, as noted in the output.
 */
import { readFileSync } from 'node:fs';
import { advanceWeek, applyCommand, getBlockers, suggestLineup } from '../src/core/game';
import type { GameState } from '../src/core/model';
import { checksumState, parseSave } from '../src/core/save';
import { intArg, parseArgs, stringArg } from './lib/args';
import { loadThemeOrExit } from './lib/cli-content';

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: tsx scripts/replay.ts <state-dump.json | save.json> [--weeks 1] [--theme default]');
  process.exit(2);
}
const args = parseArgs(argv);
const weeks = intArg(args, 'weeks', 1);
const content = loadThemeOrExit(stringArg(args, 'theme', 'default'));

const raw = JSON.parse(readFileSync(file, 'utf8')) as { format?: string; envelope?: unknown };
const envelopeJson = JSON.stringify(raw.format === 'arena-league-state-dump' ? raw.envelope : raw);
const parsed = parseSave(envelopeJson, content);
if (!parsed.ok) {
  console.error(`cannot load: ${parsed.error.code} ${parsed.error.message}`);
  process.exit(1);
}
for (const w of parsed.value.warnings) console.warn(`warning: ${w}`);
let state: GameState = parsed.value.envelope.state;
console.log(`loaded ${state.calendar.weekId ?? state.calendar.phase} of season ${state.calendar.season}, checksum ${checksumState(state)}`);

for (let i = 0; i < weeks; i++) {
  if (state.playerClubId !== null && getBlockers(state, content).some((b) => b.code.startsWith('lineup.'))) {
    const fixed = applyCommand(state, suggestLineup(state, state.playerClubId, content), content);
    if (fixed.ok) {
      state = fixed.value.state;
      console.log('  player lineup blocked: applied the auto-pick');
    }
  }
  const a = advanceWeek(state, content);
  const b = advanceWeek(state, content);
  if (!a.ok || !b.ok) {
    const e = !a.ok ? a.error : !b.ok ? b.error : null;
    console.error(`week failed: ${e?.code} ${e?.message}`);
    process.exit(1);
  }
  const ca = checksumState(a.value.state);
  const cb = checksumState(b.value.state);
  console.log(`  ${a.value.report.weekId}: ${a.value.report.fixtureIds.length} fixtures, checksum ${ca} ${ca === cb ? '(reproduced)' : `MISMATCH ${cb}`}`);
  if (ca !== cb) process.exitCode = 1;
  state = a.value.state;
}
