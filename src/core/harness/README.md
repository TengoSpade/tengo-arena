# core/harness

**Owners:** WP1 (`balance.ts`, `balance.test.ts`, `scripts/balance.ts`), WP5 (`soak.ts`, `soak.test.ts`, `scripts/soak.ts`); `index.ts` is architect-owned. **Status:** stubs with the final option and report shapes.

- `runBalance({ seed, fights, classIds })` -> `BalanceReport`: per-class appearances, wins, win rate, outliers outside `BALANCE_TARGET_BAND` (TUNABLE). Stub = coin flips.
- `runSoak({ seed, seasons })` -> `SoakReport`: the `SOAK_CHECKS` catalogue with pass/fail/pending. Stub = all pending.

- **`level-ups` cohort gate.** The levels.json `starterLevelsPerSeasonByHumanAge` bands are judged on each cohort's mean pooled over the measured seasons, with the cohort's own sampling noise (`judgeCohort`): a cohort of fewer than `MIN_COHORT_GATE` (20) fighters is reported ("not gated") but never fails, and a larger one fails only when its mean lies outside the band by more than `COHORT_NOISE_Z` (2.5) standard errors of the mean (the spread comes from `CohortTally.levelsSq`). The "18-20 potential>=70" cohort has only about 25-35 fighters in ten measured seasons (sd about 1.6 levels, so about 0.7 of noise margin): a flat band read 3.91 on seed bal-c and 4.4-4.9 on others. The large cohorts (hundreds of fighters, margin about 0.1-0.2) stay a tight gate. `levelUpsCheck(measured, content)` is the whole check, exported for tests.

Pure (no fs, no clock): the CLIs read content, time the run and write report files. The same runners can later back an in-game debug panel or a Web Worker.

Depends on: everything in core.
