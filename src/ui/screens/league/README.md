# WP7 screens (league, fixtures, match-report, market, finances, season-review, saves, settings)

**Owner:** WP7. **Status:** M1 screens implemented and tested against WP6's frame, components, store and engine seam. Core views come through `useEngine()`; until WP1-WP5 land, a view that still throws `NotImplementedError` shows an inline "Not available yet" state instead of breaking the screen.

| Screen | Route | Spec | Notes |
| --- | --- | --- | --- |
| League | `#/league` | 04 ui-league, league.html | Wing and tier tables (zones: top 4 qualify, 8th relegated except in the lowest tier, Shield leader), tier switch, W / T keys. Bracket: "Projection from matchweek 13" before MW13, live projection MW13-MW16, the stored bracket (Live / Final) in the Reckoning, last season on request. |
| Fixtures | `#/fixtures` | 04 ui-fixtures | Our season (league + Reckoning), by matchweek (any tier, ← →), calendar strip (trials day, kick-off, grant weeks, contract deadline). |
| Match report | `#/match/:fixtureId` | 04 ui-report, match-report.html, 03 sys-match-report | Scoreboard and round pips, MVP (04 v0.2 rule in the tooltip), What decided it (summary + 3-5 traces), box score (whole match or a round), rule recaps with fire bars and never-fired warnings, key moments, downs (death summaries), injuries and XP. Keys 0-5 rounds, ← → other reports. |
| Market | `#/market` | 04 ui-market (v0.2), market.html | Filters, asks for 1/2/3 seasons (preferred marked), signing cost, rival-offer counts, starter flag, willingness = patience, compare tray, offer dialog with the terms check (never a forecast), pending offers with Withdraw, renewals, trials rookies (P1 only), shortlist. |
| Finances | `#/finances` | 04 ui-finances | Tiles, status (Watch / embargo / Registry), season budget parts, money by category, wage bill, money by week, balance with projection, ledger. |
| Season review | `#/season-review` | 04 ui-season-end | Six steps; before the season-end step has run it offers the binding commit (`finishSeason`). |
| Saves | `#/saves` | 04 ui-save | Manual slots and autosaves, Save / Save as / Overwrite / Load / Export / Import / Delete; every `SaveError` code has text and "nothing was changed". |
| Settings | `#/settings` | 04 ui-settings | WP6 `settings` store: pacing presets (D-L), autosave, theme, scale, density, tooltip delay, reduce motion, status colours; changes apply at once with Undo (D-M). Audio and remapping are shown disabled. |

## Shared code (this folder)
- `lib/`: WP7 helpers used by several screens: `store.ts` (`useCareer`, tolerant of a missing provider), `engine.ts` (`useWp7Engine`: the engine seam plus `ask`, `checkOffer`, `marketWage`), `views.ts` (`tryView`), `calendar.ts` (wrappers over `src/ui/format/calendar`), `club.tsx`, `season.ts` (plain fixture and result lookups), `reckoning.ts` (projected seeds), `sort.tsx` (sorting for the grouped and zoned tables), `ui.tsx` (content-to-props adapters over WP6 components), `format.ts`, `text.ts`.
- `StandingsTable.tsx`, `Bracket.tsx`: reused by the season review.
- `testing/`: TEST DOUBLES only (never imported by production code): `sample-season.ts` builds a season in progress on top of the testkit world (fixtures, results with per-fighter stats, Reckoning, ledger, market, history); `fake-core.ts` approximates the core views; `fake-store.ts` implements `GameStore`; `providers.tsx` wires them for tests.

## Decisions (for the architect)
- Screens read core views through WP6's `useEngine()`; the market's `ask`, `checkOffer` and `marketWage` are read through `useWp7Engine()` (engine first, then `core/economy`) until the seam lists them.
- The match report's traces, summary sentence and key-moment wording are chosen in `match-report/analysis.ts` from the `MatchReport` view and the stored `MatchResult` (rule counters, downs, round results). Presentation only; no rule is evaluated.
- The bracket projection orders seeds in the UI (`lib/reckoning.ts`) from the standings view; the matchweek it starts at is `PROVISIONAL_PROJECTION_FROM_MATCHWEEK = 13` (03 sys-tournament; no content field).
- The terms check in the offer dialog uses economy.json negotiation flex by greed label (03 sys-contracts); asks and legality come from core.
- Rule sentences are rendered by `match-report/rule-sentence.tsx` (handles Always, NOT, `{status|category}`, stance and cooldown).

## Known gaps
- The market has no "Only new this week" filter: the model does not record when a free agent entered the pool.
- Per-round fire counts and skip reasons are not in the M1 `MatchReport` view, so traces show match totals and verdicts helped / hurt / never fired (no "blocked").
- Attribute changes per match are not in the view; the report shows XP only.
