# Arena League (working title)

Single-player PC management game: run a fantasy-mercenary club in an arena league. Lineups of 5 fighters battle automatically in a real-time 2D arena using ordered IF/THEN tactics rules; you manage the roster, contracts, wages, development and aging across seasons with promotion and relegation.

- Design package: [`docs/design/`](docs/design/) (01 vision, 02 flow, 03 systems, 04 presentation, 05 technical). Drafts in `docs/design/_drafts/`; the technical plan draft is [`docs/design/_drafts/05-technical.md`](docs/design/_drafts/05-technical.md).
- Research: [`docs/research.md`](docs/research.md) and [`docs/research-notes/`](docs/research-notes/).
- Theme content (names, classes, abilities, races, leagues, clubs, economy): [`content/default/*.json`](content/default/).

Milestone: **M1 "Season MVP"** (tag `m1-season-mvp`): new career, club choice, 16 matchweeks with match reports, the Reckoning, season end, endless seasons, save/load.

## Requirements

- Node.js 22.12+ (developed on Node 24) and npm. On Windows, if `node`/`npm` are not on PATH, use `"C:\Program Files\nodejs\npm.cmd"` or add `C:\Program Files\nodejs` to PATH.
- A current Chromium-based browser (Chrome, Edge) for the game. No network is needed at runtime.

## Run

```sh
npm ci               # once, and after package-lock.json changes (exact, clean install)
npm run dev          # dev server at http://localhost:5173 (hot reload, including content JSON edits)
npm run build        # production bundle in dist/ (static, works offline)
npm run preview      # serve the built dist/ at http://localhost:4173
```

Open http://localhost:5173, choose **New career**, pick a club (Muster Circuit clubs are recommended for a first career) and confirm. **Continue** (Space) advances one week; in a matchweek it plays your match and opens the report.

## Saves

- Saves live in the browser's **IndexedDB** (database `arena-league`), per site origin: the dev server (port 5173) and the preview (port 4173) keep separate saves. Clearing site data deletes them.
- Three rotating autosaves (after every week processing and after the season end) and ten manual slots. `Ctrl S` saves; **Save / Load** (`S`) lists every slot.
- **Export** on the Save / Load screen downloads a slot as a `.json` file; **Import** loads such a file back (also into another browser). The debug overlay's **State dump** downloads the current state with the commands since the last save, for bug reports; `npx tsx scripts/replay.ts <file.json> --weeks 3` replays weeks from a dump or save headless and checks they reproduce.

## Developer tools

- **`window.__arena`** (dev server only): `state()` returns the committed `GameState`; `dispatch(command)` applies a command for the player's club; `await advance(n)` processes n weeks (stops at the first blocker, e.g. an injured starter); `await finishSeason()` runs the season-end step; `dump()` downloads a state dump; `store` is the UI store.
- **Debug overlay**: backtick (`` ` ``) on any management screen in dev, or append `?debug=1` to the URL (also in a production build). It shows season/week/phase, root seed, content id and hash, engine/schema/game versions, the last advance time, state size, the last error and the last 20 commands, with State dump and (dev) the fixture world and component gallery.

## Test and check

```sh
npm test             # Vitest: unit tests + architecture/purity checks (npm run test:watch to watch)
npm run typecheck    # tsc: core with no DOM/Node types, then the whole project
npm run lint         # ESLint (editor feedback for the architecture rules)
npm run check        # all three; must be green before a merge
```

## Content

```sh
npm run validate-content            # validate content/default (schemas, references, vocabularies, units)
npm run fixture:content             # architect: regenerate the frozen test fixture after a schema change
```

## Headless harnesses

```sh
npm run balance -- --fights 5000 --seed balance-1   # per-class win rates from seeded headless fights (real sim)
npm run soak -- --seasons 10 --seed soak-1          # N seasons headless, every club AI-managed: 11 checks (determinism,
                                                    # ledger, solvency, lineups, ages, population, wages, dynasties,
                                                    # schedule, references, save round trip); exits 1 if any fails
npm run bench -- --seasons 10                       # engine timing: per season, slowest/median week, clone, autosave, save size
```

Balance and soak write a JSON report to `reports/` (git-ignored). `npm run soak -- --stand-ins` runs the season loop on core/game's small stand-in modules instead of the real ones (a smoke test of the loop and checks, not a balance result).

## Work packages

M1 was built by seven parallel work packages with strict file ownership; see [`docs/design/_drafts/05-technical.md`](docs/design/_drafts/05-technical.md) §9.2. Every module exposes a typed contract in its `index.ts`; `src/core/testkit` provides frozen fixtures for tests.

## Layout

```
content/<theme>/*.json   theme data (designers)
docs/                    research and design package
scripts/                 headless CLIs (balance, soak) and Node helpers
src/core/                pure, deterministic engine: no DOM, no PixiJS, no Math.random, no clocks
  util/ rng/ model/ content/ testkit/   foundation, content schemas, fixtures (architect)
  tactics/ sim/ fighters/ league/ economy/ ai/ game/ save/ harness/   work packages WP1-WP5
src/platform/            browser/desktop adapters (content loader, saves, clock, entropy)
src/ui/                  Preact + signals management UI; styles/ belongs to the UI designer
src/render/              PixiJS arena viewer (M2)
tests/architecture/      purity and module-boundary checks
```

Each module folder has a README with its owner, responsibility, rules and planned API. Module boundaries are enforced by `tests/architecture/rules.ts`.

## Browser preview

`.claude/launch.json` defines `arena-league-dev` (`npm run dev`, port 5173) for the Claude browser pane.
