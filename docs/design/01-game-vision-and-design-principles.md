# Arena League — game vision and design principles

> ARENA LEAGUE DESIGN PACKAGE · DRAFT v0.7 · 2026-10-27 · Lead designer. Not approved as a whole by the owner. **M1 and M1.1 have been built at risk** on this package's working assumptions under the owner's goal instruction (M1: main tagged `m1-season-mvp` @ 3e682d5; M1.1 "Playtest round 1": main tagged `m1.1-playtest-r1` @ 293f49a; the R002 playtest fixes merged on main @ d440107; the fix branches `m1.1/save-trim` and `m1.1/ki-fixes` and this documents branch (v0.7) are merged on main @ 00ad3db). The owner answered Q36 and every question of batch D (Q37–Q51) on 2026-10-27, approving them as recommended, and Q52 on levels (option A: keep the level model as built) the same day; the owner's answers to batches A, B and C (Q1–Q35) are still pending (§8.5). The package has had a requirements review and an independent review (§8.6), and the M1.1 build a code review and a QA playtest (§8.5, progress record). Owner requirements and owner decisions are REQUIRED. **v0.7 records the owner's answers of 2026-10-27 and syncs the package to main @ d440107**: the owner's words that fighter levels stay as total stat points (O23; clarified by Q52, option A: the level stays the stat-point-based number as built, open-034 settled), save size option A (Q36, O24), batch D approved, so D-U to D-AE are confirmed (O25) and the combat designer's rank, perk and tiredness proposals approved (O26), and the six R002 playtest tickets (O27–O32). **v0.7.1 (post-merge, same day)** records two owner decisions of 2026-10-27, the save budget (O33: about 10 MB, KI-2 closed, open-035 settled) and Q52 (option A: the level stays the stat-point-based number as built, O23 reworded, open-034 settled), and moves the status lines to main @ 00ad3db. v0.6 had synced the package to M1.1 as built: the combat, leveling and pool tuning, the hardened rank, swap and save rules, the report and interface changes, and the M1.1 known issues. Decisions D-A to D-T were made under delegation from the owner's goal instruction: they are DELEGATED, binding as the working design, and still need the owner's confirmation. D-U to D-AE were made the same way and the owner confirmed them (O25), so they are REQUIRED. Everything else is PROPOSED or OPEN. §8.5 lists every question for the owner. Current state: M1.1 "Playtest round 1" (O15–O22) and the R002 playtest fixes (O27–O32) are built and merged on main (@ d440107 for the R002 fixes; main is now @ 00ad3db, which also carries docs v0.7, the KI-2 compaction with save schema v4 and the KI-16/18/19 fixes); the planned order continues with M2 (D-N).

| Field | Value |
| --- | --- |
| Game / working title | Arena League |
| Design owner | The project owner. Agents draft; only the owner approves design decisions (G1) |
| Document version / updated | v0.7 (v0.7.1 post-merge update) / 2026-10-27 |
| Status | Draft v0.7. It records the owner's answers of 2026-10-27 (O23 to O26) and the six R002 playtest tickets (O27 to O32), and synced the package to main @ d440107 (M1.1 plus the R002 fixes; the tag `m1.1-playtest-r1` stays @ 293f49a); main is now @ 00ad3db. Q36 and batch D (Q37–Q51) are answered, so D-U to D-AE are confirmed and the combat proposals approved. Q1–Q35 are still open; Q52 (how levels relate to stat points) was raised in v0.7 and answered on 2026-10-27, option A (O23 reworded, open-034 settled). v0.6 was the M1.1 "as built" sync (main @ 293f49a), v0.5 the M1.1 design merge (the owner's tickets AL-R001-T001 to T005 and answers; contracts on main @ 714cae1) and v0.4 the M1 polish sync (tag `m1-season-mvp` @ 3e682d5). All five documents are written for M1 and M1.1. Values and decisions match the build on main @ 00ad3db, which merges the R002 fixes (d440107), the fix branches `m1.1/save-trim` (KI-2, O24; state schema v4) and `m1.1/ki-fixes` (KI-16, KI-18, KI-19) and this package (v0.7). Content on main is unchanged since 293f49a (the branches add `leagues.json` `matchRecords` and cut the Last Wall shield to 5%); the merged suite has 1,181 tests and the 10-season soak passes on it (the competitive-balance check is a warning by design), while the 1,093 tests and the 14/14 soak quoted in the sections were measured on 293f49a. **v0.7.1 (post-merge, 2026-10-27):** the owner raised the save budget to about 10 MB (O33), so KI-2 is closed and open-035 settled, and chose option A on Q52 (the level stays the stat-point-based number as built: O23 reworded, open-034 settled). M1 and M1.1 were built at risk, and the owner's answers to Q1–Q35 are pending. Two reviews have run on the package and their relayed findings are dispositioned (§8.6) |
| Current build target | M1.1 "Playtest round 1" (O15–O22) with the R002 playtest fixes (O27–O32), built and merged at risk on main (@ d440107 for the R002 fixes; main is now @ 00ad3db) on top of M1 "Season MVP" (O14; contents and the later order D-N); the next milestone in that order is M2. The package as a whole specifies every owner-required feature through M7 and the first release |
| Package location | `arena-league/docs/design/`, the destination the owner chose. The template's `tengo-` folder prefix is not applied |

## How to use this five-document set

This package replaces the separately planned `design.md` and `plan.md`. Documents 01–04 together form the game design document. Document 05 is the technical plan and milestone build plan.

| Read order | Document | Owns |
| --- | --- | --- |
| 1 | [Game vision and design principles](01-game-vision-and-design-principles.md) | Promise, pillars, audience, scope and milestones, glossary, authority, decision register, owner questions, progress |
| 2 | [Player experience and game flow](02-player-experience-and-game-flow.md) | Season and matchweek journey, game states, commit points, progression, failure and recovery |
| 3 | [Gameplay systems and content](03-gameplay-systems-and-content.md) | Mechanical foundations, system inventory, exact rules, content model, AI, tuning, acceptance cases |
| 4 | [Art direction and presentation](04-art-direction-and-presentation.md) | Visual identity, match reports, arena viewer, management UI, feedback, audio |
| 5 | [Technical design principles and build plan](05-technical-design-principles-and-build-plan.md) | Sim/render separation, determinism, data, saves, milestones M1–M7, verification |

**Drafting phases.** Phase 1 wrote 01, 02 and 03 §1–2. Phase 2 drafted 03 in three parts (`_drafts/03-combat.md`, `03-fighter-lifecycle.md`, `03-league-economy.md`). Those drafts are merged into 03 (v0.2, synced in v0.3), and `_drafts/04-presentation.md` into 04; all are kept only until the milestone commit and have no authority. `_drafts/05-technical.md` is installed as 05 (its later save-v2 change is ported in v0.3), with its §9.2 work packages unchanged because coding agents are executing against them. The mockups in `docs/design/mockups/` and the design system in `src/ui/styles/` are the approved EXAMPLE visual references (04 §2 ref-001). Content data lives in `content/default/`, which 03 declares the source of truth for numbers. Where a later draft conflicts with 01–03, record the conflict in the change record and in §8, and ask the owner or apply an existing delegation. Never resolve it silently.

### Meaning of specification labels

Every substantive statement carries a label so that the implementing LLM knows how much freedom it has.

- **REQUIRED**: approved behavior that implementation must preserve. Only owner requirements (IDs R, T, V, G) and owner decisions (IDs O) are REQUIRED. A REQUIRED statement cites its ID. A delegated decision that the owner has confirmed (D-U to D-AE, confirmed as O25) keeps its D-ID as a cross-reference and is cited "REQUIRED (O25, D-x)"; the owner-approved numeric values are TUNABLE within the documented bounds (03 §8).
- **DELEGATED**: a decision made without the owner, under the owner's explicit goal instruction not to pause for questions. The orchestrator made D-A to D-G, D-J to D-M, D-N to D-T and D-U to D-AE; the lead designer agreed D-H and D-I at the merge, as the orchestrator instructed. It is cited as "DELEGATED (D-x)". It is the binding working design: implementation may rely on it and must not reopen it without a new decision. It still awaits owner confirmation (§8.5, batch A). If the owner overturns it, every section listed for it in §8.2 must be revised. **D-U to D-AE are no longer DELEGATED:** the owner confirmed them on 2026-10-27 (O25), so they are REQUIRED and keep their D-IDs as cross-references.
- **TUNABLE**: approved behavior whose value may be adjusted within documented bounds. It always has an initial value. A provisional value on a behavior that is not approved is written **PROPOSED · TUNABLE**.
- **EXAMPLE**: an explanatory illustration. It adds no requirement.
- **OPEN**: an unresolved decision, recorded in §8.4 with its impact and the milestone it blocks. An OPEN item may state a **working assumption** (its recommendation) so that dependent drafts stay coherent. Text that relies on one is written "OPEN (open-nnn), working assumption", and must be revisited when the owner decides.
- **FUTURE**: outside every currently planned milestone (unscheduled). It is not permission to implement. Work planned for M2–M7 carries its milestone tag instead, never FUTURE.
- **PERMITTED-CHOICE**: a behavior the implementation chose within bounds the design states, documented as built. It may be changed without an owner decision if it stays within those bounds; it confers no approval of the bounds themselves.
- **PROPOSED**: a default adopted as working design without owner approval. This covers the research.md C3 defaults (P-01–P-21), the explanation-tooling must-have (P-22), and phase-2 draft rules that no decision covers. It is written "PROPOSED (P-nn)" where a P-ID exists. It confers no approval (silence is not agreement). When the owner approves a P-ID, its text becomes REQUIRED or TUNABLE. If the owner rejects or amends one, every section listed for it in §8.3 must be revised.

Precedence when labels meet: REQUIRED, then DELEGATED, then PROPOSED, then an OPEN working assumption, then EXAMPLE. A status line at the top of a section sets the label for that section's untagged prose; untagged prose never creates a requirement by itself. A bracketed placeholder is unanswered, not a default. Milestone tags (M1–M7, "first release") state when a behavior is first required.

### Authority and changes

The owning document in the table above is the source of truth for its subject. Other documents link to it rather than restate detailed rules. Vision sets priorities but does not silently override a specific rule.

| Source / decision | Authority and limits | Approval / date |
| --- | --- | --- |
| Owner brief: R1–R7, T1–T6, V1, G1 (table below) and original milestones (a)–(g) | REQUIRED. The original milestone order is superseded by O14 (the M1 target) and D-N (the M1 contents and the M2–M7 order), and its contents folded into M1–M7 | Owner / 2026-10-25 |
| Owner answers O1–O7 | REQUIRED as worded in §8.1. The O2 and O3 interpretations need confirmation (open-002, open-003) | Owner answer 2026-10-25 |
| Owner goal O8–O14 | REQUIRED as worded in §8.1 | Owner goal 2026-10-25 |
| Owner tickets and answers O15–O22 (M1.1 "Playtest round 1") | REQUIRED as worded in §8.1 (playtest tickets AL-R001-T001 to T005 in `tickets/`, and the owner's answers) | Owner tickets/answers 2026-10-25/26 |
| Owner answers and tickets O23–O32 (2026-10-27: levels, save size, batch D and the combat proposals, and the R002 playtest tickets) | REQUIRED as worded in §8.1 (the owner's answers in chat, and playtest tickets AL-R002-T001 to T006 in `tickets/`) | Owner answers 2026-10-27; tickets 2026-10-26/27 |
| Delegated decisions D-A to D-T (§8.2) | DELEGATED: binding working design, pending owner confirmation | Orchestrator delegation under owner goal 2026-10-25 |
| Delegated decisions D-U to D-AE (§8.2), confirmed | REQUIRED under O25 as worded in §8.2; the numeric values are TUNABLE within the documented bounds | Orchestrator delegation 2026-10-25; owner confirmation 2026-10-27 |
| `docs/research.md` (§1 glossary, §2 summary, Parts A–C) | Evidence and recommended defaults only. C3 defaults enter as PROPOSED P-IDs. Where an O- or D-decision differs, that decision governs (§8.3) | Not approved |
| research.md Part D (§5a, traits and captains) and `research-notes/06` | Evidence for O5 and O6; its D3 recommendations are reflected in the 03 trait and captaincy specs (PROPOSED) | Not approved |
| `docs/research-notes/01–05` | Supporting evidence | Not approved |
| `content/default/*.json` | Source of truth for **values** under 03's rules. Values were edited at the merge to match D-A and D-C, and later by balance pass 1, the tuning pass, the core fix round and the M1.1 combat and leveling and pool tuning passes (change record). A disagreement between 03 and the data is a defect to report | Values PROPOSED · TUNABLE |
| Phase-2 drafts in `docs/design/_drafts/` | All drafts (03, 04, 05) are merged and have no further authority, and so are the M1.1 drafts (`_drafts/m1.1/`, merged into 03 v0.5); the architect's M1.1 addendum `_drafts/05-technical-m1.1.md` was merged into 05 §9.3 by reference (v0.6 records there what was built), and like §9.2 it bound the coding agents; the drafts are kept until the milestone commit. Code is never design authority; 05 §9.2 governs who may change which code | Not approved |
| `docs/design/mockups/` and `src/ui/styles/` (tokens, base, components) | Approved EXAMPLE visual references and the primary visual anchor for 04 (ref-001): layout, palette, type, components. Sample data is EXAMPLE; where their wording differs from 04, 04 governs | Orchestrator instruction 2026-10-25; owner confirmation in Q26 |
| Tengo templates, guide and references | Structure and process only | n/a |

**Owner requirements (REQUIRED).** These IDs are cited throughout the package.

| ID | Requirement (from the owner's brief, amendments applied) | Owning sections |
| --- | --- | --- |
| R1 | Arena autobattle: sides of **5** fighters (amended from "3–5", O1) fight in real time in a 2D arena, automatically, using player-defined tactics. Top-down or side-view; the design recommends one (P-03). Until M2, fights are simulated headlessly and shown as match reports (O12) | 02 §1; 03 §1, sys-fight-sim |
| R2 | Tactics editor: ordered "IF condition THEN action" rules per fighter, gambit-style. A core pillar; deep but approachable. Editing arrives in M3; M1 uses per-class default presets (D-N) | 03 sys-tactics, sys-tactics-editor |
| R3 | Scouting is required. True stats and potential are hidden or fuzzy until scouted. Scouts are hireable staff with skills, regions of expertise and limited time. Scouting takes in-game time, and better scouting gives more accurate reports. Arrives in M4 (D-N) | 02 §7; 03 §3.5 |
| R4 | Multiple leagues: several regions and tiers with promotion and relegation, plus cups. Leagues differ in prestige, prize money and player quality. Tiers and promotion/relegation in M1; more regions and cups in M6 (D-N) | 02 §4–5; 03 sys-league |
| R5 | Academy: send fighters (especially young ones) to an academy for extended periods. There they are unavailable for matches but develop stats, potential and new abilities/traits. Trade-offs: cost, risk, academy types/specializations. Rules per O2/O3. Arrives in M5 | 02 §3–6; 03 §3.5 |
| R6 | Management: roster limits, contracts and wages, transfer market, finances, aging, and player development with potential | 02 §5; 03 §3.2–3.3 |
| R7 | Save/load. Included in M1 (D-N) | 02 §3; 03 sys-save; 05 §5 |
| T1 | PixiJS v8 renders the 2D arena: placeholder sprites or simple shapes first, clear silhouettes and team colors, HP bars, readable ability effects and hit feedback, 1x/2x/4x speed and pause, easy to reskin later. Arrives in M2 (O12, D-N) | 04; 05 |
| T2 | TypeScript + Vite | 05 |
| T3 | HTML/CSS UI for management screens (menus, tables, tactics editor), layered over or alongside the canvas | 04; 05 |
| T4 | The simulation is pure TypeScript with no PixiJS imports, strictly separate from rendering, and deterministic with a seeded RNG, so battles can be replayed, simulated headlessly for AI-vs-AI matches, and unit-tested | 03 §1; 05 §3, §6 |
| T5 | Theme content (names, classes, leagues) lives in data/config files. Default theme: fantasy mercenaries | 01 §4; 03 sys-theme; 05 §4 |
| T6 | Later, package as a desktop app with Tauri or Electron for Steam, after the core milestones. Scheduled in M7 (D-N); the wrapper choice is open-017 | 05 §8 |
| V1 | Unit tests for the sim and tactics. Balance is checked by headless simulation of many matches | 03 §8–9; 05 §10 |
| G1 | The owner must be asked before big design decisions that the design does not cover | 01 §8; 05 §11 |

**Change record.**

| Change | Why | Documents / IDs affected | Approved by |
| --- | --- | --- | --- |
| v0.1: package created from the Tengo templates (O7). O1–O14 recorded. C3 defaults as P-01–P-21, explanation tooling as P-22. Target M1 | Owner brief, answers and goal of 2026-10-25 | All | O-decisions by the owner; the rest awaits approval |
| Milestones (a)–(g) replaced by M1–M7 with M1 as target (O14) | Owner goal: "a working version where I can progress a full season" | 01 §5; 02 §2; 03 §2; 05 §9 | Owner goal 2026-10-25 for the M1 target; the M1 contents and the M2–M7 order were the orchestrator's, now D-N (corrected in v0.3) |
| v0.2: the three 03 drafts merged into 03 §3–10. D-A to D-I recorded (§8.2). open-005, 014, 019, 024, 025, 027, 028 and 029 settled by delegation; open-006, 007 (M1 part), 011, 012 and 013 settled in 03 as PROPOSED. New items open-030 and open-031. New sys-id sys-chemistry. 02 reconciled. The owner questions consolidated into §8.5 | Orchestrator instruction to merge without pausing (owner goal) | 01 §4–§8; 02 §1–§9; 03 all | D-A to D-I delegated; the rest awaits the owner |
| v0.2: the 04 draft merged into 04 and reconciled with 01–03 (screen names, calendar labels, offer timing, money ladder, wings and the Reckoning bracket, pacing presets). The UI designer's OC-3 to OC-6 recorded as D-J to D-M; OC-1, OC-2 and OC-7 to OC-10 as Q26 and Q27. Pacing presets moved from M7 to M1 (D-L) | Orchestrator instruction | 01 §5, §7, §8; 02 §2, §3, §7; 04 all | D-J to D-M delegated; the rest awaits the owner |
| v0.2: the architect's 05 draft installed as 05 and reconciled with 01–04: the delegated decisions D-A to D-M are mapped to their technical consequences; references to the 03 drafts resolve to the merged 03; the 05 §9 milestone table agrees with 01 §5 (patron in M6, pacing presets in M1, fonts in M7). §9.2 work packages and contracts unchanged | Orchestrator instruction | 05 all; 01 §8.5–8.6; 03 §10 | Technical decisions tech-001–014 by the architect; design items await the owner |
| v0.2 content value edits (structure and keys unchanged): `development.json` developmentClock.usageFloor 0.2 → 0; training.emphasisBonus 0.25 → 0.2; training.offEmphasisPenalty 0.15 → 0.2; training.bodyWearReduction 0.2 → 0 (all D-A); generation.worldGen.freeAgentsPerClub 1.5 → 2.5 (D-C); the doc strings of training, decline.\_mentalDeclineNote (D-B), chemistry (D-D) and captaincy.aiPolicy (D-I). `economy.json` patron.enabledByDefault true → false and its doc string (D-C). `leagues.json` generationShifts.worldGenFreeAgentsPerClub note resolved (D-C). `combat.json` \_doc notes millimetre positions (D-E) | Make the data agree with the merged rules | content/default | D-A, D-B, D-C, D-D, D-E, D-I |
| v0.3 (M1 doc sync): documents 01–05 brought into line with the M1 build on main @ f4b39d9. Content values re-derived from `content/default`: combat balance pass 1 (1597f1d: class base values, 12 ability values, 295 preset rules; the ±30% per-pass bound exceeded and logged as an exception in 03 §8.2); the tuning pass m1/fix-tuning (wage curve 0.8×, tier minimum wages 260/150, reserve cap 10%, prestige reversion 25%, prestige sensitivity of sponsor, gate and ask halved, starter bonus 1,000 bp, AI starter bonus 10 and veteran penalty 3, intake basePerClub 0.75, captain grade A at 90); m1/fix-core (rookie ask capped at 1.25 × the tier minimum, opening bills at 80–87% of WB, the D-T retirement parameters and widened soak bands). Worked examples and §9 cases recomputed | Final doc sync for M1 (orchestrator instruction) | 01 all; 02 all; 03 §1–§10; 04 header, §6, §11; 05 header, §3.3–§3.4, §5, §8–§10, §12 (§9.2 untouched) | Values: PROPOSED · TUNABLE in the data; the designers' changes are reported, not approved |
| v0.3: D-N to D-T recorded (§8.2) with origin "orchestrator delegation under owner goal 2026-10-25, pending owner confirmation"; O14 reduced to the owner's words, with the M1 contents and the M2–M7 order moved to D-N; O11 quotes the owner on mental decline. Requirements-review fixes C3–C7 and C9 and independent-review fixes #1, #2 and #4–#10 applied and recorded (§8.6). Label PERMITTED-CHOICE added. Owner questions Q28–Q36 added; Q10 and Q20 extended; one-line batch approvals. M1 known issues recorded (05 §12) | Reviews of v0.2; decisions taken during the M1 build | 01 §1–§8; 02; 03; 04; 05 | D-N to D-T delegated; the rest awaits the owner |
| v0.4 (M1 polish sync): the QA polish round folded in. Data (`content/default`): orc injury chanceMult 0.85 → 0.75, recoveryMult 0.85 → 0.8, scarMult 1 → 0.9; physical decline softened (0.2 at 31 … 1.0 from 47); the D-T rating-drop hazard recalibrated; `contracts.expiryReminderWeeksBeforeEnd` 4. Rules: renewals until the expiry step; `contract.expiring` news; `developmentSummary`; veterans' career lines and titles; tier-minimum raises recorded and reported; self-dropped casts are not interrupts. UI: expiry confirm, blocked-offer reasons, review deltas and raises, Home advice, Skip to Matchweek 1, "No matches played yet" (KI-9 resolved), market columns, shortcuts, no internal ids. Known issues KI-10 to KI-15 added; the QA re-verification recorded | Orchestrator instruction after the QA polish round | 01 §8.2 D-T, §8.5 Q34, progress record; 02 §2–3; 03 sys-races, sys-fighters, sys-development, sys-injury, sys-calendar, sys-contracts, sys-match-report, §8, §9; 04 ui-home, ui-report, ui-market, ui-season-end, §6.1; 05 header, §3.3–3.4, D-R, §12 | Orchestrator decisions in the polish round, pending owner confirmation; values PROPOSED · TUNABLE |
| v0.5 (M1.1 "Playtest round 1"): owner decisions O15–O22 recorded from tickets AL-R001-T001 to T005 and answers (O17 replaces D-A for roster fighters); D-U to D-Z recorded for the designers' remaining choices; open-010 settled, open-032 added; batch D (Q37–Q46). 01 §5 gains an M1.1 row and §7 the M1.1 terms. 02 gains the squad decision, the between-round pause and level-up interruptions. 03 rewrites sys-development for levels and adds sys-freshness, sys-fight-freshness, sys-ability-ranks and sys-perks, squads and swaps in sys-match, §8.6 and §9.4 (the drafts' scenarios; cap-011 renumbered cap-012). 04 adds the level-up card, the between-round screen, the 5 + 2 squad and the Freshness displays. 05 §9.3 merges the architect's M1.1 addendum (state v3, compact match records, migration, WP-A to WP-D); §9.2 unchanged | Owner tickets and answers 2026-10-25/26; orchestrator instruction | 01 §5, §7, §8; 02 §1–§3, §5, §7, §9; 03 §1–§4, §6, §8–§10; 04 §6; 05 header, §3.4, §9.3, §12 | O15–O22 by the owner; D-U to D-Z delegated; the rest PROPOSED |
| Playtest ticket tool (F8) added: viewport screenshot, save and metadata per ticket; ids `AL-R###-T###_YYYYMMDD-HHMMSS` (run per career, R000 without a career); dev-only Vite plugin writing `tickets/<id>/` with same-origin protection; IndexedDB fallback; `?ticket=` reproduction in its own slot without autosaves; optional `careerId` in the save meta (additive) | Owner request for in-game playtest feedback | 04 §6.4; 05 §8; README | Owner request; implementation details by the orchestrator |
| v0.6 (M1.1 as built): the package synced to main @ 293f49a (tag `m1.1-playtest-r1`). Data (`content/default`): the M1.1 combat tuning (m1.1/tune-combat): the Freshness penalty at full is ×0.8 of the original (attack speed −8%, move −4.8%, Power and Support −6.4%, reaction delay +20%); perk nerfs (Hunter's Patience 10% → 6%, Overload 10% → 6%, Last Wall 20% → 12% → 8% after the integrator's cut, Glass Cannon 12% → 9%); six focus-regeneration perks given real effects (Measured Breath, Ready Mind, Deep Well, Puppeteer, Wellspring, Rallying Horn); real cooldown steps for all 22 control abilities and rank-3 trims on 14 other abilities. The leveling and pool tuning (m1.1/tune-life): xpPerLevel base 115 → 102, ageFactorPhysical at 0 0.72 → 0.68 and at 24 1.25 → 1.10, unsigned free agents leave after 3 season ends (from 2), intake basePerClub 0.75 → 0.8, AI rotation extraGapPerPointBelow 0.25 → 0.45, new freshness.tiredDrainShare 0.5; Ashkin injury chanceMult 0.85 → 0.82; the six deferred `development.json` removals done (usageFloor, maxDeltaPerSeason, emphasisBonus, offEmphasisPenalty, bodyWearReduction, trend). Rules hardened: no rank lengthens any control effect, hard or soft (validator; Torpor Field rank 3 became a cooldown step); swaps are blind in the player's view and `match.swap` takes the player's club only; `SAVE_BOUNDS` is shared by the save schema and the content validator; compaction drops the per-round records of old matches (about 0.6 MB a season). Soak: `competitive-balance` is warning-level, the level-ups check skips cohorts under 20 and otherwise fails beyond 2.5 standard errors, the bench ratio is age-matched. Build: the content is a lazy chunk (about 83 kB gzip; startup JS about 204 kB against the 250 kB budget), `_` doc keys are stripped, a budget test enforces it. Report and interface changes (04 §6.3). Freshness labels: Spent < 40, so 40 reads Tired, in every document. New decisions D-AA to D-AE and questions Q47–Q51 (batch D is now Q37–Q51). Known issues KI-1 to KI-6 updated and KI-16 to KI-19 added (05 §12). The M1.1 code review (no blocker, 7 minor, all fixed or documented) and the QA playtest (all M1.1 rules pass; the owner's real R001 career migrated and played) recorded | Final doc sync for M1.1 (orchestrator instruction) | 01 header, §5–§8, handoff prompt; 02 §1–§3, §5, §7, §9; 03 §2–§3, §6, §8–§10; 04 §6; 05 header, §3.3–§3.4, §5, §8–§10, §12 | D-AA to D-AE delegated (orchestrator decisions in the M1.1 tuning and QA rounds, pending owner confirmation); values PROPOSED · TUNABLE; the rest PROPOSED |
| v0.7 (owner answers of 2026-10-27 and the R002 sync): the package synced to main @ d440107, which merged the six R002 playtest tickets (core 15f16ce, UI 12ef36a); no code or content was changed by this documents pass. **Owner decisions recorded (§8.1):** O23 fighter levels stay as total stat points (the owner's words only; the build's level counter differs from them in three ways, open-034, Q52); O24 save size, option A (Q36: AI-vs-AI results compacted a few weeks after they are played, the player's own matches never trimmed in the season; built on `m1.1/save-trim` with a 3-week window and state schema v4); O25 batch D confirmed as recommended, so D-U to D-AE are REQUIRED, with numeric values TUNABLE within the documented bounds (Q44 and Q48 values to be retuned after more playtesting and the fatigue harness; Q51 "Always" stays the playtest default); O26 the combat designer's proposals approved (Q46, cmb11-q1 to q6: ranks, perks, the tiredness penalty, Stamina's 2% rating weight; the perk cap and the tiredness penalty to be revisited after harness runs); O27 to O32 the R002 tickets (a fuller box score, Freshness and the effective rating in the Squad table, a true reserve swap, ratings and more stats between rounds, R1/R2 markers, renewals judged on next season's wage room). The citations of D-U to D-AE in 01–05 are relabelled from "DELEGATED (D-x)" to "REQUIRED (O25, D-x)", and the rank, perk and tiredness-penalty rules from PROPOSED to REQUIRED with TUNABLE values (O26). §8.5: Q36 and Q37–Q51 marked answered, the interview progress record updated; Q1–Q35 stay open and Q52 is new (batch E). New register items: open-033 (AI renewal budget against next-season room), open-034 (levels and stat points) and open-035 (how to bring saves under 3 MB); 05 KI-20 to KI-23 (a known gap in the next-season check, swaps rarely matter in the squad-match harness, Battle Chaplain, content values hard-coded in the Market text). New acceptance cases: 02 flow-034 to flow-039; 03 le-033 to le-036, fr-005, fr-006, box-001, box-002, sqd-001, sqd-002, sav-002 and sav-003. 05 §12: KI-2 stays open after `m1.1/save-trim` (the save is still above 3 MB, open-035); KI-16, KI-18 and KI-19 are resolved on `m1.1/ki-fixes`; KI-21 (swaps rarely matter), KI-22 (Battle Chaplain) and KI-23 (content values hard-coded in the Market text) are new. Content on the two branches, not edited by this documents pass: the new `leagues.json` `matchRecords.compactAiMatchesAfterWeeks` (3; outside the content hash) and the Last Wall shield 8% → 5% of max HP in `perks.json`. Glossary: effective rating, box score, next-season wage room, R1/R2 | Owner answers in chat 2026-10-27; tickets AL-R002-T001 to T006; orchestrator instruction | 01 header, labels, authority, §5, §7, §8.1–§8.5, completion check, handoff prompt; 02 header, §1–§5, §7, §9, §10; 03 header, §2, sys-combat-stats, sys-fight-freshness, sys-ability-ranks, sys-perks, sys-match, sys-match-report, sys-races, sys-fighters, sys-development, sys-injury, sys-freshness, sys-roster, sys-finance, sys-contracts, sys-ai-manager, sys-calendar, sys-save, §4, §5.2, §8, §9.3, §9.4, §10; 04 header, ui-squad, ui-between, ui-report, ui-market, ui-save, ui-settings, §11; 05 header, §4, §5, §8, §9, §9.3, §10, §11, §12 | O23–O32 by the owner; D-U to D-AE confirmed (O25); the rest PROPOSED or as before |
| v0.7.1 (post-merge update; the five document headers stay at v0.7): main is @ 00ad3db, which merged docs v0.7, the KI-2 in-season compaction (state schema v4) and the KI-16, KI-18 and KI-19 fixes. **Owner decisions recorded (§8.1):** O33, the save budget is raised to about 10 MB. The owner said in chat on 2026-10-27: "Accept the current sizes: raise the save budget to about 10 MB and close KI-2 after this merge." The budget becomes **a save of at most 10 MB at any point of a 10-season career, in-season peak included** (TUNABLE (tech)), replacing the 3 MB budget; the M7 gate (30 seasons × 10 seeds) re-measures it. Measured on main (`npm run bench -- --seasons 10 --player`): end of season 4.0–5.6 MB (4.46 MB at season 3), in-season peak 4.8–8.9 MB (7.6 MB at season 3, 8.9 MB at season 10), autosave about 20–48 ms, so today's saves fit. open-035 is settled by O33 and 05 §12 KI-2 is resolved. **And Q52, option A (§8.5, O23):** the owner said in chat on 2026-10-27: "Keep the level model as built (no code change); reword O23 so it says the level is the stat-point-based number as it works today." O23 is reworded (the original quote kept, the clarification added, the as-built model spelled out and now REQUIRED, with TUNABLE constants), open-034 is settled, Q52 is marked answered (17 of 52 questions answered, 35 open), and 03 sys-development "Levels" now specifies the approved model; no code or content changed. Status lines moved from "main @ d440107 plus the fix branches" to main @ 00ad3db (the merged suite has 1,181 tests; the 10-season soak passes, with competitive-balance a warning by design). Historical text (the v0.7 row, the Q35, Q36 and Q52 question text, the Q36 answer as given) is unchanged; O24, the Q35 note and the Q36 answer carry dated notes | Owner decision in chat 2026-10-27; orchestrator instruction | 01 header and status, §8.1 (O23, O24, O33), §8.4 (open-034, open-035), §8.5 (Q35 and Q36 notes, Q52 answer), glossary, D-X note, progress record, completion check, handoff prompt; 02 linked register, 02, 03 and 04 headers; 03 sys-development Levels, sys-save size rule, linked register; 05 header and status, repository status, §5 Size, §8 budget table, §9.3 migration note, §12 (introduction, KI-2), owner-questions row | O33 and the Q52 answer (O23 reworded) by the owner; the rest as before |

## 1. Central player promise

**Status:** PROPOSED wording, awaiting owner review (open-001). The underlying requirements are R1–R6 and O1–O14.

> This game lets the player run a mercenary fighting club in the Arena League: sign fighters whose true worth is never fully certain, develop them across seasons as they age, choose (and later write) the IF/THEN rules each one follows, and send five of them into real-time arena fights the player cannot directly control. It is compelling because cause and effect stay visible: the player's own signings, rules and long-term bets win or lose matches, under the same rulebook as every rival club.

- **Player role:** the manager of one club (in fiction, a chartered mercenary guild). The manager decides signings, contracts, lineups, captaincy, presets and later rules, training emphasis, and from M5 academy placements. The manager never steers a fighter directly during a fight (P-01).
- **Main player activity:** preparing each matchweek (lineup, presets, market, money), then reading or watching how that preparation played out. In M1 the outcome is read as a match report (O12); from M2 it can be watched in the arena viewer.
- **Distinctive appeal:** per-fighter ordered rules inside an autobattler, inside a club-management career with race-specific aging, Crusader-Kings-style traits, hidden talent (from M4) and an academy (from M5). Research finds no mainstream autobattler with per-unit rule lists (research §2.1, A4.1).
- **Desired emotional arc:** for a match, anticipation, then tension, then understanding of why, then the urge to adjust. For a season, the preseason scramble, the race for the top 4 of the wing, the climax of the Reckoning, and a bittersweet season end (aging, retirements, rookies). Across a career, attachment to fighters whose whole arcs the player has shaped.
- **Evidence that the promise is working:** when asked why a match was lost, players point to a rule, a preset, a lineup or a signing rather than to luck (vis-001). After a season end they choose to start the next season (vis-007).

## 2. Audience and play context

**Status:** PROPOSED (open-001) unless an ID is cited.

| Topic | Decision | Design consequence |
| --- | --- | --- |
| Intended audience / familiarity | PC players who enjoy sports or club management sims, autobattlers, or party-AI rule systems from RPGs. No programming knowledge assumed; comfort with tables and numbers assumed | Rule logic is taught through working presets, plain-sentence rules and short challenges (02 §7). Management screens may be dense but must be fast and readable (O13) |
| Primary genre / secondary influences | Club-management sim fused with a real-time autobattler and gambit-style tactics | Adopted: promotion/relegation, contracts, fog-of-war scouting (from M4), ordered rules, explained outcomes. Rejected: lobby PvP economies, unbounded randomness, paid power, press conferences (P-15, P-17) |
| Play context | Single player, offline. One decision-maker against AI clubs that follow the same rules (P-04) | No shared decisions. Multiplayer is FUTURE (02 §8) |
| Intended devices and inputs | Desktop PC, mouse and keyboard, windowed or full-screen. Browser build during development; desktop wrapper for Steam in M7 (T6) | Keyboard shortcuts for the weekly loop. No touch or controller requirement at first release. Minimum resolution is set in document 04 |
| Typical session length | 30–120 minutes. A matchweek takes 1–5 minutes; a 23-week season 2–4 hours at default pacing (PROPOSED · TUNABLE, vis-006) | Natural stopping points after each matchweek and at season end. Save at any management screen (02 §3) |
| Expected commitment | An endless career (P-10) with saves of 10+ seasons | Mastery deepens through presets and later rules, scouting and long-term roster building. Novelty comes from aging, rookies, tier movement and rivals |
| UI priority | REQUIRED (O13): focus on good UI design | Every recurring task gets a short, predictable path. Information hierarchy and click budgets are acceptance criteria (vis-006; document 04) |

Business model, distribution, connectivity, localization and age suitability: premium price with a free demo, no paid power, offline-first (PROPOSED, P-15). Steam distribution through a desktop wrapper after the core milestones (REQUIRED, T6). English at first release, with every player-facing string in theme data so it can be localized later (REQUIRED for data, T5; localization itself is FUTURE). Tone suits teen-and-up fantasy violence: fighters are downed and yield, with no gore (PROPOSED, open-001).

## 3. Design pillars and tradeoffs

**Status:** PROPOSED (open-001). Each pillar is anchored to the REQUIRED items in its name cell.

| Pillar | What the player experiences | Design implication | What would violate it |
| --- | --- | --- | --- |
| **1. Your rules fight** (R1, R2) | Fighters act on the rules the player chose, so a different preset or rule visibly changes the fight | Rules and the stance fallback are the only source of fighter decisions (P-06). Tactics must beat small stat gaps (vis-002). Presets make the first match approachable; vocabulary deepens later (P-07) | A fighter acts on a hidden personality roll; a slightly stronger roster always wins whatever the rules; a first edit needs programming concepts |
| **2. Clear at a glance** (O13, P-22) | Any screen answers "what should I do next?", and any result answers "why did that happen?" | Match reports, recaps and (from M2) rule badges and an inspector show causes. Costs and odds appear where they are decided: wage room in the offer dialog, injury odds on the lineup screen | A loss with no traceable cause; a hidden fee; a weekly chore spread over five screens |
| **3. Knowledge is earned** (R3, O4; active from M4) | Every fighter starts as a fuzzy baseline report; scout time turns ranges into certainty; good information beats the market | True stats and potential are hidden from M4. Scouting narrows ranges, AI clubs scout imperfectly (P-04), and some vagueness remains (P-12) | All values exact from the start of a career once M4 exists; scouting that never changes a decision |
| **4. One rulebook for every club** (T4, P-04, P-05) | Rival clubs face the same wages, budgets, injuries, aging, presets and limits. A played result cannot be rerolled | One deterministic sim for viewed and headless matches. Seeded randomness committed at defined points. AI parity of outcomes | AI rosters regenerating for free; AI clubs ignoring budgets; reloading a save to reroll a loss |
| **5. A club that outlives its fighters** (R5, R6, O11, P-10) | Long-term bets (contracts, rookies, playing time, the academy, promotion) shape seasons; fighters peak, decline and retire on race-specific arcs | Long-term choices show their costs and outcome ranges up front. Aging and retirement are always on. The career is endless | A save that goes flat by season 4; an academy program with hidden downside; a decline the player could not see coming |

**When pillars compete,** prioritize in this order: 4 One rulebook, then 2 Clear at a glance, then 1 Your rules fight, then 3 Knowledge is earned, then 5 A club that outlives its fighters. Rationale: determinism and fairness are a fixed technical mandate (T4) and make the other pillars meaningful; a tactic the player cannot understand is not one the player authored; fog serves decisions but must never make the player's own rules unreadable; long-term systems must respect all four.

**Difficult tradeoff 1, explanation against fog (from M4):** an attack from the player's rule misses because the target dodged. Pillar 2 wants the report to explain the miss; pillar 3 hides the opponent's true agility. Chosen outcome (PROPOSED, open-001): the explanation names the mechanical cause ("missed: target dodged") and shows any chance as a range from the viewing club's knowledge, never the hidden true value. Facing a fighter narrows that knowledge afterwards (P-19).

**Difficult tradeoff 2, agency against autobattle purity (from M2):** R1 says fights run automatically, yet research finds pure watching disengages players (research §2.8). Chosen outcome (PROPOSED, P-01): pausing to inspect is free, but the player gets at most two calls per round, and AI managers have the same budget.

## 4. Setting, tone, and identity

**Status:** the theme being data-driven is REQUIRED (T5). Every name below is EXAMPLE default-theme content (`content/default/`). The tone is PROPOSED (open-001).

- **Premise and setting:** after a ruinous war, the princes and free cities of the realm signed the Arena Charter. Feuds, border claims and debts are now settled by licensed arena contests. Mercenary guilds chartered as **clubs** fight in the Arena League for purses, prestige and honor. The Charter Registry in Port Varrow licenses every fighter, strikes the **tessels** (ts) the clubs are paid in, and hosts the **Charterhall**, where every Reckoning final is fought.
- **World:** the coastal region of **Saltmarch** hosts the leagues: the **Crown Circuit** (tier 1), **Banner Circuit** (tier 2) and **Muster Circuit** (tier 3), each of 16 clubs split into the **Dawn** and **Dusk** wings, 48 clubs in all. The volcanic south, **Emberreach**, and the northern forests of **Thornwald** send fighters to Saltmarch and host leagues of their own from M6 (open-027).
- **Peoples:** five races whose lifespans shape careers (O11, D-B, D-T). **Humans** (80 years) peak physically around 28. **Elves** (120) climb slowly, peak around 42 and are hurt more often. **Dwarves** (72) and **orcs** (64) are shorter-lived but sturdier. The **Ashkin** (52), an original race, arrive near their peak and usually last about nine seasons in a physically weighted class, longer in a mental one. Casters and healers, whose skills are mental, play on longest (D-T).
- **Tone:** gritty but warm sporting fantasy, with mud, banners, rival guild banter, dry humor and pride in the craft. Violence is sporting: a fighter at zero HP is **downed** and yields. Deaths happen only in opt-in hardcore careers (P-11, M7). No gore, cruelty played for laughs, or sexualized content.
- **Narrative role:** emergent only. Stories come from rivalries, fighter arcs, traits, records, upsets and captaincy. There is no authored campaign or cutscenes. Text is hand-written or curated (research C2.10).
- **What makes this world recognizable:** guild heraldry as club colors; contracts as sealed charters; the Charter Registry as referee, banker of last resort (the Registry advance) and, from M4, issuer of the free baseline report (O4); the Reckoning as the season's great festival.
- **What must remain consistent:** the Charter binds every club equally, which is the in-fiction face of pillar 4. Downed is not dead (except in hardcore). Abilities are visible and telegraphed. A race's aging and durability hold for every fighter of that race. Mechanics never depend on theme strings: a reskinned theme changes names and text, not rules (T5).

Visual execution belongs in document 04, mechanical rules in document 03.

## 5. Scope across three horizons

**Status:** M1, a version in which the owner can "progress a full season" with simulated battles, was the first target and is REQUIRED (O14); it and M1.1 are built (at risk). The M1 contents list (including "M1 = presets only" and free agents only) and the order of M2–M7 are DELEGATED (D-N). M1's league structure, money model and market are DELEGATED (D-C). How each later milestone is realized is OPEN (open-021, working assumption as written). Content counts are PROPOSED · TUNABLE unless an O-ID fixes them.

The prototype horizon is milestones M1–M7, each playable on its own, with M1 and M1.1 built. The owner's original milestones (a)–(g) are folded in as follows: (a) headless sim → M1, viewer → M2; (b) tactics editor → M3; (c) roster, contracts, finances → M1, with club-to-club transfers in M6; (d) scouting → M4; (e) leagues and promotion/relegation → M1, with more regions and cups in M6; (f) development → M1, academy → M5; (g) save/load → M1, balance and polish → M7.

| Horizon | Player can do | Minimum content | Question / outcome it proves | Explicit exclusions |
| --- | --- | --- | --- | --- |
| **M1 "Season MVP"** (built at risk, tag `m1-season-mvp`; O14; contents D-N) | New career → pick a club → manage the roster (signings, renewals, releases, captain and vice-captain, presets, training emphasis) → 16 simulated matches → the 3-round Reckoning of 8 clubs (O9) → season end (aging, development, retirements, contract expiries, new rookies, promotion/relegation) → next season, with save/load. Read match reports | One league region, Saltmarch, with 3 tiers × 16 clubs (48 clubs) in two 8-club wings and a 23-week calendar (D-C). 42 classes (O8) with 168 abilities and 105 presets (295 rules). 5 races (O11, D-B). 60 traits (O5). Captaincy (O6) and lineup chemistry (D-D). XP, progression, potential, injuries. Wages, season and wage budgets, revenue and prize money (O10). A free-agent market with contracts and trials-day rookies. AI clubs with five personalities. Match reports. Pacing presets (D-L). Save/load. The 04 screens (ui-new to ui-settings) | A full season loop with real weekly decisions. Classes, races and traits produce distinct fighters. Match reports explain results. The world stays healthy over many headless seasons | Arena viewer (M2), rule editing (M3), scouting and fuzzy stats (M4; M1 shows exact values, open-026), academy (M5), other league regions, cups, club-to-club transfers and the patron (M6), difficulty sliders, season modifiers and packaging (M7) |
| **M1.1 "Playtest round 1"** (built at risk, tag `m1.1-playtest-r1` @ 293f49a; O15–O22; the R002 playtest fixes on main @ d440107, O27–O32) | Everything in M1, plus: a roster preview at club select and Trials Day explained; recognizable class names (16 of 42 renamed, 9 starter picks); bench fighters earn ⅓ XP; **in-season level-ups** (pick 1 of 3: +1 stat, an ability rank, a perk, occasionally a trait) with a level-up card that shows the real effect and an auto-pick; **Stamina** and **Freshness**; **match squads of 5 + 2** with up to 2 blind swaps between rounds on a between-round screen; immediate injuries; a mid-match autosave after every round. **R002 fixes (O27–O32):** a fuller box score, Freshness and an effective rating in the Squad table and between rounds, a true reserve swap, R1/R2 reserve markers, and renewals judged on next season's wage room | 13 stats; 126 rankable abilities (252 rank steps); 72 perks; `levels.json`; save state v3 with migration of M1 saves (the owner's R001 career migrated and played in the QA playtest) | Each week has a squad decision, and fighters visibly grow during the season (the owner's playtest round 1). The 10-season soak passes 14/14 | Rule editing (M3), the arena viewer (M2), perk respec, preseason friendlies |
| M2 Arena viewer | Watch own matches live and any played match as a replay, in the PixiJS arena at 1x/2x/4x with pause (T1). Pause to inspect; auto-pause; up to 2 calls per round (P-01); rule badges (P-22) | Placeholder shapes or sprites for all 42 classes; one arena look; effect and hit cues for every ability | Fights are readable at 1x, and the viewed result equals the headless result (vis-003, vis-009) | Editor, scouting, academy |
| M3 Tactics editor | Edit each fighter's ordered IF/THEN rules (R2), starting from presets: starter vocabulary, stance, rule slots 4→8, lint, rule groups, team playbook, local library and export codes (P-07, P-21); edits between rounds; sandbox; tactics challenges | The 03 vocabulary (21 conditions, 18 selectors, 12 predicates, 6 actions); at least 5 tactics challenges (PROPOSED · TUNABLE) | A newcomer makes an effective first edit; tailored rules beat presets (vis-002, vis-010) | Workshop sharing (FUTURE, unscheduled) |
| M4 Scouting and fuzzy stats | Hire scouts (skills, region of expertise, wage); send them on time-limited assignments; reports narrow ranges. Baseline report for every fighter (O4). Opponent reveal (P-13). The fuzzy-stat display (04 ui-knowledge placeholder) | Scout pool; the three regions as talent pools that already exist in M1 (open-027) | Scouting changes signing decisions (vis-004) | — |
| M5 Academy | Enroll fighters at season start into typed programs within capacity (O2, O3); pay fees; follow progress; call up mid-season (irreversible); enroll mid-season signings; graduate at season end with the R5 outcomes: stats, potential, new abilities and traits (03 §3.5; 04 ui-academy placeholder) | At least 4 program types (PROPOSED · TUNABLE, open-018) | The academy is a real, legible bet (vis-005) | — |
| M6 More regions, cups, transfers | Leagues in 2–3 regions (P-08); regional and cross-region cups; club-to-club transfers with windows and deadline day (P-09); the patron with goals and job security (open-007) | Working value 3 league regions | The world feels broad without promotion shock or AI decay (vis-008) | Loans (open-009) |
| M7 Balance, polish, packaging | Balance pass from headless soak tests (V1). Difficulty sliders and hardcore (P-14, P-11). Season modifiers (P-16). A self-hosted serif pair (Q27). Desktop build for Steam (T6) | Balance reports; difficulty presets | Long saves stay healthy and the game launches as a desktop app | — |
| First release | M1–M7 complete, plus a Steam store build and a free demo (P-15) | Content budget open-018 (classes fixed at 42 by O8) | All vis criteria judged in playtests; the M7 soak gate passes (30 seasons × 10 seeds, 03 §8) | Multiplayer, Workshop, direct fighter control, localization beyond English |
| Longer-term vision (FUTURE) | Async ghost clubs (P-15); Workshop playbooks; more themes and a theme lexicon (open-023); localization; loans; facilities; morale, strain and pair bonds (open-029); arena hazards; side events such as draft cups; scenario challenges | Rough breadth only | Longevity and community | Not a commitment. Each needs an owner decision to enter a milestone |

**First playable finish line (M1):** from a clean launch, a player can start a new career, pick a club, prepare and play all 16 matches through match reports, play the Reckoning or miss it, see the full season-end processing, start the next season, save, quit, reload into exactly the saved state, and continue, all without developer intervention.

**Explicit non-goals:** direct control of a fighter during a fight; live PvP; free-to-play or any paid power; press conferences or conversational busywork (P-17); a node-graph rule editor; 3D presentation; loot boxes or gacha; real-world league or brand licenses; an authored story campaign.

## 6. Experience success criteria

**Status:** the claims are PROPOSED evaluation criteria and the thresholds PROPOSED · TUNABLE (open-001). Only automated and agent-run evidence exists so far: the vis-008 smoke (10-season soak, 14/14 on M1.1 as built), the headless part of vis-009 (03 §8.4), and the M1.1 QA playtest, a browser tester agent walking the build (§8.5, progress record), which measured a routine week at 2–4 inputs and a routine between-round step at one (Enter). No playtest with human players has been run, and no criterion may be reported as passed without recorded evidence. 03 §8 holds the mechanical soak and harness bands.

| ID | Claim to test | How it will be evaluated | Success threshold / decision | First milestone |
| --- | --- | --- | --- | --- |
| vis-001 | Results are attributable to player choices | After a lost match, the playtester explains the loss using the match report | At least 4 of 5 name a concrete cause (fighter, preset, rule, matchup, injury), not luck | M1 |
| vis-002 | Tactics beat small stat gaps | Headless batch: tailored presets or rules against a default-preset lineup of equal rating, 1,000 seeded matches | The tailored side wins ≥ 60%. No preset style or rule list wins ≥ 55–60% against the whole reference opponent set (03 §8.2) | M1 (presets), M3 (rules) |
| vis-003 | Fights are readable | Observers watch 5 fights at 1x | Each can name both sides' tank and healer and the cause of each down in ≥ 90% of prompts | M2 |
| vis-004 | Scouting changes decisions | First-season playtest; headless market study | Playtesters change at least one signing because of a report; scouted signings outperform unscouted ones of equal fee | M4 |
| vis-005 | The academy is a real bet | Playtesters explain cost, expected gain and risk before enrolling | At least 4 of 5 state all three; no program type has negative expected value in soak tests | M5 |
| vis-006 | A matchweek is a decision, not a wait (O13) | Timed playtest of routine matchweeks | Median 1–4 minutes per non-match management phase; routine week (check digest, confirm lineup, play) in ≤ 6 clicks | M1 |
| vis-007 | The season loop invites another season | Observe the season-end choice | At least 4 of 5 start season 2 unprompted; a season at default pacing takes 2–4 hours | M1 |
| vis-008 | Long saves stay healthy | Headless soak per the 03 §8 ladder: 1 seed × 10 seasons at M1 (smoke), 10 seeds × 30 seasons at M7 (full) (03 §8.3–8.4) | Tier starter quality within ±5 of season 1; ≥ 90% of clubs solvent each season; prospects of high potential reach within 10 rating points of potential in ≥ 50% of cases; no crash or save failure | M1 (smoke), M7 (full) |
| vis-009 | One rulebook holds | Determinism checks: same seed and inputs headless, viewed and after save/reload | Bit-identical results and event logs; a loaded save cannot reroll a committed result | M1 (headless, save), M2 (viewer) |
| vis-010 | Tactics are approachable | New players in their first career | They play the first match with presets only, and make a first preset change (M1) or first rule edit (M3) within 3 matches | M1, M3 |

## 7. Shared vocabulary

**Status:** the terms are REQUIRED vocabulary for documents, interface text and data keys. The definitions inherit the labels of the rules they summarize. Use exactly one term per concept. Do not use "team" as a defined term (say club, lineup or side). Do not use "bout" (say fight), "gambit" (say rule or rule list), or "kill" or "death" (say down or downed) in rules or interface text. "Guild" appears only in fiction and proper names. "Focus" means only the in-fight resource.

**Competition and calendar**

| Term | Exact meaning in this game | Owning document |
| --- | --- | --- |
| Fight | The real-time 5v5 combat that decides one round (R1, O1). It ends when one side has no fighter standing, or at the time cap by the tiebreak chain | 03 sys-fight-sim |
| Round | One fight within a match. Every fighter starts each round at full HP and focus | 03 sys-match |
| Match | What is played on a fixture: best-of-3 rounds, best-of-5 in the Reckoning final (P-02, D-C) | 03 sys-match |
| Fixture | A scheduled match between two clubs at a given week, with a home club (west end) and an away club. Its id is the seed identity | 03 sys-league |
| Week | One calendar step: P1–P4, MW1–MW16 or TW1–TW3. Each Continue processes exactly one week | 03 sys-calendar |
| Preseason week | P1 (**Trials Day**), P2, P3, P4 (**Kick-off week**, ending in the Kick off commit) | 02 §3 |
| Matchweek | MW1–MW16, one fixture per club every week (no byes in M1). A **bye** is a week with no own fixture (future cup weeks; non-qualifiers in Reckoning weeks) | 03 sys-calendar |
| Regular season | A tier's 16 matches per club: a double round-robin in the club's wing plus 2 cross-wing matches (O9, D-C) | 03 sys-league |
| Wing | One of the two 8-club halves of a tier, **Dawn** and **Dusk**, redrawn every season. The top 4 of each wing qualify for the Reckoning and the 8th is relegated (D-C) | 03 sys-league |
| Reckoning | The season-ending 3-round knockout of 8 clubs per tier (O9): quarterfinal and semifinal best-of-3, hosted by the higher seed, and a best-of-5 final at the neutral Charterhall (D-C). Weeks TW1–TW3. Not a cup | 03 sys-tournament |
| Shield | The award for the best regular-season record in a tier (tier-table first place). Its winner is promoted with the Reckoning champion (D-C) | 03 sys-league |
| Season | One in-game year (O3): 23 played weeks and the season-end step | 02 §3 |
| Season end | The processing step after TW3: prizes, promotion and relegation, prestige, aging and development, retirements, expiries, recovery, pool maintenance, next-season setup, and the AI phase. Not a week | 03 sys-calendar |
| Region | A geographic area with a talent pool; one that hosts leagues has its own tiers. Saltmarch hosts leagues in M1–M5; Emberreach and Thornwald are talent pools until M6 | 03 sys-league |
| Tier / Circuit | A level of a region's pyramid: tier 1 Crown Circuit, tier 2 Banner Circuit, tier 3 Muster Circuit | 03 sys-league |
| League | The competition of all 16 clubs in one tier for a season | 03 sys-league |
| Standings (wing table, tier table) | Tables ordered by points (3/2/1/0 for 2–0/2–1/1–2/0–2) and tiebreaks. The wing table decides qualification and relegation; the tier table decides seeding, the Shield and the table prize | 03 sys-league |
| Promotion / relegation | Moving a club up or down one tier at season end: the Reckoning champion and Shield winner go up, and each wing's 8th goes down (D-C) | 03 sys-league |
| Cup | A knockout competition alongside the season (regional and cross-region; P-08). From M6 | 03 §3.5 |
| Charterhall | The neutral venue of every Reckoning final | 03 sys-tournament |

**Clubs and money**

| Term | Exact meaning in this game | Owning document |
| --- | --- | --- |
| Club | An organization that holds a league place, a roster, finances, a personality (AI) and from M5 an academy. In fiction, a chartered mercenary guild | 03 sys-roster |
| Manager / AI manager | The player's role, running one club / the AI running any other club under the same rules (P-04) | 02; 03 sys-ai-manager |
| AI personality | One of five scoutable AI club styles (Steady hands, Ledger-keepers, Glory-hunters, Seedbed, Old hands) with its tactics style | 03 sys-ai-manager |
| Prestige | A club's 0–100 standing; it feeds sponsors, gate, asks and free-agent tie-breaks | 03 sys-league |
| Patron | A club's backer with goals and patience. From M6; there is no patron goal in M1 (D-C) | 03 §3.5 |
| Gold / tessel | The single integer currency. "Gold" in rules and data; displayed as **tessels (ts)** in the default theme (D-C) | 03 sys-finance |
| Season budget (SB) | The season's planned income, fixed at setup: grant, parachute, promotion grant, sponsor retainer and projected gate (O10, D-C) | 03 sys-finance |
| Wage budget (WB) | The weekly wage allowance derived from SB, plus part of savings. New commitments must fit it (the commitment rule) | 03 sys-finance |
| Wage | Gold paid to a fighter every week under a contract (O10) | 03 sys-contracts |
| Revenue / prize money | Gate at home fixtures, sponsor money and grants / table prizes and Reckoning prizes (O10) | 03 sys-finance |
| Watch / embargo / Registry advance | The failure ladder: an advisory warning; spending limited to the tier minimum while the balance is below 0; the Registry clearing a debt after 8 weeks and deducting it from later grants. Clubs never fold (D-C) | 03 sys-finance |
| Drop clause / parachute / cap relief | Soft landings after relegation: wages −20%; part of the lost grant for two seasons; payout-free releases down to the new cap (D-C) | 03 sys-contracts, sys-finance, sys-roster |
| Contract | An agreement binding a fighter to a club: weekly wage, length in seasons (ending at a season end), signing cost | 03 sys-contracts |
| Market wage / ask | A fighter's club-independent price / his demand from one club for one length, after tier gap, prestige, length, greed, traits and situation | 03 sys-contracts |
| Calibre | The tier a fighter's rating suits (rating ≥ 62 tier 1, ≥ 47 tier 2, else tier 3). It sets the tier-gap premium | 03 sys-contracts |
| Signing cost / release payout | A one-time payment of 10% of the guaranteed wages at signing / 50% of the remaining wages on release (D-C) | 03 sys-contracts |
| Free agent | A fighter without a club, signable in any week. Offers are answered at week processing (P-09, D-C) | 03 sys-transfers |
| Rival offers | The count, not the amounts, of AI offers pending on a free agent, visible to the player all week | 03 sys-transfers |
| Trials Day | P1: each club's exclusive look at its share of the season's rookies, who sign at once with no signing cost and ask at most 1.25 × the tier minimum (P-18). In season 1 the class is exactly one rookie per club (D-P) | 03 sys-transfers |
| Journeyman | A generated veteran free agent that tops the pool up to its floors | 03 sys-fighters |
| Hired blade | A generated temporary fighter the Registry assigns when a club cannot field 5 fit fighters; paid the tier minimum for one match, outside the cap (open-006) | 03 sys-roster |
| Transfer / window / deadline day | A club-to-club move for a fee, allowed in windows ending in a deadline-day event (P-09). From M6 | 03 §3.5 |

**Fighters**

| Term | Exact meaning in this game | Owning document |
| --- | --- | --- |
| Fighter | A person who can fight: race, class, stats, potential, pace, traits, age, contract status | 03 sys-fighters |
| Race | Human, Elf, Dwarf, Orc or Ashkin: a lifespan that scales aging, plus injury proneness, durability, stat tendencies and class affinity (O11) | 03 sys-races |
| Human-age | Age × 80 ÷ lifespan. Every age rule reads it, so an elf of 42 is at a human's 28 | 03 sys-races |
| Class | A data-defined kit (basic attack, two actives, one passive) with a stat profile and rating weights. 42 classes: 30 base (6 per role) and 12 hybrids (2 per role-family pair) (O8) | 03 sys-abilities |
| Role | One of five: Tank, Melee DPS, Ranged DPS, Controller, Healer (O8; data ids tank, melee, ranged, controller, healer). A hybrid carries two; its DPS side is melee or ranged per class (open-024, D-G). Rules refer to roles, never names | 03 sys-abilities, sys-targeting |
| Ability | An action in a class kit, with a cooldown and a focus cost (actives) | 03 sys-abilities |
| Focus | The per-round resource abilities spend: 100, full at round start, 2.5 per second | 03 sys-combat-stats |
| Stat | One of 12 integer attributes (13 from M1.1) on the absolute 1–20 scale. **Physical** (str, agi, pac, tgh, pre; from M1.1 stamina) decline after the race-scaled peak; **mental** (arc, spi, wil, cmp, ldr, awr, dis) not before human-age 60 (O11, D-B) | 03 §1, sys-combat-stats |
| Rating | A fighter's current ability for his class, 1–100: `combatRating`, round(5 × the class-weighted sum of his integer stats). One integer function serves every screen, the market, the AI and combat (D-Q) | 03 sys-combat-stats |
| Potential | The highest rating a fighter can reach (1–100), shown as stars; fixed except for scars (and from M5 the academy) | 03 sys-fighters |
| Development pace | A fighter's hidden growth speed (Slow to Rapid) | 03 sys-fighters |
| XP / usage | Experience earned for rounds started, and from M1.1 **bench XP** (⅓ of a lineup slot's match XP, O17, O25, D-W) for a fit roster fighter who starts none / season round XP ÷ 360, capped at 1, used by the retirement modifiers. In M1 usage drove growth (D-A); from M1.1 XP fills the level bar | 03 sys-development |
| Level / level-up / offer | A fighter's stored level, raised when his XP bar fills (checked at match end) / the event that raises it / its **offer** of 3 options, pick 1: +1 to a stat, an ability rank, a perk, plus occasionally an optional trait offer (O18, O25, D-X, D-Y; the owner's wording on levels is O23, which Q52 clarified as this stored counter) | 03 sys-development |
| Rank (ability rank) | The level 1–3 of an active or passive ability; each rank adds a small, published change (more damage, a shorter cooldown and so on; never a longer control effect, hard or soft). Basic attacks do not rank | 03 sys-ability-ranks |
| Perk | A permanent passive bonus learned at a level-up; at most 4 per fighter, at most 1 of tier III | 03 sys-perks |
| Stamina | The 13th stat (physical, 1–20, M1.1): how slowly a fighter tires and how fast he recovers. No effect during combat (O19) | 03 sys-fighters, sys-freshness |
| Freshness | A fighter's 0–100 meter of how rested he is (O19): it drains for every round played and recovers in weeks he does not play; below 60 he is Tired (Fresh ≥ 80, Ready 60–79, Tired 40–59, Spent < 40, so a value of 40 reads Tired) and plays the next round with a penalty; a round that starts below 60 drains half as much (O25, D-AB). It acts between rounds, never during a round | 03 sys-freshness, sys-fight-freshness |
| Effective rating | A fighter's rating priced at his Freshness now: the rating less what the Freshness penalty costs, shown as "45 → 41" wherever a rating sits next to a Freshness meter. It is a display approximation (PERMITTED-CHOICE): the fight applies the penalty to attack speed, move speed, Power, Support and reaction delay, never to the rating (O28, O30) | 03 sys-fight-freshness |
| Training emphasis | A standing per-fighter setting, Balanced, Body or Mind. In M1 it moved earned growth between physical and mental stats without changing its total (D-A); from M1.1 it weights which stats level-up offers show | 03 sys-development |
| Trend | M1 only: the live projection of a fighter's rating change by season end (Surging to Fading). M1.1 replaces it with the level, the XP bar and "next level in ≈ N matches" | 03 sys-development |
| Wear | Accumulated physical (and late mental) decline. It never heals | 03 sys-development |
| Rookie | A newly generated young fighter, offered on Trials Day (P-18, D-H) | 03 sys-youth-intake |
| Final season / retirement | A fighter announcing at P1 that he will retire / a fighter permanently leaving play at season end, with a chance driven by his rating drop from peak and his age past the physical peak, certain at human-age 58 (P-10, D-T) | 03 sys-development |
| Injury: knock, minor, moderate, serious | The injury ladder (P-11): a knock misses the next match; serious injuries last 8–14 weeks | 03 sys-injury |
| Scar | A permanent acquired trait from a moderate or serious injury that lowers potential | 03 sys-injury |
| At risk / Still tender | Visible statuses: only an At-risk fighter (2+ scars or human-age ≥ 34) can suffer a career-ending injury / injury chance ×1.25 for 2 matches after a moderate or serious injury | 03 sys-injury |
| Downed | A fighter at 0 HP: out for the rest of the round, not dead | 03 sys-fight-sim |
| Trait | A randomized characteristic, about 80% positive (O5). Kinds: **boon**, **edge**, **burden**, **flaw**. **Storied** traits are earned or suffered, never rolled | 03 sys-traits |
| Captain / vice-captain / acting captain / interim captain | The fighter who leads a lineup (O6) / his deputy / whoever currently leads in the fight after a handover / the club captain named automatically at a lineup lock when none is set: the vice-captain if fit, else the best-CQ fit starter (D-S) | 03 sys-captaincy, sys-fight-captain |
| Captaincy (CQ) and grade | How good a captain a fighter is, 1–100 from stats, traits and experience, graded A Inspiring to E Divisive (O6) | 03 sys-captaincy |
| Snubbed / Passed Over / Losing the Room / Captain Departed | The visible, temporary costs of changing or neglecting the captaincy | 03 sys-captaincy |
| Chemistry | One lineup number from traits, the captain's grade and captaincy statuses, worth up to ±2 composure each (D-D) | 03 sys-chemistry |

**Tactics and reports**

| Term | Exact meaning in this game | Owning document |
| --- | --- | --- |
| Roster / reserve | A club's senior fighters under contract, capped by tier at 14/12/10 (O2) / in M1 a roster fighter not in the lineup; **from M1.1 one of the up to 2 squad members named for a match besides the 5 starters**, who may enter between rounds (O20). In the interface the two squad reserves read **Match reserve** and a roster fighter outside the squad reads **Bench** (a bench fighter earns ⅓ XP and rests, O17). The # column of the roster table marks the two match reserves R1 and R2 (O31). Naming the squad is a true swap: a match reserve who takes a starter's place hands over his reserve place, and the starter does not go to the bench (O29) | 03 sys-roster, sys-match |
| Match squad | The 5 starters and up to 2 reserves a club names for a match at the lineup lock (M1.1, O20) | 03 sys-match |
| Swap | Replacing an active fighter with an unused reserve between rounds; at most 2 per match, and a swapped-out (**withdrawn**) fighter cannot return (O20) | 03 sys-match |
| Emergency entrant | The best-suited fit roster fighter outside the squad, who replaces an injured fighter without using a swap when no reserve is left, so a match is never 4 v 5 (O25, D-U) | 03 sys-match |
| Lineup / side / last lineup | The 5 fighters a club fields in a match with their captain, vice-captain, rows and presets, locked for the whole match / one of the two lineups in a fight / the lineup a club last locked, which is what its next opponent sees in M1 (D-R) | 03 sys-roster |
| Starting row | Front or back, where a fighter starts each round (P-03) | 03 sys-arena |
| Gap / range band | Centre distance minus both radii / melee ≤ 1.5 m, close ≤ 4 m, mid ≤ 7 m, long ≤ 10 m | 03 §1 |
| Rule | `IF <condition> [AND <condition>] THEN <action> ON <selector> [ONLY <predicate> or PREFER <predicate>] [COOLDOWN n s]`, read as one sentence (R2) | 03 sys-tactics |
| Rule list / stance | A fighter's ordered rules, checked top-down, first valid wins / the unremovable fallback at its end: Aggressive, Steady or Cautious | 03 sys-tactics |
| Preset | A named rule list for a class with a style (balanced, aggressive, protective). M1: the player picks one per fighter (D-N); from M3 an editable starting point | 03 sys-tactics |
| Tactics | A lineup's rule lists, stances, rows and (from M3) playbook | 03 sys-tactics |
| Playbook / call | Team-level settings (from M3) / a limited in-fight intervention, at most 2 per round per side (from M2; P-07, P-01) | 03 §3.5 |
| Overtime / time cap | The ramp from 45 s that raises damage and cuts healing / the 75 s limit that ends a round by the tiebreak chain (D-G) | 03 sys-fight-sim |
| Round seed | The seed of a round, derived from the career seed and the fixture and round identity, never shown in advance (P-05) | 03 §1 |
| Match report / recap | The written account of a match: rounds, key events, per-fighter recaps with rule-fire counts, causes of downs, injuries and XP (O12, P-22) | 03 sys-match-report |
| Box score | The per-fighter counters of a match report: downs, damage done and damage received, healing done and healing received, shielding, control seconds, rules fired, Freshness and XP, with a team total per side (O27). Damage is HP damage and healing is effective healing, overheal excluded | 03 sys-match-report; 04 ui-report |
| Replay / sandbox | A stored match shown in the viewer from its seeds (M2) / a practice scrimmage that never affects saved results (M3) | 03 §3.5 |
| Scout / assignment / scout report / baseline report / knowledge | The M4 vocabulary of R3 and O4 (ranges, reveal steps, certainty, sources) | 03 §3.5 |
| Academy / program / enrollment / call-up / graduation | The M5 vocabulary of R5, O2 and O3 | 03 §3.5 |
| Hardcore / season modifier | The M7 permadeath mode (P-11) / one announced, opt-out league-wide rule change per season (P-16) | 03 §3.5 |
| Theme | The data pack of names, presentation and text (T5) | 03 sys-theme |
| Pacing preset | Thorough, Balanced (default), Streamlined or Custom: where Continue stops at the lineup and the report. It never changes a result (D-L) | 04 ui-settings |
| Autosave (weekly / mid-match) | Weekly: the rotating slots auto-1 to auto-3, written after each finished week, each season end and a new career; Settings › Weekly autosaves switches only these off. Mid-match: the dedicated `auto-round` slot, overwritten after every round of the player's match and always on, so a quit never replays a result (O25, D-AD) | 04 ui-save, ui-settings; 05 §5 |
| Squad (screen) | The screen that holds the lineup board and the roster table. It is a screen name, not a separate concept from roster and lineup | 04 ui-squad |
| Wage room | Wage budget − wage bill − pending wages: what a new offer may add per week. For a renewal the room is **next season's** (O32): the projected wage budget less the contracts that continue, the agreed renewals and the pending offers that run into next season, with contracts that end unrenewed not counted | 03 sys-finance, sys-contracts; 04 ui-market |
| Role glyph | The shape that marks each role (shield, diamond, triangle, hourglass, circle-cross), always paired with the role color (D-J) | 04 §3 |

## 8. Decisions, open register, and progress

### 8.1 Approved owner decisions

| ID | Outcome | Scope | Origin | Affected sections |
| --- | --- | --- | --- | --- |
| O1 | Team size is **5 fighters per side** in every tier and competition | All tiers, the Reckoning, cups, every milestone | Owner answer 2026-10-25 | 01 §1, §7; 02 §1–3; 03 §1, sys-fight-sim, sys-arena, sys-match, sys-roster, sys-tournament; 04 arena framing; 05 performance |
| O2 | The **active roster cap is 10 at the lowest tier**, and each tier higher allows 2 more reserves, so the caps are tier 3 = 10, tier 2 = 12, tier 1 = 14. **Academy capacity equals the roster cap of the club's tier** and is a **separate pool**. *Interpretation for owner confirmation (open-002):* the cap is that of the tier the club plays in this season, from next-season setup; it is hard at all times; a club over the cap after relegation must get down to it before the Kick off commit; academy fighters and hired blades do not count | Roster from M1; academy from M5 | Owner answer 2026-10-25 | 01 §7; 02 §3, §5, §9; 03 sys-roster, sys-league; 04 roster screen |
| O3 | **Academy enrollment is chosen at the start of the season**, and a season is one in-game year. During the season an academy fighter can be called up to the senior roster but cannot be sent back down that season. A called-up fighter not used in matches gains no XP: academy development is lost and there is no playing-time growth. Exception: a fighter signed or traded for mid-season can be sent to the academy at that point. Types, cost and the other trade-offs of R5 still apply within these rules. Any other risk is a proposal and stays OPEN (open-004). Details: open-003 | M5; the season definition applies from M1 | Owner answer 2026-10-25 | 01 §7; 02 §2–6, §9; 03 sys-calendar, sys-development, §3.5; 04 academy screen; 05 state |
| O4 | **Free baseline scouting report approved.** Every fighter has a free, low-accuracy baseline report with wide ranges, and scouting narrows it | M4 onward | Owner answer 2026-10-25 | 02 §7; 03 §3.5; 04 fuzzy-stat display |
| O5 | **Traits:** fighters have randomized traits, about 80% positive and 20% negative, in the style of Crusader Kings. Taxonomy and numbers designed in 03 sys-traits (open-012) | M1 onward | Owner answer 2026-10-25 | 03 sys-traits, sys-fight-traits; 04 trait display |
| O6 | **Captains:** each club has a captain. Stats, traits and skills determine whether a fighter is a good or bad captain. Effects designed in 03 sys-captaincy and sys-fight-captain (open-011) | M1 onward | Owner answer 2026-10-25 | 03 sys-captaincy, sys-fight-captain, sys-chemistry; 04 |
| O7 | Use the owner's Tengo design templates for the design package | Whole package | Owner answer 2026-10-25 | All documents |
| O8 | **Classes:** 6 each of Tank, Melee DPS, Ranged DPS, Controller and Healer (30), plus 2 hybrids for each pair: tank/DPS, tank/controller, tank/healer, DPS/controller, DPS/healer, controller/healer (12). **42 classes**, each with abilities. *Interpretation (open-024, adopted under D-G):* "DPS" in a pair is the DPS family, so each such hybrid is melee or ranged per class | M1 onward | Owner goal 2026-10-25 | 01 §7; 03 sys-abilities, sys-tactics, sys-ai-manager; 04 silhouettes and icons |
| O9 | **Season:** 16 matches per club, ending in a **3-round tournament of 8 clubs** (quarterfinal, semifinal, final). Structure in D-C | M1 onward | Owner goal 2026-10-25 | 01 §5, §7; 02 §1–5, §9; 03 sys-league, sys-tournament, sys-calendar |
| O10 | **Economy:** fighters play for wages, and clubs get budgets. Model in D-C | M1 onward | Owner goal 2026-10-25 | 02 §5–6; 03 sys-finance, sys-contracts, sys-ai-manager |
| O11 | **Aging:** physical ability peaks around 28 for humans, scaled by race lifespan (elves live about 120, so their peak is about 42). Balanced with injury risk: long-lived races are more injury-prone. Orcs and dwarves live shorter lives but are more durable. In the owner's words, **"Mental skills don't decline until ~60."** The owner stated no race scaling for mental decline; D-B's scaling by lifespan is a departure from this wording, pending confirmation (Q2) | M1 onward | Owner goal 2026-10-25 | 01 §4, §7; 02 §5; 03 sys-races, sys-development, sys-injury |
| O12 | **For now, battles are simulated headlessly and shown as match reports, with no arena viewer.** The PixiJS viewer (T1) arrives in M2 | M1 | Owner goal 2026-10-25 | 01 §5; 02 §1–3; 03 sys-match-report; 04 match report; 05 |
| O13 | **Focus on good UI design** | Whole package, every milestone | Owner goal 2026-10-25 | 01 §2–3, §6; 02 §7; 04 (primary); 05 |
| O14 | **Current target:** M1 "Season MVP", a working version in which the owner can progress a full season, with the battles simulated for now. Only these words are the owner's. The M1 contents list (§5), "M1 = presets only" and the order of M2–M7 were relayed by the orchestrator and are recorded as D-N | Whole package | Owner goal 2026-10-25: "a working version where I can progress a full season; simulate the battles for now" | 01 §5, §8; 02 §2; 03 §2; 05 §9 |
| O15 | **Club-select roster preview** (ticket AL-R001-T001: "Would like to preview team when selecting club"): the club-select screen previews each club's roster. Shipped (m1.1/ux-r1) | M1.1 onward | Owner tickets/answers 2026-10-25/26 | 04 ui-new |
| O16 | **Trials Day explained** (T002: "not sure what the trials day text is referring to"): the Market card, Home and the calendar explain Trials Day and how to sign rookies. Shipped (m1.1/ux-r1) | M1.1 onward | Owner tickets/answers 2026-10-25/26 | 04 ui-market, ui-home |
| O17 | **Bench development** (T004: "have bench players get 1/3 development."): a roster fighter who starts no round earns ⅓ of a starter's XP; an injured fighter 0. This **replaces D-A for roster fighters**; O3's academy call-up rule is unchanged | M1.1 onward | Owner tickets/answers 2026-10-25/26 | 02 §5; 03 sys-development |
| O18 | **In-season levels** (T005: "I also want to be leveling up in-season. a middle of the pack age and potential player should be leveling up about every 5 played matches", with "new skills or occasionally traits"): level-ups replace season-end growth (aging and decline stay); each level-up is **pick 1 of 3**, by stat, weighted by class and training emphasis, never a capped stat; skill offers are **ability ranks and perks**; trait offers happen occasionally; the AI uses the same offers with an auto-pick, and the player can set auto-pick per fighter or club-wide; pacing presets decide whether level-ups stop the game | M1.1 onward | Owner tickets/answers 2026-10-25/26 | 02 §2, §5; 03 sys-development, sys-ability-ranks, sys-perks; 04 ui-levelup |
| O19 | **Stamina and Freshness** (T003: "we need more actions each week"): **Stamina** is a new physical stat and **Freshness** the meter's name; a high-Stamina fighter lasts about 4 matches before a negative effect, a low-Stamina one about 2, and age affects both; Freshness acts **between match rounds, never during combat** | M1.1 onward | Owner tickets/answers 2026-10-25/26 | 02 §1–2; 03 sys-freshness, sys-fight-freshness, sys-combat-stats, sys-fighters; 04 Freshness displays |
| O20 | **Match squads:** 5 starters + 2 reserves; at most 2 swaps per match, made between rounds; **a swapped-out fighter cannot come back in** | M1.1 onward | Owner tickets/answers 2026-10-25/26 | 02 §2–3; 03 sys-match, sys-roster; 04 ui-squad, ui-between |
| O21 | **Recognizable class names:** 16 of 42 classes renamed, display names only (ids unchanged), with 9 starter picks. Done (m1.1/class-names) | M1.1 onward | Owner tickets/answers 2026-10-25/26 | 03 sys-abilities; 04 |
| O22 | **No existing 3D asset pipeline:** fighter assets must not use the existing asset-gen pipeline or the Synty packs. Sprite research is in `docs/art/sprite-pipeline-research.md`; its open questions (§12 there) are pending (open-032) | M2 onward | Owner tickets/answers 2026-10-25/26 | 04 §5, §10; 05 |
| O23 | **Fighter levels stay as total stat points; the level is the stat-point-based number as built (Q52, option A).** The owner's words: "fighter levels stay as total stat points." **Clarified by the owner in chat on 2026-10-27 (Q52, option A):** "Keep the level model as built (no code change); reword O23 so it says the level is the stat-point-based number as it works today." So the level is the build's stored counter, not a live count of a fighter's current stat points, and there is no build change. **As built, which is now REQUIRED behaviour (O23 plus Q52):** (a) the initial level at generation and at migration is 1 + round(Σ max(0, train100 − 0.5 × cap100) ÷ 100) over the 13 stats, that is, the stat points above half of each stat's cap; (b) each level-up adds 1 to the level, whether its pick was a stat point or a skill (an ability rank, a perk or a trait); (c) a level never decreases, even when wear or scars lower stats. The constants (`levels.json` `level.initialFloorShareOfCap`, 0.5) are TUNABLE within the bounds and tuning rules the package documents (03 §8), as for O25 | M1.1 onward | Owner answer 2026-10-27 (the words); owner clarification in chat 2026-10-27 (Q52) | 03 sys-development (Levels), sys-fighters, sys-save; 05 §9.3 (migration); open-034 (settled) |
| O24 | **Save size: option A (Q36).** The owner chose to **compact AI-vs-AI match results a few weeks after they are played**. Their detailed reports and per-match fighter logs go; scores, standings and season statistics stay; **the player's own matches are never trimmed during the season**. Option B (keep everything and raise the 3 MB budget to about 14 MB) was not chosen, so the 3 MB budget stood at that time (*superseded on 2026-10-27 by O33: the owner raised the save budget to about 10 MB*). How many weeks "a few" is, is a build choice (PERMITTED-CHOICE): as built on `m1.1/save-trim`, 3 weeks, a TUNABLE (tech) value (03 sys-match-report). The compaction did not bring saves under the 3 MB budget, so 05 §12 KI-2 stayed open (open-035) until O33 settled it (the budget is now about 10 MB, which the saves meet) | M1.1 onward | Owner answer 2026-10-27 | 03 sys-match-report, sys-save; 04 ui-report; 05 §5, §8, §12 KI-2 |
| O25 | **Batch D confirmed as recommended (Q37–Q45 and Q47–Q51).** The owner approved every batch D question as recommended, so **D-U** (swaps and injuries in a match), **D-V** (auto-swap, AI rotation and the playtest defaults), **D-W** (bench XP formula), **D-X** (leveling pace, lifespan scaling, +1 point per stat pick, migration), **D-Y** (skill and trait cadence), **D-Z** (Freshness constants and Stamina's role), **D-AA** (the dynasty check is a warning), **D-AB** (Tired rounds drain half), **D-AC** (Ashkin injury ×0.82), **D-AD** (autosave slot policy) and **D-AE** (between-round pause default) are confirmed as worded in §8.2. The approved behavior and its invariants are REQUIRED, and the D-IDs stay as cross-references; examples of invariants are O11's injury ordering (D-AC), an elf leveling more slowly than a human at the same human-age (D-X), Freshness acting only between rounds (O19) and a swapped-out fighter never returning (O20). The numeric values are TUNABLE within the bounds and tuning rules the package already documents (03 §8; the content-data row of the authority table). The approved recommendations add three things: the Freshness numbers and the half drain when Tired (Q44, Q48; D-Z, D-AB) are to be retuned after more playtesting and the fatigue harness; "Always" (Q51; D-AE) stays the default for the playtest and may switch to "When urgent" later; and the note on Q39, to switch level-up pacing to "balanced" after the playtest if it feels heavy, stands as a possible later change, not a decision | M1.1 onward | Owner answer 2026-10-27 | as listed in §8.2 for each D-ID |
| O26 | **Rank, perk and tiredness rules approved (Q46, as recommended).** The combat designer's proposals cmb11-q1 to q6: basic attacks never rank, and actives and passives rank 1 → 3 by family; no rank lengthens any control effect, hard or soft; 72 perks, at most 4 per fighter with at most 1 top-tier, permanent in M1.1; Stamina has no fight formula and a 2% rating weight; the tiredness penalty at each round start (none at 60 or above, at worst −8% attack speed, −4.8% move speed, −6.4% Power and Support, +20% reaction delay, as tuned in m1.1/tune-combat); the perk names and the small sim extensions they need. The approved behavior and its invariants are REQUIRED (for example that no rank lengthens any control effect and that Freshness acts only between rounds); the numeric values are TUNABLE within the bounds and tuning rules documented in 03 §8.2 and §8.6. The approved recommendation adds that the **perk cap and the tiredness penalty are to be revisited after harness runs** | M1.1 onward | Owner answer 2026-10-27 | 03 sys-ability-ranks, sys-perks, sys-fight-freshness, sys-combat-stats; 05 §12 KI-19 |
| O27 | **Fuller box score** (ticket AL-R002-T001: "The box score should be more fleshed out. damage done, damage received, healing done, healing received"): the match-report box score shows damage done, damage received, healing done and healing received. As built (PERMITTED-CHOICE): a line for every fighter who started a round, a team total row per side, a whole-match or per-round toggle, and the grouping and column widths (04 ui-report). Shipped (R002: core 15f16ce, UI 12ef36a) | M1.1 onward | Owner ticket 2026-10-26 | 03 sys-match-report; 04 ui-report |
| O28 | **Freshness and its effect on the overall in the Squad table** (T002: "put the fighter's freshness in the table.  also show how their overall is effected"): the Squad table shows each fighter's Freshness and how Freshness affects his overall, which the package calls his rating (D-Q). As built (PERMITTED-CHOICE): a Freshness column in every roster view, and the rating shown as "45 → 41", the effective rating, which prices the Freshness penalty at the class's rating weights (03 sys-fight-freshness). Shipped (R002) | M1.1 onward | Owner ticket 2026-10-26 | 03 sys-fight-freshness; 04 ui-squad |
| O29 | **True reserve swap** (T003: "when i switch a reserve for a starter, don't send the starter to the bench"): on the squad screen, switching a match reserve for a starter does not send the starter to the bench; he takes the reserve's place. As built (PERMITTED-CHOICE): a bench fighter who comes in still sends the starter to the bench, and so does a starter who is not fit to be named a reserve. Between rounds O20 is unchanged: a swapped-out fighter cannot return. Shipped (R002) | M1.1 onward | Owner ticket 2026-10-26 | 03 sys-roster; 04 ui-squad |
| O30 | **Starters' ratings and more stats between rounds** (T004: "show me the ratings for my starters here.  give me more stats"): the between-round screen shows each starter's rating and more of the match's stats so far. As built (PERMITTED-CHOICE): the rating with its effective rating, damage done and taken, healing done and received, downs, rounds started and XP; the reserves show rating, effective rating and Freshness. Shipped (R002) | M1.1 onward | Owner ticket 2026-10-27 | 04 ui-between |
| O31 | **R marker for reserves** (T005: "put in 'r' in the # column for reserves"): the # column of the Squad roster table marks the match reserves with R. As built (PERMITTED-CHOICE): R1 and R2, in the order the reserves were named, sorted between the five and the bench. Shipped (R002) | M1.1 onward | Owner ticket 2026-10-27 | 04 ui-squad |
| O32 | **Renewals count on next season's funds** (T006: "when renewing, we should be able to use funds that are expected to be available the following year. so if I am not going to resign Garus or Rhoald, I should be able to afford the 110ts increase for Rhagar"): a renewal is judged against the wage room expected next season, in which a contract that ends unrenewed is not counted. As built (PERMITTED-CHOICE): the projection is the current wage budget, assuming no promotion or relegation, less the contracts that continue, the agreed renewals and the pending offers that run into next season; every club is judged by the same rule (P-04). Shipped (R002) | M1.1 onward | Owner ticket 2026-10-27 | 02 §3; 03 sys-finance, sys-contracts, sys-ai-manager; 04 ui-market |
| O33 | **Save budget: about 10 MB; KI-2 closes.** The owner said in chat on 2026-10-27: "Accept the current sizes: raise the save budget to about 10 MB and close KI-2 after this merge." The merge is done (main @ 00ad3db: in-season compaction of AI-vs-AI results, O24, save schema v4). The budget is now **a save of at most 10 MB at any point of a 10-season career, in-season peak included** (TUNABLE (tech)), replacing the 3 MB budget. Measured on main (`npm run bench -- --seasons 10 --player`): end of season 4.0–5.6 MB (4.46 MB at season 3), in-season peak 4.8–8.9 MB (7.6 MB at season 3, 8.9 MB at season 10), autosave about 20–48 ms, so today's saves fit, with the season-10 peak 1.1 MB under the budget. The M7 gate (30 seasons × 10 seeds) re-measures it. This settles open-035 and closes 05 §12 KI-2; compressing saves on write and trimming the `match.result` news params of compacted matches were not built | M1.1 onward | Owner decision in chat 2026-10-27 | 03 sys-save (Size rule); 05 §5 Size, §8 budget table, §12 KI-2; 01 open-035, O24 and the Q36 note |

### 8.2 Delegated decisions (D-U to D-AE confirmed by the owner, O25; the rest pending)

**Status: DELEGATED for D-A to D-T; D-U to D-AE are CONFIRMED by the owner (2026-10-27, O25) and are REQUIRED as worded, with numeric values TUNABLE within the documented bounds.** The D-IDs stay as cross-references. Origin of D-A to D-G and D-J to D-M: "orchestrator delegation under owner goal 2026-10-25 — pending owner confirmation" (D-J to D-M adopt the UI designer's OC-3 to OC-6 because the build is starting). Origin of D-H and D-I: agreed by the lead designer at the merge at the orchestrator's instruction, under the same delegation and pending owner confirmation. Origin of D-U to D-Z: the same delegation; they recorded the M1.1 designers' remaining choices (combat cmb11-q7 to q12, lifecycle prog-q1 to q13) so the playtest build could proceed, and the owner confirmed them in §8.5 batch D (O25). Origin of D-AA to D-AE: the same delegation; they recorded the tuning and QA choices of the M1.1 build (a warning-level soak check, the drain of Tired rounds, the Ashkin injury value, the autosave slot policy, the pause default), and the owner confirmed them in batch D too (O25). Origin of D-N to D-T: "orchestrator delegation under owner goal 2026-10-25, pending owner confirmation"; they were decided during the M1 build and its fix rounds, most of them in answer to the reviews of §8.6, and M1 is built on them. §8.5 batch A asks the owner to confirm them all. **Under O25** the approved behavior and its invariants in D-U to D-AE are REQUIRED, and their numeric values are TUNABLE within the bounds and tuning rules the package already documents (03 §8); in particular the Freshness numbers and the half drain when Tired (D-Z, D-AB) are to be retuned after more playtesting and the fatigue harness, and the pause default "Always" (D-AE) is the playtest default that may switch to "When urgent" later.

| ID | Outcome | Scope | Supersedes / resolves | Affected sections |
| --- | --- | --- | --- | --- |
| D-A | **Unused fighters:** a roster fighter who plays no rounds gets **0 XP and 0 development**. This **extends** the owner's academy call-up rule (O3: a called-up fighter not used in matches gains no XP) to every unused roster fighter, which O3 does not state; it is the orchestrator's decision, not the literal O3 rule. **Superseded for roster fighters by O17 in M1.1** (bench fighters earn ⅓ of a starter's XP); the O3 academy rule is unchanged, and training emphasis now weights which stats level-up offers show. The lifecycle draft's 20% development while unused is rejected (M1's `usageFloor` key was 0; M1.1 removed it with the other season-end growth keys). A standing **training emphasis** (Balanced, Body, Mind) is in M1, but it only shapes *which* stats the earned growth goes to, not how much: the physical and mental multipliers always sum to 2, with no wear effect | M1 onward | Lifecycle C-5 and C-10; open-005 (training lever) | 02 §1, §5, §7; 03 sys-development, sys-ai-manager, §4, §9.2; `development.json` |
| D-B | **Mental decline scales by race lifespan:** human 60, elf 90, dwarf 54, orc 48, Ashkin 39. The original Ashkin race and the long elf careers are kept. This is a **departure** from O11's wording ("Mental skills don't decline until ~60", with no race scaling stated) | M1 onward | open-025; lifecycle C-1, C-3, C-4 | 01 §4, §7; 03 sys-races, sys-development |
| D-C | **League structure and economy model** (the economy draft): 3 tiers × 16 clubs in two 8-club wings; 16 matches per club, 8 home and 8 away, no byes; points 3/2/1/0; the Reckoning (top 4 per wing; QF and SF best-of-3 hosted by the higher seed; final best-of-5 at the neutral Charterhall); relegation of each wing's 8th; promotion of the Reckoning champion plus the Shield winner; a 23-week calendar. Economy confirmations adopted: (1) structure, (2) promotion and relegation, (3) tournament rounds, (4) **tessel** as the display name, (5) offers answered at week processing, with pending offers reserving cap and wage room and rival-offer counts visible, (6) the hard wage budget and the embargo ladder with Registry deductions capped at 30%, and **2.5 world-generation free agents per club**. **Rejected:** the M1 patron goal (no patron goal in M1, keeping 02's position). *Reading of the instruction:* the orchestrator's numbering ("adopt 1–6 and 8; reject #7 patron goal") did not match the draft's ten-item list, where 7 = soft landings, 8 = patron goal, 9 = contract costs, 10 = free agents. Following the instruction's descriptions, the lead designer adopted soft landings (7) and contract costs (9) as well, and rejected only the patron goal. The owner should confirm this reading | M1 onward | open-014 (the 17-club recommendation), open-005 (calendar), open-007 (M1 ladder), open-023 (currency name only), open-027, open-028; economy confirmations 1–10 | 01 §4, §5, §7; 02 §1–§6, §9; 03 sys-league, sys-calendar, sys-tournament, sys-roster, sys-finance, sys-contracts, sys-transfers, §7, §8.4, §9.3; `economy.json`, `leagues.json`, `development.json` |
| D-D | **Chemistry in M1** is limited to the lineup-chemistry modifiers from traits, captaincy grade and captaincy statuses specified in 03 sys-chemistry (at most ±2 composure). No broader morale system in M1 | M1 | open-029 (M1 part); lifecycle C-9 | 03 sys-chemistry, sys-captaincy; 02 §5 |
| D-E | Sim positions and per-tick movement are stored internally in **integer millimetres** (combat cmb-c1). Content stays in metres and events in centimetres | M1 onward | 03 §1 "distances in centimetres" | 03 §1, sys-movement; 05 (to update) |
| D-F | Race stat tendencies are capped at **±4** per stat and trait stat adds at **±3** (applied in the data: maximum ±1.6 and ±3) | M1 onward | combat cmb-c2 and cmb-q11 | 03 sys-races, sys-traits, §6 |
| D-G | Combat's remaining recommendations are adopted: the 12-stat model (cmb-q1), bounded randomness with accumulators, ±4% variance, reaction jitter and a seeded coin as the last tiebreak (cmb-q2), focus (cmb-q3), overtime ramp and tiebreak chain (cmb-q4), crowd-control rules (cmb-q5), the 42 class names (cmb-q6), two damage types (cmb-q7), the captain model (cmb-q8), the rule-engine details (cmb-q9), the unusual mechanics (cmb-q10). Also combat's working use of open-019 (an open arena) and open-024 (hybrid role tags) | M1 onward | open-019, open-024; cmb-q1–q12 | 03 §3.1, §9.1 |
| D-H | **Rookie counts and free-agent pool:** rookies = round(base × clubs) + the season's retirements and career-ending injuries, clamped to [0.5, 1.6] × clubs, with base 0.6 at the merge, tuned to 0.75 in m1/fix-tuning and to 0.8 in m1.1/tune-life (TUNABLE; 38 + retirements at 48 clubs, 39–67 a season in the 20-season soak); season 1 is D-P; Trials Day gives each club floor(rookies ÷ 48) and the remainder by lot; pool floors 60 in season and 5 per role, topped up with journeymen; free agents unsigned at 3 consecutive season ends leave (2 until m1.1/tune-life); the P1 pool target is 100–300 | M1 | The lifecycle "0.6 per club" and economy "about 24 + exits" drafts | 03 sys-youth-intake, sys-transfers, §8.3–8.4 |
| D-I | **AI captain-change timing:** an AI club sets its club captain in the season-end AI phase for the new season (the highest CQ among its five projected starters) and replaces an incumbent there only if a challenger exceeds him by ≥ 5 CQ. Mid-season it changes only on vacancy or when the captain is injured with ≥ 4 weeks left (an exempt change), so it never triggers Snubbed. The vice-captain is the second-highest CQ among the projected starters | M1 | The lifecycle "only P1–P4 or vacancy" and economy "hysteresis of 5 at any time" drafts | 03 sys-captaincy, sys-ai-manager; `development.json` captaincy.aiPolicy |
| D-J | **Role language (UI OC-3):** five role glyph shapes (Tank heater shield, Melee DPS diamond, Ranged DPS upward triangle, Controller hourglass, Healer circle with a cross), always paired with Okabe-Ito-derived role colors; hybrids show both glyphs; the same language is used in the M2 arena | M1 onward, permanent | UI designer OC-3 | 04 §3, §5, §9 |
| D-K | **Money display (UI OC-4):** gold is shown as tessels everywhere, formatted "11,840 ts", with thousands separators, a true minus sign and "+" on gains | M1 onward | UI designer OC-4; complements D-C (tessel name) | 04 §6.2; `economy.json` currency |
| D-L | **Pacing presets in M1 (UI OC-5):** Thorough, Balanced (default), Streamlined and Custom decide where Continue stops at the lineup and the report. A preset never changes a result: Streamlined plays the match with the same valid lineup and presets the player would lock | M1 (moved from M7) | UI designer OC-5; open-005 (pacing) | 01 §5; 02 §2, §3, §7; 04 §6.1, ui-settings |
| D-M | **Confirmation policy (UI OC-6):** a confirmation dialog only for binding actions (renew, sign a trials rookie, release, Kick off, Advance to season end, Start career, load, overwrite or delete a save; from M5 enroll and call-up), stating the consequences in numbers. Reversible settings apply at once with Undo. A free-agent offer is not binding until week processing, so it needs no extra confirmation and can be withdrawn | M1 onward | UI designer OC-6 | 02 §3; 04 §6.2 |
| D-N | **Milestone order and M1 scope:** after M1 come M2 PixiJS arena viewer, M3 tactics editor, M4 scouting and fuzzy stats, M5 academy, M6 more regions, cups and club-to-club transfers, M7 balance, polish and desktop packaging; the owner's milestones (a)–(g) are folded in (§5). **M1 = presets only:** tactics are per-class default presets selectable per fighter, with no rule editing; the market has free agents only. All required features stay in package scope | Whole package | The v0.2 wording of O14, which attributed this order and scope to the owner (requirements review) | 01 §5, §8.1; 02 §2; 03 §2, sys-tactics, sys-transfers; 05 §9 |
| D-O | **Commit before the report:** in M1, Play match runs the week processing; the player's result is committed with every other result and autosaved before the match report opens, so no result can be rerolled by quitting or reloading | M1 onward | Independent review #1 (commit timing); open-016 working assumption | 02 §2–3, §9; 03 sys-calendar, sys-save, §9.3; 04 §6.1, ui-match, ui-report, ui-save; 05 §3.3, §5 |
| D-P | **Season-1 start:** world creation makes a Trials Day class of exactly one rookie per club and runs the AI's season-start setup (captains, vice-captains, training emphasis, opening offers) for every club before P1, planned as if each club had signed its rookie at his Trials Day ask, which is capped at 1.25 × the tier minimum; AI trials signings follow at the first P1 processing, and choosing a club withdraws the AI offers made for it. Opening wage bills are rescaled into 80–87% of WB. The starting balance is the pre-setup cash, and the first grant installment is one separate setup ledger credit | M1 | Independent review #2 (season-1 start) | 02 §2–3, §9; 03 sys-youth-intake, sys-transfers, sys-contracts, sys-finance, §5.2, §7, §9.2; 05 §3.3 |
| D-Q | **One rating formula:** `combatRating`, round(5 × Σ ratingWeight × stat) on the integer effective stats, clamped to 1–100, for fighter ratings and potentials, market wages, AI values, every screen and the balance harness. The lifecycle draft's centipoint formula is retired | M1 onward | Independent review #4 (two rating formulas) | 01 §7; 03 §2 contract 7, sys-combat-stats, sys-fighters, §9.1; 05 |
| D-R | **What the opponent shows:** in M1 a club sees its next opponent's *last* locked lineup and presets, never the lineup the opponent will lock for the coming match | M1–M3 (fog from M4) | Independent review #7; open-026's "visible a week ahead" | 02 §1–3, §9; 03 sys-ai-manager, §5.2; 04 ui-home, ui-squad; 05 |
| D-S | **Automatic interim captain:** at each lineup lock, a club without a club captain (none named, or he left the roster) gets the vice-captain if fit, else the fit starter with the highest CQ, and a digest item says who and why. There is no "Choose a captain" blocker. AI clubs follow the same rule | M1 onward | The v0.2 "Choose a captain" blocker (02 §3, 04 ui-squad); independent review #8 (flow-011) | 01 §7; 02 §2–3, §9; 03 sys-captaincy, sys-calendar, §4, §5.2, §9.2; 04 ui-squad; 05 §3.3 |
| D-T | **Retirement by effectiveness:** each season p = 1 − (1 − hDrop)(1 − hAge), with hDrop from the drop from the fighter's career-peak rating and hAge from his human-years past the physical peak of 30; 0 below human-age 31; certain at human-age 58. Mentally weighted fighters keep their rating and play on. Measured median retirement human-age (after the polish-round recalibration): physically weighted 38.8, mixed 42.0, mentally weighted 46.1. The AI's veteran penalty scales with the class's physical weighting | M1 onward | The v0.2 age-only hazard (3% at 31 to 85% at 40, forced at 41) | 01 §7; 02 §6; 03 sys-races, sys-development, sys-ai-manager, §8.1, §8.3, §9.2; 05 |
| D-U (O25) | **Swaps and injuries in a match** (combat cmb11-q7 to q11): swaps only between rounds, decided by both clubs simultaneously and blind (as built, the player's between-round view blanks the opponent's suggestions and `match.swap` accepts only the player's club), never before round 1 or after the deciding round; an injured fighter misses the rest of the match and is replaced at once by an unused reserve, which uses a swap, or, with none left, by an **emergency entrant** (the best-fit fit roster fighter outside the squad, else a hired blade) who uses none, so a match is never 4 v 5; a withdrawn or injured acting captain hands over to the vice, else the highest CQ, at CQ − 10; the entering fighter takes the outgoing fighter's slot and row unless the player picks the other row; presets travel with the fighter | M1.1 onward | combat-skills.md v0.2 q7–q11; open-010 | 02 §2–3; 03 sys-match, sys-injury, sys-fight-captain; 04 ui-between |
| D-V (O25) | **Auto-swap, AI rotation and the playtest defaults** (cmb11-q12; prog-q7, q8, q10): auto-swap swaps a fighter **below Freshness 40** for a reserve at least 15 fresher and at most 6 rating below, same role family first, and **keeps the last swap for injuries** until the last possible step; AI thresholds by personality (balanced 40, thrifty 35, Glory-hunters 30, Seedbed 50, Old hands 40); the side that lost the round just played adds +10 (adopted by the architect, 05 §9.3); AI rotation rests at the lock a starter who would start round 2 Tired; M1.1 player defaults: pause between every round (D-AE), level-ups "Ask me" with pacing `detailed` | M1.1 | combat q12; lifecycle q7, q8, q10 | 02 §2, §7; 03 sys-match, sys-ai-manager; 04 ui-settings |
| D-W (O25) | **Bench XP formula** (prog-q1): O17's ⅓ is ⅓ of one lineup slot's match XP, floor(the club's round XP in the match × ⅓ × own XP multipliers ÷ 5), for every fit roster fighter who starts no round, squad reserves included | M1.1 onward | lifecycle q1 | 03 sys-development |
| D-X (O25) | **Leveling pace** (prog-q2, q3, q9, q11, q13): XP per level = (102 + 0.6 × level) × age factor × gap factor × lifespan ÷ 80 ÷ (pace × race growth × trait and mentor multipliers), clamped 60–2,500 (the designers' draft had 115 and physical age factors of 0.72 at 0 and 1.25 at 24; the soak tuning m1.1/tune-life set 102, 0.68 and 1.10); **lifespan scaling**, so at the same human-age an elf levels about 1.5× less often than a human and an Ashkin about 1.5× more often (one clock, D-B); **each stat pick is +1 point**; no season-end growth; level-ups checked only at match end, at most 2 per match; migration carries this season's round XP into the bar (below one level) with no compensation for the lost M1 season-end growth; examples use an elf aged 30 (human-age 20), because elves debut at 28–33 | M1.1 onward | lifecycle q2, q3, q9, q11, q13 | 03 sys-development, sys-save; 05 §9.3 |
| D-Y (O25) | **Skill and trait cadence** (prog-q4): every 3rd level one of the three options is a skill (an ability rank or a perk), every 9th level two are; with 12.5% chance a level also brings an optional trait offer of 2 traits or neither (never a flaw; option 2 is a burden 25% of the time) | M1.1 onward | lifecycle q4 | 03 sys-development |
| D-Z (O25) | **Freshness constants and Stamina's role** (prog-q5, q6, q12): drain per round played = (11.88 − 0.48 × Stamina, clamped 2–12) × round intensity (0.6–1.5), ×1.1 under human-age 21; rest per week without a round = 30 + Stamina, ×0.85 from human-age 31 and ×0.7 from 35; **a squad reserve who never enters gets 80%** of the rest; threshold 60 (Fresh ≥ 80, Ready 60–79, Tired 40–59, Spent < 40); reset to 100 at season end; a round that starts below 60 drains half as much (D-AB); Stamina has no captaincy or direct injury role; Bellows Chest gains +2 Stamina | M1.1 onward | lifecycle q5, q6, q12 | 03 sys-freshness, sys-fighters; 04 Freshness displays |
| D-AA (O25) | **The dynasty check is a warning:** the headless soak's `competitive-balance` check (no club wins its tier more than a TUNABLE share of seasons) is warning-level: it reports `warn` and prints the flag, but does not fail the run, because one title run on one seed flips it (seed-fragile). The other 13 checks stay hard. Dynasty balance remains a known issue for the M7 balance pass (05 §12 KI-1), whose gate runs 10 seeds × 30 seasons | M1.1 onward (harness; no player-visible rule) | The M1 reading of KI-1 (the dynasty flag as a failed check) | 03 §8, §8.4; 05 §10, §12 |
| D-AB (O25) | **Tired rounds drain half:** `levels.json` freshness.tiredDrainShare is **0.5**: a round that starts below the Freshness threshold (60) loses half the usual drain. The onset of Tired is unchanged (a high-Stamina fighter about 4 matches, a low-Stamina one about 2), but an unrotated starter now declines slowly instead of reaching 0 within a few weeks. Paired with AI rotation `extraGapPerPointBelow` 0.45 (from 0.25), which keeps the AI Tired share near 21% | M1.1 | Extends D-Z; soak tuning m1.1/tune-life | 03 sys-freshness, sys-ai-manager, §8.6; 04 Freshness displays |
| D-AC (O25) | **Ashkin injury chance ×0.82** (from ×0.85; recovery ×0.80 and scars ×1.0 unchanged), so that the injury population band holds: the population test (seed `population-3`, `content/default`) measured the Ashkin at 1.063 injuries per 40 rounds at ×0.85, just over the 0.60–1.05 band (`development.json` soakTargets). O11's ordering holds: the long-lived race is the most injury-prone, orcs and dwarves the sturdiest | M1.1 | D-B (the Ashkin race); the O11 invariant | 03 sys-races, sys-injury, §8.3; `races.json` |
| D-AD (O25) | **Autosave slot policy:** a finished week, a season end and a new career rotate over the weekly slots auto-1..3 (the oldest is overwritten); the player's match waiting between rounds has its own slot, `auto-round`, overwritten after **every round**. The mid-match slot **always** runs: it is what makes "no rerolls" (P-05, D-O) hold when the player quits in the middle of a match. The Settings toggle, now "Weekly autosaves", controls only the three weekly slots | M1.1 | D-O; open-016; the M1.1 QA finding that the old toggle was never read | 02 §3; 03 sys-save; 04 ui-save, ui-settings; 05 §5 |
| D-AE (O25) | **Between-round pause default:** the club setting `pauseBetweenRounds` defaults to **always**: every match of the player's club pauses on the between-round screen after each round that does not decide it, and the player presses Continue (one Enter) to play on. `when_urgent` and `never` stay choices in Settings; AI-vs-AI matches never pause. This is the playtest default (listed among the defaults of D-V), chosen so that the owner sees every Freshness and swap decision | M1.1 | D-V (player defaults) | 02 §2–3, §7; 03 sys-match; 04 ui-between, ui-settings; 05 §9.3 |

### 8.3 Proposed defaults, awaiting owner approval

**Status: PROPOSED.** None of these is approved. They are the working design, and each blocks the handoff of the milestone named until the owner approves, amends or rejects it. Source references are to research.md.

| ID | Proposed outcome (working design, as merged into 03) | Source | Superseded parts | Blocks | Affected sections |
| --- | --- | --- | --- | --- | --- |
| P-01 | **Intervention:** free, unlimited pause to inspect; auto-pause on configurable events; edits between rounds (with M3); **up to 2 calls per round per side**, spent by AI managers too; no direct control | C3.1 | Not applicable in M1 (O12) | M2 | 02 §1, §3, §7; 03 §3.5 |
| P-02 | **Match format:** best-of-3 rounds, best-of-5 in finals; fights of about 20–45 s with overtime from 45 s and a cap at 75 s (the ramp and tiebreak chain are D-G); lineup, captain, rows and presets fixed for the match in M1 (open-010) | C3.2 | "14 league fixtures + cups" replaced by O9 and D-C | M1 | 02 §1, §4; 03 §1, sys-match, sys-fight-sim |
| P-03 | **Arena:** top-down 2D continuous space with front and back starting rows per side | C3.3 | Adjacency bonuses not adopted | M1 | 03 §1, sys-arena; 04 §4 |
| P-04 | **AI parity:** parity of outcomes with abstracted processes; AI clubs under the same wages, budgets, injuries, aging, academies, rule format, presets and calls; AI scouting modeled as noise from M4; AI never counter-builds against the player | C3.5, C1.7 | — | M1 | 01 §3; 03 sys-ai-manager, §5.2 |
| P-05 | **Randomness:** seeded, bounded variance; no random targets; seeds derived from the career seed and fixture identity, never shown in advance; results saved once played; no reroll by reload; the sandbox uses its own seed | C3.6, C1.3 | — | M1 | 02 §3, §6; 03 §1; 05 §6 |
| P-06 | **No rule deviation:** fighters never skip or misfire their rules; composure affects execution only, as a seeded, named reaction delay | C3.7 | — | M1 | 01 §3; 03 sys-tactics, sys-combat-stats |
| P-07 | **Editor scope:** ordered lists with rule groups and "jump to"; a thin team playbook; all starter vocabulary from day one; rule slots 4 → 8 with experience and 10–12 through traits; local library and export codes; Workshop later (FUTURE) | C3.8, C1.1 | — | M3 | 02 §7; 03 §3.5 |
| P-08 | **More regions and cups:** 2–3 league regions × 3 tiers (working value 3 in M6); a regional cup in which the underdog plays at home; a cross-region cup; soft landings (now in M1 under D-C); everything in data | C3.9 | M1 structure replaced by D-C. C3.9's "distant leagues on a lighter sim" is **not** adopted (open-015) | M6 | 03 §3.5 |
| P-09 | **Transfers:** free agents signable in any week (M1). From M6, two club-to-club windows each ending in a deadline-day event; one offer and counter weighted by club **trust** (0–100, from 50); auctions only for rare top-tier fighters; AI valuation by need and scarcity with imperfect scouting | C3.11 | M1 offer timing, wage formula and embargo now in D-C | M1 (free agents), M6 | 02 §3, §5; 03 sys-transfers, §3.5 |
| P-10 | **Career:** endless; aging and retirement always on; veterans can become staff (FUTURE); patron directives and a legacy score from M6; scenario challenges FUTURE | C3.12, C1.10 | Age curves replaced by O11 and D-B; age-only retirement replaced by D-T | M1 (endless, aging), M6 | 02 §4–6; 03 sys-development, §3.5 |
| P-11 | **Injuries:** a severity ladder (knock, minor, moderate, serious; then rare permanent scars and a capped career-ending outcome), equal for AI and player, scaled by race (O11); permadeath only in opt-in hardcore (M7) | C3.13 | — | M1 (ladder), M7 (hardcore) | 02 §6; 03 sys-injury |
| P-12 | **Fuzzy-stat display:** range bars, a knowledge meter with reveal steps, potential stars with "unsure" segments and certainty, traits "?" until revealed, the source of every number, residual vagueness, an absolute scale. The scale applies from M1 | C3.14, C1.5 | Baseline settled by O4 | M4 | 02 §7; 03 §1, §3.5; 04 |
| P-13 | **Opponent reveal:** style tag and last lineup always; scouting reveals top rules and stance; no outcome forecast; rehearsal only in the sandbox; real-rule re-runs only after the match | C3.16, C1.4 | M1 shows everything (open-026) | M4 | 02 §7; 03 §3.5 |
| P-14 | **Difficulty:** separate sliders (AI quality, economy, scouting accuracy) plus capped catch-up worth less than winning; never changes fight rules | C3.17 | — | M7 | 02 §6; 03 §3.5 |
| P-15 | **Business:** premium with a free demo, no paid power, offline-first; async ghost clubs after launch (FUTURE) | C3.18 | — | First release | 01 §2, §5 |
| P-16 | **Season modifiers:** one opt-out league-wide modifier per season, plus per-league house rules | C3.19 | — | M7 | 03 §3.5 |
| P-17 | **No press layer;** any morale or chemistry is structural and visible (M1 chemistry per D-D) | C3.19 | — | M1 | 01 §5; 03 sys-chemistry |
| P-18 | **Youth intake:** an annual Trials Day with a preview of rookies; counts per D-H; scout-reported youth from M4 | C3.19 | Counts now D-H | M1 | 02 §3; 03 sys-youth-intake, sys-transfers |
| P-19 | **Knowledge decay and talent reveal:** slow decay refreshed by facing a fighter; talent partly revealed after N matches or a first academy term | C3.19 | — | M4 | 03 §3.5 |
| P-20 | **Action budgets never block playing a match** | C3.19 | — | M1 | 02 §3 |
| P-21 | **Mods:** data-driven league and theme files and tactics export codes; Steam Workshop later (FUTURE) | C3.19 | — | M3 (codes), first release | 03 §3.5; 05 §4 |
| P-22 | **Explanation tooling:** per-fighter recaps (damage, healing, rule fires, rules never fired, death summaries) and the match report in M1; live rule badges and a pause inspector from M2; editor lint from M3 | C1.2 | — | M1 (report), M2, M3 | 01 §3; 03 sys-match-report, sys-tactics |

**Research defaults superseded by owner or delegated decisions** (not to be reintroduced without a new decision): team-size scaling by tier and mixed-size cups (C3.4) and "3–5 fighters" (research §1) → O1. A roster of about 2.5–3× team size with academy fighters counting against it, and academy slots of 2 + 1 (C3.10) → O2. Academy terms of 3–6 months, light duty and mid-term recall (C1.8, C3.15) → O3. The baseline as an owner choice (C1.5, C3.14) → O4. "A handful of readable traits" (C3.19) → O5. 14 league fixtures and 8-club leagues (C3.2, C3.9) → O9 and D-C. Hattrick-style age curves and 10–15-season careers (C3.12) → O11 and D-B. A watched fight at every milestone → O12. Distant leagues on a lighter sim (C3.9) → not adopted (T4, open-015).

### 8.4 Open decisions

**Status: OPEN** unless the "Status" column says the item is settled. The owner for every item is the project owner. A recommendation is the working assumption that the documents use. "Settled (D-x)" means a delegated decision now governs. "In 03 (PROPOSED)" means a merged draft rule is the working design but still needs the owner.

| ID | Decision needed | Status / working design | Affected documents | Blocks milestone? | Owner Q |
| --- | --- | --- | --- | --- | --- |
| open-001 | Approve the player promise, pillars and priority order, tone, and success criteria | Recommendation: approve as drafted in §1–§4 and §6 | 01–04 | M1 handoff approval | Q9 |
| open-002 | Confirm the O2 interpretation | In 03 sys-roster (PROPOSED): current tier's cap from setup; hard; over-cap clubs must comply before Kick off, with payout-free cap relief; academy fighters and hired blades excluded | 02, 03 | M1, M5 | Q15 |
| open-003 | O3 interpretation details | Recommendation: enrollment drafted in preseason and committed at Kick off with fees; on call-up, development accrued so far is kept pro rata; a mid-season signing is enrolled only in the week it joins, with pro-rated fee and gains; re-enrollment allowed later; academy fighters may be released (from M6 sold) but never loaned | 02, 03 | M5 | Q20 |
| open-004 | Academy risks beyond O3 | Recommendation: outcome ranges shown before enrollment; worst case under-delivery plus a small chance of a minor injury (≤ 5% per term); never a hidden stat loss | 02, 03, 04 | M5 | Q20 |
| open-005 | Season calendar shape | **Settled (D-C, D-A):** 23 played weeks (P1–P4, MW1–MW16, TW1–TW3) and a season-end step; free agents every week; the standing training emphasis (D-A); no weekly training intensity; friendlies FUTURE; pacing presets in M1 (D-L) | 02, 03 | — | Q3 |
| open-006 | When a club cannot field 5 fit fighters | In 03 sys-roster (PROPOSED): **hired blades** at the tier band minimum, class filling the missing Tank, Healer or Melee DPS, paid the tier minimum for one match, outside the cap; the digest warns a week ahead | 02, 03 | M1 | Q15 |
| open-007 | Insolvency, dismissal and job offers | **M1 part settled (D-C):** Watch, embargo, Registry advance after 8 weeks, deductions ≤ 30% of a grant, clubs never fold. **M6 part open:** patron patience; at 0 the manager is dismissed and offered 1–3 jobs at clubs in the same or a lower tier (at least one guaranteed), or may end the career | 02, 03 | M6 | Q21 |
| open-008 | How well a club knows its own fighters (from M4) | Recommendation: current stats fully known after 4 weeks at the club; traits after 4 weeks; potential a range narrowing each season, with an academy term and own scouts | 02, 03, 04 | M4 | Q19 |
| open-009 | Loans | Recommendation: none at first release (FUTURE); revisit after M5 playtests | 01, 03 | None | Q21 |
| open-010 | Changes during a match | **M1.1 settled (O20, O25, D-U):** squads of 5 + 2 with at most 2 swaps between rounds and no return; M1 fixed the lineup for the whole match. From M3, tactics edits between rounds (P-01) | 02, 03 | — | Q11; Q37 answered (O25) |
| open-011 | Captain details (O6) | In 03 sys-captaincy (PROPOSED): club captain and optional vice-captain; CQ from leadership, composure, experience, seniority, standing and traits; grades A–E with aura, rally, mentoring and chemistry; Snubbed, Passed Over, Losing the Room and Captain Departed (lifecycle C-11); grade E actively hurts (C-12). AI timing is D-I; the in-fight model is D-G | 02, 03 | M1 | Q12 |
| open-012 | Trait taxonomy, number, reveal and acquisition (O5) | In 03 sys-traits (PROPOSED): 60 traits (48 rolled, 12 storied) in six categories and four kinds; 2–4 per fighter (mean 2.9); at most one negative per starting fighter; "80/20" counted by roll weight, realized 79.9% (lifecycle C-6); visible gain and loss rules | 03, 04 | M1 | Q13 |
| open-013 | Home advantage | In 03 (PROPOSED): the home club takes the gate; no combat modifier; home only sets the west end; the Reckoning final is neutral, with the higher seed as the home side for the sim | 02, 03 | M1 | Q15 |
| open-014 | League structure under O9 | **Settled (D-C):** 3 tiers × 16 clubs in two wings, 16 matches, no byes, the Reckoning, promotion and relegation as in §8.2. The 17-club recommendation is superseded | 02, 03 | — | Q3 |
| open-015 | May distant leagues use a lighter resolver than the full fight sim? | Recommendation: no; every fixture uses the same headless sim (T4, pillar 4). A lighter resolver needs owner approval if M6 performance targets fail | 03, 05 | M6 | Q21 |
| open-016 | Save model (R7) | In 03 sys-save (working assumption): manual slots from any management screen; autosave after every week processing and after season end, written before the match report opens (D-O), and from M1.1 a mid-match slot after every round (O25, D-AD); seeds derived from career seed and fixture identity, so replaying from an earlier save reproduces results; from M2 mid-fight resume; M7 hardcore single ironman slot | 02, 03, 05 | M1 | Q16 |
| open-017 | Desktop wrapper: Tauri or Electron (T6) | Recommendation: document 05 evaluates both (size, Steam integration, web stack) and asks the owner | 05 | M7 | Q22 |
| open-018 | Content budget beyond M1 | M1 set fixed in 03 §6 (42 classes, 168 abilities, 105 presets, 34 statuses, 5 races, 60 traits, 48 clubs). Recommendation for first release: at least 4 academy program types; 3 league regions; 3 cosmetic arena variants; trait and preset additions only with harness evidence | 03, 04 | First release | Q22 |
| open-019 | Arena contents | **Settled (D-G):** an open rectangle with no obstacles, hazards, summons, neutral units or adjacency bonuses; variants FUTURE | 03, 04 | — | Q7 |
| open-020 | From M2, may the player skip watching their own match? | Recommendation: yes; the same headless result, with the player's calls made by the AI call policy | 02, 03 | M2 | Q17 |
| open-021 | How each later milestone is playable on its own | Recommendation: as in §5; each milestone keeps the full M1 season loop working | 01, 05 | M2–M7 | Q17 |
| open-022 | Staff roles beyond scouts | Recommendation: scouts (M4), one tactics coach teaching advanced vocabulary (M3/M4) and one physician modifying injury recovery (M4), about 3 attributes each | 03 | M4 | Q19 |
| open-023 | May a theme rename core nouns (club → guild)? | Partly settled (D-C): the currency displays as tessels. Otherwise recommendation: FUTURE, with the canonical §7 terms in the default interface | 01, 05 | None | Q22 |
| open-024 | O8 hybrid interpretation and role tags | **Settled (D-G):** "DPS" in a pair is the DPS family; each such hybrid is melee or ranged per class; a hybrid carries both role tags, and role selectors match either | 03 | — | Q7 |
| open-025 | Does mental decline scale by race? | **Settled (D-B):** yes (human 60, elf 90, dwarf 54, orc 48, Ashkin 39), a departure from O11's wording that the owner must confirm | 03 | — | Q2 |
| open-026 | Information visibility in M1–M3, before fog in M4 | Recommendation: exact stats, potential, pace and traits for every fighter; the next opponent's last lineup and presets (D-R); from M4, P-12 fog for careers started from M4 on, while careers started earlier never get fog | 02, 03, 04 | M1 | Q10 |
| open-027 | Regions before M6 | **Settled (D-C):** Saltmarch hosts the leagues; Emberreach and Thornwald are talent pools (fighters' origins), giving M4 scouts regions of expertise | 01, 03 | — | Q10 |
| open-028 | Budget model (O10) | **Settled (D-C):** season budget and weekly wage budget with the hard commitment rule, as in 03 sys-finance | 02, 03 | — | Q4 |
| open-029 | Chemistry, strain and morale | **M1 settled (D-D):** lineup chemistry only. Pair bonds, strain and morale (research D3) remain FUTURE, each needing an owner decision | 01, 03 | None | Q6 |
| open-030 | Race details not covered by D-B (lifecycle C-2, C-13) | In 03 sys-races (PROPOSED): dwarves shorter-lived than humans (72, the literal reading of O11); a debut-age floor of 16 for every race | 03 | M1 | Q14 |
| open-031 | Injury details (lifecycle C-7, C-8, C-14) | In 03 sys-injury (PROPOSED): scars permanent in M1; a career-ending injury only for a fighter shown At risk, 8% of his serious injuries, capped at 0.5% per match; a knock always misses the next match | 03 | M1 | Q14 |
| open-032 | Fighter sprite pipeline (M2 art) | Open: the owner excluded the existing 3D pipeline and Synty (O22). `docs/art/sprite-pipeline-research.md` recommends an AI 3D → 2D render pipeline (C) with direct 2D generation (A) as the fallback, decided by a bake-off; its §12 lists 8 owner questions (style, race readability, budget, camera, variety, Steam AI disclosure, location, Blender) | 04, 05 | M2 | art §12 |
| open-033 | AI clubs' own renewal budget against the next-season wage room (O32) | **Open (AI-economy tuning, a designer decision):** the rule that judges a renewal on next season's room applies to every club (P-04), but an AI club's own spending policy still budgets its renewals against the current bill, which is stricter than the rule, so it never asks for a renewal the rule would refuse. Budgeting AI renewals on next-season commitments was tried: AI clubs then kept nearly every expiring fighter at his market ask and the 10-season soak failed wage-inflation (median wage +15% in a season against a 10% band) and age-distribution (share aged 22 or under 11.5% against a 12% band), so the AI policy was left as it was | 03, 05 | None | — |
| open-034 | How the owner's "fighter levels stay as total stat points" (O23) relates to the level counter | **Settled (O23 with Q52, option A, 2026-10-27):** the owner chose to keep the level model as built (no code change), and O23 was reworded to say the level is the stat-point-based number as it works today. *History (v0.7, when it was open):* the build's level differs from the literal wording in three ways: (a) the initial level (at generation and at migration) counts only the stat points above 0.5 × each stat's cap (`levels.json` level.initialFloorShareOfCap), not all the points; (b) every level-up adds 1 to the level, so a skill pick (an ability rank or a perk) or an empty level raises the level with no stat point; (c) a level never decreases, while wear and scars lower stats. 03 sys-development specifies the level as built, now the approved model | 03, 05 | None (M1.1 is built on the counter) | Q52 (answered) |
| open-035 | How to bring saves under the 3 MB budget after the in-season compaction of O24 (05 §12 KI-2) | **Settled (O33, 2026-10-27):** the owner accepted the current sizes and raised the save budget to about 10 MB (a save of at most 10 MB at any point of a 10-season career, in-season peak included); KI-2 is closed, and neither compression nor news trimming was built. *History (v0.7, when it was open):* O24 was built and the save was still above the 3 MB budget: about 4.5 MB at the end of season 3 and about 7.6 MB at the in-season peak (what remains is mostly fighters, results, news and the ledger; even with no results the season-end save would be 3.4 MB). The options were to compress saves on write, together with trimming the `match.result` news params of compacted matches (about 0.3 MB), or to raise the budget; the owner took the last (O33) | 05 | M1 §8 budget | answered in chat 2026-10-27; no Q number |

### 8.5 Owner questions and interview progress

**Questions for the owner.** Q36, Q37–Q51 and Q52 were answered by the owner on 2026-10-27 (each is marked **Answer** below); Q1–Q35 are the only numbered items that still need the owner, and they remain open; the save-size follow-up (open-035) was answered in chat on 2026-10-27 (O33) and never had a Q number. The questions use the guide's format and continuous numbering, and are grouped so that each batch can be approved in one answer ("approve batch A as recommended"). Partial answers settle only what they answer. Batches A to D each end with a one-line "approve all recommended" option; batch E (Q52) had none, because it needed an explicit Option A or B, and the owner chose Option A. **M1 and M1.1 have been built at risk on the recommended answers**; the answers given so far matched them and so cost no rework, and a different answer to a question that is still open means rework in the sections listed for that item.

#### Batch A — confirm the delegated decisions (building proceeds on them meanwhile)

**Q1 — Should a fighter who never plays still develop?**
**Required before handoff · 01 §8.2 D-A; 03 sys-development**

You said that an academy fighter called up and not used gains no XP (O3). D-A extends that rule to every roster fighter: one who plays no rounds gets 0 XP and 0 development, so benching a prospect for a season freezes him. This extension is the orchestrator's, not your words. Training emphasis (Balanced, Body or Mind) only redirects earned growth between physical and mental stats.

**Recommendation:** confirm D-A. Lineup choices become development choices, and rotation pays because splitting rounds develops two prospects better than starting one.

**Q2 — Do long-lived races keep their sharp minds longer?**
**Required before handoff · 01 §8.2 D-B; 03 sys-races**

You said "Mental skills don't decline until ~60" and did not mention races. D-B departs from that wording: it scales the mental-decline age by lifespan (human 60, elf 90, dwarf 54, orc 48, Ashkin 39), so mental decline never touches a playing career. It also keeps the original Ashkin race and the long elf careers.

**Recommendation:** confirm D-B. One rule covers every race, and veterans stay valuable as captains and mentors. If you meant 60 for every race, mental decline would start mid-career for orcs and Ashkin.

**Q3 — Is this the right season shape?**
**Required before handoff · 01 §8.2 D-C; 03 sys-league, sys-calendar, sys-tournament**

Three tiers of 16 clubs, each in two 8-club wings; 16 matches per club with no byes; points 3/2/1/0; the top 4 of each wing play the Reckoning (best-of-3, final best-of-5 at the Charterhall); each wing's 8th goes down, and the Reckoning champion and Shield winner go up; 23 weeks per season. There is no patron goal in M1.

**Recommendation:** confirm. Every week has a fixture, the top-4 race is visible in an 8-row table, and both the season and the Reckoning matter for promotion.

**Q4 — Is this the right money model?**
**Required before handoff · 01 §8.2 D-C; 03 sys-finance, sys-contracts**

Clubs get a season budget and a weekly wage budget, and new commitments must fit it. Debt brings an embargo, then a Registry advance after 8 weeks, repaid from at most 30% of later grants; clubs never fold. Relegation is softened by a −20% drop clause, parachute money and payout-free releases; promotion by a grant and extra wage room. Signing costs 10% of guaranteed wages, releasing 50% of the remaining wages. The currency displays as tessels, formatted "11,840 ts" (D-K, UI OC-4). *Note:* the orchestrator's numbering did not match the economy draft; the lead designer adopted soft landings and contract costs and rejected only the patron goal (§8.2 D-C).

**Recommendation:** confirm, including that reading and D-K.

**Q5 — How should the free-agent market feel?**
**Required before handoff · 01 §8.2 D-C, D-H; 03 sys-transfers, sys-youth-intake**

Offers are answered at week processing, so the AI competes fairly and you see how many rival offers a fighter has. Trials-day rookies and renewals answer at once. A new world starts with 2.5 free agents per club. Each later season brings 0.75 rookies per club plus one per retirement (37–59 a season in the 20-season soak); the first season brings one per club (D-P, Q30).

**Recommendation:** confirm D-C (5) and D-H.

**Q6 — Is lineup chemistry enough social simulation for M1?**
**Required before handoff · 01 §8.2 D-D; 03 sys-chemistry**

M1 has one lineup chemistry number from traits and captaincy, worth up to ±2 composure each, and no morale meter or pair bonds.

**Recommendation:** confirm D-D, and keep morale, strain and pair bonds FUTURE.

**Q7 — Do you accept the combat model as designed?**
**Required before handoff · 01 §8.2 D-E, D-F, D-G; 03 §3.1**

D-G adopts the combat designer's recommendations: 12 stats (5 physical, 7 mental); focus; bounded luck (crits and evades come at a steady rate, ±4% damage variance, no random targets); the 45 s overtime ramp and the tiebreak chain at 75 s; short, diminishing crowd control capped at 2.5 s; physical and arcane damage; the 42 class names; the captain's composure aura and rally; the rule-engine details; an open arena; and hybrids matching both roles. D-E (millimetre positions) and D-F (magnitude caps) are technical and balance safeguards.

**Recommendation:** confirm all three. Class names are data and can be renamed freely later.

**Q8 — When may AI clubs change captain?**
**Required before handoff · 01 §8.2 D-I; 03 sys-captaincy**

AI clubs choose at season end, change only for a clearly better candidate (5 CQ or more), and otherwise change only when the captain leaves or is injured for 4+ weeks. They never pay the Snubbed cost.

**Recommendation:** confirm D-I.

**Q23 — Are these the role symbols for good?**
**Required before handoff · 01 §8.2 D-J; 04 §3**

Each role has a shape (Tank shield, Melee DPS diamond, Ranged DPS triangle, Controller hourglass, Healer circle-cross), always paired with a colour chosen to stay distinct for colour-blind players. Hybrids show both shapes. The arena reuses them from M2.

**Recommendation:** confirm D-J as permanent. The colour-vision checks show the shapes are what keeps roles distinct.

**Q24 — Should M1 already let you choose how often the game stops?**
**Required before handoff · 01 §8.2 D-L; 04 ui-settings**

D-L moves the pacing presets from M7 into M1. Thorough stops for every lineup and report; Balanced (the default) stops at every lineup and opens the report only after a loss or an injury; Streamlined plays on with the current lineup unless something needs you; Custom lets you choose. Results are never affected.

**Recommendation:** confirm D-L. Pacing control prevents season fatigue early.

**Q25 — When should the game ask "are you sure"?**
**Required before handoff · 01 §8.2 D-M; 02 §3; 04 §6.2**

Only binding actions get one dialog, which states the cost in numbers: renewals, trials signings, releases, Kick off, Advance to season end, loading or overwriting a save, and later academy moves. Everything reversible applies at once with Undo. A free-agent offer can be withdrawn until the week is processed, so it needs no extra confirmation.

**Recommendation:** confirm D-M.

**Q28 — Is this the right milestone order, with M1 using presets only?**
**Required before handoff · 01 §8.2 D-N; 01 §5; 05 §9**

You asked for "a working version where I can progress a full season; simulate the battles for now" (O14). The rest was set by the orchestrator: in M1 each fighter runs one of his class's preset rule lists, with no rule editing, and the market has free agents only; then M2 arena viewer, M3 tactics editor, M4 scouting and fuzzy stats, M5 academy, M6 more regions, cups and club-to-club transfers, M7 balance, polish and desktop packaging. M1 is built this way.

**Recommendation:** confirm D-N. Every later milestone keeps the full season loop playable.

**Q29 — Should a result be final the moment you press Play match?**
**Required before handoff · 01 §8.2 D-O; 02 §3; 05 §5**

Play match runs the whole week: every match, yours included, is played, the week is committed, and the game autosaves before your match report opens. Quitting at the report or reloading cannot change the result.

**Recommendation:** confirm D-O. It is what "no reroll by reload" (P-05) needs.

**Q30 — How should the first season start?**
**Required before handoff · 01 §8.2 D-P; 03 sys-youth-intake, sys-finance, §7**

The first Trials Day has exactly one rookie per club, asking at most 1.25 × the tier minimum. AI clubs have already named captains and made their opening offers before you pick a club, and the offers they made for your club are withdrawn. Opening wage bills sit at 80–87% of each wage budget, so every club can still sign someone. Your starting balance is the cash before the first grant installment, which appears as its own ledger entry.

**Recommendation:** confirm D-P.

**Q31 — One rating number everywhere?**
**Required before handoff · 01 §8.2 D-Q; 03 sys-combat-stats**

The drafts had two slightly different rating formulas. D-Q keeps one integer formula, the class-weighted stat sum, so the rating you see is the rating that sets wages, AI choices and the balance checks.

**Recommendation:** confirm D-Q.

**Q32 — Should you see your opponent's next lineup or their last one?**
**Required before handoff · 01 §8.2 D-R; 02 §2; 04 ui-home**

In M1 you see the five fighters your next opponent fielded last time, labelled as their last lineup, never the five they will lock. From M4, scouting can reveal more (P-13).

**Recommendation:** confirm D-R. It keeps AI lineups from being read in advance and matches the opponent-reveal rule.

**Q33 — Should the game name a captain for you when none is set?**
**Required before handoff · 01 §8.2 D-S; 03 sys-captaincy**

If your club has no captain at kickoff (you never named one, or he left), the vice-captain takes the role, else your fit starter with the best captaincy rating, and the digest tells you. Nothing blocks the match. AI clubs follow the same rule.

**Recommendation:** confirm D-S.

**Q34 — Should fighters retire when they get worse rather than at a fixed age?**
**Required before handoff · 01 §8.2 D-T; 03 sys-development**

The drafts retired almost everyone by human-age 36–41 on age alone. D-T bases the chance on how far a fighter has fallen from his best rating and how far he is past his physical peak, with retirement certain at human-age 58. Casters and healers, whose skills are mental, now play into their 40s and 50s; physical fighters retire in their late 30s. Measured median retirement human-age: physically weighted classes 38.8, mixed 42.0, mentally weighted 46.1.

**Recommendation:** confirm D-T, and tune the hazard tables after playtests if careers feel too long.

**Approve batch A in one line:** "Confirm D-A to D-T as recommended (Q1–Q8, Q23–Q25, Q28–Q34)."

#### Batch B — still open for M1 (needed before the M1 handoff is approved)

**Q9 — Do the promise, pillars and tone describe the game you want?**
**Required to start · 01 §1–§4, §6 (open-001)**

These were drafted from your brief and the research: the player promise, five pillars in priority order, the tone (sporting fantasy, downed not dead), and ten success criteria with thresholds.

**Recommendation:** approve as drafted, or name the pillar or criterion to change.

**Q10 — Should M1 show every fighter's true numbers?**
**Required to start · 01 §8.4 open-026; 02 §7; 04**

Scouting and fog arrive in M4, so M1 has no way to narrow a fuzzy range. Showing exact stats, potential, pace, traits and opponents' presets keeps M1 simple but suspends R3 until M4. Emberreach and Thornwald exist from M1 as fighters' home regions (open-027, settled). **Consequence:** a career started before M4 never gets scouting fog, even after updating the game, so its saves keep exact values for good.

**Recommendation:** exact values in M1–M3; the P-12 fog for careers started from M4 on, and none for careers started earlier.

**Q11 — Approve the proposed defaults M1 relies on?**
**Required before handoff · 01 §8.3; 03 as merged**

P-02 (best-of-3, final best-of-5, fights of about 20–45 s, lineup and presets fixed for the whole match in M1, open-010); P-03 (top-down arena with two rows); P-04 (AI parity); P-05 (seeded luck, no reroll by reload); P-06 (fighters never skip their rules); P-09 (free agents any week); P-10 (endless career, aging always on); P-11 (the injury ladder); P-17 (no press layer); P-18 (Trials Day); P-20; P-22 (match reports with recaps and causes).

**Recommendation:** approve all as merged.

**Q12 — Approve the captaincy rules?**
**Required before handoff · 01 §8.4 open-011; 03 sys-captaincy**

You pick a captain and optional vice-captain. Captain quality comes from leadership, composure, experience, seniority, standing and traits, graded A to E. A good captain steadies fighters and mentors the young; a grade-E captain actively hurts. Changing captain mid-season can snub the old one, and passing over a senior fighter costs chemistry. Changes between two matches cost nothing.

**Recommendation:** approve.

**Q13 — Approve the trait design?**
**Required before handoff · 01 §8.4 open-012; 03 sys-traits**

There are 60 original traits (48 rolled, 12 earned or suffered), 2–4 per fighter. 80% are positive by roll weight. No starting fighter carries more than one negative, most negatives are trade-offs, and every rolled pure flaw can be lost in a visible way. Traits never make a fighter disobey a rule.

**Recommendation:** approve.

**Q14 — Approve the remaining race and injury details?**
**Required before handoff · 01 §8.4 open-030, open-031; 03 sys-races, sys-injury**

Dwarves are shorter-lived than humans (the literal reading of O11). No race debuts below 16. Scars are permanent in M1. A career-ending injury is possible only for a fighter shown as At risk (2+ scars or past human-age 34); the lineup screen shows the At-risk status (its numeric per-match odds are not shown yet, 05 §12 KI-8). A knock always misses the next match.

**Recommendation:** approve all. If you meant dwarves to be "shorter-lived than elves", say so and they become long-lived but sturdy, as a deliberate exception.

**Q15 — Approve the roster-edge rules?**
**Required before handoff · 01 §8.4 open-002, open-006, open-013; 03 sys-roster**

The roster cap is the current tier's and is hard; a relegated club over the cap releases fighters without payout before Kick off. A club short of 5 fit fighters gets hired blades for one match. Home matters only for gate money and the west end of the arena; there is no combat bonus.

**Recommendation:** approve.

**Q16 — How should saving work?**
**Required before handoff · 01 §8.4 open-016; 03 sys-save; 05 §5**

Manual slots from any management screen, plus autosaves after every week, written before a match report opens (D-O, Q29). Reloading never rerolls luck, because seeds come from the career seed and the fixture. From M2, a fight resumes at the same moment after a quit. Hardcore (M7) uses a single ironman slot.

**Recommendation:** approve.

**Q26 — Do you approve the look and the interface rules?**
**Required before handoff · 04 §1–§3, §6, §9 (UI OC-1, OC-7 to OC-10)**

The mockups set the look: a dark "war ledger" default (slate, parchment text, a single brass accent) with a full light theme (OC-1). The interface rules are: at most 6 digest items a week, at most 2 marked "needs action", and no pop-ups on Continue (OC-7); a minimum resolution of 1280 × 720, designed for 1440 × 900 and 1920 × 1080 (OC-8); rating bands, with brass for elite values (OC-9); and reports that explain causes but never advise or forecast (OC-10). Two small items: an Ashkin portrait bust before M1 ships, and optional renaming of the club at career start.

**Recommendation:** approve all.

**Q35 — Which machine should the performance budgets assume?**
**Required before handoff · 05 §8 (reference machine, tech)**

The budgets in 05 §8 (2 ms per round, 250 ms per week, 10 s per season, a 3 MB save) need a reference machine. The working reference is a mid-range Windows laptop from 2020 or later (4 cores, 8 GB). M1.1 was measured only on the development machine: about 1.9–2.0 ms per round (two harness runs; the budget is 2 ms), 0.22–0.26 s per week including its autosave and 4.2–5.6 s per season (within budget).

**Recommendation:** adopt the working reference, or name your own PC; then re-measure the round budget on it before any optimisation.

**Note (2026-10-27, v0.7.1):** the save budget in the list above is now about 10 MB, not 3 MB (O33); the reference-machine question itself is unchanged.

**Q36 — May the game trim AI-vs-AI match details during a season to keep saves small?**
**Required before handoff · 05 §5, §12 KI-2 (G1)**

Saves are about 4.5 MB at the end of season 3 (4.0–5.6 MB over ten seasons) and reach about 12 MB during a season, because every full match result is kept until the season ends; the budget is 3 MB. M1.1 already drops the per-round records of last season's matches between other clubs at each season end (about 0.6 MB a season), which was not enough. Option A: compact AI-vs-AI results a few weeks after they are played. Saves stay near budget, but the detailed reports and per-match fighter logs of those matches disappear; scores, standings and season statistics stay. Your own matches are never trimmed during the season. Option B: keep everything and raise the budget to about 14 MB.

**Recommendation:** A. Detailed reports of other clubs' old matches are rarely opened, and small saves keep autosaves fast.

**Answer (owner, 2026-10-27):** option A (O24). AI-vs-AI results are compacted a few weeks after they are played; the player's own matches are never trimmed during the season; the 3 MB budget stands. Built on branch `m1.1/save-trim` with a 3-week window; saves are smaller but still above 3 MB, so KI-2 stays open (open-035). **Follow-up (owner, 2026-10-27, after the merge; O33):** "Accept the current sizes: raise the save budget to about 10 MB and close KI-2 after this merge." The 3 MB budget and the open KI-2 above are as answered at the time; the budget is now about 10 MB and KI-2 is closed.

**Approve batch B in one line:** "Approve Q9–Q16, Q26 and Q35 as recommended." (Q36 is answered: option A, O24.)

#### Batch C — later milestones (can defer)

**Q17 — Intervention in watched fights (M2)**
**Can defer · 01 §8.3 P-01; §8.4 open-020, open-021**

Free pause to inspect, auto-pause, up to 2 calls per round through the captain, the option to skip watching, and each milestone keeping the M1 loop working.

**Recommendation:** approve.
**Deferral:** M1 has no viewer, so nothing in M1 depends on it. Revisit before M2 starts.

**Q18 — Tactics editor scope (M3)**
**Can defer · 01 §8.3 P-07, P-21**

Ordered lists with rule groups, a thin playbook, rule slots 4 → 8, lint, a local library and export codes; Workshop later.

**Recommendation:** approve.
**Deferral:** M1 uses fixed presets. Revisit before M3.

**Q19 — Scouting and fog (M4)**
**Can defer · 01 §8.3 P-12, P-13, P-19; §8.4 open-008, open-022**

The fuzzy-stat display, opponent reveal without forecasts, knowledge decay, knowledge of own fighters, and the staff roles.

**Recommendation:** approve.
**Deferral:** M1–M3 show exact values (Q10). Revisit before M4.

**Q20 — Academy details (M5)**
**Can defer · 01 §8.4 open-003, open-004**

What happens to development accrued before a call-up, mid-season enrollment, re-enrollment, and the academy's risks. Also: R5 says the academy teaches "new abilities/traits", but every class kit is fixed at 4 abilities (a basic attack, two actives and a passive) that presets and balance assume. Option A: a taught ability replaces one of the two actives, chosen when the program ends. Option B: it adds a fifth slot.

**Recommendation:** approve the open-003 and open-004 recommendations, and option A for taught abilities, which keeps every kit, preset and balance check at 4 slots.
**Deferral:** the academy arrives in M5, and O2 and O3 already fix its frame.

**Q21 — Wider world (M6)**
**Can defer · 01 §8.3 P-08, P-09; §8.4 open-007, open-009, open-015**

More league regions and cups, transfer windows, the patron with dismissal and job offers, no loans, and the full sim for every league.

**Recommendation:** approve.
**Deferral:** M1 has one league region and free agents only. Revisit before M6.

**Q22 — Polish and release (M7, first release)**
**Can defer · 01 §8.3 P-14, P-15, P-16; §8.4 open-017, open-018, open-023**

Difficulty sliders, the business model, season modifiers, the desktop wrapper, the first-release content budget, and theme renaming.

**Recommendation:** approve, with the wrapper chosen in document 05.
**Deferral:** none of these affects M1.

**Q27 — Which fonts should the game use?**
**Can defer · 04 §3 (UI OC-2)**

M1 uses fonts already installed on Windows (Palatino Linotype for display, Segoe UI for the interface), so nothing is downloaded. At M7 polish, a self-hosted open-licensed pair (candidate: Alegreya and Alegreya Sans, SIL OFL) can replace them by changing three tokens.

**Recommendation:** system fonts now; decide the self-hosted serif pair at M7.
**Deferral:** M1 works with system fonts; revisit at M7 polish.

**Approve batch C in one line:** "Approve Q17–Q22 and Q27 as recommended; revisit each before its milestone."

#### Batch D — M1.1 confirmations (answered 2026-10-27: every question approved as recommended)

**Q37 — How should swaps between rounds work?**
**Required before the M1.1 handoff · 01 §8.2 D-U; 03 sys-match**

Both clubs choose their swaps at the same time without seeing each other's, only between rounds (never before round 1). The fighter coming on takes the outgoing fighter's place and row unless you pick the other row, and keeps his own preset. If the captain goes off, the vice leads, else the best captain on the field, slightly weakened (CQ − 10).

**Recommendation:** confirm D-U. Clear decision points and no information race.

**Answer (owner, 2026-10-27):** approved as recommended (O25, D-U).

**Q38 — What happens when a fighter is injured mid-match?**
**Required before the M1.1 handoff · 01 §8.2 D-U; 03 sys-match, sys-injury**

The injured fighter plays no more rounds. A reserve replaces him and that uses a swap. If both reserves are already on, an **emergency entrant** comes on without a swap: your best-suited fit fighter who was not in the squad (else a hired blade). A swapped-out fighter never comes back, and a match is never 4 against 5.

**Recommendation:** confirm, including the emergency entrant.

**Answer (owner, 2026-10-27):** approved as recommended, including the emergency entrant (O25, D-U).

**Q39 — Should the auto-swap and the AI work like this?**
**Required before the M1.1 handoff · 01 §8.2 D-V; 03 sys-match, sys-ai-manager**

Auto-swap takes off a fighter **below Freshness 40** for a reserve at least 15 fresher and not much weaker, but **keeps the last swap for injuries** until the last chance. AI clubs use the same rule with a threshold by personality, plus 10 after losing a round, and rest tired starters before the match. For the playtest you see every between-round pause and choose every level-up yourself.

**Recommendation:** confirm D-V (the pause default has its own question, Q51); switch level-up pacing to "balanced" after the playtest if it feels heavy.

**Answer (owner, 2026-10-27):** approved as recommended (O25, D-V). The note, to switch level-up pacing to "balanced" after the playtest if it feels heavy, stands as a possible later change, not a decision. The pause default has its own answer (Q51).

**Q40 — Is this how bench players should earn their ⅓?**
**Required before the M1.1 handoff · 01 §8.2 D-W; 03 sys-development**

Each fit fighter who does not play gets ⅓ of what an average starter earned in that match: a 2–1 win gives about 13 XP, a 2–0 win about 9. Reserves who never come on count as bench.

**Recommendation:** confirm D-W. It is deterministic and visible, with no guess at what he would have earned.

**Answer (owner, 2026-10-27):** approved as recommended (O25, D-W).

**Q41 — Is this the right leveling pace?**
**Required before the M1.1 handoff · 01 §8.2 D-X; 03 sys-development**

In the 10-season soak a mid-age, mid-potential starter (human-age 24–30) levels about every 4.5 matches (about 2.5 a season, from 11–12 starts); a young high-potential prospect (18–20) about 5.5 a season; a veteran of 31–34 about 1.6 and one past 35 about 1. Each stat pick is **+1 point**. Levels come only at the end of a match (at most 2 at once), never between rounds, and there is no extra growth at season end.

**Recommendation:** confirm D-X. Each pick is one stat point, and the skills (ranks, perks, traits) do not count toward the rating; the base XP was lowered from 115 to 102 in the soak tuning.

**Answer (owner, 2026-10-27):** approved as recommended (O25, D-X). The owner's separate words on levels are O23, which Q52 (option A) settled as the level counter as built.

**Note (2026-10-27):** trait stat adds do count toward the rating (they feed `effectiveStatsOf`), so the recommendation's "skills (ranks, perks, traits) do not count toward the rating" is not exact for traits; see O23 and Q52 for the level model.

**Q42 — Should elves level more slowly?**
**Required before the M1.1 handoff · 01 §8.2 D-X (lifespan scaling); 03 sys-development**

Leveling follows the same race clock as aging (O11): at the same stage of life an elf levels about 1.5 times less often than a human and an Ashkin about 1.5 times more often (in the worked example a Knight needs 125 XP a level as a human, 185 as an elf and 85 as an Ashkin). The alternative is the same pace for every race, which would make long elf careers far stronger.

**Recommendation:** keep the lifespan scaling.

**Answer (owner, 2026-10-27):** approved as recommended: the lifespan scaling stays (O25, D-X).

**Q43 — How often should skills and traits be offered?**
**Required before the M1.1 handoff · 01 §8.2 D-Y; 03 sys-development**

Every 3rd level one of the three options is a skill (an ability rank or a perk), every 9th level two are. Occasionally (12.5% of levels) there is also an optional trait offer: two traits or neither, never a flaw.

**Recommendation:** confirm D-Y: about one skill and one trait offer every three seasons for a typical starter.

**Answer (owner, 2026-10-27):** approved as recommended (O25, D-Y).

**Q44 — Are these the right Freshness numbers?**
**Required before the M1.1 handoff · 01 §8.2 D-Z; 03 sys-freshness**

Each round played drains Freshness by about 9 at Stamina 6 and about 4 at Stamina 16 (more in long or brutal rounds, and a little more under 21). A week without playing restores 30 + Stamina, less from 31 and 35. A reserve who sits on the bench all match recovers **80%** of that. Below 60 a fighter is Tired and below 40 Spent (so 40 itself reads Tired); a round that starts Tired drains only half as much (Q48); the meter resets at season end. Stamina does nothing else: no captaincy or direct injury effect.

**Recommendation:** confirm D-Z, and tune after the playtest and the fatigue harness.

**Answer (owner, 2026-10-27):** approved as recommended (O25, D-Z). The values stay TUNABLE, to be retuned after more playtesting and the fatigue harness.

**Q45 — May saves from M1 move to M1.1 like this?**
**Required before the M1.1 handoff · 01 §8.2 D-X (migration); 05 §9.3**

Old saves keep every stat. Each fighter gets a Stamina value rolled from the save's seed, a level worked out from his stats, this season's XP in his level bar (just short of a level), Freshness 100 and no waiting level-ups. Young fighters lose the season-end growth M1 would have given them this season; levels replace it from then on.

**Recommendation:** confirm. It is simple and deterministic, and nothing pops up on load.

**Answer (owner, 2026-10-27):** approved as recommended (O25, D-X migration).

**Q46 — Approve the rank, perk and tiredness rules?**
**Required before the M1.1 handoff · 03 sys-ability-ranks, sys-perks, sys-fight-freshness, sys-combat-stats (PROPOSED: combat cmb11-q1 to q6)**

These are the combat designer's proposals, not yet delegated: basic attacks never rank, and actives and passives rank 1 → 3 by family; ranks never lengthen any control effect, hard or soft (the validator checks both); 72 perks, at most 4 per fighter with at most 1 top-tier, permanent in M1.1; Stamina has no fight formula and a 2% rating weight; the tiredness penalty at each round start (none at 60+, at worst −8% attack speed, −4.8% move, −6.4% Power and Support, +20% reaction delay, which is ×0.8 of the first proposal after the M1.1 tuning); the perk names and the small sim extensions they need. The tuning pass has since cut four perks (Hunter's Patience to 6%, Overload to 6%, Last Wall to 8%, Glass Cannon to 9%), given six focus-regeneration perks real effects (Measured Breath, Ready Mind, Deep Well, Puppeteer, Wellspring, Rallying Horn) and given all 22 control abilities real cooldown steps.

**Recommendation:** approve all; revisit the perk cap and the penalty after the harness runs.

**Answer (owner, 2026-10-27):** approved as recommended (O26): cmb11-q1 to q6 are REQUIRED, with numeric values TUNABLE within the documented bounds. The perk cap and the tiredness penalty are to be revisited after harness runs.

**Q47 — Is a one-seed dynasty a warning or a failure?**
**Required before the M1.1 handoff · 01 §8.2 D-AA; 03 §8.4; 05 §12 KI-1**

The automatic check "no club wins its tier more than a set share of seasons" flips on one lucky title run on one seed. It is now a warning: the run still passes and prints the flag. Dynasty balance stays on the list for the M7 balance pass, which judges 10 seeds over 30 seasons. The other 13 checks of the 10-season gate still fail the run.

**Recommendation:** confirm D-AA. A hard dynasty rule on one seed would make the gate flaky without telling you more about long saves.

**Answer (owner, 2026-10-27):** approved as recommended (O25, D-AA).

**Q48 — Should a tired fighter keep losing Freshness at the full rate?**
**Required before the M1.1 handoff · 01 §8.2 D-AB; 03 sys-freshness**

A fighter who starts a round already Tired (below 60) now loses half as much Freshness as a rested one. The first Tired round arrives on the same schedule (about 4 matches for a high-Stamina fighter, about 2 for a low one). The difference comes afterwards: an unrotated starter fades slowly instead of dropping to 0 within a few weeks, so resting stays a choice and not a rescue. AI clubs rest tired starters earlier to match.

**Recommendation:** confirm D-AB, and tune after the playtest and the fatigue harness.

**Answer (owner, 2026-10-27):** approved as recommended (O25, D-AB). The value stays TUNABLE, to be retuned after more playtesting and the fatigue harness.

**Q49 — Are the Ashkin hurt slightly less often?**
**Required before the M1.1 handoff · 01 §8.2 D-AC; 03 sys-races, sys-injury**

The Ashkin injury chance is ×0.82 where a human is ×1.0 (it was ×0.85), so that the injury rates stay inside their population band. Orcs (×0.75) and dwarves (×0.80) are still the sturdiest and elves (×1.25) the most fragile, as you asked (O11).

**Recommendation:** confirm D-AC. Races are balanced over a career, not per injury.

**Answer (owner, 2026-10-27):** approved as recommended (O25, D-AC).

**Q50 — How should autosaves work during a match?**
**Required before the M1.1 handoff · 01 §8.2 D-AD; 05 §5**

Three weekly autosave slots rotate after each finished week, each season end and a new career. While you are in a match, a slot of its own ("Mid-match autosave") is overwritten after every round, so quitting between rounds never replays a result. Settings › Weekly autosaves switches off only the three weekly slots; the mid-match slot always runs.

**Recommendation:** confirm D-AD. It keeps "no rerolls" without costing a weekly slot.

**Answer (owner, 2026-10-27):** approved as recommended (O25, D-AD).

**Q51 — Should every match pause between rounds?**
**Required before the M1.1 handoff · 01 §8.2 D-AE (and D-V); 04 ui-between, ui-settings**

By default every match of your club pauses after each round that does not decide it, so you see Freshness and the swap options every time; one Enter plays on, and the QA playtest measured a routine round at one input. Settings offers "When urgent" (pause only for an injury, a fighter below the auto-swap threshold or a missing captain) and "Never".

**Recommendation:** keep "Always" for the playtest, and switch the default to "When urgent" if the pauses feel heavy.

**Answer (owner, 2026-10-27):** approved as recommended (O25, D-AE): "Always" stays the default for the playtest and may switch to "When urgent" later.

**Batch D was approved in one line on 2026-10-27:** every question approved as recommended, that is, "Confirm D-U to D-AE and approve the combat proposals as recommended (Q37–Q51)." (O25, O26)


#### Batch E — raised in v0.7 (answered 2026-10-27: option A)

**Q52 — Should a fighter's level be literally his total stat points?**
**Required to settle the wording of O23 · 01 §8.1 O23; §8.4 open-034; 03 sys-development, sys-save**

You said that fighter levels stay as total stat points (O23). The level in the build is a counter that differs from that wording in three ways. (a) At generation, and when an older save is migrated, the level starts at 1 plus the stat points above half of each stat's ceiling, not all the points. (b) Every level-up adds 1 to the level, including one where you pick a skill (an ability rank or a perk) and one where nothing is left to offer, so those levels add no stat point. (c) A level never goes down, while wear and scars can lower stats.

Option A: keep the build's level counter and reword O23 to say so. Option B: make the level a strict function of a fighter's current stat points (a build change; which points count would be settled with it).

**Recommendation:** none; the owner's call.

**Answer (owner, 2026-10-27):** option A. The owner said in chat: "Keep the level model as built (no code change); reword O23 so it says the level is the stat-point-based number as it works today." O23 is reworded accordingly (§8.1), open-034 is settled, and 03 sys-development "Levels" specifies the approved model. No build change.


**Interview progress record**

| Document / section | Coverage | Outstanding decision IDs | Blocks which milestone? |
| --- | --- | --- | --- |
| 01 vision | v0.7: complete for M1 and M1.1 and synced to the build (main @ 00ad3db); register D-A to D-AE (D-U to D-AE confirmed, O25) and O1–O33; reviews and the M1.1 code review and QA playtest recorded | Q1–Q16, Q23–Q26, Q28–Q35 | M1 and M1.1 handoff approval |
| 02 flow | v0.7: complete for M1 and M1.1; D-O, D-P, D-R, D-S and D-U to D-AE (confirmed, O25) folded in; the R002 changes (O27–O32); flow-023 to flow-039 | Q3–Q5, Q10, Q11, Q15, Q16, Q24, Q25, Q29, Q30, Q32, Q33 | M1, M1.1 |
| 03 systems | v0.7: complete for M1 and M1.1; values re-derived from `content/default` (unchanged since 293f49a; build on main @ 00ad3db); the M1.1 tuning results and soak evidence in §8; D-P, D-Q, D-S, D-T and D-U to D-AE (confirmed, O25) specified; the R002 rules (O27–O32) | Q1–Q8, Q11–Q15, Q20, Q28, Q30, Q31, Q33, Q34 | M1, M1.1 |
| 04 presentation | v0.7: complete for M1 and M1.1; the match report, level-up card, between-round screen, squad and Freshness displays documented as built, with the R002 changes (box score, effective rating, true reserve swap, R1/R2, between-round stats, next-season wage room); M4 and M5 placeholders | Q4, Q23–Q27, Q29, Q32, Q33 | M1, M1.1 |
| 05 technical | v0.7 (v0.7.1 post-merge): synced to main @ 00ad3db (save schema v4 with the KI-2 compaction; D-A to D-AE with D-U to D-AE confirmed; the O24 compaction rule as built and measured against the 10 MB budget of O33; §8 actuals measured on 293f49a, the save sizes on main; §12 known issues, KI-2 closed); §9.2 unchanged | Q16, Q21, Q22, Q35 | M1, M1.1 |

- **Current state:** M1.1 "Playtest round 1" (O15–O22) is built and merged (main @ 293f49a, tag `m1.1-playtest-r1`; with the R002 playtest fixes, O27–O32, main @ d440107; main is now @ 00ad3db, which also merges docs v0.7, the KI-2 compaction and the KI-16/18/19 fixes) on top of M1 "Season MVP" (tag `m1-season-mvp` @ 3e682d5; O14, D-N). **Built at risk:** the coding agents built M1 and M1.1 from 05 §9.2 and §9.3 on the working assumptions of this package under the owner's goal instruction. The owner has since answered Q36, batch D and Q52 (2026-10-27), confirming D-U to D-AE (O25) and the level model as built (O23); the answers to Q1–Q35 are still pending, so every DELEGATED (D-A to D-T) and PROPOSED item the build uses could still change. Verified for v0.6 on main @ 293f49a (not re-run for v0.7, which changes documents only): `vitest run` passes 1,093 tests, and the 10-season soak (seed `soak-1`) passes 14/14 checks (13 hard, plus the warning-level competitive-balance); the 20-season run is reported and does not gate (05 §12 KI-1, KI-17). **On the merged main @ 00ad3db** the suite has 1,181 tests and the 10-season soak passes (the competitive-balance check is a warning by design).
- **QA re-verification** (browser tester agent, main @ 3e682d5 tagged `m1-season-mvp`, 2026-10-25): goal items 1–6 **PASS**; item 7 **PASS with a note**. It followed the QA polish round (m1/polish-core @ 60ccdd1, m1/polish-ui @ c35d12a).
- **M1.1 code review** (relayed by the orchestrator, before the tag): no blocker and 7 minor findings, all fixed or documented.
- **M1.1 QA playtest** (browser tester agent, main @ 293f49a, 2026-10-26): every M1.1 rule passes (squads and blind swaps, bench XP, level-ups, Freshness, saves and the mid-match slot), and the owner's real R001 career migrated from save v2 to v3 and played on. Measured: a routine round is one input (Enter) and a routine week 2–4 inputs. This is agent evidence, not a human playtest (§6).
- **Known issues at M1.1** (05 §12): the 20-season soak flags a dynasty as a warning (Keelwick Tarhands won the Crown Reckoning in seasons 8–11 on seed `soak-1`) and fails age-distribution in season 11 (human-age ≥ 31 share 55.8% against a 55% cap); saves reached about 4.5 MB at season 3 (5.6 MB by season 10) and about 12 MB in season against a 3 MB budget (the compaction the owner chose, Q36, O24, built on `m1.1/save-trim`, cut the in-season peak at season 3 to about 7.6 MB, 4.8–8.9 MB over ten seasons, and left the end-of-season size at about 4.5 MB; the owner then raised the budget to about 10 MB and closed KI-2, O33, open-035 settled); the sim takes about 1.9–2.0 ms per round against 2 ms (2.4 ms in M1); class win rates still span about 39–63% in the M1 pass-1 content (headsman 62.6%, cantor 38.7%) while archetypes sit at 44–54%; cautious-style AI clubs won 1 of 20 Crown titles; AI clubs keep a full Muster cap after their trials rookie; money piles up with no spending outlet (measured on M1); the market tooltip quoted a +500 starter bonus where the data says 1,000 (KI-16, resolved), the `squad-match` balance mode crashed in the CLI (KI-18, resolved) and the perk harness flagged Last Wall at a +5.2-point lift (KI-19, resolved by a 5% shield); and the M1 QA items KI-11 to KI-15. KI-3 (bundle) is resolved: startup JS about 204 kB against 250 kB. KI-16, KI-18 and KI-19 are resolved on `m1.1/ki-fixes`; KI-2 is closed by the new 10 MB budget (O33); v0.7 adds KI-20 to KI-23 (05 §12).
- **Reviews:** a requirements review and an independent fresh-reader review ran on v0.2; v0.3 dispositions every finding relayed to the lead designer (§8.6). The M1.1 build had a code review and a QA playtest (above). The package is ready for the owner's review, not approved.
- **Working files:** `docs/design/01-…05-` (linked above); drafts in `docs/design/_drafts/` (03 drafts merged, kept until the milestone commit); content in `content/default/`.
- **Last question number:** Q52. Q36 and Q37–Q51 were put to the owner and answered on 2026-10-27; Q52 was raised in v0.7 and answered on 2026-10-27 (option A). To keep the numbering continuous, Q23–Q25 and Q28–Q34 sit in batch A, Q26, Q35 and Q36 in batch B, Q27 in batch C, Q37–Q51 in batch D and Q52 in batch E. **Counts:** batch A 18 (Q1–Q8, Q23–Q25, Q28–Q34), batch B 11 (Q9–Q16, Q26, Q35, Q36), batch C 7 (Q17–Q22, Q27), batch D 15 (Q37–Q51), batch E 1 (Q52); 52 in all, of which **17 are answered** (Q36, Q37–Q52) and **35 are open** (Q1–Q35).
- **M1.1 "Playtest round 1"** (v0.5 design merge, v0.6 as built): the owner's tickets AL-R001-T001 to T005 and answers are O15–O22; the designers' drafts (`_drafts/m1.1/progression.md` v0.2, `_drafts/m1.1/combat-skills.md` v0.2, `_drafts/m1.1/content/`) were merged into 03 and the architect's addendum (`_drafts/05-technical-m1.1.md`) into 05 §9.3; their remaining choices are D-U to D-Z, and the tuning and QA rounds added D-AA to D-AE (batch D, confirmed by the owner as O25). Work packages WP-A to WP-D, the tuning branches (m1.1/tune-combat, m1.1/tune-life), m1.1/bundle and the QA fix branches are merged on main @ 293f49a. The sprite pipeline questions are open-032. The owner's R002 playtest tickets (AL-R002-T001 to T006) were merged on main @ d440107 (core 15f16ce, UI 12ef36a) and are O27–O32.
- **Delegated design freedom:** the owner's goal instruction not to pause for questions, exercised through D-A to D-AE and recorded in §8.2; the owner has confirmed D-U to D-AE (O25), and D-A to D-T await confirmation. Every other choice is PROPOSED or OPEN (G1).
- **Next decision frontier:** batch A (Q1–Q8, Q23–Q25, Q28–Q34: confirmation), then batch B (Q9–Q16, Q26, Q35; Q36 is answered). Batch C (Q17–Q22, Q27) can wait for its milestones. Batch D, Q36 and Q52 (option A, how levels relate to stat points) were answered on 2026-10-27. Batches A to C can each be answered with their one-line approval; open-035 (the save budget) was settled on 2026-10-27 (O33).

### 8.6 Independent review record

Two reviews ran on 2026-10-25, both on **v0.2** of the five documents (commit e52d3c3) while M1 was being built. Their findings reached the lead designer through the orchestrator's final doc-sync brief; this record lists only the findings relayed there. **Findings C1, C2, C8 and #3 were not relayed** and have no disposition here. Readiness state after v0.3: ready for owner review; not approved.

**Review 1: requirements review.** *Reviewer context:* a requirements reviewer agent checking the package against the owner's requirements and decisions (R, T, V, G, O IDs and the owner's own words). *Version:* v0.2.

| Finding | Summary | Disposition in v0.3 |
| --- | --- | --- |
| C3 | D-A was called "the literal O3 rule", but O3 covers only unused academy call-ups | Fixed: D-A says it extends O3's rule to every unused roster fighter and is the orchestrator's decision; 03 sys-development relabelled DELEGATED; 02 and the glossary follow (§8.2, Q1) |
| C4 | O11 was paraphrased on mental decline, and D-B's race scaling was presented as the owner's | Fixed: O11 quotes "Mental skills don't decline until ~60" and states that no race scaling was given; D-B, open-025, 03 and Q2 present the scaling as a departure |
| C5 | FUTURE was used for work planned in milestones, and R5's academy outcomes were missing from sys-academy | Fixed: FUTURE is reserved for unscheduled ideas and planned work carries milestone tags ("Meaning of specification labels" above; 03, 04); sys-academy lists the R5 outcomes as M5 scope (03 §2, §3.5) |
| C6 | The package did not say that M1 was being built at risk before the owner's answers | Fixed: header, status, progress record, 02–05 headers and 05 §9 state that M1 was built at risk under the owner's goal and that batch A/B answers are pending |
| C7 | 04 had no place for the fuzzy-stat display (O4) or the academy screen (O3) | Fixed: 04 ui-knowledge (M4) and ui-academy (M5) placeholders with their binding constraints |
| C9 | Soak lengths disagreed (10, 20, 25, 25–30 and 30 seasons) | Fixed: one ladder in 03 §8 (M1 gate 1 seed × 10 seasons; 20 seasons reported; M7 gate 10 seeds × 30), used by 01 §5–§6 and 05 §10; `economy.json` balanceTargets.seasons 25 → 30 is a content request |

**Review 2: independent review.** *Reviewer context:* a fresh reader given only the five documents, the content files and the visual references (the Tengo independent-review procedure), checking whether an implementer could build M1 without inventing rules. *Version:* v0.2.

| Finding | Summary | Disposition in v0.3 |
| --- | --- | --- |
| #1 | When the player's result is committed relative to the report was unclear, leaving room for a reroll | D-O (Q29); 02 §2–3, 03 sys-calendar and sys-save, 04, 05 §3.3 and §5; le-031, flow-023 |
| #2 | Season 1 had no defined start: no preceding season end, Trials Day class or opening-balance rule | D-P (Q30); 02 §2, 03 sys-youth-intake, sys-transfers, sys-finance, §7; intake-002, flow-024 |
| #4 | Two rating formulas (combat's and the lifecycle centipoint form) | D-Q (Q31); 03 contract 7 and sys-combat-stats; cmb-014 |
| #5 | The "What decided it" selection was not specified | 04 ui-report documents the heuristic WP7 built, as PROPOSED · TUNABLE |
| #6 | The pre-match injury odds had no defined estimator | 03 sys-injury and 04 ui-squad: an estimate from a typical round, always shown with ≈; the unshown career-ending figure is 05 §12 KI-8 |
| #7 | "Published lineup" implied seeing the opponent's next lineup | D-R (Q32): the last lineup only; 02, 03, 04 |
| #8 | flow-011 ("Continue alone") conflicted with the captain blocker | flow-011 runs with the player's club AI-managed, and the automatic interim captain (D-S, Q33) applies |
| #9 | The lineup pre-fill was unspecified | 02 step 6 and 04 ui-squad: the AI's lineup rule, as built, labelled PERMITTED-CHOICE |
| #10 | 02 step 10 cited flow-019 (an academy scenario) for the endless journey | Fixed to flow-022 |

## Completion check

- [x] The promise describes a player experience, not just a genre or feature list (approval pending, Q9).
- [x] Pillars help choose between competing implementations, and a priority order is given.
- [x] The current milestone (M1) has a concrete finish line; later horizons are bounded.
- [x] The glossary and source-of-truth rules are clear.
- [ ] Current-milestone unknowns are resolved. They are delegated or recorded as batches A and B (Q1–Q16, Q23–Q26, Q28–Q35), awaiting the owner; batch D, Q36 and Q52 were answered on 2026-10-27; M1 and M1.1 were built at risk on the recommendations.
- [x] Another person can explain what must survive if the feature budget is cut: the M1 season loop, pillars 4, 2 and 1, and the REQUIRED and DELEGATED items.

## Reusable LLM handoff prompt

> Read all five Arena League design documents (`docs/design/01`–`05`) and the content files in `content/default/` before implementing, and treat them as one specification. Milestone M1.1 "Playtest round 1" (document 01 §5, O15–O22, with the R002 playtest fixes O27–O32) is built at risk and merged on main @ 00ad3db (tag `m1.1-playtest-r1` @ 293f49a), on top of M1 "Season MVP" (O14 and D-N); the next milestone in the planned order is M2 (the arena viewer); keep the M1 and M1.1 loops working; follow the build order in document 05. Summarize the player promise, M1 scope, authoritative rules and acceptance criteria. Labels are defined in document 01: REQUIRED (R/T/V/G requirements, owner decisions O1–O33 and the confirmed D-U to D-AE) and DELEGATED (D-A to D-T) are binding. PERMITTED-CHOICE marks behavior documented as built within stated bounds. PROPOSED (P-01–P-22 and merged draft rules) and OPEN items are working design the owner has not approved. Before dependent work, check document 01 §8.5: the owner may have answered questions Q1–Q35 since this version (Q36–Q52 are answered). Do not treat a working assumption, an example, a future idea or a blank placeholder as approved. The visual references are the mockups and `src/ui/styles/` (document 04 ref-001). The simulation must be pure TypeScript with no PixiJS imports, integer-only, deterministic with seeded randomness, and runnable headlessly (T4). In M1, matches are simulated headlessly and shown as match reports, with no arena viewer (O12). Management UI is HTML/CSS (T3), and good UI design is a priority (O13). The content files are the source of truth for numbers; 03 defines the rules that use them. Build the complete M1 season loop including save/load, verify the applicable acceptance scenarios (02 §9, 03 §9, 05 §10), run the combat harness and the 48-club soak (03 §8), and report what works, what was tested, and what remains unresolved, including any decision you needed from the owner.
