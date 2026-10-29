/**
 * Dossier admin exposé par le module PrestaShop (`Media::addJsDef`, voir
 * `integrations/prestashop/renderpicker/renderpicker.php`) — utilisé pour construire le
 * lien "Copier l'URL de configuration" du menu overlay modules
 * (`src/core/inspector/surfaces/module-overlays.ts`). Pur côté lecture (pas de logique),
 * même pattern que `resolveProjectRoot`.
 */

export function resolveAdminDir(win: Window): string | undefined {
  const v = (win as unknown as { renderPickerAdminDir?: string }).renderPickerAdminDir;
  return v || undefined;
}
