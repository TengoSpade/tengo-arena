# Arena League — fighter lifecycle (phase-2 draft for document 03)

> ARENA LEAGUE DESIGN PACKAGE · PHASE-2 DRAFT · 2026-10-25 · fighter-lifecycle designer. To be merged into [03-gameplay-systems-and-content.md](../03-gameplay-systems-and-content.md) §3–§9. Not approved for implementation and not independently reviewed.
> Labels follow [document 01](../01-game-vision-and-design-principles.md) "Meaning of specification labels": **REQUIRED** only where an owner ID (O…) is cited; **PROPOSED** for this designer's rules (they become REQUIRED when the owner approves); **TUNABLE** for values (all are PROPOSED · TUNABLE); **EXAMPLE**, **OPEN** (with open-ids from 01 §8.4 where one exists) and **FUTURE** as defined there. Untagged prose in a section takes the section's status line.
> Vocabulary follows 01 §7: fight, round, match, matchweek, club, lineup, roster, reserve, downed, rating, potential, captaincy. "Focus" means only the in-fight resource, so the Discipline stat is `dis` and the training setting is *training emphasis*.

| Field | Value |
| --- | --- |
| Game / version / updated | Arena League / lifecycle draft v0.1 / 2026-10-25 |
| Status / design owner | Draft for merge / the project owner |
| Milestone covered | M1 "Season MVP" (O14). Hooks for M3 (rule slots), M4 (fog of war), M5 (academy) are marked FUTURE |
| Content files (owned) | `content/default/races.json`, `traits.json`, `names.json`, `development.json` |
| Systems specified | sys-races, sys-fighters (generation, names), sys-youth-intake, sys-development (XP, growth, training emphasis, trend; aging, decline and retirement, which is the brief's "sys-aging"), sys-injury, sys-traits, sys-captaincy, and a proposed new id sys-chemistry |
| Inputs read | research.md §1, §2, B2, C1.10, C2.6, C3.12–C3.14 and Part D; research-notes 04, 05, 06; design docs 01, 02, 03 §1–2; drafts `03-combat.md`, `03-league-economy.md`; content `combat.json`, `classes.json`, `economy.json`, `leagues.json` |
| Stat ids (final, combat) | Physical: `str` Strength, `agi` Agility, `pac` Pace, `tgh` Toughness (the durability input to injuries), `pre` Precision. Mental: `arc` Arcana, `spi` Spirit, `wil` Willpower, `cmp` Composure, `ldr` Leadership, `awr` Awareness, `dis` Discipline. All lifecycle data is keyed by these ids |
| Magnitude caps (TUNABLE; combat cmb-q11) | A race stat tendency is at most ±4 points per stat (`races.json stats.tendencyCapPerStat`). A trait stat add is at most ±3 points per stat (`traits.json statAddCapPerTrait`). The validator enforces both. Fragility and durability are expressed mainly through injury chance and recovery multipliers. Current values reach ±1.6 for races and ±3 for traits |

## 0. Summary of the design

- **One clock rules aging (REQUIRED in shape, O11; values PROPOSED).** Every age rule reads **human-age** = age × 80 ÷ lifespan. A human peaks physically at 28 and an elf (lifespan 120) at 42. Per-season rates are scaled by k = 80 ÷ lifespan, so each phase of a career lasts lifespan/80 times as many seasons as a human's.
- **Five races.** Human, elf, dwarf and orc as required; one original race, the **Ashkin** (lifespan 52), who arrive almost at their peak and are done by their mid-twenties. Long careers cost injuries: elves are hurt about 1.4× as often as humans, dwarves and orcs about 0.7×.
- **Potential is fixed; reaching it is earned.** Each fighter has a hidden **development pace** and two **development clocks** (physical and mental) that advance only as fast as the fighter plays. An unused fighter gains 0 XP (O3) and develops at 20% speed. Growth and decline are kept apart: decline accumulates as **wear**, which never heals.
- **Injuries are a ladder with visible odds.** The rungs are knock, minor, moderate, serious, then a rare permanent scar. A career-ending injury is possible only for a fighter who shows **At risk** before the match, and the lineup screen shows its per-match chance (research C2.6).
- **Traits work like Crusader Kings, with original names.** There are 60 traits: 48 can be rolled and 12 are earned or suffered. Each fighter rolls 2–4 (mean 2.9). 80% of rolled traits are positive, and no starting fighter has more than one negative. Most negatives are trade-offs, and every rolled pure flaw has a visible way to lose it.
- **Captaincy is a rating from 1 to 100,** built from leadership, composure, experience, seniority, standing and traits, with a grade from A to E.
  - In fights the sim applies a composure aura, one rally per round and a short Shaken when the captain falls. Combat adopted this model and reads the amounts from `development.json captaincy.grades`.
  - Off the fight, the captain's grade mentors young club-mates, sets lineup chemistry, and makes changing captains cost something.
- **A soak model behaved over 20 seasons** (§8.3; a simplified model, not the real sim). Population, age mix, ratings and per-race injury rates stayed inside their target bands.

## 1. Mechanical foundations (lifecycle-specific)

**Status:** units are REQUIRED as set by document 03 §1. Everything else here is PROPOSED.

| Topic | Decision | Player-visible consequence |
| --- | --- | --- |
| Stat scale | Stats are integers 1–20 (03 §1). Lifecycle stores each base stat in **centipoints** (hundredths: 100–2,000) so that growth and decline can be gradual. The stat displayed and passed to combat is floor(effective centipoints ÷ 100), clamped to 1–20. Trait, status and chemistry modifiers are whole points | A stat shows a progress pip toward its next point. Displayed values always equal what combat uses |
| Rating / potential | Rating = clamp(round(Σ wᵢ × eff100ᵢ ÷ Σ wᵢ ÷ 20), 1, 100), where wᵢ = the class's `ratingWeights` in classes.json (so rating = 5 × the weighted mean stat). Potential is the same formula with every stat at its cap, no wear, and only permanent modifiers (physique and scars). Stars = potential ÷ 20 in half-star steps (03 §1) | Potential falls when a scar is gained. That is the "injury" event change allowed by P-12 |
| Human-age | humanAge = floor(age × 800 ÷ lifespan) ÷ 10, i.e. kept in tenths. Table lookups use floor(humanAge). Season rate scale k = 80 ÷ lifespan | Fighter cards show "Age 42 (prime)", with the human-age equivalent on hover |
| Calendar | Season-year as in leagues.json: P1–P4, MW1–MW16, three tournament weeks (23 weeks), then the season-end step. Everyone ages +1 at season end only. Injury durations count weeks, including preseason weeks. The off-season inside the season-end step heals **8 weeks** | A serious injury in matchweek 14 is usually healed by P1–P4 |
| Probabilities | Basis points (03 §1). JSON stores decimals; the loader converts them to basis points (round half away from zero) | — |
| Randomness | Architect streams (src/core/fighters README): `STREAM.development`, `aging`, `injury`, `retirement`, `rookies`, `traits`, `names`. Each draw is keyed by (career seed, stream, season, week, fighter id, purpose), so the order clubs are processed in cannot shift results. Committed at the 02 §3 commit points; reload never rerolls (P-05) | Odds shown before a match are the odds used |
| Information | M1–M3: true values for everyone (open-026), including potential and development pace. M4 fog hooks: potential stars with uncertainty, pace hidden until one season at the club, trait reveal tiers (traits.json `revealOrder`) | M1 is fully transparent |
| Integer arithmetic | Fixed-point everywhere. Interpolation truncates toward zero. The retirement conversion 1 − (1 − h)^k is precomputed once per (race, human-age) into a basis-point table at content load or build time (Schema notes) | Bit-identical replays (T4) |

**Season-end order** (it refines 02 §3 and the economy draft's steps):
1. In step "aging and development", each fighter's season development and decline run **with the age held during the season**. Then come acquired-trait and trait-loss checks, the captaincy recompute, and finally age +1.
2. In step "retirements", each fighter's retirement chance, computed before the +1, is rolled. Fighters with a career-ending injury or a final season retire without a roll.
3. After contract expiry and off-season recovery come free-agent pool maintenance (a fighter unsigned at 2 consecutive season ends leaves) and the rookie intake (sys-youth-intake).
4. At P1, final-season announcements are made (sys-development, retirement).

## 2. System inventory (lifecycle scope)

**Status:** ids are those of 03 §2. **sys-chemistry is a new PROPOSED id** that must be registered in document 01, and its M1 inclusion is open-029.

| System ID | Purpose | Depends on | M1 behavior | FUTURE |
| --- | --- | --- | --- | --- |
| sys-races | Lifespan scaling, debut ages, growth and decline multipliers, stat tendencies, injury proneness, class affinity, names key | sys-theme | 5 races | Region-weighted race mixes (M6) |
| sys-fighters | Generation: potential, pace, caps, class, age, development clocks, wear history, traits, name; effective stats; rating and potential | sys-races, sys-traits, classes.json | World generation, free agents, journeymen, hired blades (hook) | Scout-reported youth (M4) |
| sys-youth-intake | Rookie count, race and age at season end, for trials day (P-18) | sys-fighters | Formula below | Academy graduates (M5) |
| sys-development | XP; usage; development clocks; maturity; training emphasis; mentoring; trend; season report; **aging, decline, retirement** | sys-match results, sys-races, sys-traits, sys-captaincy | Full | Rule slots (M3), academy XP (M5) |
| sys-injury | Per-round chance, severity ladder, recovery, scars, career-ending, At risk, Still tender, reports | sys-match results, sys-races, sys-traits | Full | Medical staff (open-022), play-through-a-knock, hardcore permadeath (M7) |
| sys-traits | Catalog, roll, exclusivity, lifecycle effects, gain and loss, reveal tiers | sys-fighters | 60 traits | Academy teaching and curing (M5), strain (open-029) |
| sys-captaincy | Club captain and vice-captain designation, captaincy rating and grades, lineup captain, mentoring, change consequences | sys-fighters, sys-traits, sys-roster | Full | Calls through the captain (M2/M3, P-01) |
| sys-chemistry (new) | Lineup chemistry from traits, captain and statuses, converted to a composure modifier at lineup lock | sys-traits, sys-captaincy | PROPOSED for M1 (open-029); one switch disables it | Pair bonds from shared rounds, strain (research D3) |

## 3. System specifications

### sys-races: races and lifespan scaling

**Status / scope:** lifespan-scaled aging, a human peak of 28, an elf peak of about 42, "long-lived races are more injury-prone", and "orcs and dwarves live shorter and are more durable" are REQUIRED (O11). The values chosen for them, the Ashkin and every other field are PROPOSED · TUNABLE. M1.

**Purpose:** a race sets *when* a fighter is good and *for how long*, at the price of being hurt more or less often. A long career and a short one are each a real choice.

**Entities and state:** content only (`races.json`). The fighter stores `raceId`.

**Race table (REQUIRED shape, PROPOSED values).** Ages are in years. Injury rates per 40 rounds come from the soak model in §8.3.

| Race | Lifespan | k | Debut age | Physical peak (plateau) | Physical decline from | Mental decline from* | Injury chance × | Recovery × | Injuries / 40 rounds | Typical career (p10 / median / p90 seasons) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Human | 80 | 1.000 | 17–21 | 28 (28–30) | 31 | 60 | 1.00 | 1.00 | 0.95–1.04 | 15 / 18 / 22 |
| Elf | 120 | 0.667 | 28–33 | 42 (42–46) | 47 | 90 (60 if unscaled) | 1.25 | 1.20 | 1.26–1.46 | 20 / 25 / 30 |
| Dwarf | 72 | 1.111 | 16–19 | 25 (26–27) | 28 | 54 | 0.80 | 0.90 | 0.64–0.77 | 13 / 17 / 20 |
| Orc | 64 | 1.250 | 16–18 | 22 (23–24) | 25 | 48 | 0.85 | 0.85 | 0.71–0.79 | 11 / 13 / 16 |
| Ashkin (original) | 52 | 1.538 | 16–17 | 18 (19–20) | 21 | 39 | 0.85 | 0.80 | 0.77–0.94 | 6 / 9 / 11 |

Durability shows up twice: in the race's injury multipliers (the main lever) and in small toughness (`tgh`) tendencies of ±1.6 at most (combat cmb-q11 caps them at ±4). The stat gap is kept small because each `tgh` point is 4% max HP in combat.

\*With mental decline scaled by lifespan (recommended; owner confirmation C-1, open-025). All the mental-decline ages fall after the end of a playing career.

**Identity and trade-offs (PROPOSED):**
Tendencies are cap offsets in stat points, keyed by the combat stat ids and capped at ±4 per stat.

- **Human.** No stat tendencies. *Adaptable:* training emphasis works 1.5× as strongly. The baseline career is about 18 seasons.
- **Elf.** agi +1.2, pre +1.0, awr +0.8, arc +0.8, spi +0.4, pac +0.4; str −1.2, tgh −1.6, wil −0.4. Mental growth ×1.1.
  - *The trade-off:* the slowest climb (about 14 seasons from debut to peak), the longest prime and the longest decline, the most injuries and the slowest healing.
  - A 30-year-old elf prospect is an investment that pays off around season 12. An elf at 42 still has about 15 seasons left.
- **Dwarf.** Shorter-lived than humans (owner confirmation C-2). tgh +1.6, str +1.0, cmp +0.8, wil +0.8; pac −1.6, agi −1.0, arc −0.6.
  - *Bedrock:* physical decline ×0.85. The lowest injury rate.
  - *The trade-off:* slow, and physical growth ×0.95.
- **Orc.** str +1.6, tgh +1.0, wil +0.4; dis −1.0, cmp −0.8, pre −0.8, arc −0.8. Physical growth ×1.05, mental ×0.9. *Thick-Blooded:* recovery ×0.85.
  - *The trade-off:* useful almost at once (rating about 65 by 20), done by 30.
- **Ashkin.** pac +1.2, str +0.8, arc +0.6, agi +0.4; cmp −1.2, dis −0.6, ldr −0.4, spi −0.4. Mental growth ×0.85.
  - *Ready-Made:* the debut-age floor of 16 already equals human-age 24.6, so an Ashkin arrives near the top of the curve.
  - *The trade-off:* about 8 seasons in total, weak captains, and the steepest decline per season (k = 1.54).

**Why the trade-off is real (EXAMPLE, from the worked examples below).** For a fighter of potential 70 with steady pace who starts every round:
- Seasons rated 60 or more: about 12 for a human, about 17 for an elf, about 11 for an orc, about 8 for an Ashkin.
- Seasons rated under 55 while still developing: about 4 for a human, about 9 for an elf, about 1 for an orc, 0 for an Ashkin.
- Elves give the most total value but tie up a roster place, and wages, through a long apprenticeship, and they miss about 40% more matchweeks to injury.
- Orcs and Ashkin are win-now fighters whose resale value collapses fast (economy `ageAdj`).

**Inputs and legal actions:** none at runtime. Races are read at generation and in every age-dependent formula.

**Resolution procedure:** human-age is computed on demand as above. k is used by every per-season rate (development clocks, wear, retirement conversion).

**Formulas and units:** see §1. Race multipliers multiply the corresponding per-season quantity. statTendencies are added to caps at generation (sys-fighters).

**Player information:** a race page shows its lifespan and the peak, decline and mental-decline ages (computed, never typed), plus injury proneness as a word and a number. The fighter card shows the race's peak window on the age bar.

**Edge cases:** a race whose computed debut age would be under 16 is clamped to 16 (debutAgeFloor). This is why the Ashkin debut at human-age about 25. Every race lists all 12 stat ids; a missing id is a validation error.

**Content parameters:** lifespan (40–200), debut range (≥ 16), intakeWeight, growth and decline multipliers (0.7–1.3), tendencies (hard cap ±4 points per stat; keep within ±2 by preference), injury multipliers (0.6–1.5), affinity by combat.json `affinityGroups` (0.3–2.0).

*Invariant (O11), checked by the validator:* a race longer-lived than humans must not have a lower injury chance multiplier than humans, and a race shorter-lived than humans must not have a higher one. Among the shorter-lived races the order is free, which is why dwarves can be the sturdiest.

**Worked example (EXAMPLE).** An elf aged 42: humanAge = floor(42 × 800 ÷ 120) ÷ 10 = 28.0, which is the peak, same as a human of 28. An orc aged 26: floor(26 × 800 ÷ 64) ÷ 10 = 32.5, which is a human of 32: two seasons into decline.

**Acceptance cases:** life-001 to life-003 in §9.

---

### sys-fighters: generation, effective stats and names

**Status / scope:** PROPOSED · TUNABLE. M1.

**Purpose:** create believable fighters whose potential is fixed but whose current level depends on age, pace and opportunity, consistently for rookies, free agents and world-generation veterans.

**Entities and state (per fighter, lifecycle part):**
- `potentialRoll` P (30–97)
- `paceId`
- `cap100[stat]` (200–2,000)
- `bloom[stat]` (−2…+2 human-years)
- `dev100 {physical, mental}` (hundredths of human-years)
- `wear100[stat]` (≥ 0)
- `traitIds` plus their metadata
- `statuses`
- `injury`
- career counters (careerRounds, proSeasons, matchweeksAtClub, matchweeksAsClubCaptain, peakRating)
- `trainingEmphasis`
- `unsignedSeasonEnds`

Base stats are *derived* from these fields. They are never stored as an independent value (Schema notes).

**Inputs:** a generation request {race (or drawn by `intakeWeight`), age (or drawn), quality shift, context: worldGen | rookie | freeAgent | journeyman | hiredBlade}.

**Resolution procedure (generation; streams `rookies`/`development`/`traits`/`names`):**
1. **Race and age.**
   - Rookie: age uniform in `race.debutAge`.
   - World generation: draw a human-age band (`generation.worldGen.humanAgeBands`), then a whole human-age within it; age = round(humanAge × lifespan ÷ 80), clamped to [debutAge.min, age at human-age 40].
2. **Class.** Weighted by `race.classAffinity[class.affinityGroup]` over the 42 classes of classes.json (soft: even an elf tank is possible).
3. **Potential P.** A band by weight, then a uniform integer within it, plus the quality shift, clamped to 30–97.
   - Band weights: 30–44: 20, 45–57: 34, 58–69: 28, 70–81: 13, 82–91: 4.5, 92–97: 0.5.
   - Quality shifts are owned by league/economy (EXAMPLE: world generation tier 1 +8, tier 2 +4, tier 3 0; free agents −3).
4. **Pace.** Slow 0.75 (15%), Measured 0.90 (25%), Steady 1.00 (33%), Brisk 1.15 (19%), Rapid 1.30 (8%).
5. **Caps**, per stat id i: `cap100ᵢ = clamp(round(P × 20 + classOffset100ᵢ + 100 × race.statTendencies[i] + jitter100ᵢ), 200, 2000)`.
   - classOffsetᵢ = clamp(2.0 × (statEmphasisᵢ − 1), −1.5, +2.5) points, from classes.json `statEmphasis`, then recentred so that Σ ratingWeightᵢ × classOffsetᵢ = 0. The potential rating therefore stays close to P.
   - Jitter: uniform ±0.8 points.
6. **Bloom**ᵢ: a uniform integer from −2 to +2. It makes some stats ripen earlier than others.
7. **Development clocks.**
   - `D_g = min(humanAge + 4, 16 + max(0, humanAge − 16) × U × pace × race.growthMult[g])`.
   - U is uniform in 0.65–1.00 and stands for pre-career and pre-generation playing time.
8. **Wear history.** wearᵢ = the physical decline table summed over every human-year from 31 up to floor(humanAge) − 1, times race.declineMult. No scars yet.
9. **Veteran history** (any fighter older than a sampled debut age):
   - proSeasons = age − debut.
   - careerRounds = round(proSeasons × 40 × U).
   - Each pro season rolls a 1.6% scar chance.
   - Acquired-trait thresholds are then checked once, so a 35-year-old can arrive Sand-Wise.
10. **Traits:** sys-traits roll.
11. **Name:** see below.

**Effective stats (single function, used by combat setup, rating and captaincy):**
- `developed100ᵢ = cap100ᵢ × M_g(D_g + bloomᵢ)` (interpolated maturity curve, truncated).
- `base100ᵢ = max(100, developed100ᵢ − wear100ᵢ)`.
- `eff100ᵢ = base100ᵢ + 100 × (trait stat mods + status mods + chemistry composure on cmp + contextStat if the match qualifies)`.
- Displayed and combat value = clamp(floor(eff100ᵢ ÷ 100), 1, 20).
- These are **management-applied** modifiers: the fight setup's `stats` already include them, and the sim must not apply them again. In-fight changes (captain aura, rally, Shaken, trait `combat` effects) are applied by the sim on top (combat sys-fight-traits and sys-fight-captain).

Maturity curves (fraction of cap by development clock D, in human-years):

| D | 14 | 16 | 18 | 20 | 22 | 24 | 26 | 28 | 30 | 32 | 34 | 36 | 38 | 40 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Physical | .40 | .50 | .60 | .70 | .79 | .87 | .94 | 1.00 | 1.00 | | | | | |
| Mental | .42 | .50 | .57 | .64 | .70 | .75 | .80 | .84 | .88 | .91 | .94 | .96 | .98 | 1.00 |

(Physical also has points at 17 = .55, 19 = .65, 21 = .745, 23 = .83, 25 = .905 and 27 = .97.)

**Names.** Pattern by weight per race, with parts concatenated as in `names.json`.
- Reject a name and retry (up to 20 attempts) on a blocklisted word, three identical letters in a row, a given name outside 3–11 letters, or a full name already held by a living fighter.
- On exhaustion, append II, III and so on.
- Store given, family and epithet separately (`PersonName`).
- Monte Carlo over 2,000 names per race gives 97.6–99.8% unique and 0 blocklist hits.

**Other generated kinds:**
- *Journeymen*, created when the pool falls below the economy floor: rating band set by economy, human-age 26–33, shift −3.
- *Hired blades* (open-006): human-age 24–33, shift −12, one-match terms. They earn XP like anyone else.

**Player information:** M1 shows true potential (stars plus number), pace, traits, caps as "ceiling" ticks on each stat bar, and wear as a hatched segment.

**Edge cases:** P clamped to 30–97; a cap never below 2 or above 20; D can exceed human-age (a prodigy) but the curves cap at 1.0; a class with no statEmphasis falls back to rank offsets (+1.2 for the top 2 weights, +0.4 for the next 2, −1.2 for the rest).

**Interactions:** sys-traits (stat mods, scars lower potential), sys-development (clocks, wear), combat (receives display integers; must not re-apply trait attribute mods).

**Worked example (EXAMPLE).**
- *Setup:* Oathguard (tank; statEmphasis tgh 2.0, str 1.27, arc 0.5), P = 70.
- *Offsets before recentring:* tgh +2.0, str +0.54, arc −1.0.
- *Recentring:* the rating-weighted mean offset is about +0.6, so the offsets become tgh +1.4, str −0.06, arc −1.6.
- *Caps:* tgh cap = 14.0 + 1.4 = 15.4 points (1,540 centipoints) before race and jitter. A dwarf adds +1.6: 1,700.
- *At D_physical = 22:* tgh = 1,700 × 0.79 = 1,343 → shows **13**.

**Acceptance cases:** gen-001 to gen-005.

---

### sys-youth-intake: rookies each season

**Status / scope:** PROPOSED · TUNABLE (counts are coordinated with league/economy, which runs trials day). M1.

**Resolution procedure (season-end step "next-season setup"):**
1. `rookies = clamp(round(clubs × 0.6) + retirementsThisSeason, round(clubs × 0.5), round(clubs × 1.6))`.
   - retirementsThisSeason counts retirements and career-ending injuries.
   - It does **not** count unsigned fighters who left the league, because counting them would feed back into itself.
2. For each rookie: race by `intakeWeight` (human 36, orc 20, dwarf 17, Ashkin 14, elf 13), age uniform in the race's debut range, quality shift 0, then sys-fighters generation.
3. Hand the rookies to trials day (economy `market.trialsDay`): an even split per club plus lots.

**Expected volume (EXAMPLE):**
- 24 clubs: about 14 + retirements, so roughly 30 a season.
- 48 clubs: about 29 + retirements.

**Population mix (soak):** humans 34–40%, elves 16–21% (above their 13% intake share, because elves stay longer), dwarves 13–20%, orcs 18–21%, Ashkin 6–12%.

**Edge cases:** if trials day leaves rookies unsigned they enter the free-agent pool and leave after two unsigned season ends. That is the churn valve.

**Acceptance:** intake-001.

---

### sys-development: XP, growth toward potential, training emphasis, trend

**Status / scope:** "XP from playing rounds drives growth toward potential", "a called-up fighter who is not used gains no XP" and "academy development stops at call-up" are REQUIRED (O3, P-12 shape). The model and numbers are PROPOSED · TUNABLE. M1; academy hooks are FUTURE (M5).

**Purpose:**
- Playing time is the main development lever, so lineup choices are development choices.
- Pace and traits make every prospect a bet.
- Growth is visible every season.

**Entities and state:** `dev100 {physical, mental}`; `season {xp, roundsStarted, emphasisWeeks {balanced, body, mind}, matchweeksUnderCaptain {captainId → weeks}}`; `careerRounds`; `careerXp`; `peakRating`; `trainingEmphasis`.

**Inputs and legal actions:**
- Match results for each round started (combat boundary contract 2).
- *Player action:* set a fighter's **training emphasis** (Balanced, Body or Mind) at any time outside a match. It is a standing setting, not a weekly chore. AI policy: §5.

**XP per round started (committed with the match result):**
- Base: 10 for starting the round.
- Win bonus: +3 if the fighter's side won the round.
- Down credits: +1 per down credited by combat, at most +2.
- Survival: +1 if the fighter was not downed.
- Tournament matches: ×1.25.
- Then trait XP multipliers.
- Floor once at the end.
- Maximum: 16 per round (20 in the tournament).
- A fighter who did not start the round gets 0: reserves, injured fighters, called-up academy fighters not fielded, free agents.

**Usage:** `usage = 0.20 + 0.80 × min(1, seasonXp ÷ 360)`.
- 360 XP is about 70% of a full-time starter's league XP (16 best-of-3 matches × about 2.5 rounds × about 12.8 XP). Starting about 70% of rounds therefore develops at full speed.
- *Concavity:* splitting rounds between two prospects develops them better in total than starting one every round, and the player chooses between winning now and developing.
- **OPEN (owner confirmation C-5):** the 0.20 floor means an unused fighter still matures a little (XP stays 0, as O3 requires).

**Resolution procedure (season end, step "aging and development", stream `development`):**
1. `usage` from season XP.
2. Training emphasis multipliers, where fBody and fMind are the shares of the season's 23 weeks under each emphasis and `a` = product of trainingEmphasis multipliers (human 1.5, Regimented 1.5, Set in Their Ways 0; a clamped to 0–2):
   - `physDev = 1 + a × (0.25 × fBody − 0.15 × fMind)`
   - `mentDev = 1 + a × (0.25 × fMind − 0.15 × fBody)`
   - `physWear = 1 − a × 0.20 × fBody`
3. Mentor multiplier, for human-age ≤ 23 during the season:
   - The club captain's grade multiplier, pro-rated by the matchweeks the captain held the role: A 1.08, B 1.05, C 1.02, D 1.00, E 0.97.
   - Times up to two trait mentors (Shares the Craft 1.04, Long Road 1.02).
   - Capped at 1.15.
4. For g ∈ {physical, mental}: `ΔD_g = min(2.5, k × pace × usage × race.growthMult[g] × emphasis_g × traitDev_g(humanAge) × mentor)`, then `D_g += ΔD_g`.
5. Wear, per stat: `wear += 100 × d_g(floor(humanAge) − declineShift) × k × race.declineMult[g] × traitDecline × (physWear if physical)`.
6. Recompute effective stats, rating and potential. Record per-stat display deltas, the rating delta, "potential reached" = rating ÷ potential, and the new peak rating.
7. Trait checks (sys-traits gain and loss), captaincy recompute, then age +1.

**Trend (live during the season):**
- The projected rating change at season end, assuming XP per week so far continues: projected seasonXp = seasonXp × 19 ÷ matchweeks elapsed.
- Labels: **Surging** (≥ +3), **Improving** (+1…+2), **Holding** (0), **Slipping** (−1…−2), **Fading** (≤ −3), each with an arrow icon.
- Shown on the roster list and the fighter card as "Trend ↑ Improving: at this playing time he gains about 2 rating by season end".

**Season development report (season-end review screen):**
- Per fighter: rating before → after, the per-stat deltas (display points, plus progress pips), potential and "potential reached %", season XP ÷ 360 and usage %, emphasis shares, mentor bonus, traits gained or lost, and wear added.
- League-wide: biggest risers and fallers, and fighters who announced a final season.

**Player information before the action:** the lineup screen shows each fighter's season XP bar and trend, so benching a prospect visibly costs development.

**Cancellation:** emphasis can change any week. Development is committed only at season end.

**Edge cases:**
- A fighter who changes clubs mid-season keeps his season XP. Mentoring is pro-rated per club and captain.
- Injured weeks earn no XP.
- An emphasis set while injured still counts toward fBody and fMind.
- D cannot decrease.
- A cap reduced by a scar is fine: developed values follow the new cap.

**Interactions:** sys-injury (injured weeks cost XP), sys-captaincy (mentoring), sys-traits (devClock, xp, emphasis), sys-academy (FUTURE: program XP per week is added to seasonXp and may add a program-specific ΔD; on call-up, academy XP stops and accrued XP is kept, per open-003 working assumption).

**FUTURE hooks:**
- Rule slots (M3, P-07): slots = clamp(4 + floor(careerRounds ÷ 100), 4, 8) + trait ruleSlots (max 12).
- Fog (M4): pace hidden until one season at the club; "trend" stays visible (it is observed).

**Worked example: four careers (EXAMPLE; Oathguard template, P 70, steady pace, starts every round, headline caps STR 16 and CMP 14, race tendencies left off the two headline stats).**

| Fighter | Age (human-age) | STR shown (base) | CMP shown (base) | Rating / potential | Retirement chance |
| --- | --- | --- | --- | --- | --- |
| Human | 18 (18.0) debut | 9 (9.60) | 7 (7.98) | 43 / 72 | 0% |
| Human | 22 (22.0) | 12 (12.64) | 9 (9.80) | 55 / 72 | 0% |
| Human | 28 (28.0) | 16 (16.00) | 11 (11.76) | 69 / 72 | 0% |
| Human | 34 (34.0) | 14 (14.80; wear 1.2) | 13 (13.16) | 67 / 72 | 12.0% |
| Human | 40 (40.0) | 9 (9.80; wear 6.2) | 14 (14.00) | 50 / 72 | 73.0% |
| Elf | 30 (20.0) | 11 (11.20) | 9 (9.02) | 48 / 70 | 0% |
| Elf | 42 (28.0) | 16 (16.00) | 12 (12.02) | 68 / 70 | 0% |
| Elf | 60 (40.0) | 10 (10.00; wear 6.0) | 14 (14.00) | 49 / 70 | 62.4% |
| Orc | 20 (25.0) | 14 (14.62) | 10 (10.67) | 65 / 74 | 0% |
| Orc | 26 (32.5) | 15 (15.63; wear 0.38) | 12 (12.58) | 71 / 74 | 6.0% |
| Orc | 32 (40.0) | 10 (10.25; wear 5.75) | 13 (13.72) | 53 / 74 | 77.5% |
| Ashkin | 16 (24.6) debut | 14 (14.26) | 10 (10.72) | 62 / 73 | 0% |
| Ashkin | 20 (30.7) | 16 (16.00) | 12 (12.28) | 70 / 73 | 0% |
| Ashkin | 24 (36.9) | 13 (13.54; wear 2.46) | 13 (13.31) | 63 / 73 | 39.8% |

*Arithmetic for the human at 34.*
- D = 34, so M_physical = 1.00 and developed STR = 16.00.
- Wear = 0.3 (season at 31) + 0.4 (at 32) + 0.5 (at 33) = 1.2, so base = 14.80, which shows 14.
- Mental: M(34) = 0.94, so CMP = 14 × 0.94 = 13.16.
- Retirement: h(34) = 0.15, × 0.8 for usage ≥ 0.75 = 12.0%.

*Elf at 30.*
- Debut at 28 with D = 18.67; k = 0.667, so ΔD_physical = 0.667 per season. After 2 seasons, D_physical = 20.0, so STR = 16 × 0.70 = 11.2.
- ΔD_mental = 0.667 × 1.1 = 0.733 per season, so D_mental = 20.13: CMP = 14 × 0.6446 = 9.02.

*Orc at 26.*
- D_physical is past 28. Wear from the season at 25 (human-age 31.25) = 0.3 × k 1.25 = 0.375, so STR 15.63.

*Pace and playing time (same human, debut 18 at D = 18), STR at age 28:*
- Rapid (1.3): D reaches 28 at about 25.7. STR 16, with a long peak plateau.
- Slow (0.75): D = 25.5 at 28. STR = 16 × 0.9225 = 14.76, and it reaches the cap only at about 31, just as decline starts.
- Steady but never played (usage 0.2): D = 20 at 28. STR = 11.2. The wasted prospect is visible as "potential reached 70%".

**Acceptance cases:** dev-001 to dev-009.

---

### sys-development: aging, decline and retirement (the brief's sys-aging)

**Status / scope:** "Physical ability peaks around 28 for humans, scaled by lifespan" and "mental skills do not decline until about 60 for humans" are REQUIRED (O11). Whether mental decline scales by race is OPEN (open-025, owner confirmation C-1). Retirement on by default is PROPOSED (P-10). Numbers are TUNABLE. M1.

**Decline (wear), points per human-year**, looked up at floor(human-age during the season) minus any trait declineShift. Per season the value is multiplied by k and the race decline multiplier.

| Human-age | ≤ 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | ≥ 38 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Physical | 0 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 | 1.0 |

- Mental stats: 0 before human-age 60, then 0.1 per human-year at 60–64, 0.2 at 65–69 and 0.3 from 70.
  - With `mentalDeclineScalesWithLifespan` = true (recommended), the human-age is used.
  - With false, the absolute age 60 is used for every race, and k is not applied.
- Cumulative physical wear for a human: 1.2 points by 34, 4.5 by 37, 6.2 by 40.
- Because the mental curve keeps rising until D = 40, veterans gain composure, leadership and awareness while their bodies fade. That is what makes them good captains.
- **Merge note for combat:** arc, spi and wil are mental. Casters and healers therefore peak later (about human-age 34–38) and lose little in-career.

**Retirement (stream `retirement`):**
1. Chance (computed live all season, shown on the card as "Retirement chance this season: 12%"):
   - 0 if human-age < 31.
   - 100% if human-age ≥ 41, or the fighter has a career-ending injury or a final season.
   - Otherwise `p = 1 − (1 − h)^k` with h by floor(human-age): 31: 3%, 32: 6%, 33: 10%, 34: 15%, 35: 22%, 36: 31%, 37: 42%, 38: 55%, 39: 70%, 40: 85%.
2. Modifiers, applied in order:
   - Multiply: usage ≥ 0.75 → ×0.8; usage ≤ 0.30 → ×1.5. No contract for next season → ×1.5. A contract running past this season → ×0.6. Trait multipliers (Glory-Hungry 0.8, Weathers Well 0.85, Keeps the Edge 0.9, Idle Hands 1.2).
   - Add: +3 points per scar; +5 points if average physical wear ≥ 2.4.
   - Clamp to 0–100%.
3. **Final season.** At P1, a fighter whose chance (computed with usage 1.0 and the current contract) is ≥ 60% announces a final season. He gets status `final_season` (+1 composure, "farewell tour") and retires at season end for certain.
4. **Roll at season end** in step "retirements". A retiring fighter's contract ends with no payout (economy). He leaves a career record (history) and, FUTURE, may become staff (P-10).
5. **Leaving the league.** A free agent unsigned at 2 consecutive season ends leaves the league. This is pool maintenance, not counted as a retirement for intake.

**Distributions (soak model, starters under contract):**

| Race | Retirement age p10 / median / p90 |
| --- | --- |
| Human | 33 / 36 / 39 |
| Elf | 50 / 55 / 59 |
| Dwarf | 30 / 33 / 36 |
| Orc | 27 / 29 / 32 |
| Ashkin | 22 / 24 / 26 |

**Player information:** the age bar on the fighter card has "rising / prime / declining" zones for his race, a retirement-chance badge from human-age 31, and the final-season status. A league digest at P1 lists final-season announcements.

**Edge cases:**
- Retirement is never mid-season, except that a career-ending injury removes the fighter from play at once (he retires at season end).
- A fighter retiring with pending offers: the offers void (economy).
- A free agent's chance uses "no contract next season".
- A human-age of 40.9 is still below 41: chance 85% base.

**Worked example (EXAMPLE).** A dwarf aged 32 (human-age 35.5, floor 35), usage 0.6, an expiring contract not renewed, 1 scar:
- h = 0.22 and k = 1.111, so p = 1 − 0.78^1.111 = 24.1%.
- × 1.5 (no contract) = 36.2%.
- + 3 (scar) = **39.2%**.
- Average wear is 1.7 points, below the 2.4 that would add 5 points.

**Acceptance cases:** age-001 to age-003, ret-001 to ret-005.

---

### sys-injury: the injury ladder

**Status / scope:** the ladder, with AI-equal rates, is PROPOSED (P-11). "Long-lived races more injury-prone, orcs and dwarves more durable" is REQUIRED (O11). Numbers are TUNABLE. M1. The "form loss" rung of P-11 is the **knock** in M1, because M1 has no form model.

**Purpose:** stakes that never feel arbitrary. The odds are shown before every match, the worst outcomes need visible warning signs, and the commonest result is "misses one match".

**Inputs (per fighter per round started, from combat results):** downed (yes/no), damage taken, max HP, round index. Fighter state: effective durability (tgh), race, human-age, traits, statuses.

**Resolution procedure (stream `injury`, keyed by fixture, round and fighter):**
1. After each round, for each fighter who started it and has no new injury this match:
   - `p = (0.4% + 1.4% × min(2, damageTaken ÷ maxHp) + 1.3% × [downed])`
   - `× durabilityMult` = clamp(1 + (10 − tgh) × 0.05, 0.6, 1.4)
   - `× race.chanceMult × ageMult` (human-age < 30: 1.0, 30–32: 1.1, 33–35: 1.25, ≥ 36: 1.4)
   - `× trait multipliers × Still tender 1.25`
   - capped at 15%.
2. Roll. On an injury, draw the severity from weights knock 62, minor 24, moderate 10, serious 4.
   - Shift for a heavy hit (downed and damage ≥ 100% of max HP): knock −6, moderate +4, serious +2.
   - Shift for human-age ≥ 33: knock −5, moderate +3, serious +2.
3. Duration in weeks out:
   - Knock: exactly 1, meaning he misses the next match.
   - Minor: 2–3. Moderate: 4–6. Serious: 8–14.
   - Non-knock durations × race.recoveryMult × age (human-age ≥ 32: 1.15; ≥ 35: 1.30) × trait recovery, rounded half up, minimum 1.
4. Scar roll, moderate and serious only:
   - Chance: moderate 4%, serious 30%, × 1.3 if human-age ≥ 33, × trait and race scar multipliers.
   - A scar draws one acquired scar trait the fighter lacks (Rebuilt Knee 25, Stiff Shoulder 22, Crooked Ribs 18, Ringing Skull 15, Clouded Eye 12, Grim Visage 8).
   - 30% chance to also gain Pain-Tempered.
   - Scars are permanent and lower potential.
5. Career-ending roll, **serious only, and only if the fighter was At risk at lineup lock** (≥ 2 scars or human-age ≥ 34): 8%, with a hard cap of 0.5% per match on the combined chance. The fighter is out for the season and retires at season end.
6. **Timing.** An injury takes effect when the match ends. The fighter plays out the remaining rounds, and no further injury can be rolled for him in that match. Weeks out count down at each week processing; the off-season removes 8.
7. After a moderate or serious injury the fighter gets **Still tender** (injury chance ×1.25) for his next 2 matches started.
8. **Back from the Brink** is gained on the first round started after a serious injury.

**Expected rates (soak model):**

| Race | Injuries per 40 rounds |
| --- | --- |
| Human | 0.95–1.04 |
| Elf | 1.26–1.46 |
| Dwarf | 0.64–0.77 |
| Orc | 0.71–0.79 |
| Ashkin | 0.77–0.94 |

- Serious injuries are about 6% of all injuries (4–9% per race and seed).
- About 3–5 scars a season occur in a 24-club league, and 0.1–0.35 career-ending injuries a season (some seasons have none).

**Player information:**
- *Before (lineup screen), per fighter:*
  - "Injury risk: Average", with "about 2.1% per round, about 5% per match" from a typical round (55% downed, 60% damage).
  - Proneness index and label: race × durability × age × traits.
  - If At risk: "A serious injury could end this career: 0.07% this match", with the reason (age or scars).
- *After (match report):* each injury with the round, the cause ("downed by X after taking 118% of max HP"), the severity, weeks out, return week, pre-match odds and, for scars, the new trait and the potential change.
- *Also:* the digest, a roster medical column with countdowns, and the season review tally per club.

**Cancellation:** none. Results are committed with the match (P-05).

**Edge cases:**
- A fighter downed in round 1 plays rounds 2 and 3 (M1). Mid-match withdrawal is FUTURE.
- Two rounds rolling injuries: only the first counts.
- An injury on the last tournament week carries into the off-season.
- A knock on a bye week: the knock is used up by that week's processing, so he is fit for the next match.
- No fit fighters: hired blades (open-006, economy).

**Interactions:** sys-development (no XP while out), sys-traits (scars, recovery and injury traits), sys-captaincy (an injured captain, handover exemption), economy (contracts of career-ended fighters).

**Worked example (EXAMPLE).** An elf aged 50 (human-age 33.3), tgh 8, downed after taking 120% of max HP:
- p = (0.4 + 1.68 + 1.3)% = 3.38%, × 1.10 (durability) × 1.25 (elf) × 1.25 (age) = **5.81%** this round.
- Severity weights with both shifts: knock 51, minor 24, moderate 17, serious 8.
- If serious with 11 base weeks: 11 × 1.2 × 1.15 = 15.18, so **15 weeks**.
- Scar chance: 30% × 1.3 = **39%**.
- Career-ending: not possible, because human-age 33.3 is under 34 and he has fewer than 2 scars. The At risk badge is absent.

**Acceptance cases:** inj-001 to inj-009.

---

### sys-traits: Crusader-Kings-style traits

**Status / scope:** "randomized traits, about 80% positive and 20% negative, in Crusader Kings style" is REQUIRED (O5). Taxonomy, catalog, roll and numbers are PROPOSED (open-012), informed by research Part D. M1. Reveal tiers (M4) and academy teaching and curing (M5) are FUTURE.

**Purpose:** fighters read as people at a glance: one icon, one line and one number per trait (research D3). Traits shift numbers, development and relationships. They never take control: no trait skips, reorders or overrides a tactics rule (P-06, notes 06 pitfall 1).

**Taxonomy (6 categories):**
- **Temperament** (10): nerve, pride, sociability, ambition; opposites pairs. Changes only through listed events.
- **Physique** (12): congenital. Never gained after generation and never lost.
- **Fighting Style** (9): conditional in-fight habits (sim-applied effects).
- **Mind & Discipline** (9): learning, training, aging.
- **Leadership & Social** (8): captaincy, mentoring, chemistry, economy hooks.
- **Acquired** (12, "storied"): earned or suffered. They are not rolled and do not count toward the 4 rolled traits.

Kinds (research D3): **boon** (pure positive), **edge** (net positive with a drawback), **burden** (net negative with a real upside), **flaw** (pure negative, always curable when rolled).

| Category | Boons | Edges | Burdens | Flaws | Total |
| --- | --- | --- | --- | --- | --- |
| Temperament | 4 | 1 | 4 | 1 | 10 |
| Physique | 7 | 1 | 4 | 0 | 12 |
| Fighting Style | 4 | 1 | 3 | 1 | 9 |
| Mind & Discipline | 4 | 2 | 1 | 2 | 9 |
| Leadership & Social | 5 | 0 | 3 | 0 | 8 |
| Acquired | 6 | 0 | 1 | 5 (scars) | 12 |
| **All** | **30** | **5** | **16** | **8** | **60** |

- Rolled traits: 29 positive and 19 negative by count.
- By roll weight: positive 195 vs negative 49.5 (79.75%).
- Of negative roll weight, 80% is burdens and 20% flaws ("about three in four negatives are burdens", D3).

**Roll (stream `traits`):**
1. n = 2 (30%), 3 (50%) or 4 (20%).
2. One negative with probability 0.2 × n (40%, 60% or 80%), otherwise none.
3. Roll the negative first, then the positives. Each pick is weighted by rollWeight × raceWeight, among eligible traits only:
   - not held;
   - no opposite or exclusion either way;
   - not the same exclusiveGroup ("frame");
   - category cap of 2;
   - rookie-only traits (Green Nerves) only at human-age ≤ 21.
4. An empty pool leaves the slot empty. The polarity never swaps, so one negative at most is guaranteed.

Monte Carlo over 100,000 fighters across all races:
- Mean 2.90 traits.
- Realized positive share **79.9%** (each race 79.8–80.1%).
- 58% of fighters have one negative and 42% none; never two.
- No exclusive pair co-occurs.
- Every rarity label matches its frequency band.

**Rarity bands:** common ≥ 8% of fighters, uncommon 4–8%, rare < 4%; **storied** = never rolled.

**Effects.** Every effect type in `traits.json effectTypes` has an **owner**, which says who applies it (03 boundary contract 3):
- **Management-applied** (lifecycle and economy code, before or outside the fight):
  - stat (whole points, at most ±3 per stat; included in fight-setup stats), contextStat (tournament);
  - devClock, declineMult, declineShift;
  - xp, trainingEmphasis;
  - injuryChance, recovery, scarChance;
  - retirement, captaincy, mentor;
  - chemistry, chemistrySameRace, chemistryClash, chemistryPair, chemistryImmune;
  - ruleSlots (FUTURE);
  - economy hooks (fanAppeal, wageDemandMult, loyalty).
- **Sim-applied** (combat sys-fight-traits through `combat.json traitEffectAdapter`):
  - `combat` {when ∈ always | selfHpBelow | targetHpBelow | openingSeconds | afterSeconds | allyDown; mods ∈ damageDealtMult | damageTakenMult | reactionDelayMult | composureAdd};
  - `enemyComposureAura`, `shakenImmune`, `captainRally`.
  - Trait-sourced in-fight mods are capped by combat (`derived.traitModCaps`: ±15% fractions, ±8 composure). Every in-fight value here is at most ±10% or 3 composure.
  - Eighteen traits carry sim-applied effects.
- The sim never re-applies management stat mods (they are already in the setup stats).

**Gain and loss (all visible, with progress or odds on the card):**

| Trait | Type | Rule | When checked |
| --- | --- | --- | --- |
| Green Nerves | fades | Lost at 120 career rounds | Match end |
| Hot Blood | mellows | 15% per season from human-age 30 | Season end |
| Skittish | cured | 50% on gaining Sand-Wise | — |
| Idle Hands | cured | 25% a season after a full season under a grade-A captain with usage ≥ 0.5 | Season end |
| Flinches | cured | 25% a season under a captain of grade B or better with usage ≥ 0.5 | Season end |
| Wandering Mind | cured | 25% after a season with Mind emphasis for at least half the matchweeks | Season end |
| Glory-Hungry | satisfied | 50% when Title-Tested is gained | — |
| Sand-Wise | acquired | 300 career rounds | Season end |
| Wore the Armband | acquired | 32 matchweeks as club captain | Week processing |
| Title-Tested | acquired | Started a round of a won tournament final or of the title-clinching league match | — |
| Back from the Brink | acquired | First round started after a serious injury | — |
| Long Road | acquired | Human-age ≥ 33 and ≥ 12 pro seasons | Season end |
| Scars | acquired | Injury | — |
| Pain-Tempered | acquired | 30% alongside a scar | — |

- Physique traits never change.
- Limits: at most 4 rolled traits and 8 traits in total. An acquired trait that would exceed 8 is skipped, and the skip is logged.

**Trait catalog (60; full data in traits.json).** Effects are on the 1–20 scale. "fight:" marks sim-applied effects; everything else is management-applied.

| Id | Name | Cat. | Kind | Rarity (weight) | Effect summary |
| --- | --- | --- | --- | --- | --- |
| still_water | Still Water | Temp. | boon | common (10) | +2 composure; captaincy +3. Opposite Hot Blood |
| hot_blood | Hot Blood | Temp. | burden | uncommon (4) | −2 composure; captaincy −8; fight: +8% damage below 50% HP; mellows |
| steel_spine | Steel Spine | Temp. | boon | common (7) | +1 composure; captaincy +3; fight: immune to Shaken and ally-downed penalties |
| skittish | Skittish | Temp. | flaw | rare (2.5) | captaincy −6; fight: −3 composure for 4 s when an ally is downed; cure via Sand-Wise |
| good_company | Good Company | Temp. | boon | common (9) | +1 chemistry; captaincy +3. Opposite Prickly |
| prickly | Prickly | Temp. | burden | rare (2.5) | −1 chemistry; +8% XP; captaincy −8 |
| glory_hungry | Glory-Hungry | Temp. | edge | common (8) | +15% XP; retirement ×0.8; clashes with another Glory-Hungry (−1); captaincy −3 |
| idle_hands | Idle Hands | Temp. | burden | rare (2.5) | development ×0.85; +1 chemistry; retirement ×1.2; captaincy −5; curable |
| showboat | Showboat | Temp. | burden | rare (3) | −1 composure; captaincy −4; fan appeal +1; fight: +8% damage in the first 8 s |
| big_stage | Big-Stage Nerve | Temp. | boon | uncommon (6) | +2 composure in tournament matches |
| broad_frame | Broad Frame | Phys. | edge | common (9) | +2 power, +1 durability, −1 speed (frame group) |
| whipcord | Whipcord | Phys. | boon | common (9) | +1 speed, +1 finesse (frame group) |
| reed_thin | Reed-Thin | Phys. | burden | rare (2.5) | −2 durability, +1 finesse, injury ×1.15 (frame group) |
| granite_bones | Granite Bones | Phys. | boon | uncommon (6) | injury ×0.75, scar ×0.7. Opposite Hollow Bones |
| hollow_bones | Hollow Bones | Phys. | burden | rare (2.5) | injury ×1.3, recovery ×1.15, +1 speed |
| quick_mender | Quick to Mend | Phys. | boon | common (8) | recovery ×0.7. Opposite Slow to Mend |
| slow_mender | Slow to Mend | Phys. | burden | rare (2.5) | recovery ×1.35, scar ×0.75 |
| needle_sight | Needle Sight | Phys. | boon | common (8) | +2 precision |
| thick_hide | Thick Hide | Phys. | boon | common (8) | +2 durability |
| bellows_chest | Bellows Chest | Phys. | boon | uncommon (6) | fight: +8% damage after 30 s |
| weathers_well | Weathers Well | Phys. | boon | rare (3) | decline starts 2 human-years later; retirement ×0.85. Opposite Burns Fast |
| burns_fast | Burns Fast | Phys. | burden | rare (2.5) | development ×1.1; decline 2 human-years earlier |
| thunder_opener | Thunder Opener | Style | boon | common (8) | fight: +10% damage in the first 8 s. Opposite Cold Starter |
| cold_starter | Cold Starter | Style | burden | rare (2.5) | fight: −8% damage in the first 8 s, +6% after 30 s |
| hard_to_drop | Hard to Put Down | Style | boon | common (8) | fight: −10% damage taken below 30% HP |
| pays_it_back | Pays It Back | Style | boon | uncommon (6) | fight: +10% damage for 5 s after an ally is downed |
| smells_blood | Smells Blood | Style | boon | uncommon (6) | fight: +10% damage to targets below 25% HP |
| guard_first | Guard-First | Style | edge | common (8) | fight: −7% damage taken, −2% damage dealt. Opposite All Edge |
| all_edge | All Edge | Style | burden | rare (3) | fight: +7% damage dealt, +9% damage taken |
| flinches | Flinches | Style | flaw | rare (2) | −1 composure; fight: reaction delay ×1.06; curable under a B+ captain |
| heavy_hands | Heavy Hands | Style | burden | rare (2.5) | +2 power, −2 finesse, −1 precision |
| quick_study | Quick Study | Mind | boon | common (8) | mental development ×1.2; M3 +1 rule slot |
| regimented | Regimented | Mind | boon | common (7) | emphasis ×1.5; +1 composure. Opposite Wandering Mind |
| late_ripener | Late Ripener | Mind | edge | uncommon (5) | development ×0.85 before human-age 24, ×1.35 from 24 to 31 |
| early_spark | Early Spark | Mind | edge | uncommon (5) | development ×1.25 before 22, ×0.85 from 26 |
| student_of_sand | Student of the Sand | Mind | boon | common (7) | +1 awareness; mental development ×1.1; M3 +1 rule slot |
| keeps_the_edge | Keeps the Edge | Mind | boon | uncommon (5) | physical decline ×0.75; retirement ×0.9 |
| wandering_mind | Wandering Mind | Mind | flaw | rare (2.5) | −2 discipline; fight: reaction delay ×1.04; curable with Mind emphasis |
| green_nerves | Green Nerves | Mind | flaw | rare (3, rookies only) | −3 composure; captaincy −10; fades at 120 rounds |
| set_in_ways | Set in Their Ways | Mind | burden | rare (2.5) | emphasis has no effect; mental development ×0.9; +1 composure |
| rallying_voice | Rallying Voice | Lead. | boon | uncommon (4) | captaincy +12; fight (as acting captain): rally composure and duration ×1.5 |
| quiet_steel | Quiet Steel | Lead. | boon | uncommon (6) | captaincy +6; +1 composure. Opposite Showboat |
| shares_the_craft | Shares the Craft | Lead. | boon | uncommon (5) | young club-mates develop ×1.04; captaincy +4 |
| kin_bound | Kin-Bound | Lead. | boon | uncommon (5) | +1 chemistry per same-race fielded fighter (max +2), −1 if none |
| walks_alone | Walks Alone | Lead. | burden | rare (2.5) | captaincy −15; immune to chemistry; +1 composure. Opposite Rallying Voice |
| sharp_tongue | Sharp Tongue | Lead. | burden | rare (2.5) | −1 chemistry; captaincy −10; +1 awareness |
| counts_every_coin | Counts Every Coin | Lead. | burden | rare (2) | wage ask ×1.15 (economy); captaincy −4; +1 discipline |
| crowd_darling | Crowd's Darling | Lead. | boon | uncommon (5) | +1 composure; fan appeal +1 |
| sand_wise | Sand-Wise | Acq. | boon | storied | +1 composure, +1 awareness; captaincy +4; M3 +1 slot (300 rounds) |
| wore_the_armband | Wore the Armband | Acq. | boon | storied | captaincy +6; loyalty +1; M3 +1 slot (32 weeks as captain) |
| title_tested | Title-Tested | Acq. | boon | storied | +1 composure; +1 chemistry with 2+ holders |
| back_from_brink | Back from the Brink | Acq. | boon | storied | +1 composure; injury ×0.95 |
| long_road | Long Road | Acq. | boon | storied | +1 awareness; young club-mates ×1.02 |
| pain_tempered | Pain-Tempered | Acq. | boon | storied | +1 composure (30% with a scar) |
| rebuilt_knee | Rebuilt Knee | Acq. | flaw (scar) | storied | −2 speed, −1 finesse |
| stiff_shoulder | Stiff Shoulder | Acq. | flaw (scar) | storied | −2 power, −1 precision |
| crooked_ribs | Crooked Ribs | Acq. | flaw (scar) | storied | −1 durability; fight: −5% damage after 30 s |
| ringing_skull | Ringing Skull | Acq. | flaw (scar) | storied | −1 composure, −1 discipline; fight: reaction delay ×1.04 |
| clouded_eye | Clouded Eye | Acq. | flaw (scar) | storied | −2 precision, −1 awareness |
| grim_visage | Grim Visage | Acq. | burden (scar) | storied | −1 chemistry; fight: enemies in the melee band −1 composure |

**Player information:** each trait shows an icon, its name, a one-line flavor and an effect line (the authored `effectText`). Its kind is shown by color (boon / edge / burden / flaw). Gain and loss rules show as progress ("Green Nerves: 78/120 rounds") or odds ("may mellow: 15% this season"). M4: unrevealed traits show "?" by reveal tier; negatives are always revealed last (D3).

**Edge cases:** a trait gained that excludes a held one: acquired traits have no exclusions. A trait lost resets nothing else. A scar pool exhausted (all 6 scars held) means no new scar: the injury stays an injury.

**Worked example (EXAMPLE).** An orc rookie, human-age 20, n = 3:
- The negative roll passes (60%) and draws Hot Blood (weight 4 × orc 1.8).
- Positives: Thick Hide (8 × 2.0), then Thunder Opener (8 × 1.4). Still Water is ineligible (opposite of Hot Blood).
- Management-applied: cmp −2 and tgh +2 in the setup stats; captaincy −8.
- Sim-applied: +8% damage below 50% HP, and +10% damage in the first 8 s of a round.

**Acceptance cases:** trait-001 to trait-008.

---

### sys-captaincy: the club captain, captaincy rating and its consequences

**Status / scope:** "each club has a captain; stats, traits and skills make a fighter a good or bad captain" is REQUIRED (O6); the rest is PROPOSED (open-011). In-fight effects are applied by the sim (combat sys-fight-captain, which adopted the model below; combat.json `captain` reads `development.json captaincy.grades` and `captaincy.inFightProposal`). M1; timed calls through the captain are FUTURE (M2/M3, P-01).

**Purpose:**
- Choosing a captain is a real roster decision with a visible upside (reliability in fights, development of the young, chemistry).
- Changing it, or passing over a senior fighter, has a price.
- Captaincy improves reliability, not damage, and its effects stay small (notes 06 C8).

**Entities and state:**
- Club: `captainId`, `viceCaptainId` (optional), `captainAtLastLock`, `captainSinceWeek`, `consecutiveMatchesCaptainNotFielded`, club status `captain_departed`.
- Fighter: `matchweeksAsClubCaptain`, statuses `snubbed`, `passed_over`, `losing_the_room`.

**Captaincy rating (1–100; "CQ" in formulas).** Recomputed at every lineup lock and at season end.
- `CQ = round(0.45 × L + 0.25 × C + 0.10 × E + 0.10 × S + 0.10 × St) + youth + traits + statuses`, clamped to 1–100.
- L = effective leadership × 5; C = effective composure × 5.
- E = min(100, careerRounds ÷ 5).
- S = min(100, matchweeksAtClub × 100 ÷ 95).
- St = clamp(50 + 3 × (rating − mean rating of the club's 5 best fit fighters), 0, 100).
- youth = −10 if human-age < 22.
- Traits range from Rallying Voice +12 to Walks Alone −15. Status: Losing the Room −10.

**Grades:**

| Grade | Captaincy | Aura (sim) | Rally (sim) | Mentoring (management; young, human-age ≤ 23) | Chemistry (management) |
| --- | --- | --- | --- | --- | --- |
| A Inspiring | ≥ 85 | +2 composure | +3 composure, 5 s | ×1.08 | +2 |
| B Steady | 70–84 | +1 | +2 | ×1.05 | +1 |
| C Adequate | 55–69 | 0 | +1 | ×1.02 | 0 |
| D Shaky | 40–54 | 0 | none | ×1.00 | 0 |
| E Divisive | < 40 | −1 | none | ×0.97 | −1 |

**In fights (applied by the sim; adopted by combat):**
1. **Aura:** while the acting captain stands, every fielded ally (captain included) gets the grade's aura composure.
2. **Rally:** once per round, when the first ally other than the acting captain is downed while the captain stands, all standing allies get the grade's rally composure for 5 s, and allyDown-conditioned negative trait mods (for example Skittish) are suppressed. An unused rally carries over to a successor captain. Rallying Voice multiplies rally composure (truncated) and duration by 1.5.
3. **Captain down:** the aura ends and all allies are **Shaken** (−1 composure for 4 s). Steel Spine is immune (`shakenImmune`).
4. **Handover:** when Shaken ends, the vice-captain if fielded and standing, else the standing ally with the highest captaincy (ties: lower slot), becomes acting captain at captaincy − 10. The grade is recomputed.
5. **Cap:** captain-sourced modifiers change no combat quantity by more than 10%. Combat reports +2 composure ≈ +4% tenacity and about −0.01 s reaction delay.

Lifecycle supplies, in the fight setup: each fighter's captaincy (`captainQuality`), the lineup captain index, minus 10 at the source for an acting captain who is not the club captain, and the vice-captain index.

**Inputs and legal actions:**
- *Player:* appoint a club captain and optionally a vice-captain at any time outside a match. It is free and reversible until the next lineup lock (02 §3).
- *AI:* §5.

**Resolution procedure:**
1. **Lineup captain at lock:** the club captain if fielded; else the vice-captain if fielded; else the highest-CQ fielded fighter (ties: seniority, rating, id).
2. **Change evaluation at lock** (only if the club captain differs from the previous lock's):
   - **Snubbed** (6 matchweeks, −2 chemistry when fielded) goes to the previous captain if he is still at the club, fit, held the role ≥ 4 matchweeks, and no exemption applies.
   - Exemptions: he is injured with ≥ 4 weeks left, or in his final season, or the change is made before MW1, or he is made vice-captain at the same lock.
   - **Passed over** (6 matchweeks or until made vice-captain, −1 chemistry) goes to each fit club-mate with human-age ≥ 30 and CQ ≥ the new captain's CQ + 15 who is not vice-captain.
3. **Captain departed.** A club captain who held the role ≥ 19 matchweeks and leaves the club mid-season (sale, release or career-ending injury) gives the club `captain_departed` (4 matchweeks, −1 chemistry). The game names an interim captain (the AI rule) and flags it in the digest.
4. **Losing the room.** A fit club captain not fielded in 4 or more consecutive matches gets −10 captaincy until fielded again.
5. **Mentoring** is applied in sys-development at season end, pro-rated by weeks in the role.
6. **Wore the Armband** comes at 32 matchweeks as club captain (cumulative across clubs).

**Benched, injured, sold or stripped (summary):**
- *Benched:* the vice-captain or acting captain leads in fights, at −10. The club captain keeps mentoring and the chemistry grade term (the dressing room). After 4 straight matches he is Losing the Room.
- *Injured:* the same in fights. From 4 weeks out, the player may hand over without Snubbed.
- *Sold or released:* the role falls vacant; Captain Departed if he held it ≥ 19 weeks; an interim captain is named.
- *Stripped:* Snubbed unless exempt. Passed Over may fall on a senior fighter.

**Player information:**
- *Captain panel:* a ranked list of the roster by captaincy with the grade, a component breakdown bar ("Leadership 13 → 29 pts, composure 13 → 16, experience 7, seniority 6, standing 6, traits +12"), predicted consequences of a change ("Rook Saltmere will be Snubbed: −2 chemistry for 6 weeks"), and the in-fight effect at this grade ("Aura +1 composure while standing; rally +2 for 5 s").
- *Lineup screen:* who leads if the captain falls.

**Cancellation:** changes before a lock cost nothing.

**Edge cases:**
- No fit fighters: hired blades can be acting captain.
- Vice-captain equal to the captain: not allowed.
- A captain who is Snubbed elsewhere: statuses travel with the fighter.

**Worked example (EXAMPLE).** A veteran with leadership 13, composure 12 (+1 Quiet Steel = 13), 350 career rounds, 60 matchweeks at the club, rating 68 against a top-5 mean of 66, Quiet Steel and Wore the Armband:
- 0.45 × 65 = 29.25; 0.25 × 65 = 16.25; 0.10 × 70 = 7; 0.10 × 63.2 = 6.32; 0.10 × 56 = 5.6.
- Sum 64.42, rounded to 64; + 6 + 6 = **76**: **B Steady**.
  - In fights: aura +1 composure, rally +2. As an acting captain he would play at 66, still B.
  - Off the fight: young club-mates ×1.05, chemistry +1.
- By contrast, a 22-year-old orc with Hot Blood (leadership 8, composure 6, 120 rounds, 19 weeks at the club) comes to 35 − 8 = **27**: **E Divisive**. Aura −1 composure, no rally, young club-mates ×0.97, chemistry −1.

**Acceptance cases:** cap-001 to cap-010.

---

### sys-chemistry (new id): lineup chemistry

**Status / scope:** PROPOSED; M1 inclusion is OPEN (open-029, owner confirmation C-9). It is structural and visible, with no conversations or morale meter (P-17).

**Resolution procedure (at lineup lock, for the 5 fielded fighters):**
- chemistry = Σ trait chemistry terms + the club captain's grade term + status terms, clamped to −5…+5.
  - Trait terms: chemistry adds, same-race, clash per pair, pair bonus.
  - The captain's own trait terms count double.
  - Status terms: Snubbed −2, Passed Over −1, Captain Departed −1.
- Each fielded fighter without Walks Alone gets composure + (chemistry ÷ 2, rounded toward zero) for the match.
- `composureDivisor` = 0 disables the system.

**Player information:** the lineup screen shows "Chemistry +3 (+1 composure each)" with a line per source, recomputed live as the lineup changes.

**Worked example (EXAMPLE):**
- *The lineup:* Good Company (+1); two dwarves, one Kin-Bound (+1); two Glory-Hungry fighters (−1); a B captain (+1); the snubbed former captain fielded (−2).
- *Result:* total 0, so no composure change. Benching the snubbed fighter gives +2, so +1 composure each.

**Acceptance:** chem-001, chem-002.

## 4. Cross-system interactions

| Trigger / combination | Conditions | Resolution order | Result | Restrictions |
| --- | --- | --- | --- | --- |
| Match result → XP, injuries | Each round started | Combat result → XP per round → injury roll per round (max 1 per match) → apply after match | Season XP, injury, Still tender | Results committed with the match (P-05) |
| Injury → development | Weeks out | No rounds, so no XP | Lower usage | — |
| Scar → potential, captaincy, retirement | Scar gained | Trait added → potential recomputed → +3% retirement per scar → At risk at 2 scars | Potential ↓, risk ↑ | Scars permanent |
| Captain grade → young development | Human-age ≤ 23 | Season end, pro-rated | ×0.97…×1.08 (cap ×1.15 total) | — |
| Captain change → chemistry | At lock | Snubbed or Passed Over → chemistry | −1/−2 for 6 weeks | Exemptions listed |
| Age → retirement → intake | Season end | Development → age +1 → retire → intake = base + retirements | Steady population | Leavers not counted |
| Trait cure ↔ captain or emphasis | Season end | Check the conditions for the whole season → roll | Flaw removed | 25% |
| Career-ending ↔ captain | Club captain career-ended | Captain Departed (if ≥ 19 weeks) | −1 chemistry 4 weeks | — |
| Academy (M5) ↔ XP | Called-up and unused | 0 XP after call-up | Development stalls | O3 |

## 5. Autonomous behavior (AI clubs' lifecycle decisions)

**Status:** PROPOSED. Parity with the player (P-04). Lineups and signings are owned by sys-ai-manager (economy draft); these are the lifecycle-side policies it should use.

- **Captain:** the highest captaincy on the roster at P1 and on vacancy. The economy draft adds a 5-point hysteresis.
  - **Merge note E-6:** AI changes after MW1 trigger Snubbed unless exempt. Recommend that the AI changes only in preseason or on vacancy or a long injury.
  - Vice-captain = second-highest captaincy among projected starters.
- **Training emphasis:**
  - Human-age ≥ 31: Body (slows wear).
  - Human-age ≤ 23 with a mental-heavy class (rating weights on mental stats > 50%): Mind.
  - Wandering Mind: Mind.
  - Otherwise Balanced.
- **Resting At-risk fighters:** if a fit reserve's rating is within 3 of an At-risk starter's and the match is a league match, rest the At-risk fighter. Never in the tournament.
- **Prospects:** the economy draft's `youthMinutes` (swap in a human-age ≤ 23 prospect with potential gap ≥ 10 within 4 rating of the 5th starter) gives AI prospects rounds. Without it AI prospects stall (research B2.4, notes 05 pitfall 12).
- **No useful action:** keep everything as it is.

## 6. Content model

| Family | File | Count (M1) | Key fields | Behaviors |
| --- | --- | --- | --- | --- |
| Race | races.json | 5 | lifespan, debutAge, intakeWeight, growthMult, declineMult, statTendencies (all 12 combat stat ids), injury {chanceMult, recoveryMult, scarMult}, classAffinity (5 groups), racialFeature, namesKey | sys-races |
| Stat ids | races.json `stats` | 12 | ids (= combat.json attributes), tendencyCapPerStat 4 | sys-fighters |
| Trait | traits.json | 60 (48 rolled, 12 storied) | id, name, category, polarity, kind, rarity, rollWeight, opposites, excludes, exclusiveGroup, raceWeight, rookieOnly, flavor, effectText, icon, effects (each type has owner management or sim), gain, loss | sys-traits |
| Name set | names.json | 5 races | patterns, part lists, rules, blocklist | sys-fighters |
| Lifecycle constants | development.json | — | scale, time, potential, pace, clocks, curves, decline, xp, training, trend, retirement, injury, captaincy, chemistry, statuses, generation, soakTargets | all |
| Status | development.json `statuses` | 7 | id, label, icon, scope, duration, effects, text | sys-injury, sys-captaincy, sys-development |

**Validation (content validator, REQUIRED once approved):**
- Ids are unique.
- Opposites are symmetric and exist; excludes exist.
- Every effect type is known; every stat reference is one of the 12 combat stat ids.
- races.json `stats.ids` equals combat.json's attribute ids.
- Stat adds are integers with |add| ≤ 3; race tendencies satisfy |x| ≤ 4.
- `combat` effects use only `traitEffectAdapter` when/mod keys, with fractional mods ≤ combat's `traitModCaps`.
- Every captaincy grade has auraComposure and rallyComposure (combat reads them).
- Rolled traits have weight > 0; storied traits have weight 0.
- Every rolled flaw has a `loss` rule.
- The scar pool contains only scar traits.
- The roll-table positive weight share is 78–82%.
- O11 injury invariant relative to humans (sys-races).
- Debut ≥ 16.
- names.json has every race's key.
- The scratch validator used for this draft reports **0 errors**.

**Prototype content set:** all of the above is the M1 set. 60 icon placeholder ids `icon_trait_<id>`, status icons `status_*`, injury icons `inj_*` and trend icons `trend_*` need art (document 04).

## 7. Generation validity (in place of levels)

- **Bounded retries:**
  - Names: 20 attempts, then a numeral.
  - Trait slots: an empty pool means an empty slot.
  - World generation never fails. Any count shortfall is filled by journeymen.
- **Validity checks after generation:** caps 2–20; P 30–97; D ≥ 16; at most one rolled negative; human-age within [debut, 40] at world generation; the initial roster age mix within ±5 points of the band weights.

## 8. Balance and tuning

### 8.1 Main parameters (all PROPOSED · TUNABLE)

| ID | Meaning / unit | Initial | Range | Effect | Evidence to change |
| --- | --- | --- | --- | --- | --- |
| tune-lc-001 | Usage floor (development speed with 0 XP) | 0.20 | 0–0.4 | Value of bench fighters | Prospect stall rate; owner C-5 |
| tune-lc-002 | Season XP target | 360 | 250–500 | Playing time for full development | Must track match format |
| tune-lc-003 | Physical decline table | 0.3→1.0 per human-year from 31 | ±50% | Length of prime | Retirement age vs rating curve |
| tune-lc-004 | Retirement hazards | 3% at 31 → 85% at 40, forced at 41 | ±1 year shift | Career length | Median human 35–37 |
| tune-lc-005 | Injury base terms | 0.4% / 1.4% per max HP / 1.3% downed | ±30% | Injury frequency | 0.75–1.15 per 40 human rounds |
| tune-lc-006 | Race injury multipliers | 1.0 / 1.25 / 0.8 / 0.85 / 0.85 | 0.6–1.5 | Race trade-off | Elf:human 1.3–1.6× |
| tune-lc-007 | Career-ending chance (serious and At risk) | 8%, cap 0.5% per match | 0–15% | Stakes | 0.02–0.6 per league-season |
| tune-lc-008 | Negative chance per trait | 0.2 | 0.15–0.25 | 80/20 | O5 |
| tune-lc-009 | Captaincy weights | .45/.25/.10/.10/.10 | — | Who leads | AI captain grade mix |
| tune-lc-010 | Grade thresholds | 85/70/55/40 | ±10 | Grade meaning | 10–35% of AI captains A |
| tune-lc-011 | Mentoring by grade | 1.08…0.97 | ±0.05 | Captain off-field value | Young development spread |
| tune-lc-012 | Rookie intake base | 0.6 per club + retirements | 0.3–1.0 | Population | Pool size (economy) |
| tune-lc-013 | Pace levels | 0.75–1.30 | 0.6–1.5 | Prospect variance | Peak/potential spread |
| tune-lc-014 | Emphasis strength | +25% / −15% / wear −20% | 0–40% | Value of the setting | Usage of the setting |
| tune-lc-015 | Chemistry → composure | chemistry ÷ 2 | 0 (off)–1 | Lineup social value | open-029 |
| tune-lc-016 | Magnitude caps: race tendency per stat / trait stat add per stat | ±4 / ±3 (values used: ±1.6 / ±3) | ±2–±5 / ±2–±4 | Keep combat swings small (4% HP per tgh point) | combat balance harness (cmb-q11) |
| tune-lc-017 | Grade → aura / rally composure | A +2/+3, B +1/+2, C 0/+1, D 0/0, E −1/0 | ±1 per grade | Captain value in fights | Captain effect ≤ 10% (combat) |

### 8.2 Reference situation, risks and deliberate asymmetry

- **Reference situation:** a tier-2 club of 12 with two prospects (human-age 19–21), one veteran captain (human-age 33) and one elf (age 36) over one season.
  - A prospect starting about 70% of rounds should gain +4 to +7 rating.
  - The veteran should lose 0 to −2.
  - The elf should gain +1 to +3.
- **Dominant-strategy risks:**
  - *Always field the best five:* prospects stall. The concave usage curve and mentoring reward rotation.
  - *Elf hoarding:* injuries, slow climbs and wages limit it.
  - *Ashkin churn:* short careers, weak captains and no resale value.
  - *Captain ping-pong:* free between locks, costly across locks.
- **Snowball boundaries:** potential is fixed. A big club cannot raise its fighters above their potential; it can only give them rounds. AI clubs develop under the same rules.
- **Deliberate asymmetry:** races are not balanced per season. They are balanced over a career (a long career against a fragile one; a short career against a robust one). Mental-power classes (arc/spi/wil) peak later than physical classes (Merge note C-7).

### 8.3 Soak-test expectations (20 headless seasons)

**Status:** the targets are TUNABLE pass bands (`development.json soakTargets`). The observed column is from a **simplified scratch model**, not the real sim. It uses the real stat list, classes, curves, traits and injury rules, but abstract fights (round win chance from the lineup rating gap; downed 30% for winners and 85% for losers; damage ratios drawn uniformly). It uses a crude free-agent market and 24 clubs in 3 tiers with caps of 14/12/10 and AI "best five" lineups, over 5 seeds × 20 seasons. The real soak must be re-run on the full sim (document 05).

| Metric (season 3 → 20) | Target | Observed (5 seeds) |
| --- | --- | --- |
| Population (rostered + free agents) | drift ≤ 10% | 293–299 → 292–296 (≤ 1.5%) |
| Median human-age | 26–30 | 26.6–28.0 |
| Share human-age ≤ 22 / ≥ 31 | 15–32% / 20–40% | 19–26% / 25–38% |
| All-club top-5 rating drift | ≤ 4 points | −0.1 to −3.2 (mild; a market artifact) |
| League mean rating drift | ≤ 3 points | within ±1 |
| Highest rating in the league | ≤ 95 | 84–92 |
| Injuries per 40 rounds: human / elf / dwarf / orc / Ashkin | 0.75–1.15 / 1.1–1.65 / 0.5–0.85 / 0.55–0.9 / 0.6–0.95 | 0.95–1.04 / 1.26–1.46 / 0.64–0.77 / 0.71–0.79 / 0.77–0.94 |
| Serious share of injuries (pooled) | 4–9% | about 6% (per race-seed 4–9%) |
| Career-ending per league-season | 0.02–0.6 | 0.10–0.35 |
| Starters' peak rating ÷ potential | 0.85–0.95 | 0.91–0.94 |
| AI captain mean captaincy; grade-A share; below 40 | 65–85; 10–35%; ≤ 5% | 73–82; 4–46% (median ~30%); 0% |
| Rolled-trait positive share | 78–82% | 79.9% |

- **Pass and fail actions:**
  - Population falling: raise intake base.
  - Top-5 deflation beyond 4: tune the market or AI (economy) before lifecycle.
  - Injury band failure: tune race multipliers first, then the base terms.
  - Too many A captains: raise the grade thresholds, which does not touch combat.
- **Long-save check (C1.10):** by season 20, every world-generation fighter except some elves has retired (elves generated at human-age ≤ 22 can still be active). The league has turned over at least once.

## 9. Mechanical acceptance scenarios

| ID | Initial state | Action / events | Exact expected outcome | Rule IDs | Milestone |
| --- | --- | --- | --- | --- | --- |
| life-001 | Elf age 42; orc age 26; Ashkin age 16 | Compute human-age | 28.0; 32.5; 24.6 | sys-races | M1 |
| life-002 | Human age 30 at season end | Season-end step | Development and decline use age 30 (no wear), then age becomes 31 | sys-development | M1 |
| life-003 | Content with a race of lifespan 100 and chanceMult 0.9 (human 80, 1.0) | Validator | Rejects: longer-lived than humans but less injury-prone (O11). A race of lifespan 64 with 0.85 and one of 72 with 0.80 both pass | sys-races | M1 |
| life-004 | A race tendency of 4.5, or a trait stat add of 4 | Validator | Rejected (caps ±4 and ±3, cmb-q11) | sys-races, sys-traits | M1 |
| dev-001 | Human steady pace, 0 rounds started all season | Season end | seasonXp 0; usage 0.20; ΔD 0.20 per clock | sys-development | M1 |
| dev-002 | (M5) Academy fighter called up at MW6, never fielded | Season end | XP after call-up = 0; academy XP up to MW6 kept (open-003) | sys-development, O3 | M5 |
| dev-003 | Human, D_physical 18.00, STR cap 1,600, bloom 0, full usage | Season end | D 19.00; STR 960 → 1,040 centipoints; shows 9 → 10; report "+1 STR" | sys-development | M1 |
| dev-004 | Human D_physical 29, STR cap 1,600 | Season end | STR developed stays 1,600; no growth past cap | sys-development | M1 |
| dev-005 | Ashkin, Rapid, Early Spark, human-age 24.6 (< 22? no) → use human-age 21 orc with Early Spark, Rapid, full usage | ΔD | 1.25 × 1.3 × 1.05 × 1.25 = 2.13 (under the 2.5 cap); with Burns Fast ×1.1 = 2.35 | sys-development | M1 |
| dev-006 | Round started, side won, 1 down credit, survived | XP | 15; in the tournament 18; Glory-Hungry league 17 | sys-development | M1 |
| dev-007 | `training.enabled` false vs all fighters Balanced | 20-season run, same seed | Bit-identical results | sys-development | M1 |
| dev-008 | MW8, fighter's projected rating +3 | Roster view | Trend "Surging" ↑↑ | sys-development | M1 |
| dev-009 | Two prospects, 40 rounds available: A starts 40 / B 0 vs both start 20 | Season end | Split total ΔD (A 1.0 + B 1.0 at 260 XP each, usage 0.78 → 0.78 + 0.78 = 1.56) beats concentration (1.0 + 0.2 = 1.2) | sys-development | M1 |
| age-001 | Human human-age 31, season | Season end | +0.3 wear on each physical stat (30 centipoints); mental 0 | sys-development | M1 |
| age-002 | Human with Weathers Well at human-age 31 | Season end | Lookup at 29 → 0 wear | sys-development | M1 |
| age-003 | Dwarf age 54; scaling true / false | Season end | true: mental wear 0.1 × 1.111 = 0.11 each; false: 0 (starts at age 60) | sys-development, open-025 | M1 |
| ret-001 | Human human-age 30.9 | Retirement roll | Chance 0, no roll | sys-development | M1 |
| ret-002 | Any fighter human-age 41.0 | Season end | Retires (100%) | sys-development | M1 |
| ret-003 | At P1 chance with usage 1.0 = 62% | P1 | Status final_season, digest entry; at season end retires without a roll even if the chance has fallen | sys-development | M1 |
| ret-004 | Career-ending injury in MW10 | Rest of season | Unavailable; retires at season end; not rolled | sys-injury | M1 |
| ret-005 | Free agent unsigned at season ends S and S+1 | Season end S+1 | Leaves the league; not counted in intake | sys-development | M1 |
| inj-001 | Knock rolled in MW5 | MW6, MW7 | Unavailable at MW6 lock ("misses next match"); available MW7 | sys-injury | M1 |
| inj-002 | Injury rolls succeed in rounds 1 and 3 | Match end | Exactly one injury (round 1's); rounds 2–3 played | sys-injury | M1 |
| inj-003 | Human-age 33, 1 scar, serious injury | Career-ending check | Not rolled (not At risk); no At risk badge was shown | sys-injury | M1 |
| inj-004 | Human-age 35 (At risk), serious injury | CE roll | 8% chance; the lineup screen showed the per-match CE chance (≤ 0.5%) before the match | sys-injury | M1 |
| inj-005 | Elf human-age 35, serious, base 11 weeks | Duration | 11 × 1.2 × 1.30 = 17.16 → 17 weeks | sys-injury | M1 |
| inj-006 | 10 weeks out at the end of tournament week 3 | Season end, P1–P4 | 2 weeks after the off-season; out P1–P2; available P3 | sys-injury | M1 |
| inj-007 | Human tgh 10, downed, 110% max HP taken, human-age 27 | Chance | 3.24% (324 bp) | sys-injury | M1 |
| inj-008 | Scar Rebuilt Knee gained | After match | Speed −2 effective; potential recomputed lower; trait appears in the report | sys-injury, sys-traits | M1 |
| inj-009 | AI and player fighters with identical state | Same round data | Identical chance (P-04) | sys-injury | M1 |
| trait-001 | 100,000 generated fighters (MC) | Roll | Never 2 rolled negatives; no opposite or excluded pair; positive share 78–82% | sys-traits | M1 |
| trait-002 | Human-age 22 at generation | Roll | Green Nerves never chosen | sys-traits | M1 |
| trait-003 | Green Nerves, career rounds 119 → 121 in one match | Match end | Trait removed; notice "Green Nerves faded" | sys-traits | M1 |
| trait-004 | Hot Blood at human-age 30 | Season end | 15% removal roll; at 29.9 no roll | sys-traits | M1 |
| trait-005 | 300th career round reached in MW9 | Season end | Gains Sand-Wise at season end (not at MW9); Skittish 50% removal | sys-traits | M1 |
| trait-006 | Any fighter after generation | Any event | Physique traits never added or removed | sys-traits | M1 |
| trait-007 | Fighter with 4 rolled and 4 acquired traits gains a scar | Injury | Scar not added (cap 8); logged; the injury itself still applies | sys-traits | M1 |
| trait-008 | Combat file lacks an entry for a trait | Fight | Trait has no in-fight effect; lifecycle effects still apply (contract 3) | sys-traits | M1 |
| cap-001 | Worked example veteran | Compute | Captaincy 76, grade B | sys-captaincy | M1 |
| cap-002 | Club captain on the bench, vice fielded with captaincy 70 | Lock | Vice is lineup captain; combat receives 60 | sys-captaincy | M1 |
| cap-003 | Player changes captain A→B→A between two matches | Next lock | No Snubbed, no Passed Over | sys-captaincy | M1 |
| cap-004 | Fit captain of 10 matchweeks replaced at MW8 lock | Lock | Former captain Snubbed 6 weeks (−2 chemistry when fielded) | sys-captaincy | M1 |
| cap-005 | Captain injured 5 weeks, replaced | Lock | No Snubbed (exemption) | sys-captaincy | M1 |
| cap-006 | New captain captaincy 52; fit club-mate human-age 31 with captaincy 70, not vice | Lock | Club-mate Passed Over; making him vice-captain clears it | sys-captaincy | M1 |
| cap-007 | Captain of 25 matchweeks released at MW12 | Week processing | Club status Captain Departed 4 weeks; interim captain named | sys-captaincy | M1 |
| cap-008 | Fit club captain not fielded in MW5–MW8 | MW9 lock | Losing the Room −10 captaincy; cleared when fielded | sys-captaincy | M1 |
| cap-009 | Grade-A captain all season; young fighter human-age 21; club-mate Shares the Craft | Season end | Mentor ×1.08 × 1.04 = ×1.1232 (≤ 1.15 cap) | sys-captaincy, sys-development | M1 |
| cap-010 | AI club at P1 | AI phase | Club captain = highest captaincy (ties: seniority, rating, id); no change mid-season while fit | sys-captaincy | M1 |
| chem-001 | Worked-example lineup | Lock | Chemistry 0 → composure +0; bench the Snubbed fighter → +2 → +1 composure each | sys-chemistry | M1 |
| chem-002 | Walks Alone fighter, chemistry +4 | Lock | He gets +0 composure; the others +2 | sys-chemistry | M1 |
| gen-001 | 1,000 rookies per race | Generate | Ages within debut ranges (Ashkin 16–17, elf 28–33) | sys-youth-intake | M1 |
| gen-002 | Name collision with a living fighter | Generate | Retried; never two identical full names among living fighters | sys-fighters | M1 |
| gen-003 | Any generation | Validate | P 30–97; caps 2–20; D ≥ 16; potential within ±6 of P before traits | sys-fighters | M1 |
| gen-004 | World generation, human aged 35 | Generate | Wear = 0.3+0.4+0.5+0.6 = 1.8 on each physical stat; career rounds > 0; Sand-Wise if ≥ 300 | sys-fighters | M1 |
| gen-005 | Same career seed twice | World generation | Identical fighters, names and traits | sys-fighters | M1 |
| intake-001 | 24 clubs, 20 retirements + 1 career-ending, 6 leavers | Next-season setup | rookies = 14 + 21 = 35 (cap 38) | sys-youth-intake | M1 |

## 10. Open decisions and completion check

Links to document 01 §8.4: open-005 (training lever), open-011 (vice-captain), open-012 (traits), open-022 (medical staff), open-025 (mental decline), open-029 (chemistry). New items are in "Owner confirmations needed" below.

- [x] Every M1 action has legality, cost, result and failure behavior (emphasis, captain and vice-captain changes; everything else is automatic).
- [x] Units, timing, rounding, randomness and precedence are explicit.
- [x] Important rules have worked examples with concrete values.
- [x] Content entries refer to defined behaviors; every effect type names who applies it (management or sim).
- [x] Generation has bounded retries and fallbacks.
- [x] Tunable values are distinguished from required rules.
- [x] Combat alignment: stat ids final, rating formula confirmed, trait adapter keys and captain grades in use. Remaining combat follow-ups: C-2 doc example, C-7 caster balance.
- [ ] Real-sim soak run (document 05).

## Schema notes for the architect

1. **Fighter (lifecycle part).** Store the *inputs* and derive stats, so stats cannot drift:
   - `potentialRoll:int`, `paceId`, `cap100:Record<StatId,int>`, `bloom:Record<StatId,int>`, `dev100:{physical:int, mental:int}`, `wear100:Record<StatId,int>`.
   - `traits:{id, gainedSeason, source:'rolled'|'event'|'scar'|'worldgen'}[]`.
   - `statuses:{id, remainingWeeks?|remainingMatches?, since}[]`.
   - `injury:{severity, weeksOut, round, fixtureId, causeFighterId?, damagePct, sinceSeason, sinceWeek} | null`.
   - `trainingEmphasis`, `unsignedSeasonEnds`, `finalSeason:boolean`.
   - `career += {roundsStarted, xpTotal, proSeasons, matchweeksAtClub, matchweeksAsClubCaptain, peakRating}`.
   - `season:{xp, roundsStarted, emphasisWeeks:{balanced,body,mind}, captainWeeksByClub}`.
   - `history:{season, age, clubId, rating, potential, statsShown, xp, usageBp, injuries, traitsGained, traitsLost}[]` (one row per season).
   - The scaffold's `stats` should be a cached view (or removed). `effectiveStats(fighter, context)` is the one function combat setup, rating and captaincy call. Context = {match type, chemistry, lineup captain}.
   - The scaffold's "level-ups" is not used: XP feeds usage, plus rule slots from M3.
2. **Club:** `captainId`, `viceCaptainId|null`, `captainAtLastLock`, `captainSinceWeek`, `captainNotFieldedStreak`, `statuses[]`.
3. **Fixed-point helpers (core/util):**
   - Basis-point multiply chains, truncating once at the end of each formula (03 §1).
   - Integer linear interpolation for the maturity curves (D in hundredths, M in bp).
   - The retirement table `perSeasonBp[race][floor(humanAge)]`. Precompute it at build time into a generated JSON, or compute it with a deterministic integer exp/log, because Math.pow is not guaranteed bit-identical across engines.
4. **Streams:** use the README stream labels with path segments (season, week, fixture, round, fighter id, purpose), so that draws are independent of iteration order.
5. **Pipelines:**
   - Weekly step 3 "lifecycle": decrement injuries and statuses; check acquired traits flagged weekProcessing; captain streaks.
   - After each match: XP, injury rolls (per round, max 1), Green Nerves check.
   - Season-end steps as in §1.
6. **Content loader:** convert decimals to bp; key everything by the combat stat ids; validate per §6; derive per-race milestone ages for UI (never read the EXAMPLE `derived` blocks).
   - Fight setup (`FightFighterInput`): `stats` = management-effective integers; `captainQuality` = captaincy; side `captainIndex` and `viceCaptainIndex`.
   - The acting-captain −10 is applied by lifecycle when the lineup captain is not the club captain. The sim applies it again on an in-fight handover.
7. **Save size:** history rows are about 20 integers per fighter-season; archive retired fighters to summaries after N seasons (economy draft does the same).
8. **Tests (core/fighters README):** the acceptance table in §9 as unit tests; the trait Monte Carlo (seeded) as a property test; the soak bands as a CI job (document 05).

## Merge notes

**Combat designer (sys-combat-stats, sys-fight-traits, sys-fight-captain).** Status after combat's coordination note: stat ids final, captain model adopted, trait adapter in place.

*Who applies what (REQUIRED split once approved; 03 boundary contract 3):*

| Effect | Applied by | Where |
| --- | --- | --- |
| Base stats (caps × maturity − wear), race tendencies | Management (sys-fighters) | Fight-setup `stats` |
| Trait `stat` adds (≤ ±3), `contextStat` (tournament), status stat mods (Final season +1 cmp), chemistry composure (cmp + chemistry ÷ 2) | Management (sys-fighters, sys-chemistry) at lineup lock | Already inside fight-setup `stats`; the sim must not re-apply them |
| Development, wear, XP, injury chance, recovery, scars, career-ending, retirement, captaincy, mentoring, chemistry terms, rule slots, economy hooks | Management (sys-development, sys-injury, sys-traits, sys-captaincy, sys-chemistry; economy for hooks) | After the match or at season end, from combat's round results |
| Trait `combat` effects (Hot Blood, Showboat, Bellows Chest, Thunder Opener, Cold Starter, Hard to Put Down, Pays It Back, Smells Blood, Guard-First, All Edge, Flinches, Wandering Mind, Crooked Ribs, Ringing Skull, Skittish) | Sim (traitEffectAdapter) | In fight |
| `shakenImmune` (Steel Spine), `enemyComposureAura` (Grim Visage), `captainRally` (Rallying Voice) | Sim | In fight |
| Captain aura (grade.auraComposure), rally (grade.rallyComposure, 5 s, once per round), Shaken (−1 cmp, 4 s), handover (vice-captain, else highest captaincy, −10) | Sim (sys-fight-captain) | In fight |
| Choice of lineup captain and vice-captain; captaincy value and grade; the −10 for a non-club-captain lineup captain | Management (sys-captaincy) | Fight setup (`captainIndex`, `viceCaptainIndex`, `captainQuality`) |

- **C-1 Stat ids.** All lifecycle data is now keyed by the final ids (str agi pac tgh pre arc spi wil cmp ldr awr dis). combat.json's `lifecycleTag` fields are no longer read by lifecycle, so they may stay as documentation or be removed. The old `dis` tag "focus" no longer matters.
- **C-2 Magnitudes (cmb-q11), applied.** Race tendencies are capped at ±4 per stat; the values used are at most ±1.6 (elf tgh −1.6 ≈ −6% max HP). Trait stat adds are capped at ±3; the values used are at most ±3 (Green Nerves cmp −3). Fragility lives in injury multipliers. **Please update** the 03-combat.md sys-fight-traits example (Skittish is now −3 composure for 4 s, not −8) and the cmb-c2 text.
- **C-3 Trait combat effects** are in `traits.json` as `combat` / `shakenImmune` / `enemyComposureAura` / `captainRally` effects, using your adapter's keys (`allyDown`, `openingSeconds`, `afterSeconds`, `selfHpBelow`, `targetHpBelow`, `always`; damageDealtMult, damageTakenMult, reactionDelayMult, composureAdd). Each in-fight value is at most ±10% or 3 composure. Grim Visage uses `rangeBand: "melee"`.
- **C-4 Captain inputs.** `development.json captaincy.grades` carries auraComposure and rallyComposure on the new thresholds (A ≥ 85, B 70–84, C 55–69, D 40–54, E < 40). `captaincy.inFightProposal` is kept under that name because combat.json references it. Captaincy is 1–100 (your input allows 0–100).
- **C-5 Results needed per fighter per round:** started; downed; damage taken; max HP; downs credited; side won; and the match's competition type. This is contract 2.
- **C-6 Rating:** confirmed identical (combat §2 item 12).
- **C-7 Mental-power classes.** arc, spi and wil are mental (O11), so casters and healers peak later (human-age about 34–38) and barely decline in-career. Please run the balance harness on veteran casters.
- **C-8 Generation uses `statEmphasis`** for cap offsets and `affinityGroup` for race affinity. Please keep both fields.

**League/economy designer (sys-contracts, sys-transfers, sys-ai-manager, sys-roster):**
- **E-1 Inputs I provide:** age, humanAge, lifespan, rating, potential, trend, pace (hidden from M4), injury proneness index and label, At risk, retirement chance, final_season, career seasons left to decline = max(0, ceil((31 − humanAge) × lifespan ÷ 80)), trait polarity and kind, and the economy hooks:
  - fanAppeal: Showboat +1, Crowd's Darling +1.
  - wageDemandMult: Counts Every Coin 1.15.
  - loyalty: Wore the Armband +1.
- **E-2 Intake.** `generation.intake` = round(clubs × 0.6) + retirements, clamped to [0.5, 1.6] × clubs. Your draft says "about 24 + exits": with 48 clubs it is 29 + retirements, and leavers are excluded.
- **E-3 Retirement with contract years left:** chance × 0.6. If he retires, the contract ends without payout (your step 7). The career-ending contract outcome is yours.
- **E-4 Leaving.** A free agent unsigned at 2 consecutive season ends leaves. This is already in your step 12.
- **E-5 Quality shifts** for world generation, journeymen and hired blades are yours. Calibrate them so tier rosters meet the 03 §1 bands. My soak used +8/+4/0 and gave top-5 lineups of about 68/58/52.
- **E-6 AI captain changes after MW1** trigger Snubbed unless exempt. Recommend AI changes only at P1–P4 or on vacancy or an injury of 4+ weeks. Also add the vice-captain to the AI lineup rule (my JSON `captaincy.viceCaptain.aiPolicy`).
- **E-7 AI training emphasis and resting At-risk fighters** (§5). Please fold them into sys-ai-manager's weekly phase.
- **E-8 Hired blades:** `generation.hiredBlade` hook.

**Lead designer (01, 02, 03, 04):**
- **L-1 Register sys-chemistry** (or fold it into sys-captaincy) and record the open-029 decision.
- **L-2 Training emphasis** as a standing setting in M1 (cuttable by a flag), against open-005's "no weekly training lever".
- **L-3 P-11's "form loss" rung** is the knock in M1.
- **L-4 Season-end step 5 detail:** development and decline use the pre-increment age; the retirement chance is computed then and rolled in step 6; final-season announcements at P1.
- **L-5 Glossary additions:** human-age, development pace, training emphasis, trend, wear, captaincy grade, vice-captain, acting captain, chemistry, At risk, knock, scar, Still tender, Snubbed, Passed Over, Losing the Room, Captain Departed, final season, storied trait, boon/edge/burden/flaw.
- **L-6 Document 04 surfaces:**
  - the fighter card age bar with race zones;
  - stat bars with cap ticks and wear hatching;
  - the trend arrow;
  - the season development report;
  - the injury block with odds on the lineup screen;
  - the captain panel;
  - the chemistry readout;
  - trait chips colored by kind.

## Owner confirmations needed

Each item has my recommendation. "C-n" labels are cited in the text above.

| ID | Question | Recommendation |
| --- | --- | --- |
| C-1 (open-025) | Does mental decline (human baseline 60) scale with lifespan? | **Yes, scale it** (elf 90, dwarf 54, orc 48, Ashkin 39). One rule for every race, and mental decline never touches a playing career, so veterans keep their value as captains and mentors. *Alternative:* a fixed 60 makes elves lose mental sharpness in their last seasons, which sharpens the cost of long careers. One flag switches it |
| C-2 | Dwarves shorter-lived than humans (72)? | **Yes**, the literal reading of O11 ("orcs and dwarves live shorter but are more durable"). If you meant "shorter than elves", the alternative is 100 with durability as a deliberate exception to "long-lived = fragile" |
| C-3 | Keep the original 5th race, the Ashkin (lifespan 52, about 8-season careers, near-peak at debut)? | **Keep.** It adds a "win-now rental" archetype the four required races lack. It can be cut by deleting one entry; nothing depends on it |
| C-4 | Career lengths: elf about 25 seasons, human about 18, dwarf about 17, orc about 13, Ashkin about 9. Is the elf length OK for long saves? | **Accept.** Elves pay with a slow climb and about 1.4× injuries, and the league still turns over within 20 seasons. Lever if not: raise the elf injury multiplier or shorten the elf lifespan to 110 (peak 38.5) |
| C-5 | An unused fighter gets 0 XP (O3) but still matures at 20% speed. Floor 0.20, or 0? | **0.20.** With 0, a benched teenager freezes entirely, which reads as a trap (research B2.4). The cost of not playing stays large: 0.2 vs 1.0 |
| C-6 | Is "80/20" counted by traits, with at most one negative per starting fighter? | **Yes:** 58% of fighters carry one negative and none carry two. Most negatives are trade-offs, and every rolled pure flaw is curable (research D3) |
| C-7 | Scars permanent (your ladder), or treatable in the academy (research D3)? | **Permanent in M1.** Revisit at M5: an academy "rehab" term could soften one scar (halve its penalty), but not remove it |
| C-8 | Career-ending only for fighters visibly At risk (2+ scars or human-age 34+), 8% of their serious injuries, capped at 0.5% per match? | **Yes.** It is rare (about one every 3–10 league-seasons), always preceded by a visible warning, and the odds are shown |
| C-9 (open-029) | Lineup chemistry in M1 (structural, one number, at most ±2 composure)? | **Yes.** Cheap, explainable, and it gives traits and captain changes a social channel. One flag turns it off |
| C-10 (open-005) | Training emphasis (Balanced / Body / Mind) as a standing per-fighter setting in M1? | **Yes.** Set once, not a weekly chore; it gives veterans and young fighters a real lever. The flag turns it off and the result is bit-identical to no training |
| C-11 | Captain-change costs (Snubbed, Passed Over, Captain Departed, Losing the Room)? | **Yes.** They make the captaincy matter without a morale meter, and changes between matches stay free |
| C-12 | Poor captains actively hurt (grade E: aura −1 composure, no rally, mentoring ×0.97, chemistry −1)? | **Yes.** O6 says a fighter can be a *bad* captain; the penalty is small and shown before you appoint |
| C-13 | A debut-age floor of 16 for every race? | **Yes**, to avoid child fighters. It is why the Ashkin arrive near their peak |
| C-14 | A knock always misses the next match (no "play through it" in M1)? | **Yes.** FUTURE: let the player field a knocked fighter at ×2 injury chance, with the odds shown |
