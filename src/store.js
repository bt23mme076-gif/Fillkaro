/* FillKaro — storage + tab injection helpers (shared by popup, options page and background worker). */
const FK_DEFAULT_SETTINGS = { overwrite: false, highlight: true, cgpaScale: 9.5 };
const FK_DEFAULT_PROFILE = 'My details';

/**
 * Storage: profiles = { name: {...details} }, active = name of the profile in use.
 * Older versions kept a single `profile`; it is moved into profiles on first load.
 */
async function fkLoad() {
  const d = await chrome.storage.local.get(['profile', 'profiles', 'active', 'answers', 'settings', 'stats']);
  let profiles = d.profiles && typeof d.profiles === 'object' && Object.keys(d.profiles).length ? d.profiles : null;
  if (!profiles) {
    profiles = { [FK_DEFAULT_PROFILE]: d.profile || {} };
    if (d.profile) { await chrome.storage.local.set({ profiles, active: FK_DEFAULT_PROFILE }); await chrome.storage.local.remove('profile'); }
  }
  const active = profiles[d.active] ? d.active : Object.keys(profiles)[0];
  return {
    profile: profiles[active],
    profiles,
    active,
    answers: Array.isArray(d.answers) ? d.answers : [],
    settings: Object.assign({}, FK_DEFAULT_SETTINGS, d.settings || {}),
    stats: Object.assign({ filled: 0 }, d.stats || {})
  };
}

/** Save the details of the active profile. */
async function fkSaveProfile(profile) {
  const data = await fkLoad();
  data.profiles[data.active] = profile;
  await chrome.storage.local.set({ profiles: data.profiles, active: data.active });
}

/** Merge entries returned by the page "learn" action into storage. */
async function fkMerge(entries) {
  const data = await fkLoad();
  const out = { profileAdded: 0, answersAdded: 0, answersUpdated: 0, skippedProfile: 0 };
  for (const e of entries || []) {
    if (e.type === 'profile') {
      if (!String(data.profile[e.key] || '').trim()) { data.profile[e.key] = e.value; out.profileAdded++; }
      else if (String(data.profile[e.key]).trim() !== String(e.value).trim()) out.skippedProfile++;
    } else if (e.type === 'answer' && e.n) {
      const ex = data.answers.find(a => a.n === e.n);
      if (!ex) { data.answers.unshift({ q: e.q, n: e.n, a: e.a, t: Date.now() }); out.answersAdded++; }
      else if (ex.a !== e.a) { ex.a = e.a; ex.q = e.q; ex.t = Date.now(); out.answersUpdated++; }
    }
  }
  data.profiles[data.active] = data.profile;
  await chrome.storage.local.set({ profiles: data.profiles, answers: data.answers });
  return out;
}

/** Inject the engine into a tab and run an action ('fill' | 'preview' | 'undo' | 'learn'). Main frame only. */
async function fkRunOnTab(tabId, action) {
  const data = await fkLoad();
  await chrome.scripting.executeScript({ target: { tabId }, files: ['src/fields.js', 'src/engine.js'] });
  const [r] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (a, d) => globalThis.FK_run(a, d),
    args: [action, { profile: data.profile, answers: data.answers, settings: data.settings }]
  });
  const res = r && r.result;
  if (!res) throw new Error('No response from the page');
  if (action === 'learn') res.summary = await fkMerge(res.entries);
  if (action === 'fill' && res.filled) {
    data.stats.filled += res.filled;
    await chrome.storage.local.set({ stats: data.stats });
  }
  return res;
}

function fkFriendlyError(e, url) {
  const msg = String((e && e.message) || e || '');
  if (/^(chrome|edge|about|chrome-extension|devtools|view-source):/.test(url || '') || /chrome\.google\.com\/webstore|chromewebstore\.google\.com/.test(url || '') ||
      /Cannot access|cannot be scripted|extensions gallery/i.test(msg)) {
    return 'Chrome doesn’t let extensions work on this page. Open a normal website or form.';
  }
  if (/file:\/\//.test(url || '')) return 'For local files, turn on “Allow access to file URLs” for FillKaro in chrome://extensions.';
  return 'Couldn’t run on this page: ' + msg;
}
