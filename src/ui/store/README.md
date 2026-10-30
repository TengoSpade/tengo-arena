# ui/store

**Owner:** WP6. **Status:** implemented and tested (`store.test.ts`). The contract (`contract.ts`: `GameStore`, `StorePlatform`, `StoreContext`, `useStore`) is fixed; everything else is additive.

- `createGameStore(platform)` returns an `AppStore` (a `GameStore` plus `engine`, `commandLog`, `recentCommands`, `lastAdvanceMs`, `dirty`, `currentSlot`, `quickSave()`, `clearError()`, `replaceWorld()` for dev tools, `defaultSaveLabel()`).
- Signals: `game`, `content`, `contentIssues`, `playerClubId` and `blockers` (computed), `busy`, `lastWeekReport`, `lastSeasonEndReport`, `lastError`.
- `dispatch(command)` -> `engine.applyCommand`; failures set `lastError` (the app frame shows a toast with `errorText()`); successes are logged.
- `advance()` / `finishSeason()`: busy guard (a second call returns `engine.busy`), one yield so the UI paints, atomic commit, then autosave. **Weekly slots:** a finished week, the season-end step and `club.choose` (career start) rotate over `auto-1..3` (first empty, else oldest), so three of them keep the last three week boundaries and a bad week can be rolled back. **Mid-match slot:** a match paused between rounds (`MATCH_PAUSED`, `state.liveMatch`) goes to its own `auto-round`, overwritten after every round; it never takes a weekly slot. Loading it (or the title screen's Continue, which loads the newest save) resumes the match at the same between-round screen: every committed round and decision is in the state, nothing is rerolled (P-05).
- Anything core throws becomes an `EngineError` (`engine.not-implemented`, `engine.crash`), never an exception in a screen.
- Saves: manual slots `MANUAL_SLOT_IDS` (`manual-1..10`), `save`, `load` (never half-loads), `listSaves` (newest first), `deleteSave`, `exportSave` (download), `importSave` (validated, into the first free manual slot), `quickSave` (Ctrl S). `dumpState()` downloads envelope + command log + build info.
- Dev builds deep-freeze every committed state and expose `window.__arena` (`state()`, `dispatch()`, `advance(n)`, `finishSeason()`, `dump()`, `store`).

**Engine seam (`engine.ts`).** `GameEngine` lists every core function the UI calls (game transitions and views, fighters/league/economy/tactics views, core/save). `coreEngine` binds the real modules; `useEngine()` gives screens the engine the app (or a test) provides. In dev builds and tests, `src/ui/debug/dev-engine.ts` wraps `coreEngine` and falls back to PROVISIONAL stand-ins only where a core function still throws `NotImplementedError`; real implementations take over automatically as WP1-WP5 merge.

**Settings (`settings.ts`).** `settings` signal + `updateSettings(patch)` (theme, scale, density, reduced motion, status palette, tooltip delay, pacing preset D-L, nav collapse, autosave), persisted by `src/platform/settings-storage.ts`, applied to `<html>` by `applySettingsToDocument()`. `pacingStops()` resolves a preset to its stops.

**Messages (`messages.ts`).** `errorText(error)` and `blockerText(blocker)` map codes to `src/ui/text` copy.

**Tests for screens.** `createTestStore({ world: 'dev' | 'fixture' | 'none', weekIndex, playerClubId })` and `<TestProviders store>` in `src/ui/debug/test-store.tsx` give a real store on a fake platform with the fixture content.
