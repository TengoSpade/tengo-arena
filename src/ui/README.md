# src/ui — management UI (Preact + @preact/signals)

HTML/CSS screens over the pure core. The UI **reads** `GameState` and **dispatches** `Command`s; it never mutates state or decides game rules.

| Folder | Owner (M1) | Purpose |
| --- | --- | --- |
| `styles/` | **UI designer** (do not edit) | `tokens.css`, `base.css`, `components.css`: BEM classes, tokens, themes |
| `app/` | UI foundation agent | app frame (topbar, sidenav, main), hash router, error boundary, keyboard shortcuts |
| `store/` | UI foundation agent | signals store: current GameState, ContentDB, dispatch, advance, autosave, busy flag |
| `components/` | UI foundation agent | reusable Preact components wrapping the designer's classes (DataTable, Panel, StatBar, Modal, Toast, Tabs, FighterName, Money, ...) |
| `screens/` | UI screen agents A and B | one folder per screen (see docs/design 05 §9 for the split) |
| `format/` | UI foundation agent | number, money, age, date formatting (locale APIs are allowed here, not in core) |
| `text/` | UI foundation agent | UI copy table (`t(key)`); theme names come from content |
| `debug/` | UI foundation agent | debug overlay (backtick key or `?debug=1`) and state dump |

Rules:
- Import core through module indexes only (`../../core/game`, never `../../core/game/pipeline`). Enforced by tests/architecture.
- Use the designer's classes from `styles/components.css`; screen-local CSS only for layout glue, in the screen folder.
- Every interactive element is keyboard reachable; tables sort by clicking headers and announce `aria-sort`.
- Component tests: `*.test.tsx` next to the component (Vitest + @testing-library/preact, happy-dom).
- Stable `data-testid` on screen roots and primary actions so browser checks can target them.
