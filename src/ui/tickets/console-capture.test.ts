import { describe, expect, it, vi } from 'vitest';
import { consoleEntries, entryText, installConsoleCapture } from './console-capture';

describe('console capture', () => {
  it('logs through the original first, then records a capped entry', () => {
    const seen: number[] = [];
    const original = vi.fn(() => seen.push(consoleEntries().length));
    const before = { error: console.error, warn: console.warn };
    console.error = original;
    console.warn = vi.fn();
    try {
      installConsoleCapture();
      console.error('boom', { a: 1 });
      expect(original).toHaveBeenCalledWith('boom', { a: 1 });
      expect(seen).toEqual([0]); // the entry did not exist yet when the original ran
      expect(consoleEntries().at(-1)).toMatchObject({ level: 'error', message: 'boom {"a":1}' });

      // A hostile argument (throwing getter, cycle, huge string) never breaks logging.
      const hostile: Record<string, unknown> = {
        get bad() {
          throw new Error('no');
        },
      };
      hostile['self'] = hostile;
      expect(() => console.warn(hostile, 'y'.repeat(10_000))).not.toThrow();
      const last = consoleEntries().at(-1)!;
      expect(last.level).toBe('warn');
      expect(last.message.length).toBeLessThanOrEqual(2000);
      expect(last.message).toContain('"bad":"?"');

      window.dispatchEvent(new ErrorEvent('error', { error: new Error('uncaught one'), message: 'uncaught one' }));
      expect(consoleEntries().at(-1)!.message).toContain('uncaught one');
    } finally {
      console.error = before.error;
      console.warn = before.warn;
    }
  });

  it('serializes deep and wide values cheaply (depth 3, 20 keys, 200 characters)', () => {
    const deep = { a: { b: { c: { d: { e: 1 } } } } };
    expect(entryText([deep])).toBe('{"a":{"b":{"c":"{…}"}}}');
    const wide = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(JSON.parse(entryText([wide])) as object)).toHaveLength(20);
    expect(entryText([{ s: 'z'.repeat(500) }])).toHaveLength('{"s":""}'.length + 201);
    expect(entryText([[1, 2, 3], 10n, Symbol('x')])).toBe('[1,2,3] "10" "Symbol(x)"');
  });
});
