# ui/store

**Owner:** UI foundation agent (M1 wave 1). **Status:** not started.

Planned contract (docs/design 05 §3):
- `game = signal<GameState | null>`, `content = signal<ContentDB | null>`, `busy = signal<boolean>`; derived views via `computed()` (roster, standings, finances) so tables update without manual wiring.
- `dispatch(command)`: calls `applyCommand` from core/game; on success replaces `game.value`; on failure shows a toast with the mapped error text. Appends to the in-memory command log.
- `advance()`: guarded by `busy` (no double advance), calls `advanceWeek` (later inside a Web Worker), commits, then autosaves through `src/platform`.
- Dev builds `deepFreeze()` each committed state to catch accidental mutation.
- Exposes `window.__arena` in dev (`state()`, `dispatch()`, `advance()`, `dump()`) for browser testers.
