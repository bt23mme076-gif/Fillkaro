const $ = s => document.querySelector(s);
const CORE = ['full_name', 'email', 'phone', 'gender', 'dob', 'address', 'city', 'state', 'college', 'degree', 'branch',
  'roll_no', 'grad_year', 'cgpa', 'tenth_percent', 'twelfth_percent', 'linkedin', 'resume_link'];
const LABEL = Object.fromEntries((globalThis.FK_FIELDS || []).map(f => [f.key, f.label]));

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

async function renderProfile() {
  const { profile, profiles, active, answers } = await fkLoad();
  const names = Object.keys(profiles);
  const pick = $('#profilePick');
  pick.hidden = names.length < 2;
  pick.textContent = '';
  for (const n of names) { const o = document.createElement('option'); o.value = n; o.textContent = 'Fill as: ' + n; o.selected = n === active; pick.appendChild(o); }
  const done = CORE.filter(k => String(profile[k] || '').trim()).length;
  const pct = Math.round(done / CORE.length * 100);
  $('#meter').style.width = pct + '%';
  $('#profileLabel').textContent = done ? `Your details · ${pct}%` : 'Add your details first';
  $('#profileHint').textContent = done
    ? `${done} of ${CORE.length} key details · ${answers.length} saved answer${answers.length === 1 ? '' : 's'}`
    : 'Takes 2 minutes. After that, every form is one click.';
  $('#profileCard').classList.toggle('empty', !done);
  $('#editProfile').textContent = done ? 'Edit' : 'Add now';
}

function show(cls, html) {
  const r = $('#result');
  r.className = 'result ' + cls;
  r.innerHTML = html;
  r.hidden = false;
}

async function act(action) {
  const btn = $('#' + action);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  btn.disabled = true;
  try {
    const res = await fkRunOnTab(tab.id, action);
    if (action === 'fill' || action === 'preview') renderFill(res);
    else if (action === 'undo') renderUndo(res);
    else renderLearn(res);
  } catch (e) {
    show('err', `<h3>Can’t fill here</h3><p>${esc(fkFriendlyError(e, tab && tab.url))}</p>`);
  } finally {
    btn.disabled = false;
    renderProfile();
  }
}

function filledItems(list) {
  return list.map(f => `<li title="${esc(f.q + ' → ' + f.value)}"><b>${esc(f.q)}</b> <span>→ ${esc(f.value)}</span></li>`).join('');
}

function renderPreview(r) {
  const list = r.filledList || [], unknown = r.unknown || [];
  if (!list.length) {
    show('warn', `<h3>Nothing would be filled</h3><p>${r.alreadyFilled ? `${r.alreadyFilled} already filled · ` : ''}${unknown.length} question${unknown.length === 1 ? '' : 's'} not in your details or saved answers.</p>`);
    return;
  }
  let html = `<h3>Will fill ${list.length} field${list.length === 1 ? '' : 's'}</h3><p>Nothing on the page has changed yet.</p><ul>${filledItems(list)}</ul>`;
  if (unknown.length) html += `<details><summary>${unknown.length} left for you</summary><ul>${unknown.map(u => `<li>${esc(u.q)}</li>`).join('')}</ul></details>`;
  html += '<button class="btn primary" id="fillNow">Fill these now</button>';
  show('ok', html);
  $('#fillNow').addEventListener('click', () => act('fill'));
}

function renderUndo(r) {
  if (!r.undone && !r.skipped) { show('warn', '<h3>Nothing to undo</h3><p>Undo works on the last fill on this page, until you reload it.</p>'); return; }
  show(r.skipped ? 'warn' : 'ok', `<h3>Undid ${r.undone} field${r.undone === 1 ? '' : 's'}</h3>` +
    (r.skipped ? `<p>${r.skipped} choice${r.skipped === 1 ? '' : 's'} couldn’t be cleared (Google Forms has no way to unselect) — use the form’s “Clear selection”.</p>` : '<p>The page is back to how it was.</p>'));
}

function renderFill(r) {
  if (r.dry) return renderPreview(r);
  const unknown = r.unknown || [];
  if (!r.found) {
    show('warn', '<h3>No form found on this page</h3><p>If the form is inside a frame or opens later, open it fully and try again.</p>');
    return;
  }
  if (!r.filled && !unknown.length) {
    show('ok', `<h3>Nothing to fill</h3><p>${r.alreadyFilled} field${r.alreadyFilled === 1 ? ' is' : 's are'} already filled. Turn on “overwrite” in settings to replace them.</p>`);
    return;
  }
  const parts = [];
  if (r.fromProfile) parts.push(`${r.fromProfile} from your details`);
  if (r.fromAnswers) parts.push(`${r.fromAnswers} from saved answers`);
  if (r.alreadyFilled) parts.push(`${r.alreadyFilled} already filled`);
  let html = `<h3>${r.filled ? `Filled ${r.filled} field${r.filled === 1 ? '' : 's'}` : 'Couldn’t fill anything yet'}</h3><p>${parts.join(' · ') || 'Check the highlighted fields.'}</p>`;
  if (unknown.length) {
    const missingProfile = unknown.filter(u => u.key).map(u => LABEL[u.key]).filter(Boolean);
    html += `<ul>${unknown.slice(0, 12).map(u => `<li title="${esc(u.q)}">${u.key ? '＋ ' : ''}${esc(u.q)}</li>`).join('')}</ul>`;
    html += missingProfile.length
      ? `<div class="tip">Add <b>${esc([...new Set(missingProfile)].slice(0, 3).join(', '))}</b> to your details, or type answers yourself and tap <b>Save my answers</b> — next time they fill automatically.</div>`
      : `<div class="tip">Type these yourself, then tap <b>Save my answers from this page</b> — next time they fill automatically.</div>`;
  }
  if (r.filledList && r.filledList.length) html += `<details><summary>What was filled</summary><ul>${filledItems(r.filledList)}</ul></details>`;
  show(unknown.length ? 'warn' : 'ok', html);
}

function renderLearn(r) {
  const s = r.summary || {};
  const total = (s.answersAdded || 0) + (s.answersUpdated || 0) + (s.profileAdded || 0);
  if (!total) {
    show('warn', `<h3>Nothing new to save</h3><p>${s.skippedProfile ? 'Your saved details already cover these fields.' : 'Fill some answers on the page first, then tap Save.'}</p>`);
    return;
  }
  const parts = [];
  if (s.answersAdded) parts.push(`${s.answersAdded} new answer${s.answersAdded === 1 ? '' : 's'}`);
  if (s.answersUpdated) parts.push(`${s.answersUpdated} updated`);
  if (s.profileAdded) parts.push(`${s.profileAdded} added to your details`);
  show('ok', `<h3>Saved ${total} answer${total === 1 ? '' : 's'}</h3><p>${parts.join(' · ')}. They’ll fill automatically on the next form.</p>`);
}

$('#fill').addEventListener('click', () => act('fill'));
$('#preview').addEventListener('click', () => act('preview'));
$('#undo').addEventListener('click', () => act('undo'));
$('#learn').addEventListener('click', () => act('learn'));
$('#profilePick').addEventListener('change', async e => { await chrome.storage.local.set({ active: e.target.value }); renderProfile(); });
$('#openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('#editProfile').addEventListener('click', e => { e.preventDefault(); chrome.runtime.openOptionsPage(); });
renderProfile();
