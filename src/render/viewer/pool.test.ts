import { describe, expect, it } from 'vitest';
import { KeyedPool } from './pool';

interface V {
  id: number;
  owner: number;
  hidden: boolean;
  destroyed: boolean;
}

function makePool() {
  let n = 0;
  const pool = new KeyedPool<V>(
    () => ({ id: n++, owner: -1, hidden: false, destroyed: false }),
    (v, key) => {
      v.owner = key;
      v.hidden = false;
    },
    (v) => {
      v.hidden = true;
    },
    (v) => {
      v.destroyed = true;
    },
  );
  return pool;
}

describe('KeyedPool (objects reused by id)', () => {
  it('gives the same object to the same key across frames', () => {
    const pool = makePool();
    pool.begin();
    const a = pool.get(5);
    pool.end();
    pool.begin();
    expect(pool.get(5)).toBe(a);
    pool.end();
    expect(pool.created).toBe(1);
  });

  it('releases keys that are not asked for and recycles their object for a new key', () => {
    const pool = makePool();
    pool.begin();
    const a = pool.get(1);
    const b = pool.get(2);
    pool.end();
    pool.begin();
    pool.get(2);
    pool.end();
    expect(a.hidden).toBe(true);
    expect(b.hidden).toBe(false);
    expect(pool.freeCount).toBe(1);
    pool.begin();
    pool.get(2);
    const c = pool.get(3);
    pool.end();
    expect(c).toBe(a); // recycled, not allocated
    expect(c.owner).toBe(3);
    expect(c.hidden).toBe(false);
    expect(pool.created).toBe(2);
  });

  it('allocates a bounded number of objects over a long run of ever-new keys', () => {
    const pool = makePool();
    for (let frame = 0; frame < 2000; frame++) {
      pool.begin();
      for (let k = 0; k < 6; k++) pool.get(frame * 6 + k); // 6 live at once, all new each frame
      pool.end();
    }
    expect(pool.created).toBeLessThanOrEqual(12);
  });

  it('releaseAll hides everything and clear destroys it', () => {
    const pool = makePool();
    pool.begin();
    const a = pool.get(1);
    pool.end();
    pool.releaseAll();
    expect(a.hidden).toBe(true);
    expect(pool.liveCount).toBe(0);
    pool.clear();
    expect(a.destroyed).toBe(true);
    expect(pool.created).toBe(0);
  });
});
