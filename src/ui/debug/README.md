# ui/debug

**Owner:** UI foundation agent (M1 wave 1). **Status:** not started.

- **Debug overlay** (toggle with the backtick key, or open with `?debug=1`): season/week/phase, root seed, content id + hash, engine and schema versions, last `advanceWeek` time (ms), state size (KB), last 20 commands, last error. Dev builds only, plus release builds when launched with `?debug=1`.
- **State dump**: downloads `<club>-s<season>w<week>.state-dump.json` = save envelope + command log + build info + user agent. A dump plus the build version is enough to reproduce a bug headless.
- **Match repro**: copy `{ fixtureId, matchSeed, engineVersion, contentHash }` for a match report.
