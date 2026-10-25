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

/** Exhaustiveness check for discriminated unions. */
export function assertNever(value: never, context = 'value'): never {
  throw new InvariantError(`Unexpected ${context}: ${JSON.stringify(value)}`);
}
