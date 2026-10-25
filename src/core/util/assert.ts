/** Thrown for broken invariants (programming errors), never for expected failures. */
export class InvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvariantError';
  }
}

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new InvariantError(message);
}

/** Thrown by contract-first stubs whose implementation has not landed yet. */
export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`Not implemented yet: ${what}`);
    this.name = 'NotImplementedError';
  }
}

/** Body of a contract-first stub: `return notImplemented('module.f', ...params)` (params are passed so they count as used). */
export function notImplemented(what: string, ..._args: unknown[]): never {
  throw new NotImplementedError(what);
}

/** Exhaustiveness check for discriminated unions. */
export function assertNever(value: never, context = 'value'): never {
  throw new InvariantError(`Unexpected ${context}: ${JSON.stringify(value)}`);
}
