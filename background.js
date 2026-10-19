/* FillKaro — background service worker: keyboard shortcut, right-click menu, first-run setup. */
importScripts('src/store.js');

chrome.runtime.onInstalled.addListener(details => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'fk-fill', title: 'FillKaro: fill this form', contexts: ['page', 'editable', 'frame'] });
    chrome.contextMenus.create({ id: 'fk-learn', title: 'FillKaro: save my answers from this page', contexts: ['page', 'editable', 'frame'] });
  });
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});

async function badge(tabId, text, color) {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color });
    await chrome.action.setBadgeText({ tabId, text });
    setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 5000);
  } catch (e) { /* tab closed */ }
}

async function runFromShortcut(tab, action) {
  if (!tab || tab.id == null) return;
  try {
    const res = await fkRunOnTab(tab.id, action);
    if (action === 'fill') await badge(tab.id, res.filled ? String(res.filled) : '0', res.filled ? '#16a34a' : '#f59e0b');
    else {
      const s = res.summary || {};
      const n = (s.answersAdded || 0) + (s.answersUpdated || 0) + (s.profileAdded || 0);
      await badge(tab.id, '+' + n, '#ff6b1a');
    }
  } catch (e) {
    await badge(tab.id, '!', '#dc2626');
  }
}

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'fill-form') return;
  if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  runFromShortcut(tab, 'fill');
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'fk-fill') runFromShortcut(tab, 'fill');
  if (info.menuItemId === 'fk-learn') runFromShortcut(tab, 'learn');
});
