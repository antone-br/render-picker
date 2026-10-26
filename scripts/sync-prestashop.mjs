import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copie le build global (`dist/render-picker.global.js` [+ .map]) dans le module
 * PrestaShop (`integrations/prestashop/renderpicker/views/js/`). Lancer après
 * `npm run build:standalone`. Le module est ensuite copié tel quel dans
 * `<site>/modules/renderpicker/` pour être installé côté PrestaShop.
 */

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, "dist");
const dest = resolve(root, "integrations/prestashop/renderpicker/views/js");

const file = resolve(dist, "render-picker.global.js");
if (!existsSync(file)) {
  console.error("dist/render-picker.global.js absent — lancer `npm run build:standalone` d'abord.");
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
copyFileSync(file, resolve(dest, "render-picker.global.js"));
const map = resolve(dist, "render-picker.global.js.map");
if (existsSync(map)) copyFileSync(map, resolve(dest, "render-picker.global.js.map"));

console.log(`render-picker global → ${dest}`);
