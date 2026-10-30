# core/ai

**Owner:** WP5 (game loop). **Status:** implemented. Public API: `planWeek`, `planSeasonEnd`, `chooseLineup`, `valueFighter` (contract), plus `createAi(ports)`, `emphasisFor`, `roleFamilies`, `stylePreset` (delegates to `tactics.presetForStyle`) and the `AiApi` extras `chooseCaptains`, `planRoster`, `beginPhase`.

## Rules kept
- **One rulebook (P-04):** the AI only returns `Command`s; core/game validates them exactly like the player's. Tests check that planning never changes the state it reads.
- **Never reads another club's pending offers** (the player's included), never tanks, never breaks the commitment rule (checked through `economy.checkOffer` before an offer is made).
- **Deterministic without RNG:** every tie breaks on stable keys (rating, CQ, seniority, fighter id); `STREAM.ai` is unused (reserved for future tie lots).

## Procedures (03 sys-ai-manager, §5.2)
`planWeek`: 1 renewals from `ai.renewalWeeksFrom` (rank within the roster target by aiValue, the personality's age rule, ask × (1 − haggle), the full ask after a refusal, the counter when one is valid; agreed renewals skipped); 2 releases in P1–P4 (cap relief lowest aiValue first; voluntary releases within the season allowance, surplus < 0, payout ≤ 10% SB and the reserve floor); 3–4 counters accepted, then up to `maxNewOffersPerWeek` offers while roster + pending < target, ranked by surplus × 10⁶ ÷ ask (Glory-hunters by surplus), star overbid for the top 20% of the pool, wage ceiling WB × wageUse (full WB when rich or below the roster minimum), reserve floor; embargo terms; 6 captain and vice-captain (D-I: mid-season only on a vacancy or an injury of 4+ weeks); 7 training emphasis (first matching rule); 8 lineup (best Tank, best Healer, then the three highest-rated; Seedbed prospect swap; at-risk resting in league matches only; rows from the class; presets by tacticsStyle → style).
`planSeasonEnd`: trials signings (surplus > 0, or Seedbed gap ≥ 15), cap-relief releases, opening offers, captaincy with the 5-CQ hysteresis, training, lineup.

## Depth (tuning pass m1/fix-tuning)
So AI rosters sit within 2 of the cap with legal reserves (owner target), while staying solvent:
- The core offer pass keeps wage room for the reserves still missing below the **depth floor** (cap − 2, at least the roster minimum, at most the target) at the tier minimum wage.
- After the core pass, remaining places up to the roster target are filled with **depth signings**: free agents whose ask is at most 2× the tier minimum, ranked by aiValue + ½ × (potential − rating) (prospects first), with no surplus requirement. Same commitment checks as any offer; none while embargoed.
- **Trials rookies** may be signed as depth (no surplus needed) into places below the target when their ask fits the depth cap, and every AI trials signing is a 3-season deal.
- **Voluntary releases** happen only when the roster is at its target (a below-replacement reserve under the target is depth, not dead weight).

## Provisional constants (OPEN; content requested)
`PROVISIONAL_AGE_RULES` (Seedbed > 27, Old hands < 24 unless a starter), `PROVISIONAL_VOLUNTARY_RELEASE_MAX_PAYOUT_BP` (10% of SB), `PROVISIONAL_SEEDBED_ROOKIE_MIN_GAP` (15), `PROVISIONAL_CAPTAIN_INJURY_WEEKS` (4), `PROVISIONAL_RANK_BY_SURPLUS` (`star_chasing`), `PROVISIONAL_DEPTH_FLOOR_BELOW_CAP` (2), `PROVISIONAL_DEPTH_MAX_ASK_BP_OF_TIER_MIN` (20000), `PROVISIONAL_DEPTH_POTENTIAL_WEIGHT_BP` (5000), `PROVISIONAL_TRIALS_ROOKIE_SEASONS` (3). Request: fields in `economy.json aiPersonalities` / `ai`.

## Performance
Fighter-level values (rating, potential, human-age) are memoised per call, and shared across clubs within one AI action phase (`beginPhase`), because no AI command changes them.

## Orchestrator decisions (M1 core fix round, pending owner confirmation)
- **D-T veteran penalty.** `veteranPenaltyPerHumanYearOver` stands for expected decline, which is physical only, so it scales with the class's physical rating-weight share: in full at a 50/50 class, about half for healers and controllers, about 1.5× for melee and ranged.

## M1.1 squads (levels.json aiRotation; progression.md §5)
`chooseLineup` picks the best five by rating and role as before, then rotates: (1) projected rest: a starter with Freshness < threshold + his typical round drain (`fighters.typicalRoundDrain10`; the Reckoning: < `tournamentRestBelow`) is replaced by the best fit fighter of his role family with Freshness ≥ threshold and rating ≥ his − (`leagueMaxRatingGap` + `extraGapPerPointBelow` × points below the threshold; Reckoning `tournamentMaxRatingGap`), most tired first, at most `maxRestsPerMatch`; (2) spent floor: below `spentFloorAtLock`, the best fit fighter at ≥ `spentFloorAltMin`, rating aside. Then 2 reserves: the best remaining fit fighters at Freshness ≥ threshold, one front row and one back row when available. The plan issues `squad.set`. Freshness in tenths, ratings × 10 (integer math). Between rounds AI clubs use the club's `autoSwap` rules (personality thresholds from `clubMatchDefaults`) through core/game's `autoSwapDecisions`.

## M2 (arena viewer)
AI clubs never watch (05-technical-m2 §A3): only the player's fixture can start with `AdvanceOptions.playerMatch` 'watch', and every other match of the week, the player's opponent's side included, is decided by the same auto rules as before (`playMatchAuto`, `autoSwapDecisions`). No AI command touches `liveMatch.watch`; `match.watch` is refused for any club but the player's (`match.not-player-club`). With calls (the calls package, P-01), AI sides will use the call policy inside the sim, never the player's explicit plan.
