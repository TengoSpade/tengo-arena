# Arena League — game vision and design principles

> ARENA LEAGUE DESIGN PACKAGE · DRAFT v0.4 · 2026-10-25 · Lead designer. Not approved by the owner. **M1 has been built at risk** on this package's working assumptions under the owner's goal instruction (main tagged `m1-season-mvp` @ 3e682d5, after the QA polish round); the owner's answers to batches A and B (§8.5) are still pending. The package has had a requirements review and an independent review (§8.6). Owner requirements and owner decisions are REQUIRED. Decisions D-A to D-T were made under delegation from the owner's goal instruction: they are DELEGATED, binding as the working design, and still need the owner's confirmation. Everything else is PROPOSED or OPEN. §8.5 lists every question for the owner. Current target: milestone M1 "Season MVP".

| Field | Value |
| --- | --- |
| Game / working title | Arena League |
| Design owner | The project owner. Agents draft; only the owner approves design decisions (G1) |
| Document version / updated | v0.4 / 2026-10-25 |
| Status | Draft v0.4: the M1 polish sync (v0.3 was the M1 doc sync; v0.4 adds the QA polish round, tag `m1-season-mvp` @ 3e682d5). All five documents are written for M1, every phase-2 draft is merged (05 §9.2 reproduced verbatim from the architect), and values and decisions match the M1 build on main @ f4b39d9 (741 tests, 10-season soak 11/11). M1 was built at risk; the owner's batch A/B answers are pending. Two reviews have run and their relayed findings are dispositioned (§8.6) |
| Current build target | M1 "Season MVP" (O14; contents and the later order D-N). The package as a whole specifies every owner-required feature through M7 and the first release |
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

- **REQUIRED**: approved behavior that implementation must preserve. Only owner requirements (IDs R, T, V, G) and owner decisions (IDs O) are REQUIRED. A REQUIRED statement cites its ID.
- **DELEGATED**: a decision made without the owner, under the owner's explicit goal instruction not to pause for questions. The orchestrator made D-A to D-G, D-J to D-M and D-N to D-T; the lead designer agreed D-H and D-I at the merge, as the orchestrator instructed. It is cited as "DELEGATED (D-x)". It is the binding working design: implementation may rely on it and must not reopen it without a new decision. It still awaits owner confirmation (§8.5, batch A). If the owner overturns it, every section listed for it in §8.2 must be revised.
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
| Delegated decisions D-A to D-T (§8.2) | DELEGATED: binding working design, pending owner confirmation | Orchestrator delegation under owner goal 2026-10-25 |
| `docs/research.md` (§1 glossary, §2 summary, Parts A–C) | Evidence and recommended defaults only. C3 defaults enter as PROPOSED P-IDs. Where an O- or D-decision differs, that decision governs (§8.3) | Not approved |
| research.md Part D (§5a, traits and captains) and `research-notes/06` | Evidence for O5 and O6; its D3 recommendations are reflected in the 03 trait and captaincy specs (PROPOSED) | Not approved |
| `docs/research-notes/01–05` | Supporting evidence | Not approved |
| `content/default/*.json` | Source of truth for **values** under 03's rules. Values were edited at the merge to match D-A and D-C, and later by balance pass 1, the tuning pass and the core fix round (change record). A disagreement between 03 and the data is a defect to report | Values PROPOSED · TUNABLE |
| Phase-2 drafts in `docs/design/_drafts/` | All drafts (03, 04, 05) are merged and have no further authority; they are kept until the milestone commit. Code is never design authority; 05 §9.2 governs who may change which code | Not approved |
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

**Status:** M1 as the current target, a version in which the owner can "progress a full season" with simulated battles, is REQUIRED (O14). The M1 contents list (including "M1 = presets only" and free agents only) and the order of M2–M7 are DELEGATED (D-N). M1's league structure, money model and market are DELEGATED (D-C). How each later milestone is realized is OPEN (open-021, working assumption as written). Content counts are PROPOSED · TUNABLE unless an O-ID fixes them.

The prototype horizon is milestones M1–M7, each playable on its own, with M1 as the current target. The owner's original milestones (a)–(g) are folded in as follows: (a) headless sim → M1, viewer → M2; (b) tactics editor → M3; (c) roster, contracts, finances → M1, with club-to-club transfers in M6; (d) scouting → M4; (e) leagues and promotion/relegation → M1, with more regions and cups in M6; (f) development → M1, academy → M5; (g) save/load → M1, balance and polish → M7.

| Horizon | Player can do | Minimum content | Question / outcome it proves | Explicit exclusions |
| --- | --- | --- | --- | --- |
| **M1 "Season MVP"** (current target, O14; contents D-N) | New career → pick a club → manage the roster (signings, renewals, releases, captain and vice-captain, presets, training emphasis) → 16 simulated matches → the 3-round Reckoning of 8 clubs (O9) → season end (aging, development, retirements, contract expiries, new rookies, promotion/relegation) → next season, with save/load. Read match reports | One league region, Saltmarch, with 3 tiers × 16 clubs (48 clubs) in two 8-club wings and a 23-week calendar (D-C). 42 classes (O8) with 168 abilities and 105 presets (295 rules). 5 races (O11, D-B). 60 traits (O5). Captaincy (O6) and lineup chemistry (D-D). XP, progression, potential, injuries. Wages, season and wage budgets, revenue and prize money (O10). A free-agent market with contracts and trials-day rookies. AI clubs with five personalities. Match reports. Pacing presets (D-L). Save/load. The 04 screens (ui-new to ui-settings) | A full season loop with real weekly decisions. Classes, races and traits produce distinct fighters. Match reports explain results. The world stays healthy over many headless seasons | Arena viewer (M2), rule editing (M3), scouting and fuzzy stats (M4; M1 shows exact values, open-026), academy (M5), other league regions, cups, club-to-club transfers and the patron (M6), difficulty sliders, season modifiers and packaging (M7) |
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

**Status:** the claims are PROPOSED evaluation criteria and the thresholds PROPOSED · TUNABLE (open-001). Only automated evidence exists so far: the vis-008 M1 smoke (10-season soak, 11/11) and the headless part of vis-009 (03 §8.4). No playtest criterion has been run, and none may be reported as passed without recorded evidence. 03 §8 holds the mechanical soak and harness bands.

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
| Stat | One of 12 integer attributes on the absolute 1–20 scale. **Physical** (str, agi, pac, tgh, pre) decline after the race-scaled peak; **mental** (arc, spi, wil, cmp, ldr, awr, dis) not before human-age 60 (O11, D-B) | 03 §1, sys-combat-stats |
| Rating | A fighter's current ability for his class, 1–100: `combatRating`, round(5 × the class-weighted sum of his integer stats). One integer function serves every screen, the market, the AI and combat (D-Q) | 03 sys-combat-stats |
| Potential | The highest rating a fighter can reach (1–100), shown as stars; fixed except for scars (and from M5 the academy) | 03 sys-fighters |
| Development pace | A fighter's hidden growth speed (Slow to Rapid) | 03 sys-fighters |
| XP / usage | Experience earned only for rounds started / season XP ÷ 360, capped at 1. Usage drives growth; a fighter who plays no rounds does not develop (D-A, extending O3's academy rule to the roster) | 03 sys-development |
| Training emphasis | A standing per-fighter setting, Balanced, Body or Mind, that moves earned growth between physical and mental stats without changing its total (D-A) | 03 sys-development |
| Trend | The live projection of a fighter's rating change by season end (Surging to Fading) | 03 sys-development |
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
| Roster / reserve | A club's senior fighters under contract, capped by tier at 14/12/10 (O2) / a roster fighter not in the current lineup | 03 sys-roster |
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
| Replay / sandbox | A stored match shown in the viewer from its seeds (M2) / a practice scrimmage that never affects saved results (M3) | 03 §3.5 |
| Scout / assignment / scout report / baseline report / knowledge | The M4 vocabulary of R3 and O4 (ranges, reveal steps, certainty, sources) | 03 §3.5 |
| Academy / program / enrollment / call-up / graduation | The M5 vocabulary of R5, O2 and O3 | 03 §3.5 |
| Hardcore / season modifier | The M7 permadeath mode (P-11) / one announced, opt-out league-wide rule change per season (P-16) | 03 §3.5 |
| Theme | The data pack of names, presentation and text (T5) | 03 sys-theme |
| Pacing preset | Thorough, Balanced (default), Streamlined or Custom: where Continue stops at the lineup and the report. It never changes a result (D-L) | 04 ui-settings |
| Squad (screen) | The screen that holds the lineup board and the roster table. It is a screen name, not a separate concept from roster and lineup | 04 ui-squad |
| Wage room | Wage budget − wage bill − pending wages: what a new offer may add per week | 03 sys-finance; 04 ui-market |
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

### 8.2 Delegated decisions (pending owner confirmation)

**Status: DELEGATED.** Origin of D-A to D-G and D-J to D-M: "orchestrator delegation under owner goal 2026-10-25 — pending owner confirmation" (D-J to D-M adopt the UI designer's OC-3 to OC-6 because the build is starting). Origin of D-H and D-I: agreed by the lead designer at the merge at the orchestrator's instruction, under the same delegation and pending owner confirmation. Origin of D-N to D-T: "orchestrator delegation under owner goal 2026-10-25, pending owner confirmation"; they were decided during the M1 build and its fix rounds, most of them in answer to the reviews of §8.6, and M1 is built on them. §8.5 batch A asks the owner to confirm them all.

| ID | Outcome | Scope | Supersedes / resolves | Affected sections |
| --- | --- | --- | --- | --- |
| D-A | **Unused fighters:** a roster fighter who plays no rounds gets **0 XP and 0 development**. This **extends** the owner's academy call-up rule (O3: a called-up fighter not used in matches gains no XP) to every unused roster fighter, which O3 does not state; it is the orchestrator's decision, not the literal O3 rule. The lifecycle draft's 20% development while unused is rejected (`usageFloor` 0). A standing **training emphasis** (Balanced, Body, Mind) is in M1, but it only shapes *which* stats the earned growth goes to, not how much: the physical and mental multipliers always sum to 2, with no wear effect | M1 onward | Lifecycle C-5 and C-10; open-005 (training lever) | 02 §1, §5, §7; 03 sys-development, sys-ai-manager, §4, §9.2; `development.json` |
| D-B | **Mental decline scales by race lifespan:** human 60, elf 90, dwarf 54, orc 48, Ashkin 39. The original Ashkin race and the long elf careers are kept. This is a **departure** from O11's wording ("Mental skills don't decline until ~60", with no race scaling stated) | M1 onward | open-025; lifecycle C-1, C-3, C-4 | 01 §4, §7; 03 sys-races, sys-development |
| D-C | **League structure and economy model** (the economy draft): 3 tiers × 16 clubs in two 8-club wings; 16 matches per club, 8 home and 8 away, no byes; points 3/2/1/0; the Reckoning (top 4 per wing; QF and SF best-of-3 hosted by the higher seed; final best-of-5 at the neutral Charterhall); relegation of each wing's 8th; promotion of the Reckoning champion plus the Shield winner; a 23-week calendar. Economy confirmations adopted: (1) structure, (2) promotion and relegation, (3) tournament rounds, (4) **tessel** as the display name, (5) offers answered at week processing, with pending offers reserving cap and wage room and rival-offer counts visible, (6) the hard wage budget and the embargo ladder with Registry deductions capped at 30%, and **2.5 world-generation free agents per club**. **Rejected:** the M1 patron goal (no patron goal in M1, keeping 02's position). *Reading of the instruction:* the orchestrator's numbering ("adopt 1–6 and 8; reject #7 patron goal") did not match the draft's ten-item list, where 7 = soft landings, 8 = patron goal, 9 = contract costs, 10 = free agents. Following the instruction's descriptions, the lead designer adopted soft landings (7) and contract costs (9) as well, and rejected only the patron goal. The owner should confirm this reading | M1 onward | open-014 (the 17-club recommendation), open-005 (calendar), open-007 (M1 ladder), open-023 (currency name only), open-027, open-028; economy confirmations 1–10 | 01 §4, §5, §7; 02 §1–§6, §9; 03 sys-league, sys-calendar, sys-tournament, sys-roster, sys-finance, sys-contracts, sys-transfers, §7, §8.4, §9.3; `economy.json`, `leagues.json`, `development.json` |
| D-D | **Chemistry in M1** is limited to the lineup-chemistry modifiers from traits, captaincy grade and captaincy statuses specified in 03 sys-chemistry (at most ±2 composure). No broader morale system in M1 | M1 | open-029 (M1 part); lifecycle C-9 | 03 sys-chemistry, sys-captaincy; 02 §5 |
| D-E | Sim positions and per-tick movement are stored internally in **integer millimetres** (combat cmb-c1). Content stays in metres and events in centimetres | M1 onward | 03 §1 "distances in centimetres" | 03 §1, sys-movement; 05 (to update) |
| D-F | Race stat tendencies are capped at **±4** per stat and trait stat adds at **±3** (applied in the data: maximum ±1.6 and ±3) | M1 onward | combat cmb-c2 and cmb-q11 | 03 sys-races, sys-traits, §6 |
| D-G | Combat's remaining recommendations are adopted: the 12-stat model (cmb-q1), bounded randomness with accumulators, ±4% variance, reaction jitter and a seeded coin as the last tiebreak (cmb-q2), focus (cmb-q3), overtime ramp and tiebreak chain (cmb-q4), crowd-control rules (cmb-q5), the 42 class names (cmb-q6), two damage types (cmb-q7), the captain model (cmb-q8), the rule-engine details (cmb-q9), the unusual mechanics (cmb-q10). Also combat's working use of open-019 (an open arena) and open-024 (hybrid role tags) | M1 onward | open-019, open-024; cmb-q1–q12 | 03 §3.1, §9.1 |
| D-H | **Rookie counts and free-agent pool:** rookies = round(base × clubs) + the season's retirements and career-ending injuries, clamped to [0.5, 1.6] × clubs, with base 0.6 at the merge, tuned to 0.75 in m1/fix-tuning (TUNABLE; 36 + retirements at 48 clubs, 37–59 a season in the 20-season soak); season 1 is D-P; Trials Day gives each club floor(rookies ÷ 48) and the remainder by lot; pool floors 60 in season and 5 per role, topped up with journeymen; free agents unsigned at 2 consecutive season ends leave; the P1 pool target is 100–300 | M1 | The lifecycle "0.6 per club" and economy "about 24 + exits" drafts | 03 sys-youth-intake, sys-transfers, §8.3–8.4 |
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
| open-010 | Changes during a match | In 03 sys-match (PROPOSED): M1 fixes lineup, captain, rows and presets for the whole match; from M2/M3, tactics edits between rounds (P-01) but no substitutions | 02, 03 | M1 | Q11 |
| open-011 | Captain details (O6) | In 03 sys-captaincy (PROPOSED): club captain and optional vice-captain; CQ from leadership, composure, experience, seniority, standing and traits; grades A–E with aura, rally, mentoring and chemistry; Snubbed, Passed Over, Losing the Room and Captain Departed (lifecycle C-11); grade E actively hurts (C-12). AI timing is D-I; the in-fight model is D-G | 02, 03 | M1 | Q12 |
| open-012 | Trait taxonomy, number, reveal and acquisition (O5) | In 03 sys-traits (PROPOSED): 60 traits (48 rolled, 12 storied) in six categories and four kinds; 2–4 per fighter (mean 2.9); at most one negative per starting fighter; "80/20" counted by roll weight, realized 79.9% (lifecycle C-6); visible gain and loss rules | 03, 04 | M1 | Q13 |
| open-013 | Home advantage | In 03 (PROPOSED): the home club takes the gate; no combat modifier; home only sets the west end; the Reckoning final is neutral, with the higher seed as the home side for the sim | 02, 03 | M1 | Q15 |
| open-014 | League structure under O9 | **Settled (D-C):** 3 tiers × 16 clubs in two wings, 16 matches, no byes, the Reckoning, promotion and relegation as in §8.2. The 17-club recommendation is superseded | 02, 03 | — | Q3 |
| open-015 | May distant leagues use a lighter resolver than the full fight sim? | Recommendation: no; every fixture uses the same headless sim (T4, pillar 4). A lighter resolver needs owner approval if M6 performance targets fail | 03, 05 | M6 | Q21 |
| open-016 | Save model (R7) | In 03 sys-save (working assumption): manual slots from any management screen; autosave after every week processing and after season end, written before the match report opens (D-O); seeds derived from career seed and fixture identity, so replaying from an earlier save reproduces results; from M2 mid-fight resume; M7 hardcore single ironman slot | 02, 03, 05 | M1 | Q16 |
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

### 8.5 Owner questions and interview progress

**Questions for the owner.** These are the only items that still need the owner. They use the guide's format and continuous numbering, and are grouped so that each batch can be approved in one answer ("approve batch A as recommended"). Partial answers settle only what they answer. Each batch ends with a one-line "approve all recommended" option. No question has been asked yet. **M1 has been built at risk on the recommended answers** (main @ f4b39d9), so a different answer means rework in the sections listed for that item.

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

The budgets in 05 §8 (2 ms per round, 250 ms per week, 10 s per season, a 3 MB save) need a reference machine. The working reference is a mid-range Windows laptop from 2020 or later (4 cores, 8 GB). M1 was measured only on the development machine: 2.4 ms per round (over budget), about 0.2 s per week and 3.4–4.7 s per season (within budget).

**Recommendation:** adopt the working reference, or name your own PC; then re-measure the round budget on it before any optimisation.

**Q36 — May the game trim AI-vs-AI match details during a season to keep saves small?**
**Required before handoff · 05 §5, §12 KI-2 (G1)**

Saves are 3–4 MB at season end but grow to 4–10 MB during a season, because every full match result is kept until the season ends; the budget is 3 MB. Option A: compact AI-vs-AI results a few weeks after they are played. Saves stay near budget, but the detailed reports and per-match fighter logs of those matches disappear; scores, standings and season statistics stay. Your own matches are never trimmed during the season. Option B: keep everything and raise the budget to about 12 MB.

**Recommendation:** A. Detailed reports of other clubs' old matches are rarely opened, and small saves keep autosaves fast.

**Approve batch B in one line:** "Approve Q9–Q16, Q26, Q35 and Q36 as recommended."

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

**Interview progress record**

| Document / section | Coverage | Outstanding decision IDs | Blocks which milestone? |
| --- | --- | --- | --- |
| 01 vision | v0.3: complete for M1 and synced to the build; register D-A to D-T; reviews recorded (§8.6) | Q1–Q16, Q23–Q26, Q28–Q36 | M1 handoff approval |
| 02 flow | v0.3: complete for M1; D-O, D-P, D-R and D-S folded in; flow-023 to flow-026 added | Q3–Q5, Q10, Q11, Q15, Q16, Q24, Q25, Q29, Q30, Q32, Q33 | M1 |
| 03 systems | v0.3: complete for M1; values re-derived from `content/default` on main; balance pass 1 and its ±30% exception logged; D-P, D-Q, D-S, D-T specified; soak evidence in §8 | Q1–Q8, Q11–Q15, Q20, Q28, Q30, Q31, Q33, Q34 | M1 |
| 04 presentation | v0.3: complete for M1; MVP and "What decided it" documented as built; M4 and M5 placeholders | Q4, Q23–Q27, Q29, Q32, Q33 | M1 |
| 05 technical | v0.3: synced to main @ f4b39d9 (save v2, alumni, D-A to D-T, §8 actuals, §12 known issues); §9.2 unchanged | Q16, Q21, Q22, Q35, Q36 | M1 |

- **Current target milestone:** M1 "Season MVP" (O14, D-N). **Built at risk:** the coding agents built M1 from 05 §9.2 on the working assumptions of this package under the owner's goal instruction; it is integrated on main @ f4b39d9 (741 tests, 10-season soak 11/11). The owner's answers to batches A and B are still pending, so every DELEGATED and PROPOSED item M1 uses could still change.
- **QA re-verification** (browser tester agent, main @ 3e682d5 tagged `m1-season-mvp`, 2026-10-25): goal items 1–6 **PASS**; item 7 **PASS with a note**. It followed the QA polish round (m1/polish-core @ 60ccdd1, m1/polish-ui @ c35d12a).
- **Known issues at M1** (05 §12): the 20-season soak can flag a 4-title dynasty; saves reach 4–10 MB during a season against a 3 MB budget (Q36); the bundle has 0.5 KB of headroom; the sim takes 2.4 ms per round against 2 ms; `hourglass_sage` wins 61.7%; cautious-style AI clubs won 0 of 20 Crown titles; AI clubs keep a full Muster cap after their trials rookie; money piles up with no M1 spending outlet (the median club holds 1.84 × its season budget by season 9); five QA items (KI-11 to KI-15: a renewal's over-budget figure disagrees with the wage room, the TW1 season-end dialog omits expiring contracts, the nav highlights League in the season review, long names truncate on lineup cards, low-rated veterans past 40 show physical stats of 1–2). KI-9 (the opponent's planned lineup before his first match) is resolved.
- **Reviews:** a requirements review and an independent fresh-reader review ran on v0.2; v0.3 dispositions every finding relayed to the lead designer (§8.6). The package is ready for the owner's review, not approved.
- **Working files:** `docs/design/01-…05-` (linked above); drafts in `docs/design/_drafts/` (03 drafts merged, kept until the milestone commit); content in `content/default/`.
- **Last question number:** Q36, drafted but not asked. To keep the numbering continuous, Q23–Q25 and Q28–Q34 sit in batch A, Q26, Q35 and Q36 in batch B, and Q27 in batch C. **Counts:** batch A 18 (Q1–Q8, Q23–Q25, Q28–Q34), batch B 11 (Q9–Q16, Q26, Q35, Q36), batch C 7 (Q17–Q22, Q27); 36 in all.
- **Delegated design freedom:** the owner's goal instruction not to pause for questions, exercised through D-A to D-T and recorded in §8.2. Every other choice is PROPOSED or OPEN (G1).
- **Next decision frontier:** batch A (Q1–Q8, Q23–Q25, Q28–Q34: confirmation), then batch B (Q9–Q16, Q26, Q35, Q36). Batch C (Q17–Q22, Q27) can wait for its milestones. Each batch can be answered with its one-line approval.

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
- [ ] Current-milestone unknowns are resolved. They are delegated or recorded as batches A and B (Q1–Q16, Q23–Q26, Q28–Q36), awaiting the owner; M1 was built at risk on the recommendations.
- [x] Another person can explain what must survive if the feature budget is cut: the M1 season loop, pillars 4, 2 and 1, and the REQUIRED and DELEGATED items.

## Reusable LLM handoff prompt

> Read all five Arena League design documents (`docs/design/01`–`05`) and the content files in `content/default/` before implementing, and treat them as one specification. The current target is milestone M1 "Season MVP" (document 01 §5, O14 and D-N), already built at risk on main; follow the build order in document 05. Summarize the player promise, M1 scope, authoritative rules and acceptance criteria. Labels are defined in document 01: REQUIRED (R/T/V/G requirements and owner decisions O1–O14) and DELEGATED (D-A to D-T) are binding. PERMITTED-CHOICE marks behavior documented as built within stated bounds. PROPOSED (P-01–P-22 and merged draft rules) and OPEN items are working design the owner has not approved. Before dependent work, check document 01 §8.5: the owner may have answered questions Q1–Q36 since this version. Do not treat a working assumption, an example, a future idea or a blank placeholder as approved. The visual references are the mockups and `src/ui/styles/` (document 04 ref-001). The simulation must be pure TypeScript with no PixiJS imports, integer-only, deterministic with seeded randomness, and runnable headlessly (T4). In M1, matches are simulated headlessly and shown as match reports, with no arena viewer (O12). Management UI is HTML/CSS (T3), and good UI design is a priority (O13). The content files are the source of truth for numbers; 03 defines the rules that use them. Build the complete M1 season loop including save/load, verify the applicable acceptance scenarios (02 §9, 03 §9, 05 §10), run the combat harness and the 48-club soak (03 §8), and report what works, what was tested, and what remains unresolved, including any decision you needed from the owner.
