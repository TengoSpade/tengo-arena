# Arena League: combat, classes and tactics (phase-2 draft for document 03)

> ARENA LEAGUE DESIGN PACKAGE · PHASE-2 DRAFT `_drafts/03-combat.md` · v0.1 · 2026-10-25 · combat designer.
> This draft will be merged into [document 03](../03-gameplay-systems-and-content.md) §3 onward. It follows the labels, glossary and authority rules of [document 01](../01-game-vision-and-design-principles.md) and the foundations of 03 §1–2, and records every conflict with them in §0.3 rather than resolving it silently.
> **Nothing here is approved.** Owner decisions are cited as REQUIRED (O-IDs). Every other rule is PROPOSED, and every number is PROPOSED · TUNABLE unless marked otherwise. Examples are EXAMPLE.
> Content data: [`content/default/combat.json`](../../../content/default/combat.json), [`classes.json`](../../../content/default/classes.json), [`abilities.json`](../../../content/default/abilities.json), [`tactics-presets.json`](../../../content/default/tactics-presets.json). Where this text and the data disagree on a number, the data file holds the working value and the disagreement is a bug to report.

| Field | Value |
| --- | --- |
| Game / version / updated | Arena League / draft v0.1 / 2026-10-25 |
| Status / design owner | Draft for review / the project owner (G1) |
| Milestone covered | M1 "Season MVP" (O14): headless fights, per-class presets, match reports. M2/M3 hooks are marked FUTURE |
| Systems specified | sys-combat-stats, sys-arena, sys-movement, sys-fight-sim, sys-abilities (with statuses and the 42 classes), sys-targeting, sys-tactics, sys-fight-ai, sys-fight-traits, sys-fight-captain, sys-match, sys-match-report; balance harness in §8 |

## 0. How to read this draft

### 0.1 Summary of the design

- **Stats (sys-combat-stats).** 12 integer attributes on the shared 1–20 scale, 5 physical and 7 mental, each mapped to a lifecycle tag so races and traits can modify it. Class base values plus per-point coefficients give HP, armor, ward, move speed, attack speed, Power, Support, crit, evade, tenacity, resolve, focus regeneration and reaction delay. A class's **rating weights** produce the 1–100 rating used by the economy.
- **Fight (sys-fight-sim).** 20 ticks per second in a 32 m × 18 m top-down arena. Each tick runs fixed phases: timers, decisions from the start-of-tick state, actions, simultaneous movement, effect resolution, then one commit in which damage and healing are summed before downs are checked. Overtime ramps from 45 s and the hard cap is 75 s (03 §1). A match is best-of-3 rounds (best-of-5 in finals).
- **Abilities (sys-abilities).** Every class has a basic attack, two actives and one passive, all built from a closed vocabulary of 17 effect types, 34 statuses and a small predicate/trigger set. Two damage types (physical against armor, arcane against ward) plus true damage. Hard crowd control shares one diminishing-returns track and is capped at 2.5 s.
- **Tactics (sys-tactics).** An ordered rule list per fighter: `IF <condition> [AND <condition>] THEN <action> ON <selector> [ONLY <predicate> | PREFER <predicate>] [COOLDOWN n s]`, first valid rule wins, ending in an unremovable stance. Each class ships 2–3 presets; in M1 the player picks one per fighter. Every decision change emits a trace that says why each rule fired or was skipped.
- **Randomness.** Seeded and bounded: crit and evade use deterministic accumulators with a seeded starting phase, so a fighter with 20% evade dodges exactly every fifth blow give or take one; damage varies ±4%; reaction delay has 0–2 ticks of seeded jitter. Targets are never random.

### 0.2 Decisions this draft takes from other documents

| Source | What this draft uses | Label |
| --- | --- | --- |
| O1, R1 | 5 fighters per side, real-time 2D arena, automatic fights | REQUIRED |
| O8, open-024 | 42 classes: 6 per role, 2 hybrids per role-family pair; a hybrid's DPS side is melee or ranged per class and carries both role tags | REQUIRED (O8); interpretation OPEN (open-024) |
| O11 | Every stat is tagged physical or mental so aging can treat the groups differently | REQUIRED |
| O12, O14 | M1: headless fights shown as match reports; per-class presets selectable per fighter | REQUIRED |
| O5, O6, boundary contract 3 (03 §2) | Combat owns the in-fight effects of traits and captains | REQUIRED (O5, O6); effects PROPOSED |
| 03 §1 | 50 ms ticks, overtime at 45 s, cap at 75 s, 32 m × 18 m arena, integer sim state, start-of-tick decisions, summed same-tick damage and healing, side-alternating order, metres in content | PROPOSED (P-02, P-03, P-05) |
| 01 §7 | Terms: fight, round, match, side, starting row, downed, rule, rule list, stance, preset, captain, focus. Rules read `IF … THEN …` | REQUIRED vocabulary |
| P-05, P-06 | No random targets; no rule skipping; composure affects execution only, as a seeded reaction delay | PROPOSED |
| P-07 | Rule grammar, Only/Prefer, 10% threshold steps, stance fallback, focus as a per-fight budget | PROPOSED |
| P-22 | Per-fighter recap, rule-fire counts, rules that never fired, death summary | PROPOSED |
| `development.json` captaincy.inFightProposal | Captain aura, rally and captain-down rules expressed as composure | PROPOSED by the lifecycle designer; adopted here |
| `traits.json` effect types owned by combat | `combat`, `enemyComposureAura`, `shakenImmune`, `captainRally` | PROPOSED by the lifecycle designer; semantics defined here |
| 05 draft §3.4, §6 | Unit-suffixed authoring keys, conversion once at load, sfc32 substreams, integer-only core, 2 ms median per round | PROPOSED (tech) |

### 0.3 Conflicts and frictions to resolve at merge

| ID | Conflict | Recommendation |
| --- | --- | --- |
| cmb-c1 | 03 §1 and the 05 draft say "distances in integer centimetres". At 20 ticks per second a fighter moves about 16 cm per tick, so whole-cm positions quantize speed in 0.2 m/s steps and erase 3–4 points of Pace | Keep metres in content and centimetres in events and displays, but store sim positions and per-tick movement in **integer millimetres**. This is internal to core/sim and keeps every other contract |
| cmb-c2 | `races.json` tendencies (e.g. elf durability −8, orc power +8) and `traits.json` stat adds (e.g. +6 composure) are large on a 1–20 scale. With this draft's coefficients, −8 Toughness is −32% max HP and −16 armor | Either cap race tendencies at ±4 and trait stat adds at ±3, or accept the swings as race identity. The coefficients in `combat.json` derived are TUNABLE, so the balance harness can absorb either choice. Owner and lifecycle designer to decide (cmb-q11) |
| cmb-c3 | The brief wrote rules as `WHEN … → …`; 01 §7 fixes `IF … THEN …` | Use `IF … THEN … ON …` everywhere (01 vocabulary wins) |
| cmb-c4 | The brief suggested Balanced / Aggressive / Protective preset names; doc 01 suggests class-flavoured presets | Every preset has a style key (`balanced`, `aggressive`, `protective`) for filtering and AI policy, plus a class-flavoured display name (e.g. "Bodyguard") |

## 1. Mechanical foundations (combat additions to 03 §1)

**Status:** PROPOSED. Values PROPOSED · TUNABLE in `combat.json`. 03 §1 remains the authority for the general rules; this section only adds what combat needs.

| Topic | Decision | Player-visible consequence |
| --- | --- | --- |
| Player control | M1: lineup, captain, starting row and one preset per fighter (O14). No in-fight input. FUTURE M2: up to 2 calls per round (P-01), entered into the sim as timed inputs. FUTURE M3: edited rule lists | Every action in a report traces to a rule, the stance or a status that overrides rules (taunt, stun) |
| Time model | 20 ticks per second, tick 0 = kickoff. Content times are seconds that are multiples of 0.05 s and convert exactly to ticks. Overtime from tick 900 (45 s); the round ends at tick 1,500 (75 s) if no side has been eliminated | Durations display to 0.1 s and are always whole ticks underneath |
| Space model | Open 32 m × 18 m rectangle (open-019). Origin at the north-west corner, x east, y south. Home spawns west, away east. Fighters are circles of radius 0.5 m. No obstacles, hazards or summons | Rows, spacing, kiting, bunching and flanking exist even in headless fights |
| Distance | **Gap** = centre distance − both radii, never below 0. Every range, band and "within" test uses the gap and is inclusive (gap ≤ range) | "Range 6 m" means 6 m of empty ground between the two fighters |
| Range bands | melee ≤ 1.5 m, close ≤ 4 m, mid ≤ 7 m, long ≤ 10 m (gap) | Rule conditions and class labels use the same four words |
| Units in content | Keys carry their unit: `…S` seconds, `…M` metres, `…Mps` metres per second, `…Deg` degrees. Unsuffixed fractions are decimals (0.04 = 4%) and become basis points. HP, focus, armor, ward and composure are integer points | Data files read like the UI |
| Sim-internal integers (recommendation for 05) | Positions and movement in mm (cmb-c1); HP in points; damage and healing computed in centipoints (1/100 point) and truncated once at the end of the pipeline; focus in millipoints; cooldowns and attack readiness as progress accumulators in basis-point ticks (§3, sys-combat-stats) | Displayed numbers are always whole points |
| Information | Rules read only fight-observable state (03 §1): positions, HP bars, statuses, casts in progress, class and role, the captain marker, who is targeting whom, damage dealt so far (visible as hits), and the fighter's own focus | No rule can test a hidden stat |
| Uncertainty | Seeded, bounded (§3 sys-fight-sim, "Randomness") | A rerun with the same seed is identical; different seeds vary a little, never wildly |
| Resolution order | 03 §1: decisions from start-of-tick state; same-tick damage and healing summed before downs; home first on even ticks, away first on odd ticks, then lineup slot | No side advantage from processing order |

## 2. System inventory (combat-owned systems)

**Status:** the system IDs are fixed by 03 §2. Scope below is PROPOSED.

| System ID | Purpose | Depends on | M1 behavior | FUTURE |
| --- | --- | --- | --- | --- |
| sys-combat-stats | Stats → in-fight values, rating weights | sys-fighters, sys-races, sys-traits | Full | — |
| sys-arena | Bounds, sides, rows, spawn points | — | One arena | Arena variants (open-019) |
| sys-movement | Steering, separation, walls, dashes, displacement | sys-arena, sys-combat-stats | Full | Obstacles |
| sys-fight-sim | Tick loop, timing, damage/heal/shield pipeline, KO, round end, randomness, event emission | all below | Full, headless | M2 viewer consumes the same log; calls as inputs |
| sys-abilities | Ability schema, effect vocabulary, statuses, DR, the 42 classes | sys-combat-stats, sys-targeting | 42 classes × 4 abilities | Learned abilities (M5) |
| sys-targeting | Selectors, predicates, tie-breaks, stickiness, role matching | sys-arena | Full | Playbook focus policy (M3) |
| sys-tactics | Rule engine, vocabulary, presets, traces | sys-targeting, sys-abilities | Presets only | Editor (M3, sys-tactics-editor) |
| sys-fight-ai | Stances and action execution beneath the rules | sys-tactics, sys-movement | Full | — |
| sys-fight-traits | In-fight effects of traits | sys-traits | Adapter for combat-owned trait effects | Grows with the catalog |
| sys-fight-captain | Captain aura, rally, captain down, handover, captain's target | sys-captaincy | Full | Calls through the captain (M2) |
| sys-match | Best-of-N rounds, round seeds, per-round reset, results contract | sys-fight-sim | Full | Between-round edits (M3), replays (M2) |
| sys-match-report | Event stream, decision traces, recaps, death summaries | sys-fight-sim, sys-tactics | Summary-level report | Inspector and rule badges (M2) |

## 3. System specifications

### sys-combat-stats: attributes, derived values and rating

**Status / scope:** PROPOSED, M1. The physical/mental tag on every stat is REQUIRED (O11). Coefficients PROPOSED · TUNABLE (`combat.json` → `derived`).

**Purpose:** turn a fighter's 12 integer attributes, class, race and traits into the numbers the fight uses, so that development and aging change fights visibly and predictably, and give the economy a per-class rating.

**Entities and state.** Twelve attributes, integers 1–20 (P-12; 10 = average professional). Effective values arrive in the fight setup already including race tendencies and whole-point trait stat adds (lifecycle `effectiveStats`); in-fight composure changes are applied by this system.

| Id | Name | Group | Lifecycle tag | In-fight use |
| --- | --- | --- | --- | --- |
| `str` | Strength | physical | power | power (class-weighted); maxHp +1%/pt |
| `agi` | Agility | physical | finesse | attack speed +2.5%/pt; evade +1%/pt above 10; power (class-weighted) |
| `pac` | Pace | physical | speed | move speed +2%/pt |
| `tgh` | Toughness | physical | durability | maxHp +4%/pt; armor +2/pt |
| `pre` | Precision | physical | precision | crit +1%/pt; power (class-weighted) |
| `arc` | Arcana | mental | — | power (class-weighted); support (some classes) |
| `spi` | Spirit | mental | — | support (class-weighted) |
| `wil` | Willpower | mental | — | ward +2.5/pt; resolve +1.5%/pt |
| `cmp` | Composure | mental | composure | tenacity +2%/pt; pressure reaction delay; shaken severity; captaincy input |
| `ldr` | Leadership | mental | leadership | captaincy input (fallback formula) |
| `awr` | Awareness | mental | awareness | reaction delay -0.01 s/pt; captaincy input |
| `dis` | Discipline | mental | focus | focus regen +3%/pt |

*Why 1–20.* The scale is already fixed by 03 §1 and the lifecycle data, and it suits this game: each point is a visible step on a fighter page, ranges read cleanly in M4 fog ("12–15"), and a 4%-per-point coefficient makes one point matter without letting a 3-point gap decide fights alone. Growth below one point is held by the lifecycle system in centipoints and shown as progress, not as decimals.

*Why 5 physical and 7 mental.* Spellcraft, healing, magic resistance, nerve, command, fight-reading and pacing are learned, so they follow the mental curve (O11). Consequence: casters and healers keep their main output into their forties for humans while losing HP, speed and attack tempo. This is a deliberate career asymmetry that the economy should price (cmb-q1).

**Inputs.** Per fighter: the 12 effective attributes, class id, race id and optional race `combatMods` (`hpMult`, `armorFlat`, `wardFlat`, `moveSpeedMult`, `tenacityFlat`; neutral defaults), trait ids, captain flags and captain quality (CQ), and in-fight modifiers from statuses, auras, passives, traits and the captain.

**Formulas and units.** d(x) = effective attribute − 10. Class base values are in `classes.json` → `base`. Each line truncates toward zero once at its end.

| Value | Formula (PROPOSED · TUNABLE coefficients) | Bounds |
| --- | --- | --- |
| Max HP | base.hp × max(0.4, 1 + 0.04·d(TGH) + 0.01·d(STR)) × (1 + Σ maxHp mods) × race.hpMult | ≥ 1 |
| Armor | base.armor + 2·d(TGH) + race.armorFlat + Σ armor mods (static, conditional and statuses) | treated as ≥ 0 in mitigation |
| Ward | base.ward + 2.5·d(WIL) + race.wardFlat + Σ ward mods | treated as ≥ 0 |
| Move speed (m/s) | base.moveSpeedMps × (1 + 0.02·d(PAC)) × race.moveSpeedMult × speedMult, where speedMult = clamp(1 + haste − slow + Σ moveSpeed mods, 0.3, 1.6). Rooted, stunned, asleep, anchored, displaced or casting a non-mobile ability: 0 | — |
| Attack speed | attackSpeed = 1 + 0.025·d(AGI) + frenzy + momentum − sluggish + Σ attackSpeed mods. Effective interval = base.attackIntervalS / attackSpeed | interval ≥ 0.45 s; attackSpeed ≥ 0.4 |
| Power | base.power × (1 + 0.04 × Σᵢ powerAttrsᵢ·d(statᵢ)) × (1 + Σ power mods) | ≥ 1 |
| Support | base.support × (1 + 0.04 × Σᵢ supportAttrsᵢ·d(statᵢ)) × (1 + Σ support mods); 0 for classes without supportAttrs | ≥ 0 |
| Crit chance | 0.05 + 0.01·d(PRE) + base.critBonus + Σ crit mods (including target-conditional mods, evaluated per hit). Crit multiplier 1.5 | 0–0.5 |
| Evade chance (weapon blows only) | base.evadeBonus + max(0, 0.01·d(AGI)) + Σ evade mods + Evasive magnitude | 0–0.75 |
| Tenacity (hard-CC duration reduction) | 0.02·d(CMP_eff) + base.tenacityBonus + race.tenacityFlat + Σ tenacity mods | −0.25 to 0.5 |
| Resolve (soft-CC and debuff duration reduction) | 0.015·d(WIL) + Σ resolve mods | −0.15 to 0.3 |
| Focus | max 100, starts full each round (02 §5). Regeneration 2.5 per second × (1 + 0.03·d(DIS)) × (1 + Σ focusRegen mods) | 0–100 |
| Reaction delay (s) | (0.30 − 0.01·d(AWR) − 0.005·d(CMP_eff) + pressure) × (1 + Σ reactionDelay mods), clamped 0.15–0.6, then + seeded jitter of 0–2 ticks. pressure = 0.15 × (20 − CMP_eff) / 19 while own HP < 35% | 3–12 ticks before jitter |
| In-fight composure CMP_eff | CMP + Σ composure mods (captain aura, rally, Shaken, trait in-fight mods, enemy composure auras) | 1–20 |
| HP regeneration | (hpRegenPct × maxHp + hpRegenFlat) per second, applied once per second as healing (healing modifiers and overtime apply) | — |
| Rating (1–100) | round(5 × Σᵢ ratingWeightsᵢ × statᵢ), equivalent to the lifecycle formula round(Σ w·eff100 / Σ w / 20) with centipoint stats | clamp 1–100 |

**Modifier sums.** All modifiers to one stat are added, then the stat's clamp is applied. Sources: passive `statMods` (static or conditional), auras (if several fighters project the same aura ability, only the strongest counts), statuses (per the stacking rules in sys-abilities), traits (summed per stat and capped at ±0.15 for fractions and ±8 composure points; `derived.traitModCaps`) and the captain (composure). Conditional modifiers whose predicate names a target ("against enemies below 40% HP") are evaluated per hit against that hit's target.

**Rating weights and stat emphasis.** Each class in `classes.json` carries `ratingWeights` (12 weights summing to exactly 1.00; leadership is 0 because captaincy is valued separately) and `statEmphasis` (0.5–2.0 per stat, 1.0 neutral) for generation and growth bias. Both are derived from what the class's formulas actually use: archetype shares for Power, Support, HP, armor, ward, move, attack speed, crit, tenacity, reaction and focus are spread over the attributes that feed each component (HP 0.8 TGH + 0.2 STR; reaction 0.7 AWR + 0.3 CMP; Power and Support by the class's own `powerAttrs`/`supportAttrs`). Hybrids average their two archetypes. The derivation script is a build aid; the JSON values are the content.

**Integer implementation (recommendation for 05).** Coefficients become basis points at load. Attack readiness: each tick a fighter adds attackSpeed (bp) to a swing accumulator; an attack is ready when the accumulator reaches base interval ticks × 10,000, and the threshold is subtracted when the attack's windup begins, keeping the remainder. Ability cooldowns use the same accumulator with (1 + cooldownRate) per tick. Focus is held in millipoints (2.5/s = 125 millipoints per tick). These keep exact average rates with integer state.

**Player information.** The fighter page shows each attribute with its group (physical/mental) and a hover that lists what it changes. A derived panel shows max HP, armor, ward, Power, Support, attack interval, move speed, crit, evade, tenacity, focus regeneration and reaction delay, each with a breakdown on hover (class base, attributes, race, traits).

**Edge cases.** Attributes outside 1–20 are clamped at the fight boundary. A class without Support ignores Support-scaled effects (none exist in its kit by validation). Negative armor or ward from shred stops at 0. A fighter at 0 attack speed cannot occur (floor 0.4).

**Interactions.** sys-fight-traits and sys-fight-captain feed modifiers; sys-abilities consumes every derived value; the rating feeds sys-contracts and sys-ai-manager.

**Worked example (EXAMPLE).** Oathguard with STR 12, AGI 9, PAC 11, TGH 14, PRE 9, ARC 6, SPI 5, WIL 10, CMP 13, LDR 11, AWR 8, DIS 10, human, no traits:
max HP = trunc(1250 × (1 + 0.16 + 0.02)) = **1475**; armor = 60 + 8 = **68**; ward = **45**; move = 3.2 × 1.02 = 3.264 m/s = **163 mm per tick**; attack speed = 1 − 0.025 = 0.975, interval = 1.3 / 0.975 = **1.333 s** (26.67 ticks on average through the accumulator); Power = trunc(72 × (1 + 0.04 × (0.8·2 + 0.2·−1))) = trunc(72 × 1.056) = **76**; crit = **4%**; evade = **0%**; tenacity = **6%**; focus regeneration **2.5/s**; reaction delay = 0.30 + 0.02 − 0.015 = 0.305 s = **6 ticks** (+0–2 jitter), and 0.360 s = 7 ticks when below 35% HP; rating = round(5 × 11.97) = **60**.

**Acceptance cases.** (1) The example above reproduces exactly. (2) A fighter with all attributes 10 has exactly the class base values and rating 50. (3) Raising TGH by 1 raises max HP by trunc(base.hp × 0.04) ± 1 and armor by 2.

### sys-arena: arena, sides and spawn points

**Status / scope:** PROPOSED (P-03, open-019), M1. Values PROPOSED · TUNABLE (`combat.json` → `arena`).

**Entities and state.** One rectangular arena, 32 m × 18 m, walls on all sides. Two sides: home (side 0) and away (side 1). Each fighter has a starting row (front or back) chosen at lineup lock; the default is the class's `startingRow`.

**Resolution procedure (spawn).**
1. Split each side's five fighters into front and back rows, preserving lineup slot order within each row. A row may hold 0–5 fighters.
2. Row x: home front 9 m, home back 5 m; away front 23 m, away back 27 m (mirror of home about x = 16 m).
3. Row y: for n fighters in a row, fighter i (0-based, in slot order) stands at y = 9 + (i − (n − 1)/2) × 3 m. Away uses the same y for the same index, so the sides are exact mirrors.
4. Fighters face the enemy side; facing matters only for cones and lines, which always aim at the ability's target.

**Player information.** The lineup screen shows the two rows as a small diagram with these positions.

**Edge cases.** Five fighters in one row span y = 3 to 15 m, still inside the walls (radius 0.5 m). An empty back row is legal.

**Worked example (EXAMPLE).** Home lineup with three front and two back: front at (9, 6), (9, 9), (9, 12); back at (5, 7.5), (5, 10.5). Front-to-front centre distance is 14 m (gap 13 m), so two melee fighters at 3.4 m/s meet in about 1.9 s.

**Acceptance cases.** Spawns are symmetric (away x = 32 − home x); no two fighters overlap at spawn.

### sys-movement: steering, spacing and displacement

**Status / scope:** PROPOSED, M1. Values PROPOSED · TUNABLE (`combat.json` → `movement`).

**Purpose:** move fighters believably and deterministically toward what their rules want, without pathfinding.

**Entities and state.** Position (mm), radius 0.5 m, current move goal, displacement in progress (dash, leap, knockback, pull), immobility flags (rooted, stunned, asleep, anchored, casting).

**Resolution procedure (movement phase of each tick).**
1. Each mobile fighter computes a goal from its committed action (sys-fight-ai) using **start-of-tick positions**: approach until the gap equals the action's range − 0.1 m; kite away; protect point; regroup point; or stay.
2. Step length = move speed / 20 (mm per tick). The step points straight at the goal and stops exactly on it if closer.
3. **Sidestep:** if an ally's centre lies within 1.2 m ahead and within 0.9 m of the movement line, add a perpendicular component of weight 0.6 toward the side with more free space to the wall (tie: toward the arena centre line y = 9 m; tie: +y), then renormalize to the step length.
4. All fighters' steps apply simultaneously.
5. **Separation:** two passes over every pair (lower unit index first) of standing, non-displaced fighters closer than 1 m centre to centre: push each apart by half the overlap along the line between centres. A fighter that is anchored, rooted, stunned, asleep or casting is immovable: the other fighter takes the whole push. If both are immovable, neither moves. Exactly coincident centres separate along y (the higher index moves +y).
6. **Walls:** clamp every centre to [0.5, 31.5] × [0.5, 17.5] m. A kiting fighter whose step is clamped slides along the wall: its blocked component is replaced by a component toward the arena centre line.
7. **Displacement** (dash, leap, knockback, pull) overrides steps: it moves the fighter along a straight line at its speed (dash 16 m/s, leap 12 m/s, knockback/pull 12 m/s) until it reaches its end point, a wall, or (dash and pull only) a gap of `stopGap` to the target. Leaps ignore separation while airborne. Knockback and pull distances are multiplied by the target's displacement diminishing-returns step (sys-abilities).

**Formulas.** Dash "behind" end point = target centre + unit vector(caster → target) × (both radii + 0.2 m), clamped to the arena. Knockback end = target centre + unit vector(source → target) × distance (source = caster or area centre). Pull end = point at `stopGap` from the caster (or the area centre) along the line, or the full distance if shorter.

**Edge cases.** A displaced fighter cannot act (it is "airborne"; casts are interrupted by knockback and pull). Displacement-immune fighters (Anchored, the Harpooner's passive) ignore knockback and pull entirely. A zero-length direction (fighters on the same spot) uses +x for the home side and −x for the away side.

**Acceptance cases.** (1) Two fighters walking into each other end at least 1 m apart after the tick. (2) A rooted fighter is never pushed by separation. (3) A 3 m knockback toward a wall 1 m away moves the fighter 1 m and stops.

### sys-fight-sim: the tick loop

**Status / scope:** PROPOSED, M1 headless (O12). The tick rate, overtime start and hard cap follow 03 §1 (PROPOSED · TUNABLE, P-02).

**Purpose:** run one round from kickoff to result, deterministically, and emit the event log consumed by reports now and by the viewer from M2.

**Entities and state.** Ten units (home slots 0–4 = unit 0–4, away slots 0–4 = unit 5–9), each with HP, shields, focus, cooldown and swing accumulators, statuses, DR tracks, committed decision, pending decision and reaction timer, cast/channel state, position, displacement, crit/evade accumulators, damage-dealt tally. Zones and projectiles in flight. Round clock (tick). Pending triggered effects.

**Inputs.** The round seed, both sides' fight inputs (sys-match), content.

**Resolution procedure (one tick t).** `order(t)` = home units then away units when t is even, away then home when t is odd; slot order within a side.
1. **Timers.** Advance cooldown, swing and global-cooldown accumulators; regenerate focus; tick status durations and expire statuses that reach 0; advance DR windows, zones, projectiles, displacements and reaction timers; recompute auras every 2 ticks (`timing.auraRecalcTicks`).
2. **Decisions** (start-of-tick state). For each unit in order(t) that is free (not winding up, casting, channelling, displaced, stunned or asleep) and whose decision is due (every 2 ticks, or at once after its target is downed, its action completes, or a control effect ends), evaluate its rule list (sys-tactics). If the result differs from the committed decision (different rule, action or target), it becomes **pending** and commits after the reaction delay. A taunted unit's decision is forced (sys-tactics).
3. **Actions.** In order(t): units whose committed action is ready and in range start it (basic attack windup, ability cast) and pay nothing yet; windups, casts and channel ticks that complete this tick **release**: focus is spent and the cooldown starts at release; instant effects are queued for this tick's resolution, projectiles are launched with a fixed landing tick = t + ceil(gap / speed × 20), dashes and leaps start.
4. **Movement** (sys-movement), simultaneous.
5. **Resolution.** Collect every effect landing this tick: instant releases, projectile arrivals, channel ticks, zone ticks and triggers, damage- and heal-over-time ticks, once-per-second regeneration, and triggered effects queued on tick t − 1. Process them grouped by source unit in order(t), then by creation sequence. Area membership and target validity are evaluated on the positions after step 4. Damage and healing amounts are computed with the **start-of-tick** modifiers and shields (sys-abilities pipeline) and accumulated per target; statuses, shields, cleanses, displacements and cooldown changes created this tick are queued.
6. **Commit.** For each unit: HP = min(maxHp, HP − Σ damage to HP + Σ healing). Then: Deathward check; units with HP ≤ 0 are **downed**; sleep breaks; queued statuses apply (with DR, tenacity and resolve) in order(t); queued shields, cleanses and dispels apply; triggers fire and queue their effects for tick t + 1. Events are emitted in this order.
7. **End check.** If one side has no standing unit, the round ends now (elimination). If both sides lost their last unit this tick, the time-cap tiebreak decides. If t + 1 = 1,500, the round ends by time cap.

**Timing rules.**
- **Basic attack:** ready when the swing accumulator is full and the target's gap ≤ attack range. Windup = 30% of the effective interval for melee and 35% for ranged (× (1 + windup mods), e.g. halved for the Boltrunner), rounded down to whole ticks, minimum 1. The fighter cannot move during the windup. At release the target must still be valid and within range + 0.4 m, else the attack is cancelled and the swing accumulator is refunded.
- **Abilities:** usable when off cooldown, focus ≥ cost and not silenced. There is no global cooldown: the reaction delay on every decision change already spaces actions, and a skip-based global cooldown would make rules flap. `castTimeS` 0 releases on the tick it starts. During a cast the fighter is rooted unless the ability is a mobile channel. Range is checked at start and at release (+0.4 m leeway). Channels apply their effects every `tickIntervalS` and end early if interrupted or if the target leaves range + 0.4 m.
- **Interrupt:** stun, sleep, silence, taunt, knockback, pull and the `interrupt` effect cancel a windup, cast or channel in progress. Nothing is spent: focus is charged and cooldowns start only at release. A channel interrupted after some ticks keeps the ticks already applied.
- **Start cooldown:** an ability with `startCooldownS` > 0 begins each round on that cooldown (e.g. Slumber 2 s, Vigil 3 s).
- **One action start per unit per tick**; one decision evaluation per unit per tick at most.

**KO rules.** A unit at HP ≤ 0 after commit is **downed** for the rest of the round: it is removed from collision, targeting and all counts of standing fighters; its channels, auras and zones that follow it end; projectiles it already launched still land; damage over time it applied keeps ticking and is credited to it. The down is credited to the source of the largest single post-mitigation HP damage to the unit on that tick (ties: earlier in order(t)); assists go to every other enemy that damaged it in the previous 5 s. Downed fighters cannot be healed or revived in M1 (Deathward prevents the down instead).

**Round end and time cap.** Elimination: the side with standing fighters wins. At the time cap, or when both sides are eliminated on the same tick, the first difference in this chain decides: (1) more fighters standing; (2) higher sum over all five fighters of HP fraction in basis points, trunc(HP × 10,000 / maxHp), downed = 0; (3) more total damage dealt this round; (4) the side that downed an enemy first; (5) a seeded coin from the round's `tiebreak` stream. Every step is reported.

**Overtime ramp.** From tick 900, with k = floor((t − 900) / 20): damage multiplier 1 + 0.03k and healing and shield multiplier max(0, 1 − 0.03k). At 60 s that is ×1.45 damage and ×0.55 healing; at 74.95 s ×1.87 and ×0.13. The viewer and report mark "Overtime".

**Randomness (P-05).** All draws come from substreams of the round seed (`deriveSeed(matchSeed, 'round', n)`): `phase/<unit>` gives each unit's starting crit and evade accumulator phases (two draws at kickoff, each uniform 0–9,999 bp); `variance/<unit>` gives one draw per damage instance the unit deals (factor = 1 + (−400 + trunc(801 × r / 10,000)) bp, r in 0–9,999, so −4% to +4%); `react/<unit>` gives the opening stagger (0–4 ticks before the first decision) and one jitter draw (0–2 ticks) per committed decision change; `tiebreak` gives the coin. Crit and evade are **accumulators**, not independent rolls: each eligible hit adds the current chance (bp) to the unit's accumulator, and a crit (or evade) happens when it reaches 10,000, which is then subtracted. Over a fight the count of crits or evades is within ±1 of chance × attempts. Rule evaluation and targeting draw nothing. Recording level never draws.

**Player information.** M1 report: per round the winner, duration (s and ticks), end reason and tiebreak step if any, the key-event timeline and recaps (sys-match-report). FUTURE M2: the viewer shows overtime, casts in progress (telegraphs for casts ≥ 0.3 s) and status icons.

**Edge cases.** A heal and lethal damage on the same tick are summed: the heal can save the fighter (acc-04). A unit downed on tick t still lands effects it released on t. Two projectiles landing the same tick resolve by source order(t). A projectile whose target is downed before it lands fizzles.

**Acceptance cases.** See §9: acc-det-01/02, acc-04, acc-08.

### sys-abilities: schema, effect vocabulary, statuses and damage

**Status / scope:** PROPOSED, M1. The class count and structure are REQUIRED (O8). Numbers PROPOSED · TUNABLE.

**Purpose:** a closed, data-driven vocabulary in which all 168 abilities are written, so the sim has one implementation per effect type and the UI can explain every number.

**Ability schema** (`abilities.json` → `abilities[]`; every field is present on every ability):

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | `<classId>_<slug of name>`, unique |
| `classId` | ClassId | Owning class |
| `slot` | `basic` \| `a1` \| `a2` \| `passive` | Kit slot; rules refer to `a1`/`a2` |
| `kind` | `basic` \| `active` \| `passive` | — |
| `name`, `description` | string | Player-facing; numbers given as % of Power/Support or absolute seconds and metres; ≤ 200 chars |
| `iconId` | string | Placeholder art key `abl_<id>` |
| `tags` | string[] | UI and lint chips: attack, melee, ranged, projectile, spell, aoe, cc, interrupt, dash, leap, displace, taunt, heal, hot, dot, shield, buff, debuff, cleanse, dispel, zone, trap, channel, mobility, execute, anchor, counter, chain, mark, burst, self, protect, passive |
| `cooldownS` | number | 0 for basic (uses attack interval) and passive |
| `startCooldownS` | number | Cooldown at round start |
| `focusCost` | int | Charged at release |
| `castTimeS` | number \| null | Windup; null for basic (derived from the interval) |
| `channel` | null \| { `durationS`, `tickIntervalS`, `mobile`: bool, `moveSpeedMult` } | Repeats `effects` every tick interval |
| `rangeM` | number | Max gap to the target at start (+0.4 m leeway at release); 0 for self |
| `target` | `enemy` \| `ally` (not self) \| `ally_or_self` \| `self` | Valid primary target; the rule's selector pool must match |
| `approach` | bool | true: if the target is out of range the fighter moves to it. false: the rule is skipped (`out_of_range`) instead, used for escapes and point-blank abilities |
| `order` | `target_first` \| `self_first` | Whether `selfEffects` resolve before or after `effects` |
| `delivery` | { `type`: `instant` \| `projectile` \| `dash` \| `leap`, `speedMps`?, `endAt`?: `adjacent` \| `behind` } | Projectiles home and cannot miss (evade still applies); dash and leap move the caster first, then effects resolve on arrival |
| `area` | null \| { `shape`: `circle` \| `cone` \| `line`, `center`: `target` \| `self`, `radiusM`?, `angleDeg`? (60, 90, 120, 180), `lengthM`?, `widthM`?, `affects`: `enemies` \| `allies` \| `allies_incl_self` \| `both`, `maxTargets`: null } | A unit is inside if its centre is within the shape expanded by its radius. Cones and lines start at the caster and aim at the target. Cone tests use the fixed cosine table in `combat.json` (no trigonometry at run time) |
| `effects` | Effect[] | Applied to the primary target, or to each unit inside the area (enemies when `affects` is `both`) |
| `allyEffects` | Effect[] | Applied to allies inside a `both` area |
| `selfEffects` | Effect[] | Applied to the caster |
| `passive` | null \| { `statMods`: StatMod[], `aura`: null \| { `radiusM`, `affects`: `allies` \| `allies_incl_self` \| `enemies`, `statMods` }, `triggers`: Trigger[] } | Passives only |

**Amount** `{ base?: number, scale: [{ stat, coef }] }`, stat ∈ `power`, `support`, `maxHp`, `missingHp`, `armor`, `ward` (all the caster's), `targetMaxHp`, `targetMissingHp`, `triggerAmount` (the damage or healing that fired a trigger), `lastDamage` (post-mitigation damage dealt to this target by the preceding damage effect of the same release). Value = base + Σ coef × stat, evaluated at release (projectiles and zones keep the values from release).

**Effect vocabulary** (closed list; `type` plus parameters):

| Type | Parameters | Rule |
| --- | --- | --- |
| `damage` | amount, damageType (`physical` → armor, `arcane` → ward, `true` → none), canCrit, evadable, bonus?: [{ if: Predicate, mult }], lifesteal?, perTargetStack?: { status, mult, consume }, onKill?: Effect[] | Pipeline below |
| `heal` | amount, bonus?, to?: { sel: `lowest_hp_ally`, withinM, includeSelf } | Healing pipeline; `to` redirects the heal to another ally |
| `shield` | amount, durationS | Absorbs post-mitigation damage; total shields on a unit ≤ 50% of its max HP (excess is trimmed on application) |
| `status` | status, durationS, magnitude?, maxStacks?, tick?: { intervalS, amount, damageType? }, resetOnTargetChange?, amount? (Deathward heal) | Applies a status (catalog below) |
| `knockback` | distanceM, from: `caster` \| `area_center` | Displacement DR applies; interrupts |
| `pull` | distanceM, toward: `caster` \| `area_center`, stopGapM | As knockback, toward the point |
| `dash` | mode: `away_from_target` \| `toward_target` \| `behind_target`, distanceM | Moves the caster (in `selfEffects`) |
| `cleanse` | categories[], statuses[], count (null = all) | Removes matching harmful statuses from the target, longest remaining first |
| `dispel` | categories[] (`buff`, `shield`, `hot`), count | Removes beneficial effects from an enemy, longest remaining first |
| `interrupt` | — | Cancels a windup, cast or channel in progress |
| `guard` | pct, durationS, radiusM | Target gains Guarded by the caster (redirect, below) |
| `zone` | zone: { center, follow: `none` \| `caster`, radiusM, durationS, tickIntervalS \| null, trigger: null \| { on: `enemy_enter`, armTimeS, consume }, maxActive, allies: Effect[], enemies: Effect[] } | A ground area. Ticking zones apply `allies`/`enemies` effects to units inside at each interval (first tick one interval after creation). Trap zones apply `enemies` effects to the first enemy whose body touches them after arming, then vanish. Exceeding `maxActive` removes the caster's oldest zone of that ability |
| `chain` | bounces, radiusM, falloff, includeInitial, effects | Applies effects to the target (if includeInitial), then jumps to the nearest enemy within radius of the last one not yet hit (tie-breaks of sys-targeting), each jump × falloff |
| `splash` | radiusM, affects, excludePrimary, effects | Applies effects around the trigger target |
| `cooldown` | slot (`self`, `a1`, `a2`), mode `reset` \| `reduce`, seconds | — |
| `focus` | amount | Restores focus (capped at 100) |
| `heal_recent_damage` | windowS (≤ 4), pct, min: amount | Heals pct of post-mitigation damage the target took in the last window, at least min |

**Predicates for effects, stat mods and triggers** `{ p, … }`: `target_hp_below {pct}`, `target_hp_above {pct}`, `target_has_status {status | status[]}`, `target_casting`, `target_not_targeting_source`, `target_distance_above {gapM}`, `self_hp_below {pct}`, `self_targeted_by {count}`, `attacker_distance_above {gapM}` (for damage-taken mods), `fight_time_below {seconds}`, `fight_time_at_least {seconds}`, `ally_downed_within {seconds}`, `any {of: Predicate[]}`.

**Stat mods** `{ stat, value: number | Amount, per?: { source: selfMissingHpPct | alliesWithin | enemiesWithin | attackersOnSelf, radiusM?, coef, max }, if?: Predicate }` with stat ∈ the 27 ids in `combat.json` → `statModStats`. Value with `per` = value + coef × quantity, capped at max.

**Triggers** `{ on, n?, pct?, radiusM?, status?, statuses?, oncePerTarget?, target: self | trigger_target | trigger_source | { sel: lowest_hp_ally, withinM, includeSelf }, internalCooldownS, effects }`, on ∈ `basic_hit`, `every_n_basic`, `hit`, `damage_taken`, `evade`, `kill`, `status_target_down`, `ally_hp_below`, `every_n_heals`, `cc_applied`, `shield_broken`, `round_start`. Triggered effects resolve on the next tick (no same-tick cascades) and can never trigger thorns, lifesteal or other triggers of the same fighter in the same chain.

**Damage pipeline** (per damage instance; amounts in centipoints, each step truncates toward zero):
1. Amount at release (base + scaling).
2. × each true `bonus` multiplier; × (1 + mult × stacks) for `perTargetStack` (then consume stacks if set).
3. Evade (if `evadable` and the target can evade: weapon blows only): evade accumulator check; on evade the instance ends (event `evade`; the target's riposte and evade triggers fire).
4. Crit (if `canCrit`): crit accumulator check; × 1.5.
5. × variance factor (−4% to +4%).
6. × source damage-dealt multiplier: clamp(1 + Empowered − Weakened + Σ damageDealt mods incl. per-target conditionals, 0.25, 2.5).
7. **Guard split:** if the target is Guarded and its guardian is standing within the guard radius (gap), pct of the amount is redirected to the guardian and continues from step 8 against the guardian; redirected damage cannot be redirected again and never triggers thorns.
8. × recipient damage-taken multiplier: clamp(1 + Vulnerable + Marked − Fortified + Σ damageTaken mods incl. attacker-conditional ones, 0.25, 2.0).
9. × overtime damage multiplier.
10. Mitigation: physical × 100 / (100 + max(0, armor)); arcane × 100 / (100 + max(0, ward)); true × 1.
11. Truncate to whole points; minimum 1 if the amount before truncation was > 0.
12. Shields absorb (soonest-expiring first, from shields that existed at the start of the tick), the rest is HP damage (summed at commit). Overkill and absorbed amounts are recorded.
13. After the tick: lifesteal heals the source for lifesteal × (HP + shield damage dealt); Illuminated heals the attacker; thorns reflect thorns × the step-6 amount as physical damage from the target to an attacker within 1.5 m gap (weapon blows only; reflect is mitigated by the attacker's armor and modified by its damage-taken multiplier but by nothing of the reflector's).

**Healing pipeline:** amount × bonuses × (1 + Σ healingDealt mods of the healer) × clamp(1 + Σ healingReceived mods − Festering, 0, 2) × overtime healing multiplier, truncated. Healing is capped at missing HP at commit; the excess is recorded as overheal. Heals never crit. Shields use the same pipeline without the missing-HP cap. Downed units cannot be healed.

**Hard crowd control and diminishing returns.** Stun, sleep, root, silence and taunt share the `control` DR track; knockback and pull share the `displace` track. Each application on a target uses the next step of [1.0, 0.6, 0.35, 0 (immune)]; the track resets when 6 s pass after the last *applied* entry. One ability release advances a track at most once per target, even if it applies two control statuses (e.g. Harpoon's pull and taunt use one `displace` and one `control` step). Duration = trunc(base ticks × (1 + caster ccDurationDealt) × DR step × (1 − tenacity)), capped at 2.5 s; results under 0.1 s are resisted (`status.resist`). Soft CC (slow, sluggish) and debuffs have no DR; their duration is × (1 + caster debuffDurationDealt) × (1 − resolve). Buffs are not reduced. A new control status on a unit replaces a weaker remaining one of the same id; different ids coexist (root and silence together are legal).

**Stacking rules.**
- One instance per (status, source unit, ability). Reapplying refreshes duration to the longer of remaining and new and keeps the higher magnitude; with `maxStacks` > 1 it also adds a stack up to the maximum (all stacks share the refreshed duration).
- `strongest`: across different sources only the instance with the highest total magnitude (magnitude × stacks) counts; ties: the longest remaining.
- `stacks` (damage and healing over time, Momentum): every source's instance counts; tick amount × stacks.
- `refresh` and `latest`: one active instance; `latest` (taunt, guarded) is replaced by the newest application.
- Shields from different sources add, up to the shield cap.
- Statuses are listed in the catalog below; no M1 ability uses a status that is not listed.

**Status catalog** (`combat.json` → `statuses`; caps are maximum magnitudes):

| Id | Name | Category | DR | Stacking | Modifies | Cap | Rule |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `stun` | Stunned | cc_hard | control | refresh | blocks move/attack/ability | — | Cannot move, attack or use abilities. Interrupts casts and channels. |
| `sleep` | Asleep | cc_hard | control | refresh | blocks move/attack/ability | — | As Stunned, but wakes at the end of any tick in which it took damage of at least 8% of its max HP. |
| `root` | Rooted | cc_hard | control | refresh | blocks move | — | Cannot move or dash. Can still attack and cast. Ends mobile channels. |
| `silence` | Silenced | cc_hard | control | refresh | blocks ability | — | Cannot use active abilities. Basic attacks still work. Interrupts casts and channels. |
| `taunt` | Taunted | cc_hard | control | latest | blocks rules/ability | — | Rules are suspended: must move to and basic-attack the taunter. The latest taunt wins. |
| `slow` | Slowed | cc_soft | — | strongest | −moveSpeed | 0.6 | Move speed reduced. Only the strongest slow applies. |
| `sluggish` | Sluggish | cc_soft | — | strongest | −attackSpeed | 0.5 | Attack speed reduced. Only the strongest applies. |
| `haste` | Hasted | buff | — | strongest | +moveSpeed | 0.5 | Move speed increased. |
| `frenzy` | Frenzied | buff | — | strongest | +attackSpeed | 1 | Attack speed increased. |
| `momentum` | Momentum | buff | — | stacks | +attackSpeed | 0.5 | Attack speed increased per stack. Separate from Frenzied, so both apply. |
| `empower` | Empowered | buff | — | strongest | +damageDealt | 0.6 | Deals more damage. |
| `weaken` | Weakened | debuff | — | strongest | −damageDealt | 0.5 | Deals less damage. |
| `shaken` | Shaken | debuff | — | strongest | −composure | 10 | The acting captain fell: composure reduced for a few seconds (sys-fight-captain). Some traits reduce or ignore it. |
| `fortify` | Fortified | buff | — | strongest | −damageTaken | 0.6 | Takes less damage. |
| `vulnerable` | Vulnerable | debuff | — | strongest | +damageTaken | 0.5 | Takes more damage. |
| `marked` | Marked | debuff | — | strongest | +damageTaken | 0.3 | A posted bounty: takes more damage from everyone. Separate from Vulnerable, so both apply. |
| `armor_up` | Armored | buff | — | strongest | +armor | 80 | Armor increased (flat). |
| `armor_shred` | Sundered | debuff | — | strongest | −armor | 60 | Armor reduced (flat, never below 0). |
| `ward_up` | Warded | buff | — | strongest | +ward | 80 | Ward increased (flat). |
| `ward_shred` | Unwarded | debuff | — | strongest | −ward | 60 | Ward reduced (flat, never below 0). |
| `heal_reduction` | Festering | debuff | — | strongest | −healingReceived | 0.6 | Receives less healing and smaller shields. |
| `thorns` | Barbed | buff | — | strongest | +thorns | 0.6 | Reflects part of the weapon damage taken from attackers in melee range. |
| `lifesteal` | Bloodthirsty | buff | — | strongest | +lifesteal | 0.5 | Heals for part of the damage it deals. |
| `evasive` | Evasive | buff | — | strongest | +evade | 0.6 | Higher chance to evade weapon blows (total evade is capped at 75%). |
| `bleed` | Bleeding | dot | — | stacks | — | — | Takes physical damage every tick interval. |
| `burn` | Burning | dot | — | stacks | — | — | Takes arcane damage every tick interval. |
| `poison` | Poisoned | dot | — | stacks | — | — | Takes arcane damage every tick interval; stacks. |
| `regen` | Regenerating | hot | — | stacks | — | — | Heals every tick interval. |
| `guarded` | Guarded | buff | — | latest | — | 0.6 | While the guardian stands within the guard radius, part of the damage taken is redirected to the guardian. |
| `riposte` | Riposting | buff | — | refresh | — | — | Each evaded weapon blow from melee range triggers a counter-strike (magnitude = Power coefficient). |
| `deathward` | Deathwarded | buff | — | refresh | — | — | The first time it would be downed, it stays at 1 HP and is healed instead; then the ward ends. |
| `anchored` | Anchored | special | — | refresh | blocks move | — | Self-chosen stance: cannot move, immune to knockback and pull. Not crowd control. |
| `illuminated` | Illuminated | debuff | — | strongest | — | 0.3 | Allies who damage this enemy heal for a share (magnitude) of the damage dealt. |
| `rallied` | Rallied | buff | — | strongest | +composure | 10 | The captain's rally after an ally fell: composure increased, ally-down penalties suppressed. |

**Special status rules.** *Taunt:* rules are suspended; the unit moves to and basic-attacks the taunter; if the taunter is downed or untargetable the taunt ends. *Sleep:* ends at the commit of any tick in which the sleeper took at least 8% of its max HP. *Guarded:* see step 7. *Riposte:* each evaded blow from an attacker within 1.5 m triggers a counter-strike of magnitude × Power physical damage (canCrit, not evadable) next tick. *Deathward:* at commit, if HP ≤ 0, HP becomes 1 and the ward's heal amount (healing pipeline) is applied; the ward ends; event `deathward.save`. *Anchored:* the unit's own stance, not crowd control; it cannot move and ignores knockback and pull. *Illuminated:* any enemy of the Illuminated unit that damages it heals for magnitude × that damage after the tick.

**Content parameters and invariants (validated at load).** Every referenced status, stat, predicate, trigger, amount stat and effect type exists; hard-CC durations ≤ 2.5 s; magnitudes ≤ the status cap; times are whole ticks; distances whole centimetres; actives have cooldown > 0 and focus > 0; self-target abilities never approach; `both` areas have ally effects; cone angles are in the table.

**Worked example (EXAMPLE): Behead.** Headsman, STR 14, PRE 10: Power = trunc(140 × (1 + 0.04 × 3.6)) = 160. Behead on an Oathguard at 25% HP with armor 68, no crit (accumulator below 10,000), variance draw r = 6,243 → +1.00%:
320.00 (200% Power) → × 2 (target below 30%) = 640.00 → × 1.01 = 646.40 → dealt × 1.0 → taken × 1.0 → × 100/168 = 384.76 → **384 damage**. If it downs the Oathguard, Behead's cooldown resets (`onKill`).

**Acceptance cases.** acc-02 (DR chain), acc-03 (thorns), acc-05 (guard), acc-06 (interrupt), acc-07 (Deathward) in §9.

### sys-abilities (content): the 42 classes

**Status / scope:** class counts REQUIRED (O8); identities, names, kits and numbers PROPOSED · TUNABLE. Hybrid DPS sides follow open-024 (working assumption).

**Kit structure (PROPOSED).** Every class has exactly: a basic attack (`basic`), two actives (`a1`, `a2`, each with cooldown and focus cost) and one passive. Learned abilities (M5) are FUTURE and would add slots.

**Class schema** (`classes.json` → `classes[]`):

| Field | Type | Meaning |
| --- | --- | --- |
| `id`, `name`, `flavor`, `description` | string | Original names; one-line flavour; a two-line "how it plays" for the class card |
| `iconId` | string | `class_<id>` placeholder |
| `archetypes` | 1–2 of `tank`, `melee`, `ranged`, `controller`, `healer` | Role tags; a hybrid matches both in role selectors (open-024) |
| `hybridPair` | null \| `tank_dps` \| `tank_controller` \| `tank_healer` \| `dps_controller` \| `dps_healer` \| `controller_healer` | O8 pair |
| `roleTags` | string[] | Sub-role chips for the UI (e.g. interceptor, taunter) |
| `affinityGroup` | `frontline` \| `skirmisher` \| `ranged` \| `caster` \| `support` | Key into `races.json` classAffinity (generation only) |
| `complexity` | 1–3 | UI hint: how much the class depends on good rules |
| `preferredBand`, `startingRow` | band, `front` \| `back` | Default row at lineup and UI labels |
| `damageProfile` | `physical` \| `arcane` \| `mixed` | UI hint for armor/ward counters |
| `base` | { hp, armor, ward, power, support, attackIntervalS, moveSpeedMps, critBonus, evadeBonus, tenacityBonus } | Values at all attributes 10 |
| `powerAttrs`, `supportAttrs` | { statId: weight } summing to 1, or null | Which attributes feed Power and Support |
| `ratingWeights` | { 12 statIds: weight } summing to exactly 1.00 | Rating formula weights (economy and lifecycle) |
| `statEmphasis` | { 12 statIds: 0.5–2.0 } | Generation and growth bias, 1.0 neutral |
| `abilities` | { basic, a1, a2, passive: AbilityId } | Kit |
| `presetIds`, `defaultPresetId` | PresetId[] (2–3), PresetId | Presets selectable in M1; the default is the first (style `balanced`) |

**Archetype baselines** (averages at all attributes 10, after balance pass 1 of §8):

| Archetype | Classes | HP | Armor | Ward | Power | Support | Attack interval (s) | Move (m/s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tanks | 6 | 1244.17 | 55.83 | 41.67 | 70 | 0 | 1.28 | 3.22 |
| Melee DPS | 6 | 1085 | 28.33 | 26.67 | 104.33 | 0 | 1.03 | 3.58 |
| Ranged DPS | 6 | 810 | 15 | 23.33 | 94.5 | 0 | 1.19 | 3.4 |
| Controllers | 6 | 853.33 | 20.83 | 33.33 | 98 | 0 | 1.2 | 3.33 |
| Healers | 6 | 880 | 20.83 | 35 | 53.83 | 110.17 | 1.2 | 3.3 |
| Hybrids | 12 | 1134.17 | 35.92 | 35 | 80.17 | 36.25 | 1.2 | 3.31 |

**Identities within each archetype** (each pure archetype has six distinct jobs; each hybrid uses one ability from each side of its pair):

- **Tanks:** Oathguard (interceptor, bodyguard); Gongbearer (taunter, absorber); Scarhide (bruiser, regenerator); Briarback (thorns, punisher); Bladeturner (evasive, duelist); Phalanx Sergeant (shield-wall, formation).
- **Melee DPS:** Gutterknife (diver, assassin); Bloodhowler (berserker, lifesteal); Twinfang (flurry, duelist); Headsman (executioner, armor-breaker); Chaffcutter (cleaver, crowd-killer); Runecleaver (spellblade, mage-hunter).
- **Ranged DPS:** Longeye (sniper, burst); Boltrunner (kiter, skirmisher); Emberwright (pyromancer, area); Blightbrewer (poisoner, anti-heal); Thunderhand (chain, storm); Writ Hunter (marker, focus-fire).
- **Controllers:** Rimebinder (frost, peeler); Hexmonger (hexer, debuffer); Galeshaper (displacer, wind); Hushweaver (silencer, anti-caster); Dreamthief (sleeper, stunner); Snaresetter (trapper, zoner).
- **Healers:** Chirurgeon (surgeon, cleanser); Cantor (choir, area-heal); Aegis Scribe (shielder, pre-emptive); Grovetender (regrowth, heal-over-time); Vigilkeeper (death-ward, savior); War Drummer (tempo, rally).
- **Hybrids:** Tank / DPS: Siegebreaker (tank+melee; bruiser, charger), Pavisier (tank+ranged; turret, cover); Tank / Controller: Gaoler (tank+controller; jailer, anchor), Harpooner (tank+controller; puller, peel); Tank / Healer: Vowknight (tank+healer; martyr, sustain), Deeproot Keeper (tank+healer; totem, regen); DPS / Controller: Netcaster (melee+controller; pinner, skirmisher), Skullslinger (ranged+controller; stunner, skirmisher); DPS / Healer: Leechblade (melee+healer; siphon, sustain), Sunlance Acolyte (ranged+healer; brand, battle-healer); Controller / Healer: Undertow Mystic (controller+healer; tide, cleanser), Hourglass Sage (controller+healer; rewind, tempo).

**Full catalog** (generated from the data; "Power" and "Support" are the fighter's derived values):

#### Tanks

| Class | Identity | Band · row · base | Basic | Active 1 | Active 2 | Passive | Presets |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Oathguard** `oathguard`<br>tank | Bodyguard tank. Dashes to threatened allies, takes part of their damage, and bashes casters out of their spells.<br>*Sworn to one paymaster at a time, and that paymaster never bleeds first.* | melee · front<br>HP 1250, armor 60, ward 45, Power 72, 1.3 s, 3.2 m/s | **Mace Strike** *(1 m)*: Strikes an adjacent enemy for 100% Power physical damage. | **Interpose** *(10 s cd, 25 focus)*: Dashes to an ally within 7 m and guards it for 4 s: 30% of its damage is redirected to the Oathguard, which gains 15% Fortified. | **Shield Bash** *(9 s cd, 20 focus, 0.2 s cast)*: Bashes an adjacent enemy for 140% Power physical damage, stunning it for 0.8 s and interrupting its cast. | **Sworn Shield**: Allies within 3 m take 8% less damage. | Balanced, Bodyguard, Vanguard |
| **Gongbearer** `gongbearer`<br>tank | Taunt tank. Rings its gong to force nearby enemies to attack it, then braces behind a shield and hardens while focused.<br>*Carries a war-gong on its back; when it rings, every enemy forgets everyone else.* | melee · front<br>HP 1260, armor 55, ward 50, Power 66, 1.4 s, 3.1 m/s | **Gong Hammer** *(1 m)*: Strikes an adjacent enemy for 100% Power physical damage. | **Clangor** *(11 s cd, 30 focus, 0.3 s cast)*: Rings the gong: taunts every enemy within 3.5 m for 1 s and gains 20% Fortified for 3 s. | **Brace** *(12 s cd, 20 focus)*: Gains a shield worth 14% of its max HP for 4 s. | **Hollow Ring**: While 2 or more enemies are targeting it, gains 15 armor and 15 ward. | Balanced, Gatekeeper, Rabble-Rouser |
| **Scarhide** `scarhide`<br>tank | Regenerating bruiser. Heals constantly, cleaves crowds with lifesteal, and catches a second wind when it matters.<br>*Every scar a contract paid; there is always room for one more.* | melee · front<br>HP 1230, armor 45, ward 35, Power 72, 1.2 s, 3.3 m/s | **Hacking Axe** *(1 m)*: Strikes an adjacent enemy for 100% Power physical damage. | **Second Wind** *(16 s cd, 25 focus)*: Heals 25% of its missing HP, then regenerates 2% of max HP per second for 4 s. | **Gut Cleave** *(6 s cd, 15 focus, 0.2 s cast)*: Cleaves a 90° cone within 2 m for 120% Power physical damage, healing for 30% of the damage dealt. | **Thick Blood**: Regenerates 0.5% of max HP per second, doubled while below 40% HP. | Balanced, Bloodied Line, Hold the Line |
| **Briarback** `briarback`<br>tank | Thorns tank. Reflects damage back at melee attackers and scatters caltrops that slow and cut.<br>*Its armor grew barbs over years of bad clients; now everyone who swings at it pays.* | melee · front<br>HP 1300, armor 70, ward 35, Power 66, 1.4 s, 3.1 m/s | **Spiked Gauntlet** *(1 m)*: Strikes an adjacent enemy for 100% Power physical damage. | **Bristle** *(10 s cd, 20 focus)*: For 4 s, reflects 40% of melee weapon damage taken and gains 20 armor. | **Caltrop Scatter** *(10 s cd, 20 focus, 0.3 s cast)*: Scatters caltrops in a 2.5 m circle around itself for 4 s: enemies inside are slowed 30% and take 15% Power physical damage every 0.5 s. | **Barbed Hide**: Reflects 15% of melee weapon damage taken and has 10 extra armor. | Balanced, Briar Wall, Spitebait |
| **Bladeturner** `bladeturner`<br>tank | Evasive tank. Dodges weapon blows, counter-strikes from a parry stance and provokes single enemies. Spells go straight through.<br>*Never blocks a blow it can step around, and never steps around one without answering.* | melee · front<br>HP 1215, armor 40, ward 40, Power 75, 1.1 s, 3.5 m/s | **Sabre Cut** *(1 m)*: Strikes an adjacent enemy for 100% Power physical damage. | **Parry Stance** *(12 s cd, 25 focus)*: For 2.5 s, gains 50% evade, and each evaded melee blow triggers a counter-strike for 60% Power. | **Provoking Flourish** *(8 s cd, 15 focus, 0.1 s cast)*: Cuts an adjacent enemy for 90% Power physical damage and taunts it for 1.2 s. | **Light Feet**: +20% evade. Each evade grants 5% Empowered for 3 s, stacking up to 3 times. | Balanced, Duelist, Escort |
| **Phalanx Sergeant** `phalanx_sergeant`<br>tank | Shield-wall tank. Shields the whole formation, pikes attackers back, and grows sturdier with allies beside it.<br>*Drilled a hundred recruits to lock shields; now drills whoever its employer hires.* | melee · front<br>HP 1210, armor 65, ward 45, Power 69, 1.3 s, 3.1 m/s | **Pike Jab** *(1.6 m)*: Jabs an enemy within 1.6 m for 100% Power physical damage. | **Lock Shields** *(12 s cd, 30 focus, 0.2 s cast)*: Gives itself and allies within 4 m a shield worth 10% of its max HP for 4 s. | **Pike Thrust** *(8 s cd, 15 focus, 0.2 s cast)*: Thrusts 3 m forward: enemies in the line take 120% Power physical damage and are knocked back 2 m. | **Formation Drill**: Allies within 3 m gain 10 armor. Gains 5 armor per ally within 3 m (up to 15). | Balanced, Shield Wall, Advance |

#### Melee DPS

| Class | Identity | Band · row · base | Basic | Active 1 | Active 2 | Passive | Presets |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Gutterknife** `gutterknife`<br>melee | Back-line diver. Shadowsteps behind distant targets, hamstrings them, and hits hardest when unseen.<br>*Learned to fight where the lamplight didn't reach, and still prefers it there.* | melee · front<br>HP 1080, armor 25, ward 25, Power 110, 0.9 s, 3.8 m/s | **Shiv** *(1 m)*: Stabs an adjacent enemy for 100% Power physical damage. | **Shadowstep** *(10 s cd, 25 focus)*: Dashes behind an enemy within 8 m and strikes for 160% Power physical damage. | **Hamstring** *(7 s cd, 15 focus)*: Cuts an adjacent enemy for 100% Power physical damage and slows it 40% for 2.5 s. | **Unseen Angle**: Deals 25% more damage to enemies that are not targeting it. | Balanced, Healer Hunter, Counter-Diver |
| **Bloodhowler** `bloodhowler`<br>melee | Berserker. Grows deadlier as it loses HP, frenzies for attack speed and lifesteal, and opens bleeding wounds.<br>*Howls when wounded, and is always wounded.* | melee · front<br>HP 1150, armor 25, ward 25, Power 90, 1 s, 3.6 m/s | **Rending Axe** *(1 m)*: Strikes an adjacent enemy for 100% Power physical damage. | **Blood Frenzy** *(12 s cd, 25 focus)*: For 5 s, gains 50% attack speed and heals for 15% of the damage it deals. | **Savage Rend** *(7 s cd, 15 focus)*: Rends an adjacent enemy for 80% Power physical damage plus a bleed of 25% Power every 0.5 s for 3 s (stacks twice). | **Bloodrush**: Deals up to 25% more damage the lower its HP: +0.6% for every 1% of HP missing. | Balanced, Red Mist, Leashed |
| **Twinfang** `twinfang`<br>melee | Flurry duelist. Attack speed builds while it stays on one target; unleashes a channelled flurry and sidesteps danger.<br>*Two blades, one rhythm; the longer the song, the faster it plays.* | melee · front<br>HP 1080, armor 30, ward 25, Power 78, 0.75 s, 3.6 m/s | **Twin Strike** *(1 m)*: Strikes an adjacent enemy for 100% Power physical damage. | **Flurry** *(9 s cd, 25 focus)*: Channels for 1.2 s, striking its target 6 times for 55% Power physical damage each. | **Sidestep** *(8 s cd, 15 focus)*: Gains 50% evade and 30% Hasted for 1.5 s. | **Momentum**: Each basic hit on the same target grants 6% attack speed for 3 s, stacking 5 times. Switching targets resets it. | Balanced, Focus Fire, Guard Dance |
| **Headsman** `headsman`<br>melee | Executioner. Slow, heavy chops; sunders armor and beheads wounded enemies, resetting the cooldown on a kill.<br>*Paid by the head, and has never once been short-changed.* | melee · front<br>HP 1100, armor 35, ward 25, Power 140, 1.4 s, 3.4 m/s | **Heavy Chop** *(1 m)*: Chops an adjacent enemy for 100% Power physical damage. | **Behead** *(10 s cd, 30 focus, 0.5 s cast)*: After a 0.5 s windup, chops for 200% Power physical damage, doubled against enemies below 30% HP. Resets on a kill. | **Sunder** *(8 s cd, 15 focus)*: Chops for 80% Power physical damage and reduces armor by 25 for 5 s. | **Executioner's Eye**: +40% critical-hit chance against enemies below 40% HP. | Balanced, Reaper |
| **Chaffcutter** `chaffcutter`<br>melee | Cleaver. Leaps into clusters, spins a whirling harvest, and every swing splashes onto neighbours.<br>*Built for crowds, paid by the head, never picky about which head.* | melee · front<br>HP 1100, armor 30, ward 25, Power 110, 1.1 s, 3.5 m/s | **Scythe Sweep** *(1 m)*: Sweeps an adjacent enemy for 100% Power physical damage. | **Whirling Harvest** *(10 s cd, 25 focus)*: Channels for 1.5 s while moving at half speed, dealing 35% Power physical damage to enemies within 2 m every 0.25 s. | **Reaping Leap** *(12 s cd, 25 focus)*: Leaps onto an enemy within 6 m: enemies within 2 m of the landing take 120% Power physical damage and are slowed 30% for 2 s. | **Wide Arc**: Basic attacks also hit enemies within 1.5 m of the target for 40% Power physical damage. | Balanced, Thresher |
| **Runecleaver** `runecleaver`<br>melee | Arcane blade. Its weapon deals arcane damage that armor won't stop; bursts runes in a cone and lunges at casters to silence them.<br>*Etched its blade with runes it only half understands, which is why it hits so hard.* | melee · front<br>HP 1000, armor 25, ward 35, Power 98, 1 s, 3.6 m/s | **Runed Edge** *(1 m)*: Strikes an adjacent enemy for 100% Power arcane damage. | **Rune Burst** *(8 s cd, 20 focus, 0.2 s cast)*: Bursts runes in a 90° cone within 2.5 m: 140% Power arcane damage and -20 ward for 4 s. | **Arc Lunge** *(10 s cd, 20 focus)*: Lunges at an enemy within 5 m for 100% Power arcane damage and silences it for 0.8 s. | **Third Rune**: Every third basic hit deals an extra 80% Power arcane damage. | Balanced, Mage Hunter |

#### Ranged DPS

| Class | Identity | Band · row · base | Basic | Active 1 | Active 2 | Passive | Presets |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Longeye** `longeye`<br>ranged | Sniper. Longest range in the league; aimed shots punish distant targets, and it leaps back when caught.<br>*Never met a target it couldn't outwait.* | long · back<br>HP 780, armor 15, ward 20, Power 104, 1.6 s, 3.3 m/s | **Longbow Shot** *(8 m)*: Shoots an enemy within 8 m for 100% Power physical damage. | **Aimed Shot** *(9 s cd, 30 focus, 1 s cast)*: After a 1 s aim, fires for 300% Power physical damage. Stuns and silences interrupt the aim. | **Leap Back** *(10 s cd, 15 focus)*: Leaps 4 m away from an enemy within 4 m and gains 20% Hasted for 2 s. | **Deadeye**: Deals 20% more damage to enemies more than 5 m away. | Balanced, Headhunter, Overwatch |
| **Boltrunner** `boltrunner`<br>ranged | Kiting crossbow. Moves fast and shoots quickly, pins chasers with a rooting bolt and tumbles away from melee.<br>*Fires, runs, reloads, fires again; has never stood still long enough to be paid in person.* | mid · back<br>HP 820, armor 15, ward 20, Power 91, 1 s, 3.6 m/s | **Hand Crossbow** *(5.5 m)*: Shoots an enemy within 5.5 m for 100% Power physical damage. | **Pinning Bolt** *(9 s cd, 20 focus)*: Fires a bolt for 120% Power physical damage that roots the target for 1 s. | **Tumble Shot** *(7 s cd, 15 focus)*: Tumbles 3 m away from an enemy within 3 m, then shoots it for 80% Power physical damage. | **Light Load**: Basic-attack windup is halved and it moves 10% faster. | Balanced, Run and Gun, Escort Fire |
| **Emberwright** `emberwright`<br>ranged | Pyromancer. Arcane fire: blooms of flame that burn groups and a lance that pierces a whole line.<br>*Apprenticed to a forge, graduated to setting the whole arena alight.* | mid · back<br>HP 780, armor 10, ward 30, Power 80, 1.2 s, 3.3 m/s | **Ember Bolt** *(6 m)*: Hurls an ember at an enemy within 6 m for 100% Power arcane damage. | **Firebloom** *(10 s cd, 30 focus, 0.6 s cast)*: After 0.6 s, erupts a 2.5 m circle at the target: 120% Power arcane damage and a burn of 15% Power every 0.5 s for 3 s. | **Flame Lance** *(7 s cd, 20 focus, 0.3 s cast)*: After 0.3 s, hurls a lance 8 m long: enemies in the line take 140% Power arcane damage. | **Kindling**: Deals 12% more damage to burning enemies. | Balanced, Inferno |
| **Blightbrewer** `blightbrewer`<br>ranged | Poisoner. Darts stack poison and spoil healing, flasks leave toxic clouds, and Rupture detonates the stacks.<br>*Brews in the back of the wagon what other clubs pretend not to buy.* | mid · back<br>HP 860, armor 15, ward 25, Power 110, 1.1 s, 3.4 m/s | **Venom Dart** *(6 m)*: Darts an enemy within 6 m for 80% Power physical damage and a poison stack: 12% Power arcane damage per second for 4 s (up to 3 stacks). | **Noxious Flask** *(10 s cd, 25 focus, 0.4 s cast)*: After 0.4 s, leaves a 2.2 m cloud for 4 s: enemies inside take 12% Power arcane damage every 0.5 s and receive 40% less healing. | **Rupture** *(12 s cd, 25 focus, 0.2 s cast)*: Detonates poison on an enemy: 100% Power arcane damage, +60% per poison stack, consuming the stacks. | **Festering**: Basic hits make the target receive 25% less healing for 4 s. | Balanced, Plague Doctor |
| **Thunderhand** `thunderhand`<br>ranged | Storm caster. Chain lightning arcs between enemies, and a thunderclap blasts back anyone who closes in.<br>*Struck by lightning twice, and took it as a career suggestion.* | mid · back<br>HP 800, armor 15, ward 25, Power 84, 1.1 s, 3.4 m/s | **Spark** *(6 m)*: Zaps an enemy within 6 m for 100% Power arcane damage. | **Chain Lightning** *(8 s cd, 25 focus, 0.4 s cast)*: After 0.4 s, strikes an enemy for 130% Power arcane damage, then arcs to up to 3 more enemies within 4 m, losing 20% per jump. | **Thunderclap** *(11 s cd, 20 focus)*: Blasts enemies within 2.5 m for 100% Power arcane damage and knocks them back 2.5 m. | **Arc Conductor**: Every fourth basic hit arcs to up to 2 more enemies within 4 m for 50% Power arcane damage. | Balanced, Storm Front |
| **Writ Hunter** `writ_hunter`<br>ranged | Bounty hunter. Posts a writ that makes one enemy take more damage from everyone, nets runners, and cashes in on marked kills.<br>*Carries a satchel of signed warrants; one of them has your name on it.* | mid · back<br>HP 820, armor 20, ward 20, Power 98, 1.15 s, 3.4 m/s | **Bounty Bolt** *(7 m)*: Shoots an enemy within 7 m for 100% Power physical damage. | **Post the Writ** *(12 s cd, 20 focus, 0.2 s cast)*: Marks an enemy within 9 m for 6 s: it takes 15% more damage from all sources. | **Weighted Net** *(10 s cd, 20 focus)*: Throws a net for 60% Power physical damage that roots the target for 1.2 s. | **Collect the Bounty**: Deals 20% more damage to marked enemies. When a marked enemy goes down, gains 15% Empowered for 5 s and 25 focus. | Balanced, Bounty Board, Warden's Writ |

#### Controllers

| Class | Identity | Band · row · base | Basic | Active 1 | Active 2 | Passive | Presets |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Rimebinder** `rimebinder`<br>controller | Frost controller. Every bolt chills, a nova roots everyone nearby, and a glacial lance slows hard.<br>*Grew up on a glacier and still thinks everyone else moves far too fast.* | mid · back<br>HP 850, armor 20, ward 35, Power 80, 1.2 s, 3.3 m/s | **Frost Shard** *(6 m)*: Hurls a shard at an enemy within 6 m for 100% Power arcane damage, slowing it 15% for 1.5 s. | **Rime Nova** *(12 s cd, 30 focus, 0.3 s cast)*: After 0.3 s, freezes the ground within 3 m: 80% Power arcane damage and roots enemies for 1.2 s. | **Glacial Lance** *(8 s cd, 20 focus, 0.5 s cast)*: After 0.5 s, fires a lance for 140% Power arcane damage that slows 45% for 3 s. | **Deep Chill**: Deals 15% more damage to slowed or rooted enemies. | Balanced, Ice Wall, Lockdown |
| **Hexmonger** `hexmonger`<br>controller | Hexer. Withers the enemy's top damage dealer and curses groups to take extra damage; its debuffs linger.<br>*Sells curses by the ounce and always throws in a free sample.* | mid · back<br>HP 850, armor 20, ward 35, Power 92, 1.2 s, 3.3 m/s | **Hex Bolt** *(6.5 m)*: Hurls a hex at an enemy within 6.5 m for 100% Power arcane damage. | **Withering Hex** *(9 s cd, 20 focus, 0.3 s cast)*: After 0.3 s, weakens an enemy by 25% for 4 s. | **Mark of Ruin** *(10 s cd, 20 focus, 0.3 s cast)*: After 0.3 s, curses a 2.5 m circle: 50% Power arcane damage and 15% Vulnerable for 4 s. | **Lingering Malice**: Debuffs it applies last 30% longer. | Balanced, Ruin, Ward-Hex |
| **Galeshaper** `galeshaper`<br>controller | Wind controller. Blasts attackers away in a cone, drags enemies together with a downdraft, and speeds nearby allies.<br>*Talks to the wind, and the wind, unfortunately, listens.* | mid · back<br>HP 870, armor 20, ward 35, Power 110, 1.2 s, 3.4 m/s | **Gust** *(6 m)*: Strikes an enemy within 6 m with wind for 100% Power arcane damage. | **Repelling Gale** *(10 s cd, 25 focus, 0.3 s cast)*: After 0.3 s, blasts a 90° cone within 4 m: 70% Power arcane damage and 3 m knockback. | **Downdraft** *(12 s cd, 25 focus, 0.5 s cast)*: After 0.5 s, pulls enemies within 3 m of the target 1.5 m toward it and slows them 30% for 2 s. | **Tailwind**: Allies within 4 m move 10% faster. | Balanced, Windbreak, Vortex |
| **Hushweaver** `hushweaver`<br>controller | Anti-caster. Silences and interrupts, unravels enemy buffs and shields, and hits casters harder.<br>*Knots silence into thread and sews it over other people's mouths.* | mid · back<br>HP 850, armor 20, ward 35, Power 104, 1.2 s, 3.3 m/s | **Muting Needle** *(6.5 m)*: Flicks a needle at an enemy within 6.5 m for 100% Power arcane damage. | **Hush** *(10 s cd, 25 focus)*: Instantly silences an enemy within 7 m for 1.5 s, interrupting its cast. | **Unravel** *(9 s cd, 20 focus, 0.3 s cast)*: After 0.3 s, strips up to 2 buffs (shields included) from an enemy and deals 80% Power arcane damage. | **Quiet Mind**: Deals 25% more damage to enemies that are casting or silenced. +15% tenacity. | Balanced, Gag Order |
| **Dreamthief** `dreamthief`<br>controller | Sleep controller. Puts one enemy to sleep for a long time (enough damage wakes it) and dazes small groups.<br>*Steals a few seconds of sleep from everyone it meets and sells them back at a markup.* | mid · back<br>HP 850, armor 20, ward 35, Power 98, 1.2 s, 3.3 m/s | **Lull Mote** *(6 m)*: Drifts a mote at an enemy within 6 m for 100% Power arcane damage. | **Slumber** *(14 s cd, 30 focus, 0.6 s cast)*: After 0.6 s, puts an enemy to sleep for 2.5 s. A hit of 8% of its max HP in one tick wakes it. | **Daze Pulse** *(10 s cd, 25 focus, 0.3 s cast)*: After 0.3 s, pulses a 2.5 m circle: 60% Power arcane damage and a 0.6 s stun. | **Drowsy Air**: Crowd control it applies lasts 15% longer. | Balanced, Lullaby |
| **Snaresetter** `snaresetter`<br>controller | Trapper. Sets bear traps that root whoever steps on them and spills tar that slows; rooted prey takes extra damage.<br>*Has a trap for every kind of fool, and two for the fast ones.* | mid · back<br>HP 850, armor 25, ward 25, Power 104, 1.2 s, 3.4 m/s | **Barbed Dart** *(5.5 m)*: Throws a dart at an enemy within 5.5 m for 100% Power physical damage. | **Bear Trap** *(8 s cd, 20 focus, 0.5 s cast)*: After 0.5 s, sets a trap at an enemy's feet (arms in 0.3 s, lasts 12 s, 2 at most): the first enemy to touch it takes 100% Power physical damage and is rooted 1.5 s. | **Tar Pit** *(12 s cd, 25 focus, 0.4 s cast)*: After 0.4 s, spills tar in a 2.5 m circle for 5 s: enemies inside are slowed 40%. | **Pinned Prey**: Enemies it roots are 10% Vulnerable for 2.5 s. | Balanced, Hunting Ground |

#### Healers

| Class | Identity | Band · row · base | Basic | Active 1 | Active 2 | Passive | Presets |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Chirurgeon** `chirurgeon`<br>healer | Single-target healer. Big direct heals that grow on badly wounded allies, plus a tincture that cleanses.<br>*Stitches faster than the opposition can cut, and charges by the stitch.* | mid · back<br>HP 850, armor 20, ward 35, Power 49, Support 100, 1.2 s, 3.3 m/s | **Scalpel Toss** *(5 m)*: Throws a scalpel at an enemy within 5 m for 100% Power physical damage. | **Suture** *(5 s cd, 20 focus, 0.5 s cast)*: After 0.5 s, heals an ally for 220% Support, 30% more if it is below 35% HP. | **Purging Tincture** *(10 s cd, 20 focus, 0.2 s cast)*: After 0.2 s, removes all harmful effects from an ally, then heals it 15% Support every 0.5 s for 3 s. | **Field Dressing**: Every third heal it casts also gives the target 15% Fortified for 3 s. | Balanced, Triage, Combat Medic |
| **Cantor** `cantor`<br>healer | Area healer. Choruses that heal everyone nearby and a sanctuary that keeps healing; allies close to it regenerate.<br>*Sings the same hymn every fight; the crowd now sings it back.* | close · back<br>HP 880, armor 20, ward 35, Power 49, Support 118, 1.2 s, 3.3 m/s | **Chime** *(5 m)*: Rings a chime at an enemy within 5 m for 100% Power arcane damage. | **Chorus of Mending** *(9 s cd, 30 focus, 0.6 s cast)*: After 0.6 s, heals itself and allies within 4.5 m for 100% Support. | **Sanctuary Hymn** *(14 s cd, 30 focus, 0.4 s cast)*: After 0.4 s, consecrates a 3 m circle at an ally for 5 s: allies inside heal 30% Support each second and are 10% Fortified. | **Resonant Voice**: It and allies within 4.5 m regenerate 5% of its Support as HP per second. | Balanced, Choir Circle |
| **Aegis Scribe** `aegis_scribe`<br>healer | Shield healer. Inscribes barriers on threatened allies before the damage lands, and lattices whole groups.<br>*Writes warding sigils so quickly the ink is still wet when the blows land.* | mid · back<br>HP 850, armor 20, ward 35, Power 49, Support 108, 1.2 s, 3.3 m/s | **Sigil Spark** *(6 m)*: Flings a sigil at an enemy within 6 m for 100% Power arcane damage. | **Inscribe Barrier** *(6 s cd, 20 focus, 0.3 s cast)*: After 0.3 s, shields an ally for 200% Support for 5 s. | **Ward Lattice** *(14 s cd, 30 focus, 0.5 s cast)*: After 0.5 s, shields all allies within 4 m of the target ally for 90% Support for 4 s. | **Reinforced Script**: When one of its shields breaks, that ally gains 15% Fortified for 2 s. | Balanced, Pre-emptive |
| **Grovetender** `grovetender`<br>healer | Heal-over-time healer. Keeps rejuvenation running on several allies at once and blooms when the group is hurt.<br>*Talks to the arena moss between rounds; the moss, apparently, talks back.* | close · back<br>HP 850, armor 20, ward 35, Power 49, Support 115, 1.2 s, 3.3 m/s | **Thorn Seed** *(5 m)*: Flicks a seed at an enemy within 5 m for 100% Power arcane damage. | **Rejuvenate** *(4 s cd, 15 focus, 0.2 s cast)*: After 0.2 s, heals an ally for 20% Support every 0.5 s for 5 s. | **Bloomburst** *(12 s cd, 25 focus, 0.5 s cast)*: After 0.5 s, heals allies within 4 m of the target ally for 100% Support. | **Deep Roots**: Its healing is 30% stronger on allies below 50% HP. | Balanced, Evergreen |
| **Vigilkeeper** `vigilkeeper`<br>healer | Death-denying healer. Wards an ally so a lethal blow leaves it standing, and catches allies who drop low.<br>*Keeps a lantern lit for every fighter on its side, and refuses to let one go out.* | mid · back<br>HP 850, armor 20, ward 35, Power 49, Support 105, 1.2 s, 3.3 m/s | **Lantern Flicker** *(5.5 m)*: Flicks lantern-fire at an enemy within 5.5 m for 100% Power arcane damage. | **Vigil** *(18 s cd, 35 focus, 0.3 s cast)*: After 0.3 s, wards an ally for 4 s: the first blow that would down it leaves it at 1 HP and heals it for 100% Support. | **Mend** *(6 s cd, 20 focus, 0.6 s cast)*: After 0.6 s, heals an ally for 180% Support. | **Lamplight**: The first time each ally within 6 m drops below 30% HP in a round, it is healed for 80% Support. | Balanced, Watchful |
| **War Drummer** `war_drummer`<br>healer | Tempo healer. Drums that quicken allies' attacks and steps, and a rally beat that heals and frees allies from slows and roots.<br>*Beats time for the whole line; the line has never once been out of step.* | close · back<br>HP 1000, armor 25, ward 35, Power 78, Support 115, 1.2 s, 3.3 m/s | **Drumbeat Strike** *(4 m)*: Sends a booming beat at an enemy within 4 m for 100% Power arcane damage. | **Quickstep Cadence** *(12 s cd, 30 focus, 0.3 s cast)*: After 0.3 s, it and allies within 5 m gain 25% attack speed and 15% move speed for 4 s. | **Rally Beat** *(8 s cd, 20 focus, 0.3 s cast)*: After 0.3 s, heals it and allies within 4.5 m for 100% Support and removes slows and roots. | **Marching Rhythm**: It and allies within 4 m move 6% faster and regenerate focus 10% faster. | Balanced, Charge Beat |

#### Hybrids

| Class | Identity | Band · row · base | Basic | Active 1 | Active 2 | Passive | Presets |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Siegebreaker** `siegebreaker`<br>tank + melee (tank_dps) | Battering bruiser. Its blows scale with its own max HP; charges into the back line and shrugs off punishment.<br>*Hired to knock down gates; finds people much easier.* | melee · front<br>HP 1350, armor 45, ward 30, Power 82, 1.2 s, 3.4 m/s | **Maul** *(1 m)*: Strikes an adjacent enemy for 80% Power + 1.2% of its own max HP as physical damage. | **Battering Charge** *(11 s cd, 25 focus)*: Charges an enemy within 7 m: 60% Power + 6% of its own max HP physical damage and 1.5 m knockback. | **Iron Hide** *(14 s cd, 20 focus)*: Gains 25% Fortified and 20 armor for 4 s. | **Unbowed**: Below 50% HP, gains 20 armor and deals 15% more damage. | Balanced, Gatecrasher, Breakwater |
| **Pavisier** `pavisier`<br>tank + ranged (tank_dps) | Ranged bulwark. Plants its pavise to become an immovable, heavily armored turret, and shoves off anyone who gets close.<br>*Carries a door-sized shield and a crossbow that needs a door-sized shield.* | mid · front<br>HP 1250, armor 50, ward 35, Power 88, 1.2 s, 3.1 m/s | **Arbalest Bolt** *(6 m)*: Shoots an enemy within 6 m for 100% Power physical damage. | **Plant the Pavise** *(14 s cd, 25 focus)*: Anchors itself for 4 s: cannot move or be displaced, gains 40 armor, 30 ward and 30% attack speed. | **Shield Shove** *(8 s cd, 15 focus)*: Shoves an adjacent enemy for 100% Power physical damage and 3 m knockback. | **Cover**: It and allies within 2.5 m take 10% less damage from enemies more than 4 m away. | Balanced, Battery |
| **Gaoler** `gaoler`<br>tank + controller (tank_controller) | Jailer tank. Shackles enemies in place, stomps to stun crowds, and slows everyone who stays near it.<br>*Has never lost a prisoner, and treats every opponent as one.* | melee · front<br>HP 1400, armor 50, ward 40, Power 75, 1.3 s, 3.2 m/s | **Chain Flail** *(1.5 m)*: Lashes an enemy within 1.5 m for 100% Power physical damage. | **Shackle** *(10 s cd, 20 focus)*: Shackles an enemy within 1.5 m: 80% Power physical damage and rooted for 1.2 s. | **Quake Stomp** *(12 s cd, 30 focus, 0.4 s cast)*: After 0.4 s, stomps: enemies within 3 m take 60% Power physical damage, are stunned 0.6 s and slowed 30% for 2 s. | **Jailer's Reach**: Enemies within 2.5 m are slowed 15%. | Balanced, Warden of the Line, Lockup |
| **Harpooner** `harpooner`<br>tank + controller (tank_controller) | Puller tank. Harpoons a distant enemy and reels it in, taunted; immune to being pushed around itself.<br>*Spent ten years hauling whales; the back line is lighter.* | melee · front<br>HP 1350, armor 45, ward 40, Power 82, 1.25 s, 3.2 m/s | **Boarding Axe** *(1 m)*: Strikes an adjacent enemy for 100% Power physical damage. | **Harpoon** *(12 s cd, 25 focus, 0.3 s cast)*: After 0.3 s, harpoons an enemy within 7 m: 80% Power physical damage, pulls it to the Harpooner and taunts it for 1 s. | **Anchor Slam** *(9 s cd, 20 focus)*: Slams an adjacent enemy for 120% Power physical damage and slows it 40% for 2 s. | **Sea Legs**: Immune to knockback and pull. +15% tenacity. | Balanced, Lifeline, Catch of the Day |
| **Vowknight** `vowknight`<br>tank + healer (tank_healer) | Pain-sharing knight. Part of the damage it takes heals its weakest ally; it lays on hands and consecrates the ground.<br>*Swore a vow to bleed for others, and keeps it with alarming enthusiasm.* | melee · front<br>HP 1250, armor 50, ward 40, Power 72, Support 64, 1.3 s, 3.2 m/s | **Oathblade** *(1 m)*: Strikes an adjacent enemy for 100% Power physical damage. | **Laying of Hands** *(9 s cd, 25 focus, 0.4 s cast)*: After 0.4 s, heals an ally within 5 m for 180% Support and gives it 10% Fortified for 3 s. | **Consecrate** *(13 s cd, 30 focus, 0.3 s cast)*: After 0.3 s, consecrates a 3 m circle around itself for 4 s: each second allies inside heal 25% Support and enemies take 30% Power arcane damage. | **Shared Suffering**: 12% of the damage it takes heals the lowest-HP ally within 6 m (not itself). | Balanced, Oathkeeper |
| **Deeproot Keeper** `deeproot_keeper`<br>tank + healer (tank_healer) | Rooted warden. Takes root to become a fortified healing totem, lashes nearby enemies with thorns, and regenerates.<br>*Was a sapling when the Charter was signed, and is in no hurry.* | melee · front<br>HP 1420, armor 55, ward 40, Power 65, Support 70, 1.4 s, 3 m/s | **Bough Swing** *(1.3 m)*: Swings at an enemy within 1.3 m for 100% Power physical damage. | **Take Root** *(15 s cd, 30 focus)*: Anchors itself for 5 s with 20% Fortified; each second, it and allies within 4 m heal 25% Support. | **Thornlash** *(8 s cd, 15 focus)*: Lashes enemies within 2.5 m for 90% Power physical damage and slows them 30% for 2 s. | **Sapflow**: Regenerates 0.8% of max HP per second; allies within 3 m regenerate 3% of its Support per second. | Balanced, Grove Guard |
| **Netcaster** `netcaster`<br>melee + controller (dps_controller) | Net fighter. Nets enemies in place, lunges for heavy damage on rooted prey, and slows with every hit.<br>*Fights the old way: one net, one trident, no patience for runners.* | melee · front<br>HP 1100, armor 30, ward 25, Power 110, 1 s, 3.6 m/s | **Trident Thrust** *(1.6 m)*: Thrusts at an enemy within 1.6 m for 100% Power physical damage. | **Cast Net** *(11 s cd, 25 focus, 0.2 s cast)*: After 0.2 s, nets an enemy within 4 m: rooted for 1.5 s and slowed 30% for 3.5 s. | **Pinning Lunge** *(7 s cd, 15 focus)*: Lunges at an enemy within 2.5 m for 130% Power physical damage, 50% more against rooted enemies. | **Tangle**: Basic hits slow the target 20% for 1.5 s. | Balanced, Retiarius, Net Guard |
| **Skullslinger** `skullslinger`<br>ranged + controller (dps_controller) | Concussive slinger. Stuns with a cracking shot, sprays slowing shot, and its stones weaken enemies.<br>*Picks its stones for weight and its targets for thickness of skull.* | mid · back<br>HP 840, armor 18, ward 25, Power 78, 1.1 s, 3.4 m/s | **Sling Stone** *(6 m)*: Slings a stone at an enemy within 6 m for 100% Power physical damage. | **Skullcracker** *(10 s cd, 25 focus, 0.4 s cast)*: After 0.4 s, slings a stone for 140% Power physical damage that stuns for 1 s. | **Scatter Shot** *(9 s cd, 20 focus, 0.2 s cast)*: After 0.2 s, sprays a 60° cone within 6 m: 90% Power physical damage and 30% slow for 2 s. | **Concussive**: Every fourth basic hit weakens the target by 15% for 3 s. | Balanced, Headcracker |
| **Leechblade** `leechblade`<br>melee + healer (dps_healer) | Siphoning duelist. Every cut it lands heals its weakest ally; a crimson mist hurts enemies and mends friends.<br>*Its sword drinks; it insists on sharing.* | melee · front<br>HP 1050, armor 30, ward 30, Power 85, Support 55, 1 s, 3.6 m/s | **Leeching Cut** *(1 m)*: Cuts an adjacent enemy for 100% Power physical damage. | **Siphon Strike** *(8 s cd, 20 focus)*: Strikes for 150% Power physical damage and heals the lowest-HP ally within 6 m (itself included) for all the damage dealt. | **Crimson Mist** *(12 s cd, 25 focus, 0.3 s cast)*: After 0.3 s, releases a 3 m mist: enemies take 80% Power physical damage and allies (itself included) heal 60% Support. | **Blood Tithe**: 15% of all damage it deals heals the lowest-HP ally within 6 m (itself included). | Balanced, Bloodletter |
| **Sunlance Acolyte** `sunlance_acolyte`<br>ranged + healer (dps_healer) | Radiant striker. Brands enemies so that allies who hit them heal, and mends allies with dawn light.<br>*Sworn to a dawn-cult that takes its tithes in arena purses.* | mid · back<br>HP 840, armor 18, ward 35, Power 85, Support 70, 1.2 s, 3.4 m/s | **Sunlance** *(6 m)*: Lances an enemy within 6 m for 100% Power arcane damage. | **Searing Brand** *(10 s cd, 20 focus, 0.3 s cast)*: After 0.3 s, burns an enemy for 130% Power arcane damage and Illuminates it for 5 s: allies who damage it heal for 10% of that damage. | **Dawn's Mercy** *(7 s cd, 20 focus, 0.5 s cast)*: After 0.5 s, heals an ally for 160% Support. | **Radiant Zeal**: Deals 15% more damage to Illuminated enemies. | Balanced, Dawnkeeper, Zealot |
| **Undertow Mystic** `undertow_mystic`<br>controller + healer (controller_healer) | Tide mystic. Floods an undertow that slows enemies and heals allies standing in it, and washes allies clean.<br>*Reads the tides in the arena sand, and sometimes drowns people in them.* | mid · back<br>HP 880, armor 20, ward 40, Power 75, Support 114, 1.2 s, 3.3 m/s | **Brine Bolt** *(6 m)*: Hurls brine at an enemy within 6 m for 100% Power arcane damage, slowing it 10% for 1 s. | **Undertow** *(11 s cd, 30 focus, 0.5 s cast)*: After 0.5 s, floods a 2.8 m circle for 4 s: enemies inside are slowed 40% and allies inside heal 10% Support every 0.5 s. | **Cleansing Tide** *(10 s cd, 25 focus, 0.3 s cast)*: After 0.3 s, washes allies within 4 m of the target ally: removes 1 harmful effect from each and heals them 70% Support. | **Ebb and Flow**: When it slows, roots or stuns an enemy, the lowest-HP ally within 6 m heals 20% Support (at most once per 2 s). | Balanced, Riptide Guard |
| **Hourglass Sage** `hourglass_sage`<br>controller + healer (controller_healer) | Time sage. Rewinds an ally's recent wounds, mires enemies in torpor, and speeds up nearby allies' cooldowns.<br>*Carries a cracked hourglass that runs a little differently for everyone near it.* | mid · back<br>HP 880, armor 20, ward 40, Power 65, Support 62, 1.2 s, 3.3 m/s | **Sand Mote** *(6 m)*: Flings sand at an enemy within 6 m for 100% Power arcane damage. | **Rewind Wounds** *(10 s cd, 25 focus, 0.4 s cast)*: After 0.4 s, heals an ally for 70% of the damage it took in the last 4 s (at least 80% Support). | **Torpor Field** *(12 s cd, 25 focus, 0.4 s cast)*: After 0.4 s, mires enemies within 2.5 m of the target: slowed 30% and Sluggish 25% for 3 s. | **Hastened Hours**: It and allies within 4 m recover ability cooldowns 10% faster. | Balanced, Second Chances |

**Availability.** All 42 classes exist from M1 and can appear in generation, rookies and free agency (weighted by race affinity). **Validation:** exactly 6 classes per pure archetype and 2 per hybrid pair; a hybrid's archetypes match its pair; four abilities per class with matching slots; 2–3 presets per class.

### sys-targeting: selectors, Only/Prefer and tie-breaks

**Status / scope:** PROPOSED (P-05, C1.3), M1. No random targets, ever.

**Purpose:** make "who" deterministic and nameable so that every target choice in a report can be explained in one phrase.

**Candidate pools.** *Enemies:* standing enemy units. *Allies:* standing allies, excluding the deciding unit unless the selector's `includeSelf` is true. `densest_ally`, `protect` and `regroup` never pick the deciding unit. *Self:* the deciding unit.

**Selector vocabulary** (`tactics-presets.json` → `vocabulary.selectors`):

| Id | Reads as | Pool | Primary sort | Params |
| --- | --- | --- | --- | --- |
| `self` | myself | self | single unit | — |
| `nearest_enemy` | the nearest enemy | enemies | gap_asc | — |
| `furthest_enemy` | the furthest enemy | enemies | gap_desc | — |
| `lowest_hp_enemy` | the lowest-HP enemy | enemies | hp_pct_asc | — |
| `top_damage_enemy` | the enemy who has dealt the most damage | enemies | damage_dealt_desc | — |
| `enemy_targeting_me` | the nearest enemy attacking me | enemies | gap_asc (filter: targeting_me) | — |
| `enemy_targeting_ally` | the enemy attacking our weakest [{role}] ally | enemies | victim_hp_pct_asc (filter: targeting_an_ally) | role?:role=healer |
| `casting_enemy` | the nearest casting enemy | enemies | gap_asc (filter: casting) | — |
| `densest_enemy` | the enemy at the centre of the biggest group | enemies | neighbours_desc | radiusM:metres=2.5 |
| `captain_target` | our captain's target | enemies | single unit | — |
| `marked_enemy` | the nearest marked enemy | enemies | gap_asc (filter: marked) | — |
| `enemy_role` | the nearest enemy {role} | enemies | gap_asc (filter: role) | role:role=healer |
| `lowest_hp_ally` | the lowest-HP ally | allies | hp_pct_asc | includeSelf:bool=true, withinM?:metres |
| `most_targeted_ally` | the ally under most attack | allies | attackers_desc | includeSelf:bool=false |
| `ally_role` | our {role} | allies | gap_asc (filter: role) | role:role=healer |
| `densest_ally` | the ally at the centre of our biggest group | allies | neighbours_desc | radiusM:metres=4 |
| `captain` | our captain | allies | single unit | — |
| `current_target` | my current target | enemies | single unit | — |

Primary sort keys: `gap_asc`/`gap_desc` compare gaps in mm; `hp_pct_asc` compares trunc(HP × 10,000 / maxHp); `damage_dealt_desc` uses damage dealt this round (visible hits); `victim_hp_pct_asc` sorts enemies by the HP fraction of the ally each one is targeting (the role parameter limits which allies count); `neighbours_desc` counts other units of the same pool within the radius of the candidate's centre; `attackers_desc` counts enemies whose committed target is the ally. `captain_target` is the acting captain's committed enemy target (the deciding unit's own target if it is the acting captain); `current_target` is the unit's own committed target. Either is invalid when that target is not a candidate.

**Only and Prefer** (`vocabulary.predicates`; one per rule, never both, as in 01 §7):

| Id | Reads as | Params | Meaning |
| --- | --- | --- | --- |
| `in_range` | in range now | — | Gap to the target is at or below the action's range (no approach). |
| `within` | within {band} | band:band=close | Gap from me to the target is at or below the band. |
| `hp_below` | below {pct}% HP | pct:int=50 |  |
| `hp_above` | above {pct}% HP | pct:int=50 |  |
| `has_status` | has {status\|category} [x{minStacks}] | status?:status, category?:statusCategory, minStacks?:int=1 |  |
| `lacks_status` | lacks {status\|category} | status?:status, category?:statusCategory |  |
| `has_buff` | has a buff or shield | — |  |
| `role` | is a {role} | role:role=healer |  |
| `not_role` | is not a {role} | role:role=healer |  |
| `not_targeted_by_ally` | not attacked by any ally | — |  |
| `targeting_me` | attacking me | — |  |
| `not_self` | not me | — |  |

ONLY removes candidates that fail the predicate; if none remain, the rule is skipped with reason `no_target`. PREFER moves candidates that pass to the front and never blocks. `in_range` uses the rule's action range: the ability's range, or the basic attack's for attack, kite and hold.

**Tie-breaks (published, PROPOSED as REQUIRED behavior once approved).** After the primary key, in order: (1) **stickiness**: the unit's current target wins if its key is within 1.0 m (gap keys) or 5 percentage points (HP keys) of the best candidate; (2) smaller gap; (3) lower HP fraction; (4) lower lineup slot. All comparisons are exact integers.

**Role references.** A role parameter matches every unit whose class lists that archetype; a hybrid matches both of its roles (open-024). Rules never refer to names (research A3.4), so a preset survives a roster change.

**Friendly fire.** None exists in M1 content: every area lists which side it affects. A future ability that hits both sides must say so in `affects` and carry the `friendly_fire` tag so the M3 lint can warn.

**Edge cases.** A selector over an empty pool, or `captain_target` with no acting captain target, makes the rule skip (`no_target`); the next rule is tried. A target that is downed before release cancels the attack or cast with a refund.

**Acceptance case.** acc-10 (§9).

### sys-tactics: rule engine, presets and traces

**Status / scope:** PROPOSED (R2, P-06, P-07, P-22). The engine and preset format are used by the M1 sim (O14). Editing is FUTURE (M3, sys-tactics-editor).

**Purpose:** fighters act only on rules the player chose (pillar 1), and every choice is explained (pillar 2).

**Rule format.** A rule list is an ordered list of up to 8 rules (M1 presets use 2–4) plus one stance:

`IF <condition> [AND <condition>] THEN <action> ON <selector> [ONLY <predicate> | PREFER <predicate>] [COOLDOWN n s]`

Every condition may carry NOT. Thresholds use 10% steps. JSON shape (`tactics-presets.json` → `presets[].rules[]`):

```json
{ "id": "r2",
  "if": [ { "cond": "ally_hp_below", "pct": 70, "includeSelf": true } ],
  "then": { "type": "ability", "slot": "a1" },
  "on": { "sel": "lowest_hp_ally" },
  "only": null, "prefer": null, "cooldownS": 0 }
```

Preset shape: `{ id: "<classId>_<style>", classId, style: balanced | aggressive | protective, name, summary, stance: aggressive | steady | cautious, rules[] }`. The `summary` is the plain-language line the lineup screen shows (02 §7).

**Condition vocabulary** (`vocabulary.conditions`; "starter" ones are the day-one set for the M3 editor, all are usable in presets):

| Id | Sentence | Params | Starter | Meaning |
| --- | --- | --- | --- | --- |
| `always` | Always | — | yes | Always true. Use as the last rule of a list or for abilities gated only by cooldown and focus. |
| `self_hp_below` | My HP is below {pct}% | pct:int=50 | yes | Own HP fraction is strictly below the threshold. |
| `ally_hp_below` | An ally is below {pct}% HP | pct:int=50, includeSelf:bool=false | yes | At least one standing ally (optionally including me) is strictly below the threshold. |
| `allies_hp_below` | At least {count} allies are below {pct}% HP [within {band} of me] | pct:int=50, count:int=2, band?:band=close | yes | Counts standing allies including me. With a band, only allies within that gap of me count. |
| `enemy_hp_below` | An enemy is below {pct}% HP [within {band}] | pct:int=50, band?:band=long | yes | At least one standing, targetable enemy is strictly below the threshold. |
| `enemy_within` | An enemy is within {band} range | band:band=close | yes | Gap from me to the nearest targetable enemy is at or below the band. |
| `enemies_within` | At least {count} enemies are within {band} range | count:int=2, band:band=close | yes | Surrounded test. |
| `enemies_clustered` | {count}+ enemies are bunched within {radiusM} m | count:int=2, radiusM:metres=2.5 | yes | Some targetable enemy has at least count-1 other enemies whose centres are within radius of its centre. |
| `allies_clustered` | {count}+ allies are bunched within {radiusM} m | count:int=3, radiusM:metres=4 | advanced | As enemies_clustered, for standing allies including me. |
| `self_targeted` | At least {count} enemies are targeting me | count:int=1 | yes | Counts enemies whose current target is me. |
| `ally_targeted` | An ally [{role}] is targeted by {count}+ enemies | count:int=1, role?:role=healer | yes | Some standing ally other than me (of that role, if given) is the current target of at least count enemies. |
| `enemy_casting` | An enemy within {band} range is casting | band:band=long | yes | A targetable enemy within the band is in an ability windup of at least 0.3 s, or channelling. |
| `self_has_status` | I have {status\|category} | status?:status, category?:statusCategory | advanced | Status test on me. |
| `ally_has_status` | An ally has {status\|category} | status?:status, category?:statusCategory | yes | Some standing ally (including me) has the status or a status of the category. |
| `enemy_has_status` | An enemy has {status\|category} [within {band}] | status?:status, category?:statusCategory, band?:band=long | yes | Some targetable enemy has the status or category. |
| `fight_time_below` | In the first {seconds} s of the round | seconds:int=5 | yes | Fight time strictly below the value. |
| `focus_at_least` | My focus is at least {amount} | amount:int=60 | yes | Own focus at or above the amount. |
| `outnumbered` | We have fewer fighters standing | — | yes | Standing allies (including me) fewer than standing enemies. |
| `allies_down` | At least {count} allies are down | count:int=1 | advanced | Counts downed allies this round. |
| `enemy_role_within` | An enemy {role} is within {band} range | role:role=healer, band:band=mid | advanced | Role-based threat test (hybrids match both roles). |
| `captain_alive` | Our captain is standing | — | yes | The acting captain (captain or, after handover, vice-captain) is standing. |

**Action vocabulary** (`vocabulary.actions`):

| Id | Reads as | Params | Target pool | Behaviour |
| --- | --- | --- | --- | --- |
| `attack` | Attack | — | enemies | Basic-attack the target, moving into range first. |
| `ability` | Use {slot} | slot:slot | ability | Use the ability in that slot on the target. The pool must match the ability's target type. |
| `kite` | Keep away ({band}) | band:band=close | enemies | Keep the gap to the target above the band while basic-attacking whenever the target is in range. |
| `hold` | Hold position | — | any | Do not move; basic-attack the target if in range, else the nearest enemy in range. |
| `protect` | Protect | — | allies_not_self | Stand between the ally and its nearest attacker and basic-attack enemies in range, preferring the ally's attackers. |
| `regroup` | Stay with | — | allies_not_self | Move to within 2.5 m of the ally, then hold there and basic-attack enemies in range. |

**Stances** (the unremovable fallback, always valid while an enemy stands):

- `aggressive` (**Aggressive**): Attack the nearest enemy, closing in as needed.
- `steady` (**Steady**): Attack the nearest enemy, but do not advance more than 1 m past our frontmost ally unless an enemy is already in range.
- `cautious` (**Cautious**): Attack the nearest enemy in range, keeping a gap of at least 60% of attack range (min 2.5 m) by backing away when closer.

**Resolution procedure (one evaluation).**
1. If the unit is stunned, asleep, displaced, or mid-windup, mid-cast or mid-channel, it does not evaluate. If it is Taunted, the decision is forced to "attack ON the taunter" (trace reason `taunted`).
2. Walk the rules top-down. For each rule, the first failing check is its skip reason:
   `rule_cooldown` (the rule's own COOLDOWN is running) → `cond_false` (a condition is false; the trace records which one and the observed value) → `cooldown` (the ability is cooling down; trace gives seconds left) → `no_focus` → `silenced` → `no_target` (selector or ONLY empty) → `out_of_range` (ability with `approach: false` and target beyond range).
3. The first rule that passes **fires**: its action, target and rule index become the evaluation result. If none passes, the stance fires.
4. **Commit with reaction delay (P-06).** If the result equals the committed decision (same rule, action and target), nothing changes. Otherwise it becomes pending and commits after the unit's reaction delay plus jitter (sys-combat-stats). While pending, the unit keeps doing its committed action if it is still valid, otherwise it holds still. If later evaluations change the pending result, it is replaced without restarting the timer; if they return to the committed decision, the pending one is dropped. The first decision of a round commits after the seeded opening stagger instead; forced (taunt) decisions commit at once.
5. A rule's COOLDOWN starts when its action releases (attacks, abilities) or when a movement rule (kite, hold, protect, regroup) stops being the committed rule.

Rules never skip, reorder or misfire on stats or traits (P-06). The only things that can override a rule are visible statuses (taunt, stun, sleep, silence, displacement), and each is named in the trace.

**Preset catalog.** 105 presets (42 balanced, 30 protective, 33 aggressive), 295 rules, 2.8 rules per preset on average. Every class has a `balanced` preset (its default); classes whose identity supports it add `aggressive` and/or `protective` variants under class-flavoured names. Examples (generated):

```text
Oathguard — Balanced (oathguard_balanced): "Bashes casting enemies, guards the most-threatened ally, then fights the nearest enemy."
  R1  IF enemy_casting band=melee THEN ability a2 ON casting_enemy ONLY in_range   [Shield Bash]
  R2  IF ally_targeted count=2 THEN ability a1 ON most_targeted_ally   [Interpose]
  R3  IF ally_hp_below pct=50 THEN ability a1 ON lowest_hp_ally includeSelf=false   [Interpose]
  R4  IF always THEN ability a2 ON nearest_enemy ONLY in_range   [Shield Bash]
  STANCE aggressive

Chirurgeon — Balanced (chirurgeon_balanced): "Cleanses stunned allies, sutures anyone below 70%, and cleanses heavy debuffs."
  R1  IF ally_has_status category=cc_hard THEN ability a2 ON lowest_hp_ally ONLY has_status category=cc_hard   [Purging Tincture]
  R2  IF ally_hp_below pct=70 includeSelf=true THEN ability a1 ON lowest_hp_ally   [Suture]
  R3  IF ally_has_status category=debuff THEN ability a2 ON lowest_hp_ally ONLY has_status category=debuff   [Purging Tincture]
  STANCE cautious

Gutterknife — Healer Hunter (gutterknife_aggressive): "Goes straight for the enemy healer and stays on it."
  R1  IF always THEN ability a1 ON enemy_role role=healer ONLY within band=long   [Shadowstep]
  R2  IF always THEN ability a2 ON enemy_role role=healer ONLY in_range   [Hamstring]
  R3  IF always THEN attack ON enemy_role role=healer
  STANCE aggressive

Writ Hunter — Balanced (writ_hunter_balanced): "Keeps a writ on the captain's target, nets anyone who closes in, and shoots the marked enemy."
  R1  IF NOT enemy_has_status status=marked THEN ability a1 ON captain_target   [Post the Writ]
  R2  IF NOT enemy_has_status status=marked THEN ability a1 ON lowest_hp_enemy   [Post the Writ]
  R3  IF enemy_within band=close THEN ability a2 ON nearest_enemy   [Weighted Net]
  R4  IF enemy_has_status status=marked THEN attack ON marked_enemy ONLY in_range
  STANCE cautious
```

**Preset selection in M1.** The lineup screen lists the class's presets with their summaries; the default is pre-selected. AI managers pick per fighter: `balanced` unless their profile prefers a style (sys-ai-manager owns the profile; recommendation: profiles carry a preferred style per archetype and never switch reactively against the player, P-04).

**Decision trace (P-22).** On every committed decision change the sim records:

```json
{ "type": "unit.decide", "tick": 248, "unit": 7,
  "data": { "pick": { "rule": 3, "action": "attack", "target": 2, "stance": "cautious" },
            "reactTicks": 7, "reactCauses": ["pressure"], "commitTick": 255,
            "trace": [ { "rule": 0, "result": "skip", "reason": "cond_false", "cond": 0, "observed": "none" },
                       { "rule": 1, "result": "skip", "reason": "cooldown", "readyInTicks": 36 },
                       { "rule": 2, "result": "skip", "reason": "cond_false", "cond": 0, "observed": "none" } ] } }
```

The pick's `rule` index equals the number of rules when the stance fired. Rendered: "Stance (cautious) fired: attack the nearest enemy · R1 skipped: no ally has hard control · R2 skipped: Suture ready in 1.8 s · R3 skipped: no ally has a debuff · reacted after 0.35 s (under pressure)". At record level `full` every trace is kept (the M2 inspector shows the latest at the paused tick). At `summary` only counters are kept: per rule, fires, ticks as the committed rule, and skips by reason.

**Edge cases.** A rule whose target dies between commit and release: the action cancels (refund) and the unit re-evaluates at once. Two rules with the same action and target count as one decision (no reaction delay when only the rule index changes). The stance never evaluates conditions, so a list can never end with nothing to do while an enemy stands; `hold` with no enemy in range is a legitimate idle the player chose.

**Acceptance cases.** acc-01 (taunt override), acc-09 (trace reasons).

### sys-fight-ai: executing actions beneath the rules

**Status / scope:** PROPOSED, M1.

**Purpose:** turn the committed action into movement and timing that looks competent (research C2.1).

**Behaviors.**
- **attack / ability:** move until the gap is the range − 0.1 m (if `approach`), then start when ready. Basic attacks continue on the committed target each time the swing is ready.
- **kite (band):** keep the gap to the target above the band: if the gap is at or inside the band, step directly away (sliding along walls); otherwise basic-attack whenever ready and in range; if the target is beyond attack range, approach but never inside the band.
- **hold:** never move; attack the selected target if in range, else the nearest enemy in range.
- **protect (ally):** stand between the ally and its attacker (an enemy targeting it, else the enemy nearest it), 0.3 m outside both bodies; once within 0.5 m of that point, attack the attacker if in range, else the nearest enemy in range.
- **regroup (ally):** move until the gap to the ally is ≤ 2.5 m, then behave as hold.
- **Stances** as in sys-tactics. *Steady* never moves more than 1 m east (home) or west (away) of the frontmost standing ally unless an enemy is already in its attack range; a unit that is itself the frontmost behaves as aggressive.
- **Anti-stuck:** if a unit trying to approach gains less than 0.2 m on its target over 1 s, its sidestep side flips for the next second. This changes only steering, never the rule chosen.

**No useful action.** When no enemy is standing the round has ended. When every enemy is out of reach of a `hold` unit, it idles by the player's choice; QA detectors (not in-game overrides) count idle time.

**Telegraphing and counterplay.** Casts and channels of 0.3 s or longer are visible (`enemy_casting`, `casting_enemy`) and interruptible. Hard control is short, shares one DR track and is capped at 2.5 s. Zones and traps are visible circles.

### sys-fight-traits: in-fight effects of traits

**Status / scope:** PROPOSED (O5; boundary contract 3), M1. The trait catalog belongs to the lifecycle designer (`traits.json`); this system defines what the combat-owned effect types do.

**Procedure.**
1. Lifecycle-owned effects (`stat`, `statGroup`, `contextStat`, chemistry) are already in the effective stats the fight receives.
2. Each combat-owned trait effect becomes modifiers through `combat.json` → `traitEffectAdapter`:
   - `combat` {when, value | seconds, mods}: one stat mod per mod key, with predicate always → none; selfHpBelow(v) → `self_hp_below` pct = 100v; targetHpBelow(v) → `target_hp_below`; openingSeconds(s) → `fight_time_below`; afterSeconds(s) → `fight_time_at_least`; allyDown(s) → `ally_downed_within` (true for s seconds after any ally is downed). Mods: damageDealtMult m → damageDealt + (m − 1); damageTakenMult m → damageTaken + (m − 1); reactionDelayMult m → reactionDelay + (m − 1); composureAdd → composure.
   - `enemyComposureAura` {rangeBand, add}: an aura on enemies within the band, composure + add.
   - `shakenImmune` {mult}: multiplies negative composure from Shaken and from allyDown-conditioned mods.
   - `captainRally` {mult}: as acting captain, rally composure × mult (truncated) and rally duration × mult.
3. Trait-sourced modifiers per stat are summed and capped (±0.15 fractions, ±8 composure). They never alter rule evaluation (P-06).

**Example (EXAMPLE).** Hot Blood at 40% HP: damageDealt + 0.08 while below 50%. Skittish after an ally falls: composure −8 for 4 s → CMP 12 becomes 4: tenacity drops from +4% to −12%, and the pressure part of its reaction delay rises.

### sys-fight-captain: the captain in the fight

**Status / scope:** PROPOSED (O6, open-011); adopts the lifecycle designer's in-fight proposal. Values PROPOSED · TUNABLE (`combat.json` → `captain`, `development.json` → `captaincy.grades`).

**Inputs.** The lineup's acting captain and optional vice-captain (sys-roster/sys-captaincy decide who), and every fighter's captain quality (CQ, 0–100) from sys-captaincy.

**Rules.**
1. **Aura:** while the acting captain stands, every fielded ally (captain included) gets composure + grade.auraComposure (−1 to +2 by grade).
2. **Rally:** the first time in a round that an ally other than the acting captain is downed while the acting captain stands, all standing allies gain Rallied: composure + grade.rallyComposure for 5 s, and allyDown-conditioned negative trait mods are suppressed for that time. One use per round; an unused rally carries over to a successor captain.
3. **Captain down:** the aura ends; all allies gain Shaken (composure −1) for 4 s.
4. **Handover:** when Shaken ends, the vice-captain if fielded and standing, otherwise the standing ally with the highest CQ (ties: lower slot), becomes acting captain with CQ − 10 for the rest of the round (grade recomputed).
5. **Captain's target:** the `captain_target` selector follows the acting captain's committed target, giving presets a focus-fire hook. FUTURE M2: calls go through the captain.
6. **Cap:** captain-sourced modifiers may not change any combat quantity by more than 10% (lifecycle requirement). With this draft's coefficients +2 composure is +4% tenacity and about −0.01 s reaction delay, inside the cap.

**Player information.** The captain marker is always visible; reports show rally and captain-down moments and the handover.

### sys-match: rounds, seeds and results

**Status / scope:** PROPOSED (P-02, P-05, open-010), M1.

**Inputs** (05 draft §3.3, completed): `MatchInput { seed, bestOf, home: SideInput, away: SideInput, content }`; `SideInput { clubId, captainIndex, viceCaptainIndex | null, fighters[5] }`; `FightFighterInput { fighterId, classId, raceId, row, slot, stats: Record<StatId, int 1–20>, captainQuality: int 0–100, traitIds, presetId | rules, combatMods? }`. Ability ids come from the class.

**Procedure.**
1. For round n = 1, 2, …: round seed = `deriveSeed(matchSeed, 'round', n)`; reset HP, focus, cooldowns, statuses, shields, zones, positions and captaincy; simulate (sys-fight-sim).
2. Stop when a side has won a majority of `bestOf` (2 of 3; 3 of 5 in finals). Rounds are never drawn (the tiebreak chain always ends in a winner).
3. M1: lineup, captain, rows and presets are fixed for the whole match (open-010). FUTURE M3: tactics may change between rounds as new inputs.

**Outputs** (combat → management contract 2 in 03 §2): per round `{ winner, endReason: elimination | time-limit, tiebreakStep | null, durationTicks, survivors, finalHp[10], checksum, eventHash }`; per fighter `FighterMatchStats` (schema notes below) including rounds played, ticks on the arena, downs suffered and inflicted, assists, damage dealt and taken (to HP and to shields), healing and shielding done, overheal, hard-CC applied and received (s), casts per ability, rule fires per rule and the stance, rules never fired, opponents faced, and every down with its cause (round, tick, credited unit, ability, size of the downing hit, overkill, damage taken that round) for sys-injury.

### sys-match-report: event stream and explanations

**Status / scope:** PROPOSED (O12, P-22), M1 summary level; FUTURE M2 full level for the viewer.

**Envelope** (architect's `SimEvent`): `{ seq, tick, type, unit?, target?, data? }`. Header per round: format, engine version, content hash, round seed, tickMs 50, frameEvery 2, arena in cm, units (index, side, fighterId, clubId, classId, slot, isCaptain).

**Event types** (data fields; level at which recorded: S = summary, F = full):

| Type | Data | Level |
| --- | --- | --- |
| `fight.start` | units: { unit, x, y (cm), hp, maxHp, focus, derived summary } | S |
| `frame` | u: [x, y, hp] per unit (cm) every 2 ticks | F |
| `unit.decide` | pick, reactTicks, reactCauses, commitTick, trace | F (counters at S) |
| `attack.start` / `attack.cancel` | windupTicks / reason | F |
| `cast.start` | ability, castTicks | F |
| `cast.release` | ability, focusSpent, cooldownTicks | S for actives, F for basics |
| `cast.interrupt` | ability, by, cause (stun, silence, …) | S |
| `projectile.launch` | ability, landTick | F |
| `hit` | ability, amount, toShield, overkill, damageType, crit, guardRedirect?, preMitigation | F (aggregated at S) |
| `evade` | ability | F |
| `heal` / `shield.gain` / `shield.break` | ability, amount, overheal / amount, expiresTick / — | F |
| `status.apply` / `status.expire` / `status.resist` | status, ability, durationTicks, magnitude, stacks, drStep / — / reason (`dr_immune`, `below_min`, `immune`) | F (CC at S) |
| `displace` | kind (dash, leap, knockback, pull), from, to, ticks | F |
| `zone.spawn` / `zone.trigger` / `zone.expire` | ability, x, y, radius / unit / — | F |
| `deathward.save` | by, healed | S |
| `captain.rally` / `captain.down` / `captain.handover` | composure / — / newCaptain, cq | S |
| `overtime.start` | — | S |
| `unit.down` | by, ability, hit, overkill, assists | S |
| `fight.end` | winner, reason, tiebreakStep | S |
| `round.summary` | per-unit recap counters (below) | S |

**Recap (per fighter per round, P-22).** Damage dealt (to HP and shields), damage taken, healing done, shielding done, overheal, hard-CC applied and received (s), downs and assists, focus spent, casts per ability, for each rule: fires, ticks committed, skips by reason; ticks on the stance; rules that never fired (highlighted).

**Death summary.** For each down: who credited, the ability, the last three hits taken with sources, active debuffs, and whether a heal or shield arrived in the last 2 s.

**Match report content the UI needs (M1, for document 04).** Score and per-round winner, duration and end reason (with tiebreak step if any); a key-event timeline (downs with cause, active casts, interrupts, deathward saves, rallies, overtime); per-fighter recap cards with rule-fire bars labelled by the preset's rules; "never fired" warnings; MVP candidate data (damage, healing, downs).

**Determinism (T4, vis-009).** The event hash is identical for identical inputs at a given level, and the round checksum (final state) is identical at every level.

## 4. Cross-system interactions

| Trigger / combination | Conditions | Resolution order | Result | Edge cases |
| --- | --- | --- | --- | --- |
| Lethal damage and a heal on the same tick | Both land on tick t | Summed at commit | The fighter survives if HP − damage + heal > 0 | Order-independent by construction |
| Lethal damage on a Deathwarded fighter | Ward active at start of tick | Commit: ward check before downs | HP 1 + ward heal; ward removed | A second lethal hit on a later tick downs normally |
| Stun during a cast | Cast in progress | Status applies at commit; the cast is cancelled at once | No focus spent, no cooldown | Channels keep ticks already applied |
| Taunt then stun | Both on the same unit | DR track shared | Second effect at 0.6 duration | Taunt ends if the taunter is downed |
| Guard + area damage | Guarded ally inside an AoE | Per instance, step 7 | Each instance splits separately | Guardian out of radius: no split |
| Thorns vs Riposte | Bladeturner hits Briarback | Thorns on Briarback's side only | Reflect lands next tick | Reflected damage never reflects again |
| Pull into a trap | Galeshaper Downdraft over a Bear Trap | Displacement then trap trigger on the next ticks | Trapped enemy rooted | Trap arms 0.3 s after placement |
| Mark + Vulnerable | Writ Hunter and Hexmonger on one target | Different statuses add in damage-taken | +15% and +15% | Two Vulnerables from different sources: strongest only |
| Silence vs passive triggers | Silenced unit | Passives still work | Only actives are blocked | — |
| Downed target vs projectile | Target downed while a bolt flies | On landing the target is gone | Projectile fizzles, no refund | Area projectiles still explode at the last known point |
| Anchored vs knockback | Pavisier planted | Displacement skipped | No movement; DR track not advanced | — |
| Overtime + healing | t ≥ 45 s | Healing × max(0, 1 − 0.03k) | Long stalemates resolve | Shields scale the same |

## 5. Autonomous behavior

- **Agent goals:** each fighter executes its rule list; there is no hidden goal or personality.
- **Available information:** fight-observable state only (03 §1), the same for AI and player fighters.
- **Legal capabilities:** identical for every club (P-04).
- **Decision priorities:** first valid rule top-down, then the stance.
- **Timing / response limits:** evaluation every 2 ticks; reaction delay 0.15–0.6 s plus 0–2 ticks of jitter; forced decisions (taunt) immediate.
- **Difficulty differences:** none in M1. FUTURE M7 difficulty must not change fight rules (sys-difficulty works through management levers).
- **No useful action:** stance fallback; `hold` may idle by choice.
- **Telegraphing and counterplay:** visible casts, short DR-limited control, visible zones, published targeting.
- **Representative situations (EXAMPLE).** A Longeye with Balanced: an Oathguard closes to 3.5 m → R1 `enemy_within close` fires Leap Back → it lands 4 m further away and resumes Aimed Shot on the lowest-HP enemy. A Chirurgeon with Triage and no ally below 40%: R1 skips, R2 skips, R3 needs 60 focus and fires only when focus allows, otherwise R4 keeps it within 2.5 m of the tank.

## 6. Content model

| Family | Shared properties | Behaviors | Player-facing identity | M1 quantity |
| --- | --- | --- | --- | --- |
| Attribute | id, name, abbr, group, lifecycle tag, uses | sys-combat-stats | 12 stats on 1–20 | 12 |
| Class | schema in sys-abilities | all combat systems | 42 kits | 42 (O8) |
| Ability | schema in sys-abilities | sys-abilities, sys-fight-sim | 4 per class | 168 |
| Status | id, category, DR, stacking, stat, cap, blocks | sys-abilities | Icons and names | 34 |
| Preset | id, classId, style, name, summary, stance, rules | sys-tactics | 2–3 per class | 105 |
| Vocabulary | conditions, selectors, predicates, actions, stances, roles, bands | sys-tactics | Sentence fragments for UI | 21 / 18 / 12 / 6 / 3 / 5 / 4 |

**Presentation requirements (document 04).** Icon placeholders: `class_<id>`, `abl_<abilityId>`, `st_<statusId>`, `arch_<archetype>`; attribute ids double as icon keys (`attr_<id>` recommended). Every class has a flavour line and a two-line description; every ability a one-sentence description with its numbers; every preset a summary sentence; every vocabulary entry a sentence label with `{param}` slots.

**Prototype content set (M1).** All 42 classes, 168 abilities, 34 statuses, 105 presets and the full vocabulary. Ready when the loader validates them (zero errors) and the harness of §8 runs them.

## 7. Levels, encounters, or challenge structure

- **Authored versus generated:** one authored arena (open-019); opponents are other clubs' lineups under the same rules.
- **Required setup:** 5 v 5, rows per sys-arena, both sides at full HP and focus.
- **Objective structure:** eliminate the other side, or lead the tiebreak at the cap; win 2 of 3 rounds (3 of 5 in finals).
- **Challenge escalation:** opponent quality by tier (03 §1 tier bands); no difficulty modifiers in M1.
- **Environment interactions:** walls only.
- **Validity criteria:** spawns inside the arena and non-overlapping; every round terminates by tick 1,500.

## 8. Balance and tuning

**Reference situation.** All attributes 10, CQ 50 (grade "adequate"), default presets, human race, no traits; lineup tank + melee + ranged + controller + healer, front row tank and melee.

**Design targets (PROPOSED · TUNABLE; evidence: the harness below).**

| Target | Value |
| --- | --- |
| Time to down a back-liner (ranged DPS, 780–820 HP) focused by one melee and one ranged DPS | 4–7 s |
| Time to down a tank focused by the same pair | 12–20 s |
| Fight length (5 v 5, reference and random legal lineups) | median 25–35 s; P10 ≥ 15 s; P90 ≤ 50 s |
| Fights reaching overtime (45 s) / the hard cap (75 s) | ≤ 25% / ≤ 1% |
| Home-side win rate | 49–51% |
| Archetype win share (pure classes, mirrored pairs) | 47–53% each |
| Class win rate (fighter-rounds won / played, random legal lineups) | 45–55% each (TUNABLE band) |
| Preset style (balanced / aggressive / protective) across all classes | none ≥ 55% (no dominant script, vis-002) |
| Stat gap | +1 average attribute (≈ +5 rating) → 58–65% win rate; +3 → 75–85% |
| Tailored preset against a known opponent vs defaults at equal rating | ≥ 60% (vis-002) |
| Hard-CC uptime on any unit | ≤ 25% of its fight time on average; median single CC ≤ 1.5 s |
| Healing done / damage dealt per fight | ≤ 25% average; overheal ≤ 35% of healing |
| Idle time per unit (no action and no movement, excluding chosen `hold`) | ≤ 5% |

**Tuning record.** *Draft pass (estimate only):* a budget estimate at all-10 attributes showed mirror fights dragging past 45 s, so every base Power was raised 25% and a few outliers were trimmed.

*Balance pass 1 (harness, sim `m1/wp1-combat` fa490e1, mode random-draft, 3,000 fights, seed balance-1; confirmed on seed balance-2).* Applied WP1's first-run proposals: all base Power ×1.3; pure-tank HP ×0.9; Longeye Power down; Clangor taunt 1.0 s; Hollow Ring 15/15; Bloodrush cap 25%; Thick Blood 0.5%; Interpose 30%; controller and War Drummer Power up. Then: War Drummer presets lost their always-on `regroup` (it parked out of its 4 m range) and now fight on the steady stance; Gongbearer's Rabble-Rouser hits the weakest enemy within close range instead of chasing the furthest; five measured rounds of per-class base HP/Power/Support (`tuning.js` in the build) plus kit tweaks: Brace 14%, Rejuvenate 20% Support per tick, Bloomburst and Rally Beat 100% Support, Torpor slow 30%; Blightbrewer's Rupture now fires at 2 poison stacks and Grovetender's Bloomburst at 2 hurt allies.

| Measure | Before (committed content, fa490e1) | After pass 1 |
| --- | --- | --- |
| Tank / controller / healer / melee / ranged / hybrid win % | 63.4 / 35.9 / 46.3 / 49.2 / 54.0 / 50.3 | 54.9 / 45.1 / 46.2 / 49.9 / 52.8 / 50.4 |
| Best classes | Longeye 72.5, Gongbearer 71.7, Scarhide 67.4, Phalanx Sergeant 64.2, Oathguard 63.3 | Hourglass Sage 61.7, Vowknight 58.8, Headsman 58.6, Longeye 57.8, Bloodhowler 57.7 |
| Worst classes | War Drummer 26.4, Galeshaper 32.0, Snaresetter 32.9, Hushweaver 34.3, Dreamthief 35.0 | Undertow Mystic 39.6, Cantor 41.7, Netcaster 42.0, War Drummer 42.1, Gaoler 42.3 |
| Fight length median (P10–P90) | 41.0 s (28.9–59.9) | 32.7 s (24.2–48.6) |
| Overtime / time cap | 38.5% / 1.6% | 15.0% / 0.1% |

Open after pass 1: Hourglass Sage stays near 61–62% across seeds (its cooldown aura, not its Support, carries it); Thunderclap and Tumble Shot are rarely cast (point-blank escapes, by design). WP1's in-flight sim changes may shift these numbers; re-check after integration.

**Key parameters.**

| Parameter ID | Meaning / unit | Initial value | Allowed range | Intended effect | Evidence needed to change |
| --- | --- | --- | --- | --- | --- |
| tune-cmb-01 | HP per Toughness point | 4% | 2–6% | Durability matters without dominating | Stat-gap win curve |
| tune-cmb-02 | Power / Support per weighted point | 4% | 2–6% | Same | Stat-gap win curve |
| tune-cmb-03 | Attack speed per Agility point | 2.5% | 1.5–4% | Tempo stat | Class win rates |
| tune-cmb-04 | Focus regeneration | 2.5/s, +3%/DIS | 1.5–4/s | Rule order as an economy | Ability usage, never-fired rules |
| tune-cmb-05 | Damage variance | ±4% | 0–8% | Mild variety | Mirror-match win-rate spread |
| tune-cmb-06 | Crit multiplier | 1.5 | 1.25–2.0 | Precision value | Class win rates |
| tune-cmb-07 | CC DR steps / window | 1.0, 0.6, 0.35, 0 / 6 s | steps ±0.15, 4–8 s | Short, readable control | CC uptime |
| tune-cmb-08 | Max hard-CC duration | 2.5 s | 1.5–3 s | Same | CC uptime |
| tune-cmb-09 | Overtime ramp | +3% damage, −3% healing per s from 45 s | 2–5% | Ends stalemates | Overtime and cap rates |
| tune-cmb-10 | Reaction delay base / AWR / CMP | 0.30 s, −0.01, −0.005 per point | base 0.2–0.4 | Mental stats matter, never block | Report readability |
| tune-cmb-11 | Shield cap | 50% of max HP | 30–60% | Prevents immortal fighters | Overheal, fight length |
| tune-cmb-12 | Class base values and ability coefficients | data files | ±30% per value per pass | Class parity | Harness outliers |
| tune-cmb-13 | Decision interval | 2 ticks | 1–4 | Responsiveness vs CPU | 2 ms/round budget |

**Balance harness specification** (`npm run balance`; stream `STREAM.balance`).
1. **Passes.** A: all attributes 10, default presets (class purity test). B: tier-typical attributes (each attribute drawn around the class's emphasis, sides matched within ±1 mean rating), random presets among each class's own. C (vis-002): fixed reference lineups with default presets against the same lineups with a hand-tailored preset set.
2. **Lineups.** Random legal lineups: 5 classes drawn uniformly from 42, at most 2 of one class, at least one front-row starter, default rows, random captain with CQ 50 (pass B: CQ 30–80).
3. **Mirroring.** Each pair of lineups plays twice with the same round seed and sides swapped.
4. **Volume.** Default 20,000 rounds per pass (TUNABLE); about 40 s at the 2 ms budget.
5. **Metrics.** Per class (and per archetype, hybrid pair and preset): win rate with a Wilson 95% interval, pick count, damage, healing, CC applied and received, downs, average lifetime; per ability: casts per round, share of rounds never cast; per preset rule: fire rate, never-fired share; fight duration P10/P50/P90, overtime and cap rates, tiebreak-step frequencies, home win rate; detectors for idle time, overheal, overkill, frozen units (no position change for 5 s while an enemy is in range of neither side's actions); class-pair synergy and counter matrices (top 10 outliers each); ms per round.
6. **Flags.** Class win-rate interval entirely outside 45–55%; archetype outside 47–53%; home win rate outside 49–51%; overtime > 25% or cap > 1%; an ability never cast in > 50% of its class's rounds; a preset rule never fired in > 80% of rounds; a style ≥ 55%; median ms per round > 2.
7. **Output.** JSON report plus a text summary; non-zero exit in CI mode when any flag fires (TUNABLE).

**Dominant-strategy risks.** Double-healer turtles (watch healing share and overtime rate; counter: Festering, Hushweaver, overtime); stacked hard control (DR and the 2.5 s cap); back-line dive compositions against unprotected healers (protect presets, Oathguard, Harpooner); all-arcane lineups against armor-heavy tanks (ward values and Runecleaver costs).
**Snowball / stalemate boundaries.** Early downs snowball by design; overtime prevents stalemates; no fight may exceed 75 s.
**Deliberate asymmetry.** Casters and healers age more gently (mental Power and Support); arcane ignores armor; long-range classes are fragile.

## 9. Mechanical acceptance scenarios

| ID | Initial state | Action / events | Exact expected outcome | Rule IDs | Milestone |
| --- | --- | --- | --- | --- | --- |
| acc-det-01 | Any two lineups, match seed `"a1b2c3d4e5f60718"`, record `full` | Simulate the match twice in separate processes | Identical round winners, durations in ticks, final HP of all 10 units, event hashes and checksums | sys-fight-sim, sys-match (T4, vis-009) | M1 |
| acc-det-02 | Same inputs | Simulate at record `none`, `summary` and `full` | Identical checksums and results at all three levels; no RNG draw depends on the level | sys-match-report | M1 |
| acc-01 | Gutterknife (CMP 12, tenacity 4%) attacking a Longeye, its centre 3.8 m from the Gongbearer | Gongbearer releases Clangor (3.5 m) catching the Gutterknife | Gutterknife Taunted for trunc(20 × 0.96) = 19 ticks (0.95 s): its decision is forced to attack the Gongbearer at once (trace reason `taunted`), no rule is evaluated until it ends; the DR track records step 1 | sys-tactics, sys-abilities | M1 |
| acc-02 | Twinfang, CMP 10 | Stuns at 10.00 s (Skullcracker 1.0 s), 11.50 s (Shield Bash 0.8 s), 12.50 s (Daze Pulse 0.6 s); root at 13.00 s (Rime Nova) | Durations 20, trunc(16 × 0.6) = 9 and trunc(12 × 0.35) = 4 ticks; the root is resisted (`dr_immune`); a control effect applied at or after 18.50 s gets full duration | sys-abilities (DR) | M1 |
| acc-03 | Bloodhowler (Power 90) and Briarback (all 10s; armor 80 incl. passive) with Bristle active (+20 armor, thorns 0.15 + 0.40) | One Rending Axe basic, no crit, variance 0 | Briarback takes 90 × 100/200 = **45**; next tick the Bloodhowler takes 0.55 × 90 = 49.5 × 100/125 = **39** reflected physical damage | sys-abilities (thorns) | M1 |
| acc-04 | Longeye at 50/780 HP | Same tick: Gutterknife Shadowstep (160% × 110 = 176, Unseen Angle +25% = 220, armor 15 → 191) and Chirurgeon Suture (220 × 1.3 below 35% = 286) | HP = 50 − 191 + 286 = **145**: Longeye stands. If the Suture lands one tick later, Longeye is downed | sys-fight-sim (commit) | M1 |
| acc-05 | Longeye (armor 15, all 10s) inside the Oathguard's Sworn Shield aura and Guarded by its Interpose (Oathguard armor 68, Fortified 15%) | Headsman (STR 14, Power 160) Heavy Chop, no crit, variance 0 | Split 30%: Oathguard takes 48.00 × 0.85 × 100/168 → **24**; Longeye takes 112.00 × 0.92 × 100/115 → **89** (without guard and aura: 139) | sys-abilities (guard, auras) | M1 |
| acc-06 | Longeye 0.5 s into Aimed Shot (1.0 s cast), 100 focus | Hushweaver releases Hush | Cast interrupted (`cast.interrupt`, cause silence): focus stays 100, Aimed Shot not on cooldown; Longeye Silenced 30 ticks; it may basic-attack meanwhile; its trace shows `silenced` for the Aimed Shot rule | sys-fight-sim, sys-tactics | M1 |
| acc-07 | Ally at 40 HP with Vigil (Vigilkeeper Support 105) | A 300-damage hit lands | At commit HP would be −260 → HP set to 1, then healed 105 → **106**; `deathward.save`; ward removed; a later lethal hit downs normally | sys-abilities (Deathward) | M1 |
| acc-08 | Tick 1,500 reached; home: 2 standing at 400/1500 and 300/850; away: 2 standing at 900/1100 and 50/800 | Time cap | Standing 2–2 → HP-fraction sums 2666 + 3529 = 6195 vs 8181 + 625 = 8806 → **away wins**, `tiebreakStep: hp_fraction_sum` | sys-fight-sim (round end) | M1 |
| acc-09 | Chirurgeon (Balanced) at 12.40 s; lowest ally 66% HP; Suture ready in 1.8 s; no ally has a debuff or hard control | Decision evaluation | Trace: R1 skip `cond_false` (no ally has hard control); R2 skip `cooldown` (readyInTicks 36); R3 skip `cond_false`; stance `cautious` fires attack on the nearest enemy | sys-tactics | M1 |
| acc-10 | Two enemies at gaps 3.40 m and 3.40 m (slots 1 and 3), the unit's current target is slot 3 | `nearest_enemy` evaluation | Slot 3 is kept (stickiness); if the unit has no current target, slot 1 is chosen (lower slot) | sys-targeting | M1 |
| acc-11 | Spawn of 3 front + 2 back for each side | Kickoff | Home front (9, 6), (9, 9), (9, 12), back (5, 7.5), (5, 10.5); away mirrored at x = 23 and 27 | sys-arena | M1 |
| acc-12 | Any round | Run to completion | Ends by tick 1,500; every fighter's ruleFires sum to its committed decisions | sys-fight-sim, sys-tactics | M1 |

## 10. Open decisions and completion check

Open items for 01 §8 (proposed IDs; see "Owner confirmations needed"): cmb-q1 … cmb-q12; conflicts cmb-c1 … cmb-c4 (§0.3).

- [x] Every prototype action has legality, cost, result and failure behavior (sys-fight-sim timing rules, sys-tactics skip reasons).
- [x] Units, timing, rounding, randomness and precedence are explicit (§1, sys-fight-sim).
- [x] Important rules have worked examples with concrete values (stats, Behead, §9).
- [x] Content entries refer to defined behaviors (validated vocabulary; zero load errors).
- [x] AI behavior has a bounded fallback (stance; QA detectors).
- [x] The prototype content set proves the central promise (42 classes with distinct kits; presets that differ in observable behavior).
- [x] Tunable values are distinguishable from required rules (labels; `combat.json`).
- [ ] Harness evidence: not run. Targets in §8 are unvalidated.
- [ ] Owner approval of the items below.

## Schema notes for the architect

1. **Files.** `combat.json` (constants, attributes, archetypes, hybrid pairs, statuses, status categories, stat-mod stats, trait adapter, captain block), `classes.json` (`classes[]`), `abilities.json` (`abilities[]`), `tactics-presets.json` (`limits`, `vocabulary`, `presets[]`). Each has `_doc`, `schemaVersion: 1`, `status`.
2. **Units.** Suffixes `S` (seconds → ticks ×20), `M` (metres → cm ×100; the sim may use mm ×1000, cmb-c1), `Mps` (m/s), `Deg` (degrees). Unsuffixed fractions → basis points ×10,000. Every value converts exactly; the content validator should reject values that do not (the build script checked 1,279 unit values).
3. **Closed enums for zod:** effect `type` (17); `damageType` (physical, arcane, true); status ids (34) and categories (8, `shield` being a pseudo-category); stat-mod stats (27); effect predicates (`p`, 13 incl. `any`); trigger `on` (12); amount stats (10); `per.source` (4); area shapes (3), `affects` (4), cone angles (60, 90, 120, 180); ability `target` (4), `kind` (3), `slot` (4), `delivery.type` (4), `endAt` (2), `order` (2); rule `cond` (21), `sel` (18), `pred` (12), `then.type` (6), stances (3), roles (5), bands (4).
4. **Discriminated unions.** Effects by `type`; predicates by `p`; rule conditions by `cond`; selectors by `sel`; predicates in rules by `pred`; actions by `type`. Parameter schemas per vocabulary entry are in `tactics-presets.json` → `vocabulary.*[].params` (name, type, min, max, step, default, optional).
5. **Ids.** Ability `<classId>_<slug>`; preset `<classId>_<style>`; icons `class_<id>`, `abl_<abilityId>`, `st_<statusId>`, `arch_<archetype>`. Rules reference ability slots (`a1`, `a2`), resolved through the class; the validator checks the selector pool against the ability's `target`.
6. **Fight inputs.** Add to `FightFighterInput`: `stats: Record<StatId, number>` keyed by the 12 attribute ids, `slot`, `captainQuality`, `viceCaptainIndex` on the side, optional `combatMods`. Effective stats include lifecycle stat effects; combat applies combat-owned trait effects and the captain.
7. **`FighterMatchStats` additions:** `ticksOnArena`, `assists`, `damageToShields`, `shieldingDone`, `overheal`, `ccAppliedTicks`, `ccReceivedTicks`, `casts: Record<AbilityId, number>`, `ruleFires` with the stance as the last entry, `ruleCommittedTicks`, `rulesNeverFired`, `downs: { round, tick, by, ability, hit, overkill, damageTakenRound }[]`, `opponentIds`. Rename `kills`/`deaths` to `downsInflicted`/`downsSuffered` (01 §7 bans "kill" and "death").
8. **Events.** Extend `FightEvent` with the types in sys-match-report. `FrameUnit` may gain a state bitmask (casting, stunned, …) for the viewer.
9. **RNG.** Purpose streams `phase/<unit>`, `variance/<unit>`, `react/<unit>`, `tiebreak` under the round seed; no other draws in the sim.
10. **Determinism.** No floats in sim state: positions in mm, HP points, damage in centipoints, focus in millipoints, accumulators in basis-point ticks; cone tests via the cosine table; only `Math.sqrt` for normalization (integer square root on mm² is preferable).
11. **Performance.** Decisions every 2 ticks, auras every 2 ticks, selectors over at most 5 candidates, separation over 45 pairs. If the 2 ms median fails, raise `decisionIntervalTicks` to 4 before anything else (TUNABLE, tune-cmb-13).
12. **Rating.** Rating = round(5 × Σ ratingWeights × stat); the lifecycle centipoint formula gives the same result.

## Owner confirmations needed

| ID | Question | Recommendation |
| --- | --- | --- |
| cmb-q1 | Approve the 12-stat model (5 physical, 7 mental) on the 1–20 scale, knowing casters and healers keep their main output longer than physical classes? | **Approve.** It follows O11 literally and gives the league a natural career asymmetry; the economy can price it through rating and age |
| cmb-q2 | Approve bounded randomness: crit/evade accumulators (counts within ±1 per fight), ±4% damage variance, 0–2 ticks reaction jitter, seeded coin only as the last tiebreak? | **Approve.** Fights vary but no outcome hinges on a streak (C1.3, C2.6) |
| cmb-q3 | Approve focus as a per-round budget (100, starts full, 2.5/s) on top of cooldowns? | **Approve** (P-07). The harness will show whether it changes rule-fire patterns; if not, lower costs to near zero rather than removing the system |
| cmb-q4 | Approve the round end: overtime ramp from 45 s (+3% damage, −3% healing per second) and the tiebreak chain at 75 s? | **Approve.** Keeps typical fights in 20–45 s and never ends in a draw |
| cmb-q5 | Approve the crowd-control rules: one shared DR track (1.0 / 0.6 / 0.35 / immune, 6 s), 2.5 s cap, tenacity from composure? | **Approve.** Disables stay short and readable (C1.3) |
| cmb-q6 | Approve the 42 class names and identities (catalog in sys-abilities)? | **Approve, then rename freely**: names are data and change nothing mechanical |
| cmb-q7 | Approve two damage types (physical vs armor, arcane vs ward) as the main soft counter? | **Approve.** It gives tank and caster choices a counter without hard immunities |
| cmb-q8 | Approve the captain model adopted from the lifecycle draft (composure aura, one rally, Shaken, handover, captain's target)? | **Approve.** Reliability effects within a 10% cap, as research D3 recommends |
| cmb-q9 | Approve the rule engine details: first valid rule wins, NOT on every condition, ONLY or PREFER (one per rule), per-rule cooldown, three stances, reaction delay only on decision changes? | **Approve** (P-06, P-07) |
| cmb-q10 | Approve the unusual mechanics: sleep that breaks on damage (Dreamthief), Deathward (Vigilkeeper), rewind healing of recent damage (Hourglass Sage), bear traps (Snaresetter)? | **Approve for M1**; each is readable in a report and has a counter |
| cmb-q11 | Reconcile race and trait stat magnitudes with combat coefficients (cmb-c2) | **Cap race tendencies at ±4 and trait stat adds at ±3**, keeping coefficients at 4% per point; otherwise elf Toughness −8 means −32% HP |
| cmb-q12 | Approve millimetre positions inside the sim (cmb-c1) | **Approve.** Internal to core/sim; content and events stay in metres and centimetres |
