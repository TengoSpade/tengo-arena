# ui/app

**Owner:** WP6. **Status:** M1 frame implemented (`App.test.tsx`, `routes.test.tsx`, `continue.test.ts`).

- `App.tsx`: providers (store, engine), settings on `<html>`, error toasts from `store.lastError`, the content-error gate, route decisions (no career: title, saves, settings, codex; career without club: club select; otherwise the hub frame). Dev builds add `#/dev/components` (gallery); the debug overlay opens with backtick (dev) or `?debug=1`.
- `Frame.tsx`: top bar, side navigation (1-7, collapsible), embargo banner, overlays (tooltips, toasts, shortcut sheet `?`, quick-jump search Ctrl K, Simulating panel), the Continue runner and the global shortcut map (Space, Ctrl S, Ctrl K, Ctrl Z, ?, Esc / Alt ← back, 1-7).
- `continue.ts`: the pure Continue state machine of 04 §6.1 (lineup → play match → report → next week; preseason weeks; Kick off season and Advance to season end as commit dialogs; Season review; Decide first on blockers; pacing presets decide the stops, never results).
- `router.ts` / `routes.ts`: hash router; route ids and paths unchanged; `matchRoute` adds `?query` keys to params; `hrefFor(id, params)`.
- `shortcuts.ts`: `useShortcuts(map)` layers for screens on top of the global map; ignored while typing (except Ctrl combos and Esc) and while a dialog is open.
- `ScreenHost.tsx`: lazy screens (one chunk each), per-screen error boundary with a crash panel, content-error screen.

Decisions (for the architect, tech-): after a played match the frame opens the report per the pacing preset (Balanced: on a loss or an injury, else a result toast with "Open report"); `club.choose` autosaves at once so a new career is never lost; `?theme=light|dark` and (dev) `?dev-world=<week>&club=<id|none>` are review hooks like the mockups' query parameters.
