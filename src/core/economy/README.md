# core/economy

**Owner:** WP4 (economy). **Status:** M1 implemented (branch `m1/wp4-economy`). Every function of the `index.ts` contract is implemented; extra exports are additive. Spec: docs/design/03 §3.3 (merged) and docs/design/_drafts/03-league-economy.md (sys-finance, sys-contracts, sys-transfers, sys-roster cap and hired blades). Values: `content/default/economy.json`, `leagues.json`, `development.json`.

## Files
| File | What |
| --- | --- |
| `index.ts` | public contract (05 §9.2) and additive exports |
| `ledger.ts` | `postAt` — the only writer of `Club.finance.balance` and `GameState.ledger`; `ledgerInvariantViolations` (soak) |
| `wages.ts` | market wage (EQ, curve, age/trait/role/fan appeal), asks (tier gap, prestige, length, greed, wage demand, renewal situation: `seasonStarts` reads each match's round-1 five through `fieldedFive`, so compacted matches count the same), greed labels |
| `budget.ts` | retainer, gate (exact form term), grant installments, Registry deduction, SB, reserve, WB, in-season SB parts |
| `offers.ts` | `evaluateOffer` (cap, hard commitment rule, cash, embargo, blocks), offers, counters, patience, renewals, trials, releases, free-agent decisions |
| `pool.ts` | greed roll, Trials Day assignment, hired blades, pool floors (journeymen), pool maintenance |
| `season.ts` | weekly income/costs/status, prizes, prestige, expiries, next-season setup, new-career finances |
| `view.ts` | `financeView`, `financeDetails` |
| `fighter-values.ts` | the only bridge to core/fighters (rating, potential, human-age, fit, createFighter) |
| `testing.ts`, `finance-sim.ts` | TEST SUPPORT only (fighter doubles, state builders, the one-season simulation) |

## Rules kept
- Integer gold and bp; each formula truncates once at its end; wages/asks floor to 5, costs/payouts/prizes to 10.
- Invariant after every operation: `balance == openingBalances[club] + Σ entries` (current season). The ledger is reset at next-season setup (opening = pre-setup balance) after the ending season's totals are written to the club's history row (`income`, `costs`, `endBalance`).
- Same rules for player and AI (P-04). Randomness: `STREAM.market` (greed, tie lots, journeymen, hired blades), `STREAM.rookies` (Trials Day).
- Ledger stamps: week processing → its week; setup entries → `{newSeason, SETUP_WEEK_INDEX = 0}`; season-end prizes → `{season, W + 1}`; commands in the season-end AI phase → the coming season's setup.

## Technical decisions (for the architect, proposed `tech-` entries)
1. **Agreed renewals** are stored on the contract: `Contract.next = { wagePerWeek, endSeason }`. The contract's `endSeason` is extended at once (`next.endSeason` equals it); the old wage is paid until next-season setup, which applies `next.wagePerWeek` and clears `next` (03: "new terms start at season-end setup"). Read it with `agreedRenewal()`. Renewal negotiations hold only open talks (patience, counters). Save v1 → v2 moves the old agreed-renewal negotiations to `Contract.next`.
2. **Commitment rule** uses the bill with agreed renewal raises (max of current and agreed wage), so renewals cannot over-commit next season.
3. **Registry advance prestige −5** is applied once, in the season-end prestige update (its `advancePenalty` term), not at the processing; the result is identical and keeps prestige (retainer, gate) constant in-season.
4. **In-season grant due** is derived from the fixed SB minus its other parts (retainer and gate are constant in-season; parachute and promotion grant are read from the ledger).
5. Offers below the tier minimum are refused (`offer.below-minimum`); offers above 1.5 × ask are capped; a new offer to the same fighter replaces the pending one. The cash check is skipped when the signing cost is 0 (embargo terms, trials).
6. Counters: free-agent counters are valid through the next processing; renewal and trials counters (made during week w) through week w's processing. Trials signings use free-agent patience.
7. Free-agent patience is per (fighter, club, season) in `market.negotiations`; `market.refusalsThisSeason` is a per-club counter only.
8. Movement at setup is detected from the ending season's archived tier table (or its league competition) against the club's current tier; parachute/ascension counters include the current season.
9. Pool leavers (2 unsigned season ends) get status `retired` with `freeAgency` kept; past hired blades keep status `hired-blade` with `clubId` null. At the end of the season-end step core/game moves both, and every retired fighter, to `GameState.alumni` (slim records; `personName` finds them).
10. Economy digest items are written for the player's club only.
11. Final gate: computed with the higher seed's (home side) parameters, split evenly, odd unit to it.
12. **Membership** (`clubId`, `status`) changes only through `setMembership` (core/model indexes), so roster and pool indexes stay exact. `FreeAgency.enteredAt` is the game time a fighter entered the pool (release, expiry, Trials Day release, generation).
13. **Weekly projection.** `financeView().weeklyProjection` lists each remaining week (income, costs, net, running balance from the balance less pending signing costs); its last balance is `projectedSeasonEndBalance`.
14. **Opening bills (new career).** Contracts are signed at asks, then each club's bill is rescaled into `budget.worldGenBillBandBp` of WB (optional economy.json key, default `{ minBp: 8200, maxBp: 9200 }`; tuning CR-1, replacing the 95% drop-trim). Only if the tier minimum keeps a bill above the band are the lowest value-per-wage fighters released, down to the AI roster minimum.
15. **Free-agent tie-breaks** follow `market.tieBreakers` (`higherPrestige`, `higherTier`, `lot`) in content order, then the lot and club id.

## PROVISIONAL constants (OPEN, content requested)
- `PROVISIONAL_JOURNEYMAN_HUMAN_AGE` 26–33 (03 sys-transfers) → `development.json generation.journeyman`.
- `PROVISIONAL_WORLDGEN_BILL_SHARE_BP` 9500 (03 §7 "95% of WB") → `economy.json budget`.
- Hired blades use `generationShifts.generatedFreeAgent` as their potential shift (no `hiredBlade` key outside the EXAMPLE block).

## Verification
`npm run check` and `npm run build` green. Tests: worked examples (Brannoc asks 360/420/350, the Banner SB 85,008 / WB 3,257, le-009 … le-024, le-028, le-029), money flows (`finance-sim.test.ts`: one season over 48 clubs, invariant after every operation, tier flows within ±5% of 03 §8; three seasons twice → identical state), real-fighter integration (`integration.test.ts`).

## Known gaps
- No patron goal (D-C). AI decisions are core/ai (WP5); `finance-sim.ts` has only a minimal test policy.
- Lineups, captaincy and shortlists are not cleaned when a fighter leaves a roster (game/fighters own them).

## Orchestrator decisions (M1 core fix round, pending owner confirmation)
- **D-P, P1 wage room.** Opening bills are rescaled into `budget.worldGenBillBandBp` = 80-87% of WB, and a Trials Day rookie asks his own club at most the rookie scale `market.trialsDay.maxAskBpOfTierMinWage` = 1.25 × the tier minimum (never below it; his open-market ask applies once he is in the pool). So at P1 every club can sign its season-1 rookie and still has wage room for one tier-minimum depth signing (at most 12.5% of WB is needed in Muster, 12% in Banner, 8% in Crown). In Muster the roster cap (10, world rosters 9) is then full: a depth signing there needs a release. The finance simulation test allows the season-1 wage flow down to the band's bottom edge.

## Polish round (QA findings; orchestrator decisions pending owner confirmation)
- **Renewal window.** The final-season check compares the contract's end with the season being played (`calendar.season`), so renewals work through the Reckoning and the pending season-end step (the market clock already reads the coming season then). The renewal situation counts starts in the season being played.
- **Tier-minimum raises** at next-season setup (promotion, the raise rule) are recorded on the ending season's `SeasonRecord.wageRaises` and posted to the player as `contract.minimum_raise` (refs.fighterId; params from, to).
- **Money check (QA, 5-6 seasons).** No double crediting: per season two grant installments, 23 sponsor parts, one gate per home match, one table prize, one tournament prize per Reckoning run. Balances grow because a club spends at most its WB (wage ratio of the season budget plus a reserve contribution capped at 10% of it), and M1 has no other spending outlet; a winning club adds prizes and win bonuses. Known issue for M6/M7 (spending outlets).

## R2-T006: renewals use next season's wage room (`next-season.ts`)
Owner ruling (playtest R2): "when renewing, we should be able to use funds that are expected to be available the following year". A renewal's terms start at next-season setup, and a contract that ends this season is gone by then, so the commitment rule judges a renewal against **next season's wage room** instead of this season's bill:
- `room = projected wage budget - commitments`. **Projected wage budget** = the club's current `wageBudgetPerWeek`: a projection that assumes no promotion or relegation (and unchanged prestige and reserve); the real budget is set at next-season setup. **Commitments** = contracts that continue into next season (`endSeason` after the current season) at their current wage + agreed renewals (`Contract.next`) at the agreed wage + pending offers that would run into next season (made for next season, or for 2+ seasons). **Contracts ending this season and not renewed are not counted.** Not projected: tier-minimum raises and the relegation drop clause at setup.
- `evaluateOffer` applies it when `kind` is `renewal`, and to free-agent offers made while the season-end step is pending (they start next season). Everything that starts this season (in-season free-agent offers, trials signings) keeps this season's room (`committedBillOf`: bill with agreed raises + pending offers). The exemption stays: a renewal that does not raise the fighter's wage is allowed whatever the room. Embargo, cash, cap and the other rules are unchanged. `OfferCheck.basis` says which room was used; a refusal is `budget.wage` with `details.basis` (`'next-season'` adds `nextSeasonWageRoom`, `wageBudget`, `committed`, `over`).
- **Reads.** `nextSeasonWage(state, clubId): NextSeasonWage` = `{ season, projectedWageBudget, continuing, agreedRenewals, pendingOffers, commitments, wageRoom, expiring: { fighterIds, wagePerWeek }, assumesNoTierChange }`; the same object is `FinanceView.nextSeason` (with `FinanceView.nextSeasonWageRoom`) and `FinanceDetails.nextSeason`.
- **One rulebook for every club.** The rule lives in `evaluateOffer`, which every command goes through (player and AI: `contract.renew`, `offer.make`, the AI's own `checkOffer` pre-check), so an AI club's renewal is judged on next-season room exactly like the player's. The AI's own spending policy is separate and unchanged: its renewal pass still budgets against `wageUseBp x WB` on the current bill (agreed raises and pending offers included), which is stricter than the rule, so it never asks for a renewal the rule would refuse and the league dynamics did not move. Budgeting the AI's renewals on next-season commitments instead was tried: AI clubs then kept nearly every expiring fighter at his market ask and the 10-season soak failed `wage-inflation` (median wage +15% in a season, band 10%) and `age-distribution` (share of fighters aged 22 or under 11.5%, band 12%). That is an AI-economy tuning decision (personality wage use, renewal haggle), left open.
- **Known gap.** A multi-season free-agent signing made in-season is judged on this season's room only; it counts as a continuing commitment for later renewals, but nothing re-checks it against next season's room (a bill above the budget only means no wage room until it drops).
