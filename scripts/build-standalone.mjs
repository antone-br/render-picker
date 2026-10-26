import * as esbuild from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Build global `<script>` : render-picker + React **bundlés** en un seul IIFE pour
 * les pages sans bundler JS (PrestaShop / Smarty). Sortie `dist/render-picker.global.js`.
 * Exécuté APRÈS `tsup` (`npm run build`) pour ne pas être effacé par le `rm dist`.
 */

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = resolve(root, "dist", "render-picker.global.js");
const watch = process.argv.includes("--watch");

const options = {
  entryPoints: [resolve(root, "src/standalone.tsx")],
  outfile: out,
  bundle: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  logLevel: "info",
  minify: !watch,
  sourcemap: true,
  // React réel (pas de warnings dev) ; render-picker ne dépend pas de NODE_ENV ici.
  define: { "process.env.NODE_ENV": '"production"' },
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("render-picker standalone: watching…");
} else {
  await esbuild.build(options);
  console.log(`render-picker standalone built → ${out}`);
}
