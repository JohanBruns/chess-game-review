// Opens the analysis tab for the in-page button. chrome.tabs.create from the service worker
// needs no user gesture, so the async PGN fetch before it can't trip the popup blocker.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== 'OPEN_ANALYSIS_TAB' || typeof msg.url !== 'string') return
  if (!/^https?:\/\//.test(msg.url)) return
  const tab = sender.tab
  chrome.tabs.create({
    url: msg.url,
    ...(tab ? { index: tab.index + 1, openerTabId: tab.id } : {}),
  })
})
