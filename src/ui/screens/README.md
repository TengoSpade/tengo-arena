# ui/screens

**Owners:** UI screen agent A and B (M1 wave 2). **Status:** not started.

One folder per screen, each with `index.tsx` (the screen component), optional local CSS and `*.test.tsx`. Proposed M1 split (finalized in phase B):

- **Agent A (club and roster):** `new-game/`, `club-select/`, `squad/`, `fighter/`, `lineup/` (lineup of 5, captain, tactics preset per fighter), `market/` (free agents, offers), `contracts/`.
- **Agent B (season and results):** `hub/` (inbox digest, next fixture, advance), `schedule/`, `standings/`, `match-report/`, `tournament/`, `finances/`, `season-summary/`, `saves/` (save, load, export, import), `settings/`.

Screens read state from `ui/store` and change it only with `dispatch(command)` / `advance()`.
