# core/fighters

**Owner:** WP2 (fighters). **Status:** implemented (M1.2). Every function of the phase-B contract in `index.ts` is implemented; additive exports are listed at the bottom of `index.ts`. Rules: 03 §3.2 (sys-races, sys-fighters, sys-youth-intake, sys-development, sys-injury, sys-traits, sys-captaincy, sys-chemistry); numbers: `content/<theme>/{races,traits,names,development}.json`.

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
| `population.ts`, `testing.ts` | test tooling: seeded multi-season population harness, MatchResult builders (not exported from `index.ts`) |

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
