# core/util

**Owner:** architect. **Status:** implemented (phase A).

Small, dependency-free helpers every module may use:

- `hash.ts` — `cyrb128`, `hashString` (128-bit hex), `StreamHasher` (incremental, order-sensitive). Pinned by tests: content hashes, save checksums and replay hashes depend on them.
- `stable-json.ts` — `stableStringify` (sorted keys; rejects non-JSON values).
- `result.ts` — `Result<T, E>`, `ok`, `err`, `EngineError` (stable `code` + developer `message`).
- `assert.ts` — `invariant`, `assertNever`, `InvariantError` (programming errors only).
- `math.ts` — deterministic math (`clamp`, `lerp`, `sq`, `powi`, `dist`, `roundHalfAway`, ...). The only approved place to add deterministic replacements for transcendental functions.
- `compare.ts` — locale-independent comparators (`compareStrings`, `chain`, `byNumber`, `byString`).
- `clone.ts` — `cloneJson`, `produce` (clone, mutate draft, return), `deepFreeze`.

Depends on: nothing. Changes: request them from the architect (see docs/design 05 §11).

## Orchestrator decisions (M1 core fix round, pending owner confirmation)
- `isReservedName` and `getOwn` (keys.ts): the shared guard against inherited names used as ids. Lookups by an id that did not come from the state itself (commands, views, `personOf`) use `getOwn`.
