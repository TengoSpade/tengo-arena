/**
 * npm exec tsx scripts/replay.ts -- <state-dump.json | save.json> [--weeks 1] [--theme default] [--watch]
 *
 * Reproduce weeks headless from a state dump (the UI's "download state dump")
 * or a save file (05 §8 diagnostics; WP5 acceptance "the state-dump replay
 * reproduces a week"). The dump's command log is not re-applied: the save in
 * the dump is the state the commands produced. Each week is advanced twice
 * from the same state and must give identical checksums; a player blocker
 * (e.g. an injured starter) is resolved with the auto-pick, as noted in the output.
 *
 * The file is only read. After loading, the state is saved again in memory and parsed back: an older save
 * (migratedFrom) must come back as a current one without a migration, with the same checksum and the same bytes
 * when saved a second time (M2: a v4 save loads as v5 and saves back identically).
 *
 * --watch (M2, 05-technical-m2 §A3): each week is also played through advance with the player's match watched
 * (Play match → Watch: every round waits for the viewer, is loaded with liveRoundPlayback and committed with the
 * shown log's hash; between rounds the suggestions are accepted) and must end in the same state as advanceWeek;
 * every watched round then replays (roundPlayback) to its stored checksum with the shown log's hash.
 */
import { readFileSync } from 'node:fs';
import { advance, advanceWeek, applyCommand, getBlockers, liveRoundPlayback, roundPlayback, suggestLineup } from '../src/core/game';
import type { FixtureId, GameState } from '../src/core/model';
import { checksumState, createSave, parseSave, serializeSave } from '../src/core/save';
import { intArg, parseArgs, stringArg } from './lib/args';
import { loadThemeOrExit } from './lib/cli-content';

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: tsx scripts/replay.ts <state-dump.json | save.json> [--weeks 1] [--theme default] [--watch]');
  process.exit(2);
}
const args = parseArgs(argv);
const weeks = intArg(args, 'weeks', 1);
const watch = args.has('watch');
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
const from = parsed.value.migratedFrom;
console.log(
  `loaded ${state.calendar.weekId ?? state.calendar.phase} of season ${state.calendar.season}, schema ${state.schemaVersion}${from === null ? '' : ` (migrated from v${from})`}, checksum ${checksumState(state)}`,
);

// Saved back: a current save that loads without a migration, with the same checksum and the same bytes again.
{
  const env = parsed.value.envelope;
  const first = serializeSave(createSave(state, env.meta, { engineVersion: env.engineVersion }));
  const again = parseSave(first, content);
  const second = again.ok ? serializeSave(createSave(again.value.envelope.state, again.value.envelope.meta, { engineVersion: again.value.envelope.engineVersion })) : '';
  const same = again.ok && again.value.migratedFrom === null && checksumState(again.value.envelope.state) === checksumState(state) && second === first;
  console.log(`  saved back as v${state.schemaVersion}: ${(first.length / 1e6).toFixed(2)} MB, ${same ? 'loads without a migration, same checksum, same bytes' : `MISMATCH (${again.ok ? 'state or bytes differ' : again.error.code})`}`);
  if (!same) process.exitCode = 1;
}

function unblocked(s: GameState): GameState {
  if (s.playerClubId === null || !getBlockers(s, content).some((b) => b.code.startsWith('lineup.'))) return s;
  const fixed = applyCommand(s, suggestLineup(s, s.playerClubId, content), content);
  if (!fixed.ok) return s;
  console.log('  player lineup blocked: applied the auto-pick');
  return fixed.value.state;
}

/** The week through advance with the player's match watched; the shown logs by "fixture#round". */
function watchedWeek(s: GameState): { state: GameState; shown: Map<string, string> } | string {
  const shown = new Map<string, string>();
  let r = advance(s, content, { playerMatch: 'watch' });
  for (let steps = 0; r.ok && r.value.week === null; steps++) {
    if (steps > 30) return 'the week never finished';
    const w = r.value.watch;
    if (w) {
      const live = liveRoundPlayback(r.value.state, content);
      if (!live.ok) return `liveRoundPlayback: ${live.error.code} ${live.error.message}`;
      shown.set(`${w.fixtureId}#${w.round}`, live.value.log.hash);
      r = advance(r.value.state, content, { watched: { round: w.round, logHash: live.value.log.hash } });
    } else r = advance(r.value.state, content);
  }
  return r.ok ? { state: r.value.state, shown } : `${r.error.code} ${r.error.message}`;
}

for (let i = 0; i < weeks; i++) {
  state = unblocked(state);
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
  if (watch) {
    const w = watchedWeek(state);
    if (typeof w === 'string') {
      console.error(`  watched week failed: ${w}`);
      process.exitCode = 1;
    } else {
      const cw = checksumState(w.state);
      let replayed = 0;
      for (const [key, hash] of w.shown) {
        const [fixtureId, round] = key.split('#') as [FixtureId, string];
        const rp = roundPlayback(w.state, fixtureId, Number(round), content);
        if (rp.ok && rp.value.log.hash === hash) replayed++;
      }
      const ok = cw === ca && replayed === w.shown.size;
      console.log(`    watched: ${w.shown.size} rounds shown and committed, checksum ${cw} ${cw === ca ? '(= simulated)' : 'MISMATCH'}, ${replayed}/${w.shown.size} replay with the shown log`);
      if (!ok) process.exitCode = 1;
    }
  }
  state = a.value.state;
}
