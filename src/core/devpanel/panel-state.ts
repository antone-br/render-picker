/**
 * État UI persistant du panneau d'inspection (ouvert, onglet, taille, position),
 * conservé en `localStorage` pour survivre à un refresh. No-op hors navigateur.
 */

export interface PanelState {
  open: boolean;
  tab: "console" | "network";
  width: number;
  height: number;
  x: number;
  y: number;
}

const KEY = "render-picker:devpanel";

const DEFAULT: PanelState = {
  open: false,
  tab: "console",
  width: 420,
  height: 320,
  x: 80,
  y: 80,
};

export function loadPanelState(): PanelState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<PanelState>) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function savePanelState(patch: Partial<PanelState>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...loadPanelState(), ...patch }));
  } catch {
    // quota / mode privé — ignore
  }
}
