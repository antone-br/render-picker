import * as esbuild from "esbuild";
import {
  copyFileSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = dirname(fileURLToPath(import.meta.url));
const out = resolve(root, "dist");
const watch = process.argv.includes("--watch");

rmSync(out, { recursive: true, force: true });
mkdirSync(resolve(out, "icons"), { recursive: true });

const common = {
  bundle: true,
  format: "iife",
  target: "chrome110",
  jsx: "automatic",
  logLevel: "info",
  minify: !watch,
  sourcemap: true,
  define: {
    "process.env.NODE_ENV": watch ? '"development"' : '"production"',
  },
};

const entries = [
  "content.tsx",
  "main-world.ts",
  "options.tsx",
  "background.ts",
];

// Page options minimale (charge options.js).
const OPTIONS_HTML = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>render-picker — options</title></head><body><div id="root"></div><script src="options.js"></script></body></html>`;

// --- Encodeur PNG maison (RGBA, zéro dépendance) pour générer les icônes ---

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "latin1");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** Icône render-picker : cercle accent #3b82f6 + viseur blanc. */
function renderIcon(size) {
  const c = size / 2;
  const r = size * 0.46;
  const lw = Math.max(1, size * 0.06); // épaisseur des traits
  const arm = r * 0.78; // longueur des bras du viseur
  const dot = size * 0.09;
  const px = Buffer.alloc(size * size * 4); // RGBA

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const dist = Math.hypot(dx, dy);
      let rr = 0, gg = 0, bb = 0, aa = 0;
      if (dist <= r) {
        [rr, gg, bb, aa] = [59, 130, 246, 255]; // accent
        const onCross =
          (Math.abs(dx) <= lw / 2 && Math.abs(dy) <= arm) ||
          (Math.abs(dy) <= lw / 2 && Math.abs(dx) <= arm);
        if (onCross || dist <= dot) [rr, gg, bb] = [255, 255, 255];
      }
      const i = (y * size + x) * 4;
      px[i] = rr;
      px[i + 1] = gg;
      px[i + 2] = bb;
      px[i + 3] = aa;
    }
  }

  // Scanlines avec byte de filtre 0 en tête de chaque ligne.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function writeAssets() {
  copyFileSync(resolve(root, "manifest.json"), resolve(out, "manifest.json"));
  writeFileSync(resolve(out, "options.html"), OPTIONS_HTML);
  for (const n of [16, 48, 128]) writeFileSync(resolve(out, `icons/${n}.png`), renderIcon(n));
}

const ctxs = await Promise.all(
  entries.map((e) =>
    esbuild.context({
      ...common,
      entryPoints: [resolve(root, "src/entries", e)],
      outfile: resolve(out, `${e.replace(/\.tsx?$/, "")}.js`),
    }),
  ),
);

writeAssets();

if (watch) {
  await Promise.all(ctxs.map((c) => c.watch()));
  console.log("render-picker extension: watching…");
} else {
  await Promise.all(
    ctxs.map(async (c) => {
      await c.rebuild();
      await c.dispose();
    }),
  );
  console.log(`render-picker extension built → ${out}`);
}
