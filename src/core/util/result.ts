/**
 * Explicit success/failure values for operations whose failure is expected
 * (invalid command, invalid content, corrupt save). Programming errors still
 * throw (see assert.ts).
 */
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

export function err<E>(error: E): { readonly ok: false; readonly error: E } {
  return { ok: false, error };
}

/**
 * Error value returned by engine operations. `code` is a stable,
 * machine-readable identifier (e.g. "lineup.size", "save.checksum") that UI
 * maps to player-facing text; `message` is developer-facing English.
 */
export interface EngineError {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export function engineError(code: string, message: string, details?: Record<string, unknown>): EngineError {
  return details === undefined ? { code, message } : { code, message, details };
}
