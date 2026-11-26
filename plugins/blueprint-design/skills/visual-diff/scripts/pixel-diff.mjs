#!/usr/bin/env node
// Pixel diff of two 8-bit PNG files, standard library only.
// Usage: pixel-diff.mjs reference.png actual.png [--threshold <percent>] [--out diff.png]
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

function chunks(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG file');
  const out = [];
  for (let i = 8; i < buf.length; ) {
    const len = buf.readUInt32BE(i);
    out.push({ type: buf.toString('latin1', i + 4, i + 8), data: buf.subarray(i + 8, i + 8 + len) });
    i += 12 + len;
  }
  return out;
}

// Returns { width, height, rgba } for an 8-bit, non-interlaced grey, RGB, grey+alpha or RGBA PNG.
export function decodePng(buf) {
  const parts = chunks(buf);
  const head = parts.find((c) => c.type === 'IHDR')?.data;
  if (!head) throw new Error('PNG has no header');
  const [width, height, depth, colour, , , interlace] = [head.readUInt32BE(0), head.readUInt32BE(4), head[8], head[9], head[10], head[11], head[12]];
  if (depth !== 8 || !(colour in CHANNELS) || interlace !== 0) throw new Error('only 8-bit non-interlaced PNG is supported');
  const bpp = CHANNELS[colour];
  const raw = inflateSync(Buffer.concat(parts.filter((c) => c.type === 'IDAT').map((c) => c.data)));
  const stride = width * bpp;
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`bad PNG filter ${filter}`);
      px[y * stride + x] = (line[x] + add) & 255;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * bpp;
    const [r, g, b, a] = colour === 0 ? [px[s], px[s], px[s], 255] : colour === 4 ? [px[s], px[s], px[s], px[s + 1]] : [px[s], px[s + 1], px[s + 2], colour === 6 ? px[s + 3] : 255];
    rgba.set([r, g, b, a], i * 4);
  }
  return { width, height, rgba };
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

export function encodePng({ width, height, rgba }) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), body.length + 4);
    return out;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([SIGNATURE, chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// A pixel differs when any channel moves by more than tolerance (0 to 255).
export function diffImages(a, b, tolerance = 0) {
  if (a.width !== b.width || a.height !== b.height) return { sizeMismatch: true, total: a.width * a.height, changed: 0, percent: 100 };
  const total = a.width * a.height;
  const out = Buffer.alloc(total * 4);
  let changed = 0;
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    const differs = [0, 1, 2, 3].some((k) => Math.abs(a.rgba[o + k] - b.rgba[o + k]) > tolerance);
    if (differs) {
      changed++;
      out.set([255, 0, 0, 255], o);
    } else out.set([a.rgba[o], a.rgba[o + 1], a.rgba[o + 2], 90], o);
  }
  return { sizeMismatch: false, total, changed, percent: total ? (changed / total) * 100 : 0, image: { width: a.width, height: a.height, rgba: out } };
}

function main(argv) {
  const files = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
  const opt = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
  const limit = Number(opt('--threshold', '0.5'));
  const gate = (status, failed, extra) => {
    console.log(`FACTORY_GATES: status=${status} passed=${status === 'PASS' ? 1 : 0} failed=${failed ? 1 : 0} skipped=0 failed_gates=${failed ? 'visual-diff' : ''}`);
    if (extra) console.log(`visual-diff: ${extra}`);
    process.exitCode = status === 'PASS' ? 0 : 1;
  };
  if (files.length !== 2 || !Number.isFinite(limit)) return gate('MISCONFIGURED', false, 'usage: pixel-diff.mjs reference.png actual.png [--threshold percent] [--out diff.png]');
  let r;
  try {
    r = diffImages(decodePng(readFileSync(files[0])), decodePng(readFileSync(files[1])));
  } catch (e) {
    return gate('MISCONFIGURED', false, e.message);
  }
  if (r.sizeMismatch) return gate('FAIL', true, 'the two images have different sizes');
  if (opt('--out')) writeFileSync(opt('--out'), encodePng(r.image));
  const pct = Math.round(r.percent * 100) / 100;
  gate(r.percent <= limit ? 'PASS' : 'FAIL', r.percent > limit, `${pct}% of ${r.total} pixels differ (limit ${limit}%)`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main(process.argv.slice(2));
