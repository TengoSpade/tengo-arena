# core/game

**Owner:** WP5 (game loop, integrator). **Status:** implemented (M1.2/M1.3). Every function of the phase-B contract is implemented; extra exports are additive. Integrated with the real `fighters` (WP2), `league` (WP3) and `economy` (WP4); `sim`/`tactics` (WP1) run through the same ports as soon as they merge.

## Responsibility
The season state machine and the only entry points that change `GameState`: `createWorld`, `applyCommand`, `advanceWeek`, `runSeasonEnd`. Plus match preparation and read-only views (`getBlockers`, `prepareMatchInput`, `buildMatchReport`, `roster`, `fighterView`, `freeAgents`, `suggestLineup`, `releasePreview`, `captaincyPreview`).

## Files
| File | Contents |
| --- | --- |
| `ports.ts` | `GamePorts`: every other-module function the engine calls; `realGamePorts` binds the real modules |
| `engine.ts` | `createGameEngine(ports)`: the whole API over a set of ports (the public functions use `realGamePorts`) |
| `world.ts` | new game |
| `commands.ts` | validation and application of the 12 commands (`applyToDraft`), one rulebook for player and AI |
| `week.ts` | the 11-step week processing, lineup lock and hired blades, the AI action phase |
| `season-end.ts` | the season-end block (15 steps) |
| `match.ts` | sim inputs, results, aftermath news, match reports |
| `views.ts` | blockers and views |
| `shared.ts` | news, ordering, tidying of game-owned club fields, `GAME_NEWS_KEYS` |
| `stand-ins/` | small deterministic implementations of sim/tactics/fighters/league/economy for WP5 tests and `npm run soak -- --stand-ins`; **never** used by the shipped game |

## Pipelines (as implemented)
- **Week** (`leagues.json calendar.weekProcessingOrder`): 1 `fixturesForWeek(…, content)` → `fighters.lineupLock` per playing club (tier, id) → `economy.assignHiredBlades` → locked lineups (eligible entries + blades, written to `club.lineup`) → `sim.simulateMatch` (record `none`) per fixture; 2 `league.recordResult`; 3 `fighters.applyMatchLifecycle` per result (+ one `match.result` news item), `fighters.weeklyLifecycle`; 4–6 `economy.weeklyIncome`, `weeklyCosts`, `financialStatus`; 7 (P1) `releaseTrialsRookies`; 8 `resolveFreeAgentOffers`; tidy lineups/captaincy; 9 AI phase (`ai.planWeek` → `applyCommand` rules, clubs by tier then id, the player's club skipped); 10 `topUpFreeAgentPool`; 11 after `lastRegularWeekIndex` `seedReckonings`, then `nextCalendar`.
- **Season end**: `promotionRelegation` → `archiveSeason` (pushed to history) → `seasonPrizes` → `applyTierMoves` → `updatePrestige` → club season rows (`leagueSeasonColumns` + money + prestige) → `seasonEndDevelopment` → `seasonEndRetirements` → `contractExpiries` → tidy → `offseasonRecovery` → `poolMaintenance` (leavers archived as `left-unsigned`) → `setupSeason(season+1)` → `seasonStartCalendar` → `generateRookies` → `nextSeasonFinanceSetup` → AI memory reset, news pruned to two seasons, `announceFinalSeasons` → AI phase (`ai.planSeasonEnd`) → retention: `compactHistory`, then departed fighters (retired, career-ended, left unsigned, past hired blades) move to `alumni` and every roster-side reference to them is dropped.
- **New game**: clubs → world-gen fighters joined to their club without contracts → free agents → `setupSeason(1)` → `generateRookies` → `economy.initialFinances` (first economy call: greed, contracts, finances, 95% trim) → `assignTrialsRookies` → per club `ai.planRoster` through commands → `announceFinalSeasons`.

## Decisions (proposed `tech-` entries)
1. **Ports seam.** The engine calls other modules only through `GamePorts`; tests spy on it (pipeline order) or substitute stand-ins. Public functions are bound to the real modules.
2. **Headless mode.** With `playerClubId === null` every club is AI-managed and `advanceWeek` skips the player blockers (soak). `getBlockers` still reports `club.not-chosen` so the UI never offers Continue before a club is chosen.
3. **Season-1 AI opening phase.** Season 1 has no preceding season end, so the AI's season-start phase (`planSeasonEnd`: trials signings, opening offers, captains) runs at the start of the first P1 processing. A player who picks a club starts with no AI-made offers or signings.
4. **All matches inside week processing.** M1 has no separate "play own match" call: `advanceWeek` plays the player's fixture with the rest and `WeekReport.playerFixtureId` names it (05 §5).
5. **Locked lineups.** At lock, ineligible entries drop out, hired blades fill short sides and the locked lineup is written to `club.lineup`; blades and departed fighters are tidied out after the match. A last-resort fill from fit roster fighters protects AI clubs; the player is held by `getBlockers`.
6. **Aftermath persistence.** XP and injuries of a match are not part of `MatchResult`, so a club-scoped `match.result` news item per club and fixture (in the club's own perspective, matching the UI digest template) stores them (`x:<fighterId>`, `i:<fighterId>`); `buildMatchReport` reads it. Gold comes from the ledger (`fixtureId`).
7. **Report timeline** is re-simulated at `summary` only when engine version and content hash match and the result is not compacted, and only if every round checksum reproduces.
8. **World rosters in the tier bands.** World-gen fighters get `FighterSpec.ratingTarget` drawn in `leagues.json tiers.ratingBand` (mean of two uniform draws, `STREAM.world`). Without it the potential shifts alone gave every tier a mean rating of about 47 and Muster bills of about 2× WB, so 30% of clubs were insolvent after season 1 (`WORLDGEN_RATING_IN_TIER_BAND`; remove when generation is retuned).
9. **Errors.** Expected failures return stable codes (below); a module exception during a transition becomes `engine.failure` (or `lineup.unfillable`) and no state is returned.
10. **Views without content.** `roster` and `freeAgents` gained an optional `content` parameter (additive) to sort by rating / market wage; without it they sort by id.
11. **Transitions share write-once state.** Each transition starts with `beginTransition` (core/model): mutable parts are deep-copied, `results`, `history` and `alumni` are shared (deep-frozen entries), and the draft is indexed (rosters, the free-agent pool, results per club, fixtures per week). Each transition runs inside `fighters.withDerivedMemo`, so ratings and potentials are computed once per lifecycle epoch.
12. **Captaincy preview.** `captaincyPreview(state, clubId, captainId, viceCaptainId, content)` gives the proposed captain and vice with CQ and grade, who is Snubbed or Passed Over at the next lock (against the captain at the last lock, so switching back is free) and lineup chemistry of the current lineup before and after.
13. **News read state.** `news.setRead { newsIds, read }` sets or clears the flag (the UI's Undo); it is allowed in the season-end phase. `news.markRead` stays as the read-only form.

## Error codes
`club.unknown`, `club.already-chosen`, `phase.season-end`, `phase.not-season-end`, `advance.blocked`, `lineup.size`, `lineup.duplicate`, `lineup.row`, `lineup.not-on-roster`, `lineup.captain-not-fielded`, `lineup.incomplete`, `lineup.unfillable`, `tactics.not-on-roster`, `tactics.custom-unavailable`, `captaincy.same`, `captaincy.not-on-roster`, `training.disabled`, `training.emphasis`, `training.not-on-roster`, `offer.not-free-agent`, `offer.trials-rookie`, `offer.wage`, `offer.length`, `renew.not-on-roster`, `trials.not-offered`, `release.not-on-roster`, `shortlist.unknown-fighter`, `news.unknown`, `report.not-played`, `fixture.unknown`, `world.seed`, `world.setup`, `world.roster`, `engine.failure`. Economy and tactics codes pass through unchanged.

## News keys (stable; `GAME_NEWS_KEYS`)
`match.result` (one per club and fixture: won, for, against, opponent, opponentId, venue, x:/i: aftermath) and `captain.interim` (player club). Other modules document their own keys.

## Known gaps
- No "play my match first" step: the player's report is available after Continue (decision 4).
- WP6 requests not done here: unread toggle for news (needs a `Command` change: architect), captaincy-change preview (needs a fighters export), weekly finance projection (economy's `financeDetails` / `watchProjection`).

## Orchestrator decisions (M1 core fix round, pending owner confirmation)
- **Inherited names** never resolve as clubs or fighters: command validation (`clubCheck`, shortlist, release) and views use `getOwn`.
- **D-P, season-1 start.** World creation makes a season-1 Trials Day class of exactly one rookie per club with the normal rookie generator (`fighters.generateRookies(draft, content, count)`); later seasons use the intake formula. The AI season-start setup (captains, vice, training emphasis, opening offers) runs for every club before P1, planned on a scratch copy where each club has already signed its trials rookie at his Trials Day ask, so the offers leave cap and wage room for him. Trials signings wait for the first P1 processing (AI clubs only). `club.choose` withdraws the AI's offers made for the chosen club, so the player makes its market decisions, as after every season end. Starting balance rule: the opening balance is the starting balance (pre-setup cash); the first central-grant installment is one separate setup ledger credit; the season budget counts the season's grant once, and the WB reserve term uses the pre-credit balance, as at every later setup.
- **D-S, auto-captain at kickoff** (`autoCaptain`, week.ts): a club whose captain is missing (none named, or off the roster) gets the vice if fit, else the fit starter with the highest CQ (ties: matchweeks at the club, rating, id), with a `captain.interim` news item (`params.reason` `vice` | `starter`). Same rule for AI clubs. The `captain.missing` blocker is no longer emitted. A captain who is only unavailable keeps the job; the fight lead is then the vice, else the best-CQ starter (fighters.lineupCaptain).

## Polish round (QA findings; orchestrator decisions pending owner confirmation)
- **`developmentSummary(state, season): FighterDevelopment[]`** — every fighter rostered at that season end: `{ fighterId, ageBefore, ageAfter, ratingBefore, ratingAfter, attributeDeltas: Record<StatId, number>, potentialChange?, retired? }` (before = before the aging and development step; every stat id present, 0 when unchanged). Stored on the season's `SeasonRecord.development` during the season-end step and dropped from older records at the next one, so it is available until the next season end; `[]` for any other season.
- **Renewals until expiry.** `contract.renew` is allowed while the season-end step is pending; the expiry step then keeps the renewed contract. A `contract.expiring` (urgent) item per unrenewed player contract is posted at the processing that leaves `economy.json contracts.expiryReminderWeeksBeforeEnd` (4) weeks in the season (refs.fighterId; params count, season, weeksLeft).
- **Season-end report.** `playerClub.wageRaises` lists the player's contracts raised to the tier minimum at next-season setup (also `SeasonRecord.wageRaises` for every club).
- **Key moments.** A `cast.interrupt` without an interrupter (the caster dropped the cast: target out of range or down) is not a key moment.
