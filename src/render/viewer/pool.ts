/**
 * Objects reused by key (05-technical-m2 §A10: "objects reused by unit index and event seq"). A frame calls
 * `begin()`, then `get(key)` for every key it needs, then `end()`: keys not asked for are released to a free list
 * and handed to the next new key, so a long fight allocates a bounded number of visuals.
 */
interface Entry<V> {
  value: V;
  gen: number;
}

export class KeyedPool<V> {
  private readonly live = new Map<number, Entry<V>>();
  private readonly free: V[] = [];
  private gen = 0;
  /** How many visuals were ever created (live + free): the bound the tests watch. */
  created = 0;

  constructor(
    private readonly make: () => V,
    /** A visual was given to a key (new or recycled): reset what the previous owner left. */
    private readonly onAcquire: (value: V, key: number) => void,
    /** A key went away: hide the visual (it stays in the free list). */
    private readonly onRelease: (value: V) => void,
    private readonly destroyValue: (value: V) => void,
  ) {}

  get liveCount(): number {
    return this.live.size;
  }
  get freeCount(): number {
    return this.free.length;
  }

  begin(): void {
    this.gen++;
  }

  get(key: number): V {
    let entry = this.live.get(key);
    if (!entry) {
      let value = this.free.pop();
      if (value === undefined) {
        value = this.make();
        this.created++;
      }
      entry = { value, gen: this.gen };
      this.live.set(key, entry);
      this.onAcquire(value, key);
    }
    entry.gen = this.gen;
    return entry.value;
  }

  end(): void {
    for (const [key, entry] of this.live) {
      if (entry.gen === this.gen) continue;
      this.live.delete(key);
      this.onRelease(entry.value);
      this.free.push(entry.value);
    }
  }

  /** Release everything still live (a new round, a seek back before every key). */
  releaseAll(): void {
    for (const entry of this.live.values()) {
      this.onRelease(entry.value);
      this.free.push(entry.value);
    }
    this.live.clear();
  }

  clear(): void {
    for (const entry of this.live.values()) this.destroyValue(entry.value);
    for (const value of this.free) this.destroyValue(value);
    this.live.clear();
    this.free.length = 0;
    this.created = 0;
  }
}
