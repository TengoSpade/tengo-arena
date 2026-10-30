# M1.1 combat content: schema notes for the architect

Combat designer, 2026-10-26, v0.2. Spec: [../combat-skills.md](../combat-skills.md). All files here are proposals; nothing in `content/default` changes until you integrate them. Units follow the existing suffix convention (`S` seconds, `M` metres); unsuffixed fractions are decimals that convert to basis points.

## Files

| File | Shape | Integration |
| --- | --- | --- |
| `ability-ranks.json` | `{ _doc, schemaVersion, status, templates, familyRules, eligibility, ranks: RankRow[] }` | New content file (or merge each row's `ranks` into its ability) |
| `perks.json` | `{ _doc, schemaVersion, status, rules, extensions, tags, aiPreferences, perks: Perk[] }` | New content file |
| `classes.json` | full copy of `content/default/classes.json`; only `ratingWeights` and `statEmphasis` differ (a 13th key, `stamina`, weight 0.02) | Replace after adding `stamina` to `STAT_IDS` |
| `combat.patch.json` | additions only: stamina attribute, `freshness` curve, `match` (squads, swaps, auto-swap defaults, pacing), vocabulary, fight-input fields | Merge into `combat.json` |

## Types

```ts
type RankRow = {
  abilityId: AbilityId; classId: ClassId; slot: 'basic' | 'a1' | 'a2' | 'passive';
  rankable: boolean;            // false only for basic attacks (ranks: [])
  family: 'basic' | 'damage' | 'area_damage' | 'control' | 'heal' | 'shield' | 'buff' | 'debuff' | 'mobility' | 'protect' | 'ward' | 'passive';
  ranks: { rank: 2 | 3; summary: string; changes: RankChange[] }[];   // rank 3 applies on top of rank 2
};
type RankChange = { path: string /* JSON pointer into the Ability */; from: number; to: number;
  kind: 'magnitude' | 'cooldown' | 'duration' | 'area' | 'focus' | 'extra'; label: string };

type Perk = {
  id: PerkId; name: string; archetype: 'general' | ArchetypeId; tier: 1 | 2 | 3; iconId: string; tags: PerkTag[]; text: string;
  requires: { minPerksHeld: 0 | 1 | 2; anyPerks: PerkId[]; minStats: Partial<Record<StatId, number>> };
  autoPickValue: number;
  exclusiveWith: PerkId[];      // symmetric
  passive: Passive | null;      // PassiveSchema + extensions below
  traitEffects: TraitEffect[];  // combat-owned trait effect types only
  lifecycleEffects: ({ type: 'freshnessDrainMult'; mult: number } | { type: 'freshnessBetweenRounds'; add: number } | { type: 'captaincy'; add: number })[];
};
type PerkTag = 'offense' | 'defense' | 'sustain' | 'control' | 'support' | 'tempo' | 'mobility' | 'stamina' | 'captain';

// round-by-round matches (sys-match)
type SwapDecision = { out: FighterId; in: FighterId; row?: 'front' | 'back' };
type SwapRecord = SwapDecision & { row: 'front' | 'back'; reason: 'player' | 'auto' | 'injury' | 'emergency'; costsSwap: boolean };
type BetweenRoundRecord = { afterRound: number; home: SwapRecord[]; away: SwapRecord[]; injured: FighterId[];
  actingCaptain: { home: FighterId; away: FighterId }; freshness: Record<FighterId, number> };
type MatchSquad = { starters: FighterId[] /* 5 */; reserves: FighterId[] /* 0-2 */; rows: Record<FighterId, 'front' | 'back'>;
  captainId: FighterId; viceCaptainId: FighterId | null };
```

## Vocabulary extensions (closed lists to extend)

1. `STAT_IDS` += `stamina` (physical); `PHYSICAL_STAT_IDS` += `stamina`. No derived-stat formula uses it.
2. `STAT_MOD_STATS` += `fatigueResist` (fraction; summed, clamped 0–1; constant per round).
3. `EFFECT_PREDICATES` += `self_is_captain`, `self_freshness_below { pct }` (start-of-round value), `self_fresh_entry` (the fighter entered from the reserves or as an emergency entrant for this round).
4. `TRIGGER_EVENTS` += `self_hp_below { pct }` (once per round per trigger, at the commit where HP first drops below pct, after Deathward) and `ability_release { slot?: 'a1' | 'a2' }`.
5. `TriggerSchema` += optional `if: EffectPredicate` and optional `slot`.
6. Aura += optional `requires: EffectPredicate` on the aura owner.
7. `FightFighterInput` (per round) += `freshness` (int 0–100, default 100; the value at this round's start), `abilityRanks` ({ a1, a2, passive: 1–3 }, default 1), `perkIds` (0–4), `enteredThisRound` (bool, default false).

## Operation contracts

- **core/sim:** `simulateRound(input: RoundInput, roundSeed: Seed, content, options?): RoundOutput` (today's `simulateFight` renamed). `RoundInput = { round; home: SideRoundInput; away: SideRoundInput }`, where SideRoundInput is today's SideInput with the per-round fighter fields. `RoundOutput = { result: RoundResult; fighterStats; aftermath: { fighterId; damageTaken; downed; largestHit; downCause }[]; log }`. Keep `simulateMatch` only as a test helper that runs the orchestrator with auto-swap `off`.
- **core/game orchestrator (pure):** `startMatch(state, fixtureId, squads) → MatchState`; `playRound(state, ms) → { ms, roundOutput }`, which calls lifecycle hooks `freshnessAfterRound`, `xpAfterRound` and `injuriesAfterRound`; `betweenRounds(ms) → BetweenRoundView` (screen data and auto-swap suggestions for both sides); `applyBetweenRound(ms, { home, away }) → MatchState`, which runs legality checks, forced replacements, emergency entrants, captain reassignment and `freshnessBetweenRounds`; `finishMatch(state, ms) → MatchResult`.
- **MatchState** (persisted mid-match): fixtureId, matchSeed, bestOf, score, completed RoundResults, per side { active five with rows, withdrawn, unusedReserves, swapsUsed, injured, freshness, actingCaptain, emergencyEntrants }, phase `round_pending` | `between_rounds` | `done`.
- **MatchResult** += `squads: { home: MatchSquad; away: MatchSquad }`, `rounds[].input: RoundInput` (a replay re-simulates any round exactly), `betweenRounds: BetweenRoundRecord[]`, `emergencyEntrants: FighterId[]`. Replays never re-run decision policies.
- **Swap legality reasons** (enum): `match_decided`, `no_swaps_left`, `not_active`, `not_a_reserve` (also covers withdrawn fighters, who can never return), `reserve_unfit`, `duplicate`.
- **Saving:** commit each completed round and each between-round decision immediately; resuming lands on the same between-round screen (P-05, no reroll).

## Validation to add

- Rank rows: one per ability; `rankable === (kind !== 'basic')`; ranks 2 and 3 non-empty; applying the changes, every `from` matches; after each rank, hard-control durations unchanged, magnitudes within caps, cooldown ≥ 1 s, focus ≥ 10, exact unit conversion.
- Perks: unique ids and names; tiers 1–3; tier 3 lists a lower-tier prerequisite in the same archetype or general; symmetric exclusions; `minStats` keys are stat ids; triggers and predicates within the extended lists; no hard-control statuses.
- Classes: 13 rating weights summing to exactly 1.00; `statEmphasis.stamina` within 0.5–2.0.
- Squads at lineup lock: 5 starters and 0–2 reserves, all distinct and fit; hired blades only as starters.

## Sim compile notes

- Ranks: precompile `rankedAbility(ability, r)` per (ability, rank) at content load.
- Perks: compile like a class passive into the existing mod lists, the aura table (slot key = perk id) and triggers; trait-type entries reuse `compileTrait`.
- Freshness: at round build, s = clamp(trunc((60 − F) × 10,000 ÷ 50), 0, 10,000) bp; add attackSpeed −1,000·s, moveSpeed −600·s, power −800·s, support −800·s, reactionDelay +2,500·s (÷ 10,000), each × (10,000 − fatigueResist) ÷ 10,000. Constant for the round.
- Report: `fight.start` unit data += `freshness`, `fatigueBp`, `abilityRanks`, `perkIds`, `enteredThisRound`. The match report renders per-round lineups and `betweenRounds` swap lines from the MatchResult (no new fight events).
