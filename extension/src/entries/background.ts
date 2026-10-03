/**
 * Service worker : clic sur l'icône → arme/désarme le picker sur l'onglet actif.
 * Si le content script n'est pas présent (URL hors `matches`), on l'injecte à la
 * demande via `chrome.scripting` (autorisé par `activeTab`), puis on renvoie le
 * message → l'icône marche sur n'importe quel onglet scriptable.
 */
chrome.action.onClicked.addListener((tab) => {
  const tabId = tab.id;
  if (tabId === undefined) return;

  const toggle = () =>
    chrome.tabs.sendMessage(tabId, { type: "render-picker:toggle" });

  toggle().catch(async () => {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
      await toggle();
    } catch (e) {
      console.warn(
        "[render-picker] onglet non scriptable (chrome://, store, PDF…) :",
        e,
      );
    }
  });
});
