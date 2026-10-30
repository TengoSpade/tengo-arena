# core/league

**Owner:** WP3 (league + calendar). **Status:** implemented and tested (M1.2). The contract functions in `index.ts` keep their phase-B signatures. The extra exports are additive. One contract function gained an optional parameter: `fixturesForWeek(state, weekIndex, content?)` (see change requests).

Specs: 03-league-economy sys-league, sys-calendar, sys-tournament; 03 §3.3; data in `leagues.json` (and `clubs.json` for start prestige). The code does not assume 23 weeks, 16 clubs or 3 tiers. The format needs exactly 2 wings and 2 cross-wing matchweeks, and it throws otherwise.

## Files
| File | Contents |
| --- | --- |
| `calendar.ts` | `weekDef`, `seasonStartCalendar`, `nextCalendar` (the last week leads to `season-end`, weekIndex W + 1), `calendarAt`, `seasonLength`, `matchweekWeek`, `lastRegularWeekIndex` |
| `schedule.ts` | seed order, serpentine wing draw, slot shuffle, circle method, mirrored second half, cross-wing weeks, `validateLeagueSchedule`, `setupSeason` |
| `standings.ts` | derived tables from `GameState.results`, points, the tie-break chain with restart, the seeded lot |
| `reckoning.ts` | seeding, bracket construction from `tournament.rounds`, fixtures created as ties become known, stages |
| `season-end.ts` | `promotionRelegation`, `applyTierMoves`, `archiveSeason`, `leagueSeasonColumns`, `compactAgedResults` (in season), `compactHistory` (season end), `compactedResult`, `leagueRecords` |
| `test-support.ts` | test-only helpers (fake results, a headless season driver); not exported from `index.ts` |

## How core/game uses it
- **New game:** set club tiers, then `setupSeason(draft, 1, content)`. Calendar: `seasonStartCalendar(1, content)`.
- **Week step 2:** store the `MatchResult` in `draft.results`, then call `recordResult(draft, result, content)`. This marks the fixture played, sets the competition status and advances the bracket, creating SF and final fixtures as soon as both clubs are known.
- **Week step 11:** after processing week `lastRegularWeekIndex(content)`, call `seedReckonings(draft, content)`. Then `draft.calendar = nextCalendar(draft.calendar, content)`.
- **Simulation order:** `fixturesForWeek(state, weekIndex, content)`. Pass `content` to get tier-level order.
- **Season end:**
  1. `moves = promotionRelegation(state, content)` (pure).
  2. `record = archiveSeason(state, moves, content)`, then push it to `draft.history`.
  3. Prizes.
  4. `applyTierMoves(draft, moves)`.
  5. Later steps.
  6. `setupSeason(draft, season + 1, content)`. The archive must already be in history and the moves applied.
  7. `draft.calendar = seasonStartCalendar(season + 1, content)`.
  8. Later steps (rookies, finance setup, the AI phase).
  9. `compactHistory(draft, content)`, last, after every step has read the ending season.
- `leagueSeasonColumns(state, record, clubId)` returns the league-owned columns of `ClubSeasonRow`. Game merges in the economy columns.
- **Week step 12 (after the calendar moved on):** `compactAgedResults(draft, season, processedWeek, content)` compacts the season's matches between other clubs that are `leagues.json matchRecords.compactAiMatchesAfterWeeks` (default 3) weeks old or older. See decision 12.

## Decisions (for the architect to merge as tech- entries)
1. **Wing order.** `WingDraw.clubIds` and the competition's `seedOrder` are in seed order: the index in the wing is the wing index k used by the cross-wing pairing. The shuffled slots for the circle method are not stored. They come again from `Rng(root, schedule, season, tierId, wingId)`.
2. **Downs.** The downs-difference tie-break uses Σ `FighterMatchStats.downsSuffered` per side, hired blades included. Downs inflicted are the opponent's downs suffered. `RoundResult.downs` is not read, because the model does not document which side it counts. A compacted result has no `fighterStats`, so its downs come from `fighterTotals` (side, downs suffered): the same sum, so the tables, the tie-break and the Reckoning seeding never depend on whether a match was compacted (this is what lets compaction run in season).
3. **Tie-break restart** (`restartOnSplit`). Points, match wins and round difference describe a club's whole record, so they apply in order to the whole table. Head-to-head and every later criterion work on the tied group. When one of them splits the group, each remaining tied subgroup restarts at head-to-head. "Met equally often" counts *played* league matches for every pair in the group, so mid-season tables often skip head-to-head. Lot: ascending `deriveSeed(root, schedule, season, tierId, clubId)`, the same key for wing and tier tables. A table with nothing played is ordered by lot.
4. **Seed order fallback.** When no `SeasonRecord` exists for season − 1, the season-1 rule applies: start prestige descending, ties by club id. Later seasons classify each club from the archived tier tables. A club found in no adjacent table throws an error. Promoted clubs keep the archived route order: the Reckoning champion first.
5. **Reckoning shape.** The competition's `clubIds` are the seeds; `wings` and `seedOrder` are empty. `BracketTie.home` and `away` are bracket positions in content order. The fixture's home club is the higher seed, which also holds at the neutral final (`homeSideForSim`). Pair tokens such as `"QF1"` use the code map QF/SF/F of the closed round vocabulary. A round without `pairs` pairs the previous round's winners in order.
6. **Statuses.** A league goes `scheduled` → `in-progress` → `completed` when every fixture is played (`seedReckonings` also marks it completed). A Reckoning becomes `completed` when the final is recorded.
7. **Archive.** `TierSeasonRecord.promotedIds` and `relegatedIds` list the clubs that left *that* tier, up or down. Promotions are in route order (reckoning, then shield). `shieldWinnerId` is always tier-table #1, even when the Shield promotion route passes to #2.
8. **Retention.** `RESULT_RETENTION_SEASONS = 2` (TUNABLE (tech), 05 §5). At the start of season N (end of the season-end step) the competitions, fixtures and results of seasons before N − 1 are deleted, and season N − 1 results are compacted, except the player club's matches, which stay in full until they are deleted. A compacted result keeps its ids, score, winner, round summaries, MVP and hired blades, the emergency entrants, the squads without their row maps (who was named, captain, vice), `fighterTotals` (for each fighter who started a round: side, rounds started, downs inflicted and suffered, damage dealt, healing done; about 30 bytes each, so an old report attributes every fighter to his club, swapped-in reserves and emergency entrants included) and `fielded` (each side's round-1 five as `[fighter id, row, kickoff rating]`; see decision 12); it drops the sim fighters, per-round final HP, per-fighter stats and the M1.1 per-round records `reserveInputs`, `roundLineups` and `betweenRounds` (about 14 of the 16 KB of a full result; they only serve re-simulation and the round-by-round timeline). A compacted result has no timeline. `isCompactedResult()` tells the match report that it cannot re-simulate such a result. Tables of past seasons come from `history`. Results are write-once and shared between states (core/model `beginTransition`), so compaction replaces an entry (`putResult`) and never edits one in place.
10. **Reckoning stages.** `TierSeasonRecord.reckoningStages` records each participant's furthest stage (quarterfinal, semifinal, final, champion); it matches `ClubSeasonRow.reckoning`.
11. **Indexes.** Fixtures and results are written only through `putFixture`, `putResult`, `removeFixture` and `removeResult` (core/model indexes); `fixturesForWeek` reads the week index and needs `content` for the tier order.
12. **In-season compaction (KI-2, owner answer to Q36, option A).** `compactAgedResults` runs at the end of every week processing (`processedWeek` = the week just processed) and compacts the current season's matches between other clubs whose week is at most `processedWeek − N`, N = `leagues.json matchRecords.compactAiMatchesAfterWeeks` (TUNABLE, default 3; optional in the schema so the frozen test fixture needs no key, `DEFAULT_COMPACT_AI_MATCHES_AFTER_WEEKS`). A match played in week w is compacted by the processing of week w + N, so the last N weeks stay in full and the match report of a recent match keeps its timeline. The player club's matches are never compacted in season (the season-end rule is unchanged: previous season, everything but the player's). With no player club every match is eligible. It looks at every aged result, not only week `processedWeek − N`, so a state saved by a build without the rule is caught up at its next week. It is a pure function of the state, so a save → load → advance equals advance. **What readers need:** nothing in the game reads a compacted match's detail except through what it keeps: the standings read `fighterTotals` for downs (decision 2); `core/economy` `seasonStarts` (the renewal ask: how often a fighter started this season) and the opponent's last fielded five on Home and Squad (D-R) read `fieldedFive(result, side)` (core/model), which returns the sim input's five while the result is full and `fielded` once it is compacted; the weekly income, Freshness rest, XP and lifecycle read only the current week's results, which are never compacted (N ≥ 1). `src/core/game/compaction.test.ts` runs the same seed with the rule off and on (N = 3 and 1) for a season and its end and compares the whole state except the compacted detail, the standings, each club's last five and the renewal asks every week. The match report of a compacted match is the summary (`MatchReport.compacted`, core/game README).
9. **Failures.** Every broken invariant throws `InvariantError`: unknown or replayed fixtures, a score that is not a decided best-of-N, a schedule that fails validation, a season set up twice, wrong tier sizes, an unfinished Reckoning at promotion time, or an invalid move.

## Tests
These files sit next to the code: `calendar.test.ts`, `schedule.test.ts` (le-001, le-002, seed orders), `standings.test.ts` (le-003, le-004, tie-break chain), `reckoning.test.ts` (le-005, le-006, bracket rules, a full 48-club Reckoning), `season-end.test.ts` (le-007, le-008, archive, season 2 setup, compaction, records, two-season determinism) and `perf.test.ts`. The perf test makes the 48-club fixture list in under 50 ms on a cold module, enforced by the Vitest timeout.

## Known gaps
- `fixturesForWeek` without `content` falls back to fixture-id order.
- Per-club Reckoning stage is not in `SeasonRecord` (see change requests). Use `reckoningStageForSeason(state, season, clubId)` while the competitions are still in the state.
- The promotion playoff (FUTURE) throws if enabled.
