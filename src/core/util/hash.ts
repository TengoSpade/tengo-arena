/**
 * Non-cryptographic string hashing used for seed derivation, content hashes,
 * save checksums and event-stream hashes. 32-bit integer math only
 * (Math.imul, >>>), so results are identical on every JS engine.
 */

/**
 * cyrb128: 128-bit hash of a string as four unsigned 32-bit words.
 * Public-domain algorithm by bryc (github.com/bryc/code).
 * Do NOT change: seeds, save checksums and replay hashes depend on it.
 */
export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** Unsigned 32-bit word as 8 lowercase hex characters. */
export function u32Hex(n: number): string {
  return (n >>> 0).toString(16).padStart(8, '0');
}

/** 128-bit hash of a string as 32 lowercase hex characters. */
export function hashString(str: string): string {
  const [a, b, c, d] = cyrb128(str);
  return u32Hex(a) + u32Hex(b) + u32Hex(c) + u32Hex(d);
}

/**
 * Incremental hasher for long sequences (e.g. a fight's event stream) without
 * building one huge string. Each chunk is hashed and folded into a running
 * 128-bit state; the result depends on chunk boundaries and order.
 */
export class StreamHasher {
  private acc: [number, number, number, number] = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a];
  private count = 0;

  update(chunk: string): this {
    const [a, b, c, d] = cyrb128(chunk);
    const [w, x, y, z] = this.acc;
    // Order-sensitive fold: rotate-and-mix the accumulator with the chunk hash.
    this.acc = [
      (Math.imul(w ^ a, 0x85ebca6b) + this.count) >>> 0,
      Math.imul(x ^ b, 0xc2b2ae35) >>> 0,
      Math.imul(y ^ c, 0x27d4eb2f) >>> 0,
      Math.imul(z ^ d, 0x165667b1) >>> 0,
    ];
    this.count++;
    return this;
  }

  digest(): string {
    const [w, x, y, z] = this.acc;
    return hashString(`${u32Hex(w)}${u32Hex(x)}${u32Hex(y)}${u32Hex(z)}:${this.count}`);
  }
}
