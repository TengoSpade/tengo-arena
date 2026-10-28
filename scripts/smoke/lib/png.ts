/**
 * Just enough PNG for the smoke: decode what CDP's Page.captureScreenshot returns (8-bit RGB or RGBA, no
 * interlace) into RGBA pixels, and encode RGBA back (tests, crops). Zero dependencies: node:zlib only.
 */
import { crc32, deflateSync, inflateSync } from 'node:zlib';

export interface Rgba {
  width: number;
  height: number;
  /** width * height * 4 bytes, row-major, RGBA. */
  data: Uint8Array;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function decodePng(buf: Uint8Array): Rgba {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (b.length < 8 || !b.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG file');
  let pos = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  let palette: Buffer | null = null;
  while (pos + 8 <= b.length) {
    const len = b.readUInt32BE(pos);
    const type = b.toString('latin1', pos + 4, pos + 8);
    const body = b.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8]!;
      colorType = body[9]!;
      interlace = body[12]!;
    } else if (type === 'PLTE') palette = Buffer.from(body);
    else if (type === 'IDAT') idat.push(Buffer.from(body));
    else if (type === 'IEND') break;
  }
  if (!width || !height) throw new Error('PNG without an IHDR');
  if (depth !== 8 || interlace !== 0) throw new Error(`unsupported PNG (bit depth ${depth}, interlace ${interlace}); the smoke reads 8-bit non-interlaced screenshots`);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : colorType === 4 ? 2 : colorType === 3 ? 1 : 0;
  if (!channels) throw new Error(`unsupported PNG colour type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) throw new Error('truncated PNG data');
  const out = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  let cur = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = raw[rowStart]!;
    for (let x = 0; x < stride; x++) {
      const v = raw[rowStart + 1 + x]!;
      const a = x >= channels ? cur[x - channels]! : 0;
      const up = prev[x]!;
      const c = x >= channels ? prev[x - channels]! : 0;
      cur[x] = (filter === 0 ? v : filter === 1 ? v + a : filter === 2 ? v + up : filter === 3 ? v + ((a + up) >> 1) : v + paeth(a, up, c)) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const i = x * channels;
      if (colorType === 6) {
        out[o] = cur[i]!;
        out[o + 1] = cur[i + 1]!;
        out[o + 2] = cur[i + 2]!;
        out[o + 3] = cur[i + 3]!;
      } else if (colorType === 2) {
        out[o] = cur[i]!;
        out[o + 1] = cur[i + 1]!;
        out[o + 2] = cur[i + 2]!;
        out[o + 3] = 255;
      } else if (colorType === 0 || colorType === 4) {
        out[o] = out[o + 1] = out[o + 2] = cur[i]!;
        out[o + 3] = colorType === 4 ? cur[i + 1]! : 255;
      } else {
        const p = cur[i]! * 3;
        out[o] = palette?.[p] ?? 0;
        out[o + 1] = palette?.[p + 1] ?? 0;
        out[o + 2] = palette?.[p + 2] ?? 0;
        out[o + 3] = 255;
      }
    }
    [prev, cur] = [cur, prev];
  }
  return { width, height, data: out };
}

function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])) >>> 0, 0);
  return Buffer.concat([head, body, crc]);
}

/** Encode RGBA pixels as an 8-bit RGBA PNG (filter 0 on every row). */
export function encodePng(img: Rgba): Buffer {
  const { width, height, data } = img;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** A solid image with optional painting, for tests. */
export function makeImage(width: number, height: number, fill: [number, number, number] = [0, 0, 0]): Rgba {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

/** Paint a ring (annulus) of the given colour, centre in pixels. Test helper and fixture builder. */
export function paintRing(img: Rgba, cx: number, cy: number, outer: number, inner: number, color: [number, number, number]): void {
  for (let y = Math.max(0, Math.floor(cy - outer)); y <= Math.min(img.height - 1, Math.ceil(cy + outer)); y++) {
    for (let x = Math.max(0, Math.floor(cx - outer)); x <= Math.min(img.width - 1, Math.ceil(cx + outer)); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= outer && d >= inner) {
        const o = (y * img.width + x) * 4;
        img.data[o] = color[0];
        img.data[o + 1] = color[1];
        img.data[o + 2] = color[2];
        img.data[o + 3] = 255;
      }
    }
  }
}
