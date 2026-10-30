/**
 * Frame statistics (ViewerStats): frame intervals while the ticker runs and the CPU time of our per-frame work
 * (clock + sampleAt + scene update). Fixed ring buffers, no allocation per frame.
 */
const CAPACITY = 240;

export class RingStats {
  private readonly values = new Float64Array(CAPACITY);
  private count = 0;
  private next = 0;

  push(value: number): void {
    this.values[this.next] = value;
    this.next = (this.next + 1) % CAPACITY;
    if (this.count < CAPACITY) this.count++;
  }

  clear(): void {
    this.count = 0;
    this.next = 0;
  }

  get size(): number {
    return this.count;
  }

  mean(last = CAPACITY): number {
    const n = Math.min(last, this.count);
    if (n === 0) return 0;
    let sum = 0;
    for (let i = 1; i <= n; i++) sum += this.values[(this.next - i + CAPACITY) % CAPACITY]!;
    return sum / n;
  }

  /** Percentile 0..1 (nearest rank) over everything held. */
  percentile(p: number): number {
    if (this.count === 0) return 0;
    const sorted = Array.from(this.values.subarray(0, this.count)).sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]!;
  }
}
