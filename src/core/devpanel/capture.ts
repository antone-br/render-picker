import { initConsoleCapture } from "./console-capture";
import { initNetworkCapture } from "./network-capture";
import { addLog, addRequest } from "./store";

/**
 * Démarre la capture console + network dans le store (idempotent). Le premier
 * appelant possède le cleanup ; les suivants reçoivent un no-op. À brancher tôt
 * (init package ou montage du bouton) pour que le panneau ait un historique.
 */

let started = false;

export function startCapture(): () => void {
  if (started || typeof window === "undefined") return () => {};
  started = true;
  const stopConsole = initConsoleCapture(addLog);
  const stopNetwork = initNetworkCapture(addRequest);
  return () => {
    stopConsole();
    stopNetwork();
    started = false;
  };
}
