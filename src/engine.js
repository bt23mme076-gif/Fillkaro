/* FillKaro — page engine. Injected into the active tab on demand (never runs in the background).
 * FK_run('fill', data) fills the page; FK_run('learn', data) reads what the user typed.
 * It never clicks submit buttons, never ticks checkboxes, never touches password/OTP/card fields.
 */
(function (g) {
  'use strict';
  if (g.FK_run) return;

  // ---------------------------------------------------------------- text normalisation
  const STOP = new Set((
    'a an the of in on at to for and or with as per is are was were be been your you yours my our we us i me it its this that ' +
    'these those please kindly enter mention provide give write fill here will can should would could shall may do does did ' +
    'have has had any which what who whom how when where whether if eg etc ie by from into about also only just same above below ' +
    'following mandatory required optional compulsory answer details detail s'
  ).split(/\s+/));

  const TMAP = {
    mobile: 'phone', mob: 'phone', cell: 'phone', cellphone: 'phone', telephone: 'phone', tel: 'phone', ph: 'phone', phno: 'phone',
    no: 'number', num: 'number', nos: 'number', numb: 'number',
    percent: 'percentage', perc: 'percentage', pct: 'percentage',
    cpi: 'cgpa', gpa: 'cgpa',
    ssc: '10th', sslc: '10th', matric: '10th', matriculation: '10th', tenth: '10th', xth: '10th',
    hsc: '12th', intermediate: '12th', puc: '12th', twelfth: '12th', xiith: '12th', xii: '12th',
    yr: 'year', yrs: 'years', mail: 'email', emailid: 'email', gmail: 'email',
    organisation: 'organization', specialisation: 'specialization', programme: 'program',
    enrolment: 'enrollment', regd: 'registration', reg: 'registration', addr: 'address',
    pin: 'pincode', zipcode: 'pincode', zip: 'pincode', postcode: 'pincode', wa: 'whatsapp', fathers: 'father', mothers: 'mother'
  };

  function norm(s) {
    s = String(s || '');
    s = s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    s = s.replace(/%/g, ' percentage ');
    s = s.replace(/['’`]s\b/g, '');
    s = s.replace(/\be[\s.-]?mail\b/g, 'email');
    s = s.replace(/\blinked\s*-?\s*in\b/g, 'linkedin').replace(/\bgit\s*-?\s*hub\b/g, 'github').replace(/\bwhats\s*-?\s*app\b/g, 'whatsapp');
    s = s.replace(/\b(senior|higher)\s+secondary\b/g, ' 12th ').replace(/\bsecondary\s+school\b/g, ' 10th ');
    s = s.replace(/\b(class|std|standard|grade)\s*[-.]?\s*(xii|12)\s*(th)?\b/g, ' 12th ');
    s = s.replace(/\b(class|std|standard|grade)\s*[-.]?\s*(x|10)\s*(th)?\b/g, ' 10th ');
    s = s.replace(/\b10\s*th\b/g, '10th').replace(/\b12\s*th\b/g, '12th');
    s = s.replace(/\bx(th)?\s+(?=(board|marks|percentage|school|year|passing|grade|cgpa|result|score)\b)/g, '10th ');
    s = s.replace(/\bb\.\s?tech\b/g, 'btech').replace(/\bm\.\s?tech\b/g, 'mtech');
    s = s.replace(/[^a-z0-9]+/g, ' ').trim();
    return s;
  }
  function tokens(s) {
    return norm(s).split(' ').filter(Boolean).map(t => TMAP[t] || t).filter(t => !STOP.has(t));
  }
  function qkey(q) { return Array.from(new Set(tokens(q))).sort().join(' '); }
  function clean(t) {
    return String(t || '').replace(/\s+/g, ' ').replace(/\*/g, '')
      .replace(/\(\s*required\s*\)|\brequired\b/ig, '').replace(/\byour answer\b/ig, '')
      .replace(/[:\-–\s]+$/, '').trim();
  }

  // ---------------------------------------------------------------- field index
  let FIELDS = [], AC = {}, VOCAB = new Set();
  function indexFields() {
    FIELDS = (g.FK_FIELDS || []).map(f => {
      const seen = new Set(), syn = [];
      for (const s of f.syn) { const t = tokens(s); const k = t.join(' '); if (t.length && !seen.has(k)) { seen.add(k); syn.push(t); } }
      return Object.assign({}, f, { _syn: syn, _not: (f.not || []).map(n => TMAP[n] || n) });
    });
    AC = {};
    for (const f of FIELDS) for (const a of (f.ac || [])) AC[a] = f;
    VOCAB = new Set();
    for (const f of FIELDS) for (const s of f._syn) for (const t of s) if (t.length >= 6 && !REL.has(t)) VOCAB.add(t);
  }

  // ---------------------------------------------------------------- typo tolerance ("Adress", "Brnach", "Percentge")
  function editDist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const d = [];
    for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }
  const typoCache = new Map();
  function fixTypo(t) {
    if (t.length < 5 || VOCAB.has(t) || /\d/.test(t)) return t;
    if (typoCache.has(t)) return typoCache.get(t);
    const max = t.length >= 9 ? 2 : 1;
    let best = null, bestD = max + 1, tie = false;
    for (const v of VOCAB) {
      const dd = editDist(t, v, max);
      if (dd < bestD) { best = v; bestD = dd; tie = false; } else if (dd === bestD) tie = true;
    }
    const out = best && !tie ? best : t;
    typoCache.set(t, out);
    return out;
  }

  const REL = new Set(['father', 'mother', 'parent', 'parents', 'guardian', 'spouse', 'husband', 'wife', 'reference', 'referee',
    'emergency', 'sibling', 'brother', 'sister', 'friend', 'referrer', 'referral', 'manager', 'hr', 'recruiter', 'nominee', 'kin',
    'teammate', 'member', 'leader', 'captain', 'coordinator', 'mentor', 'faculty', 'hod']);

  function bestKey(text, el) {
    const a = bestKeyRaw(text, el);
    const stripped = String(text).replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');
    if (stripped === text) return a;
    const b = bestKeyRaw(stripped, el);
    return !a ? b : !b ? a : (b.score > a.score ? b : a);
  }
  function bestKeyRaw(text, el) {
    const raw = tokens(text);
    if (!raw.length) return null;
    let rel = false; for (const t of raw) if (REL.has(t)) { rel = true; break; }
    const set = new Set(raw.map(t => REL.has(t) ? t : fixTypo(t)));
    const ty = el ? String(el.getAttribute && el.getAttribute('type') || '').toLowerCase() : '';
    let best = null;
    for (const f of FIELDS) {
      if (rel && !f.rel) continue;
      if (f._not.some(t => set.has(t))) continue;
      if (ty === 'email' && f.type !== 'email') continue;
      if (ty === 'tel' && f.type !== 'tel') continue;
      if (ty === 'date' && f.type !== 'date') continue;
      if (ty === 'url' && f.type !== 'url') continue;
      if (ty === 'number' && !f.num) continue;
      for (const s of f._syn) {
        if (!s.every(t => set.has(t))) continue;
        const cov = s.length / set.size;
        if (cov < 0.34) continue;
        let score = s.length * 10 + cov * 5;
        if (f.type && f.type === ty) score += 3;
        if (!best || score > best.score) best = { key: f.key, score, field: f };
      }
    }
    return best;
  }
  function acMatch(el) {
    const ac = String(el && el.getAttribute && el.getAttribute('autocomplete') || '').toLowerCase().trim();
    if (!ac || ac === 'on' || ac === 'off') return null;
    const parts = ac.split(/\s+/);
    for (let i = parts.length - 1; i >= 0; i--) if (AC[parts[i]]) return { key: AC[parts[i]].key, field: AC[parts[i]] };
    return null;
  }
  function matchProfile(texts, el) {
    for (const t of texts) { const m = bestKey(t, el); if (m) return m; }
    return acMatch(el);
  }

  function round2(n) { return String(Math.round(n * 100) / 100); }
  function profileValue(key, p, scale) {
    const v = p[key];
    if (v != null && String(v).trim() !== '') return String(v).trim();
    scale = +scale || 0;
    if (scale > 0) {
      // CGPA ↔ percentage, using the multiplier from Settings (default 9.5)
      const cg = parseFloat(p.cgpa), pc = parseFloat(p.ug_percentage);
      if (key === 'ug_percentage' && cg > 0 && cg <= 10) return round2(Math.min(100, cg * scale));
      if (key === 'cgpa' && pc > 0 && pc <= 100) return round2(Math.min(10, pc / scale));
    }
    const parts = String(p.full_name || '').trim().split(/\s+/).filter(Boolean);
    if (key === 'first_name' && parts.length) return parts[0];
    if (key === 'last_name' && parts.length > 1) return parts[parts.length - 1];
    if (key === 'middle_name' && parts.length > 2) return parts.slice(1, -1).join(' ');
    if (key === 'full_name' && p.first_name) return [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ');
    if (key === 'whatsapp' && p.phone) return String(p.phone).trim();
    return '';
  }

  function matchAnswer(q, answers) {
    const k = qkey(q);
    if (!k) return null;
    const qs = new Set(k.split(' '));
    let best = null, bestScore = 0;
    for (const a of answers || []) {
      if (!a || !a.n || a.a == null || a.a === '') continue;
      if (a.n === k) return a;
      const as = a.n.split(' ');
      if (qs.size < 3 || as.length < 3) continue; // short questions must match exactly
      let inter = 0; for (const t of as) if (qs.has(t)) inter++;
      const jac = inter / (qs.size + as.length - inter);
      if (jac >= 0.75 && jac > bestScore) { best = a; bestScore = jac; }
    }
    return best;
  }

  // ---------------------------------------------------------------- safety
  const SENS_TOK = new Set(['password', 'passwd', 'passcode', 'otp', 'captcha', 'cvv', 'cvc', 'aadhaar', 'aadhar', 'pan', 'ifsc',
    'upi', 'ssn', 'passport', 'atm', 'iban', 'swift']);
  const SENS_PHRASE = [/\bcard number\b/, /\baccount number\b/, /\bsecurity code\b/, /\bexpiry\b/, /\bverification code\b/, /\bone time\b/];
  function isSensitive(el, texts) {
    const ac = String(el && el.getAttribute && el.getAttribute('autocomplete') || '').toLowerCase();
    if (/\bcc-|one-time-code|password/.test(ac)) return true;
    const n = norm(texts.join(' '));
    if (n.split(' ').some(t => SENS_TOK.has(t))) return true;
    return SENS_PHRASE.some(r => r.test(n));
  }

  // ---------------------------------------------------------------- DOM reading
  function visible(el) {
    if (!el || el.hidden) return false;
    if (typeof el.checkVisibility === 'function') return el.checkVisibility({ visibilityProperty: true, opacityProperty: false });
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.hidden) return false;
      const cs = n.ownerDocument.defaultView.getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
  }
  function textExcluding(root, exclude) {
    if (!root) return '';
    const doc = root.ownerDocument;
    const walker = doc.createTreeWalker(root, 4 /* SHOW_TEXT */);
    const out = [];
    let node;
    outer: while ((node = walker.nextNode())) {
      for (let p = node.parentElement; p && p !== root.parentElement; p = p.parentElement) {
        const tag = p.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SELECT' || tag === 'OPTION' || tag === 'BUTTON' || tag === 'TEXTAREA') continue outer;
        if (p.getAttribute('aria-hidden') === 'true') continue outer;
        for (const ex of exclude) if (ex === p || (ex.contains && ex.contains(p))) continue outer;
      }
      out.push(node.nodeValue);
    }
    return clean(out.join(' '));
  }
  function txt(n) { return n ? textExcluding(n, []) : ''; }
  function humanize(s) {
    s = String(s || '');
    if (!s || /\d{3,}/.test(s) || /^(entry|input|field|q|question|text|textbox|ctl)[\W_]*\d*$/i.test(s)) return '';
    return s.replace(/[_\-.[\]]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  const CTRL = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), textarea, select, [role=radiogroup], [role=listbox], [contenteditable=true]';

  function nearbyText(el, exclude, maxControls) {
    let node = el;
    for (let i = 0; i < 4 && node.parentElement; i++) {
      node = node.parentElement;
      if (node.tagName === 'FORM' || node.tagName === 'BODY') break;
      if (node.querySelectorAll(CTRL).length > maxControls) break;
      const t = textExcluding(node, exclude);
      if (t) return t.length <= 220 ? t : '';
    }
    // label sitting just before the control's container (e.g. <p>Name</p><div><input></div>)
    let prev = (el.parentElement && el.parentElement.querySelectorAll(CTRL).length <= maxControls ? el.parentElement : el).previousElementSibling;
    if (prev && !prev.querySelector(CTRL)) { const t = txt(prev); if (t && t.length <= 160) return t; }
    return '';
  }

  function pushText(out, t) { t = clean(t); if (t && t.length <= 300 && out.indexOf(t) < 0) out.push(t); }
  function byIds(ids, doc) { return String(ids || '').split(/\s+/).map(id => txt(id && doc.getElementById(id))).join(' '); }

  function controlTexts(el) {
    const doc = el.ownerDocument, out = [];
    pushText(out, byIds(el.getAttribute('aria-labelledby'), doc));
    if (el.labels) for (const l of el.labels) pushText(out, textExcluding(l, [el]));
    pushText(out, el.getAttribute('aria-label'));
    const item = el.closest('[role=listitem]');
    if (item) { const h = item.querySelector('[role=heading]'); if (h) pushText(out, txt(h)); }
    pushText(out, nearbyText(el, [el], 1));
    pushText(out, el.getAttribute('placeholder'));
    pushText(out, el.getAttribute('title'));
    pushText(out, humanize(el.getAttribute('name')));
    pushText(out, humanize(el.id));
    return out;
  }
  function groupTexts(container, optionEls, firstEl) {
    const doc = container.ownerDocument, out = [];
    pushText(out, byIds(container.getAttribute('aria-labelledby'), doc));
    pushText(out, container.getAttribute('aria-label'));
    const item = container.closest('[role=listitem]');
    if (item) { const h = item.querySelector('[role=heading]'); if (h) pushText(out, txt(h)); }
    const fs = (firstEl || container).closest('fieldset');
    if (fs) { const lg = fs.querySelector('legend'); if (lg) pushText(out, txt(lg)); }
    const exclude = [];
    for (const o of optionEls) { exclude.push(o); if (o.labels) for (const l of o.labels) exclude.push(l); }
    let node = container, groupSize = container.querySelectorAll(CTRL).length;
    for (let i = 0; i < 4 && node; i++) {
      if (node.tagName === 'FORM' || node.tagName === 'BODY') break;
      if (node.querySelectorAll(CTRL).length > groupSize) break;
      const t = textExcluding(node, exclude);
      if (t) { if (t.length <= 220) pushText(out, t); break; }
      node = node.parentElement;
    }
    const prev = container.previousElementSibling;
    if (prev && !prev.querySelector(CTRL)) { const t = txt(prev); if (t.length <= 160) pushText(out, t); }
    if (firstEl) pushText(out, humanize(firstEl.getAttribute('name')));
    return out;
  }

  function radioLabel(r) {
    let t = '';
    if (r.labels && r.labels.length) t = textExcluding(r.labels[0], [r]);
    if (!t) t = r.getAttribute('aria-label') || '';
    if (!t && r.nextSibling) t = (r.nextSibling.textContent || '').trim();
    return clean(t || r.value);
  }
  function ariaOptLabel(o) { return clean(o.getAttribute('data-value') || o.getAttribute('aria-label') || txt(o)); }

  function lowestCommonAncestor(els) {
    let a = els[0].parentElement;
    while (a && !els.every(e => a.contains(e))) a = a.parentElement;
    return a || els[0].ownerDocument.body;
  }

  const TEXT_TYPES = new Set(['', 'text', 'email', 'tel', 'number', 'url', 'date']);

  function isOtherBox(el, texts) {
    if (texts.length && /^(other|others|if other|please specify|specify|other response)\b/i.test(texts[0])) return true;
    const grp = el.closest('[role=radiogroup], [role=group], [role=list]');
    if (!grp || !grp.querySelector('[role=radio], [role=checkbox], input[type=radio], input[type=checkbox]')) return false;
    // the group must sit inside this question, not be the whole list of questions
    const item = el.closest('[role=listitem]');
    return !item || item.contains(grp) || !grp.querySelector('[role=listitem] [role=heading]');
  }

  // consent / declaration boxes are never ticked, even when a saved answer seems to match
  const CONSENT = /\b(agree|agreed|accept|consent|terms|conditions|declare|declaration|certify|confirm|undertake|undertaking|hereby|privacy|policy|acknowledge|authori[sz]e|i have read|subscribe|newsletter|remember me|keep me)\b/i;
  function isConsent(texts, opts) {
    return CONSENT.test(texts.join(' ')) || opts.some(o => CONSENT.test(o));
  }

  function collect(doc) {
    const items = [];
    const seenRadio = new Set(), seenCheck = new Set();
    for (const el of doc.querySelectorAll('input, textarea, select')) {
      const tag = el.tagName.toLowerCase();
      const type = tag === 'input' ? String(el.getAttribute('type') || '').toLowerCase() : tag;
      if (el.disabled || !visible(el)) continue;
      if (tag === 'input' && type === 'checkbox') {
        if (seenCheck.has(el)) continue;
        // group by name, else by the nearest fieldset / list item
        const scope = el.closest('fieldset, [role=group], [role=listitem]');
        const group = Array.from(doc.querySelectorAll('input[type=checkbox]')).filter(c => !c.disabled && c.form === el.form &&
          (el.name ? c.name === el.name : (scope ? scope.contains(c) && !c.name : c === el)));
        group.forEach(c => seenCheck.add(c));
        if (group.length < 2) continue; // a lone checkbox is almost always "I agree"
        const box = lowestCommonAncestor(group);
        const texts = groupTexts(box, group, el);
        const opts = group.map(radioLabel);
        if (isSensitive(el, texts) || isConsent(texts, opts)) continue;
        items.push({ kind: 'checkbox', els: group, box, texts, opts });
        continue;
      }
      if (tag === 'input' && type === 'radio') {
        if (!el.name) continue;
        const key = el.name + '|' + (el.form ? Array.prototype.indexOf.call(doc.forms, el.form) : -1);
        if (seenRadio.has(key)) continue;
        seenRadio.add(key);
        const group = Array.from(doc.querySelectorAll('input[type=radio]')).filter(r => r.name === el.name && r.form === el.form && !r.disabled);
        const box = lowestCommonAncestor(group);
        const texts = groupTexts(box, group, el);
        if (isSensitive(el, texts)) continue;
        items.push({ kind: 'radio', els: group, box, texts, opts: group.map(radioLabel) });
        continue;
      }
      if (tag === 'input' && !TEXT_TYPES.has(type)) continue;
      if (el.readOnly) continue;
      const texts = controlTexts(el);
      if (isSensitive(el, texts) || isOtherBox(el, texts)) continue;
      items.push({ kind: tag === 'select' ? 'select' : 'text', el, box: el, type, texts });
    }
    for (const grp of doc.querySelectorAll('[role=radiogroup]')) {
      if (grp.querySelector('input[type=radio]') || !visible(grp)) continue;
      const opts = Array.from(grp.querySelectorAll('[role=radio]'));
      if (!opts.length) continue;
      const texts = groupTexts(grp, opts);
      if (isSensitive(grp, texts)) continue;
      items.push({ kind: 'ariaradio', el: grp, box: grp, els: opts, texts, opts: opts.map(ariaOptLabel) });
    }
    const seenAria = new Set();
    for (const cb of doc.querySelectorAll('[role=checkbox]')) {
      if (cb.tagName === 'INPUT' || seenAria.has(cb)) continue;
      // nearest group/list holding several checkboxes, but not the form's whole list of questions
      let grp = null;
      for (let n = cb.parentElement; n && n.tagName !== 'FORM' && n.tagName !== 'BODY'; n = n.parentElement) {
        const role = n.getAttribute('role');
        if (role !== 'group' && role !== 'list') continue;
        if (n.querySelector('[role=listitem] [role=heading]')) break;
        if (n.querySelectorAll('[role=checkbox]').length >= 2) { grp = n; break; }
      }
      if (!grp || !visible(grp)) { seenAria.add(cb); continue; }
      const opts = Array.from(grp.querySelectorAll('[role=checkbox]')).filter(o => o.tagName !== 'INPUT');
      opts.forEach(o => seenAria.add(o));
      if (opts.length < 2) continue;
      const texts = groupTexts(grp, opts);
      const labels = opts.map(ariaOptLabel);
      if (isSensitive(grp, texts) || isConsent(texts, labels)) continue;
      items.push({ kind: 'ariacheck', el: grp, box: grp, els: opts, texts, opts: labels });
    }
    for (const lb of doc.querySelectorAll('[role=listbox]')) {
      if (lb.closest('select') || !visible(lb)) continue;
      const opts = Array.from(lb.querySelectorAll('[role=option]'));
      if (!opts.length) continue;
      const texts = groupTexts(lb, opts);
      if (isSensitive(lb, texts)) continue;
      items.push({ kind: 'listbox', el: lb, box: lb, els: opts, texts, opts: opts.map(ariaOptLabel) });
    }
    return items;
  }

  // ---------------------------------------------------------------- reading current values
  function isPlaceholderOpt(o) {
    return !o || o.value === '' || /^(--|select|choose|please select|pick)/i.test(String(o.text || '').trim());
  }
  function currentValue(item) {
    switch (item.kind) {
      case 'text': return String(item.el.value || '').trim();
      case 'select': {
        const o = item.el.options[item.el.selectedIndex];
        return isPlaceholderOpt(o) ? '' : String(o.text || o.value).trim();
      }
      case 'radio': { const i = item.els.findIndex(r => r.checked); return i >= 0 ? item.opts[i] : ''; }
      case 'ariaradio': { const i = item.els.findIndex(o => o.getAttribute('aria-checked') === 'true'); return i >= 0 ? item.opts[i] : ''; }
      case 'checkbox': return item.opts.filter((_, i) => item.els[i].checked).join(', ');
      case 'ariacheck': return item.opts.filter((_, i) => item.els[i].getAttribute('aria-checked') === 'true').join(', ');
      case 'listbox': {
        const i = item.els.findIndex(o => o.getAttribute('aria-selected') === 'true');
        return i >= 0 && item.opts[i] && !/^(choose|select)$/i.test(item.opts[i]) ? item.opts[i] : '';
      }
    }
    return '';
  }

  // ---------------------------------------------------------------- option matching
  function lite(s) { return String(s || '').toLowerCase().replace(/(\d)\s*[-–—]\s*(?=\d)/g, '$1 to ').replace(/(?<!\d)\.|\.(?!\d)/g, '').replace(/[\-_/()]/g, '').replace(/[^a-z0-9+. ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  const GROUPS = [
    ['yes', 'y', 'true', 'willing', 'yes i am', 'yes i am willing'],
    ['no', 'n', 'false', 'none', 'nil', '0', 'zero', 'na', 'not applicable', 'no backlogs', 'no gap'],
    ['male', 'm', 'man', 'boy'], ['female', 'f', 'woman', 'girl'],
    ['other', 'others', 'non binary', 'nonbinary'], ['prefer not to say', 'prefer not to disclose', 'rather not say'],
    ['general', 'gen', 'open', 'unreserved', 'ur'],
    ['1st year', 'first year', 'i year', '1', 'fy'], ['2nd year', 'second year', 'ii year', '2', 'sy'],
    ['3rd year', 'third year', 'iii year', '3', 'ty'], ['4th year', 'fourth year', 'final year', 'iv year', '4'],
    ['btech', 'b tech', 'bachelor of technology'], ['be', 'b e', 'bachelor of engineering'],
    ['mtech', 'm tech', 'master of technology']
  ];
  function groupOf(s) { for (let i = 0; i < GROUPS.length; i++) if (GROUPS[i].indexOf(s) >= 0) return i; return -1; }
  function optScore(optText, value) {
    const o = lite(optText), v = lite(value);
    if (!o || !v) return 0;
    if (o === v) return 100;
    if (o.replace(/ /g, '') === v.replace(/ /g, '')) return 98;
    const go = groupOf(o), gv = groupOf(v);
    if (go >= 0 && go === gv) return 90;
    const num = /^\d+(\.\d+)?$/.test(v) ? parseFloat(v) : null;
    if (num !== null) {
      if (/^\d+(\.\d+)?$/.test(o)) return parseFloat(o) === num ? 95 : 0;
      const N = '(\\d+(?:\\.\\d+)?)';
      let m = o.match(new RegExp('^' + N + '\\s*(\\+|or more|and above|above|more)')); if (m && num >= +m[1]) return 75;
      m = o.match(new RegExp('^(more than|above|greater than)\\s*' + N)); if (m && num > +m[2]) return 75;
      m = o.match(new RegExp('^' + N + '\\s*(to|-| )\\s*' + N + '\\b')); if (m && num >= +m[1] && num <= +m[3]) return 80;
      if (num > 0 && go === 0) return 60;
      return 0;
    }
    if (o.length >= 2 && v.length >= 2 && (o.indexOf(v) === 0 || v.indexOf(o) === 0)) return 70;
    const ow = words(o), vw = words(v);
    // acronyms: "MME" ↔ "Metallurgical and Materials Engineering", "CSE" ↔ "Computer Science & Engg"
    if (ow.length === 1 && vw.length >= 2 && ow[0] === vw.map(t => t[0]).join('')) return 85;
    if (vw.length === 1 && ow.length >= 2 && vw[0] === ow.map(t => t[0]).join('')) return 85;
    // word overlap, where "engg" ~ "engineering" and "metallurgy" ~ "metallurgical"
    let inter = 0;
    for (const a of ow) if (vw.some(b => wordLike(a, b))) inter++;
    if (inter) {
      const both = Math.round(90 * inter / Math.max(ow.length, vw.length));
      const allOpt = inter === ow.length ? 60 : 0;
      return Math.max(both, allOpt);
    }
    if (v.length >= 3 && o.indexOf(v) >= 0) return 50;
    if (o.length >= 4 && v.indexOf(o) >= 0) return 45;
    return 0;
  }
  const OPT_STOP = new Set(['and', 'of', 'the', 'in', 'with', 'for', '&']);
  function words(s) { return s.split(' ').filter(t => t && !OPT_STOP.has(t)); }
  function wordLike(a, b) {
    if (a === b) return true;
    if (a.length >= 3 && b.length >= 3 && (a.indexOf(b) === 0 || b.indexOf(a) === 0)) return true;
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i >= 6;
  }
  function pickOption(labels, value) {
    let best = -1, bestScore = 44;
    labels.forEach((l, i) => {
      if (!l || /^(--|select|choose|please select)/i.test(l)) return;
      const s = optScore(l, value);
      if (s > bestScore) { bestScore = s; best = i; }
    });
    return best;
  }

  // ---------------------------------------------------------------- writing values
  function setNative(el, v) {
    const win = el.ownerDocument.defaultView;
    const proto = el.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT' ? win.HTMLSelectElement.prototype : win.HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, v); else el.value = v;
    el.dispatchEvent(new win.Event('input', { bubbles: true }));
    el.dispatchEvent(new win.Event('change', { bubbles: true }));
    el.dispatchEvent(new win.FocusEvent('blur'));
    el.dispatchEvent(new win.FocusEvent('focusout', { bubbles: true }));
  }
  function clickLike(el) {
    const win = el.ownerDocument.defaultView;
    for (const t of ['mousedown', 'mouseup', 'click']) el.dispatchEvent(new win.MouseEvent(t, { bubbles: true, cancelable: true, view: win }));
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function toISO(v) {
    v = String(v || '').trim();
    let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    return '';
  }
  function formatDate(v, hint) {
    const iso = toISO(v); if (!iso) return v;
    const [y, mo, d] = iso.split('-');
    const h = String(hint || '').toLowerCase();
    const sepM = h.match(/[dmy]{1,4}\s*([\/.\-])/); const sep = sepM ? sepM[1] : '/';
    if (/y{2,4}\s*[\/.\-]\s*m{1,2}/.test(h)) return [y, mo, d].join(sep);
    if (/m{1,2}\s*[\/.\-]\s*d{1,2}/.test(h)) return [mo, d, y].join(sep);
    return [d, mo, y].join(sep);
  }

  function fitText(item, value, key) {
    const el = item.el, type = item.type;
    let v = String(value);
    if (type === 'date') { v = toISO(v); return v || null; }
    if (key === 'dob') v = formatDate(v, el.getAttribute('placeholder') || item.texts.join(' '));
    if (type === 'number') { v = v.replace(/[^0-9.\-]/g, ''); return v && !isNaN(+v) ? v : null; }
    const max = el.maxLength;
    if ((type === 'tel' || key === 'phone' || key === 'alt_phone' || key === 'whatsapp') && max > 0) {
      const digits = v.replace(/\D/g, '');
      if (v.length > max) v = digits.length > max ? digits.slice(-max) : digits;
    }
    return v;
  }

  /** Options to tick for a multi-choice answer like "Python, Java; C++". */
  function pickMany(labels, value) {
    const parts = String(value).split(/\s*[,;\n]\s*/).filter(Boolean);
    const out = new Set();
    for (const p of parts) { const i = pickOption(labels, p); if (i >= 0) out.add(i); }
    if (!out.size) { const i = pickOption(labels, value); if (i >= 0) out.add(i); }
    return Array.from(out);
  }

  async function selectListbox(item, i) {
    const target = item.els[i];
    if (target.getAttribute('aria-selected') === 'true') return;
    const dv = item.opts[i];
    clickLike(item.el);
    await sleep(400);
    const live = Array.from(item.el.ownerDocument.querySelectorAll('[role=option]')).filter(o => ariaOptLabel(o) === dv);
    clickLike(live.find(o => o !== target && visible(o)) || target);
    await sleep(300);
  }

  /**
   * Plans the write for one question and returns { show, apply } (or null when no option fits).
   * show = the text the user sees in Preview; apply() writes it and returns an undo function.
   * An undo function returns false when the page can't be put back (e.g. Google Forms radios can't be cleared).
   */
  function planItem(item, value, key) {
    switch (item.kind) {
      case 'text': {
        const v = fitText(item, value, key);
        if (v == null || v === '') return null;
        return { show: v, apply: () => { const prev = item.el.value; setNative(item.el, v); return () => { setNative(item.el, prev); return true; }; } };
      }
      case 'select': {
        const opts = Array.from(item.el.options);
        const i = pickOption(opts.map(o => o.text || o.value), value);
        if (i < 0) return null;
        return {
          show: opts[i].text || opts[i].value,
          apply: () => {
            const prev = item.el.selectedIndex;
            setNative(item.el, opts[i].value);
            if (item.el.selectedIndex !== i) item.el.selectedIndex = i;
            return () => { setNative(item.el, prev >= 0 ? opts[prev].value : ''); item.el.selectedIndex = prev; return true; };
          }
        };
      }
      case 'radio': {
        const i = pickOption(item.opts, value);
        if (i < 0) return null;
        return {
          show: item.opts[i],
          apply: () => {
            const prev = item.els.find(r => r.checked);
            item.els[i].click();
            return () => {
              if (prev) { prev.click(); return true; }
              const r = item.els[i], win = r.ownerDocument.defaultView;
              r.checked = false;
              r.dispatchEvent(new win.Event('input', { bubbles: true }));
              r.dispatchEvent(new win.Event('change', { bubbles: true }));
              return true;
            };
          }
        };
      }
      case 'ariaradio': {
        const i = pickOption(item.opts, value);
        if (i < 0) return null;
        return {
          show: item.opts[i],
          apply: () => {
            const prev = item.els.find(o => o.getAttribute('aria-checked') === 'true');
            clickLike(item.els[i]);
            return () => { if (!prev) return false; clickLike(prev); return true; };
          }
        };
      }
      case 'checkbox':
      case 'ariacheck': {
        const idx = pickMany(item.opts, value);
        if (!idx.length) return null;
        const isOn = el => item.kind === 'checkbox' ? el.checked : el.getAttribute('aria-checked') === 'true';
        const press = el => item.kind === 'checkbox' ? el.click() : clickLike(el);
        return {
          show: idx.map(i => item.opts[i]).join(', '),
          apply: () => {
            const pressed = idx.map(i => item.els[i]).filter(el => !isOn(el)); // only tick, never untick
            pressed.forEach(press);
            return () => { pressed.forEach(el => { if (isOn(el)) press(el); }); return true; };
          }
        };
      }
      case 'listbox': {
        const i = pickOption(item.opts, value);
        if (i < 0) return null;
        return {
          show: item.opts[i],
          apply: async () => {
            const p = item.els.findIndex(o => o.getAttribute('aria-selected') === 'true');
            const prev = p >= 0 && !/^(choose|select)$/i.test(item.opts[p]) ? p : -1;
            await selectListbox(item, i);
            return async () => { if (prev < 0) return false; await selectListbox(item, prev); return true; };
          }
        };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- highlight
  function mark(doc, items, enabled) {
    if (!enabled) return;
    if (!doc.getElementById('fk-style')) {
      const st = doc.createElement('style');
      st.id = 'fk-style';
      st.textContent = '[data-fk=ok]{outline:2px solid #16a34a!important;outline-offset:2px!important;border-radius:4px}' +
        '[data-fk=todo]{outline:2px dashed #f59e0b!important;outline-offset:2px!important;border-radius:4px}';
      (doc.head || doc.documentElement).appendChild(st);
    }
    for (const [el, state] of items) el.setAttribute('data-fk', state);
    setTimeout(() => { for (const [el] of items) el.removeAttribute('data-fk'); }, 9000);
  }

  // ---------------------------------------------------------------- actions
  let UNDO = []; // undo functions from the last fill on this page

  /** dry = true plans the fill and reports it without touching the page (Preview). */
  async function fill(doc, data, dry) {
    const profile = data.profile || {}, answers = data.answers || [], settings = data.settings || {};
    const scale = settings.cgpaScale == null ? 9.5 : settings.cgpaScale;
    const items = collect(doc);
    const res = { found: items.length, filled: 0, fromProfile: 0, fromAnswers: 0, alreadyFilled: 0, unknown: [], filledList: [], dry: !!dry };
    const marks = [], undo = [];
    for (const item of items) {
      const q = item.texts[0] || '';
      if (!settings.overwrite && currentValue(item)) { res.alreadyFilled++; continue; }
      const m = matchProfile(item.texts, item.el || item.els[0]);
      let value = '', src = '';
      if (m) { value = profileValue(m.key, profile, scale); if (value) src = 'profile'; }
      if (!value && q) { const a = matchAnswer(q, answers); if (a) { value = a.a; src = 'answer'; } }
      let plan = null, ok = false;
      if (value) {
        try {
          plan = planItem(item, value, m && m.key);
          if (plan && !dry) { undo.push(await plan.apply()); }
          ok = !!plan;
        } catch (e) { ok = false; }
      }
      if (ok) {
        res.filled++;
        if (src === 'profile') res.fromProfile++; else res.fromAnswers++;
        res.filledList.push({ q, value: plan.show, src, key: m && src === 'profile' ? m.key : null });
        marks.push([item.box, 'ok']);
      } else if (q) {
        res.unknown.push({ q, key: m ? m.key : null });
        marks.push([item.box, 'todo']);
      }
    }
    if (!dry) { if (undo.length) UNDO = undo; mark(doc, marks, settings.highlight !== false); }
    res.canUndo = UNDO.length > 0;
    return res;
  }

  async function undoLast() {
    const list = UNDO; UNDO = [];
    let undone = 0, skipped = 0;
    for (const fn of list.reverse()) {
      try { (await fn()) ? undone++ : skipped++; } catch (e) { skipped++; }
    }
    return { undone, skipped };
  }

  function learn(doc) {
    const entries = [];
    for (const item of collect(doc)) {
      let v = currentValue(item);
      if (!v) continue;
      const q = item.texts[0];
      if (!q) continue;
      const m = matchProfile(item.texts, item.el || item.els[0]);
      if (m) {
        if (m.key === 'dob') v = toISO(v) || v;
        entries.push({ type: 'profile', key: m.key, value: v, q });
      } else {
        const n = qkey(q);
        if (n) entries.push({ type: 'answer', q, n, a: v });
      }
    }
    return { entries };
  }

  async function run(action, data, doc) {
    indexFields();
    doc = doc || g.document;
    if (action === 'fill') return fill(doc, data || {});
    if (action === 'preview') return fill(doc, data || {}, true);
    if (action === 'undo') return undoLast();
    if (action === 'learn') return learn(doc);
    if (action === 'scan') return { items: collect(doc).map(i => ({ kind: i.kind, texts: i.texts, match: (matchProfile(i.texts, i.el || i.els[0]) || {}).key || null })) };
    return null;
  }

  g.FK_run = run;
  g.FK_qkey = qkey;
  g.FK_tokens = tokens;
})(typeof globalThis !== 'undefined' ? globalThis : window);
