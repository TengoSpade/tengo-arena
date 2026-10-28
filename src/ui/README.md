# src/ui — management UI (Preact + @preact/signals)

HTML/CSS screens over the pure core. The UI **reads** `GameState` and **dispatches** `Command`s; it never mutates state or decides game rules.

| Folder | Owner (M1) | Purpose |
| --- | --- | --- |
| `styles/` | **UI designer** (do not edit) | `tokens.css`, `base.css`, `components.css`: BEM classes, tokens, themes |
| `app/` | WP6 | app frame (topbar, sidenav, main), hash router, error boundary, keyboard shortcuts |
| `store/` | WP6 | signals store: current GameState, ContentDB, dispatch, advance, autosave, busy flag |
| `components/` | WP6 | reusable Preact components wrapping the designer's classes (DataTable, Panel, StatBar, Modal, Toast, Tabs, FighterName, Money, ...) |
| `screens/` | WP6 and WP7 (see screens/README.md) | one folder per screen (see docs/design 05 §9 for the split) |
| `format/` | WP6 | number, money, age, date formatting (locale APIs are allowed here, not in core) |
| `text/` | WP6 (screens keep their own text.ts) | UI copy table (`t(key)`); theme names come from content |
| `debug/` | WP6 (may load core/testkit fixtures in dev builds) | debug overlay (backtick key or `?debug=1`) and state dump |

Status (WP6): frame, store, platform, components, format, text, debug and the screens home, new-game, club-select, squad, fighter and codex are implemented; see each folder's README.

M2 (WP-M2E): the arena screens (`screens/arena`: `#/arena`, `#/replay/:fixtureId`), the watch flow in the store (`store/arena.ts`, `create-store.ts`), Watch or Simulate on Continue, Replay entries (report, fixtures, Home), Settings › Watching, F8 arena metadata and the dev/smoke test hook. See `screens/arena/README.md`.

Rules:
- Import core through module indexes only (`../../core/game`, never `../../core/game/pipeline`). Enforced by tests/architecture.
- Use the designer's classes from `styles/components.css`; screen-local CSS only for layout glue, in the screen folder.
- Every interactive element is keyboard reachable; tables sort by clicking headers and announce `aria-sort`.
- Component tests: `*.test.tsx` next to the component (Vitest + @testing-library/preact, happy-dom).
- Stable `data-testid` on screen roots and primary actions so browser checks can target them.
