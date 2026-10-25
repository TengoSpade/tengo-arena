/**
 * Browser implementations of the platform contracts: file download/upload,
 * wall clock, entropy for new-game seeds. The desktop build (M7) swaps these.
 */
import type { Clock, FileIO } from './save-store';

export const browserFileIO: FileIO = {
  download(fileName, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  async readText(file) {
    return file.text();
  },
};

export const browserClock: Clock = {
  nowIso: () => new Date().toISOString(),
  nowMs: () => Date.now(),
};

/** Four 32-bit words from crypto.getRandomValues (new-game root seed, 05 §6). */
export function browserEntropy(): number[] {
  const words = new Uint32Array(4);
  crypto.getRandomValues(words);
  return [...words];
}
