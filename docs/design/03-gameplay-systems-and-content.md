# Arena League — gameplay systems and content

> ARENA LEAGUE DESIGN PACKAGE · DRAFT v0.7 · 2026-10-27. §1–2 were written by the lead designer (phase 1). §3–10 merge the three phase-2 drafts (`_drafts/03-combat.md`, `_drafts/03-fighter-lifecycle.md`, `_drafts/03-league-economy.md`) and resolve their conflicts using decisions D-A to D-I, which were made under delegation (document 01 §8.2). **v0.3 is the M1 doc sync:** values now match `content/default` on main @ f4b39d9 after combat balance pass 1 (1597f1d), the tuning pass (m1/fix-tuning) and the core fix round (m1/fix-core), and decisions D-N to D-T are folded in. **v0.4** adds the QA polish round (m1/polish-core @ 60ccdd1, m1/polish-ui @ c35d12a; main tagged `m1-season-mvp` @ 3e682d5). M1 was built at risk on these working assumptions under the owner's goal (01 §8.5). **v0.5 folds in M1.1 "Playtest round 1"** (01 §5): the owner's tickets AL-R001-T001 to T005 and answers (O15–O22), the designers' drafts `_drafts/m1.1/progression.md` v0.2 and `_drafts/m1.1/combat-skills.md` v0.2 with their content, and the architect's addendum (05 §9.3); the designers' remaining choices were recorded as D-U to D-Z (01 §8.2, batch D) and are now confirmed by the owner (O25). **v0.7 syncs to main @ d440107** (M1.1 plus the R002 playtest fixes): the box score with damage and healing received, the effective rating at a Freshness, the true reserve swap, and renewals judged on next season's wage room (O27–O32); and it records the owner's answers of 2026-10-27: the owner's words that fighter levels stay as total stat points (O23; open against the build's level counter, open-034, Q52), the compaction rule for AI-vs-AI results (O24), D-U to D-AE confirmed (O25) and the rank, perk and tiredness proposals approved (O26). **v0.6 recorded M1.1 as built** (main @ 293f49a, tag `m1.1-playtest-r1`): the combat and the leveling and pool tuning, the hardened rank and swap rules, the report additions, the soak evidence and decisions D-AA to D-AE. Two reviews have run (01 §8.6); the owner has not approved the package as a whole.
> Follow the labels, scope, glossary, and authority rules in [document 01](01-game-vision-and-design-principles.md).
> This document owns mechanical truth. [Document 02](02-player-experience-and-game-flow.md) owns when systems appear in the player journey. [Document 05](05-technical-design-principles-and-build-plan.md) owns how their state and implementation are organized.

| Field | Value |
| --- | --- |
| Game / version / updated | Arena League / v0.7 / 2026-10-27 |
| Status / design owner | Draft v0.7: all sections written for M1 and M1.1 and synced to the build on main @ d440107 (M1.1 plus the R002 fixes) and to the fix branches `m1.1/save-trim` and `m1.1/ki-fixes`, which merge with this documents branch (1,093 tests and the 10-season soak at 14/14 were measured on main @ 293f49a and not re-run for this documents-only pass) / the project owner |
| Milestone covered | M1 "Season MVP" (O14; scope D-N) in full, and M1.1 "Playtest round 1" (O15–O22) as built, with the R002 playtest fixes (O27–O32): the M1.1 parts are marked in place. Later systems are tagged with their milestone in §2 and summarized in §3.5 |
| Content source of truth | `content/default/`: `combat.json`, `classes.json`, `abilities.json`, `tactics-presets.json`, `races.json`, `traits.json`, `names.json`, `development.json`, `leagues.json`, `clubs.json`, `economy.json`; from M1.1 also `levels.json`, `perks.json` and `ability-ranks.json`. Where this text quotes a number, it is the working value on main @ d440107 (content unchanged since 293f49a, except the Last Wall shield and the `leagues.json` `matchRecords` block on the fix branches; v0.7 sync). **The data file holds the working value**; a disagreement between text and data is a defect to report, not a choice |

**Labels in this document.** REQUIRED cites an owner ID (R, T, O), and D-U to D-AE, which the owner confirmed (cited "REQUIRED (O25, D-x)"; the rank, perk and tiredness proposals are O26). **DELEGATED** cites a D-ID from D-A to D-T: a decision the orchestrator made under the owner's goal instruction. It is the binding working design, but it still awaits owner confirmation (01 §8.2). PROPOSED marks rules from the phase-2 drafts that no decision has yet covered. Every number is PROPOSED · TUNABLE unless a REQUIRED or DELEGATED rule fixes it; the numbers the owner approved (O25, O26) are TUNABLE within the bounds and tuning rules of §8. EXAMPLE, OPEN, FUTURE and PERMITTED-CHOICE are as defined in 01. **FUTURE is used only for ideas no milestone schedules**; planned work carries its milestone tag (M2–M7, D-N). Untagged prose follows its section's status line.

## 1. Mechanical foundations

**Status:** REQUIRED where an R, T or O ID is cited, DELEGATED where a D-ID is cited. Other values are PROPOSED · TUNABLE under the P-ID shown, or are OPEN working assumptions (document 01 §8). Every §3 spec uses these units and rules.

| Topic | Decision | Player-visible consequence |
| --- | --- | --- |
| Player control | Indirect only. The manager chooses the lineup of 5 (O1), the captain and vice-captain (O6), each fighter's starting row (P-03) and tactics: one per-class preset per fighter in M1 (D-N), editable rule lists from M3 (R2). From M2, up to 2 calls per round per side (P-01). The lineup, captain, rows and presets were fixed for a whole match in M1 (open-010); **from M1.1** a club names a squad of 5 starters and 2 reserves and may make at most 2 swaps per match between rounds, and a swapped-out fighter cannot return (O20). No direct control of a fighter at any milestone (01 §5 non-goal) | Every fighter action traces to a rule, the stance fallback, a status that overrides rules (taunt, stun, sleep, silence, displacement), or a call |
| Time model | **Two clocks.** *Fight time* is continuous real time simulated in fixed ticks of **50 ms (20 ticks per second)** (PROPOSED · TUNABLE, P-02, P-05; fixed per build). Kickoff is tick 0. **Overtime** begins at 45 s (tick 900) and the **hard time cap** is 75 s (tick 1,500) (DELEGATED, D-G; P-02 targets a typical fight of 20–45 s). Content times are multiples of 0.05 s, so they convert exactly to ticks. *Calendar time* moves in discrete weeks. A season is one in-game year (O3) of **23 played weeks**: P1–P4, MW1–MW16, TW1–TW3, then a season-end step that is not a week (DELEGATED, D-C; sys-calendar). Management time advances only on Continue (02 §3). Fight time never advances the calendar. From M2, viewer speed (1x/2x/4x) and pause change presentation only (T1, T4) | Decisions are made on paused management screens without time pressure. In M1 a whole match resolves at once (O12) |
| Space model | Continuous 2D top-down arena (P-03). An open rectangle **32 m × 18 m** (PROPOSED · TUNABLE, width 24–40 m, height 14–22 m) with walls and no obstacles, hazards, summons or neutral units (open-019, adopted under D-G). The origin is the north-west corner, x points east and y south. The home side starts west and the away side east, each with a **front row** and a **back row** (sys-arena). Fighters are circles of radius **0.5 m**. **Gap** = centre distance − both radii, never below 0. Every range, band and "within" test uses the gap and is inclusive (gap ≤ range). **Range bands:** melee ≤ 1.5 m, close ≤ 4 m, mid ≤ 7 m, long ≤ 10 m | "Range 6 m" means 6 m of empty ground between two fighters. Rows, spacing, kiting, bunching and flanking exist even in headless fights |
| Measurement units | *Distance:* content is in metres (`…M` keys); events and displays use integer centimetres; **sim positions and per-tick movement are integer millimetres** (DELEGATED, D-E). *Time:* integer ticks internally, displayed in seconds to one decimal. *Points:* HP, damage, healing, shields, focus, armor, ward and composure are integer points. Damage and healing are computed in centipoints and truncated once; focus is held in millipoints. **Stats:** 12 integer attributes (13 from M1.1, with `stamina`) on an **absolute 1–20 scale** (10 = average professional) shared by the whole world (P-12; DELEGATED D-G, cmb-q1). Five are **physical** (`str` Strength, `agi` Agility, `pac` Pace, `tgh` Toughness, `pre` Precision; M1.1 adds `stamina` Stamina, O19), which decline after the race-scaled physical peak. Seven are **mental** (`arc` Arcana, `spi` Spirit, `wil` Willpower, `cmp` Composure, `ldr` Leadership, `awr` Awareness, `dis` Discipline), which do not decline until about human-age 60 (O11, D-B). Lifecycle stores base stats in centipoints (100–2,000) so that growth is gradual. **Rating**, **potential** and **captaincy (CQ)** are integers 1–100. Potential is displayed as stars = potential ÷ 20 in half-star steps. *Rule thresholds:* whole percent, set in 10% steps in the editor (P-07). *Probabilities and ratios:* integer basis points (0–10,000), with content decimals converted at load (round half away from zero). *Money:* gold is an integer, displayed in the default theme as **tessels (ts)** (D-C). Wages are per week. *Contract length:* whole seasons, ending at a season end. *Age:* whole years, +1 for every fighter at season end. **Human-age** = floor(age × 800 ÷ lifespan) ÷ 10, kept in tenths. Table lookups use floor(human-age), and the per-season rate scale is k = 80 ÷ lifespan (sys-races). *Injury and assignment durations:* weeks | A stat of 12 means the same in every tier, region and race. Displayed values always equal what the rules use |
| Tier quality bands | Typical rating of a roster fighter (PROPOSED · TUNABLE, `leagues.json` tiers.ratingBand): tier 1 Crown Circuit 60–80; tier 2 Banner Circuit 45–65; tier 3 Muster Circuit 30–50. The bands overlap, and ratings outside them are rare | Promotion is a real step up in opposition, and tactics stay decisive (pillar 1, research C2.3) |
| Precision / rounding | All simulation and management arithmetic is integer, with no floating-point value in simulation state (P-05, T4; document 05 chooses the representation). Each formula rounds once, at its end, toward zero unless it states otherwise, then clamps to its stated bounds. Money formulas then floor wages and asks to multiples of 5 gold, and signing costs, payouts and prizes to multiples of 10. Distance tests are inclusive. A value exactly at a threshold satisfies "≥" and fails "<". Display rounding never feeds back into the rules. Non-integer powers (the retirement conversion) are precomputed into basis-point tables at content load, never computed with `Math.pow` at run time | Boundary cases are predictable, and identical inputs always give identical results |
| Information model | Three layers. **True state:** authoritative and read only by the systems that own it. The simulation always uses true values. **Fight-observable state:** positions, HP bars, statuses, casts in progress, class and role, the captain marker, who is targeting whom, damage dealt so far, and the deciding fighter's own focus. Rule conditions may test only this layer; no rule can read a hidden stat. **Club knowledge:** every management read of a fighter goes through `sys-knowledge.view(viewerClubId, fighterId)`. In M1–M3 it returns true values for everyone, including potential and development pace (open-026). From M4 it returns ranges and reveal steps (R3, O4, P-12). AI managers decide from their own view (P-04) | The player can always know what a rule will react to. M1 is fully transparent |
| Uncertainty | Seeded, bounded randomness (P-05; model DELEGATED, D-G). Match seed = derive(career master seed, fixture id); round seed = derive(match seed, "round", n). Fixture ids are stable (`lg:{season}:{tierId}:{weekId}:{home}:{away}`, `rk:{season}:{tierId}:{roundId}:{slot}`), so reloading and replaying with identical inputs reproduces a result (open-016). *Fight:* crit and evade use deterministic **accumulators** with a seeded starting phase; damage variance is ±4%; reaction jitter is 0–2 ticks; a seeded coin is used only as the last round tiebreak. **No random target choice and no randomness in rule evaluation** (research C1.3, P-06). *Management:* each system draws from its own named stream (`schedule`, `market`, `rookies`, `ai`, `development`, `aging`, `injury`, `retirement`, `traits`, `names`) keyed by path segments (season, week, fixture, round, entity id), so processing order never shifts a result. Random outcomes are committed at the commit points in 02 §3; reloading cannot reroll them (P-05) | Fights vary but never hinge on a streak. Every result can be reproduced from its seed and inputs. The odds shown before a match are the odds used |
| Resolution order | *Fight:* each tick runs fixed phases (sys-fight-sim). Every fighter decides from the same start-of-tick state. Effects landing on the same tick apply together, with damage and healing summed before downs are checked, so simultaneous downs are possible. Where an order is unavoidable, home acts first on even ticks and away first on odd ticks, then lineup slot order. *Calendar:* the week-processing order and the season-end order in sys-calendar. Within a step, clubs are processed in tier level order, then club id order, and free agents by market wage descending, then fighter id | No side advantage from processing order. Mutual knockouts are legal and resolved by a published rule |
| Ownership and relationships | *Fight:* exactly two sides (home = west, away = east) of 5 fighters each (O1). Allies are same-side fighters. No M1 ability has friendly fire: every area says which side it affects. *World:* a fighter is in exactly one state at a time: on one club's roster, in one club's academy (M5), a free agent, or retired. A fighter has at most one contract, and a club has at most one pending offer per fighter. A club has one manager, the player or an AI | Targeting never hits a neutral. A fighter can never be counted by two clubs or signed twice |
| Determinism scope | The same build with the same inputs gives identical results, whether headless, viewed (M2) or after save/reload (T4, vis-009). The round checksum is identical at every event-recording level. Cross-platform guarantees are defined in 05 §6 | Replays, AI-vs-AI matches and tests agree with what the player saw |

Specify the units before using numerical ranges or speeds. A value such as "range 5" is incomplete without a unit and distance definition.

## 2. System inventory

**Status:** this inventory is the structure the §3 specs follow. A system's existence is REQUIRED where it implements an R, T or O ID (or a confirmed D-U to D-AE, O25), DELEGATED where a D-A to D-T decision covers it, and PROPOSED otherwise. sys-ids are stable: lowercase with the `sys-` prefix, never reused, and any rename is recorded in the 01 change record. **Spec owner** splits the work: *combat* covers everything inside a fight (arena, movement, stats in combat, classes and abilities, targeting, the rule engine and presets, playbook and calls, fighter behavior, in-fight effects of traits and captains, and match reports); *management* covers everything else. **Spec source** names the draft that was merged into §3.

| System ID | Purpose in the player experience | Depends on | First milestone | Spec owner | Spec source | Later growth (milestone tag; FUTURE = unscheduled) |
| --- | --- | --- | --- | --- | --- | --- |
| sys-fight-sim | Runs one real-time 5v5 fight on fixed ticks from kickoff to result, including overtime and the time cap, and emits the event log (R1, O1, T4) | sys-arena, sys-movement, sys-combat-stats, sys-abilities, sys-targeting, sys-tactics, sys-fight-ai | M1 (headless, O12) | combat | 03-combat | M2: the viewer renders its event stream; calls via sys-calls |
| sys-arena | Arena bounds, sides, front and back rows, spawn points (P-03) | none | M1 | combat | 03-combat | FUTURE arena variants and hazards (open-019) |
| sys-movement | Steering, separation, walls, dashes and displacement | sys-arena, sys-combat-stats | M1 | combat | 03-combat | FUTURE obstacles |
| sys-combat-stats | The 12 attributes (13 with Stamina from M1.1, O19) and their in-fight values (HP, armor, ward, speed, Power, Support, crit, evade, tenacity, resolve, focus, reaction delay); the class rating | sys-fighters, sys-races, sys-abilities | M1 | combat | 03-combat | — |
| sys-abilities | The ability schema, effect vocabulary, statuses, diminishing returns, damage and healing pipelines, and the 42 classes (O8) with 168 abilities | sys-combat-stats, sys-targeting | M1 | combat | 03-combat | M5: learned abilities (R5) |
| sys-targeting | Deterministic selectors, Only and Prefer, role references (open-024), published tie-breaks with stickiness | sys-arena | M1 | combat | 03-combat | M3: playbook focus policy |
| sys-fight-freshness | **New id (M1.1).** The in-round penalty from a fighter's Freshness at each round start (O19) | sys-freshness | M1.1 | combat | m1.1/combat-skills | — |
| sys-ability-ranks | **New id (M1.1).** Ranks 1 → 3 for every active and passive ability, offered at level-ups (O18) | sys-abilities, sys-development | M1.1 | combat | m1.1/combat-skills | — |
| sys-perks | **New id (M1.1).** 72 permanent perks, eligibility, cap and exclusions, offered at level-ups (O18) | sys-abilities, sys-development | M1.1 | combat | m1.1/combat-skills | Respec (FUTURE) |
| sys-tactics | The rule engine (ordered IF/THEN lists, stance fallback, reaction delay, traces) and the **105 per-class presets selectable per fighter** (R2, P-06; M1 scope D-N) | sys-targeting, sys-abilities | M1 (presets only, D-N) | combat | 03-combat | M3: editable lists, rule groups, "jump to" (P-07) |
| sys-fight-ai | Execution beneath the rules: approach, kite, hold, protect, regroup, stances, anti-stuck (research C2.1) | sys-tactics, sys-movement | M1 | combat | 03-combat | — |
| sys-fight-traits | In-fight effects of traits (O5) through the trait-effect adapter | sys-traits, sys-combat-stats | M1 | combat | 03-combat | Grows with the trait catalog |
| sys-fight-captain | The captain in the fight (O6): aura, rally, captain down, handover, captain's target | sys-captaincy, sys-tactics | M1 | combat | 03-combat | M2: calls go through the captain |
| sys-match | Best-of-3 or best-of-5 matches (P-02), round seeds (P-05), per-round reset, the results contract; from M1.1 squads of 5 + 2, swaps between rounds and the between-round step (O20, O25, D-U, D-V) | sys-fight-sim, sys-freshness, sys-injury, sys-roster | M1 (squads M1.1) | combat | 03-combat; m1.1/combat-skills | M2: replays. M3: between-round edits, sandbox, post-match re-runs (P-13) |
| sys-match-report | Event stream, decision traces, recaps and death summaries; the M1 match report (O12, P-22) | sys-fight-sim, sys-tactics | M1 | combat | 03-combat | M2: rule badges, inspector, replay timeline. M4: opponent values at the viewer's knowledge |
| sys-calls | Free pause-to-inspect, auto-pause triggers, the budget of 2 calls per round, call types, the AI call policy (P-01) | sys-fight-sim, sys-tactics, sys-playbook | M2 | combat | not yet written | — |
| sys-tactics-editor | Rule authoring: grammar, vocabulary, rule slots (P-07), lint (P-22), library and export codes (P-21), tactics challenges | sys-tactics, sys-development, sys-staff, sys-academy | M3 | combat | not yet written | FUTURE: Workshop sharing |
| sys-playbook | Team-level focus policy, formation, and phase switch between playbooks A and B (P-07) | sys-tactics, sys-arena | M3 | combat | not yet written | — |
| sys-theme | Loads and validates theme data: names, class and race presentation, regions, leagues, clubs, text (T5) | none | M1 | management | 05-technical (data in `content/default/`) | FUTURE: theme lexicon (open-023) |
| sys-fighters | Fighter records stored as inputs (potential, pace, caps, bloom, development clocks, wear, traits); generation for world, rookies, free agents, journeymen and hired blades; effective stats, rating and potential; names | sys-theme, sys-races, sys-traits | M1 | management | 03-fighter-lifecycle | M4: scout-reported youth |
| sys-races | Five races (human, elf, dwarf, orc, Ashkin): lifespan scaling of every age rule (O11), debut ages, growth and decline multipliers, stat tendencies (≤ ±4, D-F), injury proneness, class affinity | sys-theme | M1 | management | 03-fighter-lifecycle | M6: region-weighted race mixes |
| sys-development | XP from rounds started; from M1.1 bench XP (O17), in-season levels and level-up offers (O18), auto-pick and pacing, replacing season-end growth, usage and trend; training emphasis; mentoring; aging, decline (D-B) and retirement | sys-fighters, sys-races, sys-match, sys-traits, sys-captaincy | M1 | management | 03-fighter-lifecycle | M3: rule-slot growth. M5: academy XP |
| sys-injury | The injury ladder (P-11) from round results, with race proneness and durability (O11), recovery, scars, career-ending only when At risk, odds shown in advance; from M1.1 immediate effect and the Freshness multiplier | sys-match, sys-races, sys-traits | M1 | management | 03-fighter-lifecycle | Medical staff (open-022); M7 hardcore permadeath |
| sys-freshness | **New id (M1.1).** The Freshness meter: drain per round played, rest between weeks, labels, injury multiplier, AI rotation input (O19, O25, D-Z) | sys-fighters, sys-match, sys-injury | M1.1 | management | m1.1/progression | Preseason friendlies (FUTURE) |
| sys-traits | 60 traits (48 rolled, 12 storied): roll at about 80% positive (O5), at most one negative per starting fighter, effect ownership, gain and loss | sys-fighters | M1 | management | 03-fighter-lifecycle | M4: reveal tiers. M5: academy teaching and curing |
| sys-captaincy | Club captain and vice-captain; captaincy rating (CQ) and grades A–E (O6); lineup captain; mentoring; costs of changing captain | sys-fighters, sys-traits, sys-roster | M1 | management | 03-fighter-lifecycle | M2: calls through the captain (P-01) |
| sys-chemistry | **New id (D-D).** Lineup chemistry from traits, the captain's grade and captaincy statuses, converted to a composure modifier at lineup lock | sys-traits, sys-captaincy | M1 | management | 03-fighter-lifecycle | FUTURE: pair bonds, strain, morale (open-029) |
| sys-youth-intake | The season's rookies: count (D-H), race and age, handed to trials day (P-18) | sys-fighters, sys-races, sys-traits | M1 | management | 03-fighter-lifecycle | M4: scout-reported youth |
| sys-calendar | The 23-week season, the week-processing order, the season-end order, digest triggers (O3, O9) | sys-league, sys-tournament | M1 | management | 03-league-economy | M6: transfer windows, deadline days, cup weeks |
| sys-league | Regions; 3 tiers × 16 clubs in two 8-club wings; fixtures with no byes; standings and tiebreaks; promotion and relegation; prestige; table prizes (R4, O9, D-C) | sys-calendar, sys-match | M1 (one league region, open-027) | management | 03-league-economy | M6: 2–3 league regions (P-08) |
| sys-tournament | **The Reckoning:** the season-ending 3-round knockout of 8 clubs per tier (O9, D-C) | sys-league, sys-match | M1 | management | 03-league-economy | — |
| sys-roster | Roster cap by tier (O2), cap relief after relegation, lineup lock, from M1.1 the match squad of 5 starters and 2 reserves (O20), eligibility, hired blades (open-006) | sys-fighters, sys-league, sys-captaincy | M1 | management | 03-league-economy | M5: the academy pool |
| sys-contracts | Market wage and asks, lengths, signing costs, negotiation (one offer, one counter), renewals, releases, expiry, drop clause (O10) | sys-fighters, sys-finance | M1 | management | 03-league-economy | M6: clauses (release fee, sell-on) |
| sys-transfers | The free-agent market, open every week (P-09): pool, offers resolved at week processing, trials day, journeyman top-up | sys-contracts, sys-finance, sys-youth-intake | M1 (free agents only, D-N) | management | 03-league-economy | M4: knowledge-limited views. M6: club-to-club transfers, windows, deadline day, trust |
| sys-finance | Season budget and weekly wage budget (O10); ledger; grants, sponsors, gate, prizes; operating cost; Watch, embargo and Registry advance (open-007); soft landings | sys-league, sys-contracts | M1 | management | 03-league-economy | M6: cup prizes, transfer fees |
| sys-ai-manager | AI clubs under the same rulebook (P-04): five personalities; lineups, presets, captains, renewals, releases, offers, trials rookies, training emphasis | most management systems; sys-tactics presets | M1 | management | 03-league-economy (+ lifecycle policies) | M3: rule lists. M4: abstracted scouting. M5: academy. M6: transfers |
| sys-save | Player-facing save rules: slots, autosave points, what is restored, no reroll (R7, P-05, open-016). The persistence contract is in 05 §5 | all state owners | M1 | management | lead designer (persistence: 05) | M2: mid-fight resume. M7: hardcore ironman |
| sys-knowledge | Per-club views of fighters and opponents. M1–M3: a pass-through returning true values (open-026). From M4: baseline report (O4), ranges, reveal steps, certainty (P-12), decay and contact refresh (P-19), source labels, opponent reveal (P-13) | sys-fighters, sys-scouting | M1 (pass-through), M4 (fog) | management | lead designer (fog spec not yet written) | — |
| sys-staff | Staff market and contracts: scouts first, other roles per open-022 | sys-finance, sys-contracts | M4 | management | not yet written | — |
| sys-scouting | Scout assignments, the scouts' time budget, report accuracy from skill and region, digests (R3) | sys-staff, sys-knowledge, sys-calendar | M4 | management | not yet written | — |
| sys-academy | Programs by type, enrollment and call-up timing (O3, open-003), capacity (O2), fees, progress, graduation, risks (open-004). **M5 scope includes the R5 outcomes:** program types; growth of stats and potential; teaching new abilities and new traits (and curing flaws) | sys-development, sys-roster, sys-finance, sys-calendar, sys-traits, sys-abilities | M5 | management | not yet written | — |
| sys-cups | The regional cup, in which the underdog plays at home, and the cross-region cup (P-08) | sys-league, sys-match, sys-calendar | M6 | management | not yet written (hooks in sys-calendar, sys-finance) | — |
| sys-patron | Patron temperament, directives, patience, dismissal and job offers, legacy score (P-10, open-007). **No patron goal in M1** (D-C) | sys-league, sys-finance | M6 | management | not yet written (economy draft's M1-light goal rejected) | FUTURE: scenario challenges |
| sys-difficulty | Difficulty sliders and capped catch-up (P-14); the hardcore toggle (P-11) | sys-ai-manager, sys-finance, sys-knowledge | M7 | management | not yet written | — |
| sys-season-modifiers | One announced, opt-out league-wide modifier per season, and per-league house rules (P-16). Fight-rule modifiers are specified by combat inside sys-fight-sim and sys-abilities | sys-league | M7 | management | not yet written | — |

Systems deliberately absent from M1: loans (open-009, FUTURE); facilities; morale, strain and pair bonds beyond sys-chemistry (D-D, open-029); press (P-17); weekly training intensity (training emphasis is a standing setting, D-A); multiplayer (02 §8, FUTURE).

**Boundary contracts between spec owners.** §3 specs implement these interfaces. A change must be recorded in document 01.

1. **Fight setup (management → combat).** For each side, sys-match receives: club id; captain index and vice-captain index (or null); and for each of the 5 fighters: fighter id, class id, race id, row, slot, the 12 **management-effective** stats (base stats plus race tendencies, trait stat adds, the tournament `contextStat`, status stat modifiers and chemistry composure, already applied, so the sim never applies them again), captaincy CQ (with −10 already applied when the lineup captain is not the club captain), trait ids, preset id (from M3, a rule list) and optional race `combatMods`. Also the arena id; the home/away assignment; the fixture and round identity for seed derivation (P-05); `bestOf`; and, from M7, active season-modifier ids. AI sides arrive in the same format (P-04).
2. **Fight results (combat → management).** For each round: winner, end reason (elimination or time cap), tiebreak step if any, duration in ticks, survivors, final HP of all 10 units, rounds won and lost and downs per side, and checksum. For each fighter (`FighterMatchStats`): rounds started, ticks on the arena, downs suffered and inflicted, assists, damage dealt and taken (to HP and to shields), healing, shielding and overheal, hard control applied and received, casts per ability, rule fires per rule and for the stance, rules never fired, opponents faced, whether the side won each round, and every down with its cause (round, tick, credited unit, ability, size of the downing hit, overkill, damage taken that round, max HP). sys-league, sys-development, sys-injury, sys-match-report, sys-contracts (renewal situation) and from M4 sys-knowledge consume them. Downs are never called "kills" or "deaths".
3. **Traits and captains.** Management owns each trait's catalog entry (id, name, category, kind, rarity, roll weight, exclusions, management-applied effects, gain and loss) and the captaincy rating and grade. Combat owns the semantics of the sim-applied effect types (`combat`, `enemyComposureAura`, `shakenImmune`, `captainRally`) and the captain's in-fight effects. Every effect type in `traits.json` names its owner. A trait with no sim-applied effect is valid.
4. **XP and slots.** Combat reports participation only, and sys-development computes XP. From M3, management supplies each fighter's rule-slot count and unlocked vocabulary ids, and combat defines the vocabulary and enforces the slots.
5. **Presets.** Combat defines the presets per class (`tactics-presets.json`), and management (sys-roster, sys-ai-manager) only selects among them.
6. **Knowledge in displays.** Every management screen and every AI valuation reads fighters through `sys-knowledge.view`. Combat displays read what the viewing club knows and never read hidden true values of an opponent (from M4).
7. **Ratings** (DELEGATED, D-Q). Rating is one integer per fighter for its class, from one function, `combatRating`: clamp(round(5 × Σ ratingWeightsᵢ × statᵢ), 1, 100) on the integer effective stats (1–20) that a fight receives, with the weights converted to basis points and rounded half away from zero. Fighter ratings and potentials, market wages, AI valuations, every screen and the balance harness's OVR all call it, so the displayed rating is the rating used. The lifecycle draft's centipoint form is retired. Ratings are comparable across classes by construction (weights sum to 1.00).

**sys-id notes:** every id listed in phase 1 is kept unchanged. One id was added in the phase-2 merge: **sys-chemistry** (D-D). M1.1 (v0.5) adds **sys-freshness**, **sys-fight-freshness**, **sys-ability-ranks** and **sys-perks**. The economy draft's working name "sys-market" is sys-transfers, and the lifecycle draft's "sys-aging" is part of sys-development. Nothing has been renamed.

## 3. System specifications

Specs are grouped by owner: §3.1 combat, §3.2 fighter lifecycle, §3.3 league and economy, §3.4 supporting M1 systems, §3.5 later milestones. Every spec follows the template fields where they apply. Purely repetitive fields are omitted when the content file is the definition.

### 3.1 Combat systems

**Status for §3.1:** the combat model is DELEGATED (D-G, which adopts the combat draft's recommendations cmb-q1–q12, and D-E, D-F). Class count and structure are REQUIRED (O8), and the physical/mental split of stats is REQUIRED (O11). Coefficients and kit numbers are PROPOSED · TUNABLE in `combat.json`, `classes.json`, `abilities.json` and `tactics-presets.json`. No combat value has been validated by the balance harness yet (§8.2).

#### sys-combat-stats: attributes, derived values and rating

**Purpose:** turn a fighter's 12 attributes, class, race and traits into the numbers the fight uses, so that development and aging change fights visibly and predictably, and give the economy a per-class rating.

**Entities and state.** Twelve attributes, integers 1–20 (`combat.json` attributes). Effective values arrive in the fight setup (boundary contract 1). This system adds in-fight composure changes only.

| Id | Name | Group | In-fight use |
| --- | --- | --- | --- |
| `str` | Strength | physical | Power (class-weighted); max HP +1% per point |
| `agi` | Agility | physical | attack speed +2.5% per point; evade +1% per point above 10; Power (class-weighted) |
| `pac` | Pace | physical | move speed +2% per point |
| `tgh` | Toughness | physical | max HP +4% per point; armor +2 per point; durability input to sys-injury |
| `pre` | Precision | physical | crit +1% per point; Power (class-weighted) |
| `arc` | Arcana | mental | Power (class-weighted); Support for some classes |
| `spi` | Spirit | mental | Support (class-weighted) |
| `wil` | Willpower | mental | ward +2.5 per point; resolve +1.5% per point |
| `cmp` | Composure | mental | tenacity +2% per point; pressure reaction delay; Shaken severity; captaincy input |
| `ldr` | Leadership | mental | captaincy input |
| `awr` | Awareness | mental | reaction delay −0.01 s per point; captaincy input |
| `dis` | Discipline | mental | focus regeneration +3% per point |
| `stamina` (STA, M1.1) | Stamina | physical | **no fight formula** (O19): it acts only through Freshness (sys-freshness); rating weight 2% (O26; TUNABLE) |

Spellcraft, healing and nerve are learned, so they follow the mental curve (O11). Casters and healers therefore keep their main output longer than physical classes, which is a deliberate career asymmetry that the economy prices through rating and age.

**Formulas** (d(x) = effective attribute − 10; class base values in `classes.json` → `base`; each line truncates toward zero once at its end):

| Value | Formula | Bounds |
| --- | --- | --- |
| Max HP | base.hp × max(0.4, 1 + 0.04·d(TGH) + 0.01·d(STR)) × (1 + Σ maxHp mods) × race.hpMult | ≥ 1 |
| Armor | base.armor + 2·d(TGH) + race.armorFlat + Σ armor mods | treated as ≥ 0 in mitigation |
| Ward | base.ward + 2.5·d(WIL) + race.wardFlat + Σ ward mods | treated as ≥ 0 |
| Move speed (m/s) | base.moveSpeedMps × (1 + 0.02·d(PAC)) × race.moveSpeedMult × clamp(1 + haste − slow + Σ moveSpeed mods, 0.3, 1.6). It is 0 while rooted, stunned, asleep, anchored, displaced, or casting a non-mobile ability | — |
| Attack speed | 1 + 0.025·d(AGI) + frenzy + momentum − sluggish + Σ attackSpeed mods. Effective interval = base.attackIntervalS ÷ attack speed | interval ≥ 0.45 s; attack speed ≥ 0.4 |
| Power | base.power × (1 + 0.04 × Σᵢ powerAttrsᵢ·d(statᵢ)) × (1 + Σ power mods) | ≥ 1 |
| Support | base.support × (1 + 0.04 × Σᵢ supportAttrsᵢ·d(statᵢ)) × (1 + Σ support mods); 0 for classes without supportAttrs | ≥ 0 |
| Crit chance | 0.05 + 0.01·d(PRE) + base.critBonus + Σ crit mods (target-conditional mods evaluated per hit). Crit multiplier 1.5 | 0–0.5 |
| Evade chance (weapon blows only) | base.evadeBonus + max(0, 0.01·d(AGI)) + Σ evade mods + Evasive magnitude | 0–0.75 |
| Tenacity (shortens hard control) | 0.02·d(CMP_eff) + base.tenacityBonus + race.tenacityFlat + Σ tenacity mods | −0.25 to 0.5 |
| Resolve (shortens soft control and debuffs) | 0.015·d(WIL) + Σ resolve mods | −0.15 to 0.3 |
| Focus | max 100, full at each round start; regenerates 2.5 per second × (1 + 0.03·d(DIS)) × (1 + Σ focusRegen mods) | 0–100 |
| Reaction delay (s) | (0.30 − 0.01·d(AWR) − 0.005·d(CMP_eff) + pressure) × (1 + Σ reactionDelay mods), clamped to 0.15–0.6, then + seeded jitter of 0–2 ticks. pressure = 0.15 × (20 − CMP_eff) ÷ 19 while own HP < 35% | 3–12 ticks before jitter |
| In-fight composure CMP_eff | CMP + Σ composure mods (captain aura, rally, Shaken, trait in-fight mods, enemy composure auras) | 1–20 |
| HP regeneration | (hpRegenPct × maxHp + hpRegenFlat) per second, applied once per second as healing | — |
| Rating (1–100) | `combatRating` (D-Q): round(5 × Σᵢ ratingWeightsᵢ × statᵢ) on the integer effective stats, weights in basis points, rounded half away from zero; `classes.json` ratingWeights sum to exactly 1.00 (leadership weight 0). The same function gives potential (sys-fighters) | 1–100 |

**Modifier sums.** All modifiers to one stat are added, then the stat's clamp applies. Sources: passive stat mods (static or conditional), auras (only the strongest of the same aura ability counts), statuses (stacking rules in sys-abilities), traits (summed per stat and capped at ±0.15 for fractions and ±8 composure points, `combat.json` derived.traitModCaps) and the captain. Conditional modifiers that name a target ("against enemies below 40% HP") are evaluated per hit.

**Rating weights and stat emphasis.** Each class carries `ratingWeights` and `statEmphasis` (0.5–2.0 per stat; generation and growth bias). Both derive from what the class's formulas actually use. The JSON values are the content. **M1.1:** `stamina` joins every class at a rating weight of **2%** (the other weights × 0.98, sum exactly 1.00) and statEmphasis tank and melee 1.2, ranged 1.0, controller and healer 0.9 (REQUIRED under O26, cmb11-q4; values TUNABLE). Ratings move by a mean of 0.33 points (maximum 2); the save migration shifts each peak rating by the same amount so the change never triggers retirement.

**Integer implementation** (recommendation for 05). Coefficients become basis points at load. Attack readiness is an accumulator: each tick adds attack speed (bp); an attack is ready when the accumulator reaches base-interval ticks × 10,000, and the threshold is subtracted when the windup begins. Ability cooldowns use the same accumulator with (1 + cooldownRate) per tick. Focus is held in millipoints (2.5/s = 125 per tick).

**Player information:** the fighter page shows each attribute with its group and a hover listing what it changes, plus a derived panel (max HP, armor, ward, Power, Support, attack interval, move speed, crit, evade, tenacity, focus regeneration, reaction delay), each with a breakdown by class base, attributes, race and traits.

**Edge cases:** attributes outside 1–20 are clamped at the fight boundary. Negative armor or ward from shredding stops at 0. Attack speed has a floor of 0.4.

**Worked example (EXAMPLE).** A Knight with STR 12, AGI 9, PAC 11, TGH 14, PRE 9, ARC 6, SPI 5, WIL 10, CMP 13, LDR 11, AWR 8, DIS 10, human, no traits (balance pass 1 values: base HP 1,250, Power 72): max HP = trunc(1250 × 1.18) = **1475**; armor 60 + 8 = **68**; ward **45**; move 3.2 × 1.02 = 3.264 m/s = **163 mm per tick**; attack interval 1.3 ÷ 0.975 = **1.333 s**; Power = trunc(72 × 1.056) = **76**; crit **4%**; evade **0%**; tenacity **6%**; focus regeneration **2.5/s**; reaction delay 0.305 s = **6 ticks** (+0–2 jitter), 7 ticks below 35% HP; rating = round(5 × 11.97) = **60**.

**Acceptance cases:** cs-001 to cs-003, cmb-014 (§9.1).

#### sys-arena: arena, sides and spawn points

**Status:** PROPOSED (P-03; open-019 under D-G). Values in `combat.json` arena.

**Resolution procedure (spawn):**
1. Split each side's five fighters into front and back rows, keeping lineup slot order within each row. A row may hold 0–5 fighters. The default row is the class's `startingRow`.
2. Row x positions: home front 9 m, home back 5 m; away front 23 m, away back 27 m (a mirror about x = 16 m).
3. Row y: for n fighters in a row, fighter i (0-based, in slot order) stands at y = 9 + (i − (n − 1) ÷ 2) × 3 m. The away side uses the same y for the same index.
4. Fighters face the enemy side. Facing matters only for cones and lines, which always aim at the ability's target.

**Edge cases:** five fighters in one row span y = 3–15 m, inside the walls. An empty back row is legal.

**Worked example (EXAMPLE):** three front and two back for home: front (9, 6), (9, 9), (9, 12); back (5, 7.5), (5, 10.5). Front-to-front gap is 13 m, so two melee fighters at 3.4 m/s meet in about 1.9 s.

#### sys-movement: steering, spacing and displacement

**Status:** PROPOSED. Values in `combat.json` movement. No pathfinding exists or is needed in an open arena.

**Resolution procedure (movement phase of each tick):**
1. Each mobile fighter computes a goal from its committed action (sys-fight-ai) using **start-of-tick positions**: approach until the gap equals the action's range − 0.1 m; kite away; a protect point; a regroup point; or stay.
2. Step length = move speed ÷ 20 per tick (mm). The step points at the goal and stops exactly on it if closer.
3. **Sidestep:** if an ally's centre lies within 1.2 m ahead and within 0.9 m of the movement line, add a perpendicular component of weight 0.6 toward the side with more free space to the wall (tie: toward y = 9 m; tie: +y), then renormalize to the step length.
4. All steps apply simultaneously.
5. **Separation:** two passes over every pair (lower unit index first) of standing, non-displaced fighters whose centres are closer than 1 m: push each apart by half the overlap. A fighter that is anchored, rooted, stunned, asleep or casting is immovable, and the other takes the whole push. If both are immovable, neither moves. Coincident centres separate along y (the higher index moves +y).
6. **Walls:** clamp every centre to [0.5, 31.5] × [0.5, 17.5] m. A kiting fighter whose step is clamped slides along the wall, its blocked component replaced by a component toward the centre line.
7. **Displacement** (dash, leap, knockback, pull) overrides steps: straight-line motion at dash 16 m/s, leap 12 m/s, knockback or pull 12 m/s, until the end point, a wall, or (dash and pull) a gap of `stopGap` to the target. Leaps ignore separation while airborne. Knockback and pull distances are multiplied by the target's displacement diminishing-returns step (sys-abilities).

**Formulas:** a dash "behind" ends at target centre + unit(caster → target) × (both radii + 0.2 m), clamped. Knockback ends at target centre + unit(source → target) × distance. Pull ends at `stopGap` from the caster (or area centre), or after the full distance if shorter.

**Edge cases:** a displaced fighter cannot act; knockback and pull interrupt casts. Displacement-immune fighters (Anchored, the Harpooner's passive) ignore knockback and pull. A zero-length direction uses +x for home and −x for away.

**Acceptance cases:** mv-001 to mv-003 (§9.1).

#### sys-fight-sim: the tick loop

**Status:** PROPOSED structure; the round end, tiebreak chain, overtime ramp and randomness model are DELEGATED (D-G; cmb-q2, cmb-q4). Values in `combat.json` (tick, timing, overtime, roundEnd, randomness).

**Purpose:** run one round from kickoff to result, deterministically, and emit the event log for match reports now and the viewer from M2.

**Entities and state.** Ten units (home slots 0–4 are units 0–4, away slots 0–4 are units 5–9), each with HP, shields, focus, cooldown and swing accumulators, statuses, diminishing-returns tracks, committed and pending decision, reaction timer, cast or channel state, position, displacement, crit and evade accumulators, and damage dealt. Zones and projectiles in flight. The round clock. Pending triggered effects.

**Resolution procedure (one tick t).** order(t) = home units then away units when t is even, away then home when t is odd; slot order within a side.
1. **Timers.** Advance cooldown, swing and channel accumulators; regenerate focus; tick status durations and expire those at 0; advance diminishing-returns windows, zones, projectiles, displacements and reaction timers; recompute auras every 2 ticks.
2. **Decisions** from the start-of-tick state. Each unit in order(t) that is free (not winding up, casting, channelling, displaced, stunned or asleep) and whose decision is due (every 2 ticks, or at once after its target is downed, its action completes, or a control effect ends) evaluates its rule list (sys-tactics). A result that differs from the committed decision becomes **pending** and commits after the reaction delay. A taunted unit's decision is forced.
3. **Actions.** In order(t), units whose committed action is ready and in range start it (basic-attack windup or ability cast) and pay nothing yet. Windups, casts and channel ticks that complete this tick **release**: focus is spent and the cooldown starts. Instant effects queue for this tick's resolution. Projectiles launch with landing tick = t + ceil(gap ÷ speed × 20). Dashes and leaps start.
4. **Movement** (sys-movement), simultaneous.
5. **Resolution.** Collect every effect landing this tick: instant releases, projectile arrivals, channel and zone ticks, trap triggers, damage- and heal-over-time ticks, once-per-second regeneration, and triggered effects queued on tick t − 1. Process them grouped by source unit in order(t), then by creation sequence. Area membership and target validity use the positions after step 4. Amounts use the **start-of-tick** modifiers and shields (sys-abilities pipelines) and accumulate per target. Statuses, shields, cleanses, displacements and cooldown changes created this tick are queued.
6. **Commit.** For each unit, HP = min(maxHp, HP − Σ damage to HP + Σ healing). Then, in this order: the Deathward check; units with HP ≤ 0 are **downed**; sleep breaks; queued statuses apply (with diminishing returns, tenacity and resolve) in order(t); queued shields, cleanses and dispels apply; triggers fire and queue their effects for tick t + 1. Events are emitted in this order.
7. **End check.** If one side has no standing unit, the round ends (elimination). If both sides lost their last unit this tick, the tiebreak chain decides. If t + 1 = 1,500, the round ends by time cap.

**Timing rules:**
- *Basic attack:* ready when the swing accumulator is full and the target's gap ≤ attack range. Windup = 30% of the effective interval for melee and 35% for ranged (× (1 + windup mods)), rounded down to whole ticks, minimum 1. No movement during the windup. At release the target must still be valid and within range + 0.4 m, otherwise the attack is cancelled and the swing accumulator is refunded.
- *Abilities:* usable when off cooldown, with focus ≥ cost, and not silenced. There is no global cooldown; the reaction delay on decision changes spaces actions. `castTimeS` 0 releases on the tick it starts. During a cast the fighter is rooted unless the ability is a mobile channel. Range is checked at start and at release (+0.4 m leeway). Channels apply effects every `tickIntervalS` and end early if interrupted or the target leaves range + 0.4 m.
- *Interrupt:* stun, sleep, silence, taunt, knockback, pull and the `interrupt` effect cancel a windup, cast or channel. Nothing is spent, because focus is charged and cooldowns start only at release. A channel keeps the ticks already applied.
- *Start cooldown:* an ability with `startCooldownS` > 0 begins each round on that cooldown.
- One action start and at most one decision evaluation per unit per tick.

**Downs.** A unit at HP ≤ 0 after commit is **downed** for the rest of the round. It leaves collision, targeting and every count of standing fighters. Its channels, auras and following zones end. Projectiles it already launched still land, and damage over time it applied keeps ticking, credited to it. The down is credited to the source of the largest single post-mitigation HP damage on that tick (ties: earlier in order(t)). Assists go to every other enemy that damaged it in the previous 5 s. Downed fighters cannot be healed or revived in M1; Deathward prevents a down instead.

**Round end and tiebreak chain** (DELEGATED, D-G). On elimination the side with standing fighters wins. At the time cap, or when both sides are eliminated on the same tick, the first difference in this chain decides: (1) more fighters standing; (2) higher sum of HP fractions in basis points, trunc(HP × 10,000 ÷ maxHp), with downed fighters counting 0; (3) more total damage dealt this round; (4) the side that downed an enemy first; (5) a seeded coin from the round's `tiebreak` stream. The report names the deciding step. A round always has a winner.

**Overtime ramp** (DELEGATED, D-G). From tick 900, with k = floor((t − 900) ÷ 20), damage is multiplied by 1 + 0.03k and healing and shields by max(0, 1 − 0.03k). At 60 s that is ×1.45 damage and ×0.55 healing.

**Randomness** (DELEGATED, D-G; P-05). All draws come from substreams of the round seed: `phase/<unit>` gives each unit's starting crit and evade accumulator phases (two draws at kickoff, uniform 0–9,999 bp); `variance/<unit>` gives one draw per damage instance (factor 1 + (−400 + trunc(801 × r ÷ 10,000)) bp, i.e. −4% to +4%); `react/<unit>` gives the opening stagger (0–4 ticks before the first decision) and one jitter draw (0–2 ticks) per committed decision change; `tiebreak` gives the coin. Crit and evade are accumulators, not independent rolls: each eligible hit adds the current chance in bp to the unit's accumulator, and a crit (or evade) happens when it reaches 10,000, which is then subtracted. Over a fight the count of crits or evades is within ±1 of chance × attempts. Rule evaluation, targeting and event recording draw nothing.

**Edge cases:** a heal and lethal damage on the same tick are summed, so the heal can save the fighter. A unit downed on tick t still lands effects it released on t. A projectile whose target is downed before landing fizzles; an area projectile explodes at the last known point.

**Acceptance cases:** det-001, det-002, cmb-004, cmb-008, cmb-012 (§9.1).

#### sys-fight-freshness: tiredness, round by round (M1.1)

**Status:** that Freshness acts between rounds and never during combat is REQUIRED (O19). The tiredness penalty at each round start is REQUIRED (O26, combat cmb11-q5) and its values are TUNABLE (`combat.json` freshness), to be revisited after harness runs (O26); since the M1.1 tuning (m1.1/tune-combat) the full penalty is ×0.8 of the first proposal. The meter itself (drain, recovery, labels) is lifecycle's sys-freshness.

**When it applies.** At the **start of each round**, from the fighter's Freshness F at that moment (after lifecycle's drain for the previous round and any between-round gain). It is a constant for the whole round; nothing about Freshness changes during combat.

**Formula.** s = clamp((60 − F) ÷ 50, 0, 1), in basis points trunc((60 − F) × 10,000 ÷ 50): no penalty at F ≥ 60, full penalty at F ≤ 10. Each penalty = penaltyAtFull × s × (1 − fatigueResist), added once at round build as stat mods:

| Value | Full penalty (F ≤ 10) | F 52 (s 0.16) | F 40 (s 0.4) | F 28 (s 0.64) |
| --- | --- | --- | --- | --- |
| Attack speed | −8% | −1.3% | −3.2% | −5.1% |
| Move speed | −4.8% | −0.8% | −1.9% | −3.1% |
| Power and Support | −6.4% | −1.0% | −2.6% | −4.1% |
| Reaction delay | +20% | +3.2% | +8% | +12.8% |

Just under the threshold the cost is mild, so playing one more round is a planned risk; a spent fighter plays roughly 2 to 3 rating points worse. Because drain is per round, a fighter can cross the threshold mid-match, which is exactly when the between-round screen offers a swap. `fatigueResist` comes from perks (Long Wind 40%). **M1.1 tuning:** the full penalty was −10% attack speed, −6% move, −8% Power and Support and +25% reaction delay in the first proposal and is ×0.8 of that now (`combat.json` freshness.penaltyAtFull). In the harness's `fatigue` mode (10,000 rounds, seed `balance-1`) a side with one fighter at F 28 wins 45.8% (target 44–48%), with all five at F 52 43.8% (target 45–49%: slightly low), at F 40 37.0% (30–40%) and at F 10 19.7% (15–25%).

**Player information:** the lineup, squad and between-round screens show lifecycle's label (Fresh, Ready, Tired, Spent) and the value; report recaps tag a fighter per round **Tired (52)** or **Spent (28)** with the applied penalties; `fight.start` unit data carries `freshness`, `fatigueBp` and the five values. Missing Freshness reads as 100.

**Effective rating** (O28, O30; PERMITTED-CHOICE as built in R002): the Squad table and the between-round screen show what the penalty does to a fighter's overall, as "45 → 41". The sim never changes a tired fighter's attributes, so the figure is an **approximation** (`ratingAtFreshness`). It takes the severity s above, fatigueResist included, and prices each penalised quantity as the attribute points that would cost the same combat output, at the fighter's own class rating weights: attack speed → Agility points (the penalty ÷ 2.5% per point), move speed → Pace points (÷ 2% per point), Power → points off every attribute in the class's Power attributes (÷ 4% per weighted point; their weights sum to 1), Support likewise over its Support attributes (none for a class without Support), reaction delay → Awareness points (the penalty × his reaction time ÷ 0.01 s per point). Rating loss = 5 × Σ (class rating weight × points lost); effective rating = clamp(round(rating − loss), 1, 100), never above the rating; nothing at Freshness 60 or above, the full loss at 10 or below. On the shipped content a Knight loses about 5–6 rating points at the full penalty, casters 6–10, strikers and healers 9–13. The price is generous to the penalty by design: points are priced at the attribute's whole weight, Power and Support ignore the fighter's own multiplier, attributes are not floored at 1, and the reaction penalty is charged to Awareness alone. The effective rating is display only: it feeds no rule, wage, ask, AI valuation or result (D-Q's one rating formula is unchanged), and tables sort by it with the rested rating breaking ties.

**Worked example (EXAMPLE):** the worked-example Knight starts a round at F 45 (s = 3,000 bp): attack interval 1.3 ÷ 0.951 = **1.367 s**; Power trunc(72 × 1.056 × 0.9808) = **74**; move **160 mm per tick**; reaction 0.323 s = **6 ticks**; tag "Tired (45)". At F 10: interval **1.453 s**, Power **71**, move **155 mm per tick**, reaction **7 ticks**, "Spent (10)".

**Acceptance cases:** fr-001 to fr-006 (§9.4).

#### sys-abilities: schema, effects, statuses, damage and the 42 classes

**Status:** class count and kit structure REQUIRED (O8); the vocabulary and rules DELEGATED (D-G: two damage types cmb-q7, crowd-control rules cmb-q5, the unusual mechanics cmb-q10, class names cmb-q6). Every number is PROPOSED · TUNABLE in `abilities.json`, `classes.json` and `combat.json`.

**Kit structure.** Every class has exactly one basic attack (`basic`), two actives (`a1`, `a2`, each with a cooldown and a focus cost) and one passive: 168 abilities in total. Learned abilities are M5 scope (R5, sys-academy); whether an academy-taught ability replaces a kit slot or adds one is owner question Q20.

**Ability schema** (`abilities.json` → abilities[]; every field present on every ability): `id` (`<classId>_<slug>`), `classId`, `slot`, `kind`, `name`, `description` (player-facing, with its numbers), `iconId`, `tags`, `cooldownS`, `startCooldownS`, `focusCost` (charged at release), `castTimeS` (null for basic), `channel` (duration, tick interval, mobile, move-speed multiplier), `rangeM` (max gap at start, +0.4 m leeway at release), `target` (`enemy`, `ally`, `ally_or_self`, `self`), `approach` (true: move into range; false: the rule skips with `out_of_range`), `order` (`target_first` or `self_first`), `delivery` (`instant`, `projectile`, `dash`, `leap`; projectiles home and cannot miss, but evade applies), `area` (circle, cone 60/90/120/180°, or line; centre target or self; affects enemies, allies, allies including self, or both; a unit is inside if its centre is within the shape expanded by its radius; cone tests use `combat.json` coneHalfAngleCos), `effects`, `allyEffects`, `selfEffects`, and `passive` (static and conditional stat mods, an optional aura, triggers).

**Amount** = base + Σ coef × stat, with stat ∈ power, support, maxHp, missingHp, armor, ward (the caster's), targetMaxHp, targetMissingHp, triggerAmount, lastDamage. It is evaluated at release; projectiles and zones keep their release values.

**Effect vocabulary** (closed list; parameters in `abilities.json`):

| Type | Rule |
| --- | --- |
| `damage` | Damage pipeline below. Types: `physical` (against armor), `arcane` (against ward), `true` (none). Optional canCrit, evadable, conditional bonus multipliers, lifesteal, per-target stack bonus, on-kill effects |
| `heal` | Healing pipeline; `to` may redirect the heal to the lowest-HP ally within a radius |
| `shield` | Absorbs post-mitigation damage for a duration; a unit's total shields are capped at 50% of its max HP (excess trimmed on application) |
| `status` | Applies a status from the catalog (duration, magnitude, stacks, damage or heal ticks) |
| `knockback` / `pull` | Displacement from or toward the caster or area centre; displacement diminishing returns apply; interrupts |
| `dash` | Moves the caster away from, toward or behind the target |
| `cleanse` / `dispel` | Removes harmful statuses from an ally / beneficial effects (buffs, shields, heals over time) from an enemy, longest remaining first |
| `interrupt` | Cancels a windup, cast or channel |
| `guard` | The target becomes Guarded by the caster (redirect, pipeline step 7) |
| `zone` | A ground area: ticking zones apply ally and enemy effects each interval (first tick one interval after creation); trap zones arm, then apply to the first enemy that touches them and vanish; `maxActive` removes the oldest |
| `chain` | Applies effects to the target, then jumps to the nearest enemy within the radius of the last one not yet hit (sys-targeting tie-breaks), × falloff per jump |
| `splash` | Applies effects around the trigger target |
| `cooldown` | Resets or reduces a cooldown |
| `focus` | Restores focus (cap 100) |
| `heal_recent_damage` | Heals a share of the post-mitigation damage the target took in the last window (≤ 4 s), with a minimum |

**Predicates** (for effect bonuses, stat mods and triggers): `target_hp_below`, `target_hp_above`, `target_has_status`, `target_casting`, `target_not_targeting_source`, `target_distance_above`, `self_hp_below`, `self_targeted_by`, `attacker_distance_above`, `fight_time_below`, `fight_time_at_least`, `ally_downed_within`, `any`. **Stat mods** use the 27 ids in `combat.json` statModStats, optionally scaled per self missing HP %, allies within, enemies within, or attackers on self (capped). **Triggers:** `basic_hit`, `every_n_basic`, `hit`, `damage_taken`, `evade`, `kill`, `status_target_down`, `ally_hp_below`, `every_n_heals`, `cc_applied`, `shield_broken`, `round_start`, each with an internal cooldown. Triggered effects resolve on the next tick (no same-tick cascades) and never trigger thorns, lifesteal or other triggers of the same fighter in the same chain.

**Damage pipeline** (per instance; centipoints; each step truncates toward zero):
1. Amount at release.
2. × each true bonus multiplier; × (1 + mult × stacks) for a per-target stack bonus (then consume stacks if set).
3. **Evade** (evadable weapon blows only): accumulator check. On evade the instance ends; riposte and evade triggers fire.
4. **Crit** (if canCrit): accumulator check; × 1.5.
5. × variance factor (−4% to +4%).
6. × source damage-dealt multiplier: clamp(1 + Empowered − Weakened + Σ damageDealt mods, 0.25, 2.5).
7. **Guard split:** if the target is Guarded and its guardian stands within the guard radius (gap), the guard share is redirected to the guardian and continues from step 8 against it. Redirected damage is never redirected again and never triggers thorns.
8. × recipient damage-taken multiplier: clamp(1 + Vulnerable + Marked − Fortified + Σ damageTaken mods, 0.25, 2.0).
9. × overtime damage multiplier.
10. **Mitigation:** physical × 100 ÷ (100 + max(0, armor)); arcane × 100 ÷ (100 + max(0, ward)); true × 1.
11. Truncate to whole points, minimum 1 if the amount before truncation was > 0.
12. Shields that existed at the start of the tick absorb first (soonest-expiring first); the rest is HP damage, summed at commit. Overkill and absorbed amounts are recorded.
13. After the tick: lifesteal heals the source for lifesteal × (HP + shield damage dealt); Illuminated heals the attacker; thorns reflect thorns × the step-6 amount as physical damage to an attacker within a 1.5 m gap (weapon blows only; mitigated by the attacker's armor and damage-taken multiplier).

**Healing pipeline:** amount × bonuses × (1 + Σ healingDealt mods) × clamp(1 + Σ healingReceived mods − Festering, 0, 2) × overtime healing multiplier, truncated, capped at missing HP at commit; the excess is recorded as overheal. Heals never crit. Shields use the same pipeline without the missing-HP cap. Downed units cannot be healed.

**Hard control and diminishing returns** (DELEGATED, D-G; cmb-q5). Stun, sleep, root, silence and taunt share the `control` track; knockback and pull share the `displace` track. Successive applications to a target use steps [1.0, 0.6, 0.35, 0 (immune)]. A track resets 6 s after its last *applied* entry. One ability release advances a track at most once per target. Duration = trunc(base ticks × (1 + caster ccDurationDealt) × step × (1 − tenacity)), capped at 2.5 s; results under 0.1 s are resisted. Soft control (slow, sluggish) and debuffs have no diminishing returns; their duration is × (1 + caster debuffDurationDealt) × (1 − resolve). Buffs are not reduced. A new control status replaces a weaker remaining one of the same id; different ids coexist.

**Stacking:** one instance per (status, source unit, ability). Reapplying refreshes to the longer duration and keeps the higher magnitude, and with `maxStacks` > 1 adds a stack. `strongest`: across sources only the highest total magnitude counts. `stacks` (damage and healing over time, Momentum): every source's instance counts. `refresh` and `latest`: one active instance; `latest` (taunt, guarded) is replaced by the newest application. Shields from different sources add up to the shield cap.

**Statuses.** 34, defined in `combat.json` statuses (id, category, track, stacking, stat modified, cap). Hard control: stun, sleep, root, silence, taunt. Soft control: slow, sluggish. Buffs: haste, frenzy, momentum, empower, fortify, armor_up, ward_up, thorns, lifesteal, evasive, guarded, riposte, deathward, rallied. Debuffs: weaken, shaken, vulnerable, marked, armor_shred, ward_shred, heal_reduction, illuminated. Over time: bleed, burn, poison (damage) and regen (heal). Special: anchored. Special rules:
- *Taunt:* rules are suspended; the unit moves to and basic-attacks the taunter. The taunt ends if the taunter is downed.
- *Sleep:* acts as stun, but ends at the commit of any tick in which the sleeper took at least 8% of its max HP.
- *Riposte:* each evaded weapon blow from within 1.5 m triggers a counter-strike (magnitude × Power, physical, can crit, not evadable) next tick.
- *Deathward:* at commit, if HP ≤ 0, HP becomes 1 and the ward's heal applies; the ward ends.
- *Anchored:* the unit's own stance, not crowd control: it cannot move and ignores knockback and pull.
- *Illuminated:* any enemy of the unit that damages it heals for magnitude × that damage after the tick.
- *Shaken* and *Rallied* belong to sys-fight-captain.

**Validation** (at load): every referenced status, stat, predicate, trigger, amount stat and effect type exists; hard-control durations ≤ 2.5 s; magnitudes ≤ the status cap; times are whole ticks; distances whole centimetres; actives have cooldown > 0 and focus > 0; self-target abilities never approach; `both` areas have ally effects; cone angles are in the table.

**Worked example (EXAMPLE): Behead** (balance pass 1: Headsman base Power 140). A Headsman with STR 14 and PRE 10 has Power trunc(140 × 1.144) = 160. Behead on the worked-example Knight at trunc(1475 ÷ 4) = 368 HP (24.9%) with armor 68, no crit, variance +1.00%: 320.00 → × 2 (target below 30%) = 640.00 → × 1.01 = 646.40 → × 100/168 = 384.76 → **384 damage**. If it downs the Knight, Behead's cooldown resets.

**The 42 classes (content).** `classes.json` classes[] is the catalog: id, name, flavor and description; `archetypes` (one, or two for hybrids, of `tank`, `melee`, `ranged`, `controller`, `healer`, displayed as Tank, Melee DPS, Ranged DPS, Controller, Healer); `hybridPair`; `roleTags`; `affinityGroup` (generation only); `complexity`; `preferredBand` and `startingRow`; `damageProfile`; `base` values at all attributes 10; `powerAttrs` and `supportAttrs`; `ratingWeights`; `statEmphasis`; `abilities`; `presetIds` and `defaultPresetId`. Kits and numbers are in `abilities.json`, which document 04 reads for class cards.

Archetype baselines at all attributes 10 (averages of `classes.json` base values after balance pass 1, §8.2): Tanks HP 1,244, armor 56, ward 42, Power 70.0, interval 1.28 s, move 3.22 m/s. Melee DPS HP 1,085, armor 28, Power 104.3, 1.03 s, 3.58 m/s. Ranged DPS HP 810, armor 15, Power 94.5, 1.19 s, 3.4 m/s. Controllers HP 853, ward 33, Power 98.0, 1.2 s. Healers HP 880, Power 53.8, Support 110.2. Hybrids HP 1,134, Power 80.2, Support 36.2.

Identities (each pure archetype has six distinct jobs; each hybrid uses one ability from each side of its pair). ★ marks a **starter** class (roleTags `starter`): an instantly recognizable, low-complexity pick for new players.
- **Tanks:** Knight ★ (formerly Oathguard; interceptor), Gongbearer (taunter), Scarhide (regenerating bruiser), Briarback (thorns), Bladeturner (evasive duelist), Guardian ★ (formerly Phalanx Sergeant; shield wall).
- **Melee DPS:** Assassin ★ (formerly Gutterknife; diver), Berserker ★ (formerly Bloodhowler; frenzy), Twinfang (flurry), Headsman (executioner), Chaffcutter (cleaver), Spellblade (formerly Runecleaver; arcane blade).
- **Ranged DPS:** Archer ★ (formerly Longeye; sniper), Ranger (formerly Boltrunner; kiter), Wizard ★ (formerly Emberwright; fire caster), Blightbrewer (poisoner, anti-heal), Thunderhand (chain storm), Writ Hunter (marker).
- **Controllers:** Rimebinder (frost), Warlock ★ (formerly Hexmonger; hexer), Galeshaper (displacer), Hushweaver (silencer), Enchanter (formerly Dreamthief; sleeper), Snaresetter (trapper).
- **Healers:** Chirurgeon (single-target, cleanse), Cleric ★ (formerly Cantor; area), Aegis Scribe (shields), Druid ★ (formerly Grovetender; heal over time), Vigilkeeper (death-ward), Bard (formerly War Drummer; tempo).
- **Hybrids** (open-024, adopted under D-G: a DPS-side hybrid is melee or ranged per class and carries both role tags): tank/DPS Warrior (formerly Siegebreaker; melee) and Pavisier (ranged); tank/controller Gaoler and Harpooner; tank/healer Paladin (formerly Vowknight) and Deeproot Keeper; DPS/controller Netcaster (melee) and Skullslinger (ranged); DPS/healer Leechblade (melee) and Sunlance Acolyte (ranged); controller/healer Shaman (formerly Undertow Mystic) and Hourglass Sage.

**Recognizable class names** (owner request, M1.1; display names only, class ids unchanged). 16 of 42 classes (38%, within the owner's 50% limit) take a widely recognized, generic fantasy name where the kit already matches it. The other 26 keep their original names. Each renamed class keeps its old name in its flavour line.

| New name | Formerly | Archetype | id | Why the kit fits |
| --- | --- | --- | --- | --- |
| Knight ★ | Oathguard | Tank | `oathguard` | Sworn bodyguard: Interpose takes allies' damage, Shield Bash, damage-reduction aura |
| Guardian ★ | Phalanx Sergeant | Tank | `phalanx_sergeant` | Shields the whole formation (Lock Shields), armor aura, pike pushes divers off |
| Assassin ★ | Gutterknife | Melee DPS | `gutterknife` | Shadowsteps behind the back line; bonus damage on enemies not watching it |
| Berserker ★ | Bloodhowler | Melee DPS | `bloodhowler` | Blood Frenzy attack speed and lifesteal; more damage the lower its HP |
| Spellblade | Runecleaver | Melee DPS | `runecleaver` | Arcane-damage weapon, rune cone, lunge that silences casters |
| Archer ★ | Longeye | Ranged DPS | `longeye` | Longbow, longest range, Aimed Shot, leaps away from melee |
| Ranger | Boltrunner | Ranged DPS | `boltrunner` | Hit-and-run kiter: rooting bolt, tumbling shot, extra move speed |
| Wizard ★ | Emberwright | Ranged DPS | `emberwright` | Area fire spells (Firebloom, Flame Lance), burning damage bonus |
| Warlock ★ | Hexmonger | Controller | `hexmonger` | Curses: Withering Hex (weaken), Mark of Ruin (vulnerable), longer debuffs |
| Enchanter | Dreamthief | Controller | `dreamthief` | Sleep and daze: the classic mesmerist |
| Cleric ★ | Cantor | Healer | `cantor` | Hymns that heal the group, a sanctuary zone, healing aura |
| Druid ★ | Grovetender | Healer | `grovetender` | Nature heals over time (Rejuvenate, Bloomburst) |
| Bard | War Drummer | Healer | `war_drummer` | Battle music: team attack and move speed, rally heal, tempo aura |
| Warrior | Siegebreaker | Tank / DPS (melee) | `siegebreaker` | Heavy melee bruiser: charge with knockback, Iron Hide, maul |
| Paladin | Vowknight | Tank / Healer | `vowknight` | Holy knight: lays on hands, consecrates ground, shares allies' pain |
| Shaman | Undertow Mystic | Controller / Healer | `undertow_mystic` | Tide magic that slows enemies, heals and cleanses allies |

Starter classes (★, 9): Knight and Guardian (Tank), Berserker and Assassin (Melee DPS), Archer and Wizard (Ranged DPS), Warlock (Controller), Cleric and Druid (Healer). They use complexity 1–2 kits; the Enchanter (complexity 3, sleep breaks on damage) is recognizable but not a starter. The tag is the free-vocabulary `roleTags` value `starter`, so the codex shows it as a chip and search finds it; no schema change is needed.

**Availability and validation:** all 42 classes exist from M1 and appear in generation, rookies and free agency, weighted by race class affinity. The validator checks exactly 6 classes per pure archetype and 2 per hybrid pair, a hybrid's archetypes matching its pair, four abilities per class with matching slots, and 2–3 presets per class.

**Acceptance cases:** cmb-002, cmb-003, cmb-005 to cmb-007 (§9.1).

#### sys-ability-ranks: ranks 1 → 3 (M1.1)

**Status:** ability ranks as a kind of level-up offer are REQUIRED (O18). The rank rules (basic attacks never rank, actives and passives rank 1 → 3 by family, no rank lengthens any control effect) are REQUIRED (O26, combat cmb11-q1, q2) and the template, families and numbers are TUNABLE (`ability-ranks.json`); the control cooldown steps and the rank-3 trims are from the M1.1 tuning pass (m1.1/tune-combat).

**Rule.** Every active and passive ability has ranks 1 → 3; rank 1 is the M1 ability. **Basic attacks never rank** (they would be every fighter's first pick). 126 rankable abilities, 252 rank steps. A fighter stores a rank per slot (`a1`, `a2`, `passive`). At round build each slot with rank r > 1 applies rank 2's `changes` and, at rank 3, rank 3's, in order, to a copy of the ability (JSON pointer, `from`, `to`), which then compiles like any ability. Reports name ranked abilities "Shield Bash II" or "Shield Bash III".

**Families** (derived from the ability's effects; five per-ability overrides in the data):

| Family | Rank 2 | Rank 3 |
| --- | --- | --- |
| damage | damage × 1.12 | cooldown × 0.9 (to 0.5 s, at least 0.5 s shorter) |
| area damage | damage × 1.10 | area +0.5 m (+1 m lines, +1 chain jump) |
| control | cooldown about × 0.8 (nearest 0.5 s, set per ability) | a further ~15% off the cooldown (about × 0.65 of rank 1), focus −5 (minimum 10), damage × 1.10 and area +0.5 m (+1 m line) where the ability has one; **control durations never change** |
| heal | healing × 1.12 | cooldown × 0.9 (Rejuvenate −0.25 s, Rewind Wounds −0.5 s; Suture instead focus −5, no cooldown cut) |
| shield | shield × 1.12 | shield duration +1 s |
| buff | buff durations +1 s | buff magnitudes × 1.2 (within status caps) |
| debuff | magnitudes × 1.2 (within caps) | durations +1 s, except soft control, whose duration never changes (Torpor Field: cooldown 12 → 10.5 s instead) |
| mobility | cooldown × 0.9 | focus −5 |
| protect (guard) | guard redirect +5 points | cooldown × 0.9 |
| ward (Deathward) | ward window +1 s | cooldown × 0.9 |
| passive | every magnitude × 1.25 | × 1.5 of rank 1 (radii, thresholds and intervals never scale) |

**Invariants (validated):** each `from` equals the value at the previous rank; no control duration, hard or soft, is longer at a higher rank (the validator compares both, since 419f0a0); magnitudes stay within status caps; active cooldowns ≥ 1 s and focus ≥ 10; every value converts exactly. Examples: Knight Interpose redirect 30% → 35%, then cooldown 10 → 9 s; Archer Aimed Shot 300% → 336% Power, then cooldown 9 → 8.5 s; Chirurgeon Suture 220% → 246% Support, then focus cost 20 → 15; Knight Shield Bash cooldown 9 → 7.5 s, then 6 s with focus 20 → 15 and damage 140% → 154% Power.

**M1.1 tuning (m1.1/tune-combat).** 36 of the 126 rankable abilities changed: all 22 control abilities got real cooldown steps (for example Slumber 14 → 11.5 → 9 s), and rank 3 was trimmed on 14 others (buff and passive magnitudes, heals; Suture trades its cooldown cut for a focus cut). No rank lengthens any control effect, hard or soft: the validator now compares both, and Torpor Field rank 3 became a cooldown step instead of a longer Slowed and Sluggish.

**Player information:** rank pips on each ability; the next rank's one-line delta on the fighter page, in the codex and in the level-up offer.

**Acceptance cases:** rk-001 to rk-005 (§9.4).

#### sys-perks: perk catalog and eligibility (M1.1)

**Status:** perks as a kind of level-up offer are REQUIRED (O18). The catalog and rules (72 permanent perks, at most 4 per fighter with at most 1 of tier III, the small sim extensions) are REQUIRED (O26, combat cmb11-q3, q6) and the numbers are TUNABLE (`perks.json`); the perk cap is to be revisited after harness runs (O26).

**Catalog.** 72 permanent perks: 12 general and 12 per archetype, in tiers I / II / III (5 / 4 / 3 per archetype). Each is an extra passive block in the existing vocabulary plus small, validated extensions: up to 4 perk passive blocks per unit; the stat mod `fatigueResist`; the predicates `self_is_captain`, `self_freshness_below`, `self_fresh_entry`; the triggers `self_hp_below` (once per round) and `ability_release`; trigger `if`; aura `requires`. Trait-type perk effects behave as on traits; lifecycle-type effects (`freshnessDrainMult`, `freshnessBetweenRounds`, `captaincy`) never reach the sim. The text of every perk is in `perks.json` and shown in the codex.

**Eligibility** (the level-up offer applies the same rules): the pool is the general perks plus those of every archetype the class lists (24 for pure classes, 36 for hybrids); tier I always, tier II after 1 perk held, tier III after 2 held and one listed prerequisite; **cap 4 perks, at most 1 tier III**; 12 exclusive pairs (never offered while the partner is held); `minStats` gates (Banner Voice: Leadership 12); a held perk is never offered again; perks are permanent in M1.1 (respec FUTURE). Perks never apply hard control.

**Freshness and captain perks:** Long Wind (penalty 40% weaker) and Campaign Legs (drain ×0.85, +2% max HP) are exclusive; Second Breath regains 8 Freshness at each between-round step and heals 10% of max HP once per round below 35% HP; Fresh Legs gives +8% damage and +2 composure in a reserve's first round on the field; Banner Voice (+1 composure to the lineup as acting captain, +5 CQ) and Rallying Horn (rally ×1.5, and allies within 8 m attack 2% faster) stay inside the 10% captain cap.

**M1.1 tuning (m1.1/tune-combat; Last Wall cut again at integration).** Four perks were cut: Hunter's Patience +10% → +6% damage to enemies that are not targeting it, Overload 10% → 6% Empowered after an active, Last Wall's once-per-round shield 20% → 12% → 8% → 5% of max HP (the last cut in `m1.1/ki-fixes`, KI-19), Glass Cannon +12% → +9% damage dealt (damage taken stays +8%). Six perks that only gave focus regeneration, which a 30 s fight barely feels, became real effects: Measured Breath (ability cooldowns recover 6% faster), Ready Mind (+15% move and +8% attack speed in the first 8 s of a round), Deep Well (every 3rd heal shortens both ability cooldowns by 1 s), Puppeteer (each stun, root, silence or sleep gives 12% Frenzied for 4 s, once per 3 s), Wellspring (every 4th heal also leaves the target regenerating 25% of Support per second for 4 s) and Rallying Horn (above). In the v0.6 verification (`perk-impact`, seed `fp1`, 1,000 rounds per perk) Last Wall, after its second cut, was the one perk the harness flagged (lift +5.2 points, CI 3.5 to 6.9, against the +5 flag; seed `fp2` +5.4; 05 §12 KI-19). At 5% (`m1.1/ki-fixes`) the lift is +3.3 (CI 1.8 to 4.8) on `fp1` and +4.5 (CI 2.7 to 6.3) on `fp2`, and nothing else is flagged on either seed; a 6% shield left `fp2` at +5.1. The trigger (below 25% HP, once per round), the 4 s duration and the prerequisites are unchanged. Battle Chaplain flags at +5.7 on seed `fp5` (05 §12 KI-22). No rank is flagged as dominant, and 16 rank-3 steps lift under 0.5 point (`rank-impact`, seed `fr1`, unchanged).

**Acceptance cases:** pk-001 to pk-005, st-001 (§9.4).

#### sys-targeting: selectors, Only and Prefer, tie-breaks

**Status:** PROPOSED (P-05, research C1.3). There are no random targets, ever.

**Candidate pools.** Enemies: standing enemy units. Allies: standing allies, excluding the deciding unit unless the selector's `includeSelf` is true (`densest_ally`, `protect` and `regroup` never pick it). Self: the deciding unit.

**Selectors** (`tactics-presets.json` vocabulary.selectors; primary sort in brackets): `self`; `nearest_enemy` [gap ascending]; `furthest_enemy` [gap descending]; `lowest_hp_enemy` [HP fraction ascending]; `top_damage_enemy` [damage dealt this round descending]; `enemy_targeting_me` [gap, filtered to enemies targeting me]; `enemy_targeting_ally` [HP fraction of the ally each enemy targets, optional role filter]; `casting_enemy` [gap, filtered to casting]; `densest_enemy` [neighbours within radius, default 2.5 m]; `captain_target` [the acting captain's committed enemy target]; `marked_enemy` [gap, filtered to marked]; `enemy_role` [gap, filtered by role]; `lowest_hp_ally` [HP fraction; includeSelf default true, optional radius]; `most_targeted_ally` [enemies targeting it]; `ally_role` [gap, filtered by role]; `densest_ally` [neighbours within 4 m]; `captain` [our acting captain]; `current_target` [my committed target]. HP fractions are compared as trunc(HP × 10,000 ÷ maxHp) and gaps in mm. `captain_target` and `current_target` are invalid when that unit is not a candidate.

**Only and Prefer** (one per rule, never both; `vocabulary.predicates`): `in_range`, `within {band}`, `hp_below {pct}`, `hp_above {pct}`, `has_status {status or category, min stacks}`, `lacks_status`, `has_buff`, `role {role}`, `not_role {role}`, `not_targeted_by_ally`, `targeting_me`, `not_self`. **ONLY** removes candidates that fail; if none remain the rule skips with reason `no_target`. **PREFER** moves candidates that pass to the front and never blocks. `in_range` uses the rule's action range (the ability's, or the basic attack's for attack, kite and hold).

**Tie-breaks** (after the primary key, in order): (1) **stickiness:** the unit's current target wins if its key is within 1.0 m (gap keys) or 5 percentage points (HP keys) of the best candidate; (2) smaller gap; (3) lower HP fraction; (4) lower lineup slot. All comparisons are exact integers.

**Role references** match every unit whose class lists that archetype; a hybrid matches both of its roles (open-024 under D-G). Rules never refer to names, so a preset survives a roster change (research A3.4).

**Edge cases:** an empty pool, or `captain_target` with no acting-captain target, makes the rule skip (`no_target`) and the next rule is tried. A target downed before release cancels the attack or cast with a refund.

#### sys-tactics: rule engine, presets and traces

**Status:** rule format and engine DELEGATED (D-G, cmb-q9; R2, P-06, P-07); per-class presets selectable per fighter as the whole M1 tactics scope are DELEGATED (D-N; the owner's R2 editing need is unchanged). Editing is M3 scope (sys-tactics-editor).

**Rule format.** A rule list is an ordered list of up to 8 rules (M1 presets use 2–4) plus one stance:

`IF <condition> [AND <condition>] THEN <action> ON <selector> [ONLY <predicate> or PREFER <predicate>] [COOLDOWN n s]`

Every condition may carry NOT. Thresholds use 10% steps. The JSON shape is `{ id, if: [ { cond, …params, not? } ], then: { type, slot? }, on: { sel, …params }, only, prefer, cooldownS }` (`tactics-presets.json` presets[].rules[]).

**Conditions** (`vocabulary.conditions`; "starter" ones form the M3 editor's day-one set; all are usable in presets). Thresholds are strict (below means <); bands and counts are inclusive.
- `always`.
- `self_hp_below {pct}`; `ally_hp_below {pct, includeSelf}`; `allies_hp_below {pct, count, band?}`; `enemy_hp_below {pct, band?}`.
- `enemy_within {band}`; `enemies_within {count, band}`; `enemies_clustered {count, radiusM}`; `allies_clustered {count, radiusM}` (advanced).
- `self_targeted {count}`; `ally_targeted {count, role?}`; `enemy_casting {band}` (a windup of at least 0.3 s, or channelling).
- `self_has_status` (advanced); `ally_has_status`; `enemy_has_status {band?}`.
- `fight_time_below {seconds}`; `focus_at_least {amount}`; `outnumbered`; `allies_down {count}` (advanced); `enemy_role_within {role, band}` (advanced); `captain_alive`.

**Actions** (`vocabulary.actions`): `attack` (basic-attack the target, moving into range); `ability {slot}` (the pool must match the ability's target type); `kite {band}` (keep the gap above the band while basic-attacking when in range); `hold` (do not move; basic-attack the target if in range, else the nearest enemy in range); `protect` (stand between the ally and its nearest attacker and attack, preferring the ally's attackers); `regroup` (move to within 2.5 m of the ally, then hold).

**Stances** (the unremovable fallback, valid while an enemy stands): **Aggressive** (attack the nearest enemy, closing in as needed); **Steady** (attack the nearest enemy, but never advance more than 1 m past our frontmost ally unless an enemy is already in range); **Cautious** (attack the nearest enemy in range, keeping a gap of at least 60% of attack range, minimum 2.5 m, by backing away).

**Resolution procedure (one evaluation):**
1. A stunned, asleep, displaced, winding-up, casting or channelling unit does not evaluate. A Taunted unit's decision is forced to "attack ON the taunter" (trace reason `taunted`) and commits at once.
2. Walk the rules top-down. The first failing check is the rule's skip reason, in this order: `rule_cooldown` (the rule's own COOLDOWN is running) → `cond_false` (the trace records the condition and the observed value) → `cooldown` (seconds left) → `no_focus` → `silenced` → `no_target` → `out_of_range` (an ability with `approach: false` and the target beyond range).
3. The first passing rule **fires**: its action, target and rule index are the result. If none passes, the stance fires.
4. **Commit with reaction delay** (P-06). A result equal to the committed decision (same rule, action and target) changes nothing. Otherwise it becomes pending and commits after the reaction delay plus jitter. While pending, the unit continues its committed action if still valid, otherwise holds still. A later different result replaces the pending one without restarting the timer; a return to the committed decision drops it. The first decision of a round commits after the seeded opening stagger. Two rules with the same action and target count as one decision.
5. A rule's COOLDOWN starts when its action releases (attacks, abilities) or when a movement rule (kite, hold, protect, regroup) stops being the committed rule.

Rules never skip, reorder or misfire because of stats or traits (P-06). Only visible statuses (taunt, stun, sleep, silence, displacement) override them, and each is named in the trace.

**Presets** (D-N). `tactics-presets.json` presets[] holds 105 presets (42 balanced, 33 aggressive, 30 protective; 295 rules after balance pass 1, which removed one rule from each Bard preset). The shape is `{ id: <classId>_<style>, classId, style, name, summary, stance, rules[] }`. Every class has a `balanced` preset, which is its default, and 2–3 in total, with class-flavoured display names (e.g. "Bodyguard") and a plain-language `summary` for the lineup screen. EXAMPLE, Knight Balanced: R1 IF enemy_casting band=melee THEN Shield Bash ON casting_enemy ONLY in_range; R2 IF ally_targeted count=2 THEN Interpose ON most_targeted_ally; R3 IF ally_hp_below 50% THEN Interpose ON lowest_hp_ally; R4 IF always THEN Shield Bash ON nearest_enemy ONLY in_range; stance Aggressive.

**Preset selection in M1.** The player picks one preset per fighter on the lineup screen; the class default is pre-selected. AI managers select per fighter by the club's `tacticsStyle` (`clubs.json`), mapped to a preset style: aggressive → `aggressive`, steady → `balanced`, cautious → `protective`. The first preset of the class with that style (in `presetIds` order) is used, else the class default. This resolves the drafts' "stance tag versus style key" conflict without data changes (sys-ai-manager).

**Decision trace** (P-22). Every committed decision change records `unit.decide` with the pick (rule index, or the rule count when the stance fired), reaction ticks and causes, commit tick, and for each earlier rule its skip reason and observed value. It renders as, for example, "Stance (cautious) fired: attack the nearest enemy · R1 skipped: no ally has hard control · R2 skipped: Suture ready in 1.8 s · reacted after 0.35 s (under pressure)". At recording level `full` every trace is kept. At `summary`, only counters are kept per rule: fires, ticks committed, and skips by reason.

**Edge cases:** a target that dies between commit and release cancels the action (refund), and the unit re-evaluates at once. The stance never evaluates conditions, so a list can never end with nothing to do while an enemy stands; `hold` with no enemy in range is an idle the player chose.

**Acceptance cases:** cmb-001, cmb-009 (§9.1).

#### sys-fight-ai: executing actions beneath the rules

**Status:** PROPOSED.

- **attack / ability:** move until the gap is range − 0.1 m (if `approach`), then start when ready. Basic attacks repeat on the committed target whenever the swing is ready.
- **kite (band):** if the gap is at or inside the band, step directly away (sliding along walls); otherwise basic-attack when ready and in range; if the target is beyond attack range, approach, but never inside the band.
- **hold:** never move. Attack the selected target if in range, else the nearest enemy in range.
- **protect (ally):** stand between the ally and its attacker (an enemy targeting it, else the enemy nearest it), 0.3 m outside both bodies. Once within 0.5 m of that point, attack the attacker if in range, else the nearest enemy in range.
- **regroup (ally):** move until the gap to the ally is ≤ 2.5 m, then behave as hold.
- **Stances:** as in sys-tactics. Under *Steady* a unit never moves more than 1 m toward the enemy side past the frontmost standing ally unless an enemy is in its attack range; the frontmost unit behaves as Aggressive.
- **Anti-stuck:** a unit that gains less than 0.2 m on its target over 1 s while approaching flips its sidestep side for the next second. This changes steering only, never the rule chosen.
- **No useful action:** when no enemy stands, the round has ended. A `hold` unit with every enemy out of reach idles by the player's choice. QA detectors count idle time; they never override rules in game.

#### sys-fight-traits: in-fight effects of traits

**Status:** PROPOSED (O5; boundary contract 3). The catalog is sys-traits'.

**Procedure:**
1. Management-applied effects (`stat`, `contextStat`, status stat mods, chemistry) are already inside the setup stats; the sim never applies them again.
2. Each sim-applied effect becomes modifiers through `combat.json` traitEffectAdapter:
   - `combat {when, value or seconds, mods}`: when ∈ always, selfHpBelow(v) → `self_hp_below`, targetHpBelow(v) → `target_hp_below`, openingSeconds(s) → `fight_time_below`, afterSeconds(s) → `fight_time_at_least`, allyDown(s) → `ally_downed_within` (true for s seconds after any ally is downed). mods: damageDealtMult m → damageDealt + (m − 1); damageTakenMult m → damageTaken + (m − 1); reactionDelayMult m → reactionDelay + (m − 1); composureAdd → composure.
   - `enemyComposureAura {rangeBand, add}`: an aura on enemies within the band.
   - `shakenImmune {mult}`: multiplies negative composure from Shaken and from allyDown-conditioned mods.
   - `captainRally {mult}`: as acting captain, rally composure × mult (truncated) and rally duration × mult.
3. Trait-sourced modifiers per stat are summed and capped (±0.15 fractions, ±8 composure). Every in-fight value in the current catalog is at most ±10% or 3 composure (D-F). Traits never alter rule evaluation (P-06).

**EXAMPLE:** Hot Blood at 40% HP gives damageDealt +0.08 while below 50%. Skittish after an ally falls gives composure −3 for 4 s: CMP 12 becomes 9, so tenacity drops from +4% to −2% and the pressure part of the reaction delay rises.

#### sys-fight-captain: the captain in the fight

**Status:** the captain model is DELEGATED (D-G, cmb-q8, which adopts the lifecycle design). Values in `development.json` captaincy.grades and `combat.json` captain.

**Inputs:** the lineup's captain index, an optional vice-captain index, and every fighter's CQ (sys-captaincy).

**Rules:**
1. **Aura:** while the acting captain stands, every fielded ally, the captain included, gets composure + the grade's `auraComposure` (A +2, B +1, C 0, D 0, E −1).
2. **Rally:** the first time in a round that an ally other than the acting captain is downed while the acting captain stands, all standing allies become Rallied: composure + `rallyComposure` (A +3, B +2, C +1, D and E none) for 5 s, and allyDown-conditioned negative trait mods are suppressed. One use per round. An unused rally carries over to a successor captain. Rallying Voice multiplies the rally composure (truncated) and duration by 1.5.
3. **Captain down:** the aura ends, and every ally is Shaken (composure −1 for 4 s). Steel Spine is immune.
4. **Handover:** when Shaken ends, the acting captain becomes the vice-captain if fielded and standing, otherwise the standing ally with the highest CQ (ties: lower slot), at CQ − 10 for the rest of the round, with the grade recomputed.
5. **Captain's target:** the `captain_target` selector follows the acting captain's committed target. This is the presets' focus-fire hook. M2: calls go through the captain.
6. **Cap:** captain-sourced modifiers change no combat quantity by more than 10%. +2 composure is +4% tenacity and about −0.01 s reaction delay.

**Player information:** the captain marker is always shown. Reports show rallies, captain-down moments and handovers.

#### sys-match: rounds, seeds and results

**Status:** PROPOSED (P-02, P-05). The best-of-5 Reckoning final is DELEGATED (D-C). M1.1 squads and swaps: REQUIRED (O20; O25, D-U, D-V), below.

**Input:** `MatchInput { seed, bestOf, home: SideInput, away: SideInput, content }`, with `SideInput { clubId, captainIndex, viceCaptainIndex or null, fighters[5] }` and the fighter input in boundary contract 1.

**Procedure:**
1. For round n = 1, 2, …: round seed = derive(match seed, "round", n). Reset HP, focus, cooldowns, statuses, shields, zones, positions and captaincy, then simulate (sys-fight-sim).
2. Stop when a side has won a majority of `bestOf`: 2 of 3, or 3 of 5 in the Reckoning final. A round is never drawn.
3. M1: lineup, captain, rows and presets were fixed for the whole match (open-010). **M1.1:** a match is a sequence of rounds with a between-round step after each non-deciding round, where squads may swap (below); each round's inputs add every fighter's `freshness`, `abilityRanks`, `perkIds` and `enteredThisRound`. M3: tactics may change between rounds as new inputs.

**Output:** boundary contract 2.

**M1.1 match squads and swaps** (REQUIRED: squads of 5 + 2 reserves, at most 2 swaps per match between rounds, and no return after a swap, O20. The swap details are REQUIRED, O25, D-U; auto-swap O25, D-V; `combat.json` match). This replaces open-010's "no substitutions" for M1.1.

- **Squad legality at lock:** 5 starters and 0–2 reserves, all distinct, fit roster fighters; hired blades only as starters; captain and vice may be starters or reserves; rows and presets are set for all seven. Fewer than 2 reserves is legal when no other fighter is fit.
- **State per side between rounds:** the active five (slot, row), `withdrawn`, unused reserves, swaps used (0–2), injured this match, each member's Freshness, the acting captain, emergency entrants.
- **Swap timing:** only in the between-round step after a round that did not decide the match: never before round 1, never after the deciding round. At most 2 swaps per match (best-of-5 too).
- **Legality** (first failure rejects, with its reason): `match_decided`; `no_swaps_left`; `not_active` (the outgoing fighter is not in the active five); `not_a_reserve` (the incoming fighter is not an unused reserve; a **withdrawn** fighter never is, so he can never return); `reserve_unfit`; `duplicate`. After a side's decisions exactly 5 fighters are active.
- **Injuries** (O25, D-U): an injured active fighter plays no later round of the match. The between-round step replaces him at once: by an unused reserve, which **uses a swap**, or, with none left, by an **emergency entrant**, who uses none: the best-fit fit roster fighter outside the squad (same role family, then rating, then Freshness, then lower id; never a withdrawn fighter), else a hired blade (open-006). Swaps left always equal unused reserves, and a match is never 4 v 5.
- **Captain, row and tactics** (O25, D-U): a withdrawn or injured acting captain hands over to the vice if active, else the highest CQ, at CQ − 10; a reserve named captain or vice takes the role on entering. The entering fighter takes the outgoing fighter's slot and row unless the player picks the other row. Presets travel with the fighter.
- **Decisions:** both clubs decide simultaneously and blind from the same post-round state; decisions are applied home then away and never interact. The AI never reads the player's choice (P-04). As built (REQUIRED, O25, D-U), the between-round view the player gets carries only the player's own side's suggestions: the opponent's side is empty and is not even computed for the view, and `match.swap` is accepted only for the player's club (any other club is refused with `match.not-player-club`); the AI's decisions are made inside the orchestrator.
- **Auto-swap** (club setting; AI clubs use the same rules, O25, D-V): mode `off` (forced replacements still happen), `injured_only` or `threshold` (default). After each non-deciding round: (1) forced injury replacements; (2) active fighters below `freshnessBelow` (default 40; AI by personality: balanced 40, thrifty 35, Glory-hunters 30, Seedbed 50, Old hands 40; **+10 for the side that lost the round just played**), lowest first, each swapped for the best-fit unused reserve at least 15 fresher and at most 6 rating below, same role family first; (3) **keep one for injury**: the last swap is not spent on Freshness before the last possible step. On the player's screen these are pre-filled suggestions.
- **Pacing:** club setting `pauseBetweenRounds`: `always` (the M1.1 default, O25, D-V and D-AE), `when_urgent`, `never`. AI-vs-AI matches never pause.
- **Records and determinism:** round seeds are unchanged; every between-round decision, swap (reason player, auto, injury or emergency) and the per-round lineups are recorded in the match result, so a replay re-simulates any round exactly without running a policy (05 §9.3). Each completed round and each decision is committed as it happens: quitting on the between-round screen resumes there with the same results (P-05). The player's match is saved to a dedicated slot, `auto-round`, after every round (O25, D-AD).

**Acceptance cases:** sw-001 to sw-009 (§9.4).

#### sys-match-report: event stream and explanations

**Status:** PROPOSED (O12, P-22). M1 records at summary level; M2 records at full level for the viewer.

**Envelope:** `SimEvent { seq, tick, type, unit?, target?, data? }` plus a round header (format, engine version, content hash, round seed, tick ms 50, frame every 2 ticks, arena in cm, units with side, fighter id, club id, class id, slot and captain flag).

**Event types.** Summary level (S) records: `fight.start`; `cast.release` for actives; `cast.interrupt`; hard-control `status.apply`; `deathward.save`; `captain.rally`, `captain.down`, `captain.handover`; `overtime.start`; `unit.down` (by, ability, hit, overkill, assists); `fight.end` (winner, reason, tiebreak step); `round.summary` (recap counters). Full level (F) adds: `frame` (positions in cm and HP every 2 ticks), `unit.decide` with traces, `attack.start` and `attack.cancel`, `cast.start`, `projectile.launch`, `hit` (amount, to shield, overkill, type, crit, guard redirect), `evade`, `heal`, `shield.gain` and `shield.break`, every `status.apply`, `status.expire` and `status.resist`, `displace`, and `zone.spawn`, `zone.trigger` and `zone.expire`.

**Recap** (per fighter per round): damage dealt (to HP and shields), damage taken, healing, shielding, overheal, hard control applied and received (s), downs and assists, focus spent, casts per ability, and per rule its fires, ticks committed and skips by reason; ticks on the stance; rules that never fired (highlighted).

**Death summary** (per down): the credited fighter, the ability, the last three hits taken with their sources, active debuffs, and whether a heal or shield arrived in the last 2 s.

**M1 match report content** (presentation in 04): score and per-round winner, duration and end reason (with the tiebreak step); a key-event timeline (downs with cause, interrupts caused by another fighter, Deathward saves, rallies, overtime; a cast the caster dropped itself, because its target went out of range or down, is not a key moment); per-fighter recap cards with rule-fire bars labelled by the preset's rules; "never fired" warnings; MVP data (damage, healing, downs); injuries and XP (from sys-injury and sys-development). **MVP as built** (PROPOSED · TUNABLE; presentation only): the fighter on the match winner's side with the highest score = damage dealt (to HP and to shields) + healing + shielding + 150 × downs inflicted + 50 × assists, summed over the match. The weights are `PROVISIONAL_MVP_DOWN_POINTS` and `PROVISIONAL_MVP_ASSIST_POINTS` in core/sim until `combat.json` gets a key (content request). The report's "What decided it" selection is a presentation heuristic specified in 04 ui-report.

**Determinism** (T4, vis-009): the event hash is identical for identical inputs at a given level, and the round checksum is identical at every level.

**M1.1 report additions:** ranked ability names (II, III) and perks in recaps; per-round Tired or Spent tags; each round's active five per side; between-round swap lines in the timeline ("After round 1 — Home: Druid (Tired 48) → Bard (Fresh 92), auto · Away: Netcaster injured (minor) → Skullslinger, forced"); each recap states rounds played, "entered after round n", "swapped out after round n" or "injured in round n". As built (PERMITTED-CHOICE), the report also carries everyone who started a round (`appearedIds`) and the unused reserves, each recap's role and rounds started, team totals (the sums of the fighter lines, so a side's box score covers everyone who fought and not only the round-1 five), bench XP (a third of a lineup slot for every fit fighter who started no round, stored as one `bx` parameter on each club's `match.result` news), perk procs per fighter, and each fighter's Freshness before → after. A compacted result (a match between other clubs from an earlier season) keeps the score, the round results and, per fighter, his side, rounds started, downs, damage and healing (`fighterTotals`, about 30 bytes a fighter), and reports as a summary. **Compaction rule (O24):** a match between other clubs is compacted **a few weeks after it is played**, within the season: its detailed report and per-match fighter logs go, and its scores, the standings and the season statistics stay. **The player's own matches are never trimmed during the season.** How many weeks "a few" is, is a build choice (PERMITTED-CHOICE): as built on `m1.1/save-trim`, **3 weeks** (`leagues.json` `matchRecords.compactAiMatchesAfterWeeks`, TUNABLE (tech): whole weeks, at least 1, a content-validator warning above the last match week minus the first, 18 on the default calendar; the block is outside the content hash). A match played in week w is compacted by the processing of week w + 3 (week step 12, sys-calendar), the season-end step compacts whatever is left of the season just played, and the last 3 weeks always stay in full. A compacted match keeps its score, round results, winner, MVP, who was named, each fighter's rounds, downs, damage and healing totals (`fighterTotals`) and the five each side fielded with rows and kickoff ratings (`fielded`); it drops the fight inputs, per-fighter stats, round records and final HP. Standings, tie-breaks, Reckoning seeding and the archive read `fighterTotals`, and the renewal ask and the opponent's last five (D-R) read `fielded`, so nothing in the game depends on whether a match was compacted. The player's own matches stay in full for that season and the next. A side fix: tables of the previous season now keep their downs (a compacted match used to read 0).

**R002 box score** (O27, REQUIRED: damage done, damage received, healing done and healing received for every fighter who started a round). As built (PERMITTED-CHOICE; everything is additive and optional, and nothing is an event, so no event hash, golden or `ENGINE_VERSION` moved):
- *Counters.* `damageDone` and `damageReceived` are HP damage (damage soaked by shields is in neither); `healingDone` and `healingReceived` are **effective** healing (overheal excluded; a self-heal counts at both ends; Deathward's heal above the 1 HP floor counts for the receiver); `shieldingDone` is the shield points granted; downs inflicted and suffered. The sim counts healing received beside healing done (`Tally.healingReceived`, summed per round; in no event and not in the round checksum).
- *Per-round lines.* Each fighter also has a counter line for every round he started, and each side has per-round totals (the sum of its fighters' lines). These come from the re-simulation that rebuilds the key events, so they exist only while the match can be replayed (`timelineAvailable`: the build's engine version and content hash match the ones that played it, and the result is not compacted). His Freshness at the start of each round and right after its drain comes from the round lineups stored with the result, so it does not depend on the re-simulation.
- *Totals.* A side's totals are the sums of its fighters' lines over everyone who started a round, so a team total always equals the sum of the rows above it.
- *Older results.* A result played before healing received was counted has no stored value: the report re-derives it from the re-simulated rounds when it can and leaves it absent otherwise; a result played before the after-drain Freshness was recorded has no "after" value; a whole-match (M1) result has totals and no rounds. Saves stay compatible: the R002 fields are optional, so older saves load unchanged (the later KI-2 field `fielded` moved the state schema to v4, 05 §5).

**Acceptance cases:** det-001, det-002 (§9.1); box-001, box-002 (§9.4).

### 3.2 Fighter lifecycle systems

**Status for §3.2:** the shapes required by O5, O6 and O11 are REQUIRED, and O3's no-XP rule for unused academy call-ups. Extending that rule to every unused roster fighter, and training emphasis, are DELEGATED (D-A), as are mental-decline scaling and the kept races (D-B, a departure from O11's literal wording), M1 chemistry (D-D), magnitude caps (D-F), rookie counts (D-H), AI captain timing (D-I), the season-1 Trials Day class (D-P), the one rating formula (D-Q), the automatic interim captain (D-S) and effectiveness-driven retirement (D-T). Every other rule is PROPOSED, and every number is PROPOSED · TUNABLE in `races.json`, `traits.json`, `names.json` and `development.json`. Observed figures now come from the real sim at 48 clubs (§8.3); figures still marked "soak model" are the lifecycle draft's 24-club estimates.

#### sys-races: races and lifespan scaling

**Purpose:** a race sets *when* a fighter is good and *for how long*, at the price of being hurt more or less often. Long and short careers are each a real choice.

**One clock for every age rule** (O11). Human-age = age × 80 ÷ lifespan (in tenths; 03 §1). A human peaks physically at 28; an elf (lifespan 120) at 42. Every per-season rate (development clocks, wear, retirement conversion) is multiplied by k = 80 ÷ lifespan, so each phase of a career lasts lifespan ÷ 80 times as many seasons as a human's.

| Race | Lifespan | k | Debut age | Physical peak (plateau) | Physical decline from | Mental decline from (D-B) | Injury chance × | Recovery × | Retirement forced at (human-age 58, D-T) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Human | 80 | 1.000 | 17–21 | 28 (28–30) | 31 | 60 | 1.00 | 1.00 | 58 |
| Elf | 120 | 0.667 | 28–33 | 42 (42–46) | 47 | 90 | 1.25 | 1.20 | 87 |
| Dwarf | 72 | 1.111 | 16–19 | 25 (26–27) | 28 | 54 | 0.80 | 0.90 | 52.2 |
| Orc | 64 | 1.250 | 16–18 | 22 (23–24) | 25 | 48 | 0.75 | 0.80 | 46.4 |
| Ashkin (original race) | 52 | 1.538 | 16–17 | 18 (19–20) | 21 | 39 | 0.82 | 0.80 | 37.7 |

The last column is the real age at human-age 58 (58 × lifespan ÷ 80). Career length now depends on the class as well as the race (D-T): after the polish-round recalibration the median retirement human-age is 38.8 for physically weighted classes, 42.0 for mixed and 46.1 for mentally weighted (§8.3); for a physically weighted class that is real age 39 for a human, 58 for an elf, 35 for a dwarf, 31 for an orc and 25 for an Ashkin.

**Identities (PROPOSED; values in `races.json`):** tendencies are cap offsets in stat points, at most ±4 per stat by rule (D-F), and at most ±1.6 in the data.
- **Human:** no tendencies. *Adaptable:* training emphasis works 1.5× as strongly.
- **Elf:** agile, precise, aware; frail (tgh −1.6, str −1.2); mental growth ×1.1. The slowest climb and the longest prime, the most injuries and the slowest healing. Long elf careers are kept (D-B).
- **Dwarf:** shorter-lived than humans (the literal reading of O11, PROPOSED C-2); tough and composed, slow (pac −1.6); physical decline ×0.85; the lowest injury rate.
- **Orc:** strong and tough (str +1.6), less disciplined, and the most durable after dwarves (injury chance ×0.75, recovery ×0.80, scar chance ×0.9 since the polish round, per O11); physical growth ×1.05, mental ×0.9; useful almost at once, and in a physically weighted class usually done by about 31 (human-age 39, D-T).
- **Ashkin:** original race (kept, D-B): fast, weak captains, hurt slightly less often than a human (injury chance ×0.82, O25, D-AC); they debut at the age floor of 16, which already equals human-age 24.6, so they arrive near their peak and decline the most steeply; in a physically weighted class an Ashkin retires around real age 25 (human-age 38.8), about 9 seasons after his debut.

**Invariants** (validator; O11): a race longer-lived than humans must not have a lower injury-chance multiplier than humans, and a shorter-lived race must not have a higher one; among shorter-lived races the order is free. Every debut age is ≥ 16 (PROPOSED C-13). Every race lists all 12 stat ids. A tendency above ±4 is rejected.

**Player information:** a race page shows lifespan and the computed peak, decline and mental-decline ages, and injury proneness as a word and a number. The fighter card shows the race's peak window on its age bar, with the human-age equivalent on hover.

**Worked example (EXAMPLE):** an elf aged 42 has human-age floor(42 × 800 ÷ 120) ÷ 10 = 28.0, the human peak. An orc aged 26 has human-age 32.5, two seasons into decline.

#### sys-fighters: generation, effective stats and names

**Entities and state** (lifecycle part, stored as *inputs* from which stats are derived, so stats cannot drift): `potentialRoll` P (30–97); `paceId`; `cap100[stat]` (200–2,000); `bloom[stat]` (−2 to +2 human-years); `dev100 {physical, mental}` (development clocks in hundredths of human-years); `wear100[stat]` (≥ 0, never heals); traits with their source; statuses; injury; career counters (careerRounds, proSeasons, matchweeksAtClub, matchweeksAsClubCaptain, peakRating); `trainingEmphasis`; `unsignedSeasonEnds`; `finalSeason`; and per-season history rows. Economy adds `contractProfile.greedBp`, rolled at creation on the `market` stream.

**Generation procedure** (streams `rookies`, `development`, `traits`, `names`). Context is one of world generation, rookie, free agent, journeyman or hired blade.
1. **Race and age.** A rookie's age is uniform in the race's debut range. World generation draws a human-age band (`development.json` generation.worldGen.humanAgeBands), then a whole human-age, then age = round(human-age × lifespan ÷ 80), clamped to [debut minimum, age at human-age 40].
2. **Class:** weighted by `race.classAffinity[class.affinityGroup]` over the 42 classes (soft, so an elf tank is possible).
3. **Potential P:** a band by weight (30–44: 20; 45–57: 34; 58–69: 28; 70–81: 13; 82–91: 4.5; 92–97: 0.5), then a uniform integer, plus the **quality shift** (`leagues.json`: world generation tier 1 +8, tier 2 +4, tier 3 0; rookies 0; generated free agents and journeymen −3), clamped to 30–97.
4. **Pace:** Slow 0.75 (15%), Measured 0.90 (25%), Steady 1.00 (33%), Brisk 1.15 (19%), Rapid 1.30 (8%).
5. **Caps:** cap100ᵢ = clamp(round(P × 20 + classOffset100ᵢ + 100 × race tendencyᵢ + jitter100ᵢ), 200, 2000). classOffsetᵢ = clamp(2.0 × (statEmphasisᵢ − 1), −1.5, +2.5) points, recentred so that Σ ratingWeightᵢ × classOffsetᵢ = 0; jitter is uniform ±0.8 points.
6. **Bloom**ᵢ: a uniform integer −2 to +2, so some stats ripen earlier than others.
7. **Development clocks:** D_g = min(human-age + 4, 16 + max(0, human-age − 16) × U × pace × race.growthMult[g]), with U uniform 0.65–1.00 standing for earlier playing time.
8. **Wear history:** wearᵢ = the physical decline table summed over every human-year from 31 to floor(human-age) − 1, × race.declineMult.
9. **Veteran history** (older than a sampled debut age): proSeasons = age − debut; careerRounds = round(proSeasons × 40 × U); each pro season rolls a 1.6% scar chance; acquired-trait thresholds are checked once. The career line adds up (polish round): matches = round(careerRounds × 2 ÷ (bestOf + 2)), rounds won = careerRounds ÷ 2, and debutSeason = 1 − proSeasons, so a veteran is never shown as a first-season fighter. **Titles:** at the season-end development step every fighter on a Reckoning champion's roster gains one title in his career record.
10. **Traits** (sys-traits roll), then **name**.

**Effective stats** (the single function used by fight setup, rating and captaincy): developed100ᵢ = cap100ᵢ × M_g(D_g + bloomᵢ) (interpolated maturity curve, truncated); base100ᵢ = max(100, developed100ᵢ − wear100ᵢ); eff100ᵢ = base100ᵢ + 100 × (trait stat adds + status stat mods + chemistry composure on cmp + contextStat if the match qualifies); the displayed and fight value is clamp(floor(eff100ᵢ ÷ 100), 1, 20). **Rating** = `combatRating` (D-Q, boundary contract 7) of the displayed integer stats clamp(floor(eff100ᵢ ÷ 100), 1, 20), so the rating shown is the rating combat and the market use; the lifecycle draft's centipoint form is retired (flooring puts potential about 2.5 below the draft's P on average). **Potential** (displayed) is the same function with every stat at its cap, no wear, and only permanent modifiers (physique traits and scars), so a scar lowers potential (the "injury" event change allowed by P-12).

**Maturity curves** (fraction of cap by development clock D in human-years; `development.json` maturityCurve):

| D | 14 | 16 | 18 | 20 | 22 | 24 | 26 | 28 | 30 | 32 | 34 | 36 | 38 | 40 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Physical | .40 | .50 | .60 | .70 | .79 | .87 | .94 | 1.00 | 1.00 | — | — | — | — | — |
| Mental | .42 | .50 | .57 | .64 | .70 | .75 | .80 | .84 | .88 | .91 | .94 | .96 | .98 | 1.00 |

Physical also has points at 17 = .55, 19 = .65, 21 = .745, 23 = .83, 25 = .905 and 27 = .97. The mental curve keeps rising to D = 40, so veterans gain composure, leadership and awareness while their bodies fade.

**Names** (`names.json`): a pattern by weight per race, with parts concatenated. A name is rejected and retried (up to 20 attempts) on a blocklisted word, three identical letters in a row, a given name outside 3–11 letters, or a full name already held by a living fighter; on exhaustion, II, III and so on are appended. Given name, family name and epithet are stored separately.

**Other generated kinds:**
- *Journeymen* top up the free-agent pool: human-age 26–33, potential shift −3, rating in the Muster band (sys-transfers).
- *Hired blades* (open-006; the drafts' two rules merged): human-age 24–33, a normal trait roll, potential shift chosen so that the rating lands at the club tier's band minimum. The class covers the first missing role among Tank, Healer and Melee DPS in the fit four, else Melee DPS. They earn XP like anyone else and leave after one match (sys-roster).

**Player information (M1, exact values per open-026):** potential (stars and number), pace, traits, caps as "ceiling" ticks on each stat bar, and wear as a hatched segment.

**Edge cases:** P is clamped to 30–97; a cap is never below 2 or above 20 points; D can exceed human-age (a prodigy), but the curves cap at 1.0; a class without statEmphasis falls back to rank offsets (+1.2 for the top two weights, +0.4 for the next two, −1.2 for the rest). World generation never fails: a count shortfall is filled with journeymen.

**Worked example (EXAMPLE):** a Knight (statEmphasis tgh 2.0, str 1.27, arc 0.5) with P = 70: offsets before recentring are tgh +2.0, str +0.54, arc −1.0; the rating-weighted mean is about +0.6, so after recentring they are tgh +1.4, str −0.06, arc −1.6. The tgh cap is 14.0 + 1.4 = 15.4 points; a dwarf adds +1.6, giving 1,700 centipoints. At D_physical = 22, tgh = 1,700 × 0.79 = 1,343, which shows as **13**.

**Stamina** (M1.1; the stat, its range and its decline with age are REQUIRED, O19; generation PROPOSED · TUNABLE in `levels.json` stamina and `races.json`): generated like every stat, with cap = P ÷ 5 + class offset + race tendency + **2.5**, jitter **±3.0** (instead of ±0.8), clamped 2–20, so Stamina is a real trait of the fighter and not a copy of his potential. Race tendencies: human 0, elf −1.6, dwarf +2.0, orc +1.6, Ashkin −1.2 (the durable races are the tireless ones). It declines on the physical wear table and grows only through level-up picks; starters' median is 12–13 in the soak. It has no captaincy or direct injury role (O25, D-Z): it acts only through Freshness. Bellows Chest gains +2 Stamina. Example: a human Knight with P 60 and jitter 0 has a Stamina cap of 14.27; at human-age 26 he shows 13 (cap 1,427, train100 1,341).

**Acceptance cases:** gen-001 to gen-005, intake-001, intake-002 (§9.2); sta-001 to sta-003 (§9.4).

#### sys-youth-intake: rookies each season

**Status:** counts DELEGATED (D-H, agreed between the lifecycle and economy drafts; base tuned to 0.75 per club in m1/fix-tuning and to 0.8 in m1.1/tune-life); the season-1 class DELEGATED (D-P); trials day per P-18.

**Procedure** (season-end step 13, next-season setup):
1. rookies = clamp(round(clubs × 0.8) + retirementsThisSeason, round(clubs × 0.5), round(clubs × 1.6)) (`development.json` generation.intake basePerClub 0.8). retirementsThisSeason counts retirements and career-ending injuries, and **not** unsigned free agents who left the league, which would feed back into itself. With 48 clubs this is 38 + retirements, between 24 and 77. In the 20-season soak (seed `soak-1`, main @ 293f49a) 1–29 retirements a season gave 39–67 rookies.
   **Season 1 (D-P):** a new career has no preceding season end, so world creation generates a Trials Day class of **exactly one rookie per club** (48) with the normal rookie generator; the intake formula applies from season 2.
2. For each rookie: race by `intakeWeight` (human 36, orc 20, dwarf 17, Ashkin 14, elf 13), age uniform in the race's debut range, quality shift 0, then sys-fighters generation.
3. Trials day (sys-transfers): each club receives floor(rookies ÷ 48), and the remainder goes one each to clubs drawn by lot. Rookie count and quality never depend on standings, so there is no tanking incentive.

**Why these values keep the pool healthy (D-H):** intake replaces every retirement and adds about 0.8 fighters per club per season. Unsigned fighters leave after 3 consecutive unsigned season ends (sys-development; 2 until m1.1/tune-life). The free-agent pool therefore settles at a size set by expiries and leavers, inside the economy's targets (100–300 at P1; ≥ 60 in season with ≥ 5 per role). Journeymen fill any in-season shortfall. World generation adds **2.5 free agents per club** (120 at 48 clubs; D-C) so the first P1 market has choices in every tier. The 48-club soak (M1.1, 20 seasons) measured a P1 pool of 156–268 and an in-season minimum of 121 (§8.4); the leaving rule went from 2 to 3 season ends and `basePerClub` from 0.75 to 0.8 in m1.1/tune-life to keep the pool inside 100–300. If it leaves 100–300, tune `basePerClub` first (0.3–1.0), then AI roster slack.

**Population mix (soak target):** humans 34–40%, elves 16–21% (above their intake share, because elves stay longer), dwarves 13–20%, orcs 18–21%, Ashkin 6–12%.

#### sys-development: XP, bench XP, levels and level-up offers (M1.1)

**Status:** **M1.1 replaces M1's season-end growth.** REQUIRED: XP from playing rounds drives growth toward potential (P-12 shape); a roster fighter who starts no round earns **⅓ of a starter's XP** and an injured one 0 (O17, which replaces D-A for roster fighters); an unused called-up academy fighter still gains no XP (O3, M5); **in-season level-ups** about every 5 matches played for a mid-age, mid-potential fighter, each offering **1 of 3** options weighted by class and training emphasis, never a capped stat; options can be **ability ranks or perks** (sys-ability-ranks, sys-perks) or occasionally a **trait**; the AI uses the same offers with an auto-pick, and the player can set auto-pick per fighter or club-wide (O18). REQUIRED under O25: the bench-XP formula (O25, D-W), the level curve with lifespan scaling, +1 per stat pick and match-end checks (O25, D-X), the skill and trait cadence (O25, D-Y), and the playtest defaults (O25, D-V). Numbers are TUNABLE where those decisions fix them (O25) and otherwise PROPOSED · TUNABLE, in `levels.json` and `development.json`.

**M1 model (superseded).** In M1 a fighter who started no round got 0 XP (D-A), and season-end development advanced the clocks D_g by k × pace × usage (min(1, season XP ÷ 360)) × race growth × emphasis × traits × mentor; a live **trend** projected the season's rating change. In M1.1 the clocks and maturity curves are used **only at generation** (sys-fighters: `train100` = cap × M(D + bloom), set once), the trend is retired, and growth comes from level-ups. The M1-only keys `usageFloor`, `maxDeltaPerSeason`, `emphasisBonus`, `offEmphasisPenalty`, `bodyWearReduction` and the `trend` block were removed from `development.json` in the M1.1 integration, and `FighterView.trend` was dropped.

**Round XP** (unchanged amounts, committed per round): 10 for starting the round; +3 if the fighter's side won it; +1 per down credited, at most +2; +1 if not downed; ×1.25 in the Reckoning; then trait XP multipliers; floored once. Typical: about 12.8 a round, about 32 a match. A starter swapped out after round n keeps rounds 1–n; a reserve who enters earns from his first round; an emergency entrant earns the rounds he starts; a starter injured in round n earns rounds 1–n.

**Bench XP** (O17, O25; formula D-W): for every fit roster fighter who starts no round in the club's match, **squad reserves who never enter included**: floor(clubMatchXp × ⅓ × own XP multipliers ÷ 5), where clubMatchXp is the sum of the round XP of every club fighter who started a round (after the Reckoning multiplier, before personal multipliers). Dividing by the 5 lineup slots makes it ⅓ of what an average starter earned; it needs no counterfactual. A 2–1 win (clubMatchXp 196) gives **13**; a 2–0 sweep (146) gives 9. Injured, career-ended and withdrawn-and-played fighters get no bench XP; free agents and retired fighters 0.

**Levels** (O25, D-X). The owner's words are that fighter levels stay as total stat points (O23). The level as built is a counter that differs from that wording in three ways, which are OPEN (open-034, owner question Q52); the text below specifies the level as built. (a) The initial level counts only the stat points above 0.5 × each stat's cap. (b) Every level-up adds 1 to the level, so a skill pick or an empty level raises it with no stat point. (c) A level never decreases, while wear and scars lower stats. Each fighter has a stored `level`, `xpIntoLevel` and `xpNeeded` (frozen when the level starts). Initial level (generation and migration) = 1 + round(Σ over the 13 stats of max(0, train100ᵢ − 0.5 × cap100ᵢ) ÷ 100); a debuting 18-year-old is typically level 10–25, a peak veteran 60–90; levels never decrease.

xpNeeded = clamp(round5(B × A × G × lifespan ÷ 80 ÷ (pace × raceGrowth × traitDev × mentor)), 60, 2,500), with B = 102 + 0.6 × level; A, the age factor, blending a physical and a mental step table by the class's physical rating-weight share (young fighters level fast, physical classes slow down from human-age 24, mental ones only in their late 30s); G, the gap factor, from potential − trained rating without wear (slow near potential: < 1 → 4.0, 6 → 1.0, 30+ → 0.72); pace 0.75–1.3; race growth and devClock traits blended the same way; mentoring by the captain grade for human-age ≤ 23 (cap 1.15). **lifespan ÷ 80** keeps O11's one clock: at the same human-age an **elf levels about 1.5× less often** than a human and an Ashkin about 1.5× more often (O25, D-X). XP above the requirement carries over. Level-ups are checked **only at match end**, after the result is committed, at most **2 per match**; extra XP waits for the next match end.

**Worked examples (EXAMPLE; `content/default`; starter ≈ 32 XP a match, bench ≈ 10.7):**

| Fighter | xpNeeded | Matches per level | Levels a season (~12 matches) |
| --- | --- | --- | --- |
| Knight, human 25, Steady, level 20, potential 62 vs trained 54 (B 114, A 1.10, G 1.0) | **125** | 3.9 (bench 11.7) | ~3.1 (bench ~1) |
| Wizard, human 19, Brisk, level 8, gap 20 | **65** | 2.0 | ~6 |
| Chirurgeon, human 33, Steady, level 34, gap 1.5 | **450** | 14.1 | ~0.9 |
| Netcaster, elf aged 30 (human-age 20.0), level 9, gap 18 | **115** | 3.6 | ~3.3 |
| The Knight as an elf of human-age 25 / as an Ashkin of human-age 25 | **185** / **85** | 5.8 / 2.7 | ~2.1 / ~4.5 |

The examples are single fighters at the start of a level, and starters play about 11–12 matches a season once Freshness rotation and injuries are counted. The soak's cohorts (§8.6) average 4.46 matches per level in the mid cohort, because B grows with the level and gaps and paces differ. The M1.1 tuning lowered the base from 115 to 102 and the physical age factors at 0 and 24 from 0.72 and 1.25 to 0.68 and 1.10 (the draft's table gave 155, 75, 500, 130, 225 and 105 for these fighters).

**Level-up offers** (O18, O25; cadence D-Y). Generated once at match end per level gained (stream `development`, keyed by season, week, fighter and level) and stored, so a reload never rerolls them (P-05).
1. **Slots:** normally 3 stat options. If level mod 3 = 0, one slot is a skill; if level mod 9 = 0, two are (one rank step and one perk when both kinds are eligible).
2. **Stat options**, drawn without replacement among stats with room (train100 < cap100), weight max(0.03, class rating weight) × emphasis (Stamina floor 0.08). Body emphasis multiplies physical weights by (1 + a) and divides mental ones; Mind the reverse; a is the trait emphasis strength (Adaptable or Regimented 1.5, Set in Their Ways 0). **A pick adds +1 point** (100 centipoints) or the rest up to the cap (O25, D-X).
3. **Skill options:** combat's draw: rank or perk 1 : 1 while both are eligible; ranks uniform; perks by tier (I 1.0, II 0.8, III 0.6), under sys-perks' eligibility.
4. **Fallbacks:** no eligible skill → a stat option; no stat with room → a skill; nothing at all → an empty level that still counts.
5. **Trait offer** (stream `traits`): with chance 12.5%, if he holds fewer than 4 rolled and learned traits, an optional extra choice of **2 traits or "neither"**: option 1 always a boon or edge, option 2 positive 75% of the time, else a burden; never a flaw, physique, storied or scar trait; pool and weights in `levels.json` traitOfferPool; a chosen trait has source `level`.

For a typical starter (about 2.5 levels a season in the soak) that is about 0.8 skill slots and 0.31 trait offers a season; over a 15-season career about 12 skill slots and 4–5 trait offers.

**Queue and pacing.** Level-ups wait in a queue of 3 (oldest first); a 4th auto-resolves the oldest by the fighter's policy, and the digest says so; all pending level-ups auto-resolve at the start of the season-end step. They never block Continue or a lineup lock, and no pick is possible while a match is in progress, including the between-round screen. An option made illegal by an earlier pick is greyed out. **Modes** per fighter (default from the club): "Ask me" (`manual`), `auto`, `auto_stats`, `auto_skills`; AI clubs always `auto`; the player club default is `manual` (O25, D-V). **Pacing** (club setting): `detailed` opens the level-up card after the match report for every manual fighter who levelled (the M1.1 default, O25, D-V); `balanced` only for those who started a round, others get a badge; `fast` badges only.

**Auto-pick score** (highest wins; ties: stat before skill, then lower index): stat = 5 × rating weight × gain ÷ 100 × emphasis preference (1.15 emphasised group, 0.9 other, 1.0 Balanced), plus for Stamina a bonus by current Stamina (< 10 0.70, 10–12 0.45, 13–15 0.20, 16+ 0); skill = combat's value (perks: autoPickValue × tag × style × context, clamped 0.5–3.0; ranks 1.0 × 1.25 for the archetype's families × 0.9 for passives × 1.2 if the preset uses the slot) × the mode's skill preference; trait offer: the higher-weighted boon or edge, never a burden, else neither. Example: a Balanced Knight with Stamina 9 offered STR, AWR and Stamina scores 0.90, 0.20 and 0.80 and takes STR.

**Player information:** the level-up card (04 ui-levelup); on the fighter card the level, the XP bar (xpIntoLevel / xpNeeded), levels this season and **"next level in ≈ N matches"** (N from his mean match XP this season), which replaces the M1 trend.

**Edge cases:** a scar that lowers a cap below train100 clips train100 and leaves the level; picks raise train100, never lower wear; a fighter at all caps with no eligible skill gets empty levels near the 2,500 maximum; a hired blade's level-ups auto-resolve and he leaves after the match; a fighter who changes clubs keeps his bar and level.

**Season-end step 6 becomes Aging** (with the age held during the season): auto-resolve every pending level-up; wear (as below; Stamina is physical); trait gain and loss checks, the captaincy recompute and the retirement chance (D-T), with **usage = min(1, season round XP ÷ 360)** so bench XP does not count; age +1; xpNeeded recomputed (xpIntoLevel kept); peak rating updated (also at every pick). The season development report becomes a **season progression report**: rating before and after, levels gained, each pick, wear added, round and bench XP, Tired and Spent round-starts, potential reached.

**Training emphasis** (D-A as amended): the standing Balanced, Body or Mind setting now **weights which stats appear in offers**; it still never adds growth and has no effect on wear or injury. `training.enabled = false` makes everyone Balanced.

**Later-milestone hooks:** rule slots (M3, P-07) = clamp(4 + floor(careerRounds ÷ 100), 4, 8) + trait slots, maximum 12. Academy (M5): program XP is added to seasonXp; on call-up academy XP stops and accrued XP is kept (open-003). Fog (M4): pace hidden until one season at the club; the level, XP bar and "next level" estimate stay visible.

**M1 reference: four careers** (the M1 clock model, kept for its aging and wear columns; in M1.1 the stats after generation grow through picks instead).

**Worked example (EXAMPLE): four careers.** Knight template, P 70, steady pace, starting every round, headline caps STR 16 and CMP 14:

| Fighter | Age (human-age) | STR shown | CMP shown |
| --- | --- | --- | --- |
| Human | 18 (18.0) debut | 9 | 7 |
| Human | 28 (28.0) | 16 | 11 |
| Human | 34 (34.0) | 15 (wear 0.7) | 13 |
| Human | 40 (40.0) | 12 (wear 3.4) | 14 |
| Elf | 30 (20.0) | 11 | 9 |
| Elf | 42 (28.0) | 16 | 12 |
| Orc | 20 (25.0) | 14 | 10 |
| Orc | 26 (32.5) | 15 (wear 0.25) | 12 |
| Ashkin | 16 (24.6) debut | 14 | 10 |
| Ashkin | 24 (36.9) | 14 (wear 1.38) | 13 |

v0.3 drops the draft's rating/potential and retirement columns: the ratings came from the retired centipoint formula and need the full stat set (D-Q), and retirement no longer depends on age alone (D-T; see the worked example in "aging, decline and retirement").

The human at 34 has D 34, so developed STR is 16.00; wear 0.2 + 0.2 + 0.3 = 0.7 gives 15.30, shown as 15. A human who debuts at 18 (D = 18) and **never plays** (usage 0, D-A) still has D = 18 at age 28: STR = 16 × 0.60 = 9.6, shown as 9 ("potential reached" about 60%). A slow-paced human who plays every round reaches D 25.5 at 28 (STR 14.76) and hits his cap only around 31, just as decline starts.

**Acceptance cases:** dev-002, dev-006, dev-007 (§9.2; dev-001, dev-003 to dev-005 and dev-008 to dev-010 were M1-only); bxp-001 to bxp-005, lvl-001 to lvl-014, mig-001 to mig-003 (§9.4).

#### sys-development: aging, decline and retirement

**Status:** the human peak of 28 scaled by lifespan is REQUIRED (O11), and so is the owner's "Mental skills don't decline until ~60" (O11 states no race scaling for mental decline). **Scaling the mental-decline age by lifespan is a departure from that literal wording**, DELEGATED under D-B and pending owner confirmation (human 60, elf 90, dwarf 54, orc 48, Ashkin 39; `development.json` decline.mentalDeclineScalesWithLifespan = true). Retirement driven by effectiveness and forced at human-age 58 is DELEGATED (D-T). Retirement on by default is PROPOSED (P-10).

**Decline (wear)** in stat points per human-year, looked up at floor(human-age during the season) − any trait declineShift, then × k × race.declineMult[g] × trait decline multipliers: physical 0 up to 30, then 0.2 (31–32), 0.3 (33–34), 0.4 (35–36), 0.5 (37–38), 0.6 (39–40), 0.7 (41–43), 0.85 (44–46), 1.0 from 47 (softened in the polish round). Mental: 0 before human-age 60, 0.1 per human-year at 60–64, 0.2 at 65–69, 0.3 from 70. With scaling, human-age is used for every race, so mental decline never touches a playing career. Cumulative human physical wear: 0.7 points by 34, 1.8 by 37, 3.4 by 40, 4.7 by 42, so a human at 42 keeps about 55–65% of an 11–13-point physical attribute. The flip side: a low-rated veteran over 40 can show physical stats of 1–2 (05 §12).

**Retirement** (stream `retirement`):
1. **Chance** (D-T; computed live all season and shown on the card): 0 below human-age 31; 100% from human-age **58**, with a career-ending injury, or in a final season; otherwise **p = 1 − (1 − hDrop) × (1 − hAge)**.
   - hDrop (per season) is a step table on the drop from the fighter's career-peak rating to his current rating (`development.json` retirement.hazardByRatingDrop): drop ≥ 3 → 1%, ≥ 4 → 2.5%, ≥ 5 → 4.5%, ≥ 6 → 7.5%, ≥ 7 → 12%, ≥ 8 → 18%, ≥ 9 → 25%, ≥ 11 → 35%, ≥ 13 → 47%, ≥ 16 → 63%, ≥ 20 → 82% (recalibrated in the polish round to match the softer decline). Physical decline lowers the rating of a physically weighted class, so it shows up here.
   - hAge = 1 − (1 − h)^k, with h a step table on the human-years past the physical peak of 30 (`hazardPerHumanYearPastPeak`): 1–9 years 0.2%, 10–14 0.8%, 15–17 1.5%, 18–20 3%, 21–22 6%, 23–24 10%, 25 18%, 26 30%, 27 50%. The conversion is a precomputed basis-point table per (race, human-age).
   Because mental stats hold until human-age 60, mentally weighted fighters keep their rating and play into their 40s and 50s, and physically weighted fighters usually retire in their late 30s.
2. **Modifiers**, in this order. Multiply (M1.1: usage = min(1, season **round** XP ÷ 360); bench XP does not count): usage ≥ 0.75 → ×0.8; usage ≤ 0.30 → ×1.5; no contract for next season → ×1.5; a contract running past this season → ×0.6; trait multipliers (Glory-Hungry 0.8, Weathers Well 0.85, Keeps the Edge 0.9, Idle Hands 1.2). Then add 3 points per scar (the heavy-wear add is 0 under D-T, because the rating drop already carries physical decline). Then clamp to 0–100%.
3. **Final season:** at P1, a fighter whose chance (computed with usage 1.0 and the current contract) is ≥ 60% announces a final season. He gets status `final_season` (+1 composure, "farewell tour") and retires at season end for certain.
4. **Roll** at season-end step 7. A retiring fighter's contract ends with no payout. He leaves a career record (an `alumni` entry, 05 §5) and, FUTURE (unscheduled), may become staff (P-10).
5. **Leaving the league:** a free agent unsigned at 3 consecutive season ends leaves (`development.json` retirement.unsignedSeasonEndsBeforeLeaving; 2 until m1.1/tune-life, which kept the preseason pool inside 100–300). This is pool maintenance, and it is not counted as a retirement for intake.

**Distributions** (real sim, 48 clubs, measured in m1/polish-core): median retirement human-age **38.8** for physically weighted classes, **42.0** for mixed and **46.1** for mentally weighted (the draft's age-only rule gave 36.2 overall).

**Player information:** the age bar shows rising, prime and declining zones for the race; a retirement-chance badge from human-age 31; the final-season status; the P1 digest lists final-season announcements.

**Edge cases:** retirement never happens mid-season; a career-ending injury removes the fighter from play at once, and he retires at season end. Pending offers to a retiring fighter are void. A free agent's chance uses "no contract next season". Human-age 57.9 is still below 58.

**Worked example (EXAMPLE):** a dwarf Bladeturner aged 32 (human-age 35.5) whose rating fell from a career peak of 66 to 60 (drop 6 → hDrop 7.5%), usage 0.6, an expiring contract not renewed, 1 scar. He is 5 human-years past the peak, so h = 0.2% and hAge = 1 − 0.998^1.111 = 0.22% (22 bp). p = 1 − 0.925 × 0.9978 = 7.70%; × 1.5 (no contract) = 11.55%; + 3 (scar) = **14.55%**. A human healer at human-age 47 who is 2 below his peak (hDrop 0; 17 years past the peak, h = 1.5%), with usage 0.5 and a contract running past this season, has p = 1.5% × 0.6 = **0.9%**, so he plays on.

**Acceptance cases:** age-001 to age-003, ret-001 to ret-007 (§9.2).

#### sys-injury: the injury ladder

**Status:** the ladder at rates equal for AI and player is PROPOSED (P-11). "Long-lived races are more injury-prone; orcs and dwarves are more durable" is REQUIRED (O11). The career-ending rule (C-8), permanent scars (C-7) and the knock (C-14) are PROPOSED. M1 has no form model, so P-11's "form loss" rung is the **knock**.

**Inputs** (per fighter per round started, from boundary contract 2): downed, damage taken, max HP. State: effective tgh, race, human-age, traits, statuses.

**Procedure** (stream `injury`, keyed by fixture, round and fighter):
1. After each round, for each fighter who started it and has no new injury this match (M1.1: × the Freshness multiplier read at that round's start, sys-freshness): p = (0.4% + 1.4% × min(2, damageTaken ÷ maxHp) + 1.3% × [downed]) × clamp(1 + (10 − tgh) × 0.05, 0.6, 1.4) × race.chanceMult × ageMult (human-age < 30: 1.0; 30–32: 1.1; 33–35: 1.25; ≥ 36: 1.4) × trait multipliers × 1.25 if Still tender, capped at 15%.
2. Roll. An injury draws its severity from weights knock 62, minor 24, moderate 10, serious 4. A heavy hit (downed with damage ≥ 100% of max HP) shifts these by knock −6, moderate +4, serious +2. Human-age ≥ 33 shifts them by knock −5, moderate +3, serious +2.
3. Weeks out: a knock is exactly 1 week, so the fighter misses the next match. Minor 2–3 weeks; moderate 4–6; serious 8–14. Non-knock durations are × race.recoveryMult × age (human-age ≥ 32: 1.15; ≥ 35: 1.30) × trait recovery, rounded half up, minimum 1.
4. Scar roll, moderate and serious only: moderate 4%, serious 30%, × 1.3 if human-age ≥ 33, × trait and race scar multipliers. A scar draws one acquired scar trait the fighter lacks (Rebuilt Knee 25, Stiff Shoulder 22, Crooked Ribs 18, Ringing Skull 15, Clouded Eye 12, Grim Visage 8), with a 30% chance to also gain Pain-Tempered. Scars are permanent and lower potential (PROPOSED C-7; an M5 academy "rehab" term may soften one).
5. **Career-ending:** possible only on a serious injury, and only if the fighter was **At risk** at lineup lock (≥ 2 scars, or human-age ≥ 34): 8%, with a hard cap of 0.5% per match on the combined chance. The fighter is out for the season and retires at season end.
6. **Timing:** M1: an injury took effect when the match ended. **M1.1 (REQUIRED, O25, D-U; combat cmb11-q8): the injury takes effect immediately**: the fighter plays no later round of that match, and the between-round step replaces him with an unused reserve (a swap) or an emergency entrant (sys-match). weeksOut starts with the week after the match; a knock misses the next match. The cap of one new injury per fighter per match stays. Still tender counts matches in which he starts a round; an emergency entrant who is At risk is checked as at the lock. Weeks out count down at each week processing; the off-season in the season-end step removes 8 weeks.
7. After a moderate or serious injury the fighter is **Still tender** (injury chance ×1.25) for his next 2 matches started. Back from the Brink is gained on the first round started after a serious injury.

**Expected rates** (soak model, injuries per 40 rounds): human 0.95–1.04, elf 1.26–1.46, dwarf 0.64–0.77, orc 0.71–0.79, Ashkin 0.77–0.94. **Measured in m1/polish-core** (injuries per full-season starter, after the orc change): dwarf 0.54–0.66, orc 0.64–0.69, Ashkin 0.77–0.81, human 0.92–0.97, elf 1.10–1.26. Serious injuries are about 6% of all injuries. **M1.1 population test** (seed `population-3`, `content/default`, injuries per 40 rounds): human 1.083, elf 1.502, dwarf 0.782, orc 0.759 and Ashkin 1.063 at ×0.85, just over the 0.60–1.05 band, which is why the Ashkin chance became ×0.82 (O25, D-AC). A 24-club league sees about 3–5 scars and 0.1–0.35 career-ending injuries a season.

**Player information:** *before* the match, on the lineup screen per fighter: the risk word and an **estimate** of the chance per round started, shown with ≈ and labelled as an estimate ("≈1.95% injury chance per round started, estimated from typical rounds (not exact)"). As built (PROPOSED · TUNABLE), the estimate is the per-round formula of step 1 for a *typical round* (downed 55%, damage taken 60% of max HP: `PROVISIONAL_TYPICAL_ROUND` in core/fighters), times the fighter's proneness factors, capped at 15%; the example is a human with tgh 10, human-age under 30 and no traits. The real chance depends on the round, so the estimate is never presented as exact. If At risk, the At-risk status text says a serious injury could end the career; core also estimates the per-match career-ending chance from 2.5 typical rounds per match, which M1 does not yet display (05 §12). *After*, in the match report: each injury with its round, cause ("downed by X after taking 118% of max HP"), severity, weeks out, return week and pre-match odds, and for scars the new trait and the potential change. *Also:* the digest, a roster medical column with countdowns, and the season review tally.

**Edge cases:** a fighter downed in round 1 plays rounds 2 and 3. If two rounds roll injuries, only the first counts. An injury in the last tournament week carries into the off-season. A knock on a bye week is used up by that week's processing (M1 has no byes, but future cup weeks may). With no fit fighters, hired blades fill the lineup (sys-roster).

**Worked example (EXAMPLE):** an elf aged 50 (human-age 33.3), tgh 8, downed after taking 120% of max HP: p = (0.4 + 1.68 + 1.3)% = 3.38% × 1.10 × 1.25 × 1.25 = **5.81%** this round. Severity weights with both shifts: knock 51, minor 24, moderate 17, serious 8. A serious injury of 11 base weeks lasts 11 × 1.2 × 1.15 = 15.18 → **15 weeks**; scar chance 30% × 1.3 = **39%**; career-ending not possible (human-age under 34, fewer than 2 scars).

**Acceptance cases:** inj-001 to inj-009 (§9.2).

#### sys-freshness: the Freshness meter (new id, M1.1)

**Status:** REQUIRED (O19): a new physical stat, **Stamina**, and a meter named **Freshness**; a high-Stamina fighter plays about 4 matches before a negative effect and a low-Stamina one about 2; age affects both; Freshness acts **between match rounds, never during combat**. The constants and the 80% reserve rest are REQUIRED (O25, D-Z), with TUNABLE values to be retuned after more playtesting and the fatigue harness; the in-round penalty is combat's sys-fight-freshness (REQUIRED, O26). Values in `levels.json` freshness.

**Purpose:** give every week a squad decision ("we need more actions each week", T003): who plays, who rests, who sits on the bench as a reserve. A star's availability becomes something the manager spends.

**State:** `freshness10` per fighter (0–1,000 tenths; 1,000 = fully rested), persisted across weeks and inside a live match; the sim and UI receive floor(value ÷ 10).

**Drain per round played** (after each round, for every fighter who started it; O25, D-Z): base(STA) = clamp(11.88 − 0.48 × STA, 2, 12) (STA 6 → 9.0, 10 → 7.1, 16 → 4.2, 20 → 2.3) × intensity, where intensity = clamp(0.55 + 0.25 × min(2, duration ÷ 30 s) + 0.20 × min(2, damage taken ÷ max HP) + 0.12 × [downed], 0.6, 1.5) (a typical round gives 0.99), × 1.1 under human-age 21, × perk multipliers (Campaign Legs 0.85), × **0.5 when the round starts below the threshold of 60** (`tiredDrainShare`, O25, D-AB; a round that starts at exactly 60 drains in full). STA is the effective Stamina at that moment. Freshness changes only after a round ends; combat reads it at the next round start.

**Between rounds:** every active fighter and unused reserve who is not withdrawn or injured gains his between-round total (Second Breath +8; otherwise 0), clamped to 100. Nothing else recovers inside a match. A **withdrawn** fighter keeps the value of the rounds he played: no drain and no gain after he leaves.

**Weekly rest** (each matchweek or Reckoning week, for every fighter who **started no round that week**, free agents and injured fighters included): (30 + STA) × age multiplier (human-age < 31: 1.0; 31–34: 0.85; 35+: 0.70). A **squad reserve who never entered gets 80%** of it (O25, D-Z). A fighter who started a round that week gets nothing, even if withdrawn after round 1. Preseason weeks: +50 × age multiplier (a hook; everyone starts the season at 100). **Season-end step 9 resets Freshness to 100.**

**Calibration** (consecutive matches, typical rounds, no rest, human 21–30):

| Stamina | Drain per round | Rounds started at ≥ 60 | ≈ Matches | Rest a week |
| --- | --- | --- | --- | --- |
| 20 | 2.3 | 18 | 7 | +50 |
| 16 | 4.2 | 10 | **4** | +46 |
| 12 | 6.1 | 7 | 2.8 | +42 |
| 6 | 9.0 | 5 | **2** | +36 |

**Threshold and labels:** threshold **60** (equal to combat's `thresholdBelow`). **Fresh** ≥ 80, **Ready** 60–79, **Tired** 40–59, **Spent** < 40 (so a value of 40 reads Tired, as `levels.json` freshness.labels has it).

**Tired rounds drain half** (REQUIRED, O25, D-AB; the value is TUNABLE and to be retuned after more playtesting and the fatigue harness; m1.1/tune-life). The onset above is unchanged, because only rounds that start below 60 pay half. A Stamina-6 starter who is never rotated starts rounds at 100, 91, 82, 73, 64, then 55 (Tired), and from there loses 4.5 a round instead of 9.0: his first Spent start moves from round 8 to round 10, and he is still above 0 at round 18 (it was 0 from round 13). The first Tired start is round 6 at Stamina 6, round 8 at Stamina 11 and round 11 at Stamina 16, with or without the share.

**Injury multiplier:** in a round whose start Freshness F < 60, injury chance × min(1.4, 1 + 0.006 × (60 − F)) (×1.06 at 50, ×1.12 at 40, ×1.36 at 0), folded into the lineup screen's per-round estimate.

**Player information:** lineup and squad screens show each fighter's bar, value and label, the rating he is worth at that Freshness (the effective rating, sys-fight-freshness; O28), the forecast after a typical match and **"Ready for ≈ N more rounds"**; the fighter card shows "Drains 4.2 a round · recovers +46 a week of rest"; the between-round screen shows the value now, this round's change and the effective rating (O30); the digest lists rested fighters; injury estimates show the multiplier ("× 1.06 (Tired)").

**Edge cases:** a missing value reads as 100; values are clamped 0–100; a hired blade starts at 100; a transferred fighter keeps his value; an emergency entrant uses his own value and drains normally. Freshness is committed per round with the round (P-05).

**Worked example (EXAMPLE):** a human aged 26 with Stamina 16 (base 4.2) starts four straight matches untired (100 → 87.5 after three rounds, then 79.1, 66.5, 58.1) and would start the fifth Tired at 58.1; an AI club rests him at that lock because 58.1 < 60 + 4.2. From a Tired start each round costs half (for the Stamina-16 human about 2.1 instead of 4.2). A human aged 34 with Stamina 6 locked in at 64.0 drains 10.9 in a brutal round 1 (38 s, 110% taken, downed) to **53.1**; the player swaps him out; he keeps 53.1 for the match, earns 10 XP for round 1 and no bench XP, and next week recovers +30.6 if left out of the squad, or +24.5 as an unused reserve.

**Acceptance cases:** frs-001 to frs-011, ai-001, ai-002 (§9.4).

#### sys-traits: Crusader-Kings-style traits

**Status:** "randomized traits, about 80% positive and 20% negative, Crusader Kings style" is REQUIRED (O5). The taxonomy, catalog, roll and numbers are PROPOSED (open-012, C-6), informed by research Part D. The ±3 cap on stat adds is DELEGATED (D-F). Reveal tiers are M4 scope, and academy teaching and curing of traits are M5 scope (R5, sys-academy).

**Purpose:** fighters read as people at a glance, with one icon, one line and one number per trait. Traits shift numbers, development and relationships, and they **never** take control: no trait skips, reorders or overrides a rule (P-06).

**Taxonomy** (`traits.json`, 60 traits; the catalog with names, effects and authored `effectText` is the source of truth):

| Category | Boons | Edges | Burdens | Flaws | Total |
| --- | --- | --- | --- | --- | --- |
| Temperament (nerve, pride, sociability, ambition; opposite pairs) | 4 | 1 | 4 | 1 | 10 |
| Physique (congenital; never gained or lost) | 7 | 1 | 4 | 0 | 12 |
| Fighting Style (conditional in-fight habits) | 4 | 1 | 3 | 1 | 9 |
| Mind & Discipline (learning, training, aging) | 4 | 2 | 1 | 2 | 9 |
| Leadership & Social (captaincy, mentoring, chemistry, economy hooks) | 5 | 0 | 3 | 0 | 8 |
| Acquired ("storied": earned or suffered, never rolled) | 6 | 0 | 1 | 5 (scars) | 12 |

Kinds (research D3): **boon** (pure positive), **edge** (net positive with a drawback), **burden** (net negative with a real upside), **flaw** (pure negative; every rolled flaw is curable). Rarity: common ≥ 8% of fighters, uncommon 4–8%, rare < 4%, storied never rolled.

**Roll** (stream `traits`):
1. n = 2 (30%), 3 (50%) or 4 (20%).
2. One negative with probability 0.2 × n (40%, 60% or 80%), otherwise none.
3. The negative is rolled first, then the positives, each weighted by rollWeight × raceWeight among eligible traits: not held; no opposite or exclusion either way; not the same exclusive group (frame); at most 2 per category; rookie-only traits (Green Nerves) only at human-age ≤ 21.
4. An empty pool leaves the slot empty. Polarity never swaps, so at most one negative is guaranteed.

Monte Carlo over 100,000 fighters: mean 2.90 traits; realized positive share **79.9%** (each race 79.8–80.1%); 58% of fighters carry one negative, 42% none, none two.

**Effect ownership** (every type in `traits.json` effectTypes names its owner; boundary contract 3):
- *Management-applied* (before or outside the fight): `stat` (whole points, at most ±3 per stat per trait, D-F; included in setup stats), `contextStat` (tournament), devClock, declineMult, declineShift, xp, trainingEmphasis, injuryChance, recovery, scarChance, retirement, captaincy, mentor, the chemistry terms, ruleSlots (M3), and economy hooks (fanAppeal, wageDemandMult, loyalty).
- *Sim-applied* (sys-fight-traits): `combat`, `enemyComposureAura`, `shakenImmune`, `captainRally`. Eighteen traits carry them.

**Gain and loss** (every rule is visible on the card, with progress or odds):

| Trait | Rule | Checked |
| --- | --- | --- |
| Green Nerves | fades at 120 career rounds | match end |
| Hot Blood | mellows: 15% a season from human-age 30 | season end |
| Skittish | 50% cure on gaining Sand-Wise | on gain |
| Idle Hands | 25% cure after a full season under a grade-A captain with usage ≥ 0.5 | season end |
| Flinches | 25% cure a season under a grade-B-or-better captain with usage ≥ 0.5 | season end |
| Wandering Mind | 25% cure after a season with Mind emphasis for at least half the weeks | season end |
| Glory-Hungry | 50% satisfied when Title-Tested is gained | on gain |
| Sand-Wise | acquired at 300 career rounds | season end |
| Wore the Armband | acquired after 32 matchweeks as club captain (across clubs) | week processing |
| Title-Tested | started a round of a won Reckoning final, or of the title-clinching league match | on event |
| Back from the Brink | first round started after a serious injury | on event |
| Long Road | human-age ≥ 33 and ≥ 12 pro seasons | season end |
| Scars, Pain-Tempered | from injuries (sys-injury) | on injury |

Physique traits never change. Limits: at most 4 rolled traits and 8 traits in total; an acquired trait that would exceed 8 is skipped and logged (the injury itself still applies).

**Player information:** each trait shows an icon, name, flavor line and effect line, with its kind as a color (boon, edge, burden, flaw). From M4, unrevealed traits show "?" by reveal tier (`traits.json` revealOrder), with negatives revealed last.

**Worked example (EXAMPLE):** an orc rookie (human-age 20) with n = 3. The negative roll passes (60%) and draws Hot Blood (weight 4 × orc 1.8). The positives are Thick Hide, then Thunder Opener; Still Water is ineligible as Hot Blood's opposite. Management-applied: cmp −2 and tgh +2 in setup stats, captaincy −8. Sim-applied: +8% damage below 50% HP, and +10% damage in the first 8 s of a round.

**Acceptance cases:** trait-001 to trait-008 (§9.2).

#### sys-captaincy: club captain, captaincy rating and consequences

**Status:** "each club has a captain; stats, traits and skills make a fighter a good or bad captain" is REQUIRED (O6). The model is PROPOSED (open-011; C-11 captain-change costs and C-12 poor captains hurt). AI timing is DELEGATED (D-I). The automatic interim captain is DELEGATED (D-S). In-fight effects are in sys-fight-captain (DELEGATED, D-G).

**Purpose:** choosing a captain is a real roster decision with visible upside (reliability in fights, development of the young, chemistry), and changing it or passing over a senior fighter has a price. Captaincy improves reliability, not damage.

**Entities and state:** club `captainId`, `viceCaptainId` (optional, never equal to the captain), `captainAtLastLock`, `captainSinceWeek`, `captainNotFieldedStreak`, club status `captain_departed`. Fighter `matchweeksAsClubCaptain`; statuses `snubbed`, `passed_over`, `losing_the_room`.

**Captaincy rating CQ (1–100)**, recomputed at every lineup lock and at season end: CQ = round(0.45 × L + 0.25 × C + 0.10 × E + 0.10 × S + 0.10 × St) + youth + traits + statuses, clamped to 1–100, where L = effective leadership × 5; C = effective composure × 5; E = min(100, careerRounds ÷ 5); S = min(100, matchweeksAtClub × 100 ÷ 95); St = clamp(50 + 3 × (rating − mean rating of the club's 5 best fit fighters), 0, 100); youth = −10 below human-age 22; trait adds from Rallying Voice +12 to Walks Alone −15; Losing the Room −10.

**Grades** (`development.json` captaincy.grades):

| Grade | CQ | Aura (sim) | Rally (sim) | Mentoring (human-age ≤ 23) | Chemistry |
| --- | --- | --- | --- | --- | --- |
| A Inspiring | ≥ 90 | +2 composure | +3 composure, 5 s | ×1.08 | +2 |
| B Steady | 70–89 | +1 | +2 | ×1.05 | +1 |
| C Adequate | 55–69 | 0 | +1 | ×1.02 | 0 |
| D Shaky | 40–54 | 0 | none | ×1.00 | 0 |
| E Divisive | < 40 | −1 | none | ×0.97 | −1 |

The grade-A threshold was raised from 85 to 90 in m1/fix-tuning, because 48% of AI captains reached grade A at 85 (target 10–35%).

**Player action:** appoint a club captain and optionally a vice-captain at any time outside a match. It is free and reversible until the next lineup lock. Naming a captain is never required to play (D-S).

**Resolution procedure:**
0. **Automatic interim captain** (D-S, at each lineup lock, every club, player and AI alike): a club whose club captain is missing (none named, or no longer on the roster) gets the vice-captain if he is fit, else the fit starter in the club's current lineup with the highest CQ (ties: more matchweeks at the club, then fighter id), as club captain; a vice-captain who moves up leaves the vice role empty. The club's digest gets a `captain.interim` item naming him and the reason (vice or starter). There is no "choose a captain" blocker. A captain who is on the roster but unavailable keeps the role.
1. **Lineup captain at lock:** the club captain if fielded; else the vice-captain if fielded; else the highest-CQ fielded fighter (ties: seniority, rating, fighter id). The fight setup receives that fighter's CQ, minus 10 unless he is the club captain.
2. **Change evaluation at lock**, only if the club captain differs from the one at the previous lock:
   - **Snubbed** (6 matchweeks; −2 chemistry when fielded) goes to the previous captain if he is still at the club, fit, held the role ≥ 4 matchweeks, and no exemption applies. Exemptions: he is injured with ≥ 4 weeks left, in his final season, the change is made before MW1, or he is made vice-captain at the same lock.
   - **Passed Over** (6 matchweeks, or until made vice-captain; −1 chemistry) goes to each fit club-mate with human-age ≥ 30 and CQ ≥ the new captain's CQ + 15 who is not vice-captain.
3. **Captain Departed:** a club captain who held the role ≥ 19 matchweeks and leaves mid-season (release, from M6 sale, or career-ending injury) gives the club `captain_departed` (4 matchweeks, −1 chemistry). The interim captain is named by rule 0 (D-S) and flagged in the digest.
4. **Losing the Room:** a fit club captain not fielded in 4 or more consecutive matches gets −10 CQ until fielded again.
5. Mentoring is applied in sys-development at season end, pro-rated by weeks in the role. Wore the Armband comes at 32 matchweeks as club captain.

Changing captain A → B → A between two locks costs nothing, because only locks are compared.

**AI captain timing** (D-I, agreed between the drafts): an AI club names its club captain at the season-end AI phase for the coming season (in effect at P1) as the highest CQ among its five projected starters (ties: seniority, rating, fighter id), and replaces an incumbent at that point only if a challenger exceeds him by ≥ 5 CQ (hysteresis, `economy.json` ai.captainHysteresis). Mid-season it changes captain only when the role falls vacant, or when the captain is injured with ≥ 4 weeks remaining (an exempt change). An AI club therefore never triggers Snubbed. Its vice-captain is the second-highest CQ among the projected starters, updated at each lineup lock. In season 1 the AI's season-start setup (captains, vice-captains, training emphasis, opening offers) runs for every club at world creation, before P1 (D-P).

**Player information:** a captain panel ranks the roster by CQ with grades and a component breakdown, predicts the consequences of a change ("Rook Saltmere will be Snubbed: −2 chemistry for 6 weeks"), and states the in-fight effect at this grade. The lineup screen shows who leads if the captain falls.

**Edge cases:** hired blades can be acting captain when no fit fighters remain. Statuses travel with the fighter between clubs.

**Worked example (EXAMPLE):** a veteran with leadership 13, composure 13 (Quiet Steel included), 350 career rounds, 60 matchweeks at the club, rating 68 against a top-5 mean of 66, with Quiet Steel and Wore the Armband: 29.25 + 16.25 + 7 + 6.32 + 5.6 = 64.42 → 64, + 6 + 6 = **76, grade B**. A 22-year-old orc with Hot Blood (leadership 8, composure 6, 120 rounds, 19 weeks) scores 35 − 8 = **27, grade E**.

**M1.1:** "fielded" for Losing the Room means started a round **or was named a squad reserve**; a match in which the fit club captain is left out of the squad while his Freshness at the lock is below 60 is a **rest** and neither extends nor resets the count. The acting captain after a swap or injury follows sys-match (vice if active, else highest CQ, at CQ − 10). Mentoring divides the young fighters' xpNeeded (cap 1.15).

**Acceptance cases:** cap-001 to cap-011 (§9.2); cap-012 (§9.4).

#### sys-chemistry: lineup chemistry (new id)

**Status:** DELEGATED (D-D): in M1, chemistry is limited to these lineup modifiers from traits, the captain's grade and captaincy statuses. There is no broader morale system in M1. It is structural and visible (P-17). Values in `development.json` chemistry.

**Procedure** (at lineup lock, for the 5 fielded fighters): chemistry = Σ trait chemistry terms (chemistry adds; same-race terms such as Kin-Bound; clash pairs such as two Glory-Hungry fighters; pair bonuses such as Title-Tested; the captain's own trait terms count double) + the club captain's grade term + status terms (Snubbed −2, Passed Over −1, Captain Departed −1), clamped to −5…+5. Each fielded fighter without Walks Alone gets composure + chemistry ÷ 2 (rounded toward zero) in his setup stats for the match. Setting `composureDivisor` to 0 disables the system.

**Player information:** the lineup screen shows "Chemistry +3 (+1 composure each)" with a line per source, recomputed live as the lineup changes.

**Worked example (EXAMPLE):** Good Company (+1); two dwarves, one Kin-Bound (+1); two Glory-Hungry fighters (−1); a B captain (+1); the snubbed former captain fielded (−2). The total is 0, so no composure change. Benching the snubbed fighter gives +2, which is +1 composure each.

**M1.1:** chemistry is computed at the lock for the **five starters** and kept for the whole match; an entering reserve or emergency entrant gets the same composure modifier (unless he is immune), his own chemistry terms do not count, and swaps never recompute it.

**Acceptance cases:** chem-001, chem-002 (§9.2); chem-003 (§9.4).

### 3.3 League and economy systems

**Status for §3.3:** caps, 16 matches, the 8-club tournament, wages and budgets are REQUIRED (O2, O9, O10). The league structure, points, the Reckoning, promotion and relegation, the budget and wage-budget model, the failure ladder, offer timing, soft landings, contract costs, the tessel display name and 2.5 world-generation free agents per club are DELEGATED (D-C, which adopts the economy draft's confirmations except the M1 patron goal). Every number is PROPOSED · TUNABLE in `leagues.json`, `clubs.json` and `economy.json`. Integer basis points (bp) express every ratio (10,000 bp = 100%), and products of two bp factors are evaluated as a × b × c ÷ 10⁸.

#### sys-league: regions, tiers, wings, fixtures, standings, promotion and relegation

**Purpose:** a ladder the player can climb, with known rivals met twice, a top-4 race in every wing, and promotion and relegation stakes in every tier.

**Structure** (DELEGATED, D-C; this supersedes open-014's 17-club recommendation). One league region, **Saltmarch**, hosts **3 tiers × 16 clubs = 48 clubs**: tier 1 **Crown Circuit**, tier 2 **Banner Circuit**, tier 3 **Muster Circuit**, with roster caps 14 / 12 / 10 and academy capacity equal to the cap (O2). Emberreach and Thornwald are talent pools only until M6 (open-027). Each tier splits into two 8-club **wings**, **Dawn** and **Dusk**, redrawn every season. A double round-robin inside the wing (14 matches) plus 2 cross-wing matches gives **16 matches per club, 8 home and 8 away, with no byes**: 8 fixtures in every tier in every matchweek (O9). 48 clubs cost 384 league and 21 Reckoning matches per season in the headless sim.

**Entities and state:** Region `{id, name, hostsLeagues, districts[]}`. Tier `{id, regionId, level, name, clubCount 16, rosterCap, academyCapacity, basePrestige 70/45/20, ratingBand}`. League (one tier, one season) `{seedOrder[16], wings {dawn[8], dusk[8]}, fixtures[], standings}`. Fixture `{id, competition: league or tournament, season, weekId, tierId, home, away, bestOf, venueId, result?}`, whose id doubles as the seed identity (03 §1). Standings row `{played, wins, losses, points, roundsWon, roundsLost, downsFor, downsAgainst}`. Club league state `{tierLevel, wingId, prestige, history[]}`.

**Schedule generation** (next-season setup and new career; stream `schedule`):
1. **Seed order.** Season 1: clubs by `startPrestige` descending, ties by club id. Later seasons: clubs relegated from the tier above (by final tier-table rank), then clubs that stayed (by rank), then clubs promoted from below (the Reckoning champion first, then the Shield route).
2. **Serpentine draw:** seed position i (0-based) goes to wing [dawn, dusk, dusk, dawn][i mod 4], so each wing's seeds sum to 68.
3. **Slot shuffle:** a Fisher–Yates shuffle of each wing's 8 clubs into slots 0–7 with Rng(root, schedule, season, tierId, wingId).
4. **Circle method**, rounds r = 0–6: slot 7 plays slot r, hosting when r is odd. For k = 1–3, a = (r + k) mod 7 plays b = (r − k + 7) mod 7; a hosts when k is odd, b when k is even.
5. **Second half:** wing rounds 8–14 repeat rounds 1–7 in the same order with venues swapped.
6. **Matchweeks:** wing rounds 1–14 are played in MW 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16.
7. **Cross-wing weeks:** MW5 pairs dawn[k] with dusk[k], and MW12 pairs dawn[k] with dusk[7 − k], where k is a club's order within its wing. In odd seasons dawn hosts at MW5 and dusk at MW12; even seasons swap.
8. **Validate:** 16 fixtures per club; 8 home and 8 away; each wing pair meets twice with venues swapped; 8 fixtures per tier per matchweek; no club twice in a week. A failure is a programming error and throws (2,000 random seed orders tested: 0 failures; longest home or away run 3).

**Standings and tiebreaks** (DELEGATED, D-C). Points come from the regular season only: **3 / 2 / 1 / 0 for 2–0 / 2–1 / 1–2 / 0–2**. Ties are ordered by, in turn: (1) points; (2) match wins; (3) round difference; (4) head-to-head points among the tied clubs, only if every pair of them met equally often (always true inside a wing); (5) rounds won; (6) downs difference; (7) lot, by ascending hash(root, schedule, season, tierId, clubId). When a criterion separates part of a tied group, each remaining subgroup restarts at criterion 4. Two tables are kept: the **wing table** (qualification and relegation) and the **tier table** (seeding, the Shield, table prize, promotion via the Shield).

**Promotion and relegation** (DELEGATED, D-C; season-end step 3; every adjacent tier pair, from the same season's final tables, so no club moves two tiers):
1. The upper tier relegates the **8th-place club of each wing** (2 clubs).
2. The lower tier promotes its **Reckoning champion** and its **Shield** winner (tier-table first place). If they are the same club, the next-highest club in the lower tier's table goes up instead.
3. Tier 1 promotes no one and tier 3 relegates no one. A promotion playoff stays disabled (FUTURE).
4. Flags are set for sys-finance (parachute, promotion grant, ascension) and sys-contracts (drop clause).

**Prestige** (0–100; season-end step 4; `economy.json` prestige): delta = tableTerm + tournamentTerm + movementTerm − advancePenalty, where tableTerm = (17 − 2 × tierRank) × 3 ÷ 8 toward zero (rank 1 → +5, rank 16 → −5); the Reckoning gives +1 (QF exit), +2 (SF exit), +3 (finalist), +5 (champion); promotion +8; relegation −8; each Registry advance −5. new = clamp(old + delta − (old + delta − newTierBase) × 25%, 0, 100), the reversion term truncated toward zero (`reversionBp` 2,500 since m1/fix-tuning, up from 15%). Prestige feeds the sponsor retainer, gate, asks and free-agent tie-breaks.

**Table prize** (paid at season end): floor10(tablePrizeTop × (17 − rank) ÷ 16), with tops 25,000 / 10,000 / 4,000.

**Player information:** wing and tier tables with the top-4 line, the 8th-place line and the promotion places (the champion route shows "TBD until the final"); fixtures with home, away and venue; prestige with its last change and reasons.

**Acceptance cases:** le-001 to le-008, le-029 (§9.3).

#### sys-calendar: season weeks, week processing, season end

**Status:** one season per in-game year is REQUIRED (O3), as are 16 matches and a 3-round tournament (O9). The weeks and both processing orders are DELEGATED (D-C) and merge the lifecycle and economy orders.

**Weeks** (`leagues.json` calendar.weeks; 23 played weeks, index 1–23):

| Index | Week | What happens |
| --- | --- | --- |
| 1 | **P1 Trials Day** | Season and wage budgets shown; first central-grant installment credited at setup. Trials rookies exclusive to their club (season 1: one per club, D-P). Final-season announcements. The free-agent market opens with the AI's opening offers already pending (season 1 too: the AI's season-start setup runs at world creation, D-P) |
| 2–3 | P2, P3 | Market rounds, renewals; over-cap clubs release fighters (cap relief) |
| 4 | **P4 Kick-off week** | The Kick off commit at the end of P4 (02 §3) |
| 5–20 | MW1–MW16 | One fixture per club every week; MW5 and MW12 are cross-wing. Second central-grant installment at the MW8 processing. AI renewals begin at MW4 |
| 21–23 | TW1 quarterfinal, TW2 semifinal, TW3 final | The Reckoning. Clubs with no fixture still pay wages and costs, and may "Advance to season end" |

**Week processing** (started by Play match in a week with an own fixture, otherwise by Continue; atomic for all clubs; in this order). **Season 1, P1 only (D-P):** before step 1, AI clubs sign their trials rookies (the only part of the AI's season-start setup not run at world creation).
1. **Lock and play** (D-O): automatic interim captains where a captain is missing (sys-captaincy rule 0, D-S); lineup lock for every club; hired blades; then every fixture of the week is simulated, the player's included. M1 has no separate "play my match first" step: the player's Play match starts this processing. **M1.1:** the player's match is played round by round (sys-match): the AI matches and the player's round 1 run, then the processing waits at each between-round step as pacing allows (`GameState.liveMatch`), and the rest of the week runs once the match is done. Each round and decision is committed as it happens; the week is still committed and autosaved before the report opens (D-O).
2. Record results: standings, the bracket, and with each match its XP and injury rolls (sys-development, sys-injury), plus the Green Nerves check.
3. **Lifecycle weekly step:** injury and status countdowns, week-processing trait checks (Wore the Armband), captain streaks; M1.1: Freshness weekly rest (sys-freshness). Level-ups are checked at each match end, after its result (sys-development).
4. **Income:** home gate, sponsor retainer installment, win bonuses, scheduled grant installment.
5. **Costs:** wages for every fighter on a roster at the start of this processing, hired blades used this week, operating cost.
6. **Financial status:** Watch, embargo, debt-week counter, Registry advance.
7. P1 only: unsigned trials rookies enter the free-agent pool.
8. **Free-agent decisions** (sys-transfers).
9. **AI action phase**, clubs in tier then id order: renewals, releases, new offers, counter replies, training emphasis, and the lineup, captain choice and vice-captain for next week's fixture (sys-ai-manager).
10. Free-agent pool top-up to its floors (sys-transfers).
11. Advance the calendar, build the digest, and commit: the whole week, the player's result included, is committed atomically and autosaved **before the match report opens** (D-O). The report reads the committed result, so there is no reroll by reloading (P-05, open-016).
12. **Compact aged results** (O24; `league.compactAgedResults`): matches between other clubs that are 3 weeks old or more lose their detail (sys-match-report). It is part of the same commit and runs before the store's autosave.

**Season-end processing** (a step, not a week: no wages, and it does not count toward debt weeks; AI clubs go through the same steps):
1. Reckoning complete; placings fixed; titles recorded (Reckoning champion, Shield).
2. Table and tournament prizes paid. There are no patron bonuses in M1 (D-C).
3. Promotion and relegation decided.
4. Prestige update.
5. M5: academy graduation.
6. **Aging and development** (lifecycle), with the age held during the season: development and wear; acquired-trait and trait-loss checks; captaincy recompute; each fighter's retirement chance computed; then age +1. **M1.1: Aging** only: pending level-ups auto-resolve, then wear, trait checks, captaincy, retirement chance (usage from round XP), age +1 and xpNeeded recomputed; there is no development step (sys-development).
7. **Retirements** rolled with the chance from step 6. Career-ended fighters and fighters in a final season retire without a roll. Their contracts end with no payout.
8. **Contract expiries:** unrenewed fighters become free agents, with `formerClubId` kept.
9. Off-season injury recovery: 8 weeks. M1.1: Freshness reset to 100.
10. M4: knowledge decay.
11. M6: patron review.
12. **Pool maintenance:** free agents unsigned at 3 consecutive season ends leave the league (2 until m1.1/tune-life).
13. **Next-season setup:** tier membership; wing draw and fixtures; caps; drop clause and tier-minimum raise; Registry deduction, grant installment 1, parachute and promotion grant; season and wage budgets; the rookie intake generated (sys-youth-intake) and assigned for trials day; embargo re-evaluated.
14. **AI action phase:** trials-rookie signings, cap-relief releases, opening free-agent offers for P1, club captain and vice-captain for the new season (D-I).
15. Autosave, then the season-end review screens (02 §2 step 10).

**Digest triggers:** offer accepted, countered, refused or lost; rival offers on a shortlisted fighter; contracts expiring this season (listed from P1, highlighted at MW4, MW12 and TW1, and one urgent `contract.expiring` item per unrenewed player contract at the processing that leaves 4 weeks in the season, `economy.json` contracts.expiryReminderWeeksBeforeEnd); contracts raised to the tier minimum at setup (`contract.minimum_raise`); Watch, embargo entry and exit, Registry advance; tournament place clinched or lost; relegation zone entered or left; injuries and returns; a fit count of 5 or fewer for next week; final-season announcements; trait gains and losses.

**Cancellation:** none after Continue. Before it, pending offers can be withdrawn. The debt counter carries over the season boundary unless the balance is ≥ 0 at setup.

#### sys-tournament: the Reckoning

**Status:** 8 clubs, QF/SF/F REQUIRED (O9); format DELEGATED (D-C).

**Procedure** (after MW16 processing):
1. **Qualify** the top 4 of each wing table.
2. **Seed:** the two wing winners are seeds 1–2, ordered by the tier table; the other six qualifiers are seeds 3–8, ordered by the tier table.
3. **Quarterfinals (TW1):** 1v8, 4v5, 2v7, 3v6, best-of-3, hosted by the higher seed. **Semifinals (TW2):** W(1v8) v W(4v5) and W(2v7) v W(3v6), best-of-3, higher seed hosts. **Final (TW3):** best-of-5 at the neutral **Charterhall**, where the higher seed is the home side for the sim (the west end) with no other advantage (open-013).
4. Every match produces a winner. There are no replays or byes.
5. **Gate:** quarterfinal and semifinal home gates are ×1.5; the final gate is ×2.0, split evenly between the finalists (odd gold to the higher seed).
6. **Prize** by the furthest round reached, not cumulative (`economy.json` tierProfiles.tournamentPrize). Each qualifier also earns the sponsor's tournament bonus.
7. Eliminated clubs and non-qualifiers have no fixture and may Advance to season end.

**Player information:** the bracket from MW13 as a live "if the season ended today" projection, and the qualification line in each wing table.

**Worked example (le-005):** Dawn finishes A 40, B 36, C 33, D 30 (5th 28); Dusk finishes E 38, F 37, G 31, H 29 (5th 32). Seeds: 1 A, 2 E, 3 F, 4 B, 5 C, 6 G, 7 D, 8 H. QF: A–H, B–C, E–D, F–G. Dusk's 5th (32 points) misses out although H (29) qualifies, because the cut is per wing.

#### sys-roster: cap, lineup, eligibility, hired blades

**Status:** caps and the academy as a separate pool are REQUIRED (O2), interpreted per open-002. Hired blades follow open-006. Cap relief is DELEGATED (D-C, soft landings).

- **Cap:** that of the tier the club plays in this season, from next-season setup. It is hard: an offer, trials signing or (from M5) call-up is refused if roster + pending offers + 1 > cap. The only legal over-cap state is the one relegation creates. Such a club may not add fighters, must be at or under the cap by the Kick off commit (the player) or the P4 AI phase (AI), and may release up to roster − cap fighters during P1–P4 with **no payout** (cap relief).
- **Squad (M1.1, O20):** the lineup's 5 starters plus 0–2 named **reserves** (`squad.set`), all fit; reserves may enter between rounds (sys-match). A fit roster fighter outside the squad earns bench XP and rests (the interface calls the two squad reserves Match reserve and a roster fighter outside the squad Bench). **Naming the squad (O29, O31; PERMITTED-CHOICE as built in R002):** bringing a match reserve into the five hands his reserve place to the starter he replaces, in one `squad.set` of the five and the reserves (the displaced starter must be fit to be named a reserve), and a bench fighter who comes in still sends the starter to the bench; Undo restores the five and the reserves together. The roster table marks the two reserves R1 and R2 in the order they were named (04 ui-squad).
- **Lineup lock:** 5 distinct roster fighters who are fit and were on the roster at the start of the week, a row and a preset each (O1, O6, D-N, open-010); the lineup captain follows sys-captaincy, and a missing club captain is filled automatically at lock (D-S), so a lineup is never blocked for want of a captain. A fighter signed at week processing w can play from week w + 1; a trials rookie signed during P1 can play from MW1.
- **Hired blades** (open-006): if fewer than 5 fit fighters exist at lock, the Charter Registry assigns generated fighters (sys-fighters, other generated kinds) at the tier band minimum. They are paid the tier minimum wage (260 / 150 / 60) for that week, sit outside the cap, are labelled in the lineup and report, and leave after the match. The digest warns a week ahead when next week's fit count is 5 or fewer.
- **Minimum roster:** none as a rule, because hired blades guarantee a lineup. AI clubs aim for at least 8.

**Acceptance cases:** le-009, le-014, le-024 (§9.3); sqd-001, sqd-002 (§9.4).

#### sys-finance: budgets, ledger, income, costs, embargo

**Status:** "clubs get budgets" and "fighters play for wages" are REQUIRED (O10). The model (open-028), the failure ladder (open-007) and the soft landings are DELEGATED (D-C). Values in `economy.json` tierProfiles, income, budget, finance.

**State:** `ClubFinance {balance, seasonBudget, wageBudgetPerWeek, wageBill, pendingWages, pendingSigningCosts, status: healthy, watch or embargo, debtWeeks, registryDebt, parachuteSeasonsLeft, ascensionSeasonsLeft, ledger[]}`. Ledger entries are `{season, weekIndex, category, amount, refId?}`, with categories centralGrant, parachute, promotionGrant, sponsorRetainer, sponsorWinBonus, sponsorTournamentBonus, gate, tablePrize, tournamentPrize, registryAdvance, wages, hiredBlades, signingCost, releasePayout, operations. (The patronBonus category exists for M6 only.)

**Income** (Crown / Banner / Muster at par prestige):

| Source | Rule | Values |
| --- | --- | --- |
| Central grant | By tier; 50% at setup (P1) and 50% at the MW8 processing; reduced by any Registry deduction | 82,000 / 34,000 / 14,000 |
| Sponsor retainer | base × (10,000 + clamp(60 × (prestige − tierBase), −1,500, +1,500)) ÷ 10,000, in 23 equal weekly parts | 46,000 / 18,800 / 7,200 |
| Sponsor bonuses | Per match win (league and Reckoning); once for qualifying for the Reckoning | win 1,200 / 500 / 200; qualify 6,000 / 2,500 / 1,000 |
| Gate (home fixtures) | gateBase × (10,000 + prestigeAdj + formAdj + fanAppealAdj) × stageBp ÷ 10⁸. prestigeAdj = 50 bp per prestige point over the tier base (−1,500 to +1,500); formAdj = −1,000 + 2,000 × wins ÷ matches this season before this fixture (0 before the first match); fanAppealAdj = +200 bp per fan-appeal trait point in the home lineup (max +1,000) | 9,250 / 3,700 / 1,400 per home match |
| Table prize | floor10(top × (17 − rank) ÷ 16) | top 25,000 / 10,000 / 4,000 |
| Reckoning prize | By round reached | champion 38,000 / 15,000 / 6,000 (finalist ½, SF ¼, QF ⅛) |
| Promotion grant | Once, at setup of the first season in the new tier | 20,500 into Crown, 8,500 into Banner |
| Parachute | (old grant − new grant) × 50% in the first season after relegation, × 25% in the second; stops if promoted again | 24,000 then 12,000 into Banner; 10,000 then 5,000 into Muster |

**Costs:** weekly wages (sys-contracts); hired blades; signing costs and release payouts; an **operating cost** per week of 1,300 / 530 / 210 (the only facilities-type sink in M1).

**Season budget and wage budget** (fixed at next-season setup for the whole season; non-rolling):
- **Season budget** SB = grant due this season (after deduction) + parachute + promotion grant + sponsor retainer + 8 × projected regular-season gate (formAdj 0, fanAppealAdj 0). It is shown on club cards and at P1.
- **Wage budget per week** WB = floor((SB × (wageRatioBp + ascensionBp) + reserveContribution × 10,000) ÷ (10,000 × 23)). wageRatio is 8,000 / 7,800 / 7,600 bp; ascensionBp is +800 in the first season after promotion. reserveContribution = min(SB × 10%, max(0, balanceAtSetup − SB × 15%) × 50%), so savings, prize money included, buy more wage room next season, within a cap (`reserveCapBp` 1,000 since m1/fix-tuning, down from 25%). balanceAtSetup is the balance before the setup's grant installment is credited (D-P).
- **Commitment rule (hard).** A free-agent offer, trials signing or renewal is legal only if (renewals, and signings that start next season, use the next-season room below) wageBill + pendingWages + newWage − replacedWage ≤ WB, or the change does not raise the bill, **and** balance − pendingSigningCosts ≥ signing cost. Both checks run at submission and again at resolution, where a failing offer is void. Releases are always allowed, and their payout may push the balance below 0.
- **Next-season wage room** (O32; PERMITTED-CHOICE as built in R002). A renewal's terms start at next-season setup, and a contract that ends this season is gone by then, so the wage check of a **renewal**, and of a free-agent offer made while the season-end step is pending (it starts next season), uses next season's room instead of this season's bill: room = projected wage budget − commitments. The *projected wage budget* is the club's current WB, a projection that assumes no promotion or relegation and an unchanged prestige and reserve (the real WB is set at next-season setup). *Commitments* are the contracts that continue into next season at their current wage, plus the agreed renewals at the agreed wage, plus the pending offers that would still be running next season (made for next season, or for 2 or more seasons). **A contract that ends this season and is not renewed is not counted**; renewing him adds his new wage. A renewal is legal only if commitments + the new wage ≤ the projected WB, or his new wage is no higher than his old one (that exemption stays). Not projected: tier-minimum raises and the relegation drop clause applied at setup, and wage changes from level-ups (wages are contract terms). Everything that starts this season (in-season free-agent offers, trials signings) keeps this season's rule; embargo, cash, cap and the other checks are unchanged. One rulebook (P-04): the same check judges every club's renewals (sys-ai-manager, open-033).
- **Known gap** (PERMITTED-CHOICE as built; 05 §12 KI-20): a multi-season free-agent signing made in season is judged on this season's room only. It counts as a continuing commitment for later renewals, but nothing re-checks it against next season's room.

**Status ladder** (open-007; DELEGATED, D-C; clubs never fold; AI identical):
1. **Watch** (advisory) when balance + Σ of the next 4 weeks (scheduled retainer parts, grant installments, projected home gates, minus the wage bill and operating cost) − pendingSigningCosts < 0.
2. **Embargo** at any week processing (or setup) that ends with balance < 0. While embargoed there is no offer or renewal above the **tier minimum wage**; a free-agent offer is allowed only at the tier minimum, length 1, with no signing cost, and only while the club has fewer than 5 fit roster fighters; there are no trials signings; from M5 no enrollment and from M6 no bids. The embargo lifts at the first processing (or setup) that ends with balance ≥ 0.
3. **Registry advance** after **8 consecutive** processings that end below 0: balance := 0, registryDebt += the debt, prestige −5. At each later setup the grant is reduced by min(registryDebt, 30% of grant), interest-free, until repaid.
4. M6: patron patience and dismissal (open-007). There is no game over in M1.

**Why there is no death spiral:** the hard commitment rule stops overspending at the source; the embargo shrinks the bill, because contracts expire and new ones are capped at the minimum; the advance clears the cash hole after 8 weeks; deductions are capped at 30% of a grant; relegation is cushioned by the drop clause and the parachute; and every club keeps receiving its grant and sponsor money.

**Player information** (O13, research C2.2 "costs shown where you spend"): the finance screen shows the balance; SB and its parts; WB as a bar (bill + pending ÷ WB); the projected end-of-season balance; the ledger by category and week; the status with its reason ("−497 ts after MW10 wages"); the Registry debt and next season's deduction. Every offer dialog shows the wage-budget room after signing and the signing cost; a renewal dialog and the Market's Renewals view show next season's projected room instead, with its parts and the contracts that are not counted (O32).

**Worked example (EXAMPLE; Banner club, prestige 50 against the tier base 45, balance 30,000 at setup):** retainer = 18,800 × 10,300 ÷ 10,000 = 19,364; gate = 3,700 × 10,250 ÷ 10,000 = 3,792 per home match, × 8 = 30,336; SB = 34,000 + 19,364 + 30,336 = **83,700**. Reserve floor 12,555; contribution = min(8,370, (30,000 − 12,555) × 50% = 8,722) = 8,370. WB = floor((83,700 × 7,800 + 8,370 × 10,000) ÷ 230,000) = **3,202 ts per week**. The first grant installment (17,000) is then credited as its own ledger entry, so the balance reads 47,000 at P1. At par prestige and the default starting balance the WB is 7,454 / 2,960 / 1,138 (SB 202,000 / 82,400 / 32,400).

**Acceptance cases:** le-015 to le-021, le-028, le-030, le-033 to le-035 (§9.3).

#### sys-contracts: wages, lengths, renewals, releases, expiry

**Status:** wages and contracts REQUIRED (O10, R6). Contract costs (signing 10%, release 50%, renewals in the final season only) and the drop clause are DELEGATED (D-C). The formulas and values are PROPOSED · TUNABLE (`economy.json` wage, ask, negotiation, contracts).

**State:** `Contract {id, fighterId, clubId, kind: standard or trialsRookie, weeklyWage, signedSeason, signedWeekIndex, endSeason, nextWage?, nextEndSeason?, dropClauseApplied}`. Hired blades get a one-week record outside the roster. `Negotiation {fighterId, clubId, season, patienceLeft, counterPrice?, counterValidUntilWeek?}`.

**Lengths:** 1, 2 or 3 seasons. A contract signed during season s with length L ends at the end of season s + L − 1, so the current season counts. A contract signed in the season-end AI phase is for the coming season. **Wages** are paid at each week processing for every fighter on the roster at the start of it; a free agent signed at processing w is first paid at w + 1; a trials rookie signed during P1 is paid from the P1 processing.

**Market wage** (independent of club):
- EQ = clamp(rating + min(potential − rating, 25) × potW(human-age) ÷ 10,000, 1, 100), with potW 4,000 bp up to human-age 23, 3,000 at 24, 2,000 at 25, 1,000 at 26–27, 0 from 28.
- curve(EQ) = linear interpolation of anchors 160 × 2^((EQ − 50) ÷ 12) (0.8× the draft's curve since m1/fix-tuning, so rosters near the cap fit the wage budget): 50 → 160, 60 → 285, 70 → 510, 80 → 905, 90 → 1,610.
- marketWage = floor5(curve(EQ) × (10,000 + ageAdj + traitAdj + roleDemandAdj + fanAppealAdj) ÷ 10,000).
- ageAdj is a step table by human-age (32: −600, 33: −1,200, … 39+: −5,000), a market discount for coming decline. traitAdj is +150 per positive trait and −150 per negative (with overrides by id), clamped to ±1,500. fanAppealAdj is +300 per fan-appeal point. roleDemandAdj is per role, all 0 at start.

**Ask** (one fighter, one club, one length): ask = clamp(floor5(marketWage × (10,000 + clamp(tierGap + prestige + length + greed + wageDemand + situation, −4,000, +6,000)) ÷ 10,000), club tier minimum wage, 4,000).
- calibre is tier 1 if rating ≥ 62, tier 2 if rating ≥ 47, else tier 3. tierGap = +1,500 per tier the club sits below the fighter's calibre, and −500 per tier above it.
- prestige = −20 bp per prestige point above the club's tier base (±400).
- length = +500 per season of difference from the preferred length: 1 if human-age ≤ 24 and potential − rating ≥ 8; 3 if human-age ≥ 32; else 2.
- greed = the fighter's greedBp, rolled −1,000 to +1,500 in steps of 100 (labels: Modest ≤ −400, Fair ≤ +700, Grasping above).
- wageDemand = (wageDemandMult − 1) × 10,000 from traits.
- situation applies to renewals only: +1,000 if he started < 25% of the club's matches this season; −500 if ≥ 60%; −300 after 3+ seasons at the club; −200 per loyalty trait point.

The base is club-independent, so promotion **does not** inflate an existing squad's wage demands (research C2.7). Tier minimum wages are 260 / 150 / 60 (raised from 200 / 110 in m1/fix-tuning to keep the median wage stable).

**Signing cost** (one-time, paid from the balance at signing): floor10(wage × remaining paid weeks × 10%). Trials rookies pay 0, and renewals 10% of the new guaranteed wages.

**Rookie scale** (D-P): on Trials Day a rookie's ask from his own club is capped at max(tier minimum, floor5(tier minimum × 1.25)), that is 325 / 185 / 75 (`market.trialsDay.maxAskBpOfTierMinWage` 12,500). On the open market he asks normally.

**Renewals:** allowed in any week of a contract's final season, by the holding club only, answered at once, and still allowed while the season-end step is pending, until the expiry step runs (polish round: the final-season check uses the season being played, because the market clock already reads the coming season then; the renewal situation counts starts in the season being played). The new terms start at season-end setup; meanwhile the old wage continues. The wage check uses **next season's wage room** (sys-finance, O32): the new wage must fit the projected wage budget less what continues, what other renewals agreed and what pending offers add, with contracts that end unrenewed not counted; a renewal that does not raise his wage is allowed whatever the room is (the other checks still apply).

**Negotiation** (one offer, one counter). ratio = offer × 10,000 ÷ ask (or ÷ the club's valid counter price):
- ratio ≥ 10,000: acceptable. A renewal signs at once, and a free-agent offer goes to decision.
- 10,000 − flex ≤ ratio < 10,000: the fighter counters at floor5((offer + ask) ÷ 2). flex is 1,500 for Modest, 1,000 for Fair, 500 for Grasping. A counter is valid until the end of the next week processing.
- Lower: refused, and patience −1. Patience is 3 renewal offers per season, and 3 free-agent refusals per (fighter, club) per season. At 0, the fighter will not deal with that club again this season; for a renewal, he leaves at season end.
- Offers above 1.5 × ask are capped.

**Release:** allowed at any time outside a match. payout = floor10(wage × remaining paid weeks × 50%), counting from the current week's processing to the contract's end, charged at once. The fighter joins the pool and cannot re-sign with the releasing club this season. Cap-relief releases after relegation pay 0.

**Expiry:** at season-end step 8. **Retirement** (step 7) ends a contract with no payout.

**Drop clause and tier minimum** (setup): every contract of a relegated club becomes max(new tier minimum, floor5(wage × 80%)). A contract below its club's tier minimum is raised to it (e.g. after promotion). Each raise is recorded on the ending season's `SeasonRecord.wageRaises` and reported to the player (news `contract.minimum_raise`; season review step 5).

**Worked example (EXAMPLE): Brannoc**, a human aged 23, rating 58, potential 64, Fair greed +400, with one positive and one negative trait. EQ = 58 + floor(6 × 0.4) = 60, so his market wage is curve(60) = **285**. His ask from a Banner club at prestige 50 for 2 seasons is 285 × (10,000 + 0 − 100 + 0 + 400) ÷ 10,000 = 293.5 → floor5 → **290 ts per week**. A Muster club (prestige 20) is asked 285 × 11,900 ÷ 10,000 → **335** (tier gap +1,500), and a Crown club at prestige 70 is asked 285 × 9,900 ÷ 10,000 → **280** (tier gap −500; at or above the Crown minimum 260). Signed at the P1 processing: 45 paid weeks, so the signing cost is floor10(290 × 45 × 10%) = **1,300**. An offer of 270 (ratio 9,310) draws a counter of floor5((270 + 290) ÷ 2) = **280**; 255 (ratio 8,793) is refused. Released while MW6 is the current week, with a contract to the end of next season: 37 weeks, so the payout is floor10(290 × 37 × 50%) = **5,360**.

**Acceptance cases:** le-010 to le-012, le-016, le-017, le-020, le-032 to le-035 (§9.3).

#### sys-transfers: the free-agent market

**Status:** free agents only in M1 (D-N), signable in any week (P-09). Resolution at week processing with reserved cap and wage room, and visible rival-offer counts, are DELEGATED (D-C). Pool targets and rookie counts are DELEGATED (D-C, D-H).

**Pool sources:** contracts expired at season end; released fighters; unsigned trials rookies (P1); world-generation free agents (**2.5 per club**, 120 at 48 clubs, D-C); journeymen generated to keep the pool at its floors. **Exits:** signing; retirement; leaving after 3 consecutive unsigned season ends.

**Pool floors** (`economy.json` market.pool): at least **60** free agents in season with at least **5 per role** family. After step 10 of week processing, a pool below either floor is topped up with journeymen. The P1 pool is expected to be 100–300; this is a soak target, not a top-up rule.

**Trials Day** (P-18): each club receives floor(rookies ÷ 48) of the season's rookies, and the remainder goes one each to clubs drawn by lot (stream `rookies`). They are exclusive to that club during P1, answer at once, ask at most the rookie scale (sys-contracts, D-P), and sign with **no signing cost**. AI clubs decide in the season-end AI phase (season 1: at the first P1 processing, D-P), and every AI trials signing is a 3-season deal; the player decides during P1. Unsigned trials rookies enter the pool at the P1 processing (step 7), before the AI acts. **Season 1** (D-P): exactly one rookie per club; the AI's opening offers were planned as if each club had already signed its rookie at his Trials Day ask, so they leave cap and wage room for him, and choosing a club withdraws the AI offers made for it, so the player makes that club's market decisions.

**Offers:** a club has at most one pending offer per fighter `{wage, length, destination: roster (M1) or academy (M5)}`, and at most 6 pending offers in total. Pending offers count against the cap and the wage budget, and their signing costs against the balance, from the moment they are made, and can be withdrawn until processing. AI clubs make their offers in the AI action phase, so they are visible to the player all week as **"rival offers: n"** (counts, not amounts). The AI never sees the player's offers (P-04: never counter-build against the player).

**Decision procedure** (week processing step 8; free agents by market wage descending, then id):
1. For each offer, the required price is the fighter's ask for that club and length, or that club's valid counter price. Offers from clubs he has stopped dealing with are refused.
2. score = offer × 10,000 ÷ required, + 1,000 if he would rank in that club's top 5 by rating (the starter bonus, `market.starterBonusBp` 1,000 since m1/fix-tuning, up from 500). Offers with offer ≥ required are acceptable.
3. Take the highest score among acceptable offers (ties: higher prestige, then higher tier, then lot). Re-check the cap, wage budget, cash and embargo. If the winner now fails, void it and take the next.
4. Sign: create the contract, charge the signing cost, remove him from the pool, and notify every bidder ("signed with X").
5. With no acceptable offer, the best offer with ratio ≥ 10,000 − flex receives a counter, valid through the next processing, and every other offer is refused (patience −1 for that club).

**Mid-season signings** work every week (MW1–TW3). The fighter plays from the next week, is paid for the remaining weeks only, and pays a pro-rated signing cost. M5 hook: an offer with destination `academy` checks academy capacity instead of the roster cap; per O3 the fighter may be enrolled in the week he joins.

**Player information (M1):** a market list with filters (role and class, race, age, rating, potential, ask, "fits my wage room", "would start for me", calibre tier, greed label), sortable, defaulting to market worth (market wage × 46). Each row shows rating, potential, age with the race's peak marker, traits, the **ask for my club at 1, 2 and 3 seasons** with the preferred length marked, the signing cost, the rival-offer count and the starter flag. A compare view takes up to 3 free agents against my fighters of the same role. A shortlist persists in the save. M4 hook: every value is read through sys-knowledge.view.

**Edge cases:** pending offers to a fighter who retires are void. An offer from a club relegated meanwhile is re-checked at resolution (cap, embargo). Equal score, prestige and tier → lot (stream `market`, season, week, fighter id).

**Worked example (le-013):** Brannoc's ask is 290 at club A (Banner, prestige 50, where he would start) and 285 at club B (Crown, prestige 60: tier gap −500, prestige +200, where he would not). A offers 290: score 10,000 + 1,000 = **11,000**. B offers 310: score 310 × 10,000 ÷ 285 = **10,877**. A signs him. Had Muster club C (ask 335) offered 345 with a starting place, its score of 10,298 + 1,000 = **11,298** would win: a smaller club can outbid a bigger one by paying the premium and offering a starting place, and a club that cannot offer a start must pay more than 10% over its ask to beat one that can.

**Acceptance cases:** le-013, le-022, le-023, intake-002 (§9.2–9.3).

#### sys-ai-manager: AI clubs under the same rulebook

**Status:** parity is PROPOSED (P-04). Procedures and values are PROPOSED · TUNABLE (`economy.json` aiPersonalities, ai). The captain timing is DELEGATED (D-I). Lifecycle policies are merged in from the lifecycle draft (§5). Decisions are deterministic given the state; ties use stable ids, then stream `ai`.

**Personalities** (each club's is in `clubs.json`; M1 shows it as a club tag; M4 hides it behind scouting):

| Id / label | Spending | Signing focus | Contracts | Distinctive behavior |
| --- | --- | --- | --- | --- |
| `balanced` Steady hands | 93% of WB | need × value per gold | the fighter's preferred length | — |
| `thrifty` Ledger-keepers | 88% of WB; reserve 25% of SB | value per gold; never above ask | 1 season; haggles renewals −6% | Keeps two places free |
| `star_chasing` Glory-hunters | 100% of WB; reserve 8% | best rating first | preferred length | Overbids +15% for the top 20% of the pool |
| `youth_focused` Seedbed | 95% of WB | potential weight ×1.8; avoids human-age > 27 unless a starter | 3 seasons for the young, 1 otherwise | Gives young prospects starts |
| `veteran` Old hands | 95% of WB | potential weight ×0.3; avoids human-age < 24 unless a starter | 1 season | Proven fighters now |

Any personality spends 100% of WB once its balance exceeds 1.0 × SB, so no AI hoards without limit.

**Value used by every decision** (integer): potentialBonus = min(potential − rating, 25) × potW(human-age) ÷ 10,000, the same upside term as EQ in the market wage (defined at merge; the draft named it without a formula). aiValue = rating + potentialBonus × personality.potentialWeight − max(0, human-age − 31) × 3 × personality.veteranPenalty × physicalScale + 8 if his role family is below the club's role targets (Tank 2, Healer 2, DPS 3, Controller 1; hybrids count for both) + 10 if he would start (m1/fix-tuning: veteran points 2 → 3, starter bonus 5 → 10). physicalScale = the class's physical share of its rating weights ÷ 0.5 (D-T: the penalty stands for expected decline, which is physical only, so it applies in full to a 50/50 class, about half for healers and controllers and about 1.5× for melee and ranged DPS). surplus = aiValue − replacement rating (60 / 46 / 32).

**Procedures** (AI action phase, in order):
1. **Renewals** (from the MW4 processing): for expiring fighters in descending aiValue, keep him if he ranks within the roster target, the personality's age rule allows it, and his ask fits WB × wageUse on the current bill (agreed raises and pending offers included). Every renewal, the AI's too, is then judged by the next-season rule of sys-finance (O32); the AI's own budget is the stricter of the two, so it never asks for a renewal the rule would refuse (budgeting AI renewals on next-season commitments instead was tried and failed two soak checks, open-033). Offer ask × (1 − haggle), accept a counter, and after a refusal offer the full ask next week. Otherwise let the contract expire.
2. **Releases:** cap relief when over the cap (P1–P4, lowest aiValue first). Voluntary releases only in P1–P4, at most 2 per season, and only for a fighter with surplus < 0, payout ≤ 10% of SB, and balance after the payout ≥ the reserve floor.
3. **Free-agent offers** while roster + pending < roster target (cap − slack, at least 8): rank candidates by surplus × 10⁶ ÷ ask (Glory-hunters: by surplus), skipping any with surplus ≤ 0. Offer floor5(ask × (1 + overbid)) at the personality's length, within bill + pending + offer ≤ WB × wageUse and balance − pending costs − cost ≥ reserve floor. Up to 3 new offers per week (Ledger-keepers: 2). Below 8 rostered fighters, the AI may use the full WB and a zero reserve. The star overbid is scaled by the star's rating gain over the club's 5th-best fighter (full at a gain of 20). This core pass keeps wage room, at the tier minimum, for the reserves still missing below the **depth floor** (cap − 2, at least 8, at most the target). **Depth signings** (m1/fix-tuning) then fill the remaining places up to the roster target with free agents whose ask is at most 2 × the tier minimum, ranked by aiValue + ½ × (potential − rating), with no surplus requirement and the same commitment checks; none while embargoed. Voluntary releases (step 2) happen only when the roster is at its target.
4. **Counters received:** accept if within wage room.
5. **Trials rookies** (season-end AI phase; season 1 at the first P1 processing, D-P): sign those with surplus > 0 within cap and wage room; Seedbed signs any rookie with potential − rating ≥ 15 if there is room; a rookie whose ask fits the depth cap may also be signed as depth into a place below the target. Every AI trials signing is for 3 seasons.
6. **Captain and vice-captain** (D-I): see sys-captaincy, "AI captain timing".
7. **Training emphasis** (lifecycle policy, adapted to D-A): the first matching rule of §5.2 (Wandering Mind → Mind; D_physical ≥ 28 → Mind; mental-heavy class → Mind; physical-heavy class → Body; otherwise Balanced).
**M1.1 additions** (PROPOSED; rotation and swap thresholds REQUIRED, O25, D-V; `levels.json` aiRotation, aiSubstitution): (a) **rotation at the lock**, after the best five are chosen: a starter whose Freshness is below 60 + his typical round drain (he would start round 2 Tired) is replaced by the best fit fighter with Freshness ≥ 60 within 6 + 0.45 × (60 − F) rating (`extraGapPerPointBelow`, from 0.25 in m1.1/tune-life, O25, D-AB), most tired first, at most 3 a match (in the Reckoning only below 40, within 3); a starter below 30 is replaced by any fit fighter at 40 or more; (b) **reserves:** the 2 best remaining fit fighters with Freshness ≥ 60, one front-line and one back-line; (c) **auto-swap** by personality threshold with the lost-round +10 (sys-match); (d) **level-ups** always resolved by auto-pick. The 10-season soak (main @ 293f49a) gives 20.5% Tired and 4.1% Spent AI round-starts and 0.60 swaps per match, half of them forced by injury; the scratch model had 34% and 10% before the Tired drain (O25, D-AB) and the wider rotation gap.
8. **Lineup for next week:** the best fit Tank-family fighter, the best Healer-family fighter, then the 3 highest-rated remaining (ties by CQ, then id). Seedbed swaps in a prospect (human-age ≤ 23, potential − rating ≥ 10, rating ≥ the 5th starter's − 4) for the lowest non-Tank, non-Healer starter. **At-risk resting** (lifecycle policy): in a league match, rest an At-risk starter if a fit reserve of the same role family is within 3 rating; never in the Reckoning. Rows come from each class's default row. **Presets** by the club's tacticsStyle mapped to a preset style (sys-tactics). The match captain follows sys-captaincy. The player's lineup pre-fill ("Auto-pick") uses this same rule (PERMITTED-CHOICE, 04 ui-squad). **What the opponent sees** (D-R): in M1 each club sees its next opponent's *last* locked lineup, never the lineup it will lock for the coming match (open-026).

**Never:** it never reads the player's pending offers or lineup, never tanks (its lineup is always the best by the rule above, except the published rest rule), never breaks the commitment rule, and never signs while embargoed except as the embargo allows.

**Acceptance cases:** le-025, le-026, cap-010 (§9).

### 3.4 Supporting M1 systems

#### sys-theme

**Status:** REQUIRED (T5). Theme data supplies names (`names.json`), class and race presentation, regions, tiers, wings, clubs, venues and every player-facing string, plus display names such as the currency (**tessel, ts**, D-C). Mechanics never depend on theme strings. The loader converts units once (metres, seconds and decimals into cm or mm, ticks and bp), validates every id reference, and rejects a file with errors (document 05 owns the loader).

#### sys-knowledge (M1 pass-through)

**Status:** PROPOSED (open-026). `sys-knowledge.view(viewerClubId, fighterId)` is the only way management screens and AI valuations read a fighter. In M1–M3 it returns true values, including potential, pace and traits, for every fighter and every viewer. From M4 the same call returns the fog of P-12 and O4; the spec is not yet written (§3.5).

#### sys-save (player-facing rules)

**Status:** save/load REQUIRED (R7). The rules below are the open-016 working assumption; the persistence contract is in 05 §5.
- **M1.1:** state schema v3 (05 §9.3); v4 with the KI-2 compaction, an identity step from v3 whose only new field is `MatchResult.fielded` (an older build reports a v4 save as too new, not as damaged; 05 §5). Each completed round and each between-round decision of a live match is committed as it happens; quitting on the between-round screen resumes there with the same results. Level-up offers are stored when generated, so a reload never rerolls them. Content that would produce a state the schema cannot hold is refused when it loads: the save schema and the content validator share one set of bounds (`SAVE_BOUNDS`: 5 starters, 2 reserves, 2 swaps per match, 3 queued level-ups, 3 options per level-up, 4 perks per fighter), so a tuned content file can never write a save that does not load again. Older saves migrate deterministically: Stamina is rolled from the seed and fighter id, levels are derived, this season's round XP is carried into the bar (below one level), Freshness is set to 100, and there are no pending level-ups (O25, D-X).
- Manual saves to several slots from any management screen; rotating autosaves (three weekly slots, auto-1..3) after every week processing, after the season-end step and when a career starts (Settings › Weekly autosaves switches these off). **M1.1 (REQUIRED, O25, D-AD):** a match waiting between rounds is also saved to a dedicated mid-match slot, `auto-round`, after every round; that save always runs, whatever the setting, because it is what keeps "no rerolls" true when the player quits mid-match, and it never takes a weekly slot.
- **Commit before the report** (DELEGATED, D-O): Play match runs the week processing, which commits the player's result with every other result, and the autosave is written before the match report opens. The report shows the committed result; quitting or reloading at the report cannot change it (no rerolls).
- **Size rule (O24):** results of matches between other clubs are compacted 3 weeks after they are played (as built), so saves are smaller (the in-season peak at season 3 fell from about 12.2 to 7.6 MB) but still above the 3 MB budget (05 §12 KI-2, 01 open-035); the player's own matches are never trimmed during the season. The effect on reports is in sys-match-report; the technical rule and the measurements are in 05 §5 (sav-002, sav-003).
- A save contains the complete career: world, every club and fighter, contracts, finances, pending offers and negotiations, standings and history. Loading restores exactly that state.
- Committed results are never re-simulated on load. Because seeds derive from the career seed and fixture identity (03 §1), replaying a match from an earlier save with identical inputs reproduces the same result (flow-003).
- M2: quitting mid-fight resumes the fight at the same tick. M7: hardcore uses a single ironman slot.

### 3.5 Later-milestone systems (specs not yet written)

These systems have no §3 spec yet. The constraints already decided bind whoever writes them.

| System | Milestone | Already decided |
| --- | --- | --- |
| sys-calls | M2 | Free unlimited pause to inspect; auto-pause triggers; at most 2 calls per round per side, which AI managers also spend; calls are timed inputs to the deterministic sim and are logged for replays (P-01). The calls go through the captain (sys-fight-captain). Skipping watching gives the player's side the AI call policy (open-020) |
| sys-tactics-editor, sys-playbook | M3 | Rule format and vocabulary of sys-tactics; slots 4 → 8 with experience (sys-development) and up to 12 through traits; starter vocabulary from day one; lint for unreachable rules, missing cooldowns, friendly-fire risk and near-opposite conditions; local library and export codes (P-07, P-21, P-22); presets as editable starting points; edits between rounds; sandbox with its own seed (P-13) |
| sys-staff, sys-scouting, sys-knowledge (fog) | M4 | Scouts with read-skill and read-talent, a region of expertise (Saltmarch, Emberreach, Thornwald), limited time and a wage (R3). The free baseline report (O4). Ranges, reveal steps, certainty and source labels (P-12). Slow decay refreshed by contact (P-19). Opponent reveal without forecasts (P-13). Trait reveal order (`traits.json` revealOrder; negatives last). Own fighters per open-008. Every read goes through sys-knowledge.view |
| sys-academy | M5 | O2 capacity (10/12/14, a separate pool), O3 timing (enrollment committed at Kick off; irreversible call-up; no XP if unused; mid-season signings enrolled in the week they join), open-003 and open-004. **R5 outcomes in M5 scope:** program types; growth of stats and of potential; teaching new abilities and new traits, and curing flaws (sys-traits). How an academy-taught ability fits the fixed 4-ability kit (sys-abilities) is owner question Q20. Program XP is added to season XP. Embargoed clubs cannot enroll. The transfer `academy` destination hook |
| sys-cups, sys-patron, club-to-club transfers | M6 | Regions as P-08; the regional cup in which the underdog plays at home; cup weeks inserted into the calendar; fixtures carry competition and bestOf; finance has a cup-prize category. Windows and deadline day; trust from 50 (P-09); AI valuation by need and scarcity. The patron's temperament, directives, patience, dismissal and job offers (open-007). **No patron goal in M1** (D-C) |
| sys-difficulty, sys-season-modifiers | M7 | Sliders change management levers only and never fight rules (P-14). Hardcore permadeath (P-11). One opt-out modifier per season (P-16) |

## 4. Cross-system interactions

**Status:** follows the owning systems' labels.

| Trigger / combination | Required conditions | Resolution order | Result | Restrictions / edge cases |
| --- | --- | --- | --- | --- |
| Lethal damage and a heal on the same tick | Both land on tick t | Summed at commit | The fighter stands if HP − damage + heal > 0 | Order-independent by construction |
| Lethal damage on a Deathwarded fighter | Ward active at start of tick | Commit: ward check before downs | HP 1 + ward heal; ward removed | A later lethal hit downs normally |
| Stun during a cast | Cast in progress | Status applies at commit; the cast cancels at once | No focus spent, no cooldown | Channels keep ticks already applied |
| Taunt then stun | Same unit | Shared `control` track | The second effect gets the 0.6 step | Taunt ends if the taunter is downed |
| Guard and area damage | Guarded ally inside an area | Per instance, pipeline step 7 | Each instance splits separately | Guardian outside the radius: no split |
| Thorns against riposte | Bladeturner hits Briarback | Thorns on the reflector's side only | Reflect lands next tick | Reflected damage never reflects again |
| Pull into a trap | Downdraft over an armed Bear Trap | Displacement, then the trap triggers on later ticks | Trapped enemy rooted | A trap arms 0.3 s after placement |
| Marked and Vulnerable | Writ Hunter and Warlock on one target | Different statuses add in the damage-taken multiplier | +15% and +15% | Two Vulnerables from different sources: strongest only |
| Silence against passives | Silenced unit | Passives keep working | Only actives are blocked | — |
| Anchored against knockback | Pavisier planted | Displacement skipped | No movement; the `displace` track does not advance | — |
| Overtime and healing | t ≥ 45 s | Healing × max(0, 1 − 0.03k) | Stalemates resolve | Shields scale the same way |
| Trait and captain composure in fight | Aura, rally, Shaken, trait mods | Summed per stat, then clamped 1–20 (trait-sourced capped ±8) | CMP_eff drives tenacity and reaction delay | Never changes rule evaluation (P-06) |
| Match result → XP and injuries | Each round started | Result → XP per round → injury roll per round (at most one per match) → applied at match end | Season XP, injury, Still tender | Committed and autosaved with the week before the report opens (P-05, D-O) |
| No rounds started → development | A fit roster fighter never fielded | Bench XP, ⅓ of a lineup slot (O25, D-W); 0 if injured → slow levelling; wear and aging still apply | Slow growth (M1: none, D-A) | The O3 no-XP rule now covers unused academy call-ups only (M5) |
| Training emphasis → offer weights | Standing setting | Body multiplies physical stat weights in level-up offers and Mind the mental ones (M1.1; in M1 season shares moved growth between the clocks) | Which stats appear in offers | Never more total growth, no wear effect (D-A as amended) |
| Injury → development | Weeks out | No rounds, and an injured fighter earns no bench XP either (O17) | No XP | — |
| Scar → potential, captaincy, retirement | Scar gained | Trait added → potential recomputed → +3 points retirement per scar → At risk at 2 scars | Potential down, risk up | Scars are permanent |
| Captain grade → young development | Human-age ≤ 23 | Season end, pro-rated by weeks in the role | ×0.97 to ×1.08 (total mentor cap ×1.15) | — |
| Captain change → chemistry | At lineup lock | Snubbed or Passed Over → chemistry term | −2 or −1 for 6 matchweeks | Exemptions; AI never triggers it (D-I) |
| Missing captain → lineup lock | No club captain, or he left the roster | Interim captain (vice if fit, else best-CQ fit starter) before the lock | `captain.interim` digest item; the lock proceeds | Never blocks Continue (D-S) |
| Chemistry → fight | At lineup lock | Chemistry ÷ 2 into setup composure | ±2 composure at most | Walks Alone immune (D-D) |
| Age → rating → retirement → intake | Season end | Development and wear → rating drop from peak and human-years past 30 → retirement chance (D-T) → age +1 → roll → intake = base + retirements | Steady population; mentally weighted veterans play on | Leavers not counted (D-H); forced at human-age 58 |
| Relegation → contracts → roster | 8th in a wing | Season-end 3 → setup: drop clause, then tier minimum, then cap | Wages −20%, parachute, cap −2, cap relief equal to the overage | Kick off blocked while over the cap (02 flow-005) |
| Promotion → finance → market | Reckoning champion or Shield | Season-end 3 → setup: promotion grant, ascension, WB | Bigger WB; the calibre premium falls in the new tier | Existing wages unchanged (no spike) |
| Release → finance status | Payout > balance | Payout at once → status at the next processing | Possible embargo | A release is never blocked by money |
| Embargo → pending offers | Balance < 0 at processing | Status (step 6) before decisions (step 8) | Non-conforming offers void | Renewals above the tier minimum refused |
| Registry advance → next season | 8 debt weeks | Advance at step 6 → deduction at setup | Grant reduced by at most 30% a season | Prestige −5 |
| Free-agent decision → AI | Fighter signs elsewhere | Step 8 before step 9 | AI re-plans with the new pool | AI offers are never instant |
| Injury → lineup → hired blade | Fewer than 5 fit at lock | Countdown (step 3) → AI lineup (step 9) or the player's lock | A hired blade fills the slot at the tier minimum | Not on the roster; counts for no cap |
| Retirement and expiry | An expiring fighter retires | Step 7 before step 8 | Retires, no payout, no free-agent entry | No contract next season raises retirement odds ×1.5 |
| Drain after round n → round n + 1 (M1.1) | A fighter starts round n | Lifecycle drains after the round; combat reads the new value at round n + 1's build | The between-round screen shows the new label first | Never during a round (O19) |
| Injury in round n (M1.1) | Injury rolled after round n | Multiplier from round n's start value → out for the rest of the match → reserve (a swap) or emergency entrant | Never 4 v 5 | Withdrawn fighters never re-enter (O20) |
| Swap-out + XP (M1.1) | Starter withdrawn after round n | Rounds started are kept; no bench XP | A fighter never earns both | — |
| Squad reserve never entering (M1.1) | Named reserve | Bench XP + 80% weekly rest | Being on the bench is cheap but not free (O25, D-Z) | — |
| Level-up mid-season (M1.1) | XP bar full at match end | Offer generated and stored; a stat pick changes effective stats at once | Visible at the next lock | At most 2 level-ups per match; none between rounds |
| Pending level-ups + season end (M1.1) | Queue not empty | Auto-resolved before wear and age +1 | No pick is lost | — |
| Prize money → next WB | Season-end prizes | Step 2 → setup reserve contribution | Up to +10% of SB in wage room | Capped (anti-snowball) |

## 5. Autonomous behavior

### 5.1 Fighters in the fight

- **Agent goals:** each fighter executes its rule list. It has no hidden goal or personality (pillar 1).
- **Available information:** fight-observable state only (03 §1), the same for AI and player fighters.
- **Legal capabilities:** identical for every club (P-04).
- **Decision priorities:** the first valid rule top-down, then the stance.
- **Timing:** evaluation every 2 ticks; reaction delay 0.15–0.6 s plus 0–2 ticks of jitter on decision changes; forced decisions (taunt) immediate.
- **Difficulty differences:** none. From M7, difficulty works through management levers and never changes fight rules (P-14).
- **No useful action:** the stance fallback; `hold` may idle by the player's choice.
- **Telegraphing and counterplay:** casts and channels of 0.3 s or longer are visible (`enemy_casting`, `casting_enemy`) and interruptible; hard control is short, shares one track and is capped at 2.5 s; zones and traps are visible; targeting is published.
- **Representative situation (EXAMPLE):** an Archer on Balanced sees a Knight close to 3.5 m. R1 (`enemy_within close`) fires Leap Back, the Archer lands 4 m further away, and it resumes Aimed Shot on the lowest-HP enemy.

### 5.2 AI clubs

- **Agent goals:** win matches and the Reckoning, avoid relegation, stay solvent within personality limits, keep a fair-value roster, and develop prospects.
- **Available information:** the same views as the player through sys-knowledge.view (exact in M1, open-026; from M4 with noise from the club's scouting quality, P-04). No access to the player's pending offers, round seeds or future results.
- **Legal capabilities:** identical to the player's: offers, renewals, releases, trials signings, lineup, captain, vice-captain, presets and training emphasis. From M2, calls on the same budget. No exceptions.
- **Decision priorities:** sys-ai-manager procedures 1–8, in order.
- **Timing:** once per week processing (step 9) and once in the season-end AI phase (step 14). Season 1 has no season end before it, so the season-start phase runs at world creation, before P1, and the trials signings at the first P1 processing (D-P).
- **Captain timing** (D-I): set for the new season in the season-end AI phase with a 5-CQ hysteresis; mid-season only on vacancy or a captain injury of ≥ 4 weeks; never a change that causes Snubbed. A missing captain is filled automatically at lock by the same rule as the player's club (D-S).
- **Training emphasis** (D-A), first matching rule: Wandering Mind → Mind; D_physical ≥ 28 → Mind; a class whose rating weights on mental stats exceed 50% → Mind; a class whose rating weights on physical stats exceed 50% → Body; otherwise Balanced.
- **Prospects:** Seedbed's youth-minutes swap gives AI prospects rounds; prospects that never play level at a third of the pace (O17, O25, D-W), for AI and player alike.
- **Difficulty:** none in M1. M7 sliders may change decision quality, never the rulebook.
- **No useful action:** keep the roster; hired blades cover a short lineup; renew at the tier minimum while embargoed.
- **Telegraphing and counterplay:** the personality tag and tactics style are visible (M1); rival-offer counts are visible on free agents; the next opponent's last locked lineup is visible (D-R; its next lineup is not). A player can, for example, outbid a Ledger-keeper, which never pays above ask, or let a Glory-hunter overpay for a star and sign the value fighters it ignores.

## 6. Content model

**Status:** the families and counts are REQUIRED where an owner ID fixes them (42 classes, O8; 5 per side, O1; caps, O2). Everything else is PROPOSED. **The content files are the source of truth for every catalog and number.** This document defines behaviors and invariants and does not duplicate the catalogs.

| Family | File | M1 quantity | Key fields | Behaviors |
| --- | --- | --- | --- | --- |
| Attribute | `combat.json` attributes | 12 (13 from M1.1: `stamina`) | id, name, abbreviation, group (physical or mental) | sys-combat-stats |
| Ability rank table (M1.1) | `ability-ranks.json` | 168 rows, 126 rankable, 252 rank steps | abilityId, classId, slot, rankable, family, ranks (summary, JSON-pointer changes) | sys-ability-ranks |
| Perk (M1.1) | `perks.json` | 72 (12 general, 12 per archetype) | id, name, archetype, tier, tags, text, requires, autoPickValue, exclusiveWith, passive, traitEffects, lifecycleEffects | sys-perks |
| Levels, offers, Freshness, squads (M1.1) | `levels.json` | 1 | benchXp, level, xpPerLevel, offers, traitOfferPool, autoPick, pacing, levelEta, stamina, freshness, matchSquad, aiRotation, aiSubstitution, hooks, migration, soakTargets | sys-development, sys-freshness |
| Class | `classes.json` | 42 (O8): 30 base, 12 hybrid | schema in sys-abilities | all combat systems |
| Ability | `abilities.json` | 168 (4 per class) | schema in sys-abilities | sys-abilities, sys-fight-sim |
| Status | `combat.json` statuses | 34 | id, category, track, stacking, stat, cap, blocks | sys-abilities |
| Preset | `tactics-presets.json` presets | 105 (2–3 per class) | id, classId, style, name, summary, stance, rules | sys-tactics |
| Rule vocabulary | `tactics-presets.json` vocabulary | 21 conditions, 18 selectors, 12 predicates, 6 actions, 3 stances, 5 roles, 4 bands | id, sentence label with {param} slots, params (type, min, max, step, default) | sys-tactics, sys-targeting |
| Race | `races.json` | 5 | lifespan, debutAge, intakeWeight, growthMult, declineMult, statTendencies (all 12 ids), injury multipliers, classAffinity, racialFeature, namesKey | sys-races |
| Trait | `traits.json` | 60 (48 rolled, 12 storied) | id, name, category, kind, rarity, rollWeight, opposites, excludes, exclusiveGroup, raceWeight, rookieOnly, flavor, effectText, icon, effects (each with an owner), gain, loss | sys-traits, sys-fight-traits |
| Name set | `names.json` | 5 races | patterns, parts, rules, blocklist | sys-fighters |
| Lifecycle constants and statuses | `development.json` | 7 statuses | scale, time, potential, pace, clocks, curves, decline, xp, training, retirement, injury, captaincy, chemistry, generation, soak targets | §3.2 |
| Region, tier, wing, calendar, venue | `leagues.json` | 3 regions (1 hosting), 3 tiers, 2 wings, 23 weeks, 1 venue | as in sys-league | sys-league, sys-calendar, sys-tournament |
| Club | `clubs.json` | 48 (16 per tier) | id, name, shortName, 3-letter code, region, district, city, arena, motto, colors, start tier, start prestige, aiPersonality, tacticsStyle | sys-league, sys-finance, sys-ai-manager |
| Economy profile and AI personality | `economy.json` | 3 tier profiles, 5 personalities | tierProfiles, income, budget, wage, ask, negotiation, contracts, market, finance, prestige, ai, balanceTargets | §3.3 |

**Content rules (validated at load; document 05 owns the validator):**
- **Units and ids:** every key carries its unit suffix (`S`, `M`, `Mps`, `Deg`, `Ticks`), and every value converts exactly (seconds to whole ticks, metres to whole centimetres). Decimals become basis points. Ids are unique and every reference resolves.
- **Combat** (sys-abilities validation): exactly 6 classes per pure archetype and 2 per hybrid pair; 4 abilities per class; 2–3 presets per class whose selector pools match their abilities' targets.
- **Lifecycle:** race stat ids equal combat attribute ids; race tendencies within ±4 and trait stat adds within ±3 integers (D-F); the O11 injury invariant; debut ages ≥ 16; opposites symmetric; every effect type known and owned; sim-applied mods use only adapter keys within combat's caps; rolled traits have weight > 0 and storied weight 0; every rolled flaw has a loss rule; the scar pool contains only scars; the roll-table positive share is 78–82%; names.json covers every race.
- **League and economy:** club counts per tier = clubCount = 2 × wing size = 16; caps follow O2 (lowest 10, +2 per tier up) with academy = cap; wing and cross-wing matchweeks cover MW1–16 exactly; the calendar length equals `economy.json` season.wageWeeksPerSeason (23); grant installments sum to 10,000 bp; every economy number is an integer; curve anchors are monotonic; unique club ids, codes, names and primary colors; club start prestige within ±15 of its tier base; color rules (primary/secondary contrast ≥ 3.0; pair and kit distances ≥ 25; if home and away primaries are within ΔE 20, the away side displays its secondary).
- **Presentation keys** (document 04): `class_<id>`, `abl_<abilityId>`, `st_<statusId>`, `arch_<archetype>`, `attr_<id>`, `icon_trait_<id>`, `status_*`, `inj_*`. Every class has a flavor line and a two-line description; every ability a one-sentence description with its numbers; every preset a summary; every trait an effect line.

**Prototype content set (M1):** all of the above. It is ready when the loader validates it with zero errors, the combat harness (§8.2) and the 48-club headless soak (§8.3, §8.4) run it, and the §9 scenarios pass. **Status on main @ 293f49a:** the loader validates `content/default` with zero errors; balance pass 1 and the M1.1 combat pass ran on the harness; the 10-season soak passes 14/14 checks; 1,093 tests pass, including the §9 scenarios as re-derived for M1.1. Known gaps are listed in 05 §12.

## 7. Levels, encounters, or challenge structure

**Status:** DELEGATED (D-C) for the league ladder; PROPOSED for the fight setup.

- **Fights:** one authored arena (open-019). Opponents are other clubs' lineups under the same rules. Setup is 5 v 5, rows per sys-arena, both sides at full HP and focus. Objective: eliminate the other side, or lead the tiebreak chain at the cap; win 2 of 3 rounds (3 of 5 in the Reckoning final). Walls are the only environment interaction. Validity: spawns inside the arena and non-overlapping; every round ends by tick 1,500.
- **The league ladder:** the authored structure is the tier and wing tables of sys-league, the Reckoning (top 4 per wing) and promotion and relegation (champion and Shield up; 8th in each wing down). Escalation: each tier up roughly doubles or triples budgets and opposition ratings (bands 30–50, 45–65, 60–80), and the bands overlap, so a promoted club can survive with good tactics. Objectives: win the wing and tier tables, the Reckoning and promotion; avoid 8th place; stay solvent. There is no patron goal in M1 (D-C).
- **New-career setup:** each club gets its start tier and prestige; starting balance = floor10(tier base × (1 + 1% × (prestige − tier base))), within ±30%; rosters filled to 90% of cap (each world fighter drawn inside the tier's rating band); contracts of 1, 2 and 3 seasons in equal shares at each fighter's ask for his club; then each club's opening bill is **rescaled into 80–87% of its WB** (`budget.worldGenBillBandBp`; wages keep their proportions to the nearest band edge, floor to multiples of 5 and stay within the tier minimum and the maximum wage). Only if the tier minimum keeps a bill above the band is the lowest value-per-wage fighter released, never below 8. The band leaves room for the trials rookie and a tier-minimum signing. World generation adds 2.5 free agents per club (D-C) and a Trials Day class of one rookie per club (D-P).
- **Opening balance and setup order** (D-P): the career's opening balance is the starting balance (pre-setup cash). The first central-grant installment is one separate setup ledger credit; the season budget counts the season's grant once, and the WB reserve term uses the pre-credit balance, as at every later setup. The AI's season-start setup (captains, vice-captains, training emphasis, opening offers) then runs for every club before P1.
- **Validity checks at new career:** every club has ≥ 5 fighters and every role is present league-wide; every WB ≥ its club's bill; the pool meets its floors. On failure, retry generation with the next sub-seed up to 3 times, then relax the band's upper edge to 100% of WB.
- **Variation limits:** the wing draw changes every season; the cross-wing pairing and venues alternate by season parity; clubs, names and tiers are data.

## 8. Balance and tuning

**Status:** every value is PROPOSED · TUNABLE in the named file. The harness and the soak run on the real sim (main @ 293f49a): combat balance pass 1 and the M1.1 combat pass (§8.2), the tuning pass m1/fix-tuning, the core fix round m1/fix-core and the M1.1 leveling and pool tuning m1.1/tune-life (§8.3–8.4, §8.6). Figures marked "old model" are the drafts' scratch-model estimates. Each tuning change must be recorded with the report that justified it.

**Soak lengths (C9, one ladder for the package):** the M1 and M1.1 gate is 1 seed (`soak-1`) × **10 seasons** with every hard check passing (met on M1.1 as built: 14/14, of which competitive-balance is warning-level, O25, D-AA). The **20-season** run is reported but does not gate (v0.6: 12 pass, 1 warn, the dynasty flag, and 1 fail, age-distribution in season 11; 05 §12 KI-1 and KI-17. M1 had 10/11). The M7 gate is **10 seeds × 30 seasons** (vis-008, 01 §5, 05 §9). `economy.json` balanceTargets still says 25 seasons (and `dynasty.minDistinctTier1ChampionsIn25`); they should be restated for 30 seasons (content request to the league-economy designer; this sync does not edit content).

### 8.1 Parameter index

| Area | Parameters (file → key) | Evidence to change |
| --- | --- | --- |
| Combat coefficients | HP 4% per tgh, Power and Support 4% per weighted point, attack speed 2.5% per agi, crit multiplier 1.5, variance ±4%, reaction delay 0.30 s base (`combat.json` derived, damage, randomness) | Stat-gap win curve; class win rates; mirror spread |
| Control and pacing | DR steps 1.0/0.6/0.35/0 over 6 s; 2.5 s cap; overtime +3%/−3% per second from 45 s; cap 75 s; decision interval 2 ticks; shield cap 50% (`combat.json` cc, overtime, timing, shields) | Control uptime; overtime and cap rates; the 2 ms per round budget |
| Class kits | Base values and ability coefficients (`classes.json`, `abilities.json`); ±30% per value per pass (balance pass 1 exceeded it; exception logged in §8.2) | Harness outliers |
| Development | M1.1: level XP base 102 + 0.6 per level and the physical and mental age-factor and gap-factor tables, bench share ⅓, the offer weights of training emphasis (`levels.json` xpPerLevel, benchXp, offers); season XP target 360 for the retirement usage only; pace levels 0.75–1.30; mentoring 0.97–1.08 (`development.json` xp, training, pace, captaincy) | Starter levels a season by age and matches per level (§8.6); peak ÷ potential |
| Freshness and squads (M1.1) | Drain 11.88 − 0.48 per Stamina point (2–12) × intensity; Tired rounds drain × 0.5 (O25, D-AB); rest 30 + Stamina; threshold 60; reserve rest 80%; auto-swap thresholds by personality; AI rotation gap 6 + 0.45 per point below 60 (`levels.json` freshness, aiRotation, aiSubstitution) | AI Tired ≤ 36% and Spent ≤ 12% of round starts; swaps per match; the `fatigue` harness mode |
| M1.1 combat content | Freshness penalty at full −8% attack speed, −4.8% move, −6.4% Power and Support, +20% reaction delay; rank templates (control cooldown × 0.8 at rank 2, × 0.65 at rank 3); perk values (`combat.json` freshness, `ability-ranks.json`, `perks.json`) | The `fatigue`, `rank-impact` and `perk-impact` harness modes |
| Aging and retirement | Physical decline table; mental decline from human-age 60 scaled by lifespan (D-B); retirement hazards by rating drop from peak (1% at 3 to 82% at 20) and by human-years past 30 (0.2% to 50%), forced at 58 (D-T) (`development.json` decline, retirement) | Median retirement human-age by class weighting (measured: physical 38.8, mixed 42.0, mental 46.1); physically weighted classes retire before mentally weighted ones |
| Injuries | Base terms 0.4% / 1.4% per max HP / 1.3% downed; race multipliers; career-ending 8% with a 0.5% per-match cap (`development.json` injury, `races.json`) | 0.75–1.15 per 40 human rounds; elf:human 1.3–1.6× |
| Traits and captaincy | Negative chance 0.2 per trait; captaincy weights .45/.25/.10/.10/.10; grade thresholds 90/70/55/40; aura and rally by grade; chemistry ÷ 2 (`traits.json`, `development.json`) | 78–82% positive share; 10–35% of AI captains grade A; captain effects ≤ 10% |
| Intake and pool | Rookies 0.8 per club + retirements in [0.5, 1.6] × clubs (D-H); season 1 one per club (D-P); 2.5 world free agents per club (D-C); pool floors 60 and 5 per role; unsigned free agents leave after 3 season ends (`development.json` generation, retirement; `economy.json` market) | Pool at P1 100–300; floors never breached |
| Money | Grants, sponsor retainers, gate bases, wage ratios, operating costs, prizes, bonuses (`economy.json` tierProfiles); reserve rule 15/50/10% (budget); world-generation bill band 80–87% of WB (D-P); prestige sensitivity of retainer 60 bp per point (±1,500) and gate 50 bp (±1,500); signing 10%, release 50%, drop clause 20%, parachute 50%/25%, promotion grant, ascension +800 bp (contracts, finance) | Solvency; wage-to-income; promoted survival |
| Market | Wage curve 160 × 2^((r − 50) ÷ 12); tier minimums 260/150/60; potential weight 4,000 bp to 0 at 28; calibre 62/47; tier gap +1,500/−500; ask prestige −20 bp per point (±400); greed −1,000 to +1,500; flex 1,500/1,000/500; starter bonus 1,000; rookie scale 1.25 × tier minimum (D-P); AI starter bonus 10 and veteran penalty 3 per human-year over 31 (`economy.json` wage, ask, negotiation, market, ai) | Tier bill against WB; pool flow; dynasty flags |
| League | Points 3/2/1/0; prestige weights and 25% reversion (`leagues.json`, `economy.json` prestige) | Tie frequency; prestige spread |

### 8.2 Combat targets and the balance harness

**Reference situation:** all attributes 10, CQ 50 (grade C), default presets, human, no traits; lineup tank + melee + ranged + controller + healer, with the tank and melee in the front row.

| Target | Value |
| --- | --- |
| Time to down a back-liner (780–820 HP) focused by one melee and one ranged DPS | 4–7 s |
| Time to down a tank focused by the same pair | 12–20 s |
| Fight length (reference and random legal lineups) | median 25–35 s; P10 ≥ 15 s; P90 ≤ 50 s |
| Fights reaching overtime / the cap | ≤ 25% / ≤ 1% |
| Home-side win rate | 49–51% |
| Archetype win share (pure classes, mirrored pairs) | 47–53% each |
| Class win rate (random legal lineups) | 45–55% each |
| Preset style share (balanced, aggressive, protective) | none ≥ 55% (no dominant script, vis-002) |
| Stat gap | +1 average attribute (about +5 rating) → 58–65% win rate; +3 → 75–85% |
| Tailored preset against a known opponent, versus defaults at equal rating | ≥ 60% (vis-002) |
| Hard-control uptime on any unit | ≤ 25% of fight time on average; median single control ≤ 1.5 s |
| Healing done ÷ damage dealt per fight; overheal | ≤ 25% on average; overheal ≤ 35% of healing |
| Idle time per unit (excluding a chosen `hold`) | ≤ 5% |
| Veteran casters and healers (mental-power classes) | Checked separately: they peak around human-age 34–38 and barely decline in-career, so the economy must price them (lifecycle merge note C-7) |

**Harness** (`npm run balance`; stream `balance`): (1) passes A (all attributes 10, default presets), B (tier-typical attributes, random presets, sides within ±1 mean rating) and C (reference lineups against hand-tailored presets, vis-002); (2) random legal lineups of 5 classes, at most 2 of one class, at least one front-row starter; (3) each pair played twice with the same round seed and sides swapped; (4) 20,000 rounds per pass by default; (5) metrics per class, archetype, hybrid pair, preset, ability and rule (win rate with Wilson 95% intervals, damage, healing, control, downs, lifetime, cast and fire rates), fight-length percentiles, overtime and cap rates, tiebreak-step frequencies, home win rate, idle, overheal and overkill detectors, frozen-unit detector, synergy and counter matrices, ms per round; (6) flags for every band above, an ability never cast in > 50% of its class's rounds, a preset rule never fired in > 80% of rounds, and a median > 2 ms per round; (7) a JSON report plus a text summary, with a non-zero exit in CI mode when any flag fires.

**Recorded tuning, draft (estimate only):** a budget estimate at all-10 attributes showed mirror fights past 45 s, so every class's base Power was raised 25% and outliers were trimmed (Scarhide, Spellblade, Leechblade, Druid, Gaoler, Netcaster, Skullslinger, Sunlance Acolyte). This was not a harness result.

**Balance pass 1** (content commit 1597f1d, 2026-10-25; the first harness run on the real sim, random legal lineups). *Changes:* base values of the classes (for example Knight HP 1,500 → 1,250 and Power 60 → 72; Headsman Power 115 → 140; Assassin Power 80 → 110; Berserker Power 80 → 90; Vigilkeeper Support 95 → 105; tank baseline HP 1,492 → 1,244); 12 ability values (among them Clangor's taunt 1.6 s → 1.0 s = 20 ticks, Interpose's guard 40% → 30%, Hollow Ring 25 → 15, Thick Blood 0.8% → 0.5%, Bloodrush's cap 0.40 → 0.25, Rejuvenate 0.15 → 0.20, Rally Beat 0.70 → 1.00); five presets edited, the two Bard presets one rule shorter (297 → 295 rules). *Report:* median fight **32.7 s** (target 25–35 s); overtime **15%** (≤ 25%); time cap **0.1%** (≤ 1%); archetype win shares **45–55%** (target 47–53%: outside); class win rates **40–62%** (target 45–55%: outside; `hourglass_sage` 61.7% is the top outlier, 05 §12). The worked examples and §9.1 cases were re-derived from the new values.

**Exception to the ±30% per-pass bound (logged, pass 1 only).** 21 class base values moved by more than 30%: Power of 19 classes (Assassin +38%, Chaffcutter +47%, Spellblade +31%, Blightbrewer +57%, Writ Hunter +31%, Rimebinder +45%, Warlock +67%, Galeshaper +100%, Hushweaver +79%, Enchanter +78%, Snaresetter +79%, Bard +73%, Warrior +30%, Harpooner +30%, Paladin +31%, Netcaster +62%, Leechblade +31%, Sunlance Acolyte +31%, Shaman +50%) and Support of Bard (+35%) and Shaman (+42%). 8 ability values moved by more than 30%: Clangor duration −38%, Hollow Ring −40% (two mods), Thick Blood −38% (two mods), Bloodrush −38%, Rejuvenate +33%, Rally Beat +43%. *Reason:* the draft's budget estimate had left controllers and several DPS far below the fight-length and win-rate targets once the real sim ran, and one large pass before the M1 build was preferred to several bounded ones. *Consequence:* pass 2 returns to the ±30% bound and targets the out-of-band archetypes and classes, `hourglass_sage` first.

**M1.1 combat pass** (content commit ea86f5f, merged by 434e2f9 as m1.1/tune-combat; Last Wall cut again at integration, 7e2d662, and a third time to 5% in `m1.1/ki-fixes`, 02a1639; the Ashkin injury chance moved in e99f602, O25, D-AC). It touched M1.1 content only: class and ability values are unchanged, so the M1 pass-1 outliers remain and class retuning (pass 2) is still owed. The Freshness penalty at full went to ×0.8 of the proposal (attack speed −8%, move −4.8%, Power and Support −6.4%, reaction delay +20%); four perks were cut and six focus-regeneration perks given real effects (sys-perks); all 22 control abilities got real cooldown steps and 14 other abilities a rank-3 trim (sys-ability-ranks). *Report* (random-draft, seed `balance-1`, 20,000 rounds, main @ 293f49a): archetype win shares 44.1–53.5% (tank 53.5%, ranged 52.8%, melee 51.0%, hybrid 50.7%, healer 46.8%, controller 44.1%); class win rates 38.7–62.6% (headsman 62.6% and cantor 38.7% sit outside the harness's 40–60% band; `hourglass_sage` is 59.8%); median fight 33.0 s (P10 23.9 s, P90 48.8 s); overtime 14.8%; time cap 0.2%; home wins 50.5%; 1.97 ms per round at record `none`. These meet the M1.1 combat targets of §8.6 (archetypes 42–58%, classes 35–65%, median 25–40 s, time cap under 2%) but not the M1 targets of the table above (archetypes 47–53%, classes 45–55%).

### 8.3 Lifecycle soak targets

From `development.json` soakTargets (bands widened in m1/fix-core for D-T, because mentally weighted veterans now play on). Observed values: *soak* = the real sim, 48 clubs, seed `soak-1`, 20 seasons (`npm run soak`); *population tests* = core/fighters tests on seeds `population-1` and `population-2` with synthetic matches, as last recorded in the core/fighters README (they pass the bands below on main, but some recorded figures predate D-T); *old model* = the lifecycle draft's 24-club estimate.

| Metric (season 3 to the end of the run) | Target | Observed |
| --- | --- | --- |
| Population drift (rostered + free agents) | ≤ 10% | 3.8% (soak, 20 seasons; 1.4% over 10) |
| Median human-age | 26–32 | 26.7–32.0 (soak, seasons 1–20; 30.0 at season 20) |
| Share human-age ≤ 22 / ≥ 31 | 12–32% / 20–55% | 10-season soak: 14–19% / 27–53%. 20-season soak: ≥ 31 reaches 55.8% in season 11 and fails its cap (05 §12 KI-17). Population tests 22–28% / 20–30% |
| All-club top-5 rating drift; league mean drift | ≤ 4; ≤ 3 points | population tests −3.5 (59.4 → 55.9); −1.1 (48.9 → 47.8) |
| Highest rating | ≤ 95 | 94 (population tests) |
| Injuries per 40 rounds (human / elf / dwarf / orc / Ashkin) | 0.75–1.15 / 1.1–1.65 / 0.5–0.85 / 0.55–0.9 / 0.6–1.05 | per full-season starter (polish round): 0.92–0.97 / 1.10–1.26 / 0.54–0.66 / 0.64–0.69 / 0.77–0.81. M1.1 population test (`population-3`, `content/default`): 1.083 / 1.502 / 0.782 / 0.759 / Ashkin 1.063 at ×0.85, just over its band, hence ×0.82 (O25, D-AC) |
| Serious share; career-ending per league-season | 4–9%; 0.02–1.0 | 6.0%; 0.40 (population tests) |
| Starters' peak rating ÷ potential | 0.85–0.97 | median 0.94 (population tests) |
| AI captain mean CQ; grade-A share; below 40 | 65–88; 10–35%; ≤ 5% | 72.8–80.0; 48% at the old A threshold of 85, which m1/fix-tuning raised to 90; 0% |
| Rolled-trait positive share | 78–82% | 79.7% (population tests) |
| Retirements per season; median retirement human-age | — (reported) | 1–29, rising as world-generation veterans age out (soak, M1.1); physically weighted 38.8, mixed 42.0, mentally weighted 46.1 (m1/polish-core) |

Actions on failure: a falling population raises the intake base; top-5 deflation beyond 4 points tunes the market or AI first; an injury band failure tunes race multipliers first; too many grade-A captains raise the thresholds. Long-save check: by season 20 most world-generation fighters have retired; under D-T mentally weighted ones may still play (forced at human-age 58).

### 8.4 Economy soak (V1)

Every club AI-managed (the player club as `balanced`), in the headless harness (`economy.json` balanceTargets). Length per the soak ladder in §8: 1 seed × 10 seasons for the M1 gate, 10 seeds × 30 seasons for M7. A failed check blocks merging a balance change. The observed column is seed `soak-1` on main @ 293f49a (20 seasons unless stated); checks marked "not yet scripted" are not in `npm run soak` yet.

| Check | Pass band | Observed |
| --- | --- | --- |
| Solvency: clubs with balance ≥ 0 at each season end | ≥ 90% every season (vis-008) | 100% every season |
| Registry advances; embargo length | ≤ 2% of club-seasons; ≤ 16 weeks per club-season | not yet scripted |
| Median balance ÷ SB at season end | 0.10–1.00, with ≤ 5% of clubs above 2.0 | QA money check (M1; not re-run for M1.1): **1.84 by season 9** (outside the band). No double crediting; balances pile up because a club spends at most its WB and M1 has no other spending outlet (05 §12 KI-10) |
| Wage-to-income: tier mean; per club-season | 0.55–0.80; ≥ 90% within 0.40–0.95 | not yet scripted; median weekly wage 260–280, worst season-to-season change 5.5% (≤ 10%) |
| Money supply growth after season 5 | ≤ 5% of total SB per season | not yet scripted |
| Dynasty | a flag at 4 Reckoning titles by one club in 8 seasons or 6 Shields in 10; ≥ 8 distinct Crown champions in 25 seasons (median; `dynasty.minDistinctTier1ChampionsIn25`, to be restated for the 30-season M7 run) | 10 seasons: no flag. 20 seasons: **warning** (Keelwick Tarhands won the Crown Reckoning in seasons 8–11, and the check flags 4 titles inside an 8-season window; the check is warning-level, O25, D-AA); cautious-style AI clubs won 1 of 20 Crown titles and aggressive-style clubs 15 (05 §12) |
| Promoted survival | 50–80% (target 65%) | not yet scripted |
| Tanking | over 200 paired runs per seed, a club fielding its 5 lowest-rated fit fighters for a season has lower income over seasons s to s+2 and lower prestige at s+2 in ≥ 95% of pairs | not yet scripted |
| Pool health | 100–300 at P1; ≥ 60 in season; ≥ 5 per role | 156–268 at P1; in-season minimum 121 |
| League quality | top-5 mean per club per tier within ±5 of season 1 (vis-008); tier gaps ≥ 6 | not yet scripted |
| Hired blades; AI starter renewals | ≤ 1% of lineup slots; ≥ 70% re-signed | 0.02% of slots; renewals not yet scripted (36 AI renewals refused by the wage budget in 20 seasons) |
| Determinism | identical season summary hash for the same seed run twice (vis-009) | identical final checksum; every season-end save round-trips |
| Freshness rotation, level-ups and match squads (M1.1) | AI Tired ≤ 36% and Spent ≤ 12% of round starts; the cohort bands of §8.6 (a cohort under 20 fighters is reported, not gated; a larger one fails only beyond 2.5 standard errors of its mean); squad records legal, swaps per match 0.1–1.5 (provisional) | Tired 23.0% and Spent 5.1% of 161,080 AI round starts (27.1% and 7.9% by season 20); every cohort in band; 0.59 swaps a match (0.32 forced; 8,100 matches, 73 emergency entrants) |

**Reference situation** (re-derived from the v0.3 values): a par-prestige Banner club with 5 starters at rating 58 (market wage curve(58) = 255, ask 255 at human-age 28 or more) and 6 reserves at rating 50 (ask 160) has a bill of 2,235 ts per week, 75% of its WB of 2,960. A new career opens bills at 80–87% of WB (§7), which leaves room for the trials rookie and a tier-minimum signing. The draft's season-flow estimate (income about 100,300, costs about 84,800) used the old wage curve and is withdrawn; the soak evidence above replaces it until the wage-to-income check is scripted.

**Tuning order when a check fails:** solvency → SB components, then wage ratio; hoarding → reserve cap; wage-to-income → wage ratio; promoted survival → ascension or promotion grant; pool → intake base (D-H), then AI slack; dynasty → starter bonus up, prize spread down, reserve cap down (m1/fix-tuning already moved all three levers it used: starter bonus 500 → 1,000, reserve cap 25% → 10%, prestige reversion 15% → 25%).

### 8.5 Risks and deliberate asymmetry

- **Dominant strategies:** double-healer turtles (watch healing share and overtime; counters are Festering, Hushweaver and overtime); stacked hard control (the shared track and the cap); back-line dives against unprotected healers (protect presets, Knight, Harpooner); all-arcane lineups against armored tanks (ward values); always fielding the same five (prospects stall, so rotation pays, D-A); elf hoarding (injuries, slow climbs, wages); Ashkin churn (short careers, weak captains, no resale); captain ping-pong (free between locks, costly across locks); hoarding then splurging (10% reserve cap); lowballing (it saves at most half the flex and loses contested free agents); release and re-sign cheaper (blocked for the season); tanking (nothing rewards it: win bonuses, form-driven gate, table prize and the Reckoning all pay for winning, and rookies are not assigned by standing).
- **Snowball and stalemate:** early downs snowball inside a fight by design, and overtime prevents stalemates. Across seasons, potential is fixed, and aging, the starter bonus, the reserve cap and prestige reversion dampen dynasties.
- **Measured imbalances to fix (known issues, 05 §12):** class win rates still span 38.7–62.6% in the M1 pass-1 content (headsman 62.6%, cantor 38.7%; `hourglass_sage`, the M1 outlier at 61.7%, is now 59.8%); cautious-style AI clubs won 1 of 20 Crown titles in the 20-season soak; one Crown club took the Crown Reckoning four seasons running on seed `soak-1` (now a warning); AI clubs keep a full Muster cap after signing their trials rookie (measured on M1).
- **Deliberate asymmetry:** higher tiers are richer, which is the point of the climb, and talent drifts upward through the tier-gap premium. Races are balanced over a career, not per season. Mental-power classes age more gently. Arcane ignores armor. Long-range classes are fragile.

### 8.6 M1.1 targets: levels, Freshness and squads

**Status:** PROPOSED · TUNABLE (`levels.json` soakTargets; combat's balance plan). The Model column is the designers' scratch-model result (48 clubs, 3 seeds × 20 seasons, abstract fights); the last column is the real soak (seed `soak-1`, main @ 293f49a), re-run for the v0.6 sync (20-season values in brackets).

| Measure | Band | Model | Real soak (10 seasons) |
| --- | --- | --- | --- |
| Starter levels a season by human-age: 18–20 (P ≥ 70) / 21–23 / 24–26 (P 50–65) / 27–30 / 31–34 / 35+ | 4.0–6.5 / 3.0–4.5 / 2.2–3.5 / 1.6–2.8 / 0.9–2.0 / 0.4–1.3 | 4.8–5.3 / 3.7–3.8 / 2.6–2.7 / 2.3–2.4 / 1.5 / 0.8–0.9 | 5.5 (n 23) / 3.7 (n 228) / 2.6 (n 104) / 2.5 (n 602) / 1.6 (n 467) / 0.95 (n 387) [5.2 / 3.6 / 2.7 / 2.4 / 1.6 / 1.0] |
| Matches per level, mid cohort | 4.0–6.0 | 4.3–4.7 | 4.46 [4.46] |
| Bench levels ÷ starter levels (age-matched: bench levels over what same-age starters gain, regular starters of 10 or more matches against bench fighters of 2 or fewer) | 0.25–0.45 | 0.40–0.43 | 0.39 (0.51 pooled) [0.41 (0.58 pooled)] |
| AI Tired round-starts / Spent | ≤ 36% / ≤ 12% | 34.2–34.4% / 10.4–10.7% | 20.5% / 4.1% [23.0% / 5.1%] |
| Starter Stamina median | 10–14 | 11–12 | 13 [12] |
| Swaps per match (both sides) | 0.1–1.5 (provisional) | about 0.48: injury-forced 0.36, Freshness and lost-round 0.12 | 0.60: forced 0.30 [0.59: forced 0.32] |

The `development.json` soakTargets bands are unchanged; in the model the share at human-age ≥ 31 touched 0.57 in one seed (lever: the physical age factor from 31), and elves' injuries ran at 1.50–1.56 per 40 rounds. Freshness adds about 5% to injuries. In the real 20-season soak the share at human-age ≥ 31 reached 55.8% in season 11 and failed its 55% cap (05 §12 KI-17). The level-ups check gates a cohort only from 20 fighters up and fails it only beyond 2.5 standard errors of its mean, because the youngest cohort holds only about 25–30 fighters and a flat band flaked by seed (`MIN_COHORT_GATE`, `COHORT_NOISE_Z`).

**Combat targets at typical progression** (PROPOSED): archetypes 42–58%, classes 35–65%, median fight 25–40 s, time cap < 2%, overtime < 25%; no dominant perk; Freshness clearly felt but moderate (the `fatigue` mode: one fighter at F 28 → 44–48% win rate; all five at F 52 → 45–49%; at F 40 → 30–40%; at F 10 → 15–25%); swaps neither rescue nor doom the side that lost round 1 (the `squad-match` mode: comeback rate within −3 to +5 points of auto-swap off; no policy above 56% against off; two reserves against none 52–58%). New harness modes: `progression`, `perk-impact`, `rank-impact`, `fatigue`, `squad-match`. **Observed (v0.6, main @ 293f49a):** archetypes 44.1–53.5%, classes 38.7–62.6%, median fight 33.0 s, overtime 14.8%, time cap 0.2% (random-draft, seed `balance-1`, 20,000 rounds), all inside these bands; the `fatigue` figures are in sys-fight-freshness; the perk harness no longer flags Last Wall (5% since `m1.1/ki-fixes`, KI-19), but flags Battle Chaplain at +5.7 on seed `fp5` (KI-22). **`squad-match`** (10,000 matches, seed `balance-1`; it prints since KI-18 was fixed) misses its targets: swaps per match 0.36 against the harness band 0.6–1.4; the comeback rate is 5.7% with swaps off, `injured_only`, `threshold40` and `reserves2v0` alike (only `threshold60` lifts it, to 7.8%); `threshold40` wins 47.6% against its 51–55% target and `reserves2v0` 47.4% against 52–58% (05 §12 KI-21; to be looked at with the Q44/Q48 retune, O25). The targets above are unchanged.

**Risks:** "rest everyone, always" (countered by the rating gap); stacking Stamina picks (2% weight, a bonus that fades above 13); trait offers stacking positives (about 0.31 a season, capped at 4); bench XP making hoarding efficient (⅓ of a slot; wages); long-range and control stacking with perks and ranks (dominance flags, the 2.5 s cap); a "two fresh reserves always" meta (reserve value target 52–58%); many level-ups right after migrating a mid-season save.

## 9. Mechanical acceptance scenarios

**Status:** proposed acceptance requirements with exact expected results computed from the content at merge time. The automated suite covers them (1,093 tests on main @ 293f49a; the M1.1 cases carry their IDs in the test names, for example fr-001 in `src/core/sim/m11.test.ts`), re-derived for the M1.1 tuning; none has been signed off in a playtest. Scenarios that test an OPEN working assumption must change if the owner decides otherwise.

### 9.1 Combat

| ID | Initial state | Action / events | Exact expected outcome | Rule IDs | Milestone |
| --- | --- | --- | --- | --- | --- |
| det-001 | Any two lineups, match seed "a1b2c3d4e5f60718", recording `full` | Simulate the match twice in separate processes | Identical round winners, durations in ticks, final HP of all 10 units, event hashes and checksums | sys-fight-sim, sys-match (T4, vis-009) | M1 |
| det-002 | Same inputs | Simulate at recording `none`, `summary` and `full` | Identical checksums and results at all three levels | sys-match-report | M1 |
| cs-001 | The worked-example Knight (balance pass 1) | Compute derived values | Exactly the values in sys-combat-stats (1475 HP, armor 68, 163 mm per tick, Power 76, rating 60) | sys-combat-stats | M1 |
| cs-002 | Any class with all attributes 10 | Compute | Exactly the class base values; rating 50 | sys-combat-stats | M1 |
| cs-003 | Raise TGH by 1 | Compute | Max HP rises by trunc(base.hp × 0.04) ± 1 and armor by 2 | sys-combat-stats | M1 |
| mv-001 | Two fighters walking into each other | One tick | At least 1 m apart (centres) after separation | sys-movement | M1 |
| mv-002 | A rooted fighter in contact with a walking one | Separation | The rooted fighter is never pushed | sys-movement | M1 |
| mv-003 | A 3 m knockback toward a wall 1 m away | Displacement | The target moves 1 m and stops | sys-movement | M1 |
| cmb-001 | Assassin (CMP 12, tenacity 4%) attacking an Archer, centre 3.8 m from a Gongbearer | Gongbearer releases Clangor (3.5 m; taunt 1.0 s = 20 ticks) catching it | Taunted for trunc(20 × 0.96) = 19 ticks: decision forced at once to attack the Gongbearer (trace `taunted`); no rule evaluated until it ends; `control` track at step 1 | sys-tactics, sys-abilities | M1 |
| cmb-002 | Twinfang, CMP 10 | Stuns at 10.00 s (1.0 s), 11.50 s (0.8 s), 12.50 s (0.6 s); root at 13.00 s | Durations 20, trunc(16 × 0.6) = 9 and trunc(12 × 0.35) = 4 ticks; the root is resisted (`dr_immune`); a control applied at or after 18.50 s has full duration | sys-abilities | M1 |
| cmb-003 | Berserker (Power 90) against Briarback (armor 80 incl. passive) with Bristle active (+20 armor, thorns 0.15 + 0.40) | One basic hit, no crit, variance 0 | Briarback takes 90 × 100/200 = **45**; next tick the Berserker takes 0.55 × 90 = 49.50 × 100/125 = **39** reflected | sys-abilities | M1 |
| cmb-004 | Archer at 50/780 HP | Same tick: Shadowstep from an Assassin (Power 110: 160% × 110 = 176, +25% = 220, armor 15 → 191) and Suture (220 × 1.3 = 286) | HP = 50 − 191 + 286 = **145**, standing. If the Suture lands one tick later, the Archer is downed | sys-fight-sim | M1 |
| cmb-005 | Archer (armor 15) in the Knight's Sworn Shield aura and Guarded by Interpose (Knight armor 68, Fortified 15%) | Headsman (STR 14: Power 160) basic hit, no crit, variance 0 | 30% redirected: Knight takes 48.00 × 0.85 × 100/168 → **24**; Archer takes 112.00 × 0.92 × 100/115 → **89** (128 with the aura alone; 139 without guard and aura) | sys-abilities | M1 |
| cmb-006 | Archer 0.5 s into Aimed Shot, 100 focus | Hushweaver releases Hush | Cast interrupted (cause silence); focus stays 100; Aimed Shot not on cooldown; Silenced 30 ticks; basic attacks allowed; the rule's trace shows `silenced` | sys-fight-sim, sys-tactics | M1 |
| cmb-007 | Ally at 40 HP under Vigil (Vigilkeeper Support 105) | A 300-damage hit | HP set to 1, then healed 105 → **106**; `deathward.save`; ward removed | sys-abilities | M1 |
| cmb-008 | Tick 1,500; home 2 standing at 400/1500 and 300/850; away 2 standing at 900/1100 and 50/800 | Time cap | Standing 2–2; HP-fraction sums 2,666 + 3,529 = 6,195 against 8,181 + 625 = 8,806 → **away wins**, tiebreak step `hp_fraction_sum` | sys-fight-sim | M1 |
| cmb-009 | Chirurgeon (Balanced) at 12.40 s; lowest ally 66%; Suture ready in 1.8 s; no ally debuffed or controlled | Evaluation | R1 skip `cond_false`; R2 skip `cooldown` (36 ticks); R3 skip `cond_false`; the cautious stance attacks the nearest enemy | sys-tactics | M1 |
| cmb-010 | Two enemies at equal gaps of 3.40 m (slots 1 and 3); current target slot 3 | `nearest_enemy` | Slot 3 kept (stickiness); with no current target, slot 1 (lower slot) | sys-targeting | M1 |
| cmb-011 | 3 front + 2 back per side | Kickoff | Home front (9, 6), (9, 9), (9, 12), back (5, 7.5), (5, 10.5); away mirrored at x = 23 and 27 | sys-arena | M1 |
| cmb-012 | Any round | Run to completion | Ends by tick 1,500; every fighter's rule fires sum to its committed decisions | sys-fight-sim, sys-tactics | M1 |
| cmb-014 | Any fighter | Compute the rating in the fighter view, the market wage, the AI value and the harness OVR | All four use the same `combatRating` integer (D-Q) | sys-combat-stats, sys-fighters | M1 |
| cmb-013 | An AI club with tacticsStyle `cautious` fields a Knight | AI preset selection | The first Knight preset with style `protective` in presetIds order; if none, the class default | sys-tactics, sys-ai-manager | M1 |

### 9.2 Fighter lifecycle

| ID | Initial state | Action / events | Exact expected outcome | Rule IDs | Milestone |
| --- | --- | --- | --- | --- | --- |
| life-001 | Elf 42; orc 26; Ashkin 16 | Compute human-age | 28.0; 32.5; 24.6 | sys-races | M1 |
| life-002 | Human aged 30 at season end | Season-end step | Development and decline use age 30 (no wear), then age becomes 31 | sys-development | M1 |
| life-003 | A race with lifespan 100 and chanceMult 0.9 (human 80, 1.0) | Validate | Rejected (O11). Races of lifespan 64 with 0.85 and 72 with 0.80 both pass | sys-races | M1 |
| life-004 | A race tendency of 4.5, or a trait stat add of 4 | Validate | Rejected (caps ±4 and ±3, D-F) | sys-races, sys-traits | M1 |
| dev-001 | Human, steady pace, on the roster all season, 0 rounds started | Season end | seasonXp 0; usage 0; ΔD 0 on both clocks; wear and age still applied (D-A) | sys-development | M1 (retired in M1.1) |
| dev-002 | (M5) Academy fighter called up at MW6, never fielded | Season end | XP after call-up 0; academy XP up to MW6 kept (open-003) | sys-development, O3 | M5 |
| dev-003 | Human, D_physical 18.00, STR cap 1,600, bloom 0, full usage | Season end | D 19.00; STR 960 → 1,040 centipoints; shows 9 → 10; report "+1 STR" | sys-development | M1 (retired in M1.1) |
| dev-004 | Human, D_physical 29, STR cap 1,600 | Season end | STR developed stays 1,600 | sys-development | M1 (retired in M1.1) |
| dev-005 | Orc at human-age 21 with Early Spark, Rapid pace, full usage | Compute ΔD_physical | 1.25 (k) × 1.3 × 1.05 × 1.25 = 2.13, under the 2.5 cap; with Burns Fast ×1.1 = 2.35 | sys-development | M1 (retired in M1.1) |
| dev-006 | Round started, side won, 1 down credited, survived | XP | 15; in the Reckoning 18; Glory-Hungry in the league 17 | sys-development | M1 |
| dev-007 | `training.enabled` false, against all fighters Balanced | 20 seasons, same seed | Bit-identical results | sys-development | M1 |
| dev-008 | MW8; a fighter's projected rating change +3 | Roster view | Trend "Surging" | sys-development | M1 (retired in M1.1) |
| dev-009 | Two prospects, 40 rounds available, 13 XP per round: A starts 40 and B 0, or both start 20 | Season end | Concentrated: usage 1.0 + 0 = 1.0. Split: 260 XP each → usage 0.72 + 0.72 = 1.44 (D-A) | sys-development | M1 (retired in M1.1) |
| dev-010 | Human (a = 1.5) under Body for all 23 weeks | Season end | Physical multiplier 1.30 and mental 0.70 (sum 2.00); wear unchanged; with Regimented too (a clamped to 2) 1.40 and 0.60 (D-A) | sys-development | M1 (retired in M1.1) |
| age-001 | Human at human-age 31 | Season end | +0.2 wear (20 centipoints) on each physical stat; mental 0 | sys-development | M1 |
| age-002 | Human with Weathers Well at human-age 31 | Season end | Lookup at 29 → 0 wear | sys-development | M1 |
| age-003 | Dwarf aged 54 (human-age 60.0) | Season end | Mental wear 0.1 × 1.111 = 0.11 per mental stat (D-B) | sys-development | M1 |
| ret-001 | Human-age 30.9 | Retirement | Chance 0, no roll | sys-development | M1 |
| ret-002 | Any fighter at human-age 58.0 (human 58, elf 87, dwarf 52.2, orc 46.4, Ashkin 37.7) | Season end | Retires (100%) (D-T) | sys-development | M1 |
| ret-003 | Chance at P1 with usage 1.0 = 62% | P1 | Status final_season; digest entry; retires at season end without a roll even if the chance fell | sys-development | M1 |
| ret-004 | Career-ending injury in MW10 | Rest of season | Unavailable; retires at season end; not rolled | sys-injury | M1 |
| ret-005 | Free agent unsigned at season ends S, S+1 and S+2 | Season end S+2 | Leaves the league (after S+1 he is still in the pool); not counted in intake | sys-development | M1 (three season ends since m1.1/tune-life) |
| ret-006 | Dwarf aged 32 (human-age 35.5), peak rating 66, rating 60, usage 0.6, contract expiring, 1 scar | Retirement chance | hDrop 7.5%, hAge 0.22%; p = 7.70% × 1.5 + 3 = **14.55%** (D-T) | sys-development | M1 |
| ret-007 | Human healer at human-age 47, 2 below his peak, usage 0.5, contract running past this season | Retirement chance | 1.5% × 0.6 = **0.9%** (D-T: mentally weighted fighters play on) | sys-development | M1 |
| inj-001 | Knock rolled in MW5 | MW6, MW7 | Unavailable at the MW6 lock; available at MW7 | sys-injury | M1 |
| inj-002 | Injury rolls succeed in rounds 1 and 3 | Match end | Exactly one injury (round 1's); rounds 2–3 played | sys-injury | M1 |
| inj-003 | Human-age 33, 1 scar, serious injury | Career-ending check | Not rolled (not At risk); no badge was shown | sys-injury | M1 |
| inj-004 | Human-age 35 (At risk), serious injury | Career-ending roll | 8%; the lineup screen showed the per-match chance (≤ 0.5%) beforehand | sys-injury | M1 |
| inj-005 | Elf at human-age 35, serious, 11 base weeks | Duration | 11 × 1.2 × 1.30 = 17.16 → 17 weeks | sys-injury | M1 |
| inj-006 | 10 weeks out at the end of TW3 | Season end, P1–P4 | 2 weeks left after the off-season: out P1–P2, available P3 | sys-injury | M1 |
| inj-007 | Human, tgh 10, downed, 110% of max HP taken, human-age 27 | Chance | 3.24% (324 bp) | sys-injury | M1 |
| inj-008 | Scar Rebuilt Knee gained | After the match | pac −2 effective; potential recomputed lower; the trait appears in the report | sys-injury, sys-traits | M1 |
| inj-009 | AI and player fighters with identical state | Same round data | Identical chance (P-04) | sys-injury | M1 |
| trait-001 | 100,000 generated fighters | Roll | Never 2 rolled negatives; no opposite or excluded pair; positive share 78–82% | sys-traits | M1 |
| trait-002 | Human-age 22 at generation | Roll | Green Nerves never chosen | sys-traits | M1 |
| trait-003 | Green Nerves; career rounds 119 → 121 in one match | Match end | Trait removed; "Green Nerves faded" | sys-traits | M1 |
| trait-004 | Hot Blood at human-age 30 | Season end | 15% removal roll; none at 29.9 | sys-traits | M1 |
| trait-005 | 300th career round reached in MW9 | Season end | Sand-Wise gained at season end, not at MW9; Skittish 50% cure | sys-traits | M1 |
| trait-006 | Any fighter after generation | Any event | Physique traits never added or removed | sys-traits | M1 |
| trait-007 | 4 rolled and 4 acquired traits; a scar is rolled | Injury | Scar not added (cap 8), logged; the injury still applies | sys-traits | M1 |
| trait-008 | `combat.json` adapter lacks an entry for a trait | Fight | No in-fight effect; lifecycle effects still apply | sys-traits | M1 |
| cap-001 | The worked-example veteran | Compute | CQ 76, grade B | sys-captaincy | M1 |
| cap-002 | Club captain benched; vice-captain fielded with CQ 70 | Lock | The vice-captain is lineup captain; combat receives 60 | sys-captaincy | M1 |
| cap-003 | Player changes captain A → B → A between two matches | Next lock | No Snubbed, no Passed Over | sys-captaincy | M1 |
| cap-004 | A fit captain of 10 matchweeks replaced at the MW8 lock | Lock | Former captain Snubbed 6 weeks (−2 chemistry when fielded) | sys-captaincy | M1 |
| cap-005 | Captain injured for 5 weeks, replaced | Lock | No Snubbed (exemption) | sys-captaincy | M1 |
| cap-006 | New captain CQ 52; fit club-mate human-age 31 with CQ 70, not vice | Lock | Club-mate Passed Over; making him vice-captain clears it | sys-captaincy | M1 |
| cap-007 | Captain of 25 matchweeks released at MW12 | Week processing | Club status Captain Departed 4 weeks; interim captain named at the next lock by rule 0 (D-S) | sys-captaincy | M1 |
| cap-008 | Fit club captain not fielded in MW5–MW8 | MW9 lock | Losing the Room −10 CQ; cleared when fielded | sys-captaincy | M1 |
| cap-009 | Grade-A captain all season; club-mate aged 21 (human-age 21); another club-mate has Shares the Craft | Season end | Mentor ×1.08 × 1.04 = ×1.1232 (≤ 1.15 cap) | sys-captaincy, sys-development | M1 |
| cap-010 | AI club, season-end AI phase; incumbent CQ 70, challenger 74; then the incumbent is injured for 6 weeks in MW7 | AI phases | No change at the season-end phase (74 < 70 + 5). At MW7 the AI appoints the highest-CQ projected starter; no Snubbed (injury exemption) (D-I) | sys-captaincy, sys-ai-manager | M1 |
| cap-011 | The player's club has no club captain at the MW1 lock; vice-captain injured; fit starters with CQ 61, 74 (12 matchweeks at the club), 74 (20 matchweeks) | Play match | The 74-CQ starter with 20 matchweeks becomes club captain; `captain.interim` (reason starter) in the digest; Play match was never blocked (D-S) | sys-captaincy | M1 |
| chem-001 | The worked-example lineup | Lock | Chemistry 0 → composure +0; benching the snubbed fighter → +2 → +1 composure each | sys-chemistry | M1 |
| chem-002 | A Walks Alone fighter; chemistry +4 | Lock | He gets +0 composure; the others +2 | sys-chemistry | M1 |
| gen-001 | 1,000 rookies per race | Generate | Ages within debut ranges (Ashkin 16–17, elf 28–33) | sys-youth-intake | M1 |
| gen-002 | A name collision with a living fighter | Generate | Retried; never two identical full names among living fighters | sys-fighters | M1 |
| gen-003 | Any generation | Validate | P 30–97; caps 2–20; D ≥ 16; potential within ±6 of P before traits | sys-fighters | M1 |
| gen-004 | World generation, human aged 35 | Generate | Wear 0.2 + 0.2 + 0.3 + 0.3 = 1.0 on each physical stat; career rounds > 0 with matches and rounds won consistent with them; debutSeason = 1 − proSeasons; Sand-Wise if ≥ 300 | sys-fighters | M1 |
| gen-005 | The same career seed twice | World generation | Identical fighters, names and traits | sys-fighters | M1 |
| intake-001 | 48 clubs; 40 retirements and 1 career-ending injury this season; 6 leavers | Next-season setup | rookies = round(48 × 0.8) + 41 = 38 + 41 = 79, clamped to the maximum 77 (round(48 × 1.6)); trials day gives 1 to each club and 29 by lot (D-H) | sys-youth-intake, sys-transfers | M1 |
| intake-002 | New career, any seed | World creation, then the P1 processing | Exactly 48 trials rookies, one per club; every AI club's captains, emphasis and opening offers already set before P1; AI trials signings at the first P1 processing on 3-season deals; each club's opening balance equals its starting balance and the first grant installment is a separate ledger entry (D-P) | sys-youth-intake, sys-transfers, sys-finance | M1 |

### 9.3 League and economy

All values come from the current `economy.json` and `leagues.json`.

| ID | Initial state | Action / events | Exact expected outcome | Rule IDs | Milestone |
| --- | --- | --- | --- | --- | --- |
| le-001 | 16 clubs in any seed order | Generate the tier's schedule | 16 fixtures per club (8 home, 8 away); each wing rival met home and away; 2 different cross-wing opponents (1 home, 1 away); exactly one fixture per club in each of MW1–16; 8 fixtures per matchweek; no byes | sys-league | M1 |
| le-002 | Seed order c01…c16, season 1 | Wing draw and cross weeks | Dawn {c01, c04, c05, c08, c09, c12, c13, c16}; Dusk {c02, c03, c06, c07, c10, c11, c14, c15}; MW5 includes c01 (home) v c02; MW12 includes c15 (home) v c01; season 2 swaps the hosts | sys-league | M1 |
| le-003 | A match ends 2–1 | Record | Winner +2 points, loser +1; rounds won and lost updated | sys-league | M1 |
| le-004 | X and Y level on points, match wins and round difference; X beat Y 2–1 and lost 0–2 | Rank | Head-to-head points X 2, Y 4 → Y ahead; if still level: rounds won, then downs difference, then lot | sys-league | M1 |
| le-005 | Final wing tables as in sys-tournament's example | Seed the Reckoning | Seeds A, E, F, B, C, G, D, H; QF A–H, B–C, E–D, F–G hosted by the first-named; Dusk's 5th (32) out, H (29) in | sys-tournament | M1 |
| le-006 | QF: A beats H, B beats C, D (7) beats E (2), F beats G | Build the SF | SF1 A (host) v B; SF2 F (host, seed 3) v D; final best-of-5 at the Charterhall | sys-tournament | M1 |
| le-007 | Muster Reckoning champion is tier-table #6; another club is #1. Banner 8th places are P and Q | Season end | Both Muster clubs go up; P and Q go down; each tier has 16 clubs next season | sys-league | M1 |
| le-008 | Muster tier-table #1 also wins the Reckoning | Season end | Promoted together with tier-table #2 | sys-league | M1 |
| le-009 | Banner club with 12 fighters relegated | Setup; the player reaches the end of P4 | P1 shows 12/10 and a cap-relief allowance of 2 at payout 0; Kick off blocked with "Roster over cap: release 2 fighters"; after 2 releases it proceeds | sys-roster | M1 |
| le-010 | Contract ends this season, not renewed | Season end | Free agent at P1 with formerClubId set; the former club may offer like anyone | sys-contracts | M1 |
| le-032 | The player's fighter on an expiring contract, after TW3, season-end step pending | Renew him, then run the season end | The renewal is accepted; the expiry step keeps the renewed contract. Four weeks before the season's end the digest had one urgent `contract.expiring` item for him | sys-contracts, sys-calendar | M1 |
| le-011 | Brannoc at his Banner club (prestige 50), expiring, started 12 of 14 matches (situation −500) | Offer 255 for 2 seasons | Ask floor5(285 × 9,800 ÷ 10,000) = 275; ratio 9,272 → counter 265; accepting renews at 265 from next season; signing cost floor10(265 × 46 × 10%) = 1,210 | sys-contracts | M1 |
| le-012 | Same fighter, patience 3 | Three offers of 240 (ratio 8,727) | Three refusals; then "will not renew this season"; he is a free agent at season end | sys-contracts | M1 |
| le-013 | Brannoc: ask 290 at A (Banner p50, would start) and 285 at B (Crown p60, would not) | A offers 290, B 310; week processing | Scores 11,000 and 10,877 → signs with A; B's digest says "signed with A" | sys-transfers | M1 |
| le-014 | Muster club, roster 9, 1 pending offer | A second offer | Refused: "Roster full with pending offers (9 + 1 of 10)" | sys-roster, sys-transfers | M1 |
| le-015 | Muster club, WB 1,138, bill 1,000, nothing pending | Offers at 150, then 135 | 150 refused ("over wage budget by 12 per week"); 135 accepted as pending | sys-finance | M1 |
| le-016 | Banner club, balance 1,200, P1 | Offer to Brannoc at 290 for 2 seasons | Refused: signing cost 1,300 > balance 1,200 | sys-finance, sys-contracts | M1 |
| le-017 | Brannoc on 290 to the end of next season; current week MW6, before processing | Release | Payout floor10(290 × 37 × 50%) = 5,360 charged at once; he cannot re-sign with this club this season | sys-contracts | M1 |
| le-018 | Muster club (prestige 20), balance 300 before the MW10 processing, bill 900, away week | Process MW10, then MW11 (home, a win, 5 wins in 10 before it) | MW10: 300 + 313 − 900 − 210 = −497 → embargo; an offer at 150 is refused (tier minimum 60). MW11: −497 + 313 + 1,400 + 200 − 900 − 210 = 306 → embargo lifted | sys-finance | M1 |
| le-019 | Muster club at balance −6,000 after its 8th consecutive debt week | That processing, then setup | Advance 6,000 → balance 0, prestige −5; next grant 14,000 − 4,200 = 9,800 (installments 4,900 + 4,900); 1,800 carried to the following season | sys-finance | M1 |
| le-020 | Crown club relegated; a fighter earns 721 | Setup | Wage 575; parachute 24,000 now and 12,000 next season; WB computed in the Banner Circuit | sys-contracts, sys-finance | M1 |
| le-021 | Muster club promoted, prestige 30 after the update, balance 12,000 | Setup in the Banner Circuit | SB 86,984 (34,000 grant + 8,500 promotion grant + retainer 17,108 + gate 8 × 3,422); reserve contribution 0; WB 3,252 per week (7,800 + 800 bp) | sys-finance | M1 |
| le-022 | P1; the player's Muster club has 2 trials rookies (one asks 150 on the open market) | Sign him at his Trials Day ask for 3 seasons; ignore the other; Continue | His ask is capped by the rookie scale at 75 (D-P); he signs at once, signing cost 0, paid from the P1 processing; the second enters the pool at the P1 processing before the AI acts | sys-transfers | M1 |
| le-023 | MW6; free agent asking 150 for 1 season, no rivals | Offer 150; MW6 processing | Signed at MW6 processing; paid from MW7 (13 weeks); signing cost 190; eligible for the MW7 lineup | sys-transfers, sys-roster | M1 |
| le-024 | Banner club with 4 fit fighters at lock | Play the match | A hired blade fills the slot, is paid 150 (the Banner minimum) at that processing, and is not on the roster afterwards | sys-roster | M1 |
| le-025 | AI club, fit: Tank 48, Healer 44, others 50, 47, 46, 45, 41; not Seedbed; nobody At risk | AI lineup | Tank 48, Healer 44, 50, 47, 46; presets by tacticsStyle; match captain = club captain if fielded | sys-ai-manager | M1 |
| le-026 | Ledger-keepers Muster club, WB 1,138 (× 0.88 → 1,001), bill 950, roster 8 | AI action phase | Wage room 51, below the tier minimum 60: no offer this week | sys-ai-manager | M1 |
| le-027 | Same world seed and inputs | 3 headless seasons, twice | Identical fixtures, results, signings, ledgers and summary hash (P-05, vis-009) | all | M1 |
| le-028 | Final tier tables | Season end | Banner rank 3 receives 8,750; Crown rank 16 receives 1,560; Muster rank 9 receives 2,000 | sys-finance | M1 |
| le-029 | Muster club, prestige 26, tier rank 2, wins the Reckoning, promoted | Prestige update | delta = 4 + 5 + 8 = 17; new = 43 − trunc((43 − 45) × 0.25) = 43 | sys-league | M1 |
| le-030 | New career, any seed | World generation | Free-agent pool = 2.5 × 48 = 120 fighters before P1 (D-C); every club's opening bill within 80–87% of its WB (D-P); no patron goal shown or paid (D-C) | sys-transfers, sys-patron, sys-finance | M1 |
| le-031 | MW3; the player's lineup is valid | Play match | The week processing runs, the player's result is committed with every other result and the autosave is written before the report opens; reloading that autosave shows the same result, and quitting at the report changes nothing (D-O) | sys-calendar, sys-save | M1 |
| le-033 | EXAMPLE (wages, budget and room as in the core `next-season` test, asks as in the Market `renewals-next-season` UI test): MW15, any week of the final season; WB 1,110, wage bill 1,095 (contracts that continue 710; three contracts end this season, at 70, 80 and 235, asking 75, 85 and 345); today's room is 15, next season's 400 before any renewal | Renew the fighter on 235 at his ask, 345 (a raise of 110) | Accepted: commitments 710 + 345 = 1,055 ≤ 1,110, so 55 a week of next season's room is left, and the check reports the next-season basis. The old rule would refuse it: 1,095 + 345 − 235 = 1,205 > 1,110. The three asks together, 505, are 105 over the 400 | sys-contracts, sys-finance, O32 | M1.1 |
| le-034 | The same club after the 235 fighter is renewed at 345; the fighter on 80 asks 85 | Renew the fighter on 80 at 85 (a raise of 5) | Refused with `budget.wage` ("Over next season's wage budget by 30 per week", basis next-season, room 1,110 − 1,055 = 55): 710 + 345 + 85 = 1,140 > 1,110. Had the first renewal not been made, 710 + 85 = 795 would fit. A renewal at 80 or less would still be allowed (le-035) | sys-finance, O32 | M1.1 |
| le-035 | The same club with next season's room negative (commitments above the projected WB) | Renew a fighter at his current wage or lower | Accepted: a renewal that does not raise his wage is allowed whatever the room | sys-finance, O32 | M1.1 |
| le-036 | The same seed and inputs for a season and its end, with the compaction rule off and on (3 weeks and 1 week) | Compare the states | Everything except the compacted detail is identical: the standings, each club's last fielded five and the renewal asks, every week (O24) | sys-league, sys-contracts, sys-match-report | M1.1 |

### 9.4 M1.1 "Playtest round 1"

Merged from the M1.1 drafts (progression.md §8, combat-skills.md §9; the architect's note on sw-007, 05 §9.3: lowest Freshness first). Class names are the display names of O21. The draft's cap-011 is cap-012 here, because 9.2 already uses cap-011. Values come from `levels.json`, `perks.json`, `ability-ranks.json` and `combat.json` on main @ 293f49a, re-derived after the M1.1 tuning. The XP-per-level cases lvl-001 to lvl-004 are for `content/default`; their unit tests in `core/fighters` run on the frozen fixture content, which keeps the draft's 115 / 0.72 / 1.25 (155 for lvl-001, 500 for lvl-003).

| ID | Initial state | Action / events | Exact expected outcome | Rule IDs | Milestone |
| --- | --- | --- | --- | --- | --- |
| bxp-001 | Club wins 2–1; its starters' round XP sums to 196; fit fighter F outside the squad | Match end | F +13 XP (floor(196 × 3,333 ÷ 50,000) = floor(13.07)); Glory-Hungry F +15 | sys-development, O17 | M1.1 |
| bxp-002 | Squad reserve R never enters | Match end | Bench XP as bxp-001; at the week processing, rest × 0.8 | sys-development, sys-freshness | M1.1 |
| bxp-003 | Fighter injured at lineup lock (weeksOut 2) | Match end | 0 XP | O17 | M1.1 |
| bxp-004 | Starter S swapped out after round 1 (lost, downed, no down credit) of a 3-round match | Match end | S has 10 XP for the match, no bench XP; proposing S as an incoming fighter after round 2 is rejected `not_a_reserve` (combat sw-002) | sys-development, O20 | M1.1 |
| bxp-005 | Reserve enters for round 2, wins rounds 2 and 3, 1 down credit each, not downed | Match end | 15 + 15 = 30 XP; no bench XP | sys-development | M1.1 |
| lvl-001 | Knight human 25, Steady, level 20, potential 62, trained rating 54, no traits | xpNeeded | 114 × 1.10 × 1.0 = 125.4 → **125** | sys-development | M1.1 |
| lvl-002 | Wizard human 19, Brisk, level 8, gap 20 | xpNeeded | **65**; with Quick Study or with an A-grade captain (1.08) the 60 minimum applies (raw 58.2 and 59.5) | sys-development | M1.1 |
| lvl-003 | Chirurgeon human 33, Steady, level 34, gap 1.5 | xpNeeded | **450** | sys-development | M1.1 |
| lvl-004 | Netcaster elf aged 30 (human-age 20.0), level 9, gap 18 | xpNeeded | **115** (lifeScale 1.5, raceGrowth 1.036) | sys-development, D-B | M1.1 |
| lvl-005 | 13 stats, every cap 1,400, every train100 1,000 | Initial level | Σ max(0, 1,000 − 700) = 3,900 → **level 40** | sys-development | M1.1 |
| lvl-006 | xpNeeded 60, xpIntoLevel 50, match XP 150 | Match end | Two level-ups (50 + 150 − 60 = 140; − next xpNeeded); the remainder stays in the bar even if ≥ the next requirement; the third triggers at the next match end | sys-development | M1.1 |
| lvl-007 | Level 21 / 24 / 27 reached | Offer | 3 stats / 2 stats + 1 skill / 1 stat + 2 skills (one rank step, one perk when both are eligible) | sys-development | M1.1 |
| lvl-008 | STR train 1,560, cap 1,600; STR offered and picked | Pick | STR 1,600 (+40); a capped stat is never offered | sys-development, O18 | M1.1 |
| lvl-009 | 3 level-ups pending; a 4th arrives | Match end | The oldest is auto-resolved by the fighter's policy and the digest says so; 3 remain | sys-development | M1.1 |
| lvl-010 | Offer generated at match end; save; reload | Open the dialog | The same 3 options (and the same trait offer) | P-05 | M1.1 |
| lvl-011 | Balanced Knight, Stamina 9, offered STR / AWR / Stamina | Auto-pick | Scores 0.90 / 0.20 / 0.80 → STR | sys-development | M1.1 |
| lvl-012 | Trait offer: option 2 is a burden | Auto-pick | Takes option 1 (positive), never the burden; with two burdens impossible (option 1 is always positive) | sys-development | M1.1 |
| lvl-013 | 2 level-ups pending at season end | Season-end step 6 | Both auto-resolved before wear and age +1 | sys-development | M1.1 |
| lvl-014 | Human 30, pick raises rating 61 → 62 in MW9 | Next lineup lock | Rating 62 used; peakRating ≥ 62 | sys-development | M1.1 |
| frs-001 | Stamina 16, human 26; round 30 s, 60% taken, not downed | `freshnessAfterRound` | 4.2 × 0.92 = 3.864 → **3.9**; F 100 → 96.1; the sim receives 96 next round | sys-freshness | M1.1 |
| frs-002 | Stamina 6, human 34; round 38 s, 110% taken, downed | Drain | intensity 1.207 → **10.9** | sys-freshness | M1.1 |
| frs-003 | Elf aged 30 (human-age 20), Stamina 10, typical round | Drain | 7.08 × 1.0 × 1.1 → **7.8** | sys-freshness | M1.1 |
| frs-004 | Stamina 16, typical rounds from 100, no rest | Rounds 1–11 | Rounds 1–10 start ≥ 62.2; round 11 starts at 58.0 (Tired). Stamina 6: rounds 1–5 at ≥ 64, round 6 at 55 | sys-freshness, O19 | M1.1 |
| frs-005 | Week with no round started: Stamina 16 human 26 / Stamina 6 human 34 / the latter as a squad reserve | Week processing | +46.0 / +30.6 / +24.5 | sys-freshness | M1.1 |
| frs-006 | Withdrawn after round 1 at 53.1 with Second Breath | Rest of the match and that week | Stays 53.1 (no +8, no drain); no weekly rest that week | sys-freshness, O20 | M1.1 |
| frs-007 | Active fighter with Second Breath, F 50 after the drain | Between-round step | 58 (combat pk-002) | sys-freshness | M1.1 |
| frs-008 | Stamina 16 with Campaign Legs, typical round | Drain | 4.2 × 0.85 → 3.6 | sys-freshness | M1.1 |
| frs-009 | Round start F 45 / 60 / 0 | Injury roll | p × 1.09 / × 1 / × 1.36 | sys-injury, sys-freshness | M1.1 |
| frs-010 | Any fighter, season end | Step 9 | Freshness 100 | sys-freshness | M1.1 |
| frs-011 | Stamina 6, human in his prime, typical rounds back to back from 100, `tiredDrainShare` 0.5 | Rounds 1–18 | Starts 100, 91, 82, 73, 64, then 55 (round 6, Tired: the onset is unchanged), then 4.5 a round: 50.5, 46, 41.5, 37 (round 10 starts Spent, was round 8), still above 0 at round 18 (was 0 from round 13). A round starting at exactly 60 drains in full, one starting at 59.9 half; Stamina 11 first starts Tired in round 8 and Stamina 16 in round 11 | sys-freshness, O25, D-AB | M1.1 |
| inj-010 | Starter injured (minor) in round 1 of 3; one unused reserve, swaps 0 | Between-round step | He plays no later round; the reserve enters (swap 1); weeksOut 2 from next week; no second injury roll for him | sys-injury | M1.1 |
| ai-001 | AI starter Stamina 16, F 62 at lock, typical drain 4.2; bench fighter F 90 within 6 rating | AI lock | 62 < 64.2: rested; the substitute starts | sys-freshness, sys-ai-manager | M1.1 |
| ai-002 | Same starter at F 66.5 | AI lock | Plays (66.5 ≥ 64.2) | sys-freshness | M1.1 |
| ai-003 | AI youth_focused, lost round 1, starter at F 53, reserve F 90 within 6 rating; swaps 0 | Auto-swap | Threshold 50 + 10 = 60 → swapped (53 + 15 ≤ 90) | sys-freshness, combat sys-match | M1.1 |
| ai-004 | AI balanced, won round 1, starter at F 45 | Auto-swap | No swap (45 ≥ 40) | combat sys-match | M1.1 |
| cap-012 | Fit club captain, F 52 at lock, left out of the squad 5 matches in a row | Each lock | Losing the Room never starts (rests exempt); named as a reserve counts as fielded | sys-captaincy | M1.1 |
| chem-003 | Lineup chemistry +3 at lock; reserve with Good Company enters | Round 2 | He gets +1 composure (3 ÷ 2 toward zero); chemistry stays +3 | sys-chemistry | M1.1 |
| sta-001 | Human Knight, P 60, jitter 0, human-age 26, D 26, bloom 0 | Generation | Stamina cap 1,427; train100 = 1,341; shows 13 | sys-fighters | M1.1 |
| sta-002 | That fighter from 31 to 36 | Season ends | Wear 1.4 points → Stamina 12 | sys-fighters | M1.1 |
| sta-003 | Race tendency for stamina 4.5 | Validator | Rejected (cap ±4) | sys-races | M1.1 |
| mig-001 | v2 save at MW8; fighter with season round XP 210, xpNeeded 155 after migration | Load | Every shown stat except Stamina unchanged; xpIntoLevel 154; no pending level-up; Freshness 100 | sys-save | M1.1 |
| mig-002 | The same v2 save migrated twice | Compare | Byte-identical v3 states | sys-save | M1.1 |
| mig-003 | Fighter rating 64 → 65 by the reweight; peakRating 70 | Load | peakRating 71 | sys-save | M1.1 |
| rk-001 | Knight (worked example, Power 76), Shield Bash rank 3 | Cast | Cooldown 6 s (rank 2: 7.5 s; rank 1: 9 s), focus 15, coefficient 1.54 → 117.04 before mitigation (rank 1: 106.40); stun still 0.8 s before DR and tenacity | sys-ability-ranks | M1.1 |
| rk-002 | Chirurgeon (Support 100), Suture rank 2, ally at 30% HP | Release | 2.46 × 100 × 1.3 = **319** healing; rank 3 keeps the 5 s cooldown and costs 15 focus instead of 20 | sys-ability-ranks | M1.1 |
| rk-003 | Wizard, Firebloom rank 3 | Cast | Radius 3.0 m (rank 1: 2.5 m); coefficient 1.32 | sys-ability-ranks | M1.1 |
| rk-004 | Knight, Sworn Shield rank 3 | Ally within 3 m hit | Ally damage-taken modifier −0.12 (rank 1: −0.08) | sys-ability-ranks | M1.1 |
| rk-005 | Any control ability at rank 3 | Validate | Hard- and soft-control durations equal rank 1 (Slumber 2.5 s, Shield Bash 0.8 s, Torpor Field's Slowed 3 s) | sys-ability-ranks | M1.1 |
| rk-006 | Hourglass Sage, Torpor Field rank 3 | Cast; and a content file that lengthens a Slowed or Sluggish duration at a higher rank | Cooldown 12 → 10.5 s with Slowed and Sluggish unchanged; the file is refused by the validator (soft control is checked like hard control) | sys-ability-ranks | M1.1 |
| fr-001 | Worked-example Knight, round starts at F 45 (s = 3,000 bp) | Round build | Interval 1.3 ÷ 0.951 = **1.367 s**; Power trunc(72 × 1.056 × 0.9808) = **74**; move **160 mm/tick**; reaction 0.323 s = **6 ticks**; tag "Tired (45)" | sys-fight-freshness | M1.1 |
| fr-002 | Same, F 10 | Round build | Interval **1.453 s**; Power **71**; move **155 mm/tick**; reaction **7 ticks**; tag "Spent (10)" | sys-fight-freshness | M1.1 |
| fr-003 | F 60 | Round build | s = 0: no penalty, no tag | sys-fight-freshness | M1.1 |
| fr-004 | Fighter starts round 1 at F 64; lifecycle drains it to 56 after round 1 | Rounds 1 and 2 | Round 1: no penalty for the whole round. Round 2: s = 800 bp, i.e. attack speed −0.64%, move −0.38%, Power and Support −0.51%, reaction +1.6%, constant for all of round 2; the between-round screen shows "Ready → Tired (56)" before round 2 | sys-fight-freshness | M1.1 |
| fr-005 | Any fighter at Freshness 60 or above, and one with no recorded Freshness | Effective rating (display) | The effective rating equals the rating and the loss is 0; a missing Freshness reads as 100 | sys-fight-freshness, O28 | M1.1 |
| fr-006 | A Knight (`content/default`) at Freshness 10, then 35 | Effective rating | At 10 (the full penalty) it is about 5–6 points below the rating; at 35 (s = 0.5) about half of that; never above the rating; the loss is the sum of the priced parts (attack speed, move speed, Power, Support where the class has it, reaction) | sys-fight-freshness, O28 | M1.1 |
| pk-001 | F 28 (s 6,400 bp), Long Wind | Round build | Severity 3,840 bp: attack speed −3.07%, move −1.84%, Power and Support −2.46%, reaction +7.7% | sys-perks | M1.1 |
| pk-002 | Knight 1,475 HP with Second Breath at 600 HP; between-round step at F 50 | A hit leaves 450 HP (30.5%); later the round ends | The commit fires `self_hp_below 35`; next tick heals trunc(0.10 × 1475) = **147** → 597 HP; never again that round. At the between-round step Freshness 50 → 58 (after lifecycle's drain) | sys-perks | M1.1 |
| pk-003 | Acting captain grade A (+2) with Banner Voice | Round start | Every fielded ally composure +3 → tenacity +6%; inside the 10% captain cap | sys-perks | M1.1 |
| pk-004 | Fighter holding Finisher and 1 other perk | Offer generation | First Cut never offered (exclusive); Executioner's Rush eligible (2 held + Finisher) | sys-perks | M1.1 |
| pk-005 | Reserve with Fresh Legs enters after round 1 | Rounds 2 and 3 | Round 2: +8% damage dealt, +2 composure (`enteredThisRound` true). Round 3: no bonus | sys-perks | M1.1 |
| st-001 | Class weights | Validate | 13 rating weights per class summing to exactly 1.00; `stamina` = 0.02; no stamina term in any fight formula | sys-combat-stats | M1.1 |
| sw-001 | Squad: 5 starters + 2 reserves, all fit and distinct | Lineup lock | Legal. A duplicate fighter or an injured reserve is rejected with a reason; 0 or 1 reserve is legal when no other fighter is fit | sys-match, O20 | M1.1 |
| sw-002 | Best-of-3, after round 1 (home 0–1) | Home swaps starter A for reserve R1; A keeps slot 2 front | swapsUsed 1; R1 plays round 2 in slot 2, front row, with its own preset; A is withdrawn. After round 2, home proposes A for R1: rejected `not_a_reserve` (a withdrawn fighter cannot return) | sys-match, O20 | M1.1 |
| sw-003 | Best-of-5, both swaps used after round 2; in round 3 starter B is injured (minor) | Between-round step after round 3 | No reserve left: an emergency entrant enters (the best-fit fit roster fighter outside the squad, else a hired blade); swapsUsed stays 2; the record says reason `emergency`, costsSwap false | sys-match, O20 | M1.1 |
| sw-004 | Best-of-3, after round 1: swapsUsed 1, one unused reserve; starter C injured | Between-round step | The reserve enters for C (forced) and swapsUsed becomes 2; no other swap is possible; rounds 2 and 3 use these five unless another injury happens | sys-match, O20 | M1.1 |
| sw-005 | After round 1 both clubs decide | Home swaps, away swaps | Both decisions are made from the same post-round state and applied home then away; neither side's decision depends on the other's; the report shows both lines under "After round 1" | sys-match, O20 | M1.1 |
| sw-006 | Acting captain swapped out after round 1; the vice is active | Round 2 | The vice is acting captain with CQ − 10 (grade recomputed); if the vice is not active, the highest-CQ active fighter (ties: lower slot) | sys-match, O20 | M1.1 |
| sw-007 | Auto-swap threshold 40, keepOneForInjury on; best-of-3 after round 1: starters at F 38 and F 35, reserves at F 90 and F 70 (same role family, rating within 6) | Auto procedure | Lowest first: the F 35 starter → the F 90 reserve. The F 38 starter is not swapped (the last swap is kept for injury). After round 2 (the last possible step) the F 38 starter is swapped if still below 40 | sys-match, O20 | M1.1 |
| sw-008 | Any played match with swaps | Replay from the MatchResult | Every round re-simulates from `rounds[].input` with an identical event hash and checksum; no decision policy runs during the replay | sys-match, O20 | M1.1 |
| sw-009 | The player quits on the between-round screen after round 1 | Reload | The match resumes on the same screen with round 1's result unchanged and no decision recorded yet | sys-match, O20 | M1.1 |
| sw-010 | The player's club in a match; the opponent's pending auto-swap decision | The between-round view; then `match.swap` for the opponent's club, a club that does not play, or with no player club | The view carries the player's suggestions only (the opponent's side is empty and was never computed for the view); the command is refused with `match.not-player-club` | sys-match, O25, D-U | M1.1 |
| sav-001 | Content whose value exceeds a `SAVE_BOUNDS` constant (for example 4 queued level-ups, 3 swaps per match, 5 perks) | Content load | Refused with an error that names the value and the bound; a value at or below the bound loads and its saves round-trip | sys-save, 05 §5 | M1.1 |
| sav-002 | An AI-vs-AI match played in week w, the player's own match of the same week, and the processing of week w + 3 | Save, load and open both reports | The AI match reports as a summary (score, round results, MVP, per-fighter rounds, downs, damage and healing), and the standings, tie-breaks and season statistics are unchanged; the player's match keeps its full report; the save is smaller by the dropped records (O24; `m1.1/save-trim`) | sys-save, sys-match-report, 05 §5 | M1.1 |
| sav-003 | A v3 save with full results from earlier weeks | Load it, advance a week, save | `migratedFrom` is 3 and nothing else changes on load; its aged AI results are compacted by the week rule from its next week; the new save is schema v4, which an older build reports as `save.too-new` | sys-save, 05 §5 | M1.1 |
| box-001 | A match played by this build whose rounds can be replayed | Build the report | Every fighter who started a round has damage done, damage received, healing done, healing received, shielding, downs inflicted and suffered equal to his stored match counters, and his per-round lines sum to them; each side's round totals are the sum of its fighters' lines for that round; healing is effective (overheal excluded) | sys-match-report, O27 | M1.1 |
| box-002 | A result played before healing received was counted | Build the report | Healing received is re-derived from the re-simulated rounds when they can be rebuilt, otherwise absent and shown as "—", never as 0; a compacted result has no box lines | sys-match-report, O27 | M1.1 |
| sqd-001 | Starters A to E (E in the back row), match reserves R1 and R2 (fit), a bench fighter X | Bring R1 into E's slot on the Squad screen | One `squad.set`: R1 takes E's slot and row, the reserves become [E, R2] (E in R1's former place), E is not on the bench, the match captain stays only while fielded; Undo restores the five and the reserves together | sys-roster, O29 | M1.1 |
| sqd-002 | The same squad | Bring bench fighter X into E's slot; then bring R1 in for an unfit E | X in and E to the bench with the reserves unchanged; with E unfit he cannot be named a reserve, so `lineup.set` is used: R1 is in, E goes to the bench and R1 leaves the reserves | sys-roster, O29 | M1.1 |

## 10. Open decisions and completion check

**Linked to document 01 §8:** the delegated decisions D-A to D-I and D-N to D-T await owner confirmation (01 §8.5, batch A); M1 was built at risk on them. The M1.1 owner decisions are O15–O22 and, since 2026-10-27, O23–O32: D-U to D-AE and the rank, perk and Freshness-penalty rules (batch D, Q37–Q51) are confirmed (O25, O26); the owner's wording on levels (O23) is open against the build's level counter (open-034, Q52). The PROPOSED rules still open for the owner are: lifecycle C-2 (dwarves shorter-lived) and C-13 (debut floor 16) as open-030; C-7 (permanent scars), C-8 (career-ending only when At risk) and C-14 (a knock misses the next match) as open-031; C-6 (trait roll) within open-012; C-11 (captain-change costs) and C-12 (poor captains hurt) within open-011; open-002, open-006, open-010, open-011, open-012, open-013, open-016, open-019, open-024 (adopted under D-G), open-026 and open-027; and P-02 to P-06, P-09 to P-11, P-17, P-18, P-20 and P-22 as merged. Later milestones: §3.5. Each is a Q item in 01 §8.5.

**Follow-ups for other documents (not design decisions):**
- Document 05 v0.7 encodes D-E (tech-014, millimetre sim positions), the precomputed retirement tables (§2 determinism rules), the loader conversions and the validators of §6 (05 §4), the D-O to D-T engine rules and the M1.1 rules D-U to D-AE (confirmed, O25); its §12 lists the known issues.
- **Content requests from this sync** (values the doc cannot change): `economy.json` balanceTargets.seasons 25 → 30 (soak ladder, §8); `combat.json` keys for the MVP weights; `development.json` keys for `PROVISIONAL_TYPICAL_ROUND` and the 2.5 typical rounds per match.
- Document 04 v0.7 specifies the surfaces named in §3 (merged from the UI designer's draft): the match report, lineup screen (presets, rows, captain and vice-captain, injury odds, chemistry, level and XP bars, Freshness), finance screen, offer dialog, market list and compare view, embargo banner, captain panel, fighter card (age bar with race zones, cap ticks, wear hatching, trait chips by kind), season review of levels, the color rules, and the icon keys of §6.

**Completion check:**
- [x] Every M1 action has legality, cost, result and failure behavior.
- [x] Units, timing, rounding, randomness and precedence are explicit (§1, sys-fight-sim, sys-calendar).
- [x] Important rules have worked examples with concrete values.
- [x] Content entries refer to defined behaviors, and the content files are the declared source of truth.
- [x] AI and generation have bounded fallbacks (stances, hired blades, journeymen, generation retries, deterministic lots).
- [ ] The M1 content set proves the central promise: the harness and the 10-season soak have run (§8); class retuning (balance pass 2) must still bring archetypes and classes into the M1 band (the M1.1 bands are met), and playtests (vis criteria) have not run.
- [x] Tunable values are distinguishable from required and delegated rules.
- [ ] Owner confirmation of the delegated decisions D-A to D-T and the open proposals (01 §8.5); D-U to D-AE and the combat proposals are confirmed (O25, O26).
