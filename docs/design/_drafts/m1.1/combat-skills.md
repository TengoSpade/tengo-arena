# Arena League M1.1: ability ranks, perks, Freshness, match squads and swaps

> ARENA LEAGUE DESIGN PACKAGE · M1.1 "Playtest round 1" DRAFT `_drafts/m1.1/combat-skills.md` · v0.2 · 2026-10-26 · combat designer.
> **Owner decisions (REQUIRED):** in-season level-ups about every 5 matches played, each offering 1 of 3 options; some options are **skills** of two kinds, **ability ranks** and **perks** (occasional traits belong to lifecycle) (tickets T003, T005). **Stamina** is a new physical attribute `stamina` (1–20). **Freshness** is a 0–100 meter owned by lifecycle. Freshness and Stamina have effects **within a match but not during actual combat**: they act between rounds. Each club brings **2 reserves** into each match, who can be swapped in, with **at most 2 swaps per match**. **A fighter swapped out cannot return in that match** (owner ruling, 2026-10-26).
> Everything else here is PROPOSED, and every number is PROPOSED · TUNABLE. The orchestrator defaults (b)–(e) for swaps are PROPOSED pending owner confirmation (cmb11-q8 to q11).
> Merges into 03 §3.1 (sys-combat-stats, sys-abilities, sys-fight-sim, sys-match, sys-match-report) plus new combat-owned systems. Interface partner: lifecycle's `progression.md` and [content/levels.json](content/levels.json).
> Proposed content (not in `content/default`; the architect integrates it): [ability-ranks.json](content/ability-ranks.json), [perks.json](content/perks.json), [classes.json](content/classes.json) (stamina weights), [combat.patch.json](content/combat.patch.json) (freshness curve, match squad and swap constants, vocabulary), [schema-notes.md](content/schema-notes.md).

| Field | Value |
| --- | --- |
| Milestone | M1.1 "Playtest round 1" (on top of M1, tag `m1-season-mvp`, docs v0.4) |
| Status | Draft v0.2 for owner review. No harness evidence yet: the sim does not read ranks, perks or freshness yet, and matches are not yet played round by round |
| Systems | sys-ability-ranks (new), sys-perks (new), sys-combat-stats (Stamina), sys-fight-freshness (new), sys-match (squads, swaps, round-by-round orchestration), sys-match-report (tags, swap timeline) |
| Changes in v0.2 | The in-fight Stamina effect is removed; Freshness is read at the start of every round; match squads, swaps and the between-round step are added; the sim API becomes round by round; Stamina's rating weight drops to 2%; Second Breath and Campaign Legs work between rounds; Fresh Legs replaces Sharp Reflexes |

## 0. Summary

- **Ranks.** Every active and passive ability has ranks 1→3; rank 1 is today's ability. Basic attacks do not rank. One template per effect family: one step adds magnitude, the other shortens the cooldown, lengthens a duration, widens an area or cuts focus cost. Control durations never grow. 126 rankable abilities, 252 rank steps, 315 validated field changes.
- **Perks.** 72 permanent perks: 12 general and 12 per archetype (tiers I/II/III = 5/4/3 per archetype). Cap 4 per fighter, at most 1 tier III; 12 mutually exclusive pairs; hybrids draw from both archetypes. Perks are extra passive blocks in the existing vocabulary plus small, precisely specified extensions.
- **Stamina** has no effect during combat. It acts only through Freshness: drain per round played, recovery between weeks (lifecycle). Rating weight 2% for every class; ratings move by a mean of 0.33 points (maximum 2).
- **Freshness penalty.** Read at the **start of every round** from the fighter's Freshness at that moment, and fixed for the round. None at 60+. Below 60 the severity rises linearly to full at 10: −10% attack speed, −6% move speed, −8% Power and Support, +25% reaction delay. Reports tag **Tired** (40–59) and **Spent** (below 40).
- **Match squad and swaps.** Each club names 5 starters and up to 2 reserves. Swaps happen only between rounds, at most 2 per match, decided by both clubs simultaneously and blind. A swapped-out fighter cannot return, so once both reserves are in (or both swaps used) the five on the field play out the match. The only exception is an injury, which is always covered so a match is never 4 v 5. Player matches pause on a between-round screen; an auto-swap club setting (the AI uses the same rules) covers the rest.
- **Sim API.** `simulateRound(input, roundSeed)` replaces whole-match simulation. A pure match orchestrator in core/game carries Freshness, injuries, swaps and the active five between rounds. Swap decisions are recorded in the match result, so replays reproduce exactly.

## 1. Mechanical foundations (additions)

**Status:** PROPOSED. Values in the proposal files.

| Topic | Decision | Player-visible consequence |
| --- | --- | --- |
| Round inputs | Each round's `FightFighterInput` adds `freshness` (int 0–100, that fighter's value at the start of this round), `abilityRanks` ({ a1, a2, passive: 1–3 }), `perkIds` (0–4) and `enteredThisRound` (bool) | Tiredness and swaps change the next round, never the round in progress |
| No in-combat drift | Nothing in this draft changes during a round because of Freshness or Stamina. The freshness penalty is a constant per round | Fights stay readable; the between-round screen is where Freshness matters |
| Determinism | Round seeds are unchanged: `deriveSeed(matchSeed, 'round', n)`. Ranks, perks, freshness and squads are inputs; swap decisions are recorded inputs; injuries come from lifecycle's own stream. The sim gains no random draw | Replays, reloads and headless runs agree (T4, P-05) |
| New attribute | `stamina` (abbr STA), physical, 1–20; 13 attributes (6 physical, 7 mental) | Shown with the physical stats; ages with them (lifecycle) |
| Readability | No rank or perk lengthens a hard-control duration; perks never apply hard control; the 2.5 s cap and diminishing returns are unchanged | Disables stay short and readable (C1.3) |
| Explanation | Rank deltas, one-line perk effects, fatigue tags and every swap appear in the report with their numbers and reasons | "Why did they lose round 3?" has a visible answer |

## 2. System inventory

| System ID | Purpose | Depends on | M1.1 behavior |
| --- | --- | --- | --- |
| sys-ability-ranks | Ranks 1–3 per active and passive ability | sys-abilities, sys-development (offers) | Rank tables applied at round build |
| sys-perks | Perk catalog, eligibility, cap and exclusions; perk effects | sys-abilities, sys-development (offers) | Up to 4 perks per fighter |
| sys-combat-stats (amended) | Adds `stamina` (no in-fight formula); rating weights with `stamina` | sys-fighters | 13 attributes |
| sys-fight-freshness | Penalty curve applied at each round start | sys-freshness (lifecycle) | Constant per round; report tags |
| sys-match (amended) | Match squads, swaps, between-round step, round-by-round orchestration, records | sys-fight-sim, sys-freshness, sys-injury, sys-roster | Best-of-3 (finals best-of-5) as before, now with squads and swaps |
| sys-match-report (amended) | Ranks, perks, fatigue tags, per-round lineups, swap timeline | all above | Shown in every report |

## 3. System specifications

### sys-ability-ranks: ranks 1 → 3

**Status:** the existence of ability ranks is REQUIRED (owner). Template, families and numbers are PROPOSED · TUNABLE ([ability-ranks.json](content/ability-ranks.json)).

**Purpose:** give level-ups a second kind of growth that changes how a familiar ability behaves, readably, without new mechanics.

**Entities and state.** A fighter stores a rank (1–3) per rankable slot: `a1`, `a2`, `passive`. Basic attacks are not rankable (`rankable: false`). *Why:* the basic attack is the attribute-scaling baseline every build uses all fight; a rank on it would be the first pick for every fighter and crowd out every interesting choice (cmb11-q1). *Passives rank* (×1.25, then ×1.5 of the rank-1 magnitudes), because a passive is half of a class's identity.

**Rank pattern** (family derived from the ability's effects in this priority order: guard → hard control or displacement → healing → shield → damage (area if it has an area, zone, chain or channel area) → buff → debuff → mobility, with 5 per-ability overrides):

| Family | Abilities | Rank 2 | Rank 3 |
| --- | --- | --- | --- |
| damage | 15 | damage coefficients × 1.12 | cooldown × 0.9 (to the nearest 0.5 s, at least 0.5 s shorter) |
| area_damage | 11 | damage coefficients × 1.10 | area +0.5 m radius (+1 m for lines, +1 jump for chains, +0.5 m for zones) |
| control | 22 | cooldown × 0.9 | focus cost −5 (minimum 10) and damage coefficients × 1.10; **control durations never change** |
| heal | 17 | healing coefficients × 1.12 | cooldown × 0.9 |
| shield | 4 | shield coefficients × 1.12 | shield duration +1 s |
| buff | 7 | buff durations +1 s (zone abilities: the zone lasts 1 s longer) | buff magnitudes × 1.2, capped at the status cap |
| debuff | 5 | debuff and slow magnitudes × 1.2, capped | debuff durations +1 s (zones: zone duration) |
| mobility | 1 | cooldown × 0.9 | focus cost −5 |
| protect (guard) | 1 | guard redirect +5 points | cooldown × 0.9 |
| ward (Deathward) | 1 | ward window +1 s | cooldown × 0.9 |
| passive | 42 | every magnitude × 1.25 | every magnitude × 1.5 of rank 1. Radii, thresholds, intervals, flags and windup never scale |

Per-ability overrides: Mark of Ruin, Tar Pit and Undertow use the family that matches their job (debuff, debuff, heal); Siphon Strike ranks as damage; Leap Back ranks as mobility. Rank-3 extras replace the template for Unravel (strips 3 buffs) and Bear Trap (3 traps at once).

**Rounding.** Coefficients ≥ 0.2 round to 0.01; smaller magnitudes round to 0.005 (≥ 0.02) or 0.0005; flat armor, ward and focus round to whole points; cooldowns round to 0.5 s and never go below 1 s; every value converts exactly to ticks, cm and basis points.

**Resolution procedure.** (1) At round build, for each slot with rank r > 1, apply rank 2's `changes` and, if r = 3, rank 3's, in order, to a copy of the ability (JSON-pointer `path`, `from`, `to`). (2) Compile the copy exactly like an unranked ability. (3) The fight header lists each unit's ranks; the report names ranked abilities "Shield Bash II" or "Shield Bash III".

**Invariants (validated):** each `from` equals the value at rank r − 1; hard-control durations are identical at every rank; magnitudes stay within status caps; active cooldowns stay ≥ 1 s and focus ≥ 10; units convert exactly. An independent verifier re-applies all 315 changes.

**Player information.** Rank pips on each ability, and the next rank's delta line (`summary`) on the fighter page and in the level-up offer.

**Examples (generated from the data):**

| Class | Ability (family) | Rank 2 | Rank 3 |
| --- | --- | --- | --- |
| Knight | Interpose (protect) | redirect 30% → 35% | cooldown 10 → 9 s |
| Knight | Shield Bash (control) | cooldown 9 → 8 s | focus cost 20 → 15; damage 140% → 154% Power |
| Knight | Sworn Shield (passive) | damage taken -8% → -10% | damage taken -10% → -12% |
| Assassin | Shadowstep (damage) | damage 160% → 179% Power | cooldown 10 → 9 s |
| Assassin | Hamstring (damage) | damage 100% → 112% Power | cooldown 7 → 6.5 s |
| Assassin | Unseen Angle (passive) | damage dealt 25% → 31% | damage dealt 31% → 38% |
| Archer | Aimed Shot (damage) | damage 300% → 336% Power | cooldown 9 → 8 s |
| Archer | Leap Back (mobility) | cooldown 10 → 9 s | focus cost 15 → 10 |
| Archer | Deadeye (passive) | damage dealt 20% → 25% | damage dealt 25% → 30% |
| Rimebinder | Rime Nova (control) | cooldown 12 → 11 s | focus cost 30 → 25; damage 80% → 88% Power |
| Rimebinder | Glacial Lance (damage) | damage 140% → 157% Power | cooldown 8 → 7 s |
| Rimebinder | Deep Chill (passive) | damage dealt 15% → 19% | damage dealt 19% → 23% |
| Chirurgeon | Suture (heal) | healing 220% → 246% Support | cooldown 5 → 4.5 s |
| Chirurgeon | Purging Tincture (heal) | healing 15% → 17% Support | cooldown 10 → 9 s |
| Chirurgeon | Field Dressing (passive) | Fortified 15% → 19% | Fortified 19% → 23% |
| Leechblade | Siphon Strike (damage) | damage 150% → 168% Power | cooldown 8 → 7 s |
| Leechblade | Crimson Mist (heal) | healing 60% → 67% Support | cooldown 12 → 11 s |
| Leechblade | Blood Tithe (passive) | heal 15% → 19% of the triggering amount | heal 19% → 23% of the triggering amount |

The full table for all 168 abilities is in `ability-ranks.json` (`summary` per rank, JSON-pointer `changes`).

### sys-perks: perk catalog, eligibility and effects

**Status:** the existence of perks is REQUIRED (owner). Catalog, rules and numbers are PROPOSED · TUNABLE ([perks.json](content/perks.json)).

**Perk schema.** `id`, `name`, `archetype` (`general`, `tank`, `melee`, `ranged`, `controller`, `healer`), `tier` (1–3), `iconId` (`perk_<id>`), `tags`, `text` (one line, numbers matching the data), `requires` { `minPerksHeld`, `anyPerks`, `minStats` }, `autoPickValue`, `exclusiveWith`, `passive` (the abilities.json passive schema plus the extensions below), `traitEffects` (combat-owned trait effect types), `lifecycleEffects` (lifecycle-owned: `freshnessDrainMult`, `freshnessBetweenRounds`, `captaincy`).

**Eligibility rules** (lifecycle's offer generator applies the same rules):
1. **Pool:** general perks plus the perks of each archetype the class lists (pure classes 24, hybrids 36).
2. **Tier gates by perks held** (a fighter's level in `levels.json` counts stat points, so level gates would not work): tier I always; tier II needs ≥ 1 perk held; tier III needs ≥ 2 held and one listed prerequisite.
3. **Cap:** 4 perks, at most 1 tier III.
4. **Exclusions:** never offered while the exclusive partner is held (12 pairs).
5. **Stat gates:** `minStats` against effective stats at offer time (Banner Voice: Leadership 12).
6. **Ownership:** a held perk is never offered again; perks are permanent in M1.1 (respec FUTURE).
7. **Offer draw** inside a skill slot (lifecycle creates one every 3rd level-up): rank-up or perk with weight 1 each while both are possible; then a rank step uniformly, or a perk weighted by tier (I 1.0, II 0.8, III 0.6).

**Effects.** A held perk compiles like an extra class passive (stat mods, aura with strongest-only per perk id, triggers). Trait-type effects behave as on traits. Lifecycle-type effects never reach the sim.

**Extensions** (precise; perks.json `extensions`):
1. Up to 4 perk passive blocks per unit besides the class passive.
2. Stat-mod stat `fatigueResist` (fraction, clamped 0–1): share of the freshness penalty ignored (constant per round).
3. Effect predicates `self_is_captain`, `self_freshness_below {pct}` (start-of-round value) and `self_fresh_entry` (entered from the reserves, or as an emergency entrant, for this round).
4. Trigger events `self_hp_below {pct}` (once per round, at the commit where HP first drops below pct, after Deathward) and `ability_release {slot?}`.
5. Trigger `if` (optional predicate checked when the event happens).
6. Aura `requires` (optional predicate on the aura owner).

**Catalog** (generated from perks.json):

**General (any class)**

| Perk | Tier | Tags | Effect | Requires | Exclusive with |
| --- | --- | --- | --- | --- | --- |
| **Hardened Hide** `g_hardened_hide` | I | defense | +4% max HP. | — | — |
| **Quick Hands** `g_quick_hands` | I | offense, tempo | +4% attack speed. | — | — |
| **Steady Nerves** `g_steady_nerves` | I | defense | +2 composure in fights (longer-lasting nerve against control and pressure). | — | — |
| **Fresh Legs** `g_fresh_legs` | I | tempo, stamina | In the first round after it enters from the reserves: +8% damage dealt and +2 composure. | — | — |
| **Measured Breath** `g_measured_breath` | I | tempo | +10% focus regeneration. | — | — |
| **Long Wind** `g_long_wind` | I | stamina | The freshness penalty is 40% weaker. | — | Campaign Legs |
| **Opening Gambit** `g_opening_gambit` | I | offense | +8% damage dealt in the first 8 s of a round. | — | Veteran's Pace |
| **Campaign Legs** `g_campaign_legs` | II | stamina, defense | Freshness drains 15% slower for each round played; +2% max HP. | — | Long Wind |
| **Second Breath** `g_second_breath` | II | stamina, sustain | Regains 8 freshness between rounds of a match. Once per round, on first dropping below 35% HP: heals 10% of max HP. | — | — |
| **Veteran's Pace** `g_veterans_pace` | II | tempo | From 30 s into a round: +6% attack speed and +4% move speed. | — | Opening Gambit |
| **Banner Voice** `g_banner_voice` | II | captain, support | As acting captain, every fielded ally gets +1 composure. +5 captain quality. | LDR ≥ 12 | — |
| **Rallying Horn** `g_rallying_horn` | III | captain, support | As acting captain, the rally's composure bonus and duration are 50% greater. | one of: Banner Voice | — |

**Tank**

| Perk | Tier | Tags | Effect | Requires | Exclusive with |
| --- | --- | --- | --- | --- | --- |
| **Thick Plating** `t_thick_plating` | I | defense | +12 armor. | — | — |
| **Warded Mantle** `t_warded_mantle` | I | defense | +12 ward. | — | — |
| **Shoulder Check** `t_shoulder_check` | I | control | Every 4th basic hit Weakens the target by 10% for 2 s. | — | — |
| **Stand Firm** `t_stand_firm` | I | defense | +12% tenacity. | — | — |
| **Pain Eater** `t_pain_eater` | I | sustain | While 2 or more enemies target it: regenerates 0.4% of max HP per second. | — | — |
| **Bulwark Doctrine** `t_bulwark_doctrine` | II | defense | 6% less damage taken, 4% less damage dealt. | — | Brawler's Creed |
| **Brawler's Creed** `t_brawlers_creed` | II | offense | +8% damage dealt, −6 armor. | — | Bulwark Doctrine |
| **Shepherd** `t_shepherd` | II | support, defense | Allies within 3 m take 3% less damage. | — | — |
| **Unbreakable** `t_unbreakable` | II | defense | Below 30% HP: 12% less damage taken. | — | — |
| **Last Wall** `t_last_wall` | III | defense | Once per round, on first dropping below 25% HP: a shield worth 20% of max HP for 4 s. | one of: Unbreakable, Bulwark Doctrine | — |
| **Challenger's Brand** `t_challengers_brand` | III | control, defense | Enemies within 2.5 m deal 5% less damage. | one of: Stand Firm, Shoulder Check | Spiked Bulwark |
| **Spiked Bulwark** `t_spiked_bulwark` | III | offense, defense | Reflects 10% of melee weapon damage taken; +6 armor. | one of: Thick Plating, Brawler's Creed | Challenger's Brand |

**Melee DPS**

| Perk | Tier | Tags | Effect | Requires | Exclusive with |
| --- | --- | --- | --- | --- | --- |
| **Keen Edge** `m_keen_edge` | I | offense | +4% critical-hit chance. | — | — |
| **Blade Rhythm** `m_blade_rhythm` | I | offense, tempo | +5% attack speed. | — | — |
| **Gap Closer** `m_gap_closer` | I | mobility | +6% move speed. | — | — |
| **Blooded** `m_blooded` | I | sustain | Heals for 4% of the damage it deals. | — | — |
| **Hamstringer** `m_hamstringer` | I | control | Basic hits slow the target 10% for 1 s. | — | — |
| **Finisher** `m_finisher` | II | offense | +12% damage to enemies below 35% HP. | — | First Cut |
| **First Cut** `m_first_cut` | II | offense | +12% damage to enemies above 70% HP. | — | Finisher |
| **Duelist's Footing** `m_duelists_footing` | II | defense | +6% evade against weapon blows. | — | — |
| **Cornered Wolf** `m_cornered_wolf` | II | offense | Below 50% HP: +10% damage dealt. | — | — |
| **Executioner's Rush** `m_executioners_rush` | III | tempo, mobility | On downing an enemy: 25% Hasted for 3 s and +15 focus. | one of: Finisher | — |
| **Whirling Steel** `m_whirling_steel` | III | offense | Every 5th basic hit also strikes enemies within 1.5 m of the target for 50% Power physical damage. | one of: Blade Rhythm | Unrelenting |
| **Unrelenting** `m_unrelenting` | III | sustain, defense | Below 30% HP: heals for 8% of damage dealt and +10% tenacity. | one of: Cornered Wolf, Blooded | Whirling Steel |

**Ranged DPS**

| Perk | Tier | Tags | Effect | Requires | Exclusive with |
| --- | --- | --- | --- | --- | --- |
| **Steady Aim** `r_steady_aim` | I | offense | +4% critical-hit chance. | — | — |
| **Fletcher's Eye** `r_fletchers_eye` | I | offense | +6% damage to enemies more than 5 m away. | — | — |
| **Light Step** `r_light_step` | I | mobility | +6% move speed. | — | — |
| **Quickdraw** `r_quickdraw` | I | tempo | Basic-attack windup 25% shorter. | — | — |
| **Skirmish Drill** `r_skirmish_drill` | I | defense | +5% evade against weapon blows. | — | — |
| **Pinning Shots** `r_pinning_shots` | II | control | Every 4th basic hit slows the target 20% for 1.5 s. | — | — |
| **Hunter's Patience** `r_hunters_patience` | II | offense | +10% damage to enemies that are not targeting it. | — | Killing Field |
| **Killing Field** `r_killing_field` | II | offense, control | +10% damage to slowed or rooted enemies. | — | Hunter's Patience |
| **Spotter** `r_spotter` | II | support | Every 5th basic hit Marks the target for 3 s: it takes 10% more damage from everyone. | — | — |
| **Deadly Precision** `r_deadly_precision` | III | offense | +6% critical-hit chance; +4% damage to enemies below 50% HP. | one of: Steady Aim | — |
| **Glass Cannon** `r_glass_cannon` | III | offense | +12% damage dealt, +8% damage taken. | one of: Hunter's Patience, Killing Field | Escape Artist |
| **Escape Artist** `r_escape_artist` | III | mobility, defense | Below 40% HP: +10% evade, and the first hit taken there each 8 s gives 30% Hasted for 2 s. | one of: Light Step, Skirmish Drill | Glass Cannon |

**Controller**

| Perk | Tier | Tags | Effect | Requires | Exclusive with |
| --- | --- | --- | --- | --- | --- |
| **Lingering Curse** `c_lingering_curse` | I | control | Slows and debuffs it applies last 15% longer. | — | — |
| **Iron Grip** `c_iron_grip` | I | control | Hard control it applies lasts 8% longer, within the usual control cap. | — | — |
| **Ready Mind** `c_ready_mind` | I | tempo | +12% focus regeneration. | — | — |
| **Spellward** `c_spellward` | I | defense | +12 ward. | — | — |
| **Cold Calculus** `c_cold_calculus` | I | tempo | Ability cooldowns recover 6% faster. | — | — |
| **Exploit Weakness** `c_exploit_weakness` | II | offense | +12% damage to enemies that are stunned, rooted, silenced or slowed. | — | Overload |
| **Overload** `c_overload` | II | offense, tempo | After releasing an active ability: 10% Empowered for 3 s. | — | Exploit Weakness |
| **Hexed Ground** `c_hexed_ground` | II | control, support | Enemies it slows, roots or stuns become 8% Vulnerable for 2 s (once per 1 s). | — | — |
| **Calm Center** `c_calm_center` | II | defense | +12% tenacity and +1 composure. | — | — |
| **Grand Design** `c_grand_design` | III | tempo | Ability cooldowns recover 6% faster; +8% focus regeneration. | one of: Cold Calculus, Ready Mind | Puppeteer |
| **Puppeteer** `c_puppeteer` | III | control, tempo | Each time it stuns, roots, silences or sleeps an enemy: +8 focus (once per 3 s). | one of: Iron Grip, Hexed Ground | Grand Design |
| **Shatter** `c_shatter` | III | offense, control | Every 3rd basic hit, if the target is slowed or rooted, deals an extra 60% Power arcane damage. | one of: Exploit Weakness | — |

**Healer**

| Perk | Tier | Tags | Effect | Requires | Exclusive with |
| --- | --- | --- | --- | --- | --- |
| **Gentle Hands** `h_gentle_hands` | I | support | +6% healing and shielding. | — | — |
| **Deep Well** `h_deep_well` | I | tempo | +10% focus regeneration. | — | — |
| **Stalwart Mender** `h_stalwart_mender` | I | defense | +6% max HP and +5 armor. | — | — |
| **Swift Remedy** `h_swift_remedy` | I | tempo | Ability cooldowns recover 5% faster. | — | — |
| **Calm Under Fire** `h_calm_under_fire` | I | defense | +10% tenacity. | — | — |
| **Triage Instinct** `h_triage_instinct` | II | support | +15% healing and shielding on allies below 40% HP. | — | Preventive Care |
| **Preventive Care** `h_preventive_care` | II | support | +12% healing and shielding on allies above 70% HP. | — | Triage Instinct |
| **Mending Aura** `h_mending_aura` | II | support, sustain | Allies within 4 m regenerate 3% of its Support as HP per second. | — | — |
| **Warding Lantern** `h_warding_lantern` | II | support | The first time each ally within 6 m drops below 25% HP in a round: heal it for 50% Support. | — | — |
| **Wellspring** `h_wellspring` | III | tempo | Every 4th heal it casts restores 10 focus. | one of: Deep Well | Battle Chaplain |
| **Saint's Patience** `h_saints_patience` | III | support, defense | Heals on allies below 25% HP also Fortify them by 10% for 2 s. | one of: Triage Instinct | — |
| **Battle Chaplain** `h_battle_chaplain` | III | offense | +15% damage dealt. | one of: Stalwart Mender, Calm Under Fire | Wellspring |


**Freshness, Stamina, reserve and captain perks.** *Long Wind* (penalty −40%) and *Campaign Legs* (drain per round played ×0.85; lifecycle) are exclusive: tolerate tiredness, or tire more slowly. *Second Breath* regains 8 freshness at each between-round step (lifecycle) and heals 10% of max HP once per round below 35% HP. *Fresh Legs* rewards a reserve's first round on the field (+8% damage, +2 composure). *Banner Voice* (+1 composure to the whole lineup while acting captain, +5 captain quality) and *Rallying Horn* (rally ×1.5) are the captain line; captain sources stay inside the 10% cap (a grade A aura of +2 plus Banner Voice is +3 composure = +6% tenacity).

### sys-combat-stats amendment: Stamina

**Status:** the attribute is REQUIRED (owner). Weights PROPOSED · TUNABLE.

**In-fight role: none** (owner: no Stamina or Freshness effects during actual combat). Stamina acts only through Freshness: lifecycle drains it per round played and restores it between weeks, scaled by Stamina. The penalty that Freshness causes is described in sys-fight-freshness.

**Rating weights.** `stamina` joins every class's `ratingWeights` at **2%**, the same for every class because every fighter drains alike; the other weights are scaled by 0.98 and rounded so the sum stays exactly 1.00. Rating measures fighting quality, so a stat with no fight formula gets only a token weight, enough to price availability. Lifecycle's auto-pick separately adds a stamina bonus (`levels.json` autoPick.staminaBonusByStamina) so low-stamina fighters still pick it. `statEmphasis.stamina` (generation and growth bias): tank and melee 1.2, ranged 1.0, controller and healer 0.9, close to lifecycle's affinity fallback. Other emphasis values are unchanged.

**Rating impact.** Rating moves by 5 × 0.02 × (STA − the weighted mean of the other stats), ± 1 rounding. In a 4,000-fighter study per class: mean |change| 0.33 points, 5th–95th percentile −1 to 0, maximum 2. Ratings stay comparable through the M1 → M1.1 migration.

### sys-fight-freshness: tiredness, round by round

**Status:** the meter, its drain per round played, recovery and labels are REQUIRED (owner) and owned by lifecycle. The curve is PROPOSED · TUNABLE ([combat.patch.json](content/combat.patch.json) → `freshness`).

**When it applies.** At the **start of each round**, from the fighter's Freshness at that moment (after lifecycle's drain for the previous round and any between-round recovery, e.g. Second Breath). It is constant for the whole round. Nothing about Freshness changes during combat.

**Formula.** With F = Freshness at round start, T = 60 (`levels.json` freshness.threshold) and floor 10: s = clamp((60 − F) ÷ 50, 0, 1), in basis points trunc((60 − F) × 10,000 ÷ 50). Each penalty = penaltyAtFull × s × (1 − fatigueResist):

| Value | At full penalty (s = 1, F ≤ 10) | F = 52 (s = 0.16) | F = 40 (s = 0.4) | F = 28 (s = 0.64) |
| --- | --- | --- | --- | --- |
| Attack speed | −10% | −1.6% | −4% | −6.4% |
| Move speed | −6% | −1% | −2.4% | −3.8% |
| Power and Support | −8% | −1.3% | −3.2% | −5.1% |
| Reaction delay | +25% | +4% | +10% | +16% |

Implementation: stat mods (attackSpeed, moveSpeed, power, support, reactionDelay) added once at round build.

**Why this shape.** Just under the threshold the cost is mild, so playing one more round is a planned risk. A spent fighter is clearly worse: about 17% less damage output and slower reactions, roughly a 3-point rating drop. Because drain is per round, a fighter can cross the threshold mid-match, and that is exactly when the between-round screen offers a swap. Exact round-by-round values depend on lifecycle's per-round drain, still being finalized in `progression.md`. With the current `levels.json` numbers (about 2.5 rounds per match), a STA 16 fighter is near F 52 after 4 matches and a STA 6 fighter after 2.

**Player information.** The between-round screen and the lineup show lifecycle's label (Fresh, Ready, Tired, Spent) and the value. Report recaps tag a fighter per round **Tired (52)** or **Spent (28)** with the applied penalties. `fight.start` unit data carries `freshness`, `fatigueBp` and the five values.

**Edge cases.** Missing freshness = 100; values are clamped to 0–100. Emergency entrants and hired blades use their own value (hired blades normally 100).

### sys-match: match squads, swaps and the between-round step

**Status:** squads of 5 + 2 reserves, at most 2 swaps per match and no return after a swap are REQUIRED (owner). Everything else is PROPOSED · TUNABLE (`combat.patch.json` → `match`). This replaces the M1 rule "no substitutions during a match" (open-010).

**Entities and state** (per side, carried between rounds): squad (5 starters and 0–2 reserves, chosen at lineup lock), the **active five** (slot → fighter, row), `withdrawn` (fighters swapped out; they cannot return), `unusedReserves`, `swapsUsed` (0–2), `injuredThisMatch`, each squad member's current Freshness, the acting captain, and emergency entrants used.

**Squad legality (at lineup lock).** 5 starters and 0–2 reserves, all distinct, fit (not injured) roster fighters; hired blades may fill starter places only (open-006); the club captain and vice-captain may be starters or reserves. Fewer than 2 reserves is legal when the roster has no more fit fighters. Rows and presets are set for all seven.

**Swap timing.** Only in the between-round step after a round that did not decide the match: never before round 1 (the starters are the opening five) and never after the deciding round. In a best-of-3 there are at most 2 between-round steps; in a best-of-5, at most 4. The maximum stays 2 swaps per match.

**Swap legality** (each proposed swap, checked in order; the first failure rejects it with that reason):
1. `match_decided`: no further round will be played.
2. `no_swaps_left`: swapsUsed = 2.
3. `not_active`: the outgoing fighter is not in the active five.
4. `not_a_reserve`: the incoming fighter is not an unused reserve of this squad. A **withdrawn** fighter (swapped out earlier) is never an unused reserve, so it can never return (owner ruling).
5. `reserve_unfit`: the reserve is injured.
6. `duplicate`: the same fighter appears twice in this step's decisions.

After all of a side's decisions are applied, exactly 5 fighters are active.

**Injuries (orchestrator default (b), PROPOSED).** Lifecycle rolls injuries immediately after each round. An active fighter injured in round n cannot play any later round of the match. The between-round step forces a replacement:
- If an unused reserve exists, a reserve enters and **counts as a swap**. The player picks which one; auto-swap picks the best fit (below).
- Otherwise (both reserves have entered, so both swaps are used), an **emergency entrant** comes in without a swap. This is the best-fit fit roster fighter outside the match squad: same role family as the injured fighter, then higher rating, then higher Freshness, then lower fighter id. Withdrawn fighters are never eligible. If no such fighter exists, a hired blade enters (open-006 rules).
- Because each swap brings in one of the two reserves, *swaps left = unused reserves* always, so "no swaps left" and "no reserves left" are the same case. A match is never played 4 v 5.
- Once both reserves are in, or both swaps are used, the five on the field play out the match; only injuries can still change it.

**Captain (default (c)).** If the acting captain is withdrawn or injured, the next round's acting captain is the vice-captain if active, otherwise the active fighter with the highest CQ (ties: lower slot), with CQ − 10 (the existing interim rule, `development.json` captaincy). A reserve who is the designated captain or vice takes that role on entering.

**Row and position (default (d)).** The entering fighter takes the outgoing fighter's slot and row unless the player picks the other row on the between-round screen. Other fighters' rows do not change (between-round tactics edits are M3).

**Tactics (default (e)).** Presets travel with the fighter: an entering fighter uses its own preset, and the outgoing fighter's preset leaves with it.

**Decision point (the player's matches).** After each non-deciding round the match pauses on the **between-round screen**, subject to pacing (below). It shows the round result and score; for each active fighter, Freshness now and the change this round, damage taken, downs and any injury; the reserves with Freshness, rating and class; swaps left (and that withdrawn fighters cannot return); auto-swap suggestions pre-filled; and **Swap** and **Continue** buttons. Decisions are recorded when the player presses Continue.

**Simultaneous and blind.** Both clubs decide from the same post-round state. Neither sees the other's choice until the next round starts. Decisions are applied home then away (they never interact). The report shows both sides' swaps together. The AI never reads the player's choice for that step (P-04).

**Auto-swap (club setting; AI clubs use the same rules).** Mode `off` (forced injury replacements still happen), `injured_only`, or `threshold` (default). The procedure, deterministic, runs for each side after each non-deciding round:
1. **Forced:** each injured active fighter is replaced by the best-fit unused reserve (same role family, then rating, then Freshness, then lower squad index), or by an emergency entrant.
2. **Threshold:** active fighters with Freshness < `freshnessBelow` (default 40), lowest first, are each swapped for the best-fit unused reserve whose Freshness is at least the starter's + `reserveMargin` (15) and whose rating is at least the starter's − `maxRatingGap` (6, as in lifecycle's aiRotation). Stop when swaps run out.
3. **keepOneForInjury** (default on): the last remaining swap is not used for Freshness unless this is the last possible between-round step of the match.
4. On the player's screen these are suggestions. Pressing Continue without changes accepts them. When pacing skips the pause, they are applied as is.

AI clubs use the same procedure with personality-based thresholds supplied by lifecycle (working assumption: balanced 40, thrifty 35, star_chasing 30, youth_focused 50, veteran 40; keepOneForInjury on).

**Pacing.** Club setting `pauseBetweenRounds`: `always` (M1.1 default, so the owner sees every decision point), `when_urgent` (pause only if a forced replacement offers a choice between two reserves, an active fighter is below the auto threshold, or the captain is out), or `never` (auto rules only). AI-vs-AI matches never pause.

**Match report and timeline.** Each round lists both sides' active five with rows and the Fresh, Tired or Spent tag. Between rounds, the timeline shows swap lines, e.g. "After round 1 — Home: Druid (Tired 48) → Bard (Fresh 92), auto · Away: Netcaster injured (minor) → Skullslinger, forced". Each fighter's recap states rounds played, "entered after round n", "swapped out after round n" or "injured in round n (severity)", and which swaps were player, auto, forced or emergency.

**Determinism and saving.** Round seeds are unchanged. Every between-round decision is recorded in the match result (below). Injury rolls use lifecycle's injury stream keyed by fixture, round and fighter. Each completed round, and each between-round decision, is committed as it happens: quitting on the between-round screen resumes there with the same results, so a round can never be rerolled (P-05).

### Operation contract: round-by-round matches

**Status:** PROPOSED for document 05 and the architect.

**core/sim (pure, unchanged otherwise):**
- `simulateRound(input: RoundInput, roundSeed: Seed, content, options?): RoundOutput` replaces `simulateFight` (the same function, renamed and given the new inputs). `RoundInput = { round: number; home: SideRoundInput; away: SideRoundInput }`. `SideRoundInput` = today's `SideInput` (5 active fighters, captain and vice indices among them) with each fighter's `freshness`, `abilityRanks`, `perkIds` and `enteredThisRound`.
- `RoundOutput = { result: RoundResult; fighterStats; aftermath: { fighterId; roundsPlayed: 1; damageTaken; downed; largestHit; downCause | null }[]; log }`. `aftermath` is the input lifecycle needs for drain, XP and immediate injuries.
- `simulateMatch` remains only as a thin test helper that runs the orchestrator with auto-swap `off`.

**core/game (pure orchestrator):**
- `startMatch(state, fixtureId, squads): MatchState`, which validates squads and derives `matchSeed` as today.
- `playRound(state, ms): { ms; roundOutput }`, which builds the RoundInput from `ms`, calls `simulateRound` with `deriveSeed(matchSeed, 'round', n)`, applies the lifecycle hooks (`freshnessAfterRound`, `xpAfterRound`, `injuriesAfterRound`) and updates the score.
- `betweenRounds(ms): BetweenRoundView` gives the screen data plus auto-swap suggestions for both sides.
- `applyBetweenRound(ms, { home: SwapDecision[]; away: SwapDecision[] }): MatchState`, which runs the legality checks, forced replacements, emergency entrants, captain reassignment and lifecycle's `freshnessBetweenRounds` effects.
- `finishMatch(state, ms): MatchResult`.
- Headless matches call the same functions with auto-swap decisions. A player match is the same sequence with the UI supplying `SwapDecision[]` for the player's side.

**Records.** `MatchResult` adds `squads` (home and away: starters, reserves, rows, captain and vice), `rounds[].input` (the full RoundInput, so a replay or timeline re-simulates any round exactly), `betweenRounds[]` ({ afterRound, home: SwapRecord[], away: SwapRecord[], injured, actingCaptain, freshness snapshot }) and `emergencyEntrants`. `SwapRecord = { out, in, row, reason: 'player' | 'auto' | 'injury' | 'emergency', costsSwap }`. Replays use the recorded inputs and never re-run decision policies.

**MatchState** (persisted while a match is in progress): fixture id, match seed, best-of, score, completed rounds, both sides' state (active five, withdrawn, unused reserves, swaps used, injured, Freshness, acting captain), and phase (`round_pending`, `between_rounds`, `done`).

## 4. Cross-system interactions

| Combination | Resolution | Result |
| --- | --- | --- |
| Ranked passive + perk on the same stat | Both are modifier sources; sum, then clamp | No multiplicative surprises |
| Drowsy Air rank 3 (+23%) + Iron Grip (+8%) | Control duration × 1.31, then DR, tenacity and the 2.5 s cap | Sleep at most 2.5 s |
| Freshness drop during a match | Drain after round n (lifecycle) → the penalty is recomputed at round n + 1's start | The between-round screen shows the new tag before the next round |
| Second Breath + per-round drain | Drain after the round, then +8 at the between-round step | Net drain per round 8 smaller |
| Injury with both swaps used | Emergency entrant, no swap used, never a withdrawn fighter | Never 4 v 5 |
| Captain swapped out | Vice or highest CQ with −10, from the next round | The aura and rally follow the new acting captain |
| Fresh Legs on an entering reserve | `enteredThisRound` true for its first round only | +8% damage and +2 composure in that round |
| Banner Voice + captain grade aura | Composure sources add; captain cap 10% | At most +3 composure from captain sources |

## 5. AI preferences

**Status:** PROPOSED · TUNABLE ([perks.json](content/perks.json) → `aiPreferences`).

- **Skill auto-pick** (lifecycle compares with a stat option's 5 × weight × gain): perk value = autoPickValue (I 1.2, II 1.5, III 1.9) × tag factor (archetype tag weights; hybrids average) × style multiplier (preset style) × context (captain-tag ×2 for captain or vice, ×0.2 otherwise; stamina-tag ×1.6 at STA ≤ 8, ×0.6 at STA ≥ 14; tier III ×1.3), clamped 0.5–3.0. Rank value = 1.0 × 1.25 for the archetype's families × 0.9 for passives × 1.2 if the fighter's preset uses that slot. Ties: higher score, then rank before perk, then content order.
- **Archetype tag weights:** tank defense 1.5, control 1.2, sustain 1.2; melee offense 1.5, tempo 1.2; ranged offense 1.5, tempo 1.2; controller control 1.5, tempo 1.3; healer support 1.5, tempo 1.3 (full table in the data). **Style multipliers:** aggressive offense ×1.4, tempo ×1.2, mobility ×1.1, defense and support ×0.8; protective defense ×1.4, support ×1.3, control ×1.1, offense ×0.8.
- **Swaps:** the auto-swap procedure in sys-match with lifecycle's personality thresholds. Squad choice (which 2 reserves) is sys-ai-manager's: recommended, the two best-fit fit fighters covering the starters' role families, preferring Freshness ≥ 60.

## 6. Content model

| Family | Count | File |
| --- | --- | --- |
| Rank tables | 168 entries (126 rankable × 2 steps) | ability-ranks.json |
| Perks | 72 (12 general, 12 per archetype) | perks.json |
| Class weights | 42 classes with `stamina` (2%) in ratingWeights and statEmphasis | classes.json (only those two maps differ) |
| Combat constants | stamina attribute (no fight formula), freshness curve, match squad and swap constants, vocabulary | combat.patch.json |

## 7. Encounters

The arena and round format are unchanged. A match is now a sequence of rounds with between-round steps.

## 8. Balance plan

**Targets** (PROPOSED · TUNABLE, at typical progression): archetypes 42–58%, classes 35–65%, median fight 25–40 s, time cap < 2%, overtime < 25%; no dominant perk; Freshness clearly felt but moderate; swaps neither rescue nor doom the side that lost round 1.

**Typical progression assumptions** (to be confirmed against lifecycle's soak): a skill slot every 3rd level-up; *season 3 typical* 2 rank-ups and 1 perk; *veteran* 4 rank-ups and 3 perks.

**Harness modes** (`npm run balance -- --mode …`):
1. `progression`: random legal lineups with skills per profile (`season3`, `veteran`), chosen by auto-pick (pass A) or uniformly (pass B).
2. `perk-impact`: per perk, pick rate under auto-pick and win-rate lift against the class baseline (Wilson interval). Dominance index = pick rate × lift. Flag lift > +5 points with the interval excluding 0, a dominance index in the top 3 above 1.0, or a pick share > 60%.
3. `rank-impact`: per ability, rank 3 against rank 1 on otherwise identical fighters. Flag lift > +6 points or < +0.5 point.
4. `fatigue`: identical lineups, one side at a fixed freshness profile, single rounds. Targets for the tired side: one fighter at F 28 → 44–48%; all five at F 52 → 45–49%; all at F 40 → 30–40%; all at F 10 → 15–25%.
5. `squad-match` (new): full matches with 7-fighter squads per side. Starting Freshness is drawn 50–100. Lifecycle's per-round drain and immediate injuries apply (injuries on and off). Auto-swap policies are paired off, injured_only, threshold 40 and threshold 60; mirrored seeds; best-of-3 and best-of-5. Report:
   - **Comeback rate:** P(win match | lost round 1) for each policy, against the same squads with policy `off`. Target: within −3 to +5 points of `off`.
   - **Policy parity:** no policy wins > 56% of matches against `off` with equal squads (swaps help, but a good starting five still matters); `threshold 40` against `off` should land at 51–55%.
   - Reserve value: a squad with 2 reserves against one with 0 should land at 52–58% match wins.
   - Swaps per match (target mean 0.6–1.4), forced replacements and emergency entrants per 100 matches, the share of fighter-rounds played Tired or Spent, and rounds per match.
   - **Overtime and time cap per round** stay within band (< 25%, < 2%); compare rounds after a swap with those without.
6. Regression: `random-draft` with no skills, freshness 100 and no reserves must stay within balance pass 1 results.

**Dominant-strategy risks.** Universal stat perks (kept at 4%); long-range stacking (Deadeye rank 3 + Fletcher's Eye + Glass Cannon; the dominance flag); control stacking (cap and DR); healer sustain (overtime and cap rates); and a "two fresh reserves always" meta that makes squads too strong (reserve value target 52–58%).

## 9. Acceptance scenarios

| ID | Initial state | Action | Exact expected outcome |
| --- | --- | --- | --- |
| rk-001 | Knight (worked example, Power 76), Shield Bash rank 3 | Cast | Cooldown 8 s, focus 15, coefficient 1.54 → 117.04 before mitigation (rank 1: 106.40); stun still 0.8 s before DR and tenacity |
| rk-002 | Chirurgeon (Support 100), Suture rank 2, ally at 30% HP | Release | 2.46 × 100 × 1.3 = **319** healing; rank 3 cooldown 4.5 s |
| rk-003 | Wizard, Firebloom rank 3 | Cast | Radius 3.0 m (rank 1: 2.5 m); coefficient 1.32 |
| rk-004 | Knight, Sworn Shield rank 3 | Ally within 3 m hit | Ally damage-taken modifier −0.12 (rank 1: −0.08) |
| rk-005 | Any control ability at rank 3 | Validate | Hard-control durations equal rank 1 (Slumber 2.5 s, Shield Bash 0.8 s) |
| fr-001 | Worked-example Knight, round starts at F 45 (s = 3,000 bp) | Round build | Interval 1.3 ÷ 0.945 = **1.376 s**; Power trunc(72 × 1.056 × 0.976) = **74**; move **160 mm/tick**; reaction 0.328 s = **6 ticks**; tag "Tired (45)" |
| fr-002 | Same, F 10 | Round build | Interval **1.486 s**; Power **69**; move **153 mm/tick**; reaction **7 ticks**; tag "Spent (10)" |
| fr-003 | F 60 | Round build | s = 0: no penalty, no tag |
| fr-004 | Fighter starts round 1 at F 64; lifecycle drains it to 56 after round 1 | Rounds 1 and 2 | Round 1: no penalty for the whole round. Round 2: s = 800 bp, i.e. attack speed −0.8%, move −0.48%, Power and Support −0.64%, reaction +2%, constant for all of round 2; the between-round screen shows "Ready → Tired (56)" before round 2 |
| pk-001 | F 28 (s 6,400 bp), Long Wind | Round build | Severity 3,840 bp: attack speed −3.84%, move −2.30%, Power and Support −3.07%, reaction +9.6% |
| pk-002 | Knight 1,475 HP with Second Breath at 600 HP; between-round step at F 50 | A hit leaves 450 HP (30.5%); later the round ends | The commit fires `self_hp_below 35`; next tick heals trunc(0.10 × 1475) = **147** → 597 HP; never again that round. At the between-round step Freshness 50 → 58 (after lifecycle's drain) |
| pk-003 | Acting captain grade A (+2) with Banner Voice | Round start | Every fielded ally composure +3 → tenacity +6%; inside the 10% captain cap |
| pk-004 | Fighter holding Finisher and 1 other perk | Offer generation | First Cut never offered (exclusive); Executioner's Rush eligible (2 held + Finisher) |
| pk-005 | Reserve with Fresh Legs enters after round 1 | Rounds 2 and 3 | Round 2: +8% damage dealt, +2 composure (`enteredThisRound` true). Round 3: no bonus |
| st-001 | Class weights | Validate | 13 rating weights per class summing to exactly 1.00; `stamina` = 0.02; no stamina term in any fight formula |
| sw-001 | Squad: 5 starters + 2 reserves, all fit and distinct | Lineup lock | Legal. A duplicate fighter or an injured reserve is rejected with a reason; 0 or 1 reserve is legal when no other fighter is fit |
| sw-002 | Best-of-3, after round 1 (home 0–1) | Home swaps starter A for reserve R1; A keeps slot 2 front | swapsUsed 1; R1 plays round 2 in slot 2, front row, with its own preset; A is withdrawn. After round 2, home proposes A for R1: rejected `not_a_reserve` (a withdrawn fighter cannot return) |
| sw-003 | Best-of-5, both swaps used after round 2; in round 3 starter B is injured (minor) | Between-round step after round 3 | No reserve left: an emergency entrant enters (the best-fit fit roster fighter outside the squad, else a hired blade); swapsUsed stays 2; the record says reason `emergency`, costsSwap false |
| sw-004 | Best-of-3, after round 1: swapsUsed 1, one unused reserve; starter C injured | Between-round step | The reserve enters for C (forced) and swapsUsed becomes 2; no other swap is possible; rounds 2 and 3 use these five unless another injury happens |
| sw-005 | After round 1 both clubs decide | Home swaps, away swaps | Both decisions are made from the same post-round state and applied home then away; neither side's decision depends on the other's; the report shows both lines under "After round 1" |
| sw-006 | Acting captain swapped out after round 1; the vice is active | Round 2 | The vice is acting captain with CQ − 10 (grade recomputed); if the vice is not active, the highest-CQ active fighter (ties: lower slot) |
| sw-007 | Auto-swap threshold 40, keepOneForInjury on; best-of-3 after round 1: starter F 38, reserves at F 90 and F 70 (same role family, rating within 6) | Auto procedure | One swap: starter → the F 90 reserve. A second starter at F 35 is not swapped (the last swap is kept for injury). After round 2 (the last possible step) the second starter is swapped if still below 40 |
| sw-008 | Any played match with swaps | Replay from the MatchResult | Every round re-simulates from `rounds[].input` with an identical event hash and checksum; no decision policy runs during the replay |
| sw-009 | The player quits on the between-round screen after round 1 | Reload | The match resumes on the same screen with round 1's result unchanged and no decision recorded yet |

## Interface with the lifecycle designer (both drafts must state these)

| Topic | Combat (this draft) | Lifecycle (`levels.json`, `progression.md`) |
| --- | --- | --- |
| Stat id | `stamina`, physical, abbr STA; no in-fight formula | race tendency, aging, generation |
| Freshness | penalty curve read at each round start; threshold = `levels.json` freshness.threshold (60); labels from lifecycle | drain **per round played** (after each round), recovery between weeks, labels, injury multiplier, `freshnessAfterRound` hook |
| Injuries | forced replacement and emergency entrant rules; the injured fighter misses later rounds | immediate injury rolls after each round (`injuriesAfterRound`), from its own stream |
| XP | `aftermath` per round in RoundOutput | normal XP for rounds a fighter starts, ⅓ bench rate otherwise (reserves included) |
| Skill offers | slot contents, draw weights, eligibility, `autoPickValue` | when slots appear (every 3rd level-up; two at every 9th), stream, auto-pick comparison |
| Perk lifecycle effects | `freshnessDrainMult` (Campaign Legs), `freshnessBetweenRounds` (Second Breath), `captaincy` (Banner Voice) | implements them |
| AI swap policy | auto-swap procedure | personality thresholds and the AI rotation between matches |
| Rating | ratingWeights including `stamina` (2%) | rating, potential and wPhys |

## Owner confirmations needed

Approved and removed from this list: (a) a withdrawn fighter cannot return (owner ruling, 2026-10-26).

| ID | Question | Recommendation |
| --- | --- | --- |
| cmb11-q1 | Basic attacks never rank; actives and passives rank 1 → 3 by family template | **Approve.** A basic-attack rank would be every fighter's first pick |
| cmb11-q2 | Ranks never lengthen hard control | **Approve.** Disables stay short; passives and perks that add duration stay under the 2.5 s cap and DR |
| cmb11-q3 | Perk rules: 72 perks, cap 4 with at most 1 tier III, tiers gated by perks held, permanent in M1.1 | **Approve**; revisit the cap after the veteran-profile harness run |
| cmb11-q4 | Stamina has no fight formula and a 2% rating weight for every class | **Approve.** It follows the owner's "no effects during combat"; ratings move by at most 2 points |
| cmb11-q5 | Freshness penalty read at each round start: none at 60+, full at 10 (−10% attack speed, −6% move, −8% Power and Support, +25% reaction delay) | **Approve**, tune after the `fatigue` and `squad-match` modes |
| cmb11-q6 | Perk names and the sim extensions (perk passives, fatigueResist, 3 predicates, 2 triggers, trigger `if`, aura `requires`) | **Approve**; names are data |
| cmb11-q7 | Swaps only between rounds, decided simultaneously and blind; none before round 1 | **Approve.** Clear decision points and no information race |
| cmb11-q8 (b) | An injured fighter misses the rest of the match; an unused reserve replaces them and uses a swap; with none left, an emergency entrant (best-fit fit roster fighter outside the squad, else a hired blade) enters without a swap | **Approve.** Never 4 v 5, and withdrawn fighters stay out |
| cmb11-q9 (c) | A withdrawn or injured captain hands over to the vice, else the highest CQ, with CQ − 10 | **Approve** (the existing interim rule) |
| cmb11-q10 (d) | The entering fighter takes the outgoing fighter's slot and row unless the player picks the other row | **Approve** |
| cmb11-q11 (e) | Presets travel with the fighter | **Approve** |
| cmb11-q12 | Auto-swap default: threshold 40 with a 15-point Freshness margin and keepOneForInjury on; the M1.1 player default pauses between every round | **Approve for M1.1**; switch the default to `when_urgent` after playtests if pauses feel heavy |
