/* ==========================================================================
   NOVA WALLET · background.js
   Opens the wallet dashboard as a full extension page in a new tab when the
   toolbar icon is clicked. A full tab avoids popup sizing constraints
   (100dvh does not resolve reliably inside a popup window).
   ========================================================================== */

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
});
