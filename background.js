// インストール・更新の直後に、すでに開いているタブへ拡張機能を注入する
// （これがないと、更新のたびにタブをリロードしないと反映されない）
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) {
    chrome.scripting
      .executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["defaults.js", "content.js"],
      })
      .catch(() => {}); // Chromeウェブストアなど、注入できないページは無視
  }
});