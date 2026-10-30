/**
 * npm run spent-drift -- [--seasons 10] [--seed soak-1] [--spent 25]
 *
 * Diagnostic for the `spent-share` soak WARN (KI-21 follow-up, m1.1/spent-drift): runs the AI-managed league
 * headless and, per season, explains who starts rounds Spent (Freshness < --spent, default the Tired tier's minimum, 25) and why:
 * AI roster age / Stamina / size / injuries, matches per club, how many Spent round-1 starters had a rested
 * alternative (the policy chose) or none (no eligible replacement), later-round Spent starts, and the Spent
 * starters by personality. Not a gate; prints tables only.
 */
import { createGameEngine, realGamePorts } from '../src/core/game';
import { staminaOf } from '../src/core/fighters/freshness';
import { clubRoster, type ClubId, type Fighter, type GameState, type MatchResult } from '../src/core/model';
import { intArg, parseArgs, stringArg } from './lib/args';
import { loadThemeOrExit } from './lib/cli-content';

const args = parseArgs(process.argv.slice(2));
const seasons = intArg(args, 'seasons', 10);
const seed = stringArg(args, 'seed', 'soak-1');
const content = loadThemeOrExit(stringArg(args, 'theme', 'default'));
// Spent = below the Tired tier's minimum (O36: 25), read from levels.json freshness.labels; --spent overrides.
const spentBelow = intArg(args, 'spent', content.levels.freshness.labels.find((l) => l.id === 'tired')!.min);
const engine = createGameEngine(realGamePorts);
const humanAge = (f: Fighter): number => realGamePorts.fighters.humanAge100(f, content) / 100;
const mean = (v: number[]): number => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const f1 = (n: number): string => n.toFixed(1);

interface Acc {
  starts: number;
  spent: number;
  spentR1: number;
  spentR1NoAlt: number;
  spentR1AltRested: number; // alternative with Freshness >= 50 existed
  spentLater: number;
  spentLaterCarried: number; // already Spent at the previous round's start
  startAge: number[];
  spentAge: number[];
  startSta: number[];
  spentSta: number[];
  spentOld31: number;
  starts31: number;
  rosterSize: number[];
  rosterAge: number[];
  rosterSta: number[];
  fitNotSquad: number[];
  unfit: number[];
  matchesPerClub: Map<string, number>;
  byPers: Map<string, { starts: number; spent: number }>;
  byTier: Map<string, { starts: number; spent: number }>;
  swapsUsed: number;
  benchGap: number[];
  altGap: number[];
  byAge: Map<string, { starts: number; spent: number }>;
  r1FreshMean: number[];
}
const fresh = (): Acc => ({
  starts: 0, spent: 0, spentR1: 0, spentR1NoAlt: 0, spentR1AltRested: 0, spentLater: 0, spentLaterCarried: 0,
  startAge: [], spentAge: [], startSta: [], spentSta: [], spentOld31: 0, starts31: 0,
  rosterSize: [], rosterAge: [], rosterSta: [], fitNotSquad: [], unfit: [],
  matchesPerClub: new Map(), byPers: new Map(), byTier: new Map(), swapsUsed: 0, byAge: new Map(), benchGap: [], altGap: [], r1FreshMean: [],
});

const created = engine.createWorld(content, { rootSeed: seed });
if (!created.ok) throw new Error(created.error.message);
let state: GameState = created.value;
const rows: string[][] = [];
const persRows: string[] = [];
const ageRows: string[] = [];
for (let s = 0; s < seasons; s++) {
  const acc = fresh();
  while (state.calendar.phase !== 'season-end') {
    const before = state;
    const r = engine.advanceWeekLogged(state, content);
    if (!r.ok) throw new Error(r.error.message);
    state = r.value.state;
    const results: MatchResult[] = r.value.report.fixtureIds.map((id) => state.results[id]!).filter(Boolean);
    if (results.length === 0) continue;
    const fighters = before.fighters;
    const clubsToday = new Set<ClubId>();
    for (const res of results) {
      for (const side of ['home', 'away'] as const) {
        const clubId = side === 'home' ? res.homeClubId : res.awayClubId;
        if (clubId === state.playerClubId) continue;
        clubsToday.add(clubId);
        acc.matchesPerClub.set(clubId, (acc.matchesPerClub.get(clubId) ?? 0) + 1);
        const club = before.clubs[clubId]!;
        const squadIds = new Set<string>();
        const prevSpent = new Set<string>();
        (res.roundLineups ?? []).forEach((rl, ri) => {
          const lu = rl[side];
          const spentNow = new Set<string>();
          lu.fighterIds.forEach((id, i) => {
            const fb = fighters[id] ?? state.fighters[id];
            if (!fb) return;
            const fr = lu.freshness[i]!;
            const isSpent = fr < spentBelow;
            const age = humanAge(fb);
            const sta = staminaOf(fb, content);
            acc.starts++;
            acc.startAge.push(age);
            acc.startSta.push(sta);
            if (age >= 31) acc.starts31++;
            const p = acc.byPers.get(club.aiPersonalityId) ?? { starts: 0, spent: 0 };
            const t = acc.byTier.get(club.tierId) ?? { starts: 0, spent: 0 };
            p.starts++;
            t.starts++;
            if (isSpent) {
              spentNow.add(id);
              acc.spent++;
              p.spent++;
              t.spent++;
              acc.spentAge.push(age);
              acc.spentSta.push(sta);
              if (age >= 31) acc.spentOld31++;
              if (ri === 0) acc.spentR1++;
              else {
                acc.spentLater++;
                if (prevSpent.has(id)) acc.spentLaterCarried++;
              }
            }
            const band = age < 25 ? '<25' : age < 31 ? '25-30' : age < 35 ? '31-34' : '35+';
            const a = acc.byAge.get(band) ?? { starts: 0, spent: 0 };
            a.starts++;
            if (isSpent) a.spent++;
            acc.byAge.set(band, a);
            acc.byPers.set(club.aiPersonalityId, p);
            acc.byTier.set(club.tierId, t);
            squadIds.add(id);
          });
          if (ri === 0) {
            acc.r1FreshMean.push(mean(lu.freshness));
            const roster = clubRoster(before, clubId);
            const starters = new Set(lu.fighterIds);
            const alts = roster.filter((o) => !starters.has(o.id) && realGamePorts.fighters.isFit(o));
            lu.fighterIds.forEach((_id, i) => {
              if (lu.freshness[i]! >= spentBelow) return;
              if (!alts.some((o) => (o.freshness10 ?? 1000) >= content.levels.aiRotation.spentFloorAltMin * 10)) acc.spentR1NoAlt++;
              const me = fighters[lu.fighterIds[i]!] ?? state.fighters[lu.fighterIds[i]!];
              const rested = alts.filter((o) => (o.freshness10 ?? 1000) >= 500).map((o) => realGamePorts.fighters.rating(o, content));
              if (me && rested.length) acc.altGap.push(realGamePorts.fighters.rating(me, content) - Math.max(...rested));
              if (alts.some((o) => (o.freshness10 ?? 1000) >= 500)) acc.spentR1AltRested++;
            });
          }
          prevSpent.clear();
          for (const id of spentNow) prevSpent.add(id);
        });
        acc.swapsUsed += (res.betweenRounds ?? []).reduce((n, b) => n + b[side].length, 0);
      }
    }
    // weekly roster snapshot of the AI clubs that played (post-sim state before the week = what the lock saw)
    for (const clubId of clubsToday) {
      const roster = clubRoster(before, clubId);
      acc.rosterSize.push(roster.length);
      const rs = roster.map((f) => realGamePorts.fighters.rating(f, content)).sort((a, b) => b - a);
      if (rs.length >= 8) acc.benchGap.push(mean(rs.slice(0, 5)) - mean(rs.slice(5, 8)));
      acc.rosterAge.push(mean(roster.map(humanAge)));
      acc.rosterSta.push(mean(roster.map((f) => staminaOf(f, content))));
      acc.unfit.push(roster.filter((f) => !realGamePorts.fighters.isFit(f)).length);
      const club = before.clubs[clubId]!;
      const sq = new Set([...(club.lineup?.fighters.map((e) => e.fighterId) ?? []), ...(club.lineup?.reserves ?? [])]);
      acc.fitNotSquad.push(roster.filter((f) => realGamePorts.fighters.isFit(f) && !sq.has(f.id)).length);
    }
  }
  const end = engine.runSeasonEndLogged(state, content);
  if (!end.ok) throw new Error(end.error.message);
  state = end.value.state;
  const m = [...acc.matchesPerClub.values()];
  const pct = (a: number, b: number): string => (b ? ((a * 100) / b).toFixed(1) : '0.0');
  rows.push([
    String(s + 1), pct(acc.spent, acc.starts), `${pct(acc.spentR1, acc.starts)}/${pct(acc.spentLater, acc.starts)}`,
    `${acc.spentR1NoAlt}/${acc.spentR1}`, String(acc.spentR1AltRested), String(acc.spentLaterCarried),
    f1(mean(acc.startAge)), f1(mean(acc.spentAge)), f1(mean(acc.startSta)), f1(mean(acc.spentSta)),
    pct(acc.starts31, acc.starts), pct(acc.spentOld31, acc.spent),
    f1(mean(acc.rosterSize)), f1(mean(acc.rosterAge)), f1(mean(acc.rosterSta)), f1(mean(acc.unfit)), f1(mean(acc.fitNotSquad)),
    f1(mean(m)), f1(mean(acc.r1FreshMean)), String(acc.swapsUsed), f1(mean(acc.benchGap)), f1(mean(acc.altGap)),
  ]);
  ageRows.push(`S${s + 1} ` + ['<25', '25-30', '31-34', '35+'].map((k) => { const v = acc.byAge.get(k); return `${k}: ${pct(v?.spent ?? 0, v?.starts ?? 0)}% of ${pct(v?.starts ?? 0, acc.starts)}% starts`; }).join('  '));
  persRows.push(`S${s + 1} ` + [...acc.byPers].sort().map(([k, v]) => `${k} ${pct(v.spent, v.starts)}%`).join('  ') + ' | ' + [...acc.byTier].sort().map(([k, v]) => `${k} ${pct(v.spent, v.starts)}%`).join('  '));
}
const head = ['S', 'Spent%', 'R1/later%', 'R1noAlt/R1', 'R1altRested', 'laterCarried', 'startAge', 'spentAge', 'startSta', 'spentSta', 'start31+%', 'spent31+%', 'roster', 'rAge', 'rSta', 'unfit', 'fitBench', 'm/club', 'R1fresh', 'swaps', 'top5-bench', 'R1spent-vs-bestAlt'];
console.log(`spent-drift seed ${seed} (Spent = Freshness < ${spentBelow})`);
console.log(head.join('\t'));
for (const r of rows) console.log(r.join('\t'));
console.log(ageRows.join('\n'));
console.log(persRows.join('\n'));
