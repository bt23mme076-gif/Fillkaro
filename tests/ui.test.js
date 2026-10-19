const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { read } = require('./helpers');

/** Loads popup.html / options.html with their scripts and a fake chrome API. */
function loadPage(file, stored, runResult) {
  const html = read(file).replace(/<script[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'chrome-extension://test/' + file });
  const w = dom.window;
  const data = JSON.parse(JSON.stringify(stored || {}));
  const listeners = [];
  const calls = [];
  w.chrome = {
    storage: {
      local: {
        async get(keys) { const o = {}; for (const k of keys) if (k in data) o[k] = JSON.parse(JSON.stringify(data[k])); return o; },
        async set(p) {
          const changes = {}; for (const k of Object.keys(p)) changes[k] = { newValue: p[k] };
          Object.assign(data, JSON.parse(JSON.stringify(p)));
          for (const l of listeners) l(changes, 'local');
        },
        async remove(k) { for (const x of [].concat(k)) delete data[x]; },
        async clear() { for (const k of Object.keys(data)) delete data[k]; }
      },
      onChanged: { addListener: fn => listeners.push(fn) }
    },
    tabs: { query: async () => [{ id: 1, url: 'https://docs.google.com/forms/x' }] },
    scripting: {
      async executeScript(o) { calls.push(o); return o.files ? [] : [{ result: runResult(o.args[0]) }]; }
    },
    runtime: { openOptionsPage() {} }
  };
  w.prompt = () => w.__promptAnswer;
  w.confirm = () => true;
  w.alert = () => {};
  const errors = [];
  w.addEventListener('error', e => errors.push(e.error || e.message));
  for (const src of (read(file).match(/<script src="([^"]+)"/g) || []).map(s => s.slice(13, -1))) w.eval(read(src));
  return { w, $: s => w.document.querySelector(s), data, calls, errors };
}
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));

test('popup: preview, fill now and undo render results', async () => {
  const results = {
    preview: { found: 2, filled: 1, fromProfile: 1, fromAnswers: 0, alreadyFilled: 0, dry: true, unknown: [{ q: 'T-shirt size', key: null }], filledList: [{ q: 'Name', value: 'Asha', src: 'profile' }] },
    fill: { found: 2, filled: 1, fromProfile: 1, fromAnswers: 0, alreadyFilled: 0, unknown: [], filledList: [{ q: 'Name', value: 'Asha', src: 'profile' }] },
    undo: { undone: 1, skipped: 1 }
  };
  const p = loadPage('popup.html', { profiles: { A: { full_name: 'Asha' }, B: {} }, active: 'A' }, a => results[a]);
  await tick();
  assert.equal(p.$('#profilePick').hidden, false);
  assert.equal(p.$('#profilePick').options.length, 2);

  p.$('#preview').click(); await tick();
  assert.match(p.$('#result').textContent, /Will fill 1 field/);
  assert.match(p.$('#result').textContent, /Name → Asha/);

  p.$('#fillNow').click(); await tick();
  assert.match(p.$('#result').textContent, /Filled 1 field/);
  assert.match(p.$('#result').textContent, /What was filled/);
  assert.equal(p.data.stats.filled, 1);

  p.$('#undo').click(); await tick();
  assert.match(p.$('#result').textContent, /Undid 1 field/);
  assert.match(p.$('#result').textContent, /couldn’t be cleared/);

  const pick = p.$('#profilePick');
  pick.value = 'B'; pick.dispatchEvent(new p.w.Event('change')); await tick();
  assert.equal(p.data.active, 'B');
  assert.deepEqual(p.errors, []);
});

test('options: create, rename, switch and delete profiles; edits save to the active one', async () => {
  const p = loadPage('options.html', { profile: { full_name: 'Asha' }, answers: [] });
  await tick();
  assert.equal(p.$('#profileSel').value, 'My details');
  assert.equal(p.$('#fk-full_name').value, 'Asha');

  p.w.__promptAnswer = 'Internships';
  p.$('#profNew').click(); await tick();
  assert.equal(p.data.active, 'Internships');
  assert.equal(p.$('#fk-full_name').value, '');

  const city = p.$('#fk-city');
  city.value = 'Pune'; city.dispatchEvent(new p.w.Event('input')); await tick(450);
  assert.equal(p.data.profiles.Internships.city, 'Pune');
  assert.equal(p.data.profiles['My details'].city, undefined);

  p.w.__promptAnswer = 'Hackathons';
  p.$('#profRename').click(); await tick();
  assert.deepEqual(Object.keys(p.data.profiles), ['My details', 'Hackathons']);

  p.$('#profDelete').click(); await tick();
  assert.deepEqual(Object.keys(p.data.profiles), ['My details']);
  assert.equal(p.$('#fk-full_name').value, 'Asha');
  assert.equal(p.$('#profDelete').disabled, true);
  assert.deepEqual(p.errors, []);
});

test('options: CGPA multiplier setting saves', async () => {
  const p = loadPage('options.html', {});
  await tick();
  assert.equal(p.$('#setScale').value, '9.5');
  const s = p.$('#setScale');
  s.value = '10'; s.dispatchEvent(new p.w.Event('input')); await tick(450);
  assert.equal(p.data.settings.cgpaScale, 10);
  assert.deepEqual(p.errors, []);
});
