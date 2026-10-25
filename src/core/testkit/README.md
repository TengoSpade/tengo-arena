# core/testkit

**Owner:** architect. **Import only from test files** (`*.test.ts(x)`); enforced by `tests/architecture`.

- `fixtureContent()` — frozen 6-class content set (`fixture-content.json`, one base class per archetype plus one hybrid, all constants files whole). Validated with the `fixture` profile. Regenerate with `npm run fixture:content` only when the content **schema** changes, and commit the result. Value edits in `content/default` never change it, so module tests stay stable.
- `fixtureState()` — empty `GameState` on the fixture content.
- `buildFixtureWorld(options)` — deterministic hand-built world: clubs from the fixture content, simple fighters with contracts, lineups and default presets, some free agents. No competitions or fixtures. Lets modules and screens be tested before world generation lands.
- `makeFixtureFighter(n, content, overrides)` — one plain fighter.

Need another fixture (a played match, a season-end state)? Ask the architect, or build it inside your own test file.
