# Arena League — league, calendar and economy (phase-2 draft for document 03)

> ARENA LEAGUE DESIGN PACKAGE · PHASE-2 DRAFT · 2026-10-25 · league-economy designer. Not approved and not merged. It drafts the management systems that document 03 §2 assigns to `03-league-economy`: sys-league, sys-calendar, sys-tournament, sys-roster, sys-contracts, sys-transfers (the brief's "sys-market"), sys-finance and sys-ai-manager, plus the M1-light part of sys-patron and the M6 hooks of sys-cups.
> Follow the labels, glossary and authority rules of [document 01](../01-game-vision-and-design-principles.md). Only owner requirements and decisions (R, T, V, G, O) are REQUIRED. Every number here is a provisional value on a behavior the owner has not yet approved, so it is written **PROPOSED · TUNABLE**, as 01 requires. Choices that are not numbers are **PROPOSED** (this draft's working design) or **OPEN** (a decision for the owner, listed at the end with a recommendation). Content data: [`content/default/leagues.json`](../../../content/default/leagues.json), [`clubs.json`](../../../content/default/clubs.json), [`economy.json`](../../../content/default/economy.json).

| Field | Value |
| --- | --- |
| Game / version / updated | Arena League / draft v0.1 / 2026-10-25 |
| Status / design owner | Phase-2 draft, not reviewed / the project owner |
| Milestone covered | M1 "Season MVP" (O14) in full. M4 (scouting), M5 (academy) and M6 (regions, cups, transfers, patron) appear only as labeled hooks |
| Answers | open-014 (league structure), open-028 (budget model), and the economy parts of open-005, open-006, open-007 and open-013 |

## 0. Decisions at a glance

| Topic | This draft (PROPOSED unless an O-ID is cited) |
| --- | --- |
| World | One league region, **Saltmarch**, with **3 tiers × 16 clubs = 48 clubs**. Emberreach and Thornwald are talent pools only until M6 (open-027) |
| Tiers | Tier 1 **Crown Circuit**, tier 2 **Banner Circuit**, tier 3 **Muster Circuit**. Roster caps 14 / 12 / 10 and academy capacity equal to the cap (O2) |
| Regular season | Each tier has two 8-club **wings** (Dawn and Dusk), redrawn every season by a serpentine on last season's finish. Double round-robin inside the wing (14 matches) plus 2 cross-wing matches = **16 matches for every club, 8 home and 8 away, no byes** (O9) |
| Points | 3 for a 2–0 win, 2 for 2–1, 1 for 1–2, 0 for 0–2 (adopted from open-014) |
| Tournament | The **Reckoning**: top 4 of each wing; wing winners are seeds 1–2; QF 1v8, 4v5, 2v7, 3v6; QF and SF best-of-3 hosted by the higher seed; final best-of-5 at the neutral **Charterhall** (O9, P-02) |
| Promotion / relegation | 2 down: 8th place in each wing. 2 up: the lower tier's Reckoning champion, plus its **Shield** winner (best regular-season record), or the next-best club if both are the same club |
| Soft landings | Promotion grant, a higher wage ratio in the first season up, and fighters' wage demands that do not jump. Relegation brings a **drop clause** (wages −20%), parachute money and payout-free releases down to the new cap |
| Calendar | 23 weeks: P1–P4 (P1 is Trials Day), MW1–MW16, TW1–TW3, then the season-end step. The free-agent market is open every week |
| Money | One integer currency: "gold" in rules (01 §7), displayed as the **tessel (ts)** in the default theme (OPEN) |
| Budgets (par prestige) | Season budget (SB) **Crown 202,000 · Banner 82,400 · Muster 32,400 ts**, about 183k–221k / 75k–90k / 29k–35k across the prestige range. Weekly wage budget at the default starting balance: **7,454 / 2,960 / 1,138 ts** |
| Wage formula | `ask = floor5( curve(rating + potential bonus) × (1 + age + traits + role + fan appeal) × (1 + tier gap + prestige + length + greed + situation) )`, clamped to [tier minimum, 4,000] |
| Market | Offers on free agents are answered at **week processing**. The fighter takes the best acceptable offer, scored by wage ÷ that club's ask, plus a bonus if he would start. Trials-day rookies and renewals answer at once |
| Failure ladder | Watch → embargo (balance < 0) → Registry advance after 8 weeks in debt, repaid from up to 30% of later central grants. Clubs never fold (open-007) |
| AI | The same rulebook (P-04). Five scoutable personalities (Steady hands, Ledger-keepers, Glory-hunters, Seedbed, Old hands), each with a tactics style tag |

## 1. Mechanical foundations (management scope)

**Status:** REQUIRED where an ID is cited. The rest is PROPOSED and consistent with 03 §1.

| Topic | Decision | Player-visible consequence |
| --- | --- | --- |
| Time model | Calendar time moves only on Continue, one week per press (02 §3). A season has 23 weeks (sys-calendar) plus a season-end step that is not a week. Wages, operating costs and sponsor retainers are charged or paid at **every** week processing | Every week costs money, including preseason and tournament weeks a club is not playing in |
| Money units | Gold is an integer (03 §1). Ratios and modifiers are integer **basis points (bp)**, 10,000 bp = 100%. Wages are per week. Contract lengths are whole seasons and end at a season end | "Wage 360 ts/week", "signing cost 1,620 ts" |
| Rounding | Each formula computes in integers and rounds once at its end, toward zero (03 §1). Wages and asks then floor to a multiple of 5 gold, and signing costs, payouts and prizes to a multiple of 10. Products of two bp factors are evaluated as `a × b × c / 10⁸` (safe below 2⁵³) | Displayed prices are what is charged |
| Information model | M1–M3: every club sees exact ratings, potential, traits, contracts, greed label and asks (open-026). Every management read of a fighter goes through `sys-knowledge.view(viewerClubId, fighterId)`, which returns true values until M4 (hook). AI valuations use the same view (P-04) | The M1 market is fully transparent. From M4 the same screens show ranges |
| Uncertainty | Deterministic rules wherever possible. Seeded draws only for: wing slot shuffles and lots (stream `schedule`); fighter greed at generation and trials-day remainder (streams `market` and `rookies`); AI tie-break lots (stream `ai`). Path segments: season, week, tier or club id (src/core/rng/streams.ts) | Re-running a seed reproduces the schedule, every negotiation and every AI move |
| Resolution order | The fixed week-processing order and season-end order in sys-calendar. Within a step, clubs are processed in tier level order, then club id order, and free agents by market wage descending, then fighter id | No order advantage for the player or for any AI club |
| Ownership | A fighter is in exactly one state: on one club's roster, in one academy (M5), a free agent, or retired (03 §1). At most one contract per fighter, and at most one **pending** offer per (club, fighter) | A fighter can never be signed twice |

## 2. System inventory (this draft's slice of 03 §2)

**Status:** the sys-ids are fixed by 03 §2. "sys-market" in the drafting brief is sys-transfers in M1 (free agents only); no new id is introduced.

| System ID | Purpose in the player experience | Depends on | M1 behavior | Later growth |
| --- | --- | --- | --- | --- |
| sys-league | Region, tiers, wings, fixtures, standings, tiebreaks, promotion/relegation, prestige, prize table | sys-calendar, sys-match | 1 region, 3 tiers × 16 | M6: 3 regions (P-08) |
| sys-calendar | The 23-week season, week processing order, season-end order, digest triggers | sys-league, sys-tournament | Full | M6: cup and window weeks |
| sys-tournament | The Reckoning: 8-club knockout per tier | sys-league, sys-match | Full | — |
| sys-roster | Cap, lineup lock, eligibility, hired blades | sys-fighters, sys-captaincy | Full | M5: academy pool |
| sys-contracts | Wage demand, lengths, signing costs, renewals, releases, expiry, drop clause | sys-fighters, sys-finance | Full | M6: clauses (release fee, sell-on) |
| sys-transfers | Free-agent pool, offers, decisions, trials day | sys-contracts, sys-finance | Free agents only (O14) | M4: knowledge. M6: club-to-club transfers |
| sys-finance | Season budget, wage budget, ledger, gate, sponsors, prizes, embargo, Registry advance | sys-league, sys-contracts | Full | M6: cup prizes, fees |
| sys-ai-manager | AI clubs' lineups, presets, captains, signings, renewals, releases, spending | all of the above | Full | M3 rules, M4 scouting, M5 academy |
| sys-patron | Season goal and bonus | sys-league, sys-finance | **M1-light (OPEN)** | M6: patience, dismissal |
| sys-cups | Regional and cross-region cups | sys-league, sys-calendar | FUTURE hooks only | M6 |

## 3. System specifications

### sys-league: regions, tiers, wings, fixtures, standings, promotion and relegation

**Status / scope:** M1. Tier count, caps and the 16-match season are REQUIRED (R4, O2, O9). The structure is PROPOSED (answers open-014). The numbers are PROPOSED · TUNABLE.

**Purpose:** a ladder the player can climb, with known rivals met twice, a top-4 race in every wing, and promotion and relegation stakes in every tier.

**Why this structure (open-014).** The owner asked for 16 matches with no byes if possible. Three layouts give 16 matches:

| Option | Byes | Home / away | Tournament cut | Rivals | Verdict |
| --- | --- | --- | --- | --- | --- |
| **16 clubs: two 8-club wings, double round-robin + 2 cross-wing (chosen)** | none: 8 fixtures every matchweek | exactly 8 / 8 | top 4 of 8 in each wing: half qualify, the race is visible in an 8-row table | 7 wing rivals met twice (home and away), plus 2 from the other wing | Even gate income, no idle weeks (C1.9), relegation as clear as "last in your wing" |
| 17 clubs, single round-robin (01 open-014 recommendation) | one per club (17 matchweeks) | 8 / 8 | top 8 of 17 | each rival met once | A bye week is a dead week; no home-and-away rivalry |
| 9 clubs, double round-robin | two per club (18 matchweeks) | 8 / 8 | top 8 of 9: qualification is trivial | met twice | Fails the "top 8 must matter" test |

Three tiers rather than two: the O2 caps are written for three (10/12/14), a first career that starts in tier 3 gets a two-step climb, and promotion keeps meaning something after the first one. 48 clubs cost 384 league and 21 tournament matches per season in the headless sim.

**Entities and state**

- *Region* `{id, name, hostsLeagues, districts[]}`. Saltmarch hosts leagues. Emberreach and Thornwald are talent origins only (open-027).
- *Tier* `{id, regionId, level 1..3, name, clubCount 16, rosterCap, academyCapacity, basePrestige, ratingBand}` (leagues.json).
- *League* (one tier, one season) `{tierId, season, seedOrder[16], wings {dawn[8], dusk[8]}, fixtures[], standings}`.
- *Fixture* `{id, competition: league | tournament, season, weekId, tierId, homeClubId, awayClubId, bestOf, venueId, result?}`. Recommended id: `lg:{season}:{tierId}:{weekId}:{homeClubId}:{awayClubId}`. It doubles as the seed identity (P-05).
- *Standings row* `{clubId, played, wins, losses, points, roundsWon, roundsLost, downsFor, downsAgainst}`. Head-to-head is computed from the season's fixtures.
- *Club league state* `{clubId, tierLevel, wingId, prestige, history[]}`.

**Inputs:** match results (sys-match), season end (sys-calendar). The player has no actions here.

**Schedule generation** (next-season setup and new career, stream `schedule`):

1. **Seed order.** Season 1: clubs by `startPrestige` descending, ties by club id. Later seasons: clubs relegated from the tier above (by their final tier-table rank), then clubs that stayed (by final tier-table rank), then clubs promoted from below (the Reckoning champion first, then the Shield route).
2. **Serpentine draw.** Seed position i (0-based) goes to wing `[dawn, dusk, dusk, dawn][i mod 4]`. Each wing gets seeds summing to 68 (1, 4, 5, 8, 9, 12, 13, 16 against 2, 3, 6, 7, 10, 11, 14, 15). A club's **wing index k** (0–7) is its order within its wing.
3. **Slot shuffle.** For each wing, a Fisher–Yates shuffle of its 8 clubs into slots 0–7, using `Rng(root, schedule, season, tierId, wingId)`.
4. **Circle method, rounds r = 0..6.** Pair slot 7 with slot r; slot 7 hosts when r is odd. For k = 1..3, pair a = (r + k) mod 7 with b = (r − k + 7) mod 7; a hosts when k is odd, b hosts when k is even.
5. **Second half.** Rounds 8–14 repeat rounds 1–7 in the same order with venues swapped.
6. **Matchweeks.** Wing rounds 1–14 are played in MW 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16.
7. **Cross-wing weeks.** MW5: dawn[k] v dusk[k]. MW12: dawn[k] v dusk[7 − k]. In odd seasons dawn hosts at MW5 and dusk at MW12; even seasons swap. Every club gets two different cross-wing opponents, one home and one away.
8. **Validate:** 16 fixtures per club; 8 home and 8 away; each wing pair meets twice with venues swapped; 8 fixtures per tier per matchweek; no club twice in a week. This cannot fail with steps 1–7. Implementations must still assert it and throw on failure (a programming error, not a game state).

*Verification (scratch script, not in the repo):* 2,000 random seed orders, 0 failures. The longest run of consecutive home (or away) fixtures was 3.

**Standings and tiebreaks.** Points come from the regular season only: **3 / 2 / 1 / 0 for 2–0 / 2–1 / 1–2 / 0–2**. Tied clubs are ordered by, in turn:

1. points;
2. match wins;
3. round difference;
4. head-to-head points among the tied clubs, **only if every pair of them met equally often** (always true inside a wing, often false in the tier table);
5. rounds won;
6. downs difference (downs inflicted minus downs suffered, from the fight results; Merge note C3);
7. lot: ascending `hash(root, schedule, season, tierId, clubId)`.

When a criterion separates part of a tied group, each remaining tied subgroup restarts at criterion 4. Two tables are kept: the **wing table** (8 clubs: qualification and relegation) and the **tier table** (16 clubs: seeding, the Shield, table prize, promotion via the Shield route).

**Promotion and relegation** (season-end step 3, every adjacent tier pair, all decided from the same season's final tables, so no club moves two tiers):

1. The upper tier relegates the **8th-place club of each wing** (2 clubs).
2. The lower tier promotes its **Reckoning champion** and its **Shield** winner (tier-table #1). If they are the same club, the second place goes to the next-highest club in the lower tier's table.
3. Tier 1 promotes no one and tier 3 relegates no one in M1. The promotion-playoff hook stays disabled (FUTURE).
4. Flags are set for sys-finance (parachute, promotion grant, ascension) and sys-contracts (drop clause).

**Prestige** (0–100, season-end step 4; economy.json `prestige`):
`delta = tableTerm + tournamentTerm + movementTerm − advancePenalty`, where `tableTerm = (17 − 2 × tierRank) × 3 / 8` (toward zero: rank 1 → +5, rank 8 or 9 → 0, rank 16 → −5); tournament +1 (QF exit), +2 (SF exit), +3 (finalist), +5 (champion); promoted +8, relegated −8; Registry advance −5 each.
`new = clamp(old + delta − (old + delta − newTierBase) × 1500 / 10000, 0, 100)`, toward zero. Tier bases are 70 / 45 / 20. Prestige feeds the sponsor retainer, gate income, fighters' asks, free-agent tie-breaks and patron expectations.

**Prize table** (paid at season end): `prize(rank) = floor10(tablePrizeTop × (17 − rank) / 16)`. Tops are 25,000 / 10,000 / 4,000.

**Player information:** wing and tier tables with the top-4 line, the 8th-place line and the promotion places (champion route "TBD until the final"); fixtures with home/away and venue; prestige with its last change and the reasons for it.

**Edge cases:** a club relegated from tier 2 and a club promoted from tier 3 swap independently. Ties for 4th or 8th place are always resolved, by lot as a last resort. Clubs that never met (tier table) skip head-to-head.

**Interactions:** sys-tournament reads the wing and tier tables. sys-finance reads ranks, movements and prestige. sys-contracts reads movements (drop clause).

**Content parameters:** tier names, caps (O2 invariant: lowest tier 10, +2 per tier), basePrestige, rating bands, wing names. Invariants: clubCount = 2 × wing size = 16, and the matchweek lists must cover MW1–16 exactly (validator).

**Worked example (seed order c01…c16, season 1):** dawn = {c01, c04, c05, c08, c09, c12, c13, c16}, dusk = {c02, c03, c06, c07, c10, c11, c14, c15}. MW5 (dawn hosts): c01–c02, c04–c03, c05–c06, … MW12 (dusk hosts): c15–c01, c14–c04, c11–c05, …

**Acceptance cases:** le-001 to le-008 (§9).

### sys-calendar: season weeks, week processing, season end

**Status / scope:** M1. One season per in-game year is REQUIRED (O3), and so are 16 matches plus a 3-round tournament (O9). P1–P4 adopts open-005's working assumption. The order of steps is PROPOSED.

**Weeks** (leagues.json `calendar.weeks`):

| Index | Weeks | What happens (economy view) |
| --- | --- | --- |
| 1 | **P1 Trials Day** | Season budget and wage budget shown; first central-grant installment already credited. Trials rookies exclusive to their club. The free-agent market opens, and the AI's opening offers are already pending (made at season end) |
| 2–3 | P2, P3 | Market rounds. Renewals. Over-cap clubs release |
| 4 | **P4 Kick-off week** | The Kick off commit at the end of P4 (02 §3): roster ≤ cap; fewer than 5 fit fighters triggers the hired-blade rule |
| 5–20 | MW1–MW16 | One fixture per club. MW5 and MW12 are cross-wing. Second central-grant installment credited at the MW8 processing. AI renewals start at MW4 |
| 21–23 | TW1 QF, TW2 SF, TW3 final | Non-qualified and eliminated clubs have no fixture but still pay wages and costs. They may use "Advance to season end" (02 §2 step 9) |

**Week processing order** (one Continue, atomic for all clubs):

1. Simulate every remaining fixture of the week (the player's match is already played; 02 §3).
2. Record results; update standings; advance the bracket.
3. Lifecycle weekly step: injuries, XP and recovery (lifecycle draft).
4. **Income:** home gate, sponsor retainer installment, win bonuses, scheduled grant installment.
5. **Costs:** wages for every fighter on a roster at the start of this processing, hired blades used this week, operating cost.
6. **Financial status:** Watch, embargo, debt-week counter, Registry advance.
7. P1 only: unsigned trials rookies enter the free-agent pool.
8. **Free-agent decisions** (sys-transfers).
9. **AI action phase**, clubs in tier then id order: renewals, releases, new offers, counter replies, captain, and the lineup for next week's fixture (sys-ai-manager).
10. Free-agent pool floor top-up (sys-transfers).
11. Advance the calendar, build the digest, autosave (open-016).

**Season-end order** (it extends the 02 §3 working assumption; inserted steps in *italics*):

1. Tournament complete, placings fixed, titles recorded (Reckoning champion, Shield).
2. Prizes (table and tournament) and patron bonuses paid.
3. Promotion and relegation decided.
4. *Prestige update.*
5. M5: academy graduation.
6. Aging and development (lifecycle).
7. Retirements (lifecycle). A retiring fighter's contract ends with no payout.
8. Contract expiries: unrenewed fighters become free agents, with `formerClubId` kept.
9. Off-season injury recovery. 10. M4: knowledge decay. 11. M6: patron review.
12. *Free-agent pool maintenance:* lifecycle retires fighters unsigned at 2 consecutive season ends (`unsignedSeasonEndsBeforeLeaving`).
13. Next-season setup: tier membership; wing draw and fixtures; caps; *drop clause and tier-minimum raise*; *Registry deduction, grant installment 1, parachute, promotion grant*; season and wage budgets; *patron goals*; trials rookies generated and assigned (sys-transfers); *embargo re-evaluated*.
14. *AI action phase:* trials-rookie signings, cap-relief releases, opening free-agent offers for P1.
15. Autosave, then the season-end review screens (02 §2 step 10).

**Digest triggers (this draft's systems).** Offer accepted, countered, refused or lost to another club. Rival offers on a shortlisted fighter. Contracts expiring this season (listed from P1, highlighted at MW4, MW12 and TW1). Watch, embargo entry and exit, Registry advance. Tournament place clinched or lost. Relegation zone entered or left. Patron goal on or off track.

**Cancellation:** none after Continue. Before it, pending offers can be withdrawn.

**Edge cases:** the season-end step is not a week, so it pays no wages and does not count toward the 8 debt weeks. The debt counter carries over the season boundary unless the balance is ≥ 0 at setup.

### sys-tournament: the Reckoning

**Status / scope:** M1. 8 clubs and QF/SF/F are REQUIRED (O9). Best-of-3 with a best-of-5 final is PROPOSED (P-02, owned by combat). The rest is PROPOSED.

**Procedure** (after MW16 processing):

1. **Qualify** the top 4 of each wing table.
2. **Seed:** the two wing winners are seeds 1–2 (ordered by the tier table). The other six qualifiers are seeds 3–8 (ordered by the tier table).
3. **Quarterfinals (TW1):** 1v8, 4v5, 2v7, 3v6, single best-of-3 matches hosted by the higher seed. **Semifinals (TW2):** W(1v8) v W(4v5) and W(2v7) v W(3v6), best-of-3, higher seed hosts. **Final (TW3):** best-of-5 at the neutral **Charterhall**. The higher seed is the home side for the sim (west end, 03 §1) and has no other advantage (open-013).
4. Every match must produce a winner (Merge note C1). There are no replays or byes.
5. **Gate:** QF and SF home gates at ×1.5; the final gate at ×2.0, split evenly between the finalists (odd gold to the higher seed).
6. **Prize** by the furthest round reached (not cumulative): QF loser, SF loser, finalist, champion (economy.json). Each qualifier also earns the sponsor's tournament bonus.
7. Eliminated clubs and non-qualifiers have no fixture. They can Advance to season end.

**Player information:** the bracket from MW13 as a live "if the season ended today" projection, and the qualification line in each wing table.

**Edge cases:** a club tied for 4th is placed by the tiebreaks. Seeds 1 and 8 may come from the same wing.

**Worked example (le-005):** Dawn finishes A 40, B 36, C 33, D 30, (5th 28 …); Dusk finishes E 38, F 37, G 31, H 29, (5th 32 …). Seeds: 1 A, 2 E, 3 F, 4 B, 5 C, 6 G, 7 D, 8 H. QF: A–H, B–C, E–D, F–G. Dusk's 5th place (32 pts) misses out although H (29) qualifies: the cut is per wing.

### sys-roster: cap, lineup, eligibility, hired blades

**Status / scope:** M1. The caps and the academy as a separate pool are REQUIRED (O2). The interpretation follows open-002. Hired blades follow open-006's working assumption.

- **Cap.** The cap is that of the tier the club plays in this season, from next-season setup. It is hard: an offer, trials signing or (from M5) call-up is refused if `roster + pendingOffers + 1 > cap`. The only legal over-cap state is the one relegation creates. That club may not add fighters and must be at or under the cap by the Kick off commit (player) or the P4 AI phase (AI). It may release up to `roster − cap` fighters during P1–P4 with **no payout** ("cap relief", PROPOSED).
- **Lineup lock.** 5 distinct roster fighters who are fit (lifecycle) and were on the roster at the start of the week, plus one captain, a row and a preset each (O1, O6, O14, open-010). A fighter signed at week processing w can play from week w + 1.
- **Hired blades** (open-006). If fewer than 5 fit fighters exist at lock, the Registry assigns generated fighters: rating at the tier band minimum, class chosen to cover a missing Tank, then a missing Healer, then Melee DPS. They are paid the tier minimum wage for that week (charged at that processing), sit outside the cap, and leave after the match. The player's lineup screen labels them, and the digest warns a week ahead when the fit count for next week is 5 or fewer.
- **Minimum roster:** none as a rule. Hired blades guarantee a lineup. AI clubs aim for at least 8 (sys-ai-manager).

### sys-finance: budgets, ledger, income, costs, embargo

**Status / scope:** M1. "Clubs get budgets" and "fighters play for wages" are REQUIRED (O10). The model answers open-028. The ladder is open-007's working assumption, made exact. All values are PROPOSED · TUNABLE (economy.json `tierProfiles`, `income`, `budget`, `finance`).

**Entities and state:** `ClubFinance {balance, seasonBudget, wageBudgetPerWeek, wageBill, pendingWages, pendingSigningCosts, status: healthy | watch | embargo, debtWeeks, registryDebt, parachuteSeasonsLeft, ascensionSeasonsLeft, ledger[]}`. Ledger entries are `{season, weekIndex, category, amount, refId?}`, with categories `centralGrant, parachute, promotionGrant, sponsorRetainer, sponsorWinBonus, sponsorTournamentBonus, gate, tablePrize, tournamentPrize, patronBonus, registryAdvance, wages, hiredBlades, signingCost, releasePayout, operations`.

**Income sources**

| Source | Rule | Crown / Banner / Muster (par prestige) |
| --- | --- | --- |
| Central grant | Set by tier; paid 50% at setup (P1) and 50% at the MW8 processing; reduced by any Registry deduction | 82,000 / 34,000 / 14,000 |
| Sponsor retainer | `base × (10000 + clamp(120 × (prestige − tierBase), −2500, +3500)) / 10000`, paid in 23 equal weekly parts | 46,000 / 18,800 / 7,200 |
| Sponsor bonuses | Per match win (league and tournament); once for qualifying for the Reckoning | win 1,200 / 500 / 200; qualify 6,000 / 2,500 / 1,000 |
| Gate (home fixtures) | `gateBase × (10000 + prestigeAdj + formAdj + fanAppealAdj) × stageBp / 10⁸`. prestigeAdj = 100 bp per prestige point over the tier base (−2,500 to +3,000). formAdj = −1,000 + 2,000 × wins ÷ matches this season before this fixture (0 before the first match). fanAppealAdj = +200 bp per fan-appeal trait point in the home lineup (max +1,000) | 9,250 / 3,700 / 1,400 per home match |
| Table prize | `floor10(top × (17 − rank) / 16)` | top 25,000 / 10,000 / 4,000 |
| Tournament prize | By round reached | champion 38,000 / 15,000 / 6,000 (finalist ½, SF ¼, QF ⅛) |
| Patron bonus (M1-light, OPEN) | Goal met | 12,000 / 5,000 / 2,000 |
| Promotion grant | One-time, at setup of the first season in the new tier | 20,500 into Crown / 8,500 into Banner |
| Parachute | (old grant − new grant) × 50% in the first season after relegation, × 25% in the second; stops if promoted again | 24,000 then 12,000 into Banner; 10,000 then 5,000 into Muster |

**Costs:** weekly wages (sys-contracts), hired blades, signing costs and release payouts (sys-contracts), and an **operating cost** per week of 1,300 / 530 / 210 (arena, staff and travel; the only facilities-type sink in M1; facilities are FUTURE).

**Season budget and wage budget** (fixed at next-season setup for the whole season, a non-rolling budget):

- **Season budget** `SB = grant due this season (after deduction) + parachute + promotion grant + sponsor retainer + 8 × projected regular-season gate` (formAdj 0, fanAppealAdj 0). It is shown on club cards (02 §2 step 2) and at P1.
- **Wage budget per week** `WB = floor((SB × (wageRatioBp + ascensionBp) + reserveContribution × 10000) / (10000 × 23))`. wageRatio is 8,000 / 7,800 / 7,600 bp. ascensionBp is +800 in the first season after promotion. `reserveContribution = min(SB × 25%, max(0, balanceAtSetup − SB × 15%) × 50%)`, so saved gold, prize money included, lets a club spend more next season, within a cap.
- **Commitment rule (hard).** A free-agent offer, trials signing or renewal is legal only if `wageBill + pendingWages + newWage − replacedWage ≤ WB`, or the change does not raise the bill. Its signing cost must also satisfy `balance − pendingSigningCosts ≥ signingCost`. The checks run at submission, and again at resolution, where a failing offer is void. Releases are always allowed, because they lower the bill, and their payout may push the balance below 0.

**Status ladder** (open-007, made exact; clubs never fold; AI clubs identical):

1. **Watch** (advisory) when `balance + Σ next 4 weeks (scheduled retainer parts + grant installments + projected home gates − wageBill − ops) − pendingSigningCosts < 0`.
2. **Embargo** at any week processing (or setup) that ends with balance < 0. While embargoed: no offer or renewal above the **tier minimum wage**; a free-agent offer only at the tier minimum, length 1, with no signing cost, and only while the club has fewer than 5 fit roster fighters; no trials signings; from M5 no enrollment, from M6 no bids. The embargo lifts at the first processing (or setup) that ends with balance ≥ 0.
3. **Registry advance** after **8 consecutive** processings that end below 0: balance := 0, `registryDebt += debt`, prestige −5. At each later setup, the grant is reduced by `min(registryDebt, 30% of grant)`, interest-free, until repaid.
4. M6: patron patience (open-007). There is no game over in M1.

**Why no death spiral:** the hard commitment rule stops overspending at the source. The embargo shrinks the wage bill, because contracts expire and new ones are capped at the minimum. The advance clears the cash hole after 8 weeks. Deductions are capped at 30% of the grant. Relegation is cushioned by the drop clause and the parachute. Every club keeps receiving its grant and sponsor money, so it always recovers.

**Player information:** the finance screen shows balance; SB with its parts; WB as a bar `bill + pending / WB`; projected end-of-season balance; the ledger by category and week; status with the reason ("−497 ts after MW10 wages"); the Registry debt and next season's deduction. Every offer dialog shows the wage-budget room after signing and the signing cost (C2.2: costs shown where you spend).

**Worked example (Banner club, prestige 50, balance 30,000 at setup):** retainer = 18,800 × 10,600 / 10,000 = 19,928. Gate = 3,700 × 10,500 / 10,000 = 3,885 per home match, × 8 = 31,080. SB = 34,000 + 19,928 + 31,080 = **85,008**. Reserve floor = 12,751; contribution = min(21,252, (30,000 − 12,751) × 50%) = 8,624. WB = floor((85,008 × 7,800 + 8,624 × 10,000) / 230,000) = **3,257 ts/week**.

**Acceptance cases:** le-015 to le-021 (§9).

### sys-contracts: wages, lengths, renewals, releases, expiry

**Status / scope:** M1. Wages and contracts are REQUIRED (O10, R6). The formula and the values are PROPOSED · TUNABLE (economy.json `wage`, `ask`, `negotiation`, `contracts`).

**Entities and state:** `Contract {id, fighterId, clubId, kind: standard | trialsRookie, weeklyWage, signedSeason, signedWeekIndex, endSeason, nextWage?, nextEndSeason?, dropClauseApplied}`. Hired blades get a one-week record outside the roster. `Fighter.contractProfile {greedBp, label}` is rolled at generation (stream `market`). `Negotiation {fighterId, clubId, season, patienceLeft, counterPrice?, counterValidUntilWeek?}`.

**Lengths:** 1, 2 or 3 seasons. A contract signed during season s with length L ends at the end of season `s + L − 1`, so the current season counts. A contract signed in the season-end AI phase is for the coming season.

**Wages are paid** at each week processing for every fighter who is on the roster at the start of that processing. A free agent who signs at processing w is first paid at w + 1. A trials rookie signed during P1 is paid from the P1 processing.

**Market wage** (club-independent):

```
humanAge   = floor(age × 80 / race.lifespan)                      (lifecycle)
EQ         = clamp(rating + min(potential − rating, 25) × potW(humanAge) / 10000, 1, 100)
potW       = step table [0:4000, 24:3000, 25:2000, 26:1000, 28:0] bp
curve(EQ)  = linear interpolation of anchors 200 × 2^((r − 50)/12): 50→200, 60→355, 70→635, 80→1130, 90→2015 …
marketWage = floor5( curve(EQ) × (10000 + ageAdj + traitAdj + roleDemandAdj + fanAppealAdj) / 10000 )
ageAdj     = step table by humanAge [32:−600, 33:−1200 … 39+:−5000]  (market discount for coming decline)
traitAdj   = +150 per positive trait, −150 per negative, overrides by id, clamped ±1500
fanAppealAdj = +300 per fan-appeal point (traits' economy hook)    roleDemandAdj = per-role bp, all 0 at start
```

**Ask** (what one fighter demands from one club, for one length):

```
ask = clamp( floor5( marketWage × (10000 + clamp(tierGap + prestige + length + greed + wageDemand + situation, −4000, +6000)) / 10000 ),
             club tierMinWage, 4000 )
calibre    = tier 1 if rating ≥ 62, tier 2 if rating ≥ 47, else tier 3
tierGap    = +1500 per tier the club sits below the fighter's calibre; −500 per tier above it
prestige   = −30 bp per prestige point above the club's tier base (±600)
length     = +500 per season of difference from the fighter's preferred length
             (1 if humanAge ≤ 24 and potential − rating ≥ 8; 3 if humanAge ≥ 32; else 2)
greed      = the fighter's greedBp, rolled uniform −1000..+1500 in steps of 100 (Modest ≤ −400, Fair ≤ +700, Grasping above)
wageDemand = (wageDemandMult − 1) × 10000 from traits' economy hook
situation  = renewals only: +1000 if he started < 25% of the club's matches this season; −500 if ≥ 60%;
             −300 after 3+ seasons at the club; −200 per loyalty trait point
```

The tier gap is how "tier prestige" enters wages. A fighter good enough for a higher tier charges lower-tier clubs a premium, and gives a small discount to clubs above his level. Because the base is club-independent, promotion **does not** inflate an existing squad's wage demands (the "wage spikes after promotion" pitfall, research C2.7). Placeholders owned by others: `rating` and `potential` (combat and lifecycle, 1–100), `race.lifespan` (lifecycle), trait polarity and economy hooks (lifecycle `traits.json`), role tags (combat).

**Signing cost** (a one-time payment to the fighter): `floor10(wage × remaining paid weeks × 10%)`. Trials rookies pay 0, renewals 10%. Paid at signing, from the balance.

**Renewals.** Allowed in any week of a contract's final season, by the holding club only (exclusive), answered at once. The new terms start at season-end setup; in the meantime the old wage continues. Renewal length L adds L seasons after the current end.

**Negotiation (one offer, one counter; research C3.11).** `ratio = offer × 10000 / ask` (or ÷ the club's valid counter price).
- ratio ≥ 10,000: acceptable (a renewal signs at once; a free-agent offer goes to decision).
- `10,000 − flex ≤ ratio < 10,000`: the fighter counters at `floor5((offer + ask) / 2)`. flex is 1,500 for Modest, 1,000 for Fair and 500 for Grasping. A counter is valid until the end of the next week processing; accepting it signs (renewal) or becomes an offer at that price (free agent).
- Lower: refused, and patience −1. Patience is 3 renewal offers per season, and 3 free-agent refusals per (fighter, club) per season. At 0, the fighter will not deal with that club again this season. For a renewal, this means he leaves at season end.
- Offers above `1.5 × ask` are capped.

**Release.** Allowed at any time outside a match. `payout = floor10(wage × remaining paid weeks × 50%)`, where the remaining weeks count from the current week's processing (inclusive) to the contract's end. The payout is charged at once. The fighter joins the free-agent pool and **cannot re-sign with the releasing club this season**. Cap-relief releases after relegation pay 0 (sys-roster).

**Expiry.** At season-end step 8, contracts whose `endSeason` is the ending season (and not renewed) end; the fighter becomes a free agent. **Retirement** (step 7) ends a contract with no payout.

**Drop clause and tier minimum** (setup): every contract of a relegated club becomes `max(newTierMin, floor5(wage × 80%))`. Any contract below its club's tier minimum is raised to it (e.g. after promotion).

**Worked example: Brannoc** (EXAMPLE human, age 23, rating 58, potential 64, Fair greed +400, one positive and one negative trait):
humanAge 23 → potW 4,000 → EQ = 58 + floor(6 × 0.4) = 60 → curve 355 → traitAdj 0 → market wage **355**.
Ask from a Banner club at prestige 50 for 2 seasons: calibre 2 = club tier → gap 0; prestige −150; length 0 (preferred 2); greed +400 → total +250 → floor5(363.9) = **360 ts/week**.
The same fighter asks a Muster club (prestige 20) **420** (gap +1,500), and a Crown club at prestige 70 asks **350** (−500 discount).
Signed at P1 processing: paid weeks 22 + 23 = 45 → signing cost floor10(360 × 45 × 10%) = **1,620**.
Offer 340 → ratio 9,444 ≥ 9,000 → counter floor5(350) = **350**. Offer 320 → ratio 8,888 → refused.
Released while MW6 is the current week (index 10) with a contract to the end of next season: 14 + 23 = 37 weeks → payout floor10(360 × 37 × 50%) = **6,660**.

**More worked asks:** trials rookie (human, 18, rating 34, potential 66) at a Muster club: EQ 44 → market 140 → length 3 against a preferred 1 → **150** (length 1: **135**). Veteran elf (age 50, lifespan 120 → humanAge 33, rating 70): market 555 after −1,200 → on a 1-season deal at a Crown club **610**, on 3 seasons **555**. Star (rating 78, two positive traits, fan appeal 1, Grasping +1,200) at a Crown club with prestige 84: **1,155**.

**Acceptance cases:** le-010 to le-012, le-016, le-017, le-020 (§9).

### sys-transfers: the free-agent market (the brief's "sys-market")

**Status / scope:** M1, free agents only (O14). Signable at any time (P-09). Resolution at week processing is PROPOSED (OPEN, Owner confirmations).

**Pool sources:** contracts expired at season end; released fighters; unsigned trials rookies (P1); world-generation free agents (new career); journeymen generated to keep the pool at its floor. **Exits:** signing; retirement (lifecycle, including fighters unsigned at 2 consecutive season ends).

**Pool size targets (PROPOSED · TUNABLE):** 100–300 at P1; at least 60 in season, with at least 5 per role. If a week processing ends below the floor, the lifecycle generator adds **journeymen** (rating in the Muster band, humanAge 26–33, generatedFreeAgent potential shift −3) until both floors are met. Rookie volume per season follows the lifecycle intake formula (about 24 + the season's exits; development.json `generation.intake`).

**Trials Day (P-18).** Each club receives `floor(rookies / 48)` of the season's rookies; the remainder goes one each to clubs drawn by lot (stream `rookies`), so quality and count do not depend on standings (no tanking incentive). They are exclusive to that club during P1, answer at once, and sign with **no signing cost**. The AI decides its trials rookies in the season-end AI phase; the player decides during P1. Unsigned trials rookies enter the pool at P1 processing (step 7), before the AI acts.

**Offers.** A club makes at most one pending offer per fighter `{wage, length, destination: roster (M1) | academy (M5)}`, and at most 6 pending offers in total. Pending offers count against the cap and the wage budget, and their signing costs against the balance, from the moment they are made. They can be withdrawn until processing. The player makes offers during the week. AI clubs make theirs in the AI action phase, so their offers are visible to the player all week as **"rival offers: n"** (counts, not amounts). The AI never sees the player's offers: those resolve before the AI acts, consistent with P-04's "never counter-build against the player".

**Decision procedure** (week processing step 8; free agents by market wage descending, then id):

1. For each offer, the required price is the fighter's ask for that club and length, or that club's valid counter price. Offers from clubs he has stopped dealing with are refused.
2. `score = offer × 10000 / required + 500 if he would rank in that club's top 5 by rating` (the starter bonus). Offers with `offer ≥ required` are acceptable.
3. Pick the highest score among acceptable offers. Ties go to the higher prestige, then the higher tier, then a lot. Re-check the cap, wage budget, cash and embargo; if the winner now fails, void that offer and take the next.
4. Sign: create the contract, charge the signing cost, remove the fighter from the pool, and send a digest to every bidder ("signed with X").
5. With no acceptable offer, the best offer with `ratio ≥ 10,000 − flex` receives a counter (valid through the next processing), and every other offer is refused (patience −1 for that club).

**Mid-season signings** work every week (MW1–TW3). The fighter can play from the next week, is paid for the remaining weeks only, and pays a pro-rated signing cost. M5 hook: an offer with destination `academy` checks academy capacity instead of the roster cap; per O3 and open-003 (iii) the fighter may be enrolled in the week he joins.

**Discovery and comparison (player information, M1):**
- Market list with filters: role and class, race, age, rating range, potential, ask range, "fits my wage room", "would start for me", calibre tier, contract temperament. Sort by any column; default sort is market worth (`marketWage × 46`).
- Each row shows: rating, potential, age (and race peak marker), traits, **ask for my club at 1/2/3 seasons** with the preferred length marked, signing cost, rival offers count, and the starter flag.
- Compare up to 3 free agents side by side with my roster fighters of the same role (rating, potential, age curve, wage).
- A shortlist that persists in the save; the digest reports changes to shortlisted fighters.
- **M4 hook:** every value is read through `sys-knowledge.view`, so the same screens show ranges, confidence and sources from M4. Rival-offer counts may then require knowledge (FUTURE).

**Edge cases:** a fighter retires at season end while offers are pending → offers void. A club relegated in the meantime → the offer is re-checked at resolution (cap, embargo). Two clubs with equal score, prestige and tier → lot (stream `market`, season, week, fighter id).

**Worked example (le-013):** Brannoc's asks are 360 at club A (Banner, prestige 50) and 360 at club B (Crown, prestige 60). A offers 360 for 2 seasons, and he would start there: score 10,000 + 500 = **10,500**. B offers 375, and he would not start: score 375 × 10,000 / 360 = **10,416**. A signs him. Had Muster club C (ask 420) offered 430, its score would be 10,238 + 500 = 10,738 and C would win: a smaller club can outbid a bigger one by paying the premium and offering a starting place.

### sys-ai-manager: AI clubs under the same rulebook

**Status / scope:** M1. Parity is PROPOSED (P-04). The procedures and values are PROPOSED · TUNABLE (economy.json `aiPersonalities`, `ai`). Decisions are deterministic given the state; ties use stable ids, then stream `ai` (season, week, club).

**Personalities** (each club's is in clubs.json; M1 shows it as a club tag; M4 hides it behind scouting):

| id / label | Spending | Signing focus | Contracts | Distinctive behavior |
| --- | --- | --- | --- | --- |
| `balanced` Steady hands | 93% of WB | need × value per gold | fighter's preferred length | — |
| `thrifty` Ledger-keepers | 88% of WB; reserve 25% of SB | value per gold, never above ask | 1 season; haggles renewals −6% | Keeps two places free |
| `star_chasing` Glory-hunters | 100% of WB; reserve 8% | best rating first | preferred length | Overbids +15% for the top 20% of the pool |
| `youth_focused` Seedbed | 95% of WB | potential weight ×1.8, avoids humanAge > 27 unless a starter | 3 seasons for the young, 1 otherwise | Gives young prospects starts |
| `veteran` Old hands | 95% of WB | potential weight ×0.3, avoids humanAge < 24 unless a starter | 1 season | Proven fighters now |

Any personality spends 100% of WB when its balance exceeds 1.0 × SB, so no AI hoards without limit.

**Value used by every decision (integer):** `aiValue = rating + potentialBonus × personality.potentialWeight − max(0, humanAge − 31) × 2 × personality.veteranPenalty + 8 if his role family is below the club's role targets (Tank 2, Healer 2, DPS 3, Controller 1) + 5 if he would start`. `surplus = aiValue − replacement rating` (60 / 46 / 32).

**Procedures** (AI action phase, in this order):

1. **Renewals** (from MW4 processing): for expiring fighters in descending aiValue, keep him if he ranks within the club's roster target by aiValue, the personality's age rule allows it, and his ask fits `WB × wageUse`. Offer `ask × (1 − haggle)`; accept a counter (it is ≤ ask by construction); after a refusal, offer the full ask next week. Otherwise let the contract expire.
2. **Releases:** cap relief when over the cap (P1–P4, lowest aiValue first). Voluntary releases only in P1–P4, at most 2 per season: only a fighter with surplus < 0, payout ≤ 10% of SB, and balance after the payout ≥ the reserve floor.
3. **Free-agent offers** while `roster + pending < rosterTarget` (cap − slack, at least 8): rank candidates by `surplus × 10⁶ / ask` (star chasers: by surplus), skipping any with surplus ≤ 0. Offer `floor5(ask × (1 + overbid))` at the personality's length, subject to `bill + pending + offer ≤ WB × wageUse` and `balance − pendingCosts − cost ≥ reserve floor`. Up to 3 new offers per week (thrifty: 2). Below 8 rostered fighters, the AI may use the full WB and a zero reserve.
4. **Counters received:** accept if the counter is within its wage room.
5. **Trials rookies** (season-end AI phase): sign those with surplus > 0 within the cap and wage room; youth_focused signs any rookie with potential − rating ≥ 15 if there is room.
6. **Captain:** the club captain is the highest captaincy rating (CQ, lifecycle) on the roster. It changes only if another fighter exceeds the incumbent by ≥ 5 CQ, or the captain leaves. This avoids the lifecycle "snubbed" penalty.
7. **Lineup for next week:** the best fit Tank-family fighter, the best Healer-family fighter, then the 3 highest-rated remaining (ties by CQ, then id). Seedbed swaps in a prospect (humanAge ≤ 23, potential − rating ≥ 10, rating ≥ 5th starter − 4) for the lowest non-Tank, non-Healer starter. Rows come from combat's default row per role. Presets: the class preset whose stance tag equals the club's `tacticsStyle`, else the class default. The match captain is the club captain if fielded, else the highest CQ fielded. The lineup is published to the opponent, as the player's opponent's lineup is visible in M1 (open-026).

**Never:** it never reads the player's pending offers or lineup, never tanks (the lineup is always the best by the rule above), never breaks the commitment rule, and never signs while embargoed except as the embargo allows.

### sys-patron (M1-light) and sys-cups (M6 hooks)

**sys-patron, M1-light (OPEN: 02 §4 says "no optional objectives in M1"; the drafting brief asks for light, optional patron expectations).** At P1 each club gets one goal: finish the tier table at or above `(its prestige rank within the tier) + 3`. A club promoted last season must avoid relegation; one relegated last season must finish top 4 of its wing. Meeting it pays the patron bonus at season end. Missing it costs nothing. The goal is on by default and can be switched off at new career. M6 adds temperament, patience and dismissal (open-007).

**sys-cups (FUTURE, M6):** the calendar accepts inserted cup weeks; fixtures carry `competition` and `bestOf`; finance has a `cupPrize` category; prestige accepts a cup term. Nothing is active in M1.

## 4. Cross-system interactions

| Trigger / combination | Conditions | Resolution order | Result | Restrictions / edge cases |
| --- | --- | --- | --- | --- |
| Relegation → contracts → roster | Club 8th in its wing | Season end 3 → setup: drop clause, then tier minimum, then cap | Wages −20%, parachute credited, cap −2, cap-relief allowance = overage | Kick off blocked while over the cap (02 flow-005) |
| Promotion → finance → market | Champion or Shield | Season end 3 → setup: promotion grant, then ascension, then WB | Bigger WB; calibre premium falls for the new tier | Existing wages unchanged (no spike) |
| Release → finance status | Payout > balance | Payout immediately → status at next processing | Possible embargo | Release is never blocked by money |
| Embargo → pending offers | Balance < 0 at processing | Status (step 6) before decisions (step 8) | Non-conforming pending offers are void | Renewals above the minimum are refused |
| Registry advance → next season | 8 debt weeks | Advance at step 6 → deduction at setup | Grant reduced ≤ 30% per season | Prestige −5 |
| Free-agent decision → AI | Fighter signs elsewhere | Step 8 before step 9 | AI re-plans with the new pool | AI offers are never instant |
| Injury → lineup → hired blade | Fewer than 5 fit at lock | Lifecycle step 3 → AI lineup at step 9 / player at lock | Hired blade fills, paid the tier minimum | Not on the roster |
| Retirement ↔ expiry | Expiring fighter retires | Step 7 before step 8 | Retires, no payout, no free-agent entry | Lifecycle raises retirement odds for players with no contract next season |
| Prize money → next WB | Season-end prizes | Season end 2 → setup reserve contribution | Up to +25% of SB in wage room next season | Capped (anti-snowball) |

## 5. Autonomous behavior (AI managers)

- **Agent goals:** win matches and the Reckoning, avoid relegation, stay solvent within personality limits, keep a fair-value roster.
- **Available information:** the same views as the player (M1 exact, open-026). From M4, sys-knowledge with the club's scouting quality as noise (P-04). No access to the player's pending offers, the round seeds, or future results.
- **Legal capabilities:** identical to the player's: offers, renewals, releases, trials signings, lineup and captain choice, presets. From M2, calls on the same budget (combat sys-calls). No exceptions.
- **Decision priorities:** sys-ai-manager procedures 1–7.
- **Timing:** once per week processing (step 9) and once in the season-end AI phase.
- **Difficulty:** none in M1. M7 sliders may change decision quality, never the rulebook (P-14).
- **No useful action:** keep the roster; hired blades cover a short lineup; renewals at the tier minimum while embargoed.
- **Telegraphing and counterplay:** the personality tag and tactics style are visible (M1). Rival-offer counts are visible on free agents, and AI lineups are published a week ahead. A player can, for example, outbid a Ledger-keeper (which never pays above ask), or let a Glory-hunter overpay for a star and sign the value fighters it ignores.

## 6. Content model

| Family | Shared properties | Behaviors | Player-facing identity | M1 quantity |
| --- | --- | --- | --- | --- |
| Region | id, name, hostsLeagues, districts | sys-league | Saltmarch and its six districts | 3 (1 hosting) |
| Tier | id, level, name, cap, academyCapacity, basePrestige, ratingBand, tournament and Shield names | sys-league, sys-roster | Crown, Banner, Muster Circuits | 3 |
| Wing | id, name | sys-league | Dawn Wing, Dusk Wing | 2 (shared by all tiers) |
| Club | id, name, shortName, 3-letter code, region, district, city, arena, motto, colors, start tier, start prestige, aiPersonality, tacticsStyle | sys-league, sys-finance, sys-ai-manager | Mercenary guild identities | 48 (16 per tier) |
| Economy profile | tierProfiles in economy.json | sys-finance, sys-contracts | Visible as budgets and prizes | 3 |
| AI personality | spending, focus, contracts, behavior flags | sys-ai-manager | Club tag | 5 |
| Venue | id, name, city | sys-tournament | The Charterhall | 1 |

**Club entry validation** (implemented by the scratch validator and to be ported to the content validator): unique id, name, shortName, code, arena, motto and primary color; region and district exist; the start-tier count equals clubCount; startPrestige within ±15 of its tier base; personality and style ids exist; primary/secondary WCAG contrast ≥ 3.0; CIEDE2000 between primaries of clubs with the same start tier ≥ 10; **pair distance** (ΔE of primaries + ΔE of secondaries) ≥ 25 for every pair of clubs; **kit distance** ≥ 25 for every pair (so any fixture can be told apart). The current file passes with worst contrast 3.16. **Presentation rule** (Merge note P1): if the home and away primaries are within ΔE 20, the away side displays its secondary as its main color.

**Prototype content set:** all of leagues.json (3 regions, 3 tiers, 2 wings, calendar, competition rules), clubs.json (48 clubs) and economy.json. "Ready when": the validators pass, and the le-001 to le-029 scenarios pass in the headless harness.

**Club roster (EXAMPLE default theme, by start tier):**
- **Crown Circuit:** Varrow Lanternguard, The Ninth Oar, Varrow Sealbearers, Gullhaven Foamriders, Keelwick Hammerkeels, Chalkholm Cliffwardens, Saltcrag Brinehounds, Lanternmouth Beaconblades, Reedmere Marshlights, Amberstrand Amber Talons, Wrackholt Salvagers, Skerrow Sealspears, Dunsalt Glasscutters, Fenhollow Reedstalkers, Beaconfell Gannetkin, Glassdune Mirages.
- **Banner Circuit:** Gullhaven Ropebinders, Keelwick Tarhands, Varrow Netcasters, Ropesend Anchorfists, Whitepan Salt Lancers, Cinderpan Cinderjacks, Marrowby Bonepickers, Stiltwater Heronguard, Mireford Leechguard, Lanternmouth Wickwardens, Sealsfoot Nightrowers, Brightskerry Shellguard, Shellwick Pearlhooks, Dunsalt Dunecats, Reedmere Frogspears, Fenhollow Peatcutters.
- **Muster Circuit:** Skerrow Driftblades, Gannet Head Cliffcrows, Varrow Dockjacks, Glassdune Shardkin, Wrackholt Barnaclers, Keelwick Bilge Company, Mireford Eelcatchers, Stiltwater Stiltwalkers, Marrowby Saltboilers, Cinderpan Kindlers, Ropesend Knotwrights, Beaconfell Cragrunners, Shellwick Crabclaws, Amberstrand Sapguard, Brightskerry Puffin Lancers, Whitepan Saltlings.

## 7. Challenge structure: the league ladder

- **Authored versus generated:** the clubs, tiers and rules are authored (data). Fighters, fixtures and wing draws are generated per world seed.
- **Setup:** a new career assigns each club its start tier and prestige, starting balance `base × (1 + 1% × (prestige − tierBase))` (±30%), rosters at 90% of cap (lifecycle `rosterFillOfCap`), contracts of 1/2/3 seasons in equal shares, and wages at each fighter's ask for his club. The generator then drops the lowest value-per-wage fighters to the pool until the club's bill is ≤ 95% of its WB, keeping ≥ 8.
- **Objectives:** win the wing and tier tables, the Reckoning, promotion; avoid 8th place; stay solvent; (M1-light) meet the patron goal.
- **Escalation:** each tier up roughly doubles to triples budgets and opposition ratings (bands 30–50 / 45–65 / 60–80). Bands overlap, so a promoted club can survive with good tactics.
- **Validity checks at new career:** every club has ≥ 5 fighters with every role present league-wide; every WB ≥ its club's bill; the pool meets its floors. Retry generation with the next sub-seed up to 3 times, then relax the 95% rule to 100%.
- **Variation limits:** the wing draw changes every season; the cross pairing and venues alternate; clubs, names and tiers are data.

## 8. Balance and tuning

**Tunable parameters (PROPOSED · TUNABLE; the source of truth is economy.json and leagues.json):**

| ID | Meaning / unit | Initial | Allowed range | Intended effect | Evidence to change |
| --- | --- | --- | --- | --- | --- |
| tune-le-001 | Central grant by tier (gold) | 82,000 / 34,000 / 14,000 | ±40% | Guaranteed base, about 40% of SB | Solvency band |
| tune-le-002 | Sponsor retainer base | 46,000 / 18,800 / 7,200 | ±40% | Prestige-linked income | Solvency; prestige spread |
| tune-le-003 | Gate base per home match | 9,250 / 3,700 / 1,400 | ±40% | Home value | Wage/income band |
| tune-le-004 | Wage ratio of SB (bp) | 8,000 / 7,800 / 7,600 | 6,000–9,000 | Wage room | Wage/income band; embargo rate |
| tune-le-005 | Reserve floor / spend / cap (bp of SB) | 1,500 / 5,000 / 2,500 | 0–3,000 / 2,500–10,000 / 0–5,000 | Savings become wage room | Hoarding share; dynasty flags |
| tune-le-006 | Operating cost per week | 1,300 / 530 / 210 | ±50% | Money sink | Money-supply growth |
| tune-le-007 | Table prize top | 25,000 / 10,000 / 4,000 | ±50% | Reward for position | Tanking test; dynasty |
| tune-le-008 | Tournament prizes | champion 38,000 / 15,000 / 6,000 | ±50% | Festival stakes | Dynasty; solvency |
| tune-le-009 | Win bonus / tournament bonus | 1,200 / 500 / 200; 6,000 / 2,500 / 1,000 | ±50% | Weekly reward | Tanking test |
| tune-le-010 | Wage curve | 200 × 2^((r − 50)/12) | doubling every 10–14 points | Value of rating | Tier bill vs WB |
| tune-le-011 | Potential weight (bp by humanAge) | 4,000 → 0 at 28 | 0–6,000 | Price of upside | Rookie signing rate |
| tune-le-012 | Calibre thresholds | 62 / 47 | ±5 | Who counts as "too good for the tier" | Quality gaps between tiers |
| tune-le-013 | Tier-gap premium / discount (bp) | +1,500 / −500 | 0–3,000 / 0–−1,500 | Talent drifts up the tiers | Tier rating gap ≥ 6 |
| tune-le-014 | Greed range (bp) | −1,000…+1,500 | — | Individual price variance | Negotiation feel |
| tune-le-015 | Flex by label (bp) | 1,500 / 1,000 / 500 | 0–2,500 | Counter window | Playtest |
| tune-le-016 | Signing cost / renewal (bp of guaranteed wages) | 1,000 / 1,000 | 0–2,000 | Commitment cost | Churn rate |
| tune-le-017 | Release payout (bp of remaining) | 5,000 | 2,500–10,000 | Cost of mistakes | Release rate |
| tune-le-018 | Drop clause (bp) | 2,000 | 0–3,500 | Relegation landing | Relegated solvency |
| tune-le-019 | Parachute (bp of grant gap, seasons 1–2) | 5,000 / 2,500 | 0–7,500 | Relegation landing | Yo-yo rate |
| tune-le-020 | Promotion grant / ascension (bp) | 25% of new grant / +800 | 0–50% / 0–1,500 | Promotion landing | Promoted survival 50–80% |
| tune-le-021 | Starter bonus in free-agent score (bp) | 500 | 0–1,500 | Parity: playing time attracts | Dynasty; pool flow |
| tune-le-022 | Embargo / advance weeks / deduction cap | < 0 / 8 / 30% | 4–12 / 10–50% | Failure ladder | Advance rate ≤ 2% |
| tune-le-023 | Prestige weights, reversion | table 3/8, +8 / −8, 15% | — | Movement without lock-in | Prestige spread |
| tune-le-024 | Pool floor in season / per role | 60 / 5 | 30–120 / 2–10 | Mid-season options | Floor breaches |
| tune-le-025 | AI wageUse, overbid, slack | per personality | — | Distinct AI clubs | Solvency; pool health |
| tune-le-026 | Points 3/2/1/0 | — | — | Round margins matter | Tie frequency |

**Reference situation:** a par-prestige Banner club with a typical roster (5 starters at rating 58 and 6 reserves at 50) has a bill of 2,795 ts/week against a WB of 2,960. In an average season (8 wins, mid-table, a QF exit one season in two) it has income about 100,300, costs about 84,800 (wages 68,080), and a surplus of about +19% of SB. The reserve rule turns that surplus into wage room the next season, so balances are expected to settle near 0.6 × SB (to be confirmed by the soak test). Wage/income ≈ 68% (66–70% across tiers).

**Dominant-strategy risks and boundaries:**
- *Hoarding then splurging:* capped by the 25%-of-SB reserve contribution.
- *Lowballing every offer:* it saves at most half the flex (2.5–7.5%) and loses contested free agents.
- *Release and re-sign cheaper:* blocked for the rest of the season.
- *Tanking:* it pays nothing back. Win bonuses, form-driven gate, table prize, the Reckoning and the patron goal all reward winning; rookies are not assigned by standing; the parachute is worth less than staying up.
- *Snowball:* dampened by the starter bonus (stars prefer clubs where they start), aging and retirements, the reserve cap and prestige reversion.
- **Deliberate asymmetry:** higher tiers are richer. That is the point of the climb. Talent drifts upward through the tier-gap premium.

**Soak-test specification** (V1; the `soak` stream; targets in economy.json `balanceTargets`). Run 10 world seeds × 25 seasons with every club AI-managed (the player club as `balanced`) in the headless harness. Collect per-club-season finance, standings, roster and pool snapshots. A failure blocks merging a balance change. A flag is written to the report for designer review.

| Check | Metric | Pass band | Kind |
| --- | --- | --- | --- |
| Solvency | Share of clubs with balance ≥ 0 at each season end | ≥ 90% every season (vis-008) | Fail |
| Registry advances | Club-seasons with an advance | ≤ 2% | Fail |
| Embargo length | Weeks in embargo per club-season | ≤ 16 | Fail |
| Balance band | Median balance ÷ SB at season end | 0.10–1.00; ≤ 5% of clubs above 2.0 | Fail |
| Wage-to-income, tier | Season wages ÷ season income, tier mean | 0.55–0.80 each tier | Fail |
| Wage-to-income, club | Same, per club-season | ≥ 90% within 0.40–0.95 | Fail |
| Money supply | Growth of the sum of balances per season after season 5 | ≤ 5% of total SB | Fail |
| Dynasty | Reckoning titles by one club in any 8-season window ≥ 4; Shields in 10 seasons ≥ 6 | Never without a flag; ≥ 8 distinct Crown champions in 25 seasons (median) | Flag / fail |
| Promoted survival | Promoted clubs not relegated the next season | 50–80% (target 65%) | Fail |
| Tanking | 200 paired runs per seed: club X in tier 2 or 3 fields its 5 lowest-rated fit fighters for one season against a control run | The tank run has lower income over seasons s..s+2 and lower prestige at s+2 in ≥ 95% of pairs. A late-season variant (losing MW15–16 once qualified) never raises the expected tournament prize | Fail |
| Pool health | Pool at P1; in-season minimum; per-role minimum | 100–300; ≥ 60; ≥ 5 | Fail |
| League quality | Mean rating of the top 5 per club, per tier | Within ±5 of season 1 (vis-008); tier gaps ≥ 6 | Fail |
| Hired blades | Share of lineup slots filled by hired blades | ≤ 1% | Fail |
| AI renewals | Share of AI starters with expiring contracts re-signed | ≥ 70% | Flag |
| Determinism | Season summary hash for the same seed, twice | Identical (vis-009) | Fail |

**Tuning order when a check fails:** solvency → SB components, then wage ratio. Hoarding → reserve cap or richThreshold. Wage/income → wage ratio. Promoted survival → ascension or promotion grant. Pool → lifecycle intake (Merge note L4), then AI slack. Dynasty → starter bonus up, prize spread down, reserve cap down. Each tuning change is recorded with the soak report that justified it.

## 9. Mechanical acceptance scenarios

**Status:** proposed acceptance requirements; none has been run. All values come from the current economy.json and leagues.json (computed with a scratch calculator).

| ID | Initial state | Action / events | Exact expected outcome | Rule IDs | Milestone |
| --- | --- | --- | --- | --- | --- |
| le-001 | 16 clubs in any seed order, any season | Generate the tier's schedule | Every club has 16 fixtures (8 home, 8 away), meets each wing rival once home and once away, has 2 different cross-wing opponents (1 home, 1 away), and plays exactly once in each MW1–16. Each matchweek has 8 fixtures. No byes | sys-league | M1 |
| le-002 | Seed order c01…c16, season 1 (odd) | Wing draw and cross weeks | Dawn {c01,c04,c05,c08,c09,c12,c13,c16}; dusk {c02,c03,c06,c07,c10,c11,c14,c15}. MW5 includes c01 (home) v c02. MW12 includes c15 (home) v c01. Season 2 swaps the hosts | sys-league | M1 |
| le-003 | A match ends 2–1 | Record it | Winner +2 points, loser +1; both rounds won/lost updated (P-02) | sys-league | M1 |
| le-004 | X and Y in one wing level on points, match wins and round difference; X beat Y 2–1 and lost to Y 0–2 | Rank them | Head-to-head points X 2, Y 4 → Y ahead. If they were level on head-to-head too: rounds won, then downs difference, then lot | sys-league | M1 |
| le-005 | Final wing tables as in sys-tournament's worked example | Seed the Reckoning | Seeds A, E, F, B, C, G, D, H. QF A–H, B–C, E–D, F–G hosted by the first-named club. Dusk's 5th (32 pts) is out, H (29) is in | sys-tournament | M1 |
| le-006 | QF A (seed 1) beats H; B (4) beats C; E (2) loses to D (7); F (3) beats G | Build the SF | SF1 A (host) v B; SF2 F (host, seed 3) v D. Final best-of-5 at the Charterhall | sys-tournament | M1 |
| le-007 | Muster: Reckoning champion is tier-table #6; tier-table #1 is another club. Banner: 8th places are clubs P and Q | Season end | Both Muster clubs go up; P and Q go down. Each tier has 16 clubs next season | sys-league | M1 |
| le-008 | Muster tier-table #1 also wins the Reckoning | Season end | It is promoted together with tier-table #2 | sys-league | M1 |
| le-009 | Banner club with 12 fighters is relegated | Next-season setup; the player reaches the end of P4 | P1 shows 12/10 and a cap-relief allowance of 2 at payout 0. Kick off is blocked: "Roster over cap: release 2 fighters". After 2 releases (payout 0) it proceeds | sys-roster | M1 |
| le-010 | A fighter's contract ends this season and is not renewed | Season end | He is a free agent at P1 with formerClubId set. His former club may offer like anyone else | sys-contracts | M1 |
| le-011 | Brannoc at his Banner club (prestige 50), expiring, started 12 of 14 matches (situation −500) | The player offers 320 for 2 seasons | Ask 345 (355 × 9,750 / 10,000 → 345). Ratio 9,275 ≥ 9,000 → counter 330. Accepting renews at 330 from next season; signing cost floor10(330 × 46 × 10%) = 1,510 | sys-contracts | M1 |
| le-012 | Same fighter, patience 3 | Three offers of 300 (ratio 8,695) | Three refusals. After the third: "will not renew this season"; he becomes a free agent at season end | sys-contracts | M1 |
| le-013 | Free agent Brannoc: ask 360 at A (Banner p50, would start) and 360 at B (Crown p60, would not start) | A offers 360, B offers 375; week processing | Scores A 10,500, B 10,416 → signs with A; B's digest shows "signed with A" | sys-transfers | M1 |
| le-014 | Muster club, roster 9, 1 pending offer | The player tries a second offer | Refused: "Roster full with pending offers (9 + 1 of 10)". No change | sys-roster, sys-transfers | M1 |
| le-015 | Muster club, WB 1,138, bill 1,000, nothing pending | Offers at 150, then 135 | 150 refused ("over wage budget by 12/week"); 135 accepted as pending | sys-finance | M1 |
| le-016 | Banner club, balance 1,500, P1 | Offer to Brannoc at 360 for 2 seasons | Refused: signing cost 1,620 > balance 1,500 | sys-finance, sys-contracts | M1 |
| le-017 | Brannoc on 360 to the end of next season; current week MW6 (index 10), before its processing | Release | Payout floor10(360 × 37 × 50%) = 6,660 charged at once; he cannot re-sign with this club this season | sys-contracts | M1 |
| le-018 | Muster club (prestige 20), balance 300 before MW10 processing, bill 900, away week | Process MW10, then MW11 (home, the club wins, 5 wins in 10 before it) | MW10: 300 + 313 − 900 − 210 = −497 → embargo; an offer at 150 is refused (tier minimum 60). MW11: −497 + 313 + 1,400 + 200 − 900 − 210 = 306 → embargo lifted | sys-finance | M1 |
| le-019 | Muster club with balance −6,000 after its 8th consecutive debt week | That processing, then next-season setup | Advance 6,000 → balance 0, prestige −5. Next grant 14,000 − 4,200 = 9,800 (installments 4,900 + 4,900); 1,800 is carried to the following season | sys-finance | M1 |
| le-020 | Crown club relegated; a fighter earns 721 | Next-season setup | Wage 575 (floor5 of 576). Parachute 24,000 credited now and 12,000 next season. Its WB is computed in the Banner Circuit | sys-contracts, sys-finance | M1 |
| le-021 | Muster club promoted, prestige 30 after the update, balance 12,000 | Next-season setup in the Banner Circuit | SB 83,076 (includes the 8,500 promotion grant); reserve contribution 0 (below the 12,461 floor); WB = 3,106/week (7,800 + 800 bp) | sys-finance | M1 |
| le-022 | P1; the player's Muster club has 2 trials rookies | Signs one at its ask of 150 for 3 seasons; ignores the other; Continue | First rookie signs at once, with signing cost 0, and is paid from the P1 processing. The second enters the pool at P1 processing before the AI acts, and from P2 is a normal free agent (signing cost applies) | sys-transfers | M1 |
| le-023 | MW6; free agent with ask 150 for 1 season, no rival offers | Offer 150; MW6 processing | Signed at MW6 processing; paid from MW7 (13 weeks); signing cost floor10(150 × 13 × 10%) = 190; eligible for the MW7 lineup | sys-transfers, sys-roster | M1 |
| le-024 | Banner club with 4 fit fighters at lineup lock | Play the match | One hired blade fills the slot, is paid 110 at that processing, is not on the roster afterwards (02 flow-006) | sys-roster | M1 |
| le-025 | AI club, fit roster: Tank 48, Healer 44, others 50, 47, 46, 45, 41 (no Seedbed) | AI lineup | Tank 48, Healer 44, 50, 47, 46; presets by its tacticsStyle; match captain = club captain if fielded | sys-ai-manager | M1 |
| le-026 | Ledger-keepers Muster club, WB 1,138 (×0.88 → 1,001), bill 950, roster 8 | AI action phase | Its wage room is 51/week, below the 60 tier minimum, so it makes no offer this week (no AI club exceeds wageUse × WB) | sys-ai-manager | M1 |
| le-027 | Same world seed, same inputs | Run 3 seasons headless twice | Identical fixtures, results, signings, ledgers and summary hash (P-05, vis-009) | all | M1 |
| le-028 | Final tier tables | Season end | Banner rank 3 receives 8,750; Crown rank 16 receives 1,560; Muster rank 9 receives 2,000 | sys-finance | M1 |
| le-029 | Muster club, prestige 26, tier rank 2, wins the Reckoning, promoted | Prestige update | delta = 4 + 5 + 8 = 17; new = 43 − trunc((43 − 45) × 0.15) = 43 | sys-league | M1 |

## 10. Open decisions and completion check

Linked to document 01 §8: open-014 and open-028 are answered here (pending the owner); open-005, open-006, open-007 and open-013 are adopted and made exact; the currency name, offer resolution timing, the M1-light patron goal and the tiebreak order are new OPEN items (Owner confirmations needed).

- [x] Every M1 action in these systems has legality, cost, result and failure behavior (offers, renewals, releases, trials signings, lineup lock, embargo).
- [x] Units, timing, rounding, randomness and precedence are explicit.
- [x] Important rules have worked examples with concrete values (budget, ask, negotiation, payout, embargo, advance, prestige, seeding).
- [x] Content entries refer to defined behaviors (personalities → sys-ai-manager; tiers → sys-league and sys-finance).
- [x] AI and generation have bounded fallbacks (hired blades, pool top-up, generation retries, deterministic lots).
- [ ] The prototype content set proves the central promise: needs a soak run once code exists.
- [x] Tunable values are separated from rules (§8 and the JSON files).

## Schema notes for the architect

1. **Content files.** `leagues.json` (structure and calendar), `clubs.json` (48 clubs and colorRules), `economy.json` (all money and AI tunables, integers only, bp for ratios). Load order: leagues → clubs → economy. Port the scratch checks to the content validator: club counts per tier = clubCount = 2 × wing size; caps follow O2 (10, +2 per tier up) with academy = cap; wing and cross matchweeks cover 1–16 exactly; calendar length = `economy.season.wageWeeksPerSeason`; grant installments sum to 10,000 bp and name existing weeks; tierProfiles exist for every tier level; every economy number is an integer; curve anchors are monotonic; all club ids, codes, names and primaries are unique; region, district, personality and style references resolve; and the colorRules thresholds.
2. **State (per career, in the save).** `league[tierId][season]: {seedOrder, wings, fixtures[], standings rows}`; `club: {tierLevel, wingId, prestige, history[], finance: ClubFinance, captainId, shortlist[] (player)}`; `contracts: Map<contractId, Contract>`; `fighter.contractProfile {greedBp}` (generated once); `offers: Map<(clubId,fighterId), Offer {wage, length, destination, madeAtWeek, isCounterAcceptance}>`; `negotiations: Map<(fighterId,clubId,season), {patienceLeft, counterPrice?, validUntilWeek?}>`; `pool: Set<fighterId>` plus `{unsignedSeasonEnds, formerClubId, releasedBy?, releasedSeason?}`; `ai: {voluntaryReleasesThisSeason}`. Keep ledgers per season as weekly category totals per club (23 × ~16 integers). Archive past seasons to summaries (final tables, titles, movements, season finance totals) to keep 30-season saves small.
3. **Integer math.** Use 03 §1's single rounding at the end of each formula; the order of terms is given in economy.json `_doc` strings. Products of two bp factors stay below 2⁵³ for every value range here (gate: 9,250 × 13,000 × 20,000 ≈ 2.4 × 10¹²).
4. **RNG.** Use only existing streams: `schedule` (slot shuffles, standings lots), `market` (greed at generation, free-agent tie lots), `rookies` (trials remainder), `ai` (AI tie lots), `soak` (harness). Paths: `(season, weekIndex | tierId, entityId)`. No new stream names are needed.
5. **Fixture and seed identity.** `lg:{season}:{tierId}:{weekId}:{homeClubId}:{awayClubId}` for league fixtures and `rk:{season}:{tierId}:{roundId}:{slot}` for Reckoning fixtures, so match seeds derive from stable identities (P-05, open-016).
6. **Week processing** is one atomic transaction over all clubs, in the order in sys-calendar; the autosave is written after it (open-016). AI lineups for week w + 1 are computed and stored at processing w, so the opponent's lineup is readable before the player's match.
7. **Interfaces.** `sys-knowledge.view(viewer, fighter)` returns true values in M1 and is used by every market screen and AI valuation. From combat, sys-match must report per round `{winnerSide, roundsWon, downs per side}` (tiebreaks, sponsor bonuses). From lifecycle: `humanAge`, `rating`, `potential`, `CQ`, fit status, trait polarity and economy hooks, generators for journeymen, hired blades and rookies.
8. **Performance budget.** 48 clubs × 23 processings per season: AI market evaluation is about O(clubs × pool) per week (48 × ~150). Precompute each free agent's market wage once per week; asks per club are cheap integer adjustments.

## Merge notes

**Combat designer**
- C1. Match format: `sys-match` takes `bestOf` (3, or 5 for the Reckoning final) and must always produce a winner, even after time caps or mutual downs (03 §1).
- C2. The tournament and league use the same match code. No home combat modifier in M1 (open-013); "home" only sets the west end of the arena.
- C3. Fight results must include rounds won and lost per side and downs per side, for tiebreaks 3, 5 and 6 and for sponsor win bonuses.
- C4. Tag each class preset with a stance tag in {aggressive, steady, cautious} (the clubs' `tacticsStyle`); the first preset per class is the default.
- C5. Role tags per class (tank, melee_dps, ranged_dps, controller, healer; hybrids carry two), the default starting row per role, and any lineup validity rules beyond "5 distinct fighters".
- C6. Rating 1–100 per class (03 §1) drives wages, calibre and AI value; confirm that ratings are comparable across classes, or supply a normalization.
- C7. Hired blades are generated at the tier band minimum; combat may prefer a specific class list per missing role.

**Fighter-lifecycle designer** (content/default/development.json, traits.json, races.json read; not edited)
- L1. Uses `humanAge = floor(age × 80 / lifespan)` for potential weight, the age discount and preferred length. Aligned with races.json.
- L2. Retirement before expiry (season end 7 → 8) and `unsignedSeasonEndsBeforeLeaving = 2` as the pool exit. Aligned.
- L3. Captain choice uses CQ with a hysteresis of 5, to respect the "snubbed" strip penalty.
- L4. Intake formula (≈ 24 + exits per season) accepted. This draft distributes rookies across clubs for Trials Day (floor per club + lot remainder) and asks that rookie quality not depend on the receiving club.
- L5. World-gen free agents: development.json proposes 1.5 per club (72); this draft recommends **2.5 per club (120)** so the first P1 market has choices in every tier. The potential shifts it lists as league-economy-owned are recorded in leagues.json (`worldGenPotentialShift` 8 / 4 / 0, rookies 0, generated free agents −3).
- L6. Economy hooks in traits.json: `fanAppeal` (+300 bp market wage and +200 bp home gate per fielded point, max +1,000), `wageDemandMult` ((mult − 1) × 10,000 bp on asks), `loyalty` (−200 bp per point on renewal asks). Please keep these hook names.
- L7. Needed generators: journeymen (Muster band, humanAge 26–33) for the pool floor; hired blades; rookies. `greedBp` is economy-owned and rolled on the `market` stream at fighter creation, so the lifecycle generator must call it or leave the field empty for economy to fill.
- L8. Renewal situation uses "matches started this season", the same usage data that drives XP.

**Lead designer (documents 01 and 02)**
- D1. open-014: the 16-club, two-wing structure replaces the 17-club single round-robin working assumption. 02 flow-010 "finishes 9th" becomes "finishes 5th or lower in its wing", and 02 §4 "Top 8 → tournament" becomes "top 4 of each wing".
- D2. 02 §2 step 4 and §3 "Sign a free agent": the commit point becomes "the fighter accepts at week processing". The offer reserves cap and wage room at once. Trials rookies and renewals stay instant.
- D3. 01 §7 "Gold": keep it as the mechanical term; the theme display name is OPEN (tessel).
- D4. 02 §4 "Optional objectives: none in M1" conflicts with the M1-light patron goal (OPEN).
- D5. Tiebreaks add "match wins" and "downs difference" to open-014's list, and apply head-to-head only when all tied clubs met equally often.
- D6. 02 §3 season-end order is kept, with prestige, pool maintenance, finance setup and the AI phase inserted as shown in sys-calendar.

**Presentation (document 04)**
- P1. Kit-clash rule (ΔE < 20 → the away side shows its secondary) and colorRules in clubs.json.
- P2. The finance screen, offer dialog (wage room after signing, signing cost), market list and compare view, and the embargo banner, as specified in the "Player information" blocks.

## Owner confirmations needed

1. **League structure (open-014).** 3 tiers × 16 clubs. Each tier has two 8-club wings redrawn each season; double round-robin inside the wing plus 2 cross-wing matches = 16 matches, 8 home and 8 away, no byes. Top 4 per wing reach the Reckoning. **Recommend: approve.** The alternative is 17 clubs in a single round-robin with one bye each.
2. **Promotion and relegation.** 2 down (8th in each wing), 2 up (the Reckoning champion and the Shield winner). **Recommend: approve.** It makes both the 16 matches and the tournament matter for promotion. The alternative is promotion by final standings only.
3. **Tournament rounds.** QF and SF best-of-3, hosted by the higher seed; best-of-5 final at the neutral Charterhall. **Recommend: approve** (combat confirms the match code).
4. **Currency display name.** "Gold" stays the rules term; the default theme shows **tessels (ts)**. **Recommend: approve tessel.** The alternative is "gold" everywhere.
5. **When free agents answer.** Offers are answered at week processing, with pending offers reserving cap and wage room. Rival AI offer counts are visible. Trials rookies and renewals answer at once. **Recommend: approve:** it is fair to the AI and makes each week's decisions matter. The alternative is instant signing when uncontested, which gives the player first pick every week.
6. **Hard wage budget.** New commitments must fit WB = 76–80% of the season budget plus up to 25% from savings. The embargo ladder follows open-007, with Registry deductions capped at 30% of a grant. **Recommend: approve.**
7. **Soft landings.** On relegation: a −20% drop clause, a parachute of 50% then 25% of the grant gap, and payout-free cap-relief releases. On promotion: a grant of 25% of the new tier's grant and a +8% wage ratio in the first season. **Recommend: approve.** Soak tests target 50–80% survival of promoted clubs.
8. **M1-light patron goal.** One season goal and a bonus, no penalty, on by default. **Recommend: approve as optional** (it gives every club a season target). The alternative, the lead's position, is no patron until M6.
9. **Contract costs.** Signing cost 10% of the guaranteed wages; release payout 50% of the remaining wages; renewals only in a contract's final season. **Recommend: approve.**
10. **World-gen free agents.** 2.5 per club (120) instead of the lifecycle draft's 1.5. **Recommend: 2.5.**
