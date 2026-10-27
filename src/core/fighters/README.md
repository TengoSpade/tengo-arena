# core/fighters

**Owner:** WP2 (fighters); M1.1 WP-B. **Status:** M1 implemented; M1.1 (levels, offers, auto-pick, bench XP, Stamina, Freshness) implemented, see "M1.1" below. Every function of the phase-B contract in `index.ts` is implemented; additive exports are listed at the bottom of `index.ts`. Rules: 03 §3.2 (sys-races, sys-fighters, sys-youth-intake, sys-development, sys-injury, sys-traits, sys-captaincy, sys-chemistry); numbers: `content/<theme>/{races,traits,names,development}.json`.

## Age curves per race (O11, D-B)

Every age rule reads **human-age** = age × 80 ÷ lifespan; per-season rates are scaled by k = 80 ÷ lifespan. So each race passes the same milestones at the same human-age, at its own real age:

| Human-age | Human (80) | Elf (120) | Dwarf (72) | Orc (64) | Ashkin (52) | Physical × | Mental × |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 18 | 18 | — | 17 | — | — | 60% | 57% |
| 22 | 22 | 33 | 20 | 18 | — | 79% | 70% |
| 25 | 25 | 38 | 23 | 20 | 17 | 91% | 78% |
| **28 physical peak** | **28** | **42** | 26 | 23 | 19 | 100% | 84% |
| **31 physical decline starts** | **31** | 47 | 28 | 25 | 21 | 100% | 90% |
| 34 | 34 | 51 | 31 | 28 | 23 | 93% | 94% |
| 37 | 37 | 56 | 34 | 30 | 25 | 79% | 97% |
| 40 | 40 | 60 | 36 | 32 | 26 | 61% | 100% |
| 41 retirement forced | 41 | 62 | 37 | 33 | 27 | — | — |
| **60 mental decline starts** | **60** | **90** | **54** | **48** | **39** | — | 100% |
| 65 | 65 | 98 | 59 | 52 | 43 | — | 97% |

- "—" in a race column means the age is below that race's debut range (or the career is over).
- The × columns show the share of a stat's cap, after maturity and wear, at the start of the season at that human-age. They are for a human full-time starter with steady pace, whose development clock keeps pace with human-age, and a cap of 16 points. They come from the engine (`developSeason`, one season per year), not from hand arithmetic.
- Race multipliers bend these curves slightly:
  - Dwarves lose physical ability 15% slower (Bedrock: 70% at human-age 40 instead of 61%).
  - Orcs grow physically ×1.05 and mentally ×0.9.
  - Elves grow mentally ×1.1.
  - Ashkin grow mentally ×0.85.
- Mental stats keep rising to human-age 40. Mental decline starts at human-age 60, which is after every forced retirement. This holds with the D-B scaling (`decline.mentalDeclineScalesWithLifespan`).
- Injury chance by race is ×1.25 for elves, ×0.80 for dwarves and ×0.85 for orcs and Ashkin. The seeded 20-season run measured 1.28, 0.76, 0.79 and 0.85 injuries per 40 rounds, against 0.99 for humans.

## Files

| File | Contents |
| --- | --- |
| `index.ts` | the public contract (thin wrappers) and additive exports |
| `fixed.ts` | one-rounding fixed-point helpers, step tables, deterministic `lnDet`/`expDet`/`powDet` (no `Math.pow`) |
| `tables.ts` | per-ContentDB integer tables: maturity curves, decline tables, the retirement hazard table 1 − (1 − h)^k per race, class weights and recentred cap offsets |
| `stats.ts` | human-age, maturity, developed/base/effective stats, rating (combat formula), potential |
| `effects.ts` | management-applied trait, racial-feature and status effects |
| `generation.ts`, `names.ts`, `traits.ts`, `acquired.ts` | generation, names, the CK-style roll, storied gain/loss |
| `match.ts`, `injury.ts` | XP per round started, injury ladder, scars, career-ending, Still tender, event traits |
| `development.ts`, `season.ts`, `retirement.ts` | season-end development and wear, mentoring, trait checks, retirements, recovery, rookies, final seasons, trend |
| `captaincy.ts`, `weekly.ts` | CQ, grades, lineup captain, chemistry, lineup lock (Snubbed, Passed Over, Losing the Room), weekly step |
| `invariants.ts` | lifecycle content checks the shared validator lacks (O11 injury order, debut floor, roll-table share) |
| `levels.ts` | M1.1: initial level, XP per level, mentoring, Freshness reads, the v2 -> v3 migration (contracts phase) |
| `progression.ts`, `offers.ts`, `freshness.ts` | M1.1: round hooks, match-end progression, bench XP, level-up queue and resolution; offer generation and auto-pick; Freshness drain, rest and perk lifecycle effects |
| `population.ts`, `squad-match.ts`, `testing.ts` | test tooling: seeded multi-season population harness, a round-by-round squad match through the hooks, MatchResult builders (not exported from `index.ts`) |

## Decisions (for the architect to merge as `tech-` entries)

1. **Rating = the combat formula** round(5 × Σ w × stat) on the integer effective stats, and potential is the same formula on the caps. The lifecycle drafts give a centipoint form, round(Σ w × eff100 ÷ Σ w ÷ 20). That form is equal only when every eff100 is a multiple of 100. Flooring stats to integers puts potential about 2.5 below P on average.
2. **Streams**:
   - Generation uses `rookies`, `development`, `traits`, `injury` (history scars) and `names`, keyed by (season, fighter id, purpose).
   - Injuries use `injury`, keyed by (season, fixture, round, fighter).
   - Retirement uses `retirement`, keyed by (season, fighter).
   - Trait losses use `traits`, keyed by (season, fighter, trait).
   - The order in which callers process fighters never shifts a draw.
3. **Career-ending injury** is stored as a serious injury with `weeksOut = CAREER_ENDING_WEEKS` (999). It never counts down, and the fighter retires at season end.
4. **Healed serious injuries** keep their record with `weeksOut 0` until the next match the fighter starts, which grants Back from the Brink. Other injuries clear at 0.
5. **Injury countdown** skips the week the injury happened, so a knock in MW5 misses MW6 (inj-001). Week-counted statuses count down on match weeks only.
6. **Per-round damage in the injury roll**:
   - Rounds in which the fighter was downed are exact (`DownRecord`).
   - For other rounds, the remaining match damage is spread evenly.
   - Max HP is recomputed from the fight input with `combat.json derived.maxHp` when no `DownRecord` exists.
7. **Retirement** reads the season's history row: the age during the season and its usage. It sets `status 'retired'` and clears `clubId`, `contract` and `freeAgency` ("contracts end without payout"). It appends to the latest `SeasonRecord`. Rookies count retirements and career-ending injuries from that record, never `left-unsigned`.
8. **Captain vacancy**: in the weekly step, a club captain who left or suffered a career-ending injury is replaced by an interim captain by the AI rule. This writes `club.captainId` (cap-007).
9. **Trend** derives the matchweeks elapsed from the fighter's processed weeks, because `trend(fighter, content)` has no state.
10. `usageBp` in history rows is the development usage min(1, xp ÷ 360).

## Verified (`npm test`, seeds `population-1`, `population-2`)

- No matches (usage at the floor), seasons 3-20, measured against `soakTargets`:
  - median human-age 26.3-27.5;
  - share at human-age ≤ 22: 0.22-0.28;
  - share at human-age ≥ 31: 0.20-0.30;
  - population 623 → 638 (+2.4%);
  - rolled-trait positive share 80.2%.
- With synthetic matches:
  - injuries per 40 rounds (all inside their bands): human 0.99, elf 1.28, dwarf 0.76, orc 0.79, Ashkin 0.85;
  - serious share 6.0%;
  - career-ending injuries 0.40 per season (48 clubs);
  - rolled-trait positive share 79.7%;
  - median retirement age: human 35, elf 54, dwarf 32, orc 29, Ashkin 23;
  - starters' peak ÷ potential, median 0.94;
  - league mean rating 48.9 → 47.8;
  - top-5 rating 59.4 → 55.9;
  - maximum rating 94;
  - AI captain mean CQ 72.8-80.0, and no captains below 40.
- **Outside the band:** the share of grade-A AI captains reaches 48% (target 10-35%). The designer's lever for this is raising the grade thresholds in content.

## Known gaps

- Title-Tested is gained for a won Reckoning final only. The title-clinching league match needs standings from `core/league`.
- The roll-table share and the O11 injury order are checked by `lifecycleContentIssues`, not by `validateContentFiles`.

## Content requests (PROVISIONAL constants in code)

- `PROVISIONAL_JOURNEYMAN_HUMAN_AGE` (26-33).
- `PROVISIONAL_TYPICAL_ROUND` (55% downed, 60% of max HP) and the typical 2.5 rounds per match used for the lineup-screen odds.
- The captaincy durations and thresholds that exist only as text: Snubbed 6, Passed Over 6, Captain Departed 4 and 19, strip at 4 matchweeks, injury exemption at 4 weeks.
- The `loss.requires` rules of Idle Hands, Flinches and Wandering Mind are keyed on trait ids.

## Orchestrator decisions (M1 core fix round, pending owner confirmation)
- **D-Q.** `ratingFromStats` is core/content `combatRating` (the integer formula); fighter ratings, potentials and combat's OVR share it.
- **D-T, retirement by effectiveness.** Per season p = 1 − (1 − hDrop)(1 − hAge): hDrop from `hazardByRatingDrop` at (career-peak rating − current rating); hAge = 1 − (1 − h)^k with h from `hazardPerHumanYearPastPeak` at the human-years past `physicalPeakHumanAge` (30), precomputed per race (`tables.ageHazardBp`). 0 below human-age 31, certain from human-age 58 (race-scaled), then the usual usage, contract, trait and scar modifiers; the heavy-wear add is 0 (the rating drop carries physical decline). Mental stats hold until human-age 60, so mentally weighted fighters keep their rating and play into their 40s and 50s; physically weighted fighters retire in their 30s. Injury and durability rules are unchanged. The population acceptance tests and soakTargets were re-derived. Widened bands (development.json soakTargets), all because mentally weighted veterans now play on: median human-age [26, 30] → [26, 32] and share ≥ 31 [0.2, 0.4] → [0.2, 0.55] (older league); share ≤ 22 lower edge 0.15 → 0.12 (fewer retirements, smaller rookie intake in the first seasons); ashkin injuries per 40 rounds 0.95 → 1.05 and career-ending injuries per league-season 0.6 → 1.0 (more fighters past human-age 36 meet the unchanged injury age multiplier; ashkin age fastest); AI captain mean CQ 85 → 88 (experienced high-leadership captains stay); starter peak over potential 0.95 → 0.97 (starters who play on keep growing toward potential).

## Polish round (QA findings; orchestrator decisions pending owner confirmation)
- **World-generation veterans** get a career line that adds up: `matches = round(roundsStarted × 2 / (bestOf + 2))`, `roundsWon = roundsStarted / 2`, and `debutSeason = 1 − proSeasons` (so they are not flagged as first-season fighters).
- **Titles.** At the season-end development step every fighter on a Reckoning champion's roster gains `career.titles + 1`.
- **Durability and decline (owner rule: orcs and dwarves live shorter but are more durable).** Orc injury `chanceMult` 0.85 → 0.75, `recoveryMult` 0.85 → 0.8, `scarMult` 1 → 0.9 (races.json). Physical decline per human-year softened to 0.2 (31) … 0.7 (41) … 1.0 (47+), so a human at 42 keeps about 55-65% of a 11-13 point physical attribute; the D-T rating-drop hazard was moved down to match (physical classes still retire in their late 30s, mentally weighted ones in their 40s).

## M1.1 (WP-B; progression.md, combat-skills.md eligibility)

**What changed.** Effective stats read `train100` (the clocks are frozen after generation). Growth is in-season level-ups: round XP per round (`xpAfterRound`), bench XP at match end (⅓ of one lineup slot of the club's match XP, own trait XP multipliers, injured 0), level checks at match end only (at most 2 per match), offers of 3 (every 3rd level one skill, every 9th two: one rank step and one perk; 12.5% trait offers), a queue of 3 (the oldest auto-resolves), AI and auto fighters resolve at once. Season-end step 6 is Aging: pending level-ups auto-resolve, wear (Stamina is physical), trait checks, retirement usage = round XP ÷ 360, age +1, xpNeeded recomputed. Freshness drains per round played (`freshnessAfterRound`), recovers with weekly rest (80% for an unused squad reserve), resets at season end; Second Breath, Campaign Legs and Banner Voice apply. Injuries are immediate (`injuriesAfterRound`, Freshness multiplier at the round start). Losing the Room: a squad reserve counts as fielded and a tired captain's rest is exempt. Stamina: +2.5 cap offset and a ±3 jitter at generation (the other stats' draws are unchanged).

**Decisions (tech-, for the architect).**
1. Hook order assumed: freshnessAfterRound → xpAfterRound → injuriesAfterRound. The injury roll reads the round-start Freshness from `ms.roundLineups` (record it before the hooks); without it, the value before this round's drain is rebuilt.
2. Round XP is committed per round (season XP, round XP, the bar, career XP); career and match counters, Still tender, Green Nerves and Title-Tested at match end (`matchEndProgression`). The M1 whole-match path (`applyMatchLifecycle`) also adds round XP to the bar and then runs bench XP and level-ups, so levels work before WP-C switches.
3. `autoPickChoice` takes an optional 5th argument (captain or vice, the fighter's preset); without it the fighter reads as no captain with his class default preset. Option order in an offer: stats first, then skills.
4. `trend` is retired: it returns 'holding' and reads nothing (callers to be dropped by WP-C / WP-D). No reader of the six deferred `development.json` keys is left in core/fighters.
5. Weekly rest reads this week's results (`state.results`, week and season) to know who started a round and who was an unused reserve.
6. A still_tender set during a match counts from the next match (its `since` is the match week).

**Calibration (fixture content, seed population-3, seasons 3-20, starters = 10+ matches).** Levels a season by human-age: 18-20 P ≥ 70 5.2 · 21-23 3.6 · 24-26 P 50-65 2.5 · 27-30 2.2 · 31-34 1.4 · 35+ 0.9 (all inside levels.json bands); mid cohort 4.5 matches per level (lvl-001: 155 XP ÷ 32 = 4.8); starter distribution 0: 7% · 1: 33% · 2: 33% · 3: 18% · 4: 6% · 5+: 3% (mean 1.9). Bench ÷ starter levels within an age band 0.39-0.42. Stamina: 16 starts 10 typical rounds at ≥ 60 (4 matches), 6 starts 5 (2 matches) (frs-004); starter Stamina median 12. Tired / Spent round starts 20% / 7%; swaps 0.5 a match.

**M1.1 integration (WP-C, coordinator decision).** The fixture's orc injury values now equal content/default (chanceMult 0.75, recoveryMult 0.8, scarMult 0.9). The injuries-per-40-rounds band test (`population.test.ts`, seed `population-3`) runs on **content/default**, the shipping content the bands protect, instead of the frozen fixture: on the fixture humans sat at the band edge (1.159 per 40 rounds against 1.15) and elves at 1.661 (band 1.65). Seeds and bands are unchanged. On content/default the run gives human 1.083, elf 1.502, dwarf 0.782, orc 0.759 and ashkin **1.063** (band 0.60-1.05): ashkin is still just over (open, for the lifecycle designer: ashkin injury tuning or the band).

## R2-T002: effective rating at a Freshness (`freshness-rating.ts`)
`ratingAtFreshness(fighter, freshness, content): FreshnessRating` returns `{ freshness, severityBp, rating, effectiveRating, delta, deltaExact, parts }`. The sim does not touch a tired fighter's attributes; it applies combat.json `freshness.penaltyAtFull` (attack speed -8%, move -4.8%, Power -6.4%, Support -6.4%, reaction delay +20%) times `s = clamp((60 - F) / 50, 0, 1) x (1 - fatigueResist)` at round start. The rating is `5 x sum(w x attr)`, so each penalised quantity is converted into the attribute points that would cost the same combat output, and those points are priced at the fighter's own class `ratingWeights`:
- attack speed -> AGI points (`penalty / derived.attackSpeed.perAgi`), move speed -> PAC points (`/ perPac`), Power -> every attribute in the class's `powerAttrs` loses `penalty / perWeightedPoint` points (their weights sum to 1), Support likewise over `supportAttrs`, reaction delay -> AWR points (`penalty x his reaction time / 0.01 s`);
- `loss = 5 x sum(rating weight x points lost)`, `effectiveRating = clamp(round(rating - loss))`, `delta = effectiveRating - rating` (<= 0), `parts` the unrounded loss per quantity.

At Freshness 60 and above everything is 0; at 10 and below it is the full penalty (on the shipped content a Knight loses about 5-6 rating points, casters 6-10, strikers and healers 9-13). The approximation: points are priced at the attribute's whole weight (generous to the penalty), Power and Support ignore the fighter's own multiplier, attributes are not floored at 1, and the reaction penalty is charged to Awareness alone. `fatigueResist` is read from the held perks (Long Wind +40%); the severity curve is checked against the sim's round recap in `game/freshness-rating.test.ts`. Surfaced on `FighterView` (core/game).
