# Arena League M1.1: bench XP, in-season levels, Stamina and Freshness

> ARENA LEAGUE DESIGN PACKAGE · M1.1 "Playtest round 1" DRAFT `_drafts/m1.1/progression.md` · v0.2 · 2026-10-26 · fighter-lifecycle designer.
> **Owner decisions (REQUIRED):** T004: roster fighters who start no round earn XP at ⅓ of a starter's rate, injured fighters 0, unused called-up academy fighters 0 (M5); this replaces D-A. T005: in-season level-ups, about every 5 matches played for a mid-age, mid-potential fighter (~3 a season), 5–6 for young high-potential fighters, 0–1 for veterans near their caps; level-ups replace season-end growth, while aging and decline stay; each level-up offers 1 of 3 options weighted by class and training emphasis, never a capped stat; options can be skills (combat's ability ranks and perks) or occasionally a trait; the AI uses the same offers with an auto-pick; the player can set auto-pick per fighter or club-wide; pacing presets decide whether level-ups stop the game. T003: **Stamina** (`stamina`, 1–20, physical, declines with age) and **Freshness** (0–100), calibrated so a ~16-Stamina fighter plays ~4 consecutive matches before the penalty threshold and a ~6-Stamina fighter ~2, with age mattering. Owner rules of 2026-10-26: Freshness drains **per round played, between rounds, never during combat**; squads of **5 starters + 2 reserves** with **at most 2 swaps per match**; **a fighter swapped out cannot return in that match**.
> Everything else is PROPOSED, and every number is PROPOSED · TUNABLE. Labels follow document 01: REQUIRED, PROPOSED, TUNABLE, EXAMPLE, OPEN, FUTURE.
> Merges into 03 §3.2 (sys-development, sys-injury, sys-captaincy, sys-chemistry), adds **sys-freshness**, and amends 03 §5, §8.3 and §9.2. Interface partner: combat's [combat-skills.md](combat-skills.md) v0.2, which owns match squads, swaps, match flow, the Freshness penalty curve and the skill catalog.
> Proposed content (not in `content/default`; the architect integrates it): [levels.json](content/levels.json) (new file), [development.patch.json](content/development.patch.json), [traits.patch.json](content/traits.patch.json), [races.json](content/races.json) (full replacement: `stamina` added). The patches are RFC 6902 operations, checked to apply cleanly to the current `content/default` files.

| Field | Value |
| --- | --- |
| Milestone | M1.1 "Playtest round 1", on M1 (tag `m1-season-mvp`, docs v0.4) |
| Status | Draft v0.2 for owner review. Numbers come from a simplified scratch model (§7), not the real sim |
| Systems | sys-development (XP, bench XP, levels, offers, auto-pick, season end), **sys-freshness (new)**, sys-fighters (Stamina generation), sys-injury (immediate injuries, Freshness multiplier), sys-captaincy and sys-chemistry (consequences), sys-save (migration v2 → v3) |
| Changes in v0.2 | Freshness drains per round played, not per match; squad reserves and swaps; XP, injury and Freshness rules for swapped-out fighters, entering reserves and emergency entrants; AI inputs to combat's auto-swap; worked examples redone |

## 0. Summary

- **XP.** Round XP is unchanged: about 12.8 per round started, about 32 per match for a starter. A fit roster fighter who starts no round earns **⅓ of one lineup slot's match XP** (about 10–13 a match). This includes squad reserves who never enter. Injured fighters earn 0. A fighter swapped out keeps the XP of every round he started.
- **Levels.** Each fighter has a stored level. **XP per level = (115 + 0.6 × level) × age factor × gap factor × lifespan ÷ 80, divided by pace, race growth, trait and mentor multipliers**, clamped to 60–2,500 and rounded to 5.
  - Calibration: a human-age 25, mid-potential starter needs about 155 XP, i.e. a level every **~4.8 matches** (2.7–2.9 a season).
  - A 19-year-old prospect needs about 75 (**~6 a season**). A veteran near his caps needs about 500 (**~1 a season**). A bench fighter levels about ⅓ as often.
- **Offers.**
  - Each level-up offers **3 options**, generated once and stored. Stat options give **+1 point** to a stat with room, drawn by class rating weight × training emphasis.
  - **Every 3rd level** one option is a skill (an ability rank or a perk, from combat's catalog). **Every 9th level** two are.
  - With **12.5%** chance there is also an optional trait offer: two traits or "neither", never a flaw.
  - Up to 3 level-ups can wait in a queue; past that, the oldest auto-resolves. AI clubs and auto-pick fighters choose by a published score.
- **Stamina.**
  - A 13th stat (physical), generated like the others plus a +2.5-point offset and a wider ±3 jitter. Race tendencies: dwarf +2, orc +1.6, elf −1.6, Ashkin −1.2.
  - It declines on the physical wear table and grows only through level-up picks. Starters have a median of 11–12.
- **Freshness.**
  - **Drain per round played** = (11.88 − 0.48 × Stamina, clamped 2–12) × round intensity (0.6–1.5, from duration, damage taken and being downed), ×1.1 under human-age 21.
  - It changes only after a round ends; combat reads it at the next round start.
  - **Recovery** comes only in weeks without a round started: 30 + Stamina, ×0.85 from human-age 31 and ×0.7 from 35. A squad reserve who never enters gets 80% of that.
  - The threshold is **60**; the meter resets to 100 at season end.
  - At Stamina 16 a fighter starts 10 straight rounds (**4 matches**) at 60 or more; at Stamina 6, 5 rounds (**2 matches**).
  - Below 60, injury chance rises by up to ×1.4.
- **Migration.** Existing saves keep every stat value. Stamina is rolled deterministically from the seed and fighter id. Levels are derived, this season's XP is carried into the bar, Freshness is set to 100, and there are no pending level-ups.

## 1. What changes from M1

| Area | M1 (docs v0.4) | M1.1 (this draft) |
| --- | --- | --- |
| Unused roster fighter | 0 XP and 0 development (D-A) | ⅓ of a lineup slot's match XP (T004); still 0 if injured |
| Growth | Season-end development clocks (`dev100`) × usage | In-season level-ups (+1 stat point, a skill or a trait); clocks frozen after generation |
| Training emphasis | Moves growth between the physical and mental clocks | Weights which stats appear in offers |
| Trend (Surging … Fading) | Projected season-end rating change | Removed; replaced by level, XP bar and "next level in ≈ N matches" |
| Stats | 12 | 13 (`stamina`, physical) |
| Tiredness | None | Freshness, drained per round played, recovered by rest |
| Injuries | Take effect when the match ends | Take effect immediately; the fighter misses later rounds |
| Match | 5 fighters, no substitutions | 5 + 2 reserves, ≤ 2 swaps between rounds, no return (combat) |
| Usage (retirement modifiers) | min(1, season XP ÷ 360) | min(1, season **round** XP ÷ 360); bench XP does not count |

Unchanged: round XP amounts, aging, wear, retirement (D-T), injury ladder and severities, traits and their roll, captaincy grades, intake and generation of the other 12 stats.

## 2. System inventory (this draft)

| ID | Change | Owner |
| --- | --- | --- |
| sys-development | Rewritten: XP, bench XP, levels, offers, auto-pick, pacing, season end | lifecycle |
| sys-freshness | **New id** (register in 01 inventory): meter, drain, recovery, labels, injury multiplier, AI rotation | lifecycle (penalty curve: combat) |
| sys-fighters | Stamina generation; `train100` replaces derived development | lifecycle |
| sys-injury | Immediate effect; Freshness multiplier | lifecycle |
| sys-captaincy, sys-chemistry | Losing the Room rest exemption; chemistry fixed at lock | lifecycle |
| sys-match | Squads, swaps, between-round step | **combat** (referenced, not specified here) |
| sys-save | State schema v2 → v3 | architect, per §6 |

## 3. System specifications

### sys-development: XP and bench XP

**Status:** bench rate ⅓ and 0 for injured fighters are REQUIRED (T004). The mechanics are PROPOSED · TUNABLE (`levels.json` benchXp; `development.json` xp).

**Purpose:** playing still matters most, but a fighter who sits out keeps growing slowly, so a deep roster is not a trap.

**Round XP** (unchanged amounts; committed per round via the orchestrator hook `xpAfterRound`, saved with the match result): 10 for starting the round, +3 if his side won it, +1 per down credited (max +2), +1 if not downed; ×1.25 in the Reckoning; then trait XP multipliers; floored once. Typical: 12.8 per round, ~32 per match (~2.5 rounds), 146 for a 2–0 sweep's five starters and about 196 for a 2–1 win.

**Who earns what in a match:**

| Fighter | XP |
| --- | --- |
| Starter who plays every round | Round XP for each round |
| Starter **swapped out** after round n (cannot return, owner ruling) | Round XP for rounds 1–n only; no bench top-up |
| Reserve who **enters** for round n + 1 | Round XP from round n + 1; no bench top-up |
| **Emergency entrant** (combat: enters for an injured fighter when no reserve is left) | Round XP for the rounds he starts |
| Starter **injured** in round n | Round XP for rounds 1–n (he misses the rest) |
| Squad reserve who **never enters** | Bench XP |
| Fit roster fighter **outside the squad** | Bench XP |
| Injured at lineup lock, or career-ended | 0 |
| Free agent, retired; M5 called-up academy fighter not used (O3) | 0 |
| Hired blade (open-006) | Round XP like anyone; any level-up auto-resolves; he leaves after the match |

**Bench XP** (per match the club plays): clubMatchXp = the sum of the round XP of every club fighter who started a round in the match (after the Reckoning multiplier, before personal trait multipliers). Bench XP = **floor(clubMatchXp × ⅓ × own trait XP multipliers ÷ 5)**, one floor at the end, ⅓ as 3,333 bp. Dividing by 5 gives one lineup slot's XP, so a bench fighter earns ⅓ of what an average starter earned in that match. A 2–1 win (clubMatchXp 196) gives 13; a 2–0 sweep (146) gives 9; Glory-Hungry turns 13 into 15.

**Why per lineup slot, not "⅓ of my own would-be XP":** it needs no counterfactual, so it is deterministic and visible. Winning matches raise everyone's XP, and a long match earns the bench a little more.

**Edge cases:** a club with no match that week (none in M1) gives no bench XP. A fighter who changes clubs keeps his bar and level. XP earned while a level-up is pending still fills the bar.

### sys-development: levels and XP per level

**Status:** level-ups replacing season-end growth and the target cadence are REQUIRED (T005). The curve is PROPOSED · TUNABLE (`levels.json` level, xpPerLevel).

**Entities and state** (per fighter): `level` (integer), `xpIntoLevel`, `xpNeeded` (frozen when the level starts), `train100[13 stats]` (trained values in centipoints, replacing the M1 derived value), `pendingLevelUps[]`, `levelUpMode`. Generation still computes `cap100`, `bloom`, D_physical and D_mental exactly as in M1. It sets `train100_i = cap100_i × M_g(D_g + bloom_i)` once; the clocks never advance again. Effective stat = clamp(floor((max(100, train100 − wear100) + trait and status adds × 100) ÷ 100), 1, 20), as in M1, with `train100` in place of the developed value.

**Initial level** (generation and migration): level = 1 + round(Σ over 13 stats of max(0, train100_i − 0.5 × cap100_i) ÷ 100). That is 1 plus the points developed above half of each cap, so each later +1 pick adds +1 level. A debuting 18-year-old is typically level 10–25, a peak veteran 60–90. Level never decreases: wear and scars do not change it.

**XP per level:**

xpNeeded = clamp(round5( B × A × G × lifeScale ÷ (pace × raceGrowth × traitDev × mentor) ), 60, 2,500)

| Term | Definition | Values |
| --- | --- | --- |
| B (level) | 115 + 0.6 × level | L1 115.6 · L20 127 · L40 139 · L60 151 · L90 169 |
| A (age) | wPhys × agePhys(human-age) + (1 − wPhys) × ageMental(human-age); wPhys = the class's rating-weight share on physical stats (Stamina included). Step tables | agePhys: <20 0.72 · 20 0.80 · 22 0.95 · 24 1.25 · 28 1.45 · 31 1.90 · 34 2.60 · 37+ 3.60. ageMental: <22 0.85 · 22 1.10 · 30 1.20 · 36 1.45 · 42 1.90 · 48+ 2.60 |
| G (gap) | devGap = potential − trainedRating, where trainedRating is the rating of `train100` with **no wear** (so decline never speeds leveling) | <1 4.0 · 1 2.6 · 2 1.8 · 4 1.3 · 6 1.0 · 15 0.9 · 22 0.82 · 30+ 0.72 |
| lifeScale | lifespan ÷ 80 (the one clock, D-B) | human 1.0 · elf 1.5 · dwarf 0.9 · orc 0.8 · Ashkin 0.65 |
| pace | hidden pace | slow 0.75 · measured 0.9 · steady 1.0 · brisk 1.15 · rapid 1.3 |
| raceGrowth | wPhys × growthMult.physical + (1 − wPhys) × growthMult.mental | e.g. elf tank 1.03 |
| traitDev | the same blend of active devClock traits | Quick Study 1.2 mental; Early Spark 1.25 under 22 |
| mentor | for human-age ≤ 23: captain grade × trait mentors, cap 1.15 (as M1) | A-grade captain 1.08 |

xpNeeded is computed when a level starts and again at season end, after age +1. XP above the requirement carries over. Level-ups are checked **only at match end**, after the result is committed, and there are at most **2 per match**. Extra XP waits in the bar and triggers at the next match end.

**Why these shapes.**
- The age factor makes the young level fast and veterans slowly. The physical side climbs from 24 because bodies peak at 28; the mental side stays flat into the 30s, so a healer keeps leveling longer than a tank.
- The gap factor slows fighters near their potential.
- lifeScale keeps O11's one clock: an elf's career phases last 1.5× as many seasons, so he levels 1.5× less often at the same human-age.
- B grows only slowly with level; age and gap do the real work.

**Worked examples** (starter ≈ 32 XP a match, bench ≈ 10.7):

| Fighter | Inputs | xpNeeded | Matches per level | Per season (~14 matches) |
| --- | --- | --- | --- | --- |
| Oathguard (tank, wPhys 0.71), human 25, Steady, level 20, potential 62 vs trained 54 | B 127; A = 0.71 × 1.25 + 0.29 × 1.10 = 1.2065; G 1.0 | 153.2 → **155** | 4.8 (bench 14.5) | ~2.9 (bench ~1) |
| Emberwright (ranged, wPhys 0.48), human 19, Brisk, level 8, gap 20 | B 119.8; A = 0.48 × 0.72 + 0.52 × 0.85 = 0.7876; G 0.9; ÷ 1.15 | 73.8 → **75** | 2.3 | ~6 |
| Chirurgeon (healer, wPhys 0.31), human 33, Steady, level 34, gap 1.5 | B 135.4; A = 0.31 × 1.90 + 0.69 × 1.20 = 1.417; G 2.6 | 498.8 → **500** | 15.6 | ~1 |
| Netcaster (wPhys 0.64), **elf aged 30** (human-age 20.0), Steady, level 9, gap 18 | B 120.4; A 0.818; G 0.9; lifeScale 1.5; raceGrowth 0.64 + 0.36 × 1.1 = 1.036 | 128.3 → **130** | 4.1 | ~3.4 |
| The same Oathguard as an elf aged 37.5 (human-age 25) | lifeScale 1.5, raceGrowth 1.029 | 223.4 → **225** | 7.0 | ~2 |
| The same Oathguard as an Ashkin (human-age 25) | lifeScale 0.65, raceGrowth 0.9565 | 104.1 → **105** | 3.3 | ~4.2 |

Levers on the Oathguard (155): Slow pace 205, Rapid 120; gap 3 → 275, gap 0 → 615; human-age 21 → 105, 29 → 170, 32 → 215, 35 → 280; level 60 → 180.

**Calibration (scratch model, 48 clubs, 3 seeds × 20 seasons, auto-pick, skill slots taken half the time):**

| Starter cohort | Levels a season (mean; p10/p50/p90) | Matches per level (median) | Owner target |
| --- | --- | --- | --- |
| Human-age 18–20, potential ≥ 70 | 4.8–5.3; 3–4 / 5–6 / 6–7 | 2.3–2.6 | 5–6 |
| 21–23 | 3.7–3.8 | 3.5 | — |
| 24–26, potential 50–65 | 2.6–2.7; 2 / 3 / 4 | 4.3–4.7 | ~3 a season, ~5 matches |
| 27–30 | 2.3–2.4 | 6 | — |
| 31–34 | 1.5 | 12 | — |
| 35+ | 0.8–0.9; 0 / 1 / 1–2 | 13 | 0–1 |
| Bench, 18–23 / 24–30 | 1.5 / 1.0 | — | ~⅓ of a starter's |

Young prospects sit slightly under the 5–6 target on the mean (the median is 5–6). The lever is ageFactorPhysical below 20 (0.72 → 0.65 gives +0.4 a season).

### sys-development: level-up offers

**Status:** 1 of 3 options; class × emphasis weighting; no capped stat; skills and occasional traits are REQUIRED (T005). Cadence and pools are PROPOSED · TUNABLE (`levels.json` offers, traitOfferPool). Skill eligibility, the kind and item draw, and effects are **combat's** (`perks.json` rules.offerDraw, `ability-ranks.json`).

**Generation** (at match end, for each level gained; stream `development`, keyed by season, week, fighter id and level; generated once and stored, so a reload never rerolls, P-05):
1. **Slots.** Normally 3 stat slots. If level % 3 = 0, one slot is a skill. If level % 9 = 0, two slots are skills, drawn without replacement: one rank step and one perk when both kinds have eligible items.
2. **Stat options** are drawn without replacement among stats with room (train100 < cap100). Weight = max(0.03, classRatingWeight_i) × emphasis_i. Stamina's floor is 0.08 because its rating weight is only 2%. Body emphasis: physical × (1 + a), mental ÷ (1 + a); Mind: the reverse; Balanced ×1. Here a = 1 × trait emphasis strength (Adaptable or Regimented 1.5, Set in Their Ways 0). A stat pick adds min(100, room) centipoints: +1 point, or the rest up to the cap.
3. **Skill options:** combat's draw. Kind first (rank or perk, 1 : 1 while both are eligible), then the item (ranks uniform; perks by tier, I 1.0, II 0.8, III 0.6). Combat's eligibility applies: perk cap 4 with at most 1 tier III, exclusive pairs, minimum stats, ranks 1 → 3, never a basic attack.
4. **Fallbacks:** if no skill is eligible, the slot becomes a stat option; if no stat has room, the slot becomes a skill. If nothing at all is available, the level is empty but still counts.
5. **Trait offer** (stream `traits`, same key): with chance 12.5%, if the fighter holds fewer than 4 rolled + learned traits, he also gets an optional choice of **2 traits or "neither"**, separate from the main pick.
   - Option 1 is always a boon or edge. Option 2 is positive 75% of the time, else a burden. Never a flaw, physique, storied or scar trait.
   - Pool: 21 positive and 8 burden traits (`levels.json` traitOfferPool), weighted by rollWeight × raceWeight × fit. Fit is ×2 when the trait suits the class archetype, or the captain or vice for leadership traits.
   - The usual eligibility applies (not held, opposites and excludes both ways, exclusive group, category cap 2). A chosen trait has source `level`.

**Cadence for a typical starter** (2.7 levels a season): about 0.9 skill slots and 0.34 trait offers a season. Young prospects get about 1.6 skill slots a season. Over a 15-season human career a starter sees about 13 skill slots and 4–5 trait offers.

**Queue:** level-ups wait in `pendingLevelUps` (oldest first, max 3). A 4th auto-resolves the oldest by the fighter's auto-pick policy, and the digest says so. All pending level-ups auto-resolve at the start of the season-end step. They never block Continue or a lineup lock. Picks cannot be made while a match is in progress, including the between-round screen. An option that became illegal (its stat reached the cap through an earlier pick, or the skill became ineligible) is shown greyed out; if none is legal, the level resolves empty.

**Player information:**
- **Level-up dialog:** the three options. Stat options show the stat, the new value and the rating change (+0 or +1). Skill options show combat's text, and trait offers show both traits with their kinds. There is also "Auto-pick" (which option the policy would take) and "Later" (queue).
- **Fighter card:** level, XP bar (xpIntoLevel / xpNeeded), levels this season, and **"next level in ≈ N matches"**, with N = ceil(remaining ÷ his mean match XP this season; 32 as a starter or 11 on the bench before his first match). This replaces the M1 trend.

**Edge cases:** a scar that lowers a cap below train100 clips train100 to the cap and leaves the level unchanged. Picks raise train100, never lower wear. A fighter at all caps with no eligible skill gets empty levels, but his xpNeeded is near the 2,500 maximum anyway.

### sys-development: auto-pick and pacing

**Status:** AI auto-pick, player auto-pick per fighter or club-wide, and pacing presets are REQUIRED (T005). The policy is PROPOSED · TUNABLE (`levels.json` autoPick, pacing).

**Score per option** (take the highest; ties: stat before skill, then lower option index):
- stat = 5 × ratingWeight_i × (gain ÷ 100) × emphasisPreference (emphasised group 1.15, other group 0.9, Balanced 1.0), plus, for Stamina only, a bonus by current effective Stamina: < 10 0.70 · 10–12 0.45 · 13–15 0.20 · 16+ 0.
- skill = combat's value (perks: autoPickValue × tag × style × context, clamped 0.5–3.0; ranks: 1.0 × 1.25 family × 0.9 passive × 1.2 if used; combat-skills.md §5) × skillPreference.
- trait offer: take the option with the higher rollWeight × fit if it is a boon or edge; never a burden; else neither.

Example: an Oathguard (Balanced, Stamina 9) offered STR, AWR and Stamina scores STR 5 × 0.18 = 0.90, AWR 0.20 and Stamina 5 × 0.02 + 0.70 = 0.80, so he takes STR. At Stamina 8 with STR capped, he takes Stamina over AWR.

**Modes** (`levelUpMode` per fighter, defaulting to the club's `levelUpDefault`): `manual` ("Ask me"), `auto` (skillPreference 1.0), `auto_stats` (0.6), `auto_skills` (1.5). AI clubs always use `auto`. The player club default is `manual`.

**Pacing** (club setting `levelUpPacing`): `detailed` opens the dialog after the match report for every manual fighter who levelled. `balanced` opens it only for manual fighters who started a round; the others show a "Level-ups (n)" badge. `fast` never opens it: badges only, and the queue auto-resolves when full. The **M1.1 default is `detailed`**, so the owner sees every level-up (as combat's `pauseBetweenRounds: always`); recommend `balanced` after the playtest.

### sys-development: season end (step 6) and aging

**Status:** level-ups replace season-end growth, and aging and decline remain (REQUIRED, T005). Order PROPOSED.

Season-end step 6 becomes **Aging** (with the age held during the season):
1. Auto-resolve every pending level-up.
2. Wear: as M1 (physical table from human-age 31; Stamina is physical). No development step.
3. Trait gain and loss checks, captaincy recompute, retirement chance (D-T unchanged). **Usage** for its modifiers = min(1, season round XP ÷ 360), so bench XP does not count.
4. Age +1; recompute xpNeeded (xpIntoLevel kept; if it now meets xpNeeded, the level-up triggers at the next match end); update peakRating (also updated at every pick).

Step 9 (off-season recovery) adds **Freshness = 100**. The season development report becomes a **season progression report**: rating before and after, levels gained, each pick (stat, skill or trait), wear added, round XP and bench XP, Tired and Spent round-starts, and potential reached.

### sys-fighters amendment: Stamina

**Status:** the stat, its range and its decline with age are REQUIRED (T003). Generation values are PROPOSED · TUNABLE (`levels.json` stamina, `races.json` statTendencies.stamina, combat's `classes.json` statEmphasis.stamina).

**Generation** (like every stat, `development.json` potential.capFromPotential):
- cap = P ÷ 5 + classOffset + race tendency + **2.5** + jitter **±3.0**, instead of ±0.8, clamped 2–20.
- Class offset from statEmphasis.stamina (tank and melee 1.2, ranged 1.0, controller and healer 0.9), recentred as for all stats.
- Race tendency: human 0, elf −1.6, dwarf +2.0, orc +1.6, Ashkin −1.2 (within the ±4 cap). Longer-lived races tire faster, matching their higher injury proneness, and the durable races are the tireless ones.
- The +2.5 offset exists because Stamina's 2% rating weight would otherwise leave it as an afterthought. The wide jitter makes Stamina a real trait of the fighter, not a copy of his potential.
- Current value = cap × M_phys(D_phys + bloom), so youngsters start at 55–70% of their Stamina cap.

Example (EXAMPLE): a human Oathguard with P 60 and jitter 0 has cap 12 − 0.23 + 2.5 = 14.27. At human-age 18 that gives Stamina 8; at 26 (M 0.94), 13. A dwarf has 16.27 and an elf 12.67.

**Aging:** the physical wear table applies. Cumulative human wear is 0.7 points at 34, 1.4 at 36, 2.3 at 38 and 3.4 at 40. Recovery also falls with age (sys-freshness), so a 36-year-old who had Stamina 16 at 26 reaches the threshold after about 3 matches instead of 4, and rests back about ⅓ slower. Picks can still raise Stamina (auto-pick favours it below 13).

**No captaincy role and no direct injury role.** CQ is unchanged, and durability stays `tgh`. Stamina acts only through Freshness, and Freshness raises injury chance (sys-injury). Combat gives it no fight formula and a 2% rating weight (cmb11-q4). **Bellows Chest** ("never seems to tire") gains +2 Stamina (`traits.patch.json`).

**Distribution (model):** starters' Stamina p10 / p50 / p90 = 8–9 / 11–12 / 14; whole population 7 / 11 / 13.

### sys-freshness (new): the Freshness meter

**Status:** the meter, drain per round played (between rounds), recovery when sitting out, more in the off-season, and the calibration are REQUIRED (T003, owner rules of 2026-10-26). Lifecycle owns drain, recovery, threshold, labels and the injury multiplier. Combat owns the in-round penalty, read at each round start (combat-skills.md sys-fight-freshness). All values are PROPOSED · TUNABLE (`levels.json` freshness).

**Purpose:** give every week a squad decision ("we need more actions each week", T003): who plays, who rests, who sits on the bench as a reserve. A star's availability becomes something the manager spends.

**Entities and state:** `freshness10` per fighter (0–1,000, tenths; 1,000 = fully rested). The sim and UI receive floor(value ÷ 10). It is persisted across weeks, and inside MatchState while a match is in progress.

**Drain per round played** (hook `freshnessAfterRound`, after each round, for every fighter who started it):
- base(STA) = clamp(11.88 − 0.48 × STA, 2, 12): STA 1 11.4 · 6 9.0 · 10 7.1 · 12 6.1 · 16 4.2 · 20 2.3
- intensity = clamp(0.55 + 0.25 × min(2, duration ÷ 30 s) + 0.20 × min(2, damageTaken ÷ maxHp) + 0.12 × [downed], 0.6, 1.5). A typical round (30 s, 60% of max HP taken, downed 55% of the time) gives 0.99. A 2–0 sweep therefore costs less than a 3-round match, and a brutal round costs more.
- drain = round(base × intensity × 1.1 if human-age < 21 × perk freshnessDrainMult (Campaign Legs 0.85)) in tenths. STA is the effective Stamina at that moment.

**Between rounds** (combat's `applyBetweenRound` calls `freshnessBetweenRounds`): every squad member who is active or an unused reserve (not withdrawn, not injured) gains his `freshnessBetweenRounds` total: perk Second Breath +8, otherwise 0. This comes after the drain and before the next round, clamped to 100. Nothing else recovers inside a match.

**Withdrawn fighters** (owner ruling): a fighter swapped out cannot return, and his Freshness reflects only the rounds he played. There is no drain and no between-round gain after he leaves.

**Weekly recovery** (at each week processing of a matchweek or Reckoning week, for every fighter who **started no round that week**, free agents included): rest = (30 + STA) × ageMult (human-age < 31 1.0; 31–34 0.85; 35+ 0.70). A **squad reserve who never entered** gets 80% of it: he travelled and warmed up but did not fight. An injured fighter rests normally. A fighter who started a round that week gets nothing that week, even if he was withdrawn after round 1.
- Preseason weeks: +50 × ageMult. In M1.1 this changes nothing, since everyone starts the season at 100; it is a hook for FUTURE preseason friendlies.
- **Season-end step 9: reset to 100** (the off-season).

**Calibration (consecutive matches, typical rounds, no rest, human 21–30):**

| Stamina | Drain per round | Rounds started at ≥ 60 | ≈ Matches (2.5 rounds) | Rest a week |
| --- | --- | --- | --- | --- |
| 20 | 2.3 | 18 | 7 | +50 |
| 16 | 4.2 | 10 | **4** | +46 |
| 12 | 6.1 | 7 | 2.8 | +42 |
| 10 | 7.1 | 6 | 2.4 | +40 |
| 6 | 9.0 | 5 | **2** | +36 |
| 1 | 11.4 | 4 | 1.6 | +31 |

**Threshold and labels:** threshold **60** (equals combat's `thresholdBelow`). Labels: **Fresh** ≥ 80, **Ready** 60–79, **Tired** 40–59, **Spent** < 40. Combat's penalty at a round start is s = clamp((60 − F) ÷ 50, 0, 1), full at F 10.

**Injury multiplier:** in a round whose start Freshness F < 60, injury chance × min(1.4, 1 + 0.006 × (60 − F)). That is ×1.06 at 50, ×1.12 at 40 and ×1.36 at 0. It is folded into the lineup screen's per-round injury estimate.

**Player information:**
- Lineup and squad screens show each fighter's bar, value and label, and a forecast: "after a typical match ≈ F − 2.5 × his typical drain", plus **"Ready for ≈ N more rounds"**, N = number of typical rounds before he would start one below 60.
- The fighter card shows "Drains 4.2 a round · recovers +46 a week of rest".
- The between-round screen (combat) shows the value now and this round's change.
- The weekly digest lists "Rested: +46 (Stamina 16)".
- Injury estimates include the multiplier, with "× 1.06 (Tired)".

**Cancellation:** Freshness is committed per round with the round (P-05). Quitting on the between-round screen resumes with the same values.

**Edge cases:**
- A missing value reads as 100 (combat's default); values are clamped 0–100.
- A hired blade starts at 100 and leaves after the match.
- A transferred fighter keeps his value.
- An emergency entrant uses his own value and drains normally.
- A fighter with Second Breath who is withdrawn does not gain the +8.
- Freshness never changes during a round.

**Interactions:** combat (penalty per round start; swaps), sys-injury (multiplier), sys-ai-manager (rotation, below), sys-captaincy (Losing the Room exemption), perks (Campaign Legs, Second Breath).

**Worked example A: human aged 26, Stamina 16** (base 4.2), starting the week at 100.

| When | Round facts | Intensity | Drain | Freshness after |
| --- | --- | --- | --- | --- |
| Week 1, R1 (won) | 30 s, 60% taken, not downed | 0.920 | 3.9 | 96.1 |
| Week 1, R2 (lost) | 45 s, 110% taken, downed | 1.265 | 5.3 | 90.8 |
| Week 1, R3 (won) | 22 s, 30% taken | 0.793 | 3.3 | **87.5** |
| Week 2 (2 typical rounds) | starts R1 87.5, R2 83.3 | 1.0 | 4.2 each | 79.1 |
| Week 3 (3 typical rounds) | starts 79.1, 74.9, 70.7 | 1.0 | 4.2 each | 66.5 |
| Week 4 (2 typical rounds) | starts 66.5, **62.3** | 1.0 | 4.2 each | 58.1 |
| Week 5 | would start R1 at **58.1: Tired** (combat s 0.038, injury ×1.011) | | | |

He plays four straight matches untired, as the owner asked. At the week 5 lock, an AI club rests him, because 58.1 < 60 + 4.2 (aiRotation below). A week of rest gives +46 and caps him at 100. Had he played, round 2 would start at 53.9 (s 0.122).

**Worked example B: human aged 34, Stamina 6** (base 9.0, recovery ×0.85), locked into the player's lineup at **64.0**.
- Round 1 (lost; 38 s, 110% taken, downed): intensity 1.207, drain 10.9 → **53.1**.
- The between-round screen shows "Ready → Tired (53)". The auto-swap (threshold 40) does not suggest a swap, so the player swaps him out manually for a fresh reserve. An AI club would do the same automatically if its threshold reached 53.1: youth_focused 50 + lost-round bonus 10 = 60.
- He is withdrawn and **cannot return**.
- XP: round 1 only: 10 (lost, downed, no down credit). No bench XP.
- Freshness: stays **53.1** for the rest of the match. He started a round this week, so there is no weekly rest at this processing.
- Next week:
  - left out of the squad: +30.6 → **83.7**;
  - named a reserve and never entering: +24.5 → **77.6**;
  - started again: Tired from round 1 (s 0.138, injury ×1.041).

**Worked example C: elf aged 30 (human-age 20.0), Stamina 10.** Base 7.08 × 1.1 (under 21) = 7.8 a round. Round starts go 100, 92.2, 84.4, 76.6, 68.8, 61.0, then **53.2**: six untired rounds, about 2.5 matches. Rest +40 a week. (A literal 20-year-old elf cannot exist: elves debut at 28–33, so age 20 is human-age 13.3. This example uses the elf of human-age 20.)

### sys-injury amendment: immediate injuries

**Status:** PROPOSED (combat's orchestrator default (b), cmb11-q8). `development.patch.json` injury.

1. Rolls are unchanged in form and stream: after each round, for each fighter who started it, keyed by fixture, round and fighter. The chance gains the Freshness multiplier, read at **that round's start**.
2. **The injury takes effect immediately.** The fighter plays no later round of that match. Combat's between-round step replaces him with an unused reserve, which uses a swap, or else an emergency entrant, who uses none; a match is never 4 v 5. weeksOut starts with the week after the match. Knock: misses the next match.
3. **Keep the cap of one new injury per fighter per match.** It now holds naturally, because an injured fighter plays no more rounds. Keeping it in the rules protects any future rule that lets an injured fighter stay on.
4. Still tender counts "matches in which he starts a round". The career-ending check still uses At risk at lineup lock. An emergency entrant who is At risk is checked as at the lock.

M1 edge case "a fighter downed in round 1 plays rounds 2 and 3": downed is not injured, so this still holds. "If two rounds roll injuries, only the first counts" is now automatic.

### sys-captaincy and sys-chemistry: consequences

**Status:** PROPOSED (`development.patch.json`).
- **Losing the Room:** "fielded" means started a round **or was named a squad reserve**. A match in which the fit club captain is left out of the squad while his Freshness at the lock is below 60 is a **rest**: it neither extends nor resets the 4-match count. Resting a tired captain is never punished.
- **Acting captain after a swap or injury:** combat's rule (vice if active, else highest CQ, at CQ − 10; cmb11-q9). Unchanged lifecycle data.
- **Chemistry** is computed at the lock for the **five starters** and kept for the whole match. An entering reserve or emergency entrant gets the same composure modifier (unless chemistryImmune). His own chemistry terms do not count, and swaps never recompute it: one visible number per match.
- **Banner Voice** (+5 CQ) uses the existing `captaincy` effect, recomputed at each lock.
- **Mentoring** now divides the young fighters' xpNeeded (cap 1.15), as before for the clocks.

## 4. Cross-system interactions

| Combination | Resolution | Result |
| --- | --- | --- |
| Drain after round n → round n + 1 | Lifecycle drains in `freshnessAfterRound`; combat reads the new value at round n + 1's build | The between-round screen shows the new label first |
| Second Breath + drain | Drain, then +8 at the between-round step (active or unused reserve) | Net 8 less per round played; withdrawn fighters excluded |
| Campaign Legs + young drain | Multiply: base × intensity × 1.1 × 0.85 | 0.935 for a teenager with the perk |
| Injury in round n + Freshness | Multiplier from round n's start value; out for the rest of the match | Reserve or emergency entrant enters |
| Swap-out + XP | Rounds started kept; no bench XP | Withdrawn fighters never earn both |
| Squad reserve never entering | Bench XP + 80% weekly rest | Being on the bench is cheap but not free |
| Level-up mid-season | Stat pick changes effective stats at once | Visible at the next lock; the rating can rise mid-season |
| Pending level-ups + season end | Auto-resolved before wear and age +1 | No pick is lost |
| Scar lowering a cap | train100 clipped to the cap | Level unchanged; room for picks shrinks |
| Wear + picks | Picks raise train100; wear keeps accruing | A veteran's picks slow but never stop decline |
| Freshness rest + Losing the Room | F < 60 at lock: neither extends nor resets | Rest is never punished |

## 5. Autonomous behavior (AI)

**Status:** PROPOSED. Parity with the player (P-04): the AI sees the same Freshness, offers and swap rules. Squad choice belongs to sys-ai-manager (economy designer). Lifecycle supplies these rules; the procedure belongs to combat.

**Rotation at the lineup lock** (`levels.json` aiRotation, applied after the AI picks its best five by rating and role):
1. **Projected rest:** each starter whose Freshness < 60 + his typical round drain (he would start round 2 Tired) is replaced by the best fit fighter with Freshness ≥ 60 whose rating ≥ the starter's − (6 + 0.25 × max(0, 60 − F)), most tired first, at most 3 a match. In the Reckoning the AI rests only below 40, with a rating gap of 3, because knockout matches matter more.
2. **Spent floor:** a starter below 30 is replaced by any fit fighter with Freshness ≥ 40 even without a rating match.
3. **Reserves:** the 2 best remaining fit fighters with Freshness ≥ 60, one front-line (tank or melee) and one back-line, then by rating.

**Between rounds** (combat's auto-swap; `levels.json` aiSubstitution equals `combat.patch.json` match.autoSwapDefaults):
1. Forced injury replacement.
2. Threshold swaps: Freshness < **freshnessBelow by personality** (balanced 40, thrifty 35, star_chasing 30, youth_focused 50, veteran 40; the player's auto default is 40). The reserve must have Freshness ≥ the starter's + **15** and rating ≥ the starter's − **6**, same role family first.
3. keepOneForInjury: the last swap is not spent on Freshness before the last possible step.
4. **Lifecycle proposal to combat: lost-round bonus +10** to the threshold for the side that lost the round just played. A losing side gambles on fresh legs; a winning side keeps its five. In the model it is the main source of non-injury swaps.

**Auto-pick:** as in sys-development; AI clubs resolve their offers at match end.

**Model results (AI everywhere):**
- Tired round-starts 34.2–34.4%, Spent 10.4–10.7%; about 1.1 rests per club a match.
- Swaps per match (both sides) about 0.48: injury-forced 0.36, Freshness and lost-round 0.12. Emergency entrants: 14–22 per 20 seasons; no fit fighter available at all: 12–22 per 20 seasons (hired blades, open-006).

## 6. Save migration (state schema v2 → v3)

**Status:** PROPOSED for the architect (`src/core/save/migrations.ts` gains `{ from: 2, to: 3 }`). Deterministic, with no reroll of anything that already exists. All randomness comes from `Rng.create(rootSeed, 'migration', 'm1.1', fighterId, purpose)`.

For every fighter in the state (rostered, free agents and retired fighters kept for history):
1. **`train100[i]` = his current M1 developed value** (cap × M(D + bloom)) for the 12 existing stats. Every stat he shows is unchanged.
2. **Stamina:**
   - cap100 = clamp(round(P × 20 + classOffset100(stamina) + 100 × race tendency + 250 + jitter), 200, 2,000), with jitter uniform in ±300 (purpose `stamina`) and bloom an integer −2…2 (purpose `stamina-bloom`).
   - train100 = cap100 × M_phys(D_phys + bloom), using his frozen D_phys.
   - wear100 = his `str` wear100: all physical stats share one wear value.
   - The other 12 caps are not recomputed.
3. **Rating:** combat's reweight (×0.98, plus Stamina at 2%) moves ratings by at most 2 points (mean 0.33). **peakRating += (new rating − old rating)**, so the mechanical change never triggers the D-T retirement hazard.
4. **Level** from the initial-level formula. **xpIntoLevel = min(season round XP so far, xpNeeded − 1)**, so this season's XP is not lost and no level-up pops on load. **pendingLevelUps = []**.
5. **freshness10 = 1,000.**
6. `levelUpMode` = inherit. Club `levelUpDefault`: the player's club `manual`, AI clubs `auto`. `levelUpPacing` = `detailed`. Combat's club fields: autoSwap `threshold`, pauseBetweenRounds `always`.
7. `dev100` is kept read-only (legacy; never advanced). Season counters gain zeros. Past history rows keep their M1 fields, and new columns read as null.
8. M1 saves contain no match in progress (matches resolved whole), so no MatchState is migrated.

A save migrated twice, or on two machines, is byte-identical. A migrated career then diverges from a fresh M1.1 career with the same seed; that is expected. Saved mid-season, a young fighter loses the M1 season-end growth his XP would have bought; levels from then on replace it (prog-q9).

## 7. Balance and soak expectations

**Model:** the M1 scratch model extended with 13 stats, levels with auto-pick, round-by-round matches with 5 + 2 squads, combat's auto-swap procedure, per-round Freshness, immediate injuries and AI rotation. It runs 48 clubs in 3 tiers × 16 (caps 14 / 12 / 10), 3 seeds × 20 seasons, and is measured from season 3. Fights are abstract (round win from the rating gap less a Freshness penalty), so the real soak must be re-run on the full sim (document 05). M1 baseline: the same model with season-end clocks and no Freshness.

| Measure | Band (`development.json` soakTargets, unchanged) | M1.1 model | M1 baseline |
| --- | --- | --- | --- |
| Population | drift ≤ 10% | 600–626 | 601–629 |
| Median human-age | 26–32 | 28.0–32.2 | 29.0–32.0 |
| Share human-age ≤ 22 | 0.12–0.32 | 0.14–0.22 | 0.14–0.22 |
| Share human-age ≥ 31 | 0.20–0.55 | 0.37–**0.57** | 0.37–0.54 |
| League mean rating | drift ≤ 3 | 53.5–55.7 (drift ≤ +2.2) | 50.7–54.3 (drifts down ~3) |
| Max rating | ≤ 95 | 83–90 | 85–91 |
| Starter peak ÷ potential (median) | 0.85–0.97 | 0.923–0.930 | 0.94 |
| Retirement median human-age (physical) | — | 39.3–40.0 | 40 |
| Injuries per 40 rounds: human / elf / dwarf / orc / Ashkin | 0.75–1.15 / 1.10–1.65 / 0.50–0.85 / 0.55–0.90 / 0.60–1.05 | 1.05–1.14 / **1.50–1.56** / 0.76–0.81 / 0.72–0.76 / 0.98–1.05 | 1.04 / 1.48 / 0.76 / 0.74 / 0.95 |
| Serious share of injuries | 0.04–0.09 | 0.057–0.079 | 0.064–0.078 |

The race order holds: elves are hurt most, and orcs and dwarves less than humans. Freshness adds about 5% to injuries, through the multiplier on Tired rounds.

**New bands** (`levels.json` soakTargets):

| Measure | Band | Model |
| --- | --- | --- |
| Starter levels a season by human-age: 18–20 (P ≥ 70) / 21–23 / 24–26 (P 50–65) / 27–30 / 31–34 / 35+ | 4.0–6.5 / 3.0–4.5 / 2.2–3.5 / 1.6–2.8 / 0.9–2.0 / 0.4–1.3 | 4.8–5.3 / 3.7–3.8 / 2.6–2.7 / 2.3–2.4 / 1.5 / 0.8–0.9 |
| Matches per level, mid cohort | 4.0–6.0 | 4.3–4.7 |
| Bench levels ÷ starter levels | 0.25–0.45 | 0.40–0.43 |
| Starter levels a season, all ages (distribution) | — | mean 1.84–1.96; 0: 7–9% · 1: 32–35% · 2: 31–33% · 3: 18% · 4: 6–7% · 5+: 2–3% |
| AI Tired round-starts / Spent | ≤ 36% / ≤ 12% | 34.2–34.4% / 10.4–10.7% |
| Starter Stamina median | 10–14 | 11–12 |

**Rating growth per season:**

| Cohort | M1.1 | M1 |
| --- | --- | --- |
| Young (18–20, P ≥ 70) | +3.5 to +4.5 | +3.1 to +3.7 |
| 21–23 | +2.5 to +2.6 | +2.8 to +2.9 |
| Mid (24–26) | +1.4 to +1.5 | +2.0 to +2.2 |
| 27–30 | +1.0 to +1.1 | +1.6 |
| 31–34 | −0.2 | +0.2 |
| 35+ | −1.2 | −1.2 |
| Bench, young / mid | +1.1 / +0.65 | 0 |

Mid-age starters gain less rating, because half their skill slots become skills, which carry value the rating does not count. The league is younger at the top, and the M1 downward drift of the mean disappears.

**Watch items:**
- The share of human-age ≥ 31 touched 0.57 in 1 of 3 seeds; the lever is ageFactorPhysical 31+.
- The median human-age touched 32.2.
- Young prospects are slightly under 5–6 levels on the mean.
- About ⅓ of round-starts are Tired, though mostly mildly (F 50–59, s < 0.2).

**Risks:**
- "Rest everyone, always": countered by the rating gap and the lineup's need to win. Freshness is cheap above 60 and costly only below.
- Stacking Stamina picks: weight 2% plus a bonus that fades above 13.
- Trait offers stacking positives: about 0.34 a season, capped at 4 rolled + learned.
- Bench XP making hoarding efficient: ⅓ of a slot, and a 14-man roster costs wages (economy).

## 8. Mechanical acceptance scenarios

| ID | Initial state | Action / events | Exact expected outcome | Rule IDs | Milestone |
| --- | --- | --- | --- | --- | --- |
| bxp-001 | Club wins 2–1; its starters' round XP sums to 196; fit fighter F outside the squad | Match end | F +13 XP (floor(196 × 3,333 ÷ 50,000) = floor(13.07)); Glory-Hungry F +15 | sys-development, T004 | M1.1 |
| bxp-002 | Squad reserve R never enters | Match end | Bench XP as bxp-001; at the week processing, rest × 0.8 | sys-development, sys-freshness | M1.1 |
| bxp-003 | Fighter injured at lineup lock (weeksOut 2) | Match end | 0 XP | T004 | M1.1 |
| bxp-004 | Starter S swapped out after round 1 (lost, downed, no down credit) of a 3-round match | Match end | S has 10 XP for the match, no bench XP; proposing S as an incoming fighter after round 2 is rejected `not_a_reserve` (combat sw-002) | sys-development, owner ruling | M1.1 |
| bxp-005 | Reserve enters for round 2, wins rounds 2 and 3, 1 down credit each, not downed | Match end | 15 + 15 = 30 XP; no bench XP | sys-development | M1.1 |
| lvl-001 | Oathguard human 25, Steady, level 20, potential 62, trained rating 54, no traits | xpNeeded | 127 × 1.2065 × 1.0 = 153.2 → **155** | sys-development | M1.1 |
| lvl-002 | Emberwright human 19, Brisk, level 8, gap 20 | xpNeeded | **75**; with Quick Study 65; with an A-grade captain (1.08) 70 | sys-development | M1.1 |
| lvl-003 | Chirurgeon human 33, Steady, level 34, gap 1.5 | xpNeeded | **500** | sys-development | M1.1 |
| lvl-004 | Netcaster elf aged 30 (human-age 20.0), level 9, gap 18 | xpNeeded | **130** (lifeScale 1.5, raceGrowth 1.036) | sys-development, D-B | M1.1 |
| lvl-005 | 13 stats, every cap 1,400, every train100 1,000 | Initial level | Σ max(0, 1,000 − 700) = 3,900 → **level 40** | sys-development | M1.1 |
| lvl-006 | xpNeeded 60, xpIntoLevel 50, match XP 150 | Match end | Two level-ups (50 + 150 − 60 = 140; − next xpNeeded); the remainder stays in the bar even if ≥ the next requirement; the third triggers at the next match end | sys-development | M1.1 |
| lvl-007 | Level 21 / 24 / 27 reached | Offer | 3 stats / 2 stats + 1 skill / 1 stat + 2 skills (one rank step, one perk when both are eligible) | sys-development | M1.1 |
| lvl-008 | STR train 1,560, cap 1,600; STR offered and picked | Pick | STR 1,600 (+40); a capped stat is never offered | sys-development, T005 | M1.1 |
| lvl-009 | 3 level-ups pending; a 4th arrives | Match end | The oldest is auto-resolved by the fighter's policy and the digest says so; 3 remain | sys-development | M1.1 |
| lvl-010 | Offer generated at match end; save; reload | Open the dialog | The same 3 options (and the same trait offer) | P-05 | M1.1 |
| lvl-011 | Balanced Oathguard, Stamina 9, offered STR / AWR / Stamina | Auto-pick | Scores 0.90 / 0.20 / 0.80 → STR | sys-development | M1.1 |
| lvl-012 | Trait offer: option 2 is a burden | Auto-pick | Takes option 1 (positive), never the burden; with two burdens impossible (option 1 is always positive) | sys-development | M1.1 |
| lvl-013 | 2 level-ups pending at season end | Season-end step 6 | Both auto-resolved before wear and age +1 | sys-development | M1.1 |
| lvl-014 | Human 30, pick raises rating 61 → 62 in MW9 | Next lineup lock | Rating 62 used; peakRating ≥ 62 | sys-development | M1.1 |
| frs-001 | Stamina 16, human 26; round 30 s, 60% taken, not downed | `freshnessAfterRound` | 4.2 × 0.92 = 3.864 → **3.9**; F 100 → 96.1; the sim receives 96 next round | sys-freshness | M1.1 |
| frs-002 | Stamina 6, human 34; round 38 s, 110% taken, downed | Drain | intensity 1.207 → **10.9** | sys-freshness | M1.1 |
| frs-003 | Elf aged 30 (human-age 20), Stamina 10, typical round | Drain | 7.08 × 1.0 × 1.1 → **7.8** | sys-freshness | M1.1 |
| frs-004 | Stamina 16, typical rounds from 100, no rest | Rounds 1–11 | Rounds 1–10 start ≥ 62.2; round 11 starts at 58.0 (Tired). Stamina 6: rounds 1–5 at ≥ 64, round 6 at 55 | sys-freshness, T003 | M1.1 |
| frs-005 | Week with no round started: Stamina 16 human 26 / Stamina 6 human 34 / the latter as a squad reserve | Week processing | +46.0 / +30.6 / +24.5 | sys-freshness | M1.1 |
| frs-006 | Withdrawn after round 1 at 53.1 with Second Breath | Rest of the match and that week | Stays 53.1 (no +8, no drain); no weekly rest that week | sys-freshness, owner ruling | M1.1 |
| frs-007 | Active fighter with Second Breath, F 50 after the drain | Between-round step | 58 (combat pk-002) | sys-freshness | M1.1 |
| frs-008 | Stamina 16 with Campaign Legs, typical round | Drain | 4.2 × 0.85 → 3.6 | sys-freshness | M1.1 |
| frs-009 | Round start F 45 / 60 / 0 | Injury roll | p × 1.09 / × 1 / × 1.36 | sys-injury, sys-freshness | M1.1 |
| frs-010 | Any fighter, season end | Step 9 | Freshness 100 | sys-freshness | M1.1 |
| inj-010 | Starter injured (minor) in round 1 of 3; one unused reserve, swaps 0 | Between-round step | He plays no later round; the reserve enters (swap 1); weeksOut 2 from next week; no second injury roll for him | sys-injury | M1.1 |
| ai-001 | AI starter Stamina 16, F 62 at lock, typical drain 4.2; bench fighter F 90 within 6 rating | AI lock | 62 < 64.2: rested; the substitute starts | sys-freshness, sys-ai-manager | M1.1 |
| ai-002 | Same starter at F 66.5 | AI lock | Plays (66.5 ≥ 64.2) | sys-freshness | M1.1 |
| ai-003 | AI youth_focused, lost round 1, starter at F 53, reserve F 90 within 6 rating; swaps 0 | Auto-swap | Threshold 50 + 10 = 60 → swapped (53 + 15 ≤ 90) | sys-freshness, combat sys-match | M1.1 |
| ai-004 | AI balanced, won round 1, starter at F 45 | Auto-swap | No swap (45 ≥ 40) | combat sys-match | M1.1 |
| cap-011 | Fit club captain, F 52 at lock, left out of the squad 5 matches in a row | Each lock | Losing the Room never starts (rests exempt); named as a reserve counts as fielded | sys-captaincy | M1.1 |
| chem-003 | Lineup chemistry +3 at lock; reserve with Good Company enters | Round 2 | He gets +1 composure (3 ÷ 2 toward zero); chemistry stays +3 | sys-chemistry | M1.1 |
| sta-001 | Human Oathguard, P 60, jitter 0, human-age 26, D 26, bloom 0 | Generation | Stamina cap 1,427; train100 = 1,341; shows 13 | sys-fighters | M1.1 |
| sta-002 | That fighter from 31 to 36 | Season ends | Wear 1.4 points → Stamina 12 | sys-fighters | M1.1 |
| sta-003 | Race tendency for stamina 4.5 | Validator | Rejected (cap ±4) | sys-races | M1.1 |
| mig-001 | v2 save at MW8; fighter with season round XP 210, xpNeeded 155 after migration | Load | Every shown stat except Stamina unchanged; xpIntoLevel 154; no pending level-up; Freshness 100 | sys-save | M1.1 |
| mig-002 | The same v2 save migrated twice | Compare | Byte-identical v3 states | sys-save | M1.1 |
| mig-003 | Fighter rating 64 → 65 by the reweight; peakRating 70 | Load | peakRating 71 | sys-save | M1.1 |

## 9. Interface with combat (both drafts state these)

| Topic | Combat (`combat-skills.md` v0.2) | Lifecycle (this draft, `levels.json`) |
| --- | --- | --- |
| Stat id | `stamina`, physical, STA; no fight formula; 2% rating weight; statEmphasis | Race tendency, generation offset and jitter, aging, auto-pick bonus |
| Freshness | Penalty at each round start from `freshness` (threshold 60, full at 10); between-round screen | Drain per round played, between-round gains, weekly recovery, labels, injury multiplier; passes floor(freshness10 ÷ 10) |
| Hooks | `playRound` calls `freshnessAfterRound`, `xpAfterRound`, `injuriesAfterRound`; `applyBetweenRound` calls `freshnessBetweenRounds` | Implements them, plus `matchEnd` (commit XP, bench XP, level-ups, offers) |
| Squad and swaps | 5 + 2, ≤ 2 swaps, between rounds, no return; forced injury replacement; emergency entrant | Mirrored in `levels.json` matchSquad; XP, Freshness and injury rules for each case (§3) |
| Auto-swap | Procedure, freshnessBelow 40, reserveMargin 15, maxRatingGap 6, keepOneForInjury | Personality thresholds; proposed lost-round bonus +10 |
| Skill offers | Catalog, eligibility, kind and item draw, `autoPickValue` | When skill slots appear (every 3rd level; two at every 9th), streams, the stat-versus-skill comparison, the queue |
| Perk lifecycle effects | `freshnessDrainMult` (Campaign Legs 0.85), `freshnessBetweenRounds` (Second Breath +8), `captaincy` (Banner Voice +5) | Implements them as stated in §3 |
| Rating | ratingWeights incl. `stamina` | Rating, potential, wPhys (physical share incl. `pre` and `stamina`) |

## 10. Schema notes for the architect

- **Content:**
  - New `levels.json`, with a validator for: ascending table keys; `freshness.threshold` = combat `freshness.thresholdBelow`; `matchSquad` equal to combat `match`; aiSubstitution personality keys = `economy.json` aiPersonalities ids; traitOfferPool ids exist, positives are boon or edge, burdens are burdens, and none is physique, acquired or flaw.
  - `development.json` v2 and `traits.json` v2 via the patches.
  - `races.json` with `stamina` in `stats.ids` and every race's statTendencies.
  - `STAT_IDS` and `PHYSICAL_STAT_IDS` += `stamina` (combat's schema notes).
- **Fighter (state v3):**
  - `train100: Record<StatId, number>`, and the 13th key in `cap100`, `bloom` and `wear100`.
  - `level`, `xpIntoLevel`, `xpNeeded`.
  - `pendingLevelUps: { level; season; week; options: LevelOption[]; traitOffer: TraitId[] | null }[]` (max 3), with `LevelOption = { kind: 'stat'; stat; gain100 } | { kind: 'rank'; abilityId; toRank } | { kind: 'perk'; perkId }`.
  - `levelUpMode: 'inherit' | 'manual' | 'auto' | 'auto_stats' | 'auto_skills'`.
  - `abilityRanks` and `perkIds` (combat).
  - `freshness10` (0–1,000).
  - Trait `source` += `'level'`.
  - `season` += `roundXp`, `benchXp`, `levels`, `picks { stat, rank, perk, trait }`, `tiredRoundStarts`, `spentRoundStarts`, `restWeeks`, `squadReserveMatches`.
  - `career` += `levelsGained`.
  - History rows += `levelStart`, `levelEnd`, `stamina`, `benchXp`, `tiredRoundStarts`.
  - `dev100` stays (legacy, frozen).
- **Club:** `levelUpDefault`, `levelUpPacing`, plus combat's `autoSwap` and `pauseBetweenRounds`.
- **Pure functions** (core/fighters):
  - `initialLevel(f)`, `xpNeeded(f, ctx)`, `roundXp(aftermath, ctx)`, `benchXp(clubMatchXp, f)`;
  - `generateLevelUpOffer(f, ctx, rng)`, `applyLevelUpChoice(f, index, choice)`, `autoPick(f, offer, policy)`;
  - `roundDrain(f, aftermath, durationS)`, `betweenRoundGain(f)`, `weeklyRecovery(f, weekKind, wasSquadReserve)`;
  - `freshnessLabel(F)`, `freshnessInjuryMult(F)`, `typicalRoundDrain(f)` (UI forecast and AI rotation).
- **Orchestrator hooks:** `freshnessAfterRound`, `xpAfterRound`, `injuriesAfterRound`, `freshnessBetweenRounds`, `matchEnd` (`levels.json` hooks).
- **RNG streams:** `development` (offers), `traits` (trait offers), `injury` (per round, existing key), `migration` (v2 → v3).
- **Week processing:** Freshness recovery runs with injury countdowns; level-up digest lines.
- **Removed:** trend computation (`development.json` trend) and the season-end development step.

## 11. Merge notes

- **Combat:**
  - Please adopt or reject the **lost-round bonus (+10)** in the auto-swap procedure; `levels.json` already supplies it.
  - Second Breath applies to active fighters and unused reserves, not to withdrawn fighters (your perks.json rule says "active or reserve").
  - In season play expect **~0.5 swaps per match** (both sides), three quarters of them forced by injury. AI rotation keeps most starters above 40, so your `squad-match` target of 0.6–1.4 (starting Freshness drawn 50–100) is harsher than league play.
  - Skill-slot volume: about 0.9 a season for a mid-age starter and 1.6 for a prospect. Your "season 3 typical: 2 rank-ups and 1 perk" fits a fighter who debuted young; mid-age starters reach it in seasons 4–5.
- **Economy (sys-ai-manager):**
  - Apply aiRotation at the lock, and the reserve choice (one front-line, one back-line, Freshness ≥ 60).
  - Personality ids must match aiSubstitution.
  - Hired blades start at Freshness 100.
  - Optional: valuation can read `levelEta` (FUTURE).
- **Lead (documents):**
  - 03 §3.2 sys-development: replace XP-to-development, usage, training-emphasis formulas, season-end development and trend with this draft's sections. D-A is superseded by T004.
  - Add sys-freshness to the 01 inventory.
  - 03 sys-injury timing step 6 becomes "immediate".
  - 03 season-end steps 6 and 9 as in §3.
  - 03 §9.2: dev-001, dev-003 to dev-005 and dev-008 retire, replaced by bxp-, lvl-, frs- and mig- scenarios; dev-006 (round XP) and dev-007 (emphasis off) stay, reworded.
  - 04: level badge, XP bar, level-up dialog, Freshness bar and forecast, pacing setting.
  - 05: state v3 and the hooks.

## 12. Owner confirmations needed

Each item has my recommendation.

| ID | Question | Recommendation |
| --- | --- | --- |
| prog-q1 | Bench XP = ⅓ of one lineup slot's match XP, for every fit roster fighter who starts no round, squad reserves included | **Approve.** Deterministic and visible; no counterfactual "what he would have earned" |
| prog-q2 | Lifespan scaling of leveling (one clock, D-B): at the same human-age an elf levels every ~7 matches where a human levels every ~5 and an Ashkin every ~3 | **Keep.** It is O11's career shape in level form. *Alternative:* turn it off (elves level as often as humans and their long careers end up far stronger) |
| prog-q3 | Each pick is +1 point to one stat (or a skill or trait); no season-end growth; mid-age starters gain ~1.5 rating a season (M1 ~2.1), young ones ~4, the bench ~0.7–1.1 | **Approve.** Skills carry the value the rating misses, and the bench now grows |
| prog-q4 | Cadence: a skill slot every 3rd level, two at every 9th; trait offer 12.5% (option 2 a burden 25% of the time) | **Approve.** About 1 skill and 1 trait offer every 3 seasons for a typical starter |
| prog-q5 | Freshness constants: drain (11.88 − 0.48 × STA) × intensity per round; recovery 30 + STA per rested week, age ×0.85 / ×0.7; threshold 60; reset at season end | **Approve**; tune with combat's `fatigue` and `squad-match` harness modes |
| prog-q6 | A squad reserve who never enters recovers 80% of a rest | **Approve.** Naming him has a small cost. *Alternative:* 100% |
| prog-q7 | AI rotation leaves ~34% of round-starts Tired (mostly 50–59) and ~10% Spent | **Accept for M1.1** and watch the playtest. *Lever:* rest at 60 + 2 typical drains |
| prog-q8 | Lost-round bonus +10 to the AI auto-swap threshold (needs combat's agreement) | **Approve.** It makes losing sides use their reserves |
| prog-q9 | Migration carries this season's round XP into the bar (capped below one level) and gives no compensation for the lost M1 season-end growth | **Approve.** Simple, deterministic, nothing pops on load |
| prog-q10 | Player defaults: level-ups `manual`, pacing `detailed` for the playtest | **Approve**; switch to `balanced` after |
| prog-q11 | Level-ups are checked only at match end (never between rounds), at most 2 per match | **Approve.** Between-round screens stay about swaps |
| prog-q12 | Stamina has no captaincy or direct injury role; Bellows Chest gains +2 Stamina | **Approve** |
| prog-q13 | A "20-year-old elf" cannot exist (elves debut at 28–33); examples use an elf aged 30 (human-age 20) | **Confirm** the reading |
