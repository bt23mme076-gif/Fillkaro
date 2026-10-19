const $ = s => document.querySelector(s);
const CORE = ['full_name', 'email', 'phone', 'gender', 'dob', 'address', 'city', 'state', 'college', 'degree', 'branch',
  'roll_no', 'grad_year', 'cgpa', 'tenth_percent', 'twelfth_percent', 'linkedin', 'resume_link'];
const SELECT_ONLY = new Set(['gender', 'relocate']);
let state = { profile: {}, profiles: {}, active: '', answers: [], settings: {} };
let writing = false;

function el(tag, attrs, kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v != null) e.setAttribute(k, v);
  }
  for (const c of [].concat(kids || [])) if (c) e.appendChild(c);
  return e;
}

let savedTimer;
function flashSaved() {
  const s = $('#saved');
  s.textContent = 'Saved ✓';
  s.classList.add('on');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => s.classList.remove('on'), 1400);
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
async function persist(patch) { writing = true; await chrome.storage.local.set(patch); writing = false; flashSaved(); }
const saveProfile = debounce(() => { state.profiles[state.active] = state.profile; persist({ profiles: state.profiles, active: state.active }); }, 350);
function fromLoad(d) { return { profile: d.profile, profiles: d.profiles, active: d.active, answers: d.answers, settings: d.settings }; }

// ------------------------------------------------------------ profiles
function renderProfiles() {
  const sel = $('#profileSel');
  sel.textContent = '';
  for (const n of Object.keys(state.profiles)) sel.appendChild(el('option', { value: n, text: n }));
  sel.value = state.active;
  $('#profDelete').disabled = Object.keys(state.profiles).length < 2;
}
function askName(title, current) {
  const n = (prompt(title, current || '') || '').trim().slice(0, 40);
  if (!n) return '';
  if (state.profiles[n] && n !== current) { alert('A profile with that name already exists.'); return ''; }
  return n;
}
async function switchTo(name) {
  state.active = name;
  state.profile = state.profiles[name];
  await persist({ profiles: state.profiles, active: name });
  renderProfiles(); renderDetails();
}
$('#profileSel').addEventListener('change', e => switchTo(e.target.value));
$('#profNew').addEventListener('click', () => { const n = askName('Name for the new profile (e.g. Internships)'); if (n) { state.profiles[n] = {}; switchTo(n); } });
$('#profCopy').addEventListener('click', () => { const n = askName('Name for the copy', state.active + ' copy'); if (n) { state.profiles[n] = Object.assign({}, state.profile); switchTo(n); } });
$('#profRename').addEventListener('click', () => {
  const n = askName('New name for this profile', state.active);
  if (!n || n === state.active) return;
  const next = {};
  for (const [k, v] of Object.entries(state.profiles)) next[k === state.active ? n : k] = v; // keep order
  state.profiles = next;
  switchTo(n);
});
$('#profDelete').addEventListener('click', () => {
  if (Object.keys(state.profiles).length < 2) return;
  if (!confirm(`Delete the profile “${state.active}” and its details?`)) return;
  delete state.profiles[state.active];
  switchTo(Object.keys(state.profiles)[0]);
});
const saveAnswers = debounce(() => persist({ answers: state.answers }), 350);

// ------------------------------------------------------------ details
function renderDetails() {
  const root = $('#sections');
  root.textContent = '';
  for (const sec of FK_SECTIONS) {
    const grid = el('div', { class: 'grid' });
    for (const f of FK_FIELDS.filter(x => x.section === sec)) {
      const id = 'fk-' + f.key;
      let input;
      if (f.options && SELECT_ONLY.has(f.key)) {
        input = el('select', { id }, [el('option', { value: '', text: '—' })].concat(f.options.map(o => el('option', { value: o, text: o }))));
      } else if (f.wide) {
        input = el('textarea', { id, rows: f.key === 'address' ? 3 : 2 });
      } else {
        const type = f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.type === 'url' ? 'url' : 'text';
        input = el('input', { id, type, inputmode: f.num && type === 'text' ? 'decimal' : null, list: f.options ? id + '-list' : null, autocomplete: 'off' });
      }
      input.value = state.profile[f.key] || '';
      input.addEventListener('input', () => {
        const v = input.value.trim();
        if (v) state.profile[f.key] = v; else delete state.profile[f.key];
        renderProgress();
        saveProfile();
      });
      const kids = [el('label', { for: id, text: f.label }), input];
      if (f.options && !SELECT_ONLY.has(f.key)) kids.push(el('datalist', { id: id + '-list' }, f.options.map(o => el('option', { value: o }))));
      if (f.hint) kids.push(el('small', { text: f.hint }));
      grid.appendChild(el('div', { class: 'f' + (f.wide ? ' wide' : '') }, kids));
    }
    root.appendChild(el('div', { class: 'card section' }, [el('h2', { text: sec }), grid]));
  }
  renderProgress();
}
function renderProgress() {
  const done = CORE.filter(k => String(state.profile[k] || '').trim()).length;
  $('#meter').style.width = Math.round(done / CORE.length * 100) + '%';
  $('#progressText').textContent = `${done} of ${CORE.length} key details`;
}

// ------------------------------------------------------------ answers
function renderAnswers() {
  const root = $('#answers');
  root.textContent = '';
  $('#ansCount').textContent = state.answers.length || '';
  const q = $('#search').value.trim().toLowerCase();
  const list = state.answers.filter(a => !q || (a.q + ' ' + a.a).toLowerCase().includes(q));
  if (!list.length) {
    root.appendChild(el('div', { class: 'card empty', text: state.answers.length ? 'No answers match your search.' : 'No saved answers yet. Add one above, or save them from a form you filled.' }));
    return;
  }
  for (const a of list) {
    const qi = el('input', { type: 'text', 'aria-label': 'Question' });
    qi.value = a.q;
    const ai = el('textarea', { 'aria-label': 'Answer', rows: Math.min(6, Math.max(2, Math.ceil(String(a.a).length / 80))) });
    ai.value = a.a;
    qi.addEventListener('input', () => { a.q = qi.value; a.n = FK_qkey(qi.value); a.t = Date.now(); saveAnswers(); });
    ai.addEventListener('input', () => { a.a = ai.value; a.t = Date.now(); saveAnswers(); });
    const del = el('button', {
      class: 'btn ghost danger', title: 'Delete', 'aria-label': 'Delete answer', text: 'Delete',
      onclick: async () => { state.answers = state.answers.filter(x => x !== a); await persist({ answers: state.answers }); renderAnswers(); }
    });
    root.appendChild(el('div', { class: 'card ans' }, [el('div', { class: 'head' }, [qi, del]), ai]));
  }
}
$('#addAns').addEventListener('click', async () => {
  const q = $('#newQ').value.trim(), a = $('#newA').value.trim();
  if (!q || !a) { (q ? $('#newA') : $('#newQ')).focus(); return; }
  const n = FK_qkey(q);
  const ex = state.answers.find(x => x.n === n);
  if (ex) { ex.a = a; ex.q = q; ex.t = Date.now(); } else state.answers.unshift({ q, n, a, t: Date.now() });
  await persist({ answers: state.answers });
  $('#newQ').value = ''; $('#newA').value = '';
  renderAnswers();
});
$('#search').addEventListener('input', renderAnswers);

// ------------------------------------------------------------ settings
function renderSettings() {
  $('#setOverwrite').checked = !!state.settings.overwrite;
  $('#setHighlight').checked = state.settings.highlight !== false;
  $('#setScale').value = state.settings.cgpaScale == null ? '' : state.settings.cgpaScale;
}
$('#setScale').addEventListener('input', debounce(e => {
  const v = e.target.value.trim();
  const n = v === '' ? 9.5 : parseFloat(v);
  if (isNaN(n) || n < 0 || n > 25) return;
  state.settings.cgpaScale = n;
  persist({ settings: state.settings });
}, 400));
$('#setOverwrite').addEventListener('change', e => { state.settings.overwrite = e.target.checked; persist({ settings: state.settings }); });
$('#setHighlight').addEventListener('change', e => { state.settings.highlight = e.target.checked; persist({ settings: state.settings }); });

$('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ app: 'FillKaro', version: 2, exported: new Date().toISOString(),
    profiles: state.profiles, active: state.active, answers: state.answers, settings: state.settings }, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'fillkaro-backup.json' });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$('#importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    // version 2 has profiles; version 1 had a single profile
    const src = d && d.profiles && typeof d.profiles === 'object' ? d.profiles
      : d && d.profile && typeof d.profile === 'object' ? { [FK_DEFAULT_PROFILE]: d.profile } : null;
    if (!src || !Object.keys(src).length || !Array.isArray(d.answers)) throw new Error('bad');
    if (!confirm('Replace your current details and saved answers with this backup?')) return;
    const profiles = {};
    for (const [name, p] of Object.entries(src)) {
      const clean = {};
      for (const f of FK_FIELDS) if (p && p[f.key] != null && String(p[f.key]).trim()) clean[f.key] = String(p[f.key]);
      profiles[String(name).slice(0, 40) || FK_DEFAULT_PROFILE] = clean;
    }
    const active = profiles[d.active] ? d.active : Object.keys(profiles)[0];
    const answers = d.answers.filter(a => a && a.q && a.a != null).map(a => ({ q: String(a.q), a: String(a.a), n: FK_qkey(String(a.q)), t: a.t || Date.now() }));
    state = { profile: profiles[active], profiles, active, answers, settings: Object.assign({}, FK_DEFAULT_SETTINGS, d.settings || {}) };
    await persist({ profiles, active, answers, settings: state.settings });
    renderAll();
  } catch (err) {
    alert('That file isn’t a FillKaro backup.');
  }
});
$('#wipe').addEventListener('click', async () => {
  if (!confirm('Delete all your saved details and answers from FillKaro? This can’t be undone.')) return;
  await chrome.storage.local.clear();
  state = fromLoad(await fkLoad());
  renderAll();
});

// ------------------------------------------------------------ tabs & boot
for (const b of document.querySelectorAll('[role=tab]')) {
  b.addEventListener('click', () => {
    for (const x of document.querySelectorAll('[role=tab]')) x.setAttribute('aria-selected', String(x === b));
    for (const p of document.querySelectorAll('.panel')) p.hidden = p.id !== 'tab-' + b.dataset.tab;
    location.hash = b.dataset.tab;
  });
}
function renderAll() { renderProfiles(); renderDetails(); renderAnswers(); renderSettings(); }

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local' || writing) return;
  state = fromLoad(await fkLoad());
  if (changes.answers) renderAnswers();
  if (changes.profiles || changes.active) {
    renderProfiles();
    if (changes.active || !document.activeElement.closest('#sections')) renderDetails();
  }
});

(async () => {
  state = fromLoad(await fkLoad());
  renderAll();
  const tab = location.hash.slice(1);
  if (tab) { const b = document.querySelector(`[data-tab="${tab}"]`); if (b) b.click(); }
})();
