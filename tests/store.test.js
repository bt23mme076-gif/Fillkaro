const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const { read } = require('./helpers');

/** Runs src/store.js against an in-memory chrome.storage.local. */
function withStore(initial) {
  const data = JSON.parse(JSON.stringify(initial || {}));
  const local = {
    async get(keys) { const o = {}; for (const k of keys) if (k in data) o[k] = JSON.parse(JSON.stringify(data[k])); return o; },
    async set(patch) { Object.assign(data, JSON.parse(JSON.stringify(patch))); },
    async remove(k) { for (const x of [].concat(k)) delete data[x]; }
  };
  const ctx = vm.createContext({ chrome: { storage: { local } } });
  vm.runInContext(read('src/store.js') + '\n;this.api = { fkLoad, fkMerge, fkSaveProfile };', ctx);
  return { api: ctx.api, data };
}

test('moves an old single profile into profiles', async () => {
  const { api, data } = withStore({ profile: { full_name: 'Asha' }, answers: [] });
  const d = await api.fkLoad();
  assert.equal(d.active, 'My details');
  assert.equal(d.profile.full_name, 'Asha');
  assert.equal(data.profile, undefined);
  assert.deepEqual(data.profiles, { 'My details': { full_name: 'Asha' } });
});

test('loads the active profile and saves into it', async () => {
  const { api, data } = withStore({ profiles: { A: { city: 'Pune' }, B: { city: 'Delhi' } }, active: 'B' });
  const d = await api.fkLoad();
  assert.equal(d.profile.city, 'Delhi');
  await api.fkSaveProfile({ city: 'Mumbai' });
  assert.deepEqual(data.profiles, { A: { city: 'Pune' }, B: { city: 'Mumbai' } });
});

test('falls back to the first profile when active is missing', async () => {
  const { api } = withStore({ profiles: { A: { city: 'Pune' } }, active: 'Gone' });
  assert.equal((await api.fkLoad()).active, 'A');
});

test('learn merge fills empty details of the active profile only', async () => {
  const { api, data } = withStore({ profiles: { A: { city: 'Pune' }, B: {} }, active: 'B', answers: [] });
  const out = await api.fkMerge([
    { type: 'profile', key: 'city', value: 'Nagpur' },
    { type: 'answer', q: 'T-shirt size', n: 'shirt size t', a: 'L' }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(out)), { profileAdded: 1, answersAdded: 1, answersUpdated: 0, skippedProfile: 0 });
  assert.equal(data.profiles.A.city, 'Pune');
  assert.equal(data.profiles.B.city, 'Nagpur');
  assert.equal(data.answers[0].a, 'L');
});

test('default settings include the CGPA multiplier', async () => {
  const { api } = withStore({});
  assert.equal((await api.fkLoad()).settings.cgpaScale, 9.5);
});
