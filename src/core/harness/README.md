# core/harness

**Owners:** sim agent (`balance.ts`), game agent (`soak.ts`). **Status:** phase A stubs with the final report shapes; `scripts/balance.ts` and `scripts/soak.ts` are the CLIs.

- `runBalance({ seed, fights, classIds })` -> `BalanceReport`: per-class appearances, wins, win rate, outliers outside `BALANCE_TARGET_BAND` (TUNABLE). Stub = coin flips.
- `runSoak({ seed, seasons })` -> `SoakReport`: the `SOAK_CHECKS` catalogue with pass/fail/pending. Stub = all pending.

Pure (no fs, no clock): the CLIs read content, time the run and write report files. The same runners can later back an in-game debug panel or a Web Worker.

Depends on: everything in core.
