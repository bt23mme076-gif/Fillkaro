/* Loads the real extension files into a fake browser page (jsdom) so the engine can be tested offline. */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const FIELDS_JS = read('src/fields.js');
const ENGINE_JS = read('src/engine.js');

function page(html) {
  const dom = new JSDOM('<!doctype html><body>' + html, { runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.eval(FIELDS_JS);
  dom.window.eval(ENGINE_JS);
  const w = dom.window;
  return {
    window: w,
    doc: w.document,
    $: s => w.document.querySelector(s),
    run: (action, data) => w.FK_run(action, data || {})
  };
}

/** A Google Forms-like question: heading + one control. */
function gq(id, title, control) {
  return `<div role=listitem><div role=heading id=${id}>${title}</div>${control.replace(/LBL/g, id)}</div>`;
}
const gform = (...qs) => `<form><div role=list>${qs.join('')}</div></form>`;

/** Fake Google Forms clickable options: clicking toggles aria-checked like the real page does. */
function wireAria(p) {
  for (const r of p.doc.querySelectorAll('[role=radio]')) {
    r.addEventListener('click', () => {
      for (const o of r.closest('[role=radiogroup]').querySelectorAll('[role=radio]')) o.setAttribute('aria-checked', String(o === r));
    });
  }
  for (const c of p.doc.querySelectorAll('[role=checkbox]')) {
    c.addEventListener('click', () => c.setAttribute('aria-checked', String(c.getAttribute('aria-checked') !== 'true')));
  }
}

const PROFILE = {
  full_name: 'Asha Verma', gender: 'Female', dob: '2004-02-09', email: 'asha@example.com', phone: '+919876543210',
  city: 'Nagpur', state: 'Maharashtra', pincode: '440010', address: '12 Example Road',
  college: 'VNIT Nagpur', degree: 'B.Tech', branch: 'Metallurgical and Materials Engineering', roll_no: 'BT23MME000',
  current_year: '3rd year', grad_year: '2027', cgpa: '8.12', active_backlogs: '0', total_backlogs: '0', gap_years: '0',
  tenth_percent: '92', tenth_year: '2019', twelfth_percent: '88', twelfth_year: '2021',
  linkedin: 'https://linkedin.com/in/example', skills: 'Python, C++, SQL'
};

module.exports = { page, gq, gform, wireAria, PROFILE, ROOT, read };
