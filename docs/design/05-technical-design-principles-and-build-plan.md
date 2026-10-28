# Arena League — technical design principles and build plan

> ARENA LEAGUE DESIGN PACKAGE · DRAFT v0.7 · 2026-10-27. v0.7 syncs the plan to main @ d440107 (M1.1 plus the R002 playtest fixes): §9.3 records the R002 changes, §5 and §8 the owner's save-size answer (O24), and §12 the known issues. v0.6 had synced the plan to M1.1 as built (main @ 293f49a, tag `m1.1-playtest-r1`): §9.3 records what the work packages delivered, §8 has the M1.1 actuals and §12 the updated known issues. v0.5 had merged the architect's M1.1 "Playtest round 1" addendum (§9.3: state schema v3, compact match records, migration, WP-A to WP-D) and the M1.1 decisions. Installed from the technical architect's phase-2 draft (`_drafts/05-technical.md`, phase B), reconciled with documents 01–04 by the lead designer, and synced in v0.3 to the M1 build (main @ f4b39d9), including the draft's later save-v2 change (287da3a) and decisions D-N to D-T; v0.4 adds the QA polish round (m1/polish-core @ 60ccdd1, m1/polish-ui @ c35d12a; main tagged `m1-season-mvp` @ 3e682d5). Reviewed by the requirements reviewer and the independent reviewer (01 §8.6); not approved as a whole by the owner (batch D and Q36 were answered on 2026-10-27; Q1–Q35 and Q52 are pending). M1 was built at risk on the working assumptions of 01 §8.5. This document is the package's technical plan and milestone plan (it replaces the separately planned `plan.md`).
> Follow the labels, scope, glossary, and authority rules in [document 01](01-game-vision-and-design-principles.md).
> This document governs implementation constraints and delivery. The owner fixed the language, build tool, renderer and packaging options (01: T1–T6); this document makes the remaining technical choices inside that frame.
>
> **Phase A** set up the architecture, infrastructure and build plan. **Phase B** added the content schemas and validator, the complete engine/state model, contract-first stubs for every module, golden test fixtures, and the M1 work packages for parallel coding agents (§9). **§9.2 is reproduced verbatim from the architect's draft** because coding agents are executing against it. Its references to the phase-2 drafts resolve to the merged documents: `03-combat` = 03 §3.1 and §9.1; `03-fighter-lifecycle` = 03 §3.2 and §9.2; `03-league-economy` = 03 §3.3 and §9.3; "schema notes" and "merge notes" = 03 §2 boundary contracts and the content files.

| Field | Value |
| --- | --- |
| Game / version / updated | Arena League (working title) / v0.7 (M1.1 plus the R002 fixes) / 2026-10-27 |
| Status / technical and design owners | Draft v0.7; M1 built at risk, tagged `m1-season-mvp` @ 3e682d5; M1.1 built and merged at risk, tagged `m1.1-playtest-r1` @ 293f49a, with the R002 fixes on main @ d440107; awaiting owner review (Q36 and batch D answered 2026-10-27, Q1–Q35 and Q52 pending) / technical: architect agent; design: the project owner (G1) |
| Current milestone | M1.1 "Playtest round 1" (01 §5, O15–O22) with the R002 fixes (O27–O32), built, on M1 "Season MVP" (O14; scope and later order D-N); the next milestone in the order is M2 |

**Labels in this document.** As in 01: REQUIRED only for owner requirements and decisions (R, T, V, G, O IDs); DELEGATED for D-A to D-T (01 §8.2: binding, pending owner confirmation; D-U to D-AE are confirmed, O25, and REQUIRED); PROPOSED for P-IDs; OPEN for open-IDs; EXAMPLE; FUTURE (unscheduled only; planned work carries its milestone tag); PERMITTED-CHOICE (behavior chosen within stated bounds, documented as built). In addition, **technical decisions** made inside the implementer freedom of §1 carry IDs `tech-nnn`. They bind the coding agents (§11), are not design decisions, and the owner may override any of them. Technical thresholds are written **TUNABLE (tech)** with an initial value.

**Decisions encoded (01 §8.2; D-A to D-T delegated, pending owner confirmation; D-U to D-AE confirmed by the owner, O25):**

| ID | Technical consequence | Where |
| --- | --- | --- |
| D-A | A fighter who starts no rounds got 0 XP and 0 development in M1 (`developmentClock.usageFloor` = 0). **M1.1:** O17 replaces this for roster fighters (bench XP, O25, D-W), the M1-only keys `usageFloor`, `maxDeltaPerSeason`, `emphasisBonus`, `offEmphasisPenalty`, `bodyWearReduction` and `trend` are removed from `development.json`, and training emphasis weights the level-up offers (no wear effect); `trainingEmphasis` is a stored fighter field set by the `training.set` command | core/fighters; `GameOptions.trainingEmphasis` |
| D-B | Mental decline scales by race lifespan (`decline.mentalDeclineScalesWithLifespan` = true) | core/fighters |
| D-C | League of 3 tiers × 16 clubs in two 8-club wings, 16 matches, points 3/2/1/0, the Reckoning (top 4 per wing, best-of-3, final best-of-5 at the Charterhall), promotion of the Reckoning champion and the Shield winner, relegation of each wing's 8th; budgets, the commitment rule, embargo and Registry advance; offers answered at week processing; soft landings and contract costs; currency name tessel; 2.5 world-generation free agents per club; **no patron goal in M1** (`GameOptions.patronGoals` = false, `economy.json` patron.enabledByDefault = false) | core/league, core/economy, content |
| D-D | Chemistry in M1 only from trait and captain lineup modifiers (`fighters.lineupChemistry`) | core/fighters |
| D-E | Sim positions and per-tick movement in integer millimetres (tech-014) | core/sim |
| D-F | Race tendency cap ±4, trait stat add cap ±3 (content validator) | core/content |
| D-G | Combat model per 03 §3.1 (12 stats, accumulators, overtime and tiebreak chain, CC rules, captain model) | core/sim, core/tactics |
| D-H | Rookies = round(0.8 × clubs) + retirements (basePerClub tuned 0.6 → 0.75 → 0.8), clamped to [0.5, 1.6] × clubs; Trials Day floor plus lot; pool floors 60 / 5 per role; unsigned free agents leave after 3 season ends (`retirement.unsignedSeasonEndsBeforeLeaving`) | core/fighters, core/economy |
| D-I | AI captain changes only in the season-end AI phase (5-CQ hysteresis), or mid-season on vacancy or an injury of ≥ 4 weeks | core/ai |
| D-J | Role glyph shapes paired with role colours (UI only; `data-role` from `combat.json` archetype ids) | src/ui (designer CSS) |
| D-K | Money formatted "11,840 ts" with a true minus sign | `src/ui/format` |
| D-L | **Pacing presets in M1** (Thorough, Balanced default, Streamlined, Custom) decide where Continue stops at the lineup and the report. They are a player setting stored outside saves (§5) and never change results: under Streamlined the store dispatches the same `lineup.set` and match commands the player would. No core API changes. See §12 for the ownership note | src/ui store and Continue state machine; Settings screen |
| D-M | Confirmation dialogs only for binding actions; reversible settings apply at once with Undo, implemented as commands through the store (04 §6.2) | src/ui components and store |
| D-N | M1 = presets only (no rule editing), free agents only; later order M2 viewer → M3 editor → M4 scouting → M5 academy → M6 regions, cups, transfers → M7 balance, polish, packaging (§9) | §9; package scope |
| D-O | No separate "play my match" call: `advanceWeek` plays every fixture, the player's included (`WeekReport.playerFixtureId`); the store autosaves after the committed advance and only then opens the report, so a result can never be rerolled | core/game; src/ui store (`create-store.ts`) |
| D-P | `createWorld` makes a season-1 Trials Day class of exactly one rookie per club (`fighters.generateRookies(draft, content, count)`), rescales opening bills into `budget.worldGenBillBandBp` (80–87% of WB), and runs the AI season-start setup (captains, vice-captains, emphasis, opening offers) for every club before P1, planned as if each club had signed its rookie at his Trials Day ask; AI trials signings at the first P1 processing; `club.choose` withdraws the AI's offers for the chosen club. Opening balance = starting balance; grant installment 1 is a separate setup ledger credit; the WB reserve term uses the pre-credit balance. Rookie ask capped by `market.trialsDay.maxAskBpOfTierMinWage` (12,500) | core/game (`world.ts`), core/economy, core/ai |
| D-Q | One integer rating function, `combatRating` in core/content (`rating.ts`): fighter ratings and potentials, the market, AI values, the UI and the harness OVR all call it | core/content, core/fighters, core/sim |
| D-R | The UI reads the next opponent's lineup from its latest stored `MatchResult` input (the five it last fielded, still at the club), labelled "their last lineup", and shows "No matches played yet" before the opponent's first match. `club.lineup` of an AI club already holds its plan for the coming match, so screens never show it for an opponent (KI-9, resolved in the polish round) | src/ui (home, squad) |
| D-S | `autoCaptain` (core/game `week.ts`) at each lock: missing captain → the vice if fit, else the fit starter with the highest CQ (ties: matchweeks at the club, then id), a `captain.interim` news item (reason vice or starter); the `captain.missing` blocker is gone; the fight lead of an unavailable captain is the vice, else the best-CQ starter (`fighters.lineupCaptain`) | core/game, core/fighters, src/ui |
| D-T | Retirement p = 1 − (1 − hDrop)(1 − hAge): `retirement.hazardByRatingDrop` on the drop from `career.peakRating`, `hazardPerHumanYearPastPeak` from `physicalPeakHumanAge` 30 precomputed per race (`tables.ageHazardBp`); 0 below human-age 31, forced at 58; heavy-wear add 0. The AI veteran penalty scales with the class's physical rating-weight share | core/fighters (`retirement.ts`, `tables.ts`), core/ai |
| D-U (O25) | Swaps only between rounds, blind, applied home then away; an injured fighter is out at once and replaced by a reserve (a swap) or an emergency entrant (no swap); captain handover vice → best CQ at −10; the entrant takes the slot and row; presets travel | core/game orchestrator (`applyBetweenRound`), core/fighters hooks |
| D-V (O25) | `AutoSwapRules` (threshold 40, margin 15, rating gap 6, keep one for injury, same role family first, lost-round +10); AI personality thresholds and rotation (`levels.json` aiSubstitution, aiRotation); player defaults pause `always` (O25, D-AE), level-ups `manual` with pacing `detailed` | core/game, core/ai, core/content match defaults |
| D-W (O25) | Bench XP = floor(clubMatchXp × 3,333 bp × own multipliers ÷ 5) for fit fighters who start no round | core/fighters (`xpAfterRound`, `matchEndProgression`) |
| D-X (O25) | `xpNeededFor` with the lifespan factor; +1 point (100 centipoints) per stat pick; level checks at match end only, ≤ 2 per match; migration carry-over below one level | core/fighters, core/save migration |
| D-Y (O25) | Offer slots: a skill every 3rd level, two every 9th; trait offer 12.5% on stream `traits` | core/fighters offers |
| D-Z (O25) | Freshness drain, rest, 80% reserve rest, threshold 60, season reset (`levels.json` freshness); Stamina's generation offset and jitter | core/fighters |
| D-AA (O25) | The `competitive-balance` entry of `SOAK_CHECKS` has `severity: 'warn'`: a violation reports status `warn`, is printed, and does not fail the soak or its exit code; every other check is hard | core/harness (`soak.ts`), `scripts/soak.ts` |
| D-AB (O25) | `levels.json` freshness.tiredDrainShare (optional, 0–1, absent means 1) multiplies a round's drain when the fighter's value at that round's start is below the threshold (compared in tenths: 599 pays half, 600 pays in full); `aiRotation.extraGapPerPointBelow` 0.45 | core/fighters (`freshness.ts`), core/ai |
| D-AC (O25) | `races.json` ashkin `injury.chanceMult` 0.82 (from 0.85) | content |
| D-AD (O25) | The store's autosave has two kinds: `week` (a finished week, a season end, a new career: first empty slot of `auto-1..3`, else the oldest; skipped when the Autosave setting is off) and `round` (overwrites `AUTOSAVE_ROUND_SLOT` = `auto-round` after every round of the player's match; ignores the setting). A ticket reproduction (`ticket-<id>` slot) writes neither | src/ui/store (`create-store.ts`), src/platform (`save-store.ts`) |
| D-AE (O25) | `Club.pauseBetweenRounds` defaults to `always`, `levelUpPacing` to `detailed`, `levelUpDefault` to `manual`, `autoSwap` to threshold 40 and lost-round bonus 10 (the `pacing.set` and `autoswap.set` commands change them) | core/game, core/content match defaults |

**Repository status (v0.3, as reported by the orchestrator and the module READMEs; the lead designer did not re-run them).** M1 is built and integrated on main @ f4b39d9: every work package of §9.2 merged, then the fix rounds m1/fix-perf, m1/fix-tuning, m1/fix-ui and m1/fix-core. 741 tests pass. `npm run validate-content` passes on `content/default` (42 classes, 168 abilities, 105 presets with 295 rules, 60 traits, 5 races, 48 clubs). `npm run balance` ran balance pass 1 (03 §8.2). `npm run soak` passes 11/11 checks over 10 seasons (seed `soak-1`); the 20-season run flags one dynasty (§12). Budget actuals are in §8 and the known issues in §12. **v0.4:** the QA polish round merged (polish-core: renewals until expiry, `contract.expiring`, `developmentSummary`, veterans' career lines and titles, orc durability, softer physical decline with a recalibrated retirement hazard, `SeasonRecord.wageRaises`, the key-moment interrupt fix; polish-ui: the items in 04 v0.4), and main is tagged `m1-season-mvp` @ 3e682d5.

**Repository status (v0.6, re-run by the lead designer for this sync on main @ 293f49a).** `vitest run`: 79 files, 1,093 tests pass in 84 s. `npm run soak -- --seasons 10` (seed `soak-1`): 14/14 checks pass (13 hard checks and the warning-level competitive-balance) in 82 s including the determinism replay; the 20-season run takes 165 s and gives 12 pass, 1 warn (the dynasty flag) and 1 fail (age-distribution in season 11, §12 KI-17). `npm run balance -- --fights 20000` (random-draft, seed `balance-1`) and `--mode fatigue` ran as reported in 03 §8.2 and §8.6; `--mode squad-match` crashes while printing (§12 KI-18), and `--mode perk-impact` and `--mode rank-impact` (1,000 rounds per item) flag only Last Wall (§12 KI-19). `npm run bench -- --seasons 10 --player` gave the actuals of §8. A production build (written outside `dist/`) has about 204 kB gzip of startup JS and an 83 kB content chunk. The M1.1 code review (no blocker, 7 minor, all fixed or documented) and the QA playtest are recorded in 01 §8.5.

**Repository status (v0.7).** Main is @ d440107 (M1.1 plus the R002 fixes: core 15f16ce, UI 12ef36a). This documents-only sync did not re-run the suite or the soak, so the figures above stay the last measured (main @ 293f49a). The R002 commits added tests (next-season room, effective rating, report box lines, squad swap, between-round and box-score screens) and changed no content, no event hash, no golden and not `ENGINE_VERSION` (still 2); the save schema gained optional fields only, so its version is unchanged (§9.3).

## 1. Implementation mandate and freedom

**Required outcome:** the M1 first-playable finish line of 01 §5 (O14): from a clean launch, start a career, pick a club, manage the roster (free agents, contracts, a lineup of 5, captain, one tactics preset per fighter), play 16 matches through headless simulation and match reports (O12), play or be eliminated from the 3-round Reckoning of 8 (O9), see the full season-end processing (aging, development, retirements, contract expiries, rookies, promotion/relegation), start the next season, save, quit, reload into exactly the saved state and continue, without developer intervention. It includes 42 classes with abilities (O8), races and aging (O11), XP and progression, injuries, traits (O5), captains (O6), wages, budgets, revenue and prize money (O10), AI clubs and good UI (O13), the M1 training emphasis (D-A), lineup chemistry (D-D) and pacing presets (D-L).

**Fixed constraints:**
- REQUIRED (T2): TypeScript + Vite.
- REQUIRED (T3): HTML/CSS management UI, layered over or alongside a canvas.
- REQUIRED (T4): the simulation is pure TypeScript, has no PixiJS (or DOM) imports, is strictly separate from rendering, and is deterministic with a seeded RNG (replays, headless AI-vs-AI matches, unit tests).
- REQUIRED (T1): PixiJS v8 renders the arena from M2 (installed and pinned, `pixi.js` ^8.22; unused in M1).
- REQUIRED (T5): theme content lives in `content/<theme>/*.json`; no theme strings in code.
- REQUIRED (T6): desktop packaging for Steam in M7; wrapper choice is open-017 (§8).
- REQUIRED (V1): unit tests for the sim and tactics; balance checked by headless simulation of many matches.
- REQUIRED (R7): save/load in M1.
- PROPOSED (P-15): offline-first, premium; no network, account or server at runtime.
- Target: Windows PC with keyboard and mouse first (Steam); runs in a current Chromium browser for development. Screen sizes and input rules are owned by 04.
- Licensing: runtime dependencies MIT/BSD/ISC-style and bundled (Preact, @preact/signals, zod, pixi.js: all MIT). No CDN at runtime.

**Implementer may choose:** internal data structures and algorithms; file layout inside a module; libraries within §2 (new dependencies need architect approval); performance techniques (Web Workers, caching, typed arrays inside the sim) while the contracts of §3 and determinism of §6 hold; test structure; UI component internals within 04.

**Requires a design decision (G1):** any change to player-visible rules, numbers outside documented TUNABLE bounds, the information a screen shows, screen flow, content scope, randomness exposure, the determinism promise (§6), save compatibility (§5), a lighter "distant league" resolver (open-015), or any runtime network feature.

**Selection criteria for replaceable technology** (in order): 1. determinism and testability of the core (T4, V1); 2. offline, self-contained, small bundle (P-15); 3. parallel-agent friendliness (typed contracts, enforceable boundaries, mainstream tools); 4. productivity for many data-heavy screens with good UI (O13); 5. portability to a desktop wrapper and Steam (T6); 6. performance headroom at M6 scale with the full sim everywhere.

**Technology decisions:**

| ID | Decision | Why | Rejected alternatives |
| --- | --- | --- | --- |
| tech-001 | **TypeScript 6.0** (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`), **Vite 8**, ES modules, `base: './'` | T2; strict settings catch agent mistakes early | TypeScript 7 native compiler (typescript-eslint does not support it yet; revisit in M7) |
| tech-002 | **UI: Preact 10 + @preact/signals**, a small hash router, the UI designer's global BEM CSS | See "UI approach" | Lit, Svelte 5, Solid, React 19, vanilla templates |
| tech-003 | **Content and save validation: zod 4**; content types inferred from the schemas | One definition for validation and types; path-precise errors | Hand-written validators; JSON Schema + ajv |
| tech-004 | **Tests: Vitest 5** (projects `core` in Node, `ui` in happy-dom with @testing-library/preact); CLIs with **tsx** | One runner, Vite transforms | Jest, vite-node |
| tech-005 | **ESLint 10 + typescript-eslint 8** mirroring the purity rules | Editor feedback; the test is the authority | — |
| tech-006 | **PRNG: sfc32** seeded by **cyrb128** of a derivation path; named substreams; integer math | Same numbers in every JS engine; order-independent streams | xoshiro128**, Mulberry32, `Math.random` |
| tech-007 | **One immutable, JSON-safe `GameState`**; transitions via `produce()` (JSON clone, mutate draft, return); dev builds deep-freeze committed states | Single owner, atomic commits, trivial saves | Immer, mutable stores, ECS |
| tech-008 | **Saves:** versioned JSON envelope; IndexedDB + `.json` export/import in the browser; files in the desktop build | R7; offline; inspectable | localStorage only |
| tech-009 | **Arena viewer (M2):** PixiJS v8 in `src/render`, lazy-loaded; replays event streams, never simulates | T1, T4 | Rendering in the sim |
| tech-010 | **Desktop wrapper (M7): recommend Electron** after a spike; owner decides (open-017) | §8 | Tauri (fallback) |
| tech-011 | **Concurrency:** core on the main thread behind async store actions in M1; move to a Web Worker if the week budget (§8) fails | Simplest correct start; core is worker-safe | Worker from day one |
| tech-012 | **Identity ids:** clubs use clubs.json ids; competitions and fixtures use identity strings (`lg:<season>:<tier>:<week>:<home>:<away>`, `rk:<season>:<tier>:<round>:<slot>`); fighters and news are allocated (`f-12`) | Match seeds derive from what a fixture is (P-05, 03 §1); readable saves | Allocation counters for everything |
| tech-013 | **Contract-first parallel build:** every module's `index.ts` declares its typed API with stubs (`notImplemented`), and `core/testkit` provides frozen fixtures, so packages compile and test against each other before any implementation lands | Seven agents in separate worktrees without shared-file conflicts | Sequential build; shared WIP branches |
| tech-014 | **Integer sim units:** positions in mm inside the sim (cm in events and content), HP in points, damage in centipoints, focus in millipoints, probabilities and accumulators in basis points; `chanceBp` for rolls | Bit-identical across engines (03 §1; D-E) | Floating-point physics |

### UI approach (tech-002)

The game is dozens of data-heavy screens (rosters, fighter pages, market, standings, finances, match reports; a rule editor in M3) over a frequently replaced immutable `GameState`. Requirements: small, offline, easy to test, typed templates, and it must use the UI designer's global stylesheet (`tokens.css`, `base.css`, `components.css`) as-is.

**Choice: Preact 10 + @preact/signals.**
- **Small and offline:** Preact is about 4 KB gzip and signals about 2 KB, all bundled.
- **Uses the designer's CSS directly:** components render into the light DOM, so `.panel`, `.data-table`, `.btn--primary` apply as written. Lit's shadow DOM would block these global styles.
- **Typed templates:** JSX is checked by `tsc` (props, handlers, missing fields); string templates and separate compilers check less.
- **Fine-grained updates for big tables:** `signal<GameState>` plus `computed()` views re-render only what changed.
- **Agent-friendly:** the React-style API is the best-known UI model among coding agents; Solid's look-alike JSX has different reactivity rules that cause subtle bugs.
- **Easy to test:** @testing-library/preact on happy-dom in Vitest (`src/ui/app/*.test.tsx`).
- React 19 would also work at about 10x the runtime size.

Supporting choices: a hash router (`src/ui/app/routes.ts`, every M1 screen pre-registered and lazy-loaded); a home-grown `DataTable`; UI copy in text tables (`t(key)`), theme names from content; locale formatting only in `src/ui/format`.

## 2. Programming guidelines

| Proposed principle | Why it helps | Project decision / exceptions |
| --- | --- | --- |
| Keep gameplay rules independently testable from presentation where practical | Makes rules portable and discrepancies easier to diagnose | **Adopt, strengthened (T4).** All rules live in `src/core`, compiled with the ECMAScript lib only (`tsconfig.core.json`) and checked by `tests/architecture` and ESLint |
| Give each piece of mutable state one authoritative owner | Prevents conflicting copies and inconsistent outcomes | **Adopt.** `GameState` is the only authority; per-part writers in §3.2. Stats, rating, captaincy, standings, wage bill and roster are derived, never stored |
| Separate inspection / preview from state-changing operations | Prevents read-only UI from accidentally changing play | **Adopt.** Only `createWorld`, `applyCommand`, `advanceWeek` and `runSeasonEnd` change state; the UI dispatches `Command`s through the store; views are pure functions |
| Express variable content and tuning as validated data where useful | Supports consistent authoring and iteration | **Adopt (T5).** All names and numbers live in content JSON, validated at load (§4). An unavoidable engine constant is named `PROVISIONAL_*` with an OPEN note and a content request |
| Prefer small explicit interfaces over speculative frameworks | Keeps the current milestone understandable | **Adopt.** One `index.ts` per module; no deep imports; no DI, event buses or ECS |
| Report invalid data and failed operations with actionable context | Makes authoring and debugging reliable | **Adopt.** `Result<T, EngineError>` for expected failures (`code`, `message`, `details`); `ContentIssue { file, path, message }` collected in full; `SaveError` codes; `throw` only for broken invariants |
| Keep debug information separate from the player experience | Preserves intentional information and presentation | **Adopt.** Seeds, hashes, timings and dumps only in the debug overlay (dev or `?debug=1`) and dump files; no `console` in core |
| Test observable contracts rather than mirroring private implementation | Allows refactoring without weakening behavioral verification | **Adopt.** Tests target module APIs and observable outputs; golden values only for frozen algorithms and the worked examples of the 03 drafts |

**Determinism rules for `src/core` (implements T4, P-05; checked by `tests/architecture`):** no `Math.random`, `Date`, `performance`, timers, `crypto`, `console`, `process`, DOM or Node APIs, `globalThis`; no `Math.sin/cos/tan/atan2/exp/log/pow/hypot/cbrt` or `**` (use integer math, `Math.sqrt`, `core/util/math`; retirement hazards come from content tables, never `Math.pow`); integer units per tech-014; each formula rounds once at its end toward zero (03 §1); no `localeCompare`/`Intl`; total-order sorting with an id tie-break; iteration in defined orders only; the only npm package in core is `zod`.

**Project expectations:** the 01 §7 vocabulary in identifiers, data keys and UI text (fight, round, match, fixture, matchweek, lineup, side, starting row, downed, rule, rule list, stance, preset, captain, gold, wage, rookie; never "team", "bout", "gambit", "kill" or "death"); files `kebab-case.ts`, components `PascalCase.tsx`; comments explain intent and units and cite design IDs; new npm packages need architect approval; 2-space formatting as in the existing files; `npm run check` before every merge.

## 3. System responsibilities and state ownership

### 3.1 Modules and dependency direction

| Responsibility (folder) | Owner | Owns | Reads | Produces | Must not do |
| --- | --- | --- | --- | --- | --- |
| Foundation: `core/util`, `core/rng`, `core/model`, `core/content`, `core/testkit` | architect | helpers, PRNG, engine types, content schemas, validator, fixtures | content JSON (passed in) | `ContentDB`, types, fixtures | contain game rules |
| Tactics (`core/tactics`) | WP1 | rule lists, compile, evaluate with trace | content vocabulary, `BattleView` (declared here, implemented by sim) | `Decision` + skip reasons | import sim; mutate the view; random targets |
| Fight simulation (`core/sim`) | WP1 | fight state inside `simulateFight` only | `MatchInput`, `ContentDB` | `MatchOutput`, event stream, `CombatProfile` | read or write `GameState`; draw outside the round seed's purpose streams |
| Fighters (`core/fighters`) | WP2 | lifecycle fields of `Fighter`; generation | draft state, content | fighters, effective stats, rating, CQ, chemistry, retirements | touch gold, contracts or tiers |
| League (`core/league`) | WP3 | calendar steps, competitions, fixtures, brackets, tier moves, archive | content, results | fixtures, derived standings, `SeasonRecord` | store standings as authority; simulate |
| Economy (`core/economy`) | WP4 | `Club.finance`, ledger, contracts, market, prestige, fighter `clubId`/`status` for signings, releases, expiries | fighters' derived values | offers, answers, ledger entries | change a balance without a ledger entry |
| AI (`core/ai`) | WP5 | nothing persistent (`GameState.ai` memory through commands) | committed state | `Command[]` | write state; see the player's future inputs |
| Season engine (`core/game`) | WP5 | calendar, results, news, RNG counters; orchestration | commands, content | new state, `WeekReport`, `SeasonEndReport`, views | duplicate module rules; partially commit |
| Persistence (`core/save` + `src/platform`) | WP5 (core), WP6 (platform) | envelope, checksum, migrations; storage adapters | state, JSON | envelopes, validated states | repair saves silently |
| Harness (`core/harness` + `scripts/`) | WP1 balance, WP5 soak | nothing persistent | seeds, content | reports | run in the shipped game loop |
| Presentation (`src/ui`) | WP6, WP7 | view state (route, sorting, filters, selection, busy) | store signals | commands, saves | mutate `GameState`; compute rules |
| Arena viewer (`src/render`, M2) | M2 | playback state | one `FightLog` | pixels | simulate; import `core/game` or `src/ui` |

**Dependency direction** (enforced by `CORE_MODULE_DEPS` in `tests/architecture/rules.ts`):

```
util <- rng <- model <- content <- tactics <- sim
                content <- fighters <- economy
                content <- league
ai      -> tactics, fighters, league, economy (+ foundation)
save    -> util, rng, model, content
game    -> everything above except save, harness, testkit
harness -> everything in core except testkit
testkit -> util, rng, model, content; importable only from *.test.ts(x) and src/ui/debug/** (dev tooling)
src/ui       -> core module indexes, src/platform (src/render lazily in M2)
src/platform -> core module indexes; never src/ui or src/render
src/render   -> core/{util, rng, model, content, sim}; the only importer of pixi.js
```

**Ordering:** within a week step, clubs in tier level then club id order; AI clubs in that order; fixtures in `fixturesForWeek` order (tier level, then fixture id); free agents by market wage descending, then fighter id (03 §1, sys-calendar). Inside a fight, 03 §1 "Resolution order". The game-rule order of the weekly and season-end pipelines is owned by 03 sys-calendar (data: `leagues.json calendar.weekProcessingOrder` and `seasonEndOrder`).

### 3.2 State ownership inside `GameState`

| Part of `GameState` | Writer (called by core/game) | Notes |
| --- | --- | --- |
| `calendar`, `results`, `news`, `rng.counters`, `playerClubId` | game | results written once per fixture (P-05) |
| `competitions`, `fixtures`, `history`, `clubs[*].tierId`, `clubs[*].wingId`, `clubs[*].history` (league columns) | league | standings are derived |
| `fighters[*]` lifecycle fields (caps, clocks, wear, traits, statuses, injury, age, career, season, history, `finalSeason`, status `retired`), new fighters | fighters | stats never stored |
| `clubs[*].finance`, `ledger`, `market`, `fighters[*].contract/clubId/contractProfile/freeAgency`, status `active`/`free-agent`/`hired-blade`, `clubs[*].prestige` | economy | balance invariant: opening + Σ ledger |
| `clubs[*].lineup`, `captainId`, `viceCaptainId`, `shortlist`, `fighters[*].trainingEmphasis` | game (validated commands) | same validation for player and AI |
| `clubs[*].captainAtLastLock`, `captainSince`, `captainNotFieldedStreak`, `statuses` | fighters (lineup lock, weekly step) | 03 sys-captaincy |
| `ai` | game (from AI command effects) | per-club AI memory |
| `ids` | the allocating module, via `allocateId` on the draft | |
| `knowledge`, `fighters[*].academy`, `learnedAbilityIds` | reserved (M4, M5) | null / empty in M1 |

### 3.3 Operation contracts

#### Operation contract: simulate a match

- **Operation:** `simulateMatch(input: MatchInput, content: ContentDB, { record })` in core/sim (plus `simulateFight`, `combatProfile`). Pure.
- **Inputs:** `MatchInput { seed, bestOf, home: SideInput, away: SideInput }` (core/model/match.ts). `SideInput { clubId, fighters[5], captainIndex, viceCaptainIndex, chemistry }`. `FightFighterInput { fighterId, classId, raceId, row, slot, stats (management-effective integers 1–20), captainQuality, traitIds, tactics, rating, combatMods? }`. Ability ids come from the class; race, trait stat effects, statuses, chemistry and the acting-captain penalty are already inside `stats` (03 §2 boundary contract 1); the sim applies only combat-owned trait effects and the captain model.
- **Validation:** inputs come from validated state, so violations throw `InvariantError`.
- **Output:** `MatchOutput { rounds: RoundResult[], score, winner, fighterStats, mvpFighterId, logs }`. Rounds end by elimination or the time cap with the tie-break chain; matches are never drawn. Round seed `deriveSeed(matchSeed, 'round', n)`; purpose streams `phase/<unit>`, `variance/<unit>`, `react/<unit>`, `tiebreak`.
- **State changes:** none; core/game stores a `MatchResult` (with the full `input`, so a report timeline or replay can be re-simulated).
- **Repeated request behavior:** identical inputs give bit-identical outputs and event hashes; `checksum` is identical at record `none`, `summary` and `full` (T4, vis-009).
- **Failure / cancellation:** cannot hang (time cap 75 s = 1,500 ticks, PROPOSED · TUNABLE in combat.json).
- **Rule reference:** 03 sys-fight-sim, sys-match, sys-match-report, sys-abilities, sys-targeting, sys-tactics, sys-fight-traits, sys-fight-captain; P-02, P-05, P-06; T4.

#### Operation contract: season engine (advance a week)

- **Operation:** `advanceWeek(state, content): Result<{ state, report: WeekReport }, EngineError>` in core/game. Companions: `createWorld`, `applyCommand`, `getBlockers`, `runSeasonEnd`, `prepareMatchInput`, `buildMatchReport` and the views, among them `developmentSummary(state, season)` (polish round: per fighter rostered at that season end, age and rating before and after, every attribute delta, potential change, retired; stored on `SeasonRecord.development`; it feeds season review step 4).
- **Inputs:** a committed state in phase `preseason`, `regular` or `tournament`; the `ContentDB` of `state.content`.
- **Validation:** `getBlockers` must be empty for the player (lineup of 5 fit roster fighters signed before this week, roster at or under the tier cap from the Kick off commit, a club chosen, other 02 §3 blockers). A missing captain is not a blocker (D-S). AI clubs fix their lineups through commands; short-handed clubs get hired blades (open-006).
- **Pipeline** (leagues.json `calendar.weekProcessingOrder`; module calls in brackets): 1 lock and simulate every fixture of the week, the player's included (D-O) [game + sim; interim captains: game `autoCaptain` (D-S); lineup lock: fighters.lineupLock, economy.assignHiredBlades]; 2 record results and standings [league.recordResult]; 3 lifecycle weekly [fighters.applyMatchLifecycle per result, fighters.weeklyLifecycle]; 4 income [economy.weeklyIncome]; 5 costs [economy.weeklyCosts]; 6 financial status [economy.financialStatus]; 7 P1 only: unsigned trials rookies to the pool [economy.releaseTrialsRookies] (in season 1 the AI's trials signings run before step 1 of the first P1 processing, D-P); 8 free-agent decisions [economy.resolveFreeAgentOffers]; 9 AI action phase incl. next week's AI lineups [ai.planWeek -> applyCommand]; 10 pool floor top-up [economy.topUpFreeAgentPool]; 11 advance the calendar (`league.nextCalendar`; at the end of the regular season `league.seedReckonings`), digest; the UI store then autosaves, and only after the autosave opens the player's match report (D-O).
- **State changes:** one atomic commit; the input is never mutated.
- **Repeated request behavior:** pure; the store's busy flag prevents double advances.
- **Failure / cancellation:** `err(...)` and no state; autosave only after success.
- **Season end:** `runSeasonEnd` (phase `season-end`) follows `calendar.seasonEndOrder`: placings and titles [league.archiveSeason]; prizes [economy.seasonPrizes]; promotion/relegation [league.promotionRelegation, applyTierMoves]; prestige [economy.updatePrestige]; (M5 academy); aging and development [fighters.seasonEndDevelopment]; retirements [fighters.seasonEndRetirements]; contract expiries [economy.contractExpiries]; off-season recovery [fighters.offseasonRecovery]; (M4, M6 steps); pool maintenance [economy.poolMaintenance]; next-season setup [league.setupSeason, fighters.generateRookies, economy.nextSeasonFinanceSetup]; AI phase [ai.planSeasonEnd]; retention [`compactHistory`, then departed fighters move to `alumni`, §5]; then the store autosaves. Returns `SeasonEndReport` (with `playerClub.wageRaises`, the player's contracts raised to the tier minimum at setup; every club's raises are on `SeasonRecord.wageRaises`). Retirements follow D-T. **Renewals until expiry** (polish round): `contract.renew` is allowed while the season-end step is pending, and the expiry step keeps a renewed contract; a `contract.expiring` news item (urgent, one per unrenewed player contract) is posted at the processing that leaves `contracts.expiryReminderWeeksBeforeEnd` (4) weeks.
- **New game:** `createWorld` (D-P): clubs → world-generation fighters inside the tier rating bands → free agents → `setupSeason(1)` → `generateRookies` (one per club) → `economy.initialFinances` (contracts at asks, bills rescaled into 80–87% of WB) → `assignTrialsRookies` → per club `ai.planRoster` through commands → `announceFinalSeasons`.
- **Rule reference:** 02 §3; 03 sys-calendar, sys-league, sys-tournament, sys-roster, sys-finance, sys-transfers, sys-ai-manager; 03 sys-calendar (both processing orders); O2, O9, O14; D-O, D-P, D-S, D-T; P-04, P-05; open-005, open-006, open-014, open-016.

#### Operation contract: save / load

- **Operation:** core/save `checksumState`, `saveMetaFor`, `createSave`, `serializeSave`, `parseSave`, `validateState`, `MIGRATIONS`; src/platform `SaveStore` (`list`, `read`, `write`, `remove`), `FileIO`, `Clock`; the UI store's `save`, `load`, `listSaves`, `deleteSave`, `exportSave`, `importSave`.
- **Validation (load):** JSON parse; `format`; `schemaVersion` not newer (`save.too-new`); checksum (`save.checksum`); stepwise migrations; structure (zod, with the array and counter bounds of `SAVE_BOUNDS`, which the content validator checks the same way) and references (`save.references`); content theme must match, a different content hash loads with a warning if every referenced content id exists (`save.content-missing` otherwise).
- **Output / state changes / repetition / failure:** as phase A: last write wins; weekly autosaves rotate over `auto-1..3` and a match waiting between rounds has its own slot, `auto-round` (O25, D-AD); atomic writes; failed loads never partially load; unreadable saves stay listed.
- **Rule reference:** R7; open-016; P-05; vis-009.

### 3.4 Data model

#### Engine and state types (implemented, `src/core/model`)

| Type | Purpose |
| --- | --- |
| `GameState` | `schemaVersion`, `content`, `rng`, `ids`, `calendar`, `options`, `playerClubId`, `clubs`, `fighters`, `competitions`, `fixtures`, `results`, `market`, `ai`, `ledger`, `news`, `history`, reserved `knowledge` (M4), `alumni` (slim records of fighters who left; `personOf`, `personName`). `STATE_SCHEMA_VERSION = 2` (v1 → v2 migration moves agreed renewals to `Contract.next`). The polish round added the optional `SeasonRecord.development` and `SeasonRecord.wageRaises` without a version bump. **M1.1: `STATE_SCHEMA_VERSION = 3`**, adding `liveMatch` and the v3 fighter, club, lineup and match fields (§9.3) |
| `GameOptions` | `trainingEmphasis` (true), `patronGoals` (false: no patron goal in M1), `retirement` (true) |
| `Calendar` | `season`, `weekIndex` (1..23, 24 during season end), `weekId` (`P1`…`TW3`), `phase` |
| `Club` | identity and colours, region/district, tier and wing, AI personality, tactics style, prestige, `ClubFinance` (balance, season and wage budgets, status healthy/watch/embargo, debt weeks, Registry debt, parachute and ascension seasons), captaincy fields, club statuses, `Lineup` (5 × `{ fighterId, row }`, match-captain override, tactics per fighter), shortlist, `ClubSeasonRow` history |
| `Fighter` | identity, race, class, origin region, age, debut; club, status (`active`, `free-agent`, `retired`, `hired-blade`, `academy`), `Contract`, greed, free-agency data; **stored lifecycle inputs** (potential roll, pace, `cap100`, `bloom`, `dev100`, `wear100`), traits (with source), statuses, `Injury`, training emphasis, final season; career totals, season counters, season history rows; reserved `learnedAbilityIds`, `academy` |
| `Competition`, `Fixture`, `Bracket`, `StandingRow` | league (with wing draw and seed order) or Reckoning (seeds, rounds, ties with `winner-of` slots); fixtures with week, stage, matchweek, wing/cross, best-of, venue; derived table rows with all tie-break fields and form |
| `MatchInput`, `SideInput`, `FightFighterInput` | sim inputs (shared contract of game and sim) |
| `MatchResult`, `RoundResult`, `FighterMatchStats`, `DownRecord` | committed result with engine version, content hash, full input, rounds (winner, end reason, tie-break step, duration, survivors, downs, final HP, checksum, event hash), per-fighter stats (03 §2 boundary contract 2), MVP, hired blades |
| `FightEvent`, `FightHeader`, `FightLog`, `RecordLevel` | the complete event union of 03 sys-match-report, summary-level set, `hashEventStream` |
| `Ledger`, `LedgerEntry`, `LEDGER_CATEGORIES`, `Gold` | current-season entries in the 16 categories of 03 sys-finance; opening balances |
| `MarketState`, `Offer`, `Negotiation`, `OfferResponse`, `AiClubMemory` | pending offers, negotiation memory, trials rookies, refusals, releases |
| `Command` | `club.choose`, `lineup.set`, `tactics.assign`, `captaincy.set`, `training.set`, `offer.make`, `offer.withdraw`, `contract.renew`, `trials.sign`, `roster.release`, `shortlist.toggle`, `news.markRead`; from M1.1 also `squad.set`, `levelup.choose`, `levelup.policy`, `match.swap` (the player's club only), `autoswap.set`, `pacing.set` |
| `SeasonRecord`, `TierSeasonRecord`, `RetirementRecord` | archive: wing and tier tables, Reckoning champion and runner-up, Shield, promotions, relegations, retirements, rookies |
| `MatchReport`, `WeekReport`, `SeasonEndReport`, `Blocker` | derived views for the UI |
| `SaveEnvelope`, `SaveMeta`, `SaveError` | versioned save with checksum and stable error codes |

#### Content types (finalized in phase B, `src/core/content`)

Each file has a zod schema in `src/core/content/schema/`; types are inferred (`ClassDef`, `AbilityDef`, `PresetDef`, `RuleDef`, `RaceDef`, `TraitDef`, `TraitEffect`, `ClubTemplate`, `TierDef`, `CalendarWeekDef`, `TierProfile`, `AiPersonalityDef`, and the constant blocks `CombatConstants`, `DevelopmentConstants`, `EconomyConstants`, `LeaguesConfig`, `NamesConfig`). Ability effects, predicates, stat mods and triggers are recursive and written as explicit types (`Effect`, `EffectPredicate`, `StatMod`, `Trigger`, `Amount`).

| File | Content | Closed vocabularies (code-owned) |
| --- | --- | --- |
| `combat.json` | 12 stats (5 physical, 7 mental), archetypes, hybrid pairs, bands, derived-stat coefficients, timing, movement, damage, shields, CC/DR, overtime, round-end tie-breaks, match formats, captain model, trait-effect adapter, randomness streams, cone table, 34 statuses, stat-mod stats | stat ids, archetypes, hybrid pairs, affinity groups, bands, statuses (34), status categories (8), stat-mod stats (27), round tie-breaks |
| `classes.json` | 42 classes: archetypes, hybrid pair, role tags, affinity, band, row, base values, power/support attrs, rating weights, stat emphasis, kit (`basic`, `a1`, `a2`, `passive`), presets | slots |
| `abilities.json` | 168 abilities in the effect vocabulary | effect types (17), effect predicates (13), triggers (12), amount stats (10), per-sources (4), area shapes, affects, cone angles, targets, kinds, delivery types, damage types |
| `tactics-presets.json` | limits, the rule vocabulary with parameter specs, 105 presets | conditions (21), selectors (18), predicates (12), actions (6), stances (3), roles (5), parameter types |
| `races.json`, `names.json` | 5 races (lifespan, debut ages, growth/decline, tendencies, injury, class affinity, racial feature, names key); name parts per race | — |
| `traits.json` | roll rules, categories, effect types, 60 traits | trait categories (6), trait effect types (24), combat `when` keys, economy hooks |
| `development.json` | scale, time, potential bands, pace, development clocks, maturity curves, decline, XP, training, retirement, injury ladder, captaincy grades, chemistry, lifecycle statuses, generation, soak targets | injury severities, training emphases, lifecycle statuses |
| `leagues.json` | regions, tiers, generation shifts, wings, regular season, standings, the Reckoning, promotion/relegation, venues, calendar (23 weeks and both processing orders) | season phases, tournament rounds, tie-breakers, format keys |
| `clubs.json` | colour rules, 48 clubs | — |
| `economy.json` | currency, tier profiles, income, budget, wage curve, ask, negotiation, contracts, market, finance ladder, prestige, patron (unused in M1), AI personalities and constants, balance targets | ledger categories (in model) |
| `levels.json` (M1.1) | bench XP, level, XP per level (base, age and gap tables), offers and the trait offer pool, auto-pick, pacing, level ETA, Stamina, Freshness, match squad, AI rotation and substitution, hooks, migration, soak targets | pacing presets, Freshness label ids |
| `perks.json` (M1.1) | 72 perks and the rules (cap 4, at most one tier III, offer draw), extensions, tags, AI preferences | the added predicates, triggers and stat mod `fatigueResist` |
| `ability-ranks.json` (M1.1) | templates, family rules, eligibility and 168 rows (126 rankable, 252 rank steps) | rank families |

## 4. Content and authoring contract

- **Content representation:** `content/<theme>/` with the 14 files of §3.4 (11 from M1, and `levels.json`, `perks.json` and `ability-ranks.json` from M1.1); plain JSON; no executable expressions (formula strings in `_doc` or descriptive fields are documentation; the engine implements the formula named by the key). One theme per career.
- **Stable identifiers:** every entry has an `id` matching `^[a-z0-9]+([_-][a-z0-9]+)*$`, unique within its type; abilities `<classId>_<slug>`, presets `<classId>_<style>` (03 sys-abilities, sys-tactics); club ids double as engine `ClubId`s. References are by id only and validated across files. After M1 ships, ids are never renamed (saves reference them).
- **Schema / field rules:** the zod schemas are the single source of field names, types and ranges; objects are strict (unknown keys are errors); `_`-prefixed keys are designer notes, stripped from the production bundle at build (`stripDocKeysPlugin`); blocks labelled `EXAMPLE` are never read.
- **Units:** authoring units by key suffix, converted exactly to engine integers (`src/core/content/units.ts`): `…S` seconds -> ticks (× 20); `per…S` coefficients -> milliseconds; `…M` metres -> cm (sim: mm); `…Mps` -> mm per tick; `…Deg` -> cone table; `…Bp` and every number in economy.json -> integers; unsuffixed fractions -> basis points (× 10,000). Values that do not convert exactly are errors.
- **Validation (implemented):** schema per file, then cross-file rules: unique ids, closed vocabularies match the code exactly, class structure O8 (42 classes; 6 base classes per archetype; 2 hybrids per hybrid pair; archetypes match the pair; kit abilities exist, belong to the class and sit in the right slot; presets exist and belong to the class; default preset listed), abilities (slot/kind, passive block, actives with cooldown and focus, self-target never approaches, area shapes complete, `both` areas have ally effects, hard CC ≤ 2.5 s, magnitudes ≤ status caps; from M1.1 `validateM11` (13 class weights summing to 1 with Stamina exactly 0.02, rank rows whose control durations never grow at a higher rank, hard or soft, perk catalog and offer rules) and `validateSaveBounds` (content values against the shared `SAVE_BOUNDS`)), presets (rule counts and conditions per rule within limits; every condition, selector, predicate and action in the vocabulary; every parameter declared, typed, in range and on its step; required parameters present; exactly one of status/category; ONLY or PREFER not both; selector pool matches the action or the ability's target), races (tendency caps, names key), names (pattern placeholders resolvable), traits (mutual opposites, references, stat-add cap, polarity/kind), development (closed lists, scar pool, ascending curves, grade order), leagues (tier levels, club count = 2 × wing size, O2 caps 10/12/14 and academy = cap, wing and cross matchweeks cover 1..16 once, calendar indexes and phases in order, matchweeks 1..16 on regular weeks, Reckoning weeks and venues, odd best-of, calendar length = paid weeks), clubs (unique ids, codes, names and primaries; references; clubs per tier), economy (all integers, tier profiles, grant shares sum to 10,000 on existing weeks, monotonic wage curve, tier keys).
- **Profiles:** `theme` (default, every rule) and `fixture` (skips class and club counts; used by `core/testkit`).
- **Validation timing:** at app start (blocking content-error screen), on every dev-server hot reload, in `npm test` (`tests/content/default-content.test.ts`), in the CLIs, and on demand with `npm run validate-content`.
- **Invalid content behavior:** loading fails with every issue as `file › path: message`; no partial load, no fallback content.
- **Asset linkage:** M1 uses icon keys (`class_<id>`, `abl_<id>`, `st_<id>`, `arch_<id>`, trait icons) that the UI maps to the designer's icon set; a missing icon falls back to a generic glyph with a dev warning. M2 sprites are optional with placeholder shapes (T1).
- **Versioning:** each file carries `schemaVersion` (or `version` in four lifecycle files; see the change request below); the content hash is stored in `GameState`, saves and results. A changed hash with unchanged ids keeps saves loadable.
- **Authoring workflow:** edit `content/default/<file>.json` with `npm run dev` running; the app hot-reloads; `npm run validate-content` lists any issue; `npm run balance` shows class win rates.
- **Test fixtures:** `src/core/testkit/fixture-content.json` is a frozen 6-class subset regenerated by the architect with `npm run fixture:content` only when the schema changes, so value edits never break module tests.
- **External content / mods:** P-21 data-driven themes; content is data only and fully validated; Workshop FUTURE.

**Structural content change requests (for the designers; none blocks M1):**
1. `races.json`, `traits.json`, `names.json`, `development.json`: rename `version` to `schemaVersion` like the other seven files.
2. `leagues.json generationShifts.worldGenFreeAgentsPerClub` is now a resolved note string (D-C: 2.5 per club); the number lives in `development.json generation.worldGen.freeAgentsPerClub`. When convenient, keep one owner in one place.
3. `traits.json gain.event` is free text; add a closed `gain.eventId` (e.g. `tournament_round_started`, `returned_from_injury`, `scar_gained`) so the engine keys behaviour on an id instead of on the trait id.

## 5. State lifetime, saving, and recovery

| State category | Examples in this game | Lifetime / reset point | Persisted? | Authority |
| --- | --- | --- | --- | --- |
| Career state | `GameState` | new game → career deleted | yes (saves) | core/game (§3.2 per part) |
| Content | `ContentDB` | app start → exit | no; id and hash saved | core/content |
| Committed results | `MatchResult` (with full sim input) | when played → kept for the current and previous season, the previous season compacted except the player club's matches; older seasons live on as `ClubSeasonRow` history (TUNABLE (tech)); by O24 a match between other clubs is also compacted a few weeks after it is played, and the player's own matches are never trimmed during the season (`m1.1/save-trim`, not yet merged) | yes | core/game, core/league |
| Departed fighters | `alumni` (retired, career-ended, left unsigned; past hired blades) | at the season end they leave → kept as slim records; past hired blades and leavers who never played are dropped once their season leaves the window | yes | core/game |
| Fight runtime | positions, HP, cooldowns inside `simulateFight` | one call | no; M2 quit-mid-fight resumes by re-simulation to the same tick (open-016) | core/sim |
| Fight logs | event streams | built on demand from stored inputs | no | core/sim |
| View state | route, sort, filters, tab | session | optional per device (localStorage) | src/ui |
| Player settings | UI scale, theme, reduced motion, pacing preset (D-L), tooltip delay, number format | across careers | yes, separate settings record | src/ui + src/platform |
| Command log | commands since the last save | until the next save | only in state dumps | src/ui store |

- **M1.1 (§9.3):** a live match is saved at each between-round step (`liveMatch`): every completed round and decision is committed as it happens, and loading resumes on the same screen (P-05). Level-up offers are stored when generated. v2 saves migrate to v3 deterministically.
- **Save availability:** manual save on any management screen while no transition runs; autosave after every committed advance and after season end (covers open-016's week-start and post-match autosaves, because M1 commits matches inside week processing). **Commit before the report (D-O):** the store writes the autosave after the advance commits and before it opens the match report, so quitting at the report or reloading cannot change a result. 3 rotating autosave slots and 10 manual slots (TUNABLE (tech)); hardcore ironman in M7. **M1.1 autosave policy (O25, D-AD):** the weekly rotation (`auto-1..3`) writes at a week boundary only (a finished week, a season end, a new career) and the Settings toggle "Weekly autosaves" switches it; a dedicated `auto-round` slot is overwritten after every round of the player's match and always runs, because it keeps "no rerolls" true across a quit; a ticket reproduction writes neither.
- **Resume guarantee:** loading restores the exact `GameState`; advancing from it with identical inputs reproduces the original results (seeds derive from the root and fixture identity). Committed results never change.
- **Commit boundaries:** one atomic commit per transition (tech-007): results, XP, injuries, ledger, offers and the calendar move together.
- **Save identity / version, interrupted writes, invalid saves, migrations, deletion, settings:** as specified in §3.3 and phase A: versioned envelope with checksum; one IndexedDB transaction per write (temp file + rename on desktop); unreadable saves stay listed with export for support; ordered pure migrations with fixture saves; confirm dialogs for deletion; settings outside saves.
- **Size:** ≤ 3 MB after 10 seasons (TUNABLE (tech)) through compaction of results, per-season ledger summaries in `ClubSeasonRow`, news retention of two seasons and fighter history rows of about 20 integers. **Retention (schema v2):** results, fixtures and competitions of the current and previous season only, the previous season compacted except the player club's matches; fighters who left become `alumni` records (past hired blades and leavers who never played are dropped once their season leaves the window); display stats on the last two history rows of a fighter. **Measured (M1, bench-season, 10 seasons):** 2.9–3.9 MB at season end, but 4–10 MB during a season, because each full current-season result is about 13 KB. **Measured (M1.1, `npm run bench -- --seasons 10 --player`, main @ 293f49a):** 4.0 MB at the end of season 1 rising to 5.6 MB at season 10 (about 4.5 MB at season 3) and **9.3–13.5 MB during a season** (about 12 MB from season 3), because M1.1 results carry round-by-round records. M1.1 compaction (9fc9ab6) drops `reserveInputs`, `roundLineups` and `betweenRounds` from last season's matches between other clubs at each season end and keeps `fighterTotals` (about 30 bytes a fighter): about 0.6 MB a season (5.12 → 4.50 MB at the season-end step of season 3), which did not bring the save near its budget. **Decided (G1; the owner's answer to Q36, O24): option A.** AI-vs-AI results are compacted a few weeks after they are played, within the season: their detailed reports and per-match fighter logs go, and their scores, the standings and the season statistics stay. **The player's own matches are never trimmed during the season**, and the 3 MB budget stands (option B, raising it to about 14 MB, was not chosen). How many weeks "a few" is, is a build choice pending `m1.1/save-trim` (not built yet). Until that branch merges, saves are as measured above and KI-2 stays open.

## 6. Time, randomness, and reproducibility

- **Time ownership:** fight time in integer ticks of 50 ms (overtime from 45 s, hard cap 75 s; combat.json), advanced only inside `simulateFight`. Calendar time in weeks (23 per season plus the season-end step), advanced only by `advanceWeek` and `runSeasonEnd` on Continue. Wall-clock time only in `src/platform` and UI animation.
- **Update-order guarantees:** 03 §1 "Resolution order" inside fights (start-of-tick decisions, simultaneous application, home first on even ticks, away first on odd ticks, then lineup slot order); §3.1 ordering for management steps.
- **Randomness contract:** sfc32 (tech-006). Root seed per career from platform entropy at new game, stored in `GameState.rng.root`, shown only in the debug overlay. Systems draw from their own substreams: `Rng.create(root, STREAM.<name>, season, week | tier | fixture | entity, purpose)`; registered names: world, schedule, match, injury, development, aging, retirement, rookies, traits, market, ai, names, action, balance, soak, and from M1.1 migration (level-up offers use `development`, trait offers `traits`, per-round injuries `injury`). Match seed `deriveSeed(root, STREAM.match, season, fixtureId)` where `fixtureId` is the identity id; round seed `deriveSeed(matchSeed, 'round', n)`; in-fight purpose streams `phase/<unit>`, `variance/<unit>`, `react/<unit>`, `tiebreak` (combat.json). Command-triggered rolls use `STREAM.action` with `GameState.rng.counters.action`. Probabilities are basis points (`chanceBp`); bounded variance per 03 sys-fight-sim (accumulators for crit and evade, ±4% damage, 0–2 ticks reaction jitter); no random targets. Results are committed when played (P-05).
- **Reproduction needs:** a round from its seed, inputs, engine version and content hash; a week from the save before it; a bug from a state dump replayed headless.
- **Determinism scope:** same build (engine version, content hash) and inputs → bit-identical results and event streams in Node 22+, Chromium-based browsers, the desktop build and current Firefox/Safari, by integer arithmetic, frozen hash and PRNG algorithms, banned engine-dependent APIs and defined iteration order. Not promised across builds; committed results are stored, so careers are unaffected.
- **Pause / speed (M2):** presentation only; calls (P-01) become inputs at a tick.
- **Preview consistency:** no outcome forecast (P-13); the M3 sandbox uses its own stream.

## 7. Networking and shared state — optional

**N/A.** Single-player and offline (P-15). FUTURE async ghost clubs would exchange versioned JSON built on the same ids and schemas.

## 8. Performance, packaging, and diagnostics

Reference machine: **OPEN (tech)** until the owner names one (owner question Q35); working reference is a mid-range Windows laptop from 2020 or later (4 cores, 8 GB) with Node 24 and current Chromium. Thresholds are TUNABLE (tech). The actuals below (M1.1) were measured on the development machine, which has not been compared with that reference, so a pass or a miss is provisional until Q35 is answered.

| Constraint | Target conditions | Required threshold / behavior | Verification | M1.1 actual (main @ 293f49a, development machine) |
| --- | --- | --- | --- | --- |
| Fight sim | one 5v5 round, record `none` | median ≤ 2 ms, p99 ≤ 6 ms; `full` ≤ 3x; if over, raise `decisionIntervalTicks` to 4 first (03 §8.1) | `npm run balance` ms/fight; sim bench test | **1.93–1.97 ms per round median, p99 4.2–4.5 ms (two runs, record `none`): at the budget** (§12 KI-4) |
| Matchweek | 48 clubs: 24 fixtures (≈ 60 rounds) + all weekly steps incl. AI market work (≈ 48 × 150 evaluations) | ≤ 250 ms typical, hard ceiling 1 s; M6 scale ≤ 1 s; over budget → Web Worker (tech-011) | debug overlay; soak timing | median 224–255 ms per week including its autosave (above 250 ms only in season 10), maximum 259–380 ms (bench-season, 10 seasons, `--player`) |
| Season headless | 384 league + 21 Reckoning matches, season end | ≤ 10 s; 30-season soak ≤ 5 min | `npm run soak` | 4.1–4.5 s per season in the soak (4.8–5.6 s in the bench, autosaves included); 10-season soak 82 s including the determinism replay, 20 seasons 165 s |
| UI interaction | 300-row tables | screen switch ≤ 100 ms; sort ≤ 50 ms; input ≤ 50 ms; responsive during an advance | browser checks | not yet measured |
| Startup / load | content validation, save load | main menu ≤ 2 s; validation ≤ 200 ms; 10-season save load ≤ 500 ms | debug overlay | world creation 228 ms (bench); others not yet measured |
| Bundle | production build | startup JS (the entry chunk and its static imports, i.e. the modulepreload list of `dist/index.html`) ≤ 250 KB gzip, excluding lazy chunks. The content JSON is its own chunk (`src/platform/content-bundle.ts`), fetched same-origin right after the entry and awaited behind a loading state before the app mounts; it ships without its `_` documentation keys | `npm run build`; `tests/build/bundle.test.ts` fails above budget | M1: 298 kB gzip with the content inside it (the 250 KB budget was missed once M1.1 added perks and ranks). **M1.1 (m1.1/bundle): about 204 kB gzip startup JS by Vite's report (the budget test measures 202–203 kB; the sim chunk is 91 kB and the store chunk 80 kB of it); content chunk 83 kB gzip, shipped without its `_` keys and with the content hash of the source files** |
| Memory / storage | 10-season career | ≤ 400 MB (desktop); save ≤ 3 MB | task manager; overlay | **save 4.0–5.6 MB at season end and 9.3–13.5 MB in season** (about 4.5 and 12 MB at season 3): over budget (the owner chose compaction, Q36, O24; §12 KI-2); autosave 24–43 ms; memory not yet measured |
| Offline | `dist/` and desktop build | launches and plays with no network | clean launch, network off | not yet verified |

**Packaging recommendation (T6, open-017; owner decides at M7):** Electron, for one predictable Chromium/V8 engine on Windows, Linux and Steam Deck (parity with the Node/V8 tests and harness; predictable PixiJS WebGL), and mature Steamworks bindings in TypeScript (`steamworks.js`); size matters little on Steam. Tauri 2 remains a viable fallback (system webviews: WebView2 on Windows, WebKitGTK on Linux whose WebGL behaviour is less predictable; WebView2 under Proton is not a well-trodden path; `steamworks-rs` from Rust). Steam overlay support must be verified for either. M7 spike: a minimal shell of each, the M2 arena on Windows 11 and a Steam Deck; overlay, achievements, cloud saves, frame rate. Only `src/platform` differs between wrappers. **Packaging note (M1.1 bundle split):** the entry is a module script and the content is fetched with a dynamic `import()`, which fails on `file://`, so the shell must serve `dist/` over http(s) or a registered custom scheme; `base: './'` keeps the URLs relative.

- **Diagnostics:** debug overlay (backtick or `?debug=1`: season/week/phase, seed, content id and hash, versions, last advance ms, state size, last 20 commands, last error); state dump download; "copy repro" per match report (fixture id, match seed, engine version, content hash); content-error screen; crash screen with dump; `window.__arena` in dev; fixture-world loading in dev builds (`src/ui/debug`, may import core/testkit); harness reports in `reports/`.
- **Playtest tickets (F8):** F8 or the top-bar bug button on any screen takes a screenshot of the viewport (modern-screenshot, MIT, lazy chunk), the save and the metadata of that moment (route, season/week, build commit and dirty flag, engine version, content hash, viewport, theme, pacing, the last 20 commands, 50 console errors and warnings, 10 toasts), then asks for a note. Ids are `AL-R###-T###_YYYYMMDD-HHMMSS` (local time, Windows-safe): run = one per career, from the `careerId` kept in the save meta (older saves: a short hash of seed and club); R000 = no career loaded; ticket = max + 1 within the run, assigned by whoever stores it. Under `npm run dev` a dev-only Vite plugin (`scripts/tickets`, `apply: 'serve'`) writes `tickets/<id>/{screenshot.png,state.json,ticket.json}`, `tickets/index.json` and `tickets/tickets.md` (git-ignored); it accepts writes only as JSON from the same origin (403 otherwise), caps sizes (413), checks the whole PNG and never writes outside `tickets/`. Other builds keep tickets in IndexedDB (Settings › Tickets: list, delete, export). `?ticket=<id>` in dev loads the ticket's save into slot `ticket-<id>` on the same route under a banner; while such a slot is loaded no autosave is written, so the career's own saves are untouched.
- **Player versus developer information:** players see reports, recaps and finances (P-22); seeds, hashes, timings and dumps are developer-only; seeds are never shown before a match (P-05).
- **Required deliverables per milestone:** source on `main`; content; `npm run build` output; README; `npm run check` green; balance and soak reports; from M7 installers.
- **External dependencies:** Node 22.12+ and the npm registry for development only.

## 9. Build milestones

| Milestone | Player-visible outcome | Included requirement IDs / content | Dependencies | Exit criteria | Exclusions |
| --- | --- | --- | --- | --- | --- |
| **M1 Season MVP** (built at risk, tag `m1-season-mvp`) | 01 §5 finish line | R1 (headless), R4 (tiers), R6, R7, T2–T5, V1; O1–O6 (M1 parts), O8–O14; P-02–P-06, P-09 (free agents), P-10, P-11, P-17, P-18, P-20, P-22 (recap, report); D-A to D-T | owner answers to 01 §8.5 batches A and B, or their documented working assumptions; DELEGATED D-A to D-T bind meanwhile (M1 was built at risk on them; the answers are still pending, except Q36, O24) | finish line in the browser without developer help; §10 M1 rows pass; 10-season soak with no failed check; balance report delivered (designers tune outliers); §8 budgets met | viewer, editor, scouting, academy, regions/cups/transfers, difficulty, packaging, patron goals |
| **M1.1 Playtest round 1** (built at risk, tag `m1.1-playtest-r1`; the R002 fixes on main @ d440107) | 01 §5 M1.1 row: squads of 5 + 2 with swaps between rounds, Freshness and Stamina, in-season level-ups with ranks, perks and traits, bench XP | O15–O22; O23–O26; O27–O32 (R002 fixes); D-U to D-AE (confirmed, O25) | M1 (tag `m1-season-mvp`); contracts at 714cae1 | WP-A to WP-D acceptance (§9.3); 10-season soak with the orchestrator; the owner's R001 career migrates and plays (met: 14/14 soak, 1,093 tests, the QA playtest of 01 §8.5) | rule editing, viewer, perk respec |
| M2 Arena viewer | watch and replay matches at 1x/2x/4x with pause; inspector; calls; rule badges | T1; P-01, P-22; vis-003, vis-009 | M1; `full` logs | viewed result hash-identical to headless | editor |
| M3 Tactics editor | edit rules from presets; lint; library and codes; between-round edits; sandbox | R2; P-07, P-13, P-21; vis-002, vis-010 | M2; tactics rule model | newcomer edit test; tailored rules beat presets | Workshop |
| M4 Scouting | scouts, assignments, ranges, knowledge, opponent reveal | R3; O4; P-12, P-13, P-19; vis-004 | M1–M3; reserved `knowledge` | vis-004; no true-value leaks in UI | — |
| M5 Academy | enroll, progress, call-up, graduation | R5; O2, O3; vis-005 | M1; reserved `academy` | O3 rules tested; no negative-EV program | — |
| M6 Regions, cups, transfers | 3 league regions, cups, windows, deadline day, the patron with goals and job security | R4; P-08, P-09, P-10; open-007; vis-008 | M1, M4 | week budget at M6 scale with the full sim | loans |
| M7 Balance, polish, packaging | balance pass, difficulty, hardcore, season modifiers, self-hosted fonts (Q27), desktop build (pacing presets are in M1, D-L) | T6; V1; P-11, P-14, P-16; vis-007, vis-008 | M1–M6 | 30-season soak; open-017 decided; offline installer on Windows and Steam Deck | multiplayer, Workshop |

### 9.1 M1 sub-steps

| Step | Who | Exit |
| --- | --- | --- |
| M1.0 Foundation | architect (phase A) | done: scaffold, RNG, purity checks, CLIs, app shell |
| M1.1 Contracts | architect (phase B) | done: content schemas + validator, full model, every module API stubbed, testkit fixtures, route table, store contract, work packages |
| M1.2 Parallel build | WP1–WP7 in separate worktrees | each package's acceptance criteria (§9.2) with `npm run check` green on a rebase onto `main` (done: all seven merged) |
| M1.3 Integration | WP5 (integrator) with WP6 | stubs replaced as packages merge; a full season headless (soak) and in the browser (done for headless: main @ f4b39d9, 10-season soak 11/11; fix rounds fix-perf, fix-tuning, fix-ui, fix-core merged) |
| M1.4 Verification and polish | QA tester (browser), WP1 (balance), WP5 (soak), UI designer review | all M1 rows of §10 with recorded evidence (M1: balance pass 1 done, class retuning (pass 2) due; the QA re-verification of 01 §8.5 recorded; §12 known issues open) |

### 9.2 Work packages for parallel coding agents

**Ground rules (all packages).** Each package works in its own git worktree on branch `m1/wp<n>-<name>` from `main` and owns ONLY the paths listed; no two packages share a file. Module `index.ts` files are fixed contracts: implement the bodies, add new exports freely, but change or remove an existing signature only through the architect. Depend only on other modules' public APIs; while they are stubs, test against `core/testkit` fixtures or hand-built inputs (calling a stub throws `NotImplementedError`). Architect-owned (change requests only): `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `.gitignore`, `.gitattributes`, `README.md`, `src/core/{util,rng,model,content,testkit}/**`, `src/core/harness/index.ts`, `src/core/harness/README.md`, `tests/**`, `scripts/lib/**`, `scripts/validate-content.ts`, `scripts/make-fixture-content.ts`, this document. Designer-owned (read only): `docs/design/**` except this file, `content/**`, `src/ui/styles/**`, `docs/design/mockups/**`.

**WP1 — Combat: tactics + sim + balance harness**
- **Owns:** `src/core/tactics/**`, `src/core/sim/**`, `src/core/harness/balance.ts`, `src/core/harness/balance.test.ts`, `scripts/balance.ts`.
- **Implements:** `resolveTactics`, `presetsForClass`, `defaultTactics`, `compileTactics`, `evaluateTactics`, `describeRule` (and the `BattleView` the sim provides); `simulateMatch`, `simulateFight`, `combatProfile`, `ENGINE_VERSION`; `runBalance` for modes `random-draft`, `mirror`, `preset-vs-default`.
- **Depends on:** content, model, rng, util (done). No other module.
- **Tests:** every condition, selector, predicate and action with its parameters; first-valid-wins, NOT, ONLY vs PREFER, rule cooldowns, stance fallback, trace skip reasons; targeting tie-breaks; each of the 17 effect types and 34 statuses (DR chain, stacking, sleep, taunt, guard, riposte, deathward, anchored, illuminated); damage and healing pipelines incl. the Behead worked example (315); overtime, time cap and the five-step tie-break chain; simultaneous downs; captain aura, rally, Shaken and handover; combat trait effects; the 03-combat §9 acceptance cases; determinism (3 runs → equal event hash; `checksum` equal at all record levels; a pinned golden hash for one fixture match); every one of the 105 presets compiles and every class fights; a bench (median per round).
- **Acceptance:** all tests green; `npm run balance -- --fights 5000` runs real fights on `content/default` within the §8 budget, and its report (with outliers, if any) is delivered to the combat designer.
- **Must not touch:** fighters, league, economy, ai, game, ui; `content/**` (request value changes from designers).

**WP2 — Fighters (lifecycle)**
- **Owns:** `src/core/fighters/**`.
- **Implements:** `createFighter`, `generateName`, `humanAge100`, `effectiveStats`, `rating`, `potential`, `captaincy`, `lineupChemistry`, `isFit`, `injuryChanceBp`, `retirementChanceBp`, `trend`, `lineupLock`, `applyMatchLifecycle`, `weeklyLifecycle`, `seasonEndDevelopment`, `seasonEndRetirements`, `offseasonRecovery`, `generateRookies`, `announceFinalSeasons`.
- **Depends on:** content, model, rng, util. Uses `buildFixtureWorld` and hand-made `MatchResult`s.
- **Tests:** the 03-fighter-lifecycle §9 acceptance table; generation within content ranges and deterministic per seed; names unique and blocklisted; `effectiveStats` composition (caps × maturity − wear, race tendency, trait adds ≤ 3, statuses, context stats, chemistry ÷ 2 on composure); rating identical to the combat formula; aging per race with mental decline scaling by lifespan; 0 XP and 0 development for a fighter who started no rounds; training emphasis routes only earned growth; injury odds and severity (seeded Monte Carlo against soak bands); trait rolls (≈ 80/20, caps, opposites, exclusive groups); captaincy CQ, grades and strip rules; chemistry only from trait and captain modifiers; retirement ages per race.
- **Acceptance:** tests green; a seeded 20-season population script in the test suite stays within `development.json soakTargets` bands for age and population (without matches: usage at the configured floor).
- **Must not touch:** gold, contracts or tiers (economy, league), any other module.

**WP3 — League + calendar**
- **Owns:** `src/core/league/**`.
- **Implements:** `weekDef`, `nextCalendar`, `seasonStartCalendar`, `setupSeason`, `fixturesForWeek`, `clubFixture`, `clubSchedule`, `recordResult`, `standings`, `leagueCompetitionOf`, `seedReckonings`, `reckoningStage`, `promotionRelegation`, `applyTierMoves`, `archiveSeason`, `compactHistory`, `leagueRecords`, `competitionFixtures`.
- **Depends on:** content, model, rng, util. Uses `buildFixtureWorld` and hand-made results.
- **Tests:** serpentine wing draw (season 1 by start prestige; later by relegated/stayed/promoted); 16 matches per club, 8 home and 8 away, no byes, one match per club per week, cross-wing weeks and pairings, mirrored second half; identity fixture ids; points 3/2/1/0 and the full tie-break chain incl. the head-to-head condition and the seeded lot; Reckoning seeding (wing winners 1–2), QF pairs, hosts, best-of-3 and best-of-5 final at the neutral venue, bracket progression; promotion (Reckoning champion + Shield, next best if the same club) and relegation (8th per wing) for 3 tiers; calendar phase transitions; archive; the 03-league-economy §9 league cases.
- **Acceptance:** tests green; a full fixture list for all 48 clubs generated deterministically in < 50 ms.
- **Must not touch:** results storage (game), gold (economy), other modules.

**WP4 — Economy + market**
- **Owns:** `src/core/economy/**`.
- **Implements:** every function in `core/economy/index.ts` (ledger `post`, wage bill, market wage, ask, `checkOffer`, `financeView`, offers, renewals, trials, releases, hired blades, weekly income/costs/status, offer resolution, pool top-up, prizes, prestige, expiries, pool maintenance, next-season finance setup, initial finances, greed).
- **Depends on:** content, model, rng, util; fighters' derived values (`rating`, `potential`, `humanAge100`, `isFit`) and `createFighter` for journeymen and hired blades (stubs until WP2 lands: test with fighters built by `makeFixtureFighter` and test doubles behind a small internal adapter).
- **Tests:** ledger invariant after every operation; integer rounding rules (floor to 5 / 10); the Banner worked example (SB 85,008, WB 3,257); asks with every adjustment; commitment rule and signing-cost check at submission and resolution; offer resolution order and tie-breakers; counters and patience; renewals only in the final season; release payout and cap relief; embargo ladder and Registry advance; prizes, parachute, promotion grant, drop clause, tier-minimum raise; pool floor and leaving; the 03-league-economy §9 economy cases.
- **Acceptance:** tests green; a 1-season finance simulation over the fixture world keeps the ledger invariant and matches the tier money flows of 03-league-economy §8 within ±5%.
- **Must not touch:** lifecycle fields of fighters, league structures, other modules.

**WP5 — Game loop: AI + season engine + save + soak (integrator)**
- **Owns:** `src/core/ai/**`, `src/core/game/**`, `src/core/save/**`, `src/core/harness/soak.ts`, `src/core/harness/soak.test.ts`, `scripts/soak.ts`, `scripts/replay.ts` (new, optional).
- **Implements:** AI `planWeek`, `planSeasonEnd`, `chooseLineup`, `valueFighter`; game `createWorld`, `applyCommand` (all 12 commands, same validation for AI and player), `getBlockers`, `advanceWeek`, `runSeasonEnd`, `prepareMatchInput`, `buildMatchReport` (timeline re-simulated at `summary`), `roster`, `fighterView`, `freeAgents`, `suggestLineup`; save `saveMetaFor`, `createSave`, `serializeSave`, `parseSave`, `validateState`, migrations; `runSoak` with every `SOAK_CHECKS` entry.
- **Depends on:** every other core module's API (stubs first; integrates each package as it merges).
- **Tests:** command validation and error codes; blockers; pipeline order (spy on module calls); the same seed twice → identical state checksum after a full season; save → load → advance equals advance; parse errors for every `SaveError` code; AI acts only through commands and always fields a legal lineup; soak checks individually.
- **Acceptance:** `npm run soak -- --seasons 10` passes every check on `content/default`; a season runs within the §8 budget; the state-dump replay reproduces a week.
- **Must not touch:** module internals of WP1–WP4 (request API changes), UI.

**WP6 — UI foundation: app shell, store, platform, components, Home, Squad, Fighter, Codex**
- **Owns:** `src/main.ts`, `index.html`, `src/platform/**`, `src/ui/app/**` (route ids and paths stay stable), `src/ui/store/**`, `src/ui/components/**`, `src/ui/format/**`, `src/ui/text/**`, `src/ui/debug/**`, and screens `src/ui/screens/{home,new-game,club-select,squad,fighter,codex}/**`.
- **Implements:** the app frame (topbar, sidenav, router, error boundary, content-error screen, keyboard shortcuts); `createGameStore` behind the fixed `GameStore` contract (signals, dispatch, busy-guarded advance, autosave rotation, dev freeze, command log, `window.__arena`); platform `SaveStore` on IndexedDB, `FileIO`, `Clock`, entropy; components (DataTable, Panel, PageHeader, StatBar, Tag, Money, FighterName, ClassTag, Modal, Toast, Tabs, ConfirmButton) with a dev gallery; debug overlay, state dump and a dev-only fixture world; the six screens (Squad covers lineup of 5, rows, captain and vice-captain, preset per fighter and training emphasis).
- **Depends on:** the store contract, core/game views and commands (stubs: use the testkit fixture world in tests and the dev fixture world in the browser), designer CSS.
- **Tests:** component tests; store tests with a fake platform (busy guard, error mapping, autosave rotation, load errors); screen tests with `buildFixtureWorld`; routes test.
- **Acceptance:** tests green; in the browser (`arena-league-dev`) the app frame, the six screens and the debug overlay render the fixture world with the designer's styles at 1280×720 and 1920×1080, keyboard reachable; the UI designer reviews the components.
- **Must not touch:** `src/ui/styles/**`, WP7 screen folders, core.

**WP7 — UI screens: League/bracket, Fixtures, Match report, Market, Finances, Season review, Saves/Load, Settings**
- **Owns:** `src/ui/screens/{league,fixtures,match-report,market,finances,season-review,saves,settings}/**`.
- **Implements:** wing and tier tables and the Reckoning bracket; fixtures by week; the match report (score, rounds, timeline, per-fighter recaps with rule-fire bars and never-fired warnings, death summaries, aftermath); market (free agents, asks, offer dialog with wage room and signing cost, renewals, trials rookies, shortlist); finances (balance, SB parts, WB bar, ledger by category and week, status and reasons); season review; save/load/export/import/delete; settings (UI scale, theme, reduced motion, autosave).
- **Depends on:** `useStore()` (fixed contract), core views (`league.standings`, `game.buildMatchReport`, `economy.financeView`, `game.fighterView`, `game.freeAgents`), components from WP6 as they land (until then the designer's CSS classes directly).
- **Tests:** each screen renders the fixture world and the empty states through a fake store; actions dispatch the right commands; save dialogs handle each `SaveError` code.
- **Acceptance:** tests green; screens render in the browser with fixture data; the UI designer reviews them.
- **Must not touch:** `src/ui/app/**`, `src/ui/store/**`, `src/ui/components/**`, other screen folders, core.

**Merge and integration protocol.** Packages merge to `main` in any order once green after a rebase (no shared files, so merges are conflict-free). Stubs stay until their package merges; WP5 replaces its test doubles with real modules as they land. Shared-file changes are made by the architect directly on `main` and announced to all packages, who rebase. The integrator (WP5) runs the full soak and the browser season after each merge from M1.3.

**Highest-risk assumptions to prove early:** presets produce attributable, non-degenerate fights (WP1 balance and detectors, end of M1.2); the full sim everywhere fits the week budget (WP1 bench + WP5 timing); determinism across Node and Chromium (golden hash in both); economy and population health over many seasons (WP2 population test, WP4 finance test, WP5 soak); UI throughput and click count (WP6 DataTable, routine-week audit); seven parallel packages integrate (contracts, architecture tests, one integrator).

**Scope change rule:** the owner approves additions, tradeoffs and deferrals (G1), through the lead designer for anything player-visible. The architect changes `tech-` decisions and contracts and records each change here. Coding agents propose changes in their reports.

### 9.3 M1.1 "Playtest round 1": contracts and work packages

**Status:** the architect's M1.1 addendum, [`_drafts/05-technical-m1.1.md`](_drafts/05-technical-m1.1.md) (2026-10-26), is merged here **by reference**: like §9.2 it is the text coding agents execute against, so it is not reworded, and where this summary and the addendum differ, the addendum governs for code. Design sources: 03 (merged in v0.5 from `_drafts/m1.1/progression.md` v0.2 and `_drafts/m1.1/combat-skills.md` v0.2, and re-derived in v0.6); content in `content/default` (`levels.json`, `perks.json`, `ability-ranks.json`, and the M1.1 additions to `combat.json`, `classes.json`, `races.json`, `development.json`, `traits.json`). Owner decisions O15–O22 (and O23–O32) are REQUIRED, and so are D-U to D-AE, which the owner confirmed (O25; 01 §8.2). **As built (v0.6):** WP-A to WP-D, the tuning branches (m1.1/tune-combat, m1.1/tune-life), m1.1/bundle and the QA fix branches are all merged on main @ 293f49a (tag `m1.1-playtest-r1`); the text below keeps the addendum and adds what the build changed.

**Contracts phase (done, main @ 714cae1):** the new content files and their zod schemas and cross-file validation (`validateM11`); closed lists `STAT_IDS` += `stamina`, `STAT_MOD_STATS` += `fatigueResist`, three predicates, two triggers, trigger `if` and `slot`, aura `requires`; **model v3** (Fighter: `train100`, `level`, `xpIntoLevel`, `xpNeeded`, `pendingLevelUps` (≤ 3), `levelUpMode`, `abilityRanks`, `perkIds`, `freshness10`, season counters; Club: `levelUpDefault`, `levelUpPacing`, `autoSwap`, `pauseBetweenRounds`; Lineup `reserves`; `MatchState`; `GameState.liveMatch`); the commands `squad.set`, `levelup.choose`, `levelup.policy`, `match.swap`, `autoswap.set`, `pacing.set`; the engine entry points `advance`, `betweenRoundView`, `levelUpView`; the save migration v2 → v3 (implemented); helpers for levels, Freshness reads, `simulateRound` at defaults (bit-identical to `simulateFight`), swap legality `checkSwaps` and `roundInputOf`; typed stubs for everything else. Until the work packages land the game still plays the M1 way.

**Technical decisions recorded in the addendum (A4):**
- **Lost-round bonus adopted** (+10 to the auto-swap threshold for the side that lost the round just played; an `AutoSwapRules` field for every club, AI and player alike; O25, D-V).
- **Compact match records:** instead of a full RoundInput per round (about 5 KB each), a result stores the lock-time inputs once (`input` for the round-1 five, `reserveInputs` for the others) plus a small per-side, per-round lineup record; `roundInputOf(result, round)` rebuilds the exact input, and replays never run a policy. New `MatchResult` fields are optional, so M1 results stay valid.
- **Migration v3:** deterministic (`Rng(root, 'migration', 'm1.1', fighterId, purpose)`); `train100` = the M1 developed value; Stamina rolled (cap from P × 20, class offset, race tendency, +2.5, ±3 jitter; wear = the fighter's `str` wear); the peak rating shifts with the reweight; level from the formula; `xpIntoLevel = min(season XP, xpNeeded − 1)`; no pending level-ups; Freshness 100. On the owner's R001 saves: every shown stat except Stamina unchanged, byte-identical twice, 100–175 ms; level median 46, Stamina median 12. Expect many level-ups at the first match end after loading a mid-season save (O25, D-X). The initial level in this migration follows the build's level counter, which the owner's wording on levels (O23) may change: 01 open-034, Q52.
- Six `development.json` keys that M1 code still reads (usage floor, emphasis bonus and penalty, body wear reduction, max delta, trend) were removed after WP-B and WP-D landed (27d1286; `FighterView.trend` dropped). `stamina` takes sim attribute index 12 with no formula; `fatigueResist` index 27. The validator requires 13 class weights summing to 1 with Stamina exactly 0.02. sw-007 is implemented lowest Freshness first (03 §9.4).
- `core/save` may now import `core/fighters` (the migration uses lifecycle code); new RNG stream `migration`.
- **Changes made after the work packages (as built):** (1) *Tuning:* m1.1/tune-combat and m1.1/tune-life (01 change record v0.6; 03 §8.2, §8.6). (2) *Hardened rules:* `SAVE_BOUNDS` (`core/content/save-bounds.ts`) feeds the strict save schema and the content validator; the rank validator compares hard and soft control durations; `match.swap` is accepted for the player's club only and the player's between-round view blanks the opponent's suggestions. (3) *Compaction:* `compactedResult` drops `reserveInputs`, `roundLineups` and `betweenRounds`, slims the squads and keeps `fighterTotals`; `timelineOf` finds an emergency entrant's side from the swap lines or round lineups, so results compacted by the earlier build attribute him too. (4) *Report:* `ReportSide.appearedIds` and `unusedReserveIds`, `MatchReport.totals` and `bench`, `aftermath.benchXp`, `FighterRecap.role` and `roundsStarted`, `MatchReport.compacted`, and the `perk.proc` summary event with its report kind. (5) *Soak:* the checks `freshness-rotation`, `level-ups` and `match-squads`, `competitive-balance` at warning level (O25, D-AA), the level-ups cohort gate and the age-matched bench ratio. (6) *Build:* the content chunk and the stripped doc keys (§8). (7) *Store:* the autosave policy (O25, D-AD). (8) *R002 playtest fixes* (O27–O32; core 15f16ce, UI 12ef36a; merged on main @ d440107): **box score** (O27): the sim counts `Tally.healingReceived` (effective healing, overheal excluded; in no event and not in the round checksum, so no hash or golden moved and `ENGINE_VERSION` stays 2), which becomes the optional `FighterMatchStats.healingReceived`; `buildMatchReport` adds `FighterRecap.box` (match totals, `roundsStarted`, Freshness before and after, a line per re-simulated round), `ReportRound.totals` and `ReportTotals.healingReceived`; `RoundSideLineup.freshnessAfter` (optional) is written after each round's drain. **Effective rating** (O28, O30): core/fighters `ratingAtFreshness` prices the sim's penalty curve at the class rating weights (display only) and surfaces as `FighterView.freshness`, `effectiveRating`, `freshnessRatingDelta` and `freshnessRating`. **Next-season wage room** (O32): core/economy `nextSeasonWage` (projected wage budget, continuing, agreed renewals, pending offers, commitments, room, expiring) with `FinanceView.nextSeason` and `nextSeasonWageRoom`, `OfferCheck.basis` and the `basis` in `budget.wage` details; it is applied inside `evaluateOffer` to renewals and to signings that start next season, so every club's commands pass through the same rule. **True swap** (O29): the UI sends `squad.set` of the five and the reserves (`swapReserves`, `src/ui/store/actions.ts`); the R1/R2 markers (O31) and the between-round and report tables are UI only. Every new report, match and save field is optional, so older saves load unchanged and `STATE_SCHEMA_VERSION` is not bumped (the precedent is `roundDamageTaken`). The AI's own renewal budget was left on the current bill after budgeting it on next-season commitments failed two soak checks (01 open-033).

**Work packages** (ground rules as §9.2; one worktree per package on `m1.1/wp-<x>-<name>`; architect-owned: content integration, `src/core/content/**`, `src/core/model/**`, `src/core/testkit/**`, `tests/**`, `src/core/rng/**`; designer-owned: `docs/design/**` except 05, `src/ui/styles/**`):

| Package | Owns | Implements | Acceptance |
| --- | --- | --- | --- |
| **WP-A** Combat | `src/core/tactics/**`, `src/core/sim/**`, the balance harness and script | Freshness penalty at round build; ability ranks; up to 4 perk passive blocks and the sim extensions; `aftermath.largestHit`; fight-start unit data; Tired/Spent tags; harness modes `progression`, `perk-impact`, `rank-impact`, `fatigue` (and `squad-match` after WP-C) | 03 §9.4 rk-, fr-, pk-, st-001; defaults bit-identical to `simulateFight`; fatigue targets met or reported |
| **WP-B** Fighters | `src/core/fighters/**` | Effective stats from `train100` and no season-end growth (step 6 becomes Aging); round and bench XP; level-ups at match end (≤ 2) and stored offers; queue and resolution; auto-pick; Freshness drain, between-round gains, weekly rest, season reset; injury multiplier and immediate injuries; Stamina generation; Losing the Room rest exemption | 03 §9.4 bxp-, lvl-, frs-, inj-010, cap-012, chem-003, sta-; population test inside `levels.json` soakTargets |
| **WP-C** Game (integrator) | `src/core/game/**`, `src/core/ai/**`, `src/core/save/**`, the soak harness and script | The round-by-round orchestrator; auto-swap with `AutoSwapRules`; blind decisions applied home then away; records; the week split at the player's match (`liveMatch`, `advance` resumes; commit per round); level-up commands; match-end progression; AI squads, rotation and auto-pick; `levelUpView`; report lineups and swap timeline; new soak checks | 03 §9.4 sw-001 to sw-009, ai-001 to ai-004; resume on the between-round screen; replay from the record; 10-season soak passes with the orchestrator; AI Tired ≤ 36%, Spent ≤ 12% |
| **WP-D** UI | `src/ui/**` except styles, `src/platform/**` | The level-up card and badges by pacing; the between-round screen; the 5 + 2 squad; Freshness bars, labels and forecasts; level, XP bar, "next level in ≈ N matches", perks and rank pips; settings; the season progression review; the report's lineups and swap lines; trend removed (04) | Screen tests on the fixture world; the owner's migrated R001 career loads and shows levels, XP bars and Stamina; 1280×720 and 1920×1080; UI designer review |

Merge order: any; WP-C integrates (suggested WP-A and WP-B first, then WP-C, then WP-D). Highest risks: the week split and resume, the stat switch to `train100`, veteran perk and rank power, and the level-up burst after migrating a mid-season save. Outcome: the QA playtest migrated and played the owner's R001 career, and the harness `perk-impact` and `rank-impact` modes drove the tuning pass (03 §8.2).

## 10. Verification and definition of done

| Requirement / scenario IDs | Verification method | Representative setup | Expected evidence | Milestone |
| --- | --- | --- | --- | --- |
| T4 (purity) | `tests/architecture` + `tsconfig.core.json` + ESLint | whole repo | `npm run check` green; the checker's own tests catch planted violations | M1 (in place) |
| T5, 03 content | schema + cross-file validation | `content/default` (theme profile), `core/testkit` negatives | `npm run validate-content` OK; content tests green | M1 (in place) |
| T4, P-05, vis-009 (determinism) | Vitest: 3 runs → equal event hash; `checksum` equal at every record level; golden hash in Node and Chromium; same seed full season → equal state checksum; save → load → advance equals advance | fixture content, fixed seeds | equal hashes | M1 |
| V1 (sim and tactics) | unit tests per vocabulary entry, effect, status and the 03 §9.1 cases | fixture content | WP1 test list green | M1 |
| V1, vis-002 (balance) | `npm run balance` (random-draft, mirror, preset-vs-default) | `content/default`, seeds `balance-1..k` | JSON report; M1 first pass: outliers outside 40–60% reported to designers; M7 target 45–55%. From M1.1 the modes `progression`, `perk-impact`, `rank-impact`, `fatigue` and `squad-match` (the last crashes in the CLI, §12 KI-18) | M1, M1.1, M7 |
| vis-008 (soak) | `npm run soak` with every `SOAK_CHECKS` entry and the bands in `development.json soakTargets` and `economy.json balanceTargets` | `content/default`, seed `soak-1` (M7: 10 seeds) | JSON report, all `pass` | M1 gate 10 seasons, 1 seed (met: 11/11 on M1, 14/14 on M1.1, where competitive-balance is warning-level, O25, D-AA); 20 seasons reported, not gating; M7 gate 30 seasons × 10 seeds (03 §8). `economy.json` balanceTargets.seasons (25) should become 30: content request |
| R7, open-016 (saves) | round trip, checksum, migrations, too-new, references; browser save, close, reload, continue | fixture saves | tests green; checklist step | M1 |
| O24, O27–O32 (R002) | Vitest: the R002 commits' own tests (core: next-season room, effective rating, report box lines, healing received; UI: box score, squad swap and R1/R2, between-rounds, renewals on next-season room); 03 cases le-033 to le-035, fr-005, fr-006, box-001, box-002, sqd-001 and sqd-002 as written (they come from the module READMEs and commit descriptions and were not mapped test by test); sav-002 on `m1.1/save-trim` | fixture world; `content/default` | tests green; sav-002 pending the branch | M1.1 |
| O2, O9, open-014 (league) | WP3 tests | generated world | green | M1 |
| O10, open-007, open-028 (economy) | WP4 tests incl. worked examples | fixture world | green | M1 |
| O5, O6, O11 (lifecycle) | WP2 tests incl. §9 table | fixture world | green | M1 |
| 01 §5 finish line, O13, vis-006, vis-010 (UI in a browser) | tester agent in the Claude browser pane (`.claude/launch.json` → `arena-league-dev`): new game → club → sign a free agent → lineup, captain, presets → 16 matchweeks with reports → Reckoning → season end → season 2 → save → reload → continue; keyboard-only pass; screenshots at 1280×720 and 1920×1080 | `npm run dev`; `window.__arena.advance(n)` | checklist with screenshots, click counts, clean console | M1 |
| §8 budgets | bench, soak timing, build output | reference machine | numbers in the milestone report | M1 |
| §8 bundle budget (M1.1) | `tests/build/bundle.test.ts` builds in memory with the real vite config: startup JS ≤ 250 KB gzip, the content in a chunk of its own that startup does not import statically, shipped without `_` keys and with the content hash of the source files | `npm test` | green (startup JS about 204 kB) | M1.1 |
| vis-003, vis-009 (viewer) | viewer log hash = headless hash; observer test | M2 build | equal hashes; observer notes | M2 |

Browser end-to-end automation (Playwright) is unscheduled (FUTURE, tech); M1 uses the scripted checklist and component tests.

**A work package is done when:** its public API is fully implemented (no `notImplemented` left in its folders); its tests from §9.2 exist and pass, including failure paths and seeded determinism; `npm run check` and `npm run build` pass after a rebase onto `main`; its acceptance criteria are demonstrated with evidence (commands and outputs); its README states status, decisions and known gaps; it touched no file outside its ownership; the report of §11 is delivered.

A milestone is done when:

- [ ] Its approved player journey is launchable and completable.
- [ ] Applicable acceptance scenarios pass and their evidence is recorded.
- [ ] Rules, content, and presentation agree with their owning documents.
- [ ] Required failure, restart, and recovery paths work.
- [ ] Required delivery and launch instructions work in the target context.
- [ ] Known limitations and unverified claims are stated accurately.
- [ ] Remaining work is classified as a defect, an open decision, or future scope.

## 11. LLM working agreement

1. Read the full specification (01–05, the 03 §3 specs of your systems, the content files, and the README of each folder you own) before making dependent design choices. The phase-2 drafts in `docs/design/_drafts/` are merged and superseded by 03 and 04.
2. Identify the current milestone (M1 and M1.1 are built; the next in the order is M2) and blockers; do not interpret all future scope as immediate work.
3. Ask about missing decisions that change player-visible behavior (G1). Use a documented working assumption only where 01–04 mark one; DELEGATED decisions (D-A to D-T) and the confirmed D-U to D-AE (O25) are binding; otherwise ask in your report and continue with independent work.
4. Record consequential technical choices in your README; the architect merges them here as `tech-` entries.
5. Implement and verify complete slices of the player experience.
6. Keep approved design changes synchronized across affected documents and acceptance scenarios (through the lead designer and the architect, not by editing their files).
7. Report demonstrated behavior and evidence separately from assumptions or unfinished work.

**Project rules for coding agents:**
- **File ownership** per §9.2; nothing outside your package. **No edits outside your folder without coordination:** put a `CHANGE REQUEST` (file, change, reason) in your report; if blocked, write a temporary adapter inside your own folder and flag it.
- **Contracts:** keep the published signatures; add exports additively; tell consumers about any approved change.
- **Tests required:** colocated `*.test.ts(x)`; failure paths; seeded determinism; `npm run check` green before reporting. Never weaken or delete another owner's test, never edit `tests/architecture` to pass a violation, never update a golden value without architect approval.
- **Purity and determinism (§2, §6)** are not negotiable in `src/core`.
- **No numbers or names invented in code:** tunables and theme text come from content; if a value is missing, use a `PROVISIONAL_*` constant with an OPEN note and request the field.
- **Dependencies:** no new npm packages without architect approval.
- **Vocabulary:** 01 §7 terms in code, data keys and UI text.
- **Git:** your own worktree and branch `m1/wp<n>-<name>` from `main`; small commits titled `<module>: <change>`; rebase on `main`; never force-push `main`; never commit files you do not own; end commit messages with the repository's Co-Authored-By convention; the integrator merges.

**Delivery report format:** (1) what was built: files and public API; (2) how to run it; (3) what was verified: commands with results (test counts, hashes, timings); (4) deviations and technical decisions with IDs; (5) open questions and blockers tagged with design IDs (G1); (6) change requests for other owners.

## 12. Open decisions and completion check

| ID | Technical impact | Blocks |
| --- | --- | --- |
| open-017 | desktop wrapper; recommendation Electron after the M7 spike | M7 |
| open-015 | lighter resolver; recommendation no, budgets of §8 make the full sim feasible | M6 |
| open-016 | save model; implemented per its working assumption (§5) | M1 |
| open-010 | lineups and presets fixed for the whole match in M1; per-round inputs are possible later without API changes | M1 |
| open-006 | hired blades: `FighterStatus 'hired-blade'`, `economy.assignHiredBlades`, `MatchResult.hiredBladeIds` | M1 |
| open-005, open-014 | week layout and league structure are data (`leagues.json`); code must not assume 23 weeks or 16 clubs | M1 |
| D-A to D-T delegated, D-U to D-AE confirmed (O25) (01 §8.2) | encoded as listed in the header; reversible by data (`development.json`, `leagues.json`, `economy.json`) or `GameOptions`, except mm positions (sim-internal), the UI policies and the engine rules of D-O, D-P and D-S | M1 |
| D-L ownership note | Pacing presets fall inside existing ownership without a §9.2 change: the Continue state machine and store (WP6) and the Settings screen (WP7). Raised to the architect as a scope note for those packages' acceptance; no contract changes | M1 |
| Owner questions | 01 §8.5 Q1–Q52; Q36 and Q37–Q51 were answered on 2026-10-27 and Q1–Q35 and Q52 are open; M1 needs batches A and B answered or their working assumptions accepted (M1 was built at risk on them) | M1 |
| Structural content requests 1–3 (§4) | consistency only; none blocks M1 | — |
| Reference machine (tech) | numeric budgets in §8; owner question Q35 | M1 verification |
| M1.1 owner questions | **Answered 2026-10-27:** 01 §8.5 batch D (Q37–Q51) on D-U to D-AE and the combat proposals, approved as recommended (O25, O26); M1.1 was built on those recommendations | — |
| open-032 (sprite pipeline) | `docs/art/sprite-pipeline-research.md` §12 questions; the owner excluded asset-gen and Synty (O22) | M2 |
| §9.2 frozen text | §9.2 is kept verbatim (agents executed against it); values it quotes from before balance pass 1 (for example "the Behead worked example (315)", now 384) are superseded by 03 v0.3 | — |

**Known issues (main @ d440107; the measurements are those of 293f49a).** KI-1 to KI-15 were recorded in the v0.3 and v0.4 syncs and are updated where the M1.1 build changed them; KI-16 to KI-19 were new in v0.6 and KI-20 is new in v0.7. KI-2 (branch `m1.1/save-trim`) and KI-16, KI-18 and KI-19 (branch `m1.1/ki-fixes`) have fixes in progress and stay open until those branches merge. None blocks playing a full season; each has an owner and a next step.

| # | Issue | Evidence | Owner / next step | Blocks |
| --- | --- | --- | --- | --- |
| KI-1 | The 20-season soak flags a dynasty as a **warning** (O25, D-AA): Keelwick Tarhands (Crown, Glory-hunters, aggressive style) won the Crown Reckoning in seasons 8–11 on seed `soak-1`; the M1 build flagged Cinderpan Cinderjacks instead, which is why the check is warning-level (seed-fragile) | `npm run soak -- --seasons 20` (v0.6): competitive-balance WARN; the 10-season gate passes with no flag | league-economy designer: dynasty levers (03 §8.4 tuning order) after class retuning; judged over 10 seeds at the M7 gate | M7 gate |
| KI-2 | Save size about 4.5 MB at the end of season 3 (4.0–5.6 MB over ten seasons) and about 12 MB at the in-season peak (9.3–13.5 MB) against the 3 MB budget; the M1.1 compaction saves about 0.6 MB a season and was not enough | `npm run bench -- --seasons 10 --player` (v0.6); commit 9fc9ab6 (5.12 → 4.50 MB after the season-end step and 12.92 → 12.35 MB at the season-end phase, the in-season peak, in season 3) | owner chose A (Q36, O24); implementation on branch `m1.1/save-trim` | M1 §8 budget |
| KI-3 | **Resolved** (m1.1/bundle): the main bundle went over its 250 KB gzip budget (298 kB) when M1.1 grew the content; the content is now a separate chunk without its `_` documentation keys (startup JS about 204 kB, content chunk 83 kB) | `npm run build`, `tests/build/bundle.test.ts` | — | — |
| KI-4 | Fight sim about 1.9–2.0 ms per round (median, p99 4.2–4.5 ms) against the 2 ms budget: at the limit (the M1 build measured 2.4 ms) | `npm run balance` ms per round (v0.6: random-draft 1.97, fatigue 1.93) | WP1: profile; the §8 fallback is `decisionIntervalTicks` 4; re-measure on the reference machine (Q35) | M1 §8 budget |
| KI-5 | Class win rates span 38.7–62.6% (headsman 62.6%, cantor 38.7%) and archetypes 44.1–53.5% in the unchanged M1 pass-1 class values: outside the 03 §8.2 targets (47–53% and 45–55%), inside the M1.1 bands (42–58% and 35–65%); `hourglass_sage`, the M1 outlier at 61.7%, is now 59.8% | `npm run balance -- --fights 20000` (v0.6, seed `balance-1`) | combat designer: balance pass 2 (class retuning) within ±30% | M7 balance |
| KI-6 | Cautious-style AI clubs won 1 of 20 Crown titles in the 20-season soak (aggressive-style clubs 15, steady 4; the clubs split 13, 18 and 17); in M1 they won 0 | soak season summaries (v0.6) | combat and economy designers: protective presets and the AI style mapping | M7 balance |
| KI-7 | AI clubs keep a full Muster roster cap after signing their trials rookie, leaving little room for later signings | soak rosters | league-economy designer: depth floor and trials-as-depth rule (03 sys-ai-manager) | — |
| KI-8 | The per-match career-ending estimate (`careerEndingChancePerMatchBp`) is computed but not shown on the lineup screen (03 sys-injury, inj-004) | UI review | WP7 | — |
| KI-9 | **Resolved** (m1/polish-ui, f9386b6): before an opponent's first match the Home hero showed that club's planned lineup; it now shows "No matches played yet" (D-R) | — | — | — |
| KI-10 | Money piles up: by season 9 the median club holds 1.84 × its season budget (03 §8.4 band 0.10–1.00). The QA money check found no double crediting; a club spends at most its WB, and M1 has no other spending outlet | QA money check, polish-core README | league-economy designer: spending outlets (facilities, transfers) in M6/M7 | — (M6/M7 balance) |
| KI-11 | An over-budget renewal shows "over by 192 ts" next to "−187 ts wage room" (the two figures should agree) | QA re-verification | WP7 with WP4: one source for both numbers | — |
| KI-12 | The TW1 "Advance to season end" dialog does not mention expiring contracts (the confirmation before the season-end step does) | QA re-verification | WP7: list unrenewed expiring contracts in that dialog | — |
| KI-13 | The side navigation highlights League during the season review | QA re-verification | WP6 | — |
| KI-14 | Long names are truncated on lineup cards | QA re-verification | WP7 | — |
| KI-15 | Low-rated veterans past human-age 40 show physical stats of 1–2, because they keep 55–65% of a low peak under the softer decline | QA re-verification; 03 sys-development | lifecycle designer: a floor or a retirement nudge for very low physical stats | — |
| KI-16 | The Market's starter-flag tooltip says clubs where he would start get +500 on their offer score, but `economy.json` market.starterBonusBp is 1,000 (03 sys-transfers, 04 ui-market) | `src/ui/screens/market/text.ts` `tip.starter` against the content | WP7: read the number from the content; fix in progress (branch `m1.1/ki-fixes`) | — |
| KI-17 | The 20-season soak fails age-distribution in season 11: 55.8% of fighters are at human-age ≥ 31 against the 55% cap (the median human-age stays at 26.7–32.0, and the 10-season gate passes with 27–53%) | `npm run soak -- --seasons 20` (v0.6) | lifecycle designer: the physical age factor from 31 (the lever 03 §8.6 names) or the band; not a 10-season gate failure | M7 gate |
| KI-18 | `npm run balance -- --mode squad-match` crashes after the run while printing its report (`report.fightLength` is undefined in that mode, `scripts/balance.ts` line 58), so the squad-match comeback figures cannot be re-measured from the CLI | v0.6 verification run | WP-A: guard the print; fix in progress (branch `m1.1/ki-fixes`) | — |
| KI-19 | The harness's `perk-impact` mode still flags one perk after the integrator's cut to 8%: Last Wall (tank, tier III) lifts the win rate by +5.2 points (CI 3.5 to 6.9) against the +5 flag. No other perk and no rank is flagged as dominant (16 rank-3 steps lift under 0.5 point) | `npm run balance -- --mode perk-impact --per 1000 --seed fp1` and `--mode rank-impact --per 1000 --seed fr1` (v0.6) | combat designer: trim Last Wall again or tighten its prerequisites; fix in progress (branch `m1.1/ki-fixes`) | M7 balance |
| KI-20 | A multi-season free-agent signing made in season is judged on this season's wage room only. It counts as a continuing commitment for later renewals, but nothing re-checks it against next season's room, so a club can reach next season above its projected wage budget (it then has no room until the bill drops) | core/economy README (R2-T006, "known gap") | league-economy designer: re-check at the season-end step, or leave as is (01 open-033 covers the AI's side of the same rule) | — |

KI-11 to KI-15 are M1 QA items. The M1.1 UI fix round touched some of those screens (squad cards, market width, dialogs), and the v0.6 sync did not re-verify them. R002-T006 (O32) moved the renewal dialog and the Renewals view onto next season's room, which probably retires KI-11's disagreement for renewals; the v0.7 sync did not re-verify it.

- [x] Fixed design requirements and replaceable implementation choices are distinguishable (REQUIRED IDs versus `tech-` decisions).
- [x] State and rule ownership are clear at important boundaries (§3, enforced by tests and package ownership).
- [x] Save / interruption guarantees agree with the player journey (02 §3, 03 sys-save; the owner's answer on open-016 is Q16).
- [x] Optional systems are included only when the game requires them (networking N/A, patron goals off in M1).
- [x] Milestones have complete player-visible outcomes and bounded scope.
- [x] An implementing LLM knows when to decide, when to ask, and how to prove completion (§9.2, §10, §11).
