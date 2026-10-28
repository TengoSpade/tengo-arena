# ui/screens/arena

**Owner:** WP-M2E. Design: `docs/design/_drafts/05-technical-m2.md` §A3, §A4, §A7, §A9, §A11. The PixiJS viewer is `src/render/viewer` (WP-M2D), loaded with `import()` through the factory seam; the HUD, fighter strip, feed, inspector, controls and overlays here are DOM (tech-018).

## Look and keys (05-technical-m2 §A18, docs/design/mockups/arena.html, arena-notes.md)
Both routes are full-window screens with no app shell (`app/App.tsx` BARE routes); markup and classes are the UI designer's (`components.css` §25: `.arena-screen`, `.ahud`, `.atransport`/`.ascrub`, `.arena-dock`, `.afeed`, `.ainspect`/`.awhy`, `.astrip`/`.afighter`, `.around`), `arena.css` is host glue only. The right dock (inspector above the feed) is open at every width; **D** hides or shows it, per device (`settings.arena.dockOpen`), and nothing resizes on its own. The live scrubber is a fixed 0-75 s track. **The arena owns the keyboard**: Space plays or pauses (Shift Space = Simulate the rest, asks once), 1 2 4 or [ ] speed, ← → a frame (Shift: a second) while paused, End Live, Enter or I the inspector, L names, D dock, Home recentre, Shift S skip the round (asks once), Esc closes the inspector, then (live) asks once and goes Home with the match still live, (replay) back to the report; Ctrl S while paused; F8 stays (App). Tab walks the ten fighter cards in the normal order and **focus is selection** (no trap). The round-end card: 1.5 s, any key (Enter included) skips it and is consumed, then the next stop opens by itself (the deciding round says the match result first).

## Routes
- `#/arena` (`index.tsx`): the player's match being watched. Opened only after the lock's `auto-round` write succeeded (the store enforces it). Loads the round once per mount (`liveRoundPlayback`, cached per round), hands its log to the viewer and reads everything else through the viewer (`onFrame`, `keyMoments()`, `decisionAt()`, `headTick`; `endTick` stays null until reached). Playback stops (pause, auto-pause, window hidden, leaving) persist the **reveal frontier** (`ceil(headTick)`, forward only) with `match.watch` plus the round autosave. The round's end, or "Skip to end of round" (Shift S, asks once), commits with `advance({ watched: { round, logHash } })`, the hash of the loaded log. "Simulate the rest" sends `match.watch { mode: 'simulate' }` and then `advance()`. A fresh round plays at once; a resume opens paused at the cursor with a toast.
- `#/replay/:fixtureId` (`replay.tsx`; `?round=2&tick=300`): committed rounds through `roundPlayback` (checksum-verified; a `replay.mismatch` is shown as a defect), round tabs (Alt 1-5), free seeking. The report's key moments link here 2 s before the moment (`REPLAY_LEAD_TICKS`). The live match's earlier rounds replay here too ("Replay round n" on the between-round screen).

## Files
| File | Role |
| --- | --- |
| `session.ts` | `useViewerSession`: viewer lifecycle, callbacks to signals, controls, settings sync (auto-pause, names, motion, palette per theme), hidden-window pause |
| `Arena.tsx` | layout and keys shared by both routes (Space, 1 2 4, [ ], arrows, Tab, Enter, I, L, Home, End, Shift S, Esc) |
| `Hud.tsx`, `Strip.tsx`, `Controls.tsx`, `Panels.tsx` | top strip, fighter strip, transport row, feed and inspector |
| `RoundEnd.tsx` | the non-blocking round-end overlay (1.5 s, any key skips; ux-001) |
| `context.ts`, `feed.ts`, `inspect.ts` | `ArenaRoundContext` and HUD facts from header data only; moment sentences; inspector sentences |
| `palette.ts` | the `ArenaPalette` read once from the CSS tokens (designer arena tokens fall back to existing ones) |
| `viewer-factory.ts` | the factory seam (tests inject a fake viewer) and the idle prefetch |
| `ReplayLink.tsx` | Replay entries and their disabled reasons (A4) |
| `test-hook.ts`, `hook-registry.ts`, `../../debug/arena-fixture.ts` | `window.__arena.viewer` and the fixture round: dev and `smoke` builds only (tests/build/arena-test-hook.test.ts) |
| `testing/` , `../../debug/arena-test-world.ts` | test support: synthetic logs with known later events, a fake timeline and viewer, a scripted core standing in for WP-M2B |

## Tests
`arena.test.tsx` (screen), `arena-flow.test.tsx` (the whole shell: ux-001 counted, the lock saved before the viewer opens, resume, commits, keyboard only), `leak.test.tsx` (the fake-viewer leak test: full log versus the log cut at the head, DOM identical; the real timeline runs once WP-M2C has merged), `replay.test.tsx`, `inspect.test.ts`, `palette.test.ts`.

## Not wired yet (fakes)
Real `liveRoundPlayback` / `roundPlayback` / `matchPlayback` / `replayAvailability` / `inspectPlayback` (WP-M2B, WP-M2A), the real viewer (WP-M2D) and timeline (WP-M2C); the designer's arena tokens (`--c-arena-floor`, `--c-arena-wall`, `--c-fx-*`) and mock.
