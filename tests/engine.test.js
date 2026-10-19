const test = require('node:test');
const assert = require('node:assert/strict');
const { page, gq, gform, wireAria, PROFILE } = require('./helpers');

const plain = x => JSON.parse(JSON.stringify(x));
const fill = (p, extra) => p.run('fill', Object.assign({ profile: PROFILE, answers: [], settings: {} }, extra));
const labelled = (label, attrs) => `<form><label for=x>${label}</label><input id=x ${attrs || ''}></form>`;

test('matches common question wordings to the right detail', async () => {
  const cases = {
    'Name': 'Asha Verma', 'NAME': 'Asha Verma', 'Your Name': 'Asha Verma', 'Name of the student': 'Asha Verma',
    'Name (as per records)': 'Asha Verma', 'Email ID': 'asha@example.com', 'SSC %': '92',
    'HSC / Intermediate Percentage': '88', 'Year of passing (12th)': '2021', 'Enrollment No.': 'BT23MME000',
    'Dead backlogs': '0', 'Current CGPA': '8.12', 'Pin code': '440010'
  };
  for (const [label, want] of Object.entries(cases)) {
    const p = page(labelled(label));
    await fill(p);
    assert.equal(p.$('#x').value, want, label);
  }
});

test('tolerates small typos in labels', async () => {
  const cases = { 'Adress': '12 Example Road', 'Brnach': 'Metallurgical and Materials Engineering', 'Graduaton year': '2027', 'Percentge in 10th': '92' };
  for (const [label, want] of Object.entries(cases)) {
    const p = page(labelled(label));
    await fill(p);
    assert.equal(p.$('#x').value, want, label);
  }
});

test('typo fixing does not invent matches for unrelated words', async () => {
  for (const label of ['Would you rather work remotely?', 'Hobbies', 'Favourite colour']) {
    const p = page(labelled(label));
    await fill(p);
    assert.equal(p.$('#x').value, '', label);
  }
});

test('formats phone, dates and numbers for the field', async () => {
  let p = page(labelled('Mobile No.', 'type=tel maxlength=10'));
  await fill(p); assert.equal(p.$('#x').value, '9876543210');
  p = page(labelled('Date of Birth', 'placeholder="DD/MM/YYYY"'));
  await fill(p); assert.equal(p.$('#x').value, '09/02/2004');
  p = page(labelled('Date of Birth', 'type=date'));
  await fill(p); assert.equal(p.$('#x').value, '2004-02-09');
});

test('never fills sensitive fields or a relative\'s details with yours', async () => {
  for (const label of ['Password', 'Aadhaar Number', 'OTP', 'PAN', 'Card number', "Father's mobile number", 'Emergency contact email']) {
    const p = page(labelled(label, label === 'Password' ? 'type=password' : ''));
    await fill(p);
    assert.equal(p.$('#x').value, '', label);
  }
});

test('does not overwrite typed text unless the setting is on', async () => {
  let p = page(labelled('Full name', 'value="Typed By Me"'));
  await fill(p); assert.equal(p.$('#x').value, 'Typed By Me');
  p = page(labelled('Full name', 'value="Typed By Me"'));
  await fill(p, { settings: { overwrite: true } }); assert.equal(p.$('#x').value, 'Asha Verma');
});

test('picks dropdown options, including CGPA ranges and acronyms', async () => {
  const sel = (label, opts) => `<form><label for=x>${label}</label><select id=x><option value="">Select</option>${opts.map(o => `<option>${o}</option>`).join('')}</select></form>`;
  const cases = [
    ['CGPA', ['6-7', '7-8', '8-9', '9-10'], '8-9'],
    ['CGPA', ['6 – 7', '7 – 8', '8 – 9'], '8 – 9'],
    ['CGPA', ['Below 6', '6.0-7.5', '7.5-9', '9+'], '7.5-9'],
    ['CGPA', ['Below 6', '6 to 8', '8 to 10'], '8 to 10'],
    ['Active backlogs', ['Yes', 'No'], 'No'],
    ['Current year', ['I Year', 'II Year', 'III Year', 'IV Year'], 'III Year'],
    ['Branch', ['CSE', 'ECE', 'MME', 'Civil'], 'MME'],
    ['Branch', ['Computer Science and Engineering', 'Metallurgical & Materials Engg.'], 'Metallurgical & Materials Engg.'],
    ['Gender', ['M', 'F', 'Other'], 'F'],
    ['Degree', ['B.Tech', 'M.Tech', 'MBA'], 'B.Tech']
  ];
  for (const [label, opts, want] of cases) {
    const p = page(sel(label, opts));
    await fill(p);
    assert.equal(p.$('#x').selectedOptions[0].text, want, `${label} ${JSON.stringify(opts)}`);
  }
});

test('ticks radio buttons', async () => {
  const p = page(`<form><fieldset><legend>Gender</legend>
    <label><input type=radio name=g value=m> Male</label><label><input type=radio name=g value=f> Female</label></fieldset></form>`);
  await fill(p);
  assert.deepEqual([...p.doc.querySelectorAll('[name=g]')].map(r => r.checked), [false, true]);
});

test('ticks matching checkboxes from details and saved answers', async () => {
  const p = page(`<form>
    <fieldset><legend>Skills</legend>
      <label><input type=checkbox name=s value=py> Python</label><label><input type=checkbox name=s value=java> Java</label>
      <label><input type=checkbox name=s value=cpp> C++</label><label><input type=checkbox name=s value=sql> SQL</label></fieldset>
    <fieldset><legend>Preferred roles</legend>
      <label><input type=checkbox name=r> Data analyst</label><label><input type=checkbox name=r> SDE</label><label><input type=checkbox name=r> Core</label></fieldset>
  </form>`);
  const answers = [{ q: 'Preferred roles', n: p.window.FK_qkey('Preferred roles'), a: 'SDE, Core' }];
  await fill(p, { answers });
  assert.deepEqual([...p.doc.querySelectorAll('[name=s]')].map(c => c.checked), [true, false, true, true]);
  assert.deepEqual([...p.doc.querySelectorAll('[name=r]')].map(c => c.checked), [false, true, true]);
});

test('never ticks consent or lone checkboxes', async () => {
  const p = page(`<form>
    <label><input type=checkbox id=one> Yes</label>
    <fieldset><legend>Declaration</legend><label><input type=checkbox name=d> I agree</label><label><input type=checkbox name=d> I accept the terms</label></fieldset>
  </form>`);
  const answers = [{ q: 'Declaration', n: p.window.FK_qkey('Declaration'), a: 'I agree' }];
  const r = await fill(p, { answers });
  assert.equal(p.$('#one').checked, false);
  assert.ok([...p.doc.querySelectorAll('[name=d]')].every(c => !c.checked));
  assert.equal(r.found, 0);
});

test('Google Forms: text, radio and checkbox questions', async () => {
  const opt = (v, role) => `<div role=listitem><div role=${role} aria-label="${v}" aria-checked=false></div><span>${v}</span></div>`;
  const p = page(gform(
    gq('h1', 'Name <span>*</span>', '<input type=text aria-labelledby=LBL id=t1>'),
    gq('h2', 'Roll number', '<input type=text aria-labelledby=LBL id=t2>'),
    gq('h3', 'Any active backlogs?', '<div role=radiogroup aria-labelledby=LBL><div role=radio data-value=Yes aria-checked=false></div><div role=radio data-value=No aria-checked=false></div></div>'),
    gq('h4', 'Skills you know', `<div role=list aria-labelledby=LBL>${['Python', 'Java', 'SQL'].map(v => opt(v, 'checkbox')).join('')}</div>`),
    gq('h5', 'Any active backlogs ?', `<div role=list aria-labelledby=LBL>${['Yes', 'No'].map(v => opt(v, 'checkbox')).join('')}</div>`)
  ));
  wireAria(p);
  const r = await fill(p);
  assert.equal(p.$('#t1').value, 'Asha Verma');
  assert.equal(p.$('#t2').value, 'BT23MME000');
  assert.deepEqual([...p.doc.querySelectorAll('[role=radio]')].map(o => o.getAttribute('aria-checked')), ['false', 'true']);
  const checks = [...p.doc.querySelectorAll('[role=checkbox]')].map(o => o.getAttribute('aria-checked'));
  assert.deepEqual(checks, ['true', 'false', 'true', 'false', 'true']);
  assert.equal(r.filled, 5);
});

test('preview reports the plan without changing the page', async () => {
  const p = page(`<form><label for=a>Full name</label><input id=a>
    <label for=b>Gender</label><select id=b><option value="">Select</option><option>Male</option><option>Female</option></select>
    <label for=c>T-shirt size</label><input id=c></form>`);
  const r = await p.run('preview', { profile: PROFILE, answers: [], settings: {} });
  assert.equal(r.dry, true);
  assert.equal(p.$('#a').value, '');
  assert.equal(p.$('#b').selectedIndex, 0);
  assert.deepEqual(plain(r.filledList).map(f => [f.q, f.value]), [['Full name', 'Asha Verma'], ['Gender', 'Female']]);
  assert.deepEqual(plain(r.unknown).map(u => u.q), ['T-shirt size']);
});

test('undo puts the page back after a fill', async () => {
  const p = page(`<form><label for=a>Full name</label><input id=a>
    <label for=b>Gender</label><select id=b><option value="">Select</option><option>Male</option><option>Female</option></select>
    <fieldset><legend>Current year</legend><label><input type=radio name=y> 2nd year</label><label><input type=radio name=y> 3rd year</label></fieldset>
    <fieldset><legend>Skills</legend><label><input type=checkbox name=s> Python</label><label><input type=checkbox name=s> Java</label></fieldset></form>`);
  await fill(p);
  assert.equal(p.$('#a').value, 'Asha Verma');
  const u = await p.run('undo');
  assert.equal(u.undone, 4);
  assert.equal(p.$('#a').value, '');
  assert.equal(p.$('#b').selectedIndex, 0);
  assert.ok([...p.doc.querySelectorAll('[name=y], [name=s]')].every(x => !x.checked));
  assert.deepEqual(plain(await p.run('undo')), { undone: 0, skipped: 0 });
});

test('converts CGPA to percentage when only one is saved', async () => {
  let p = page(labelled('Graduation percentage'));
  await fill(p); assert.equal(p.$('#x').value, '77.14');
  p = page(labelled('Graduation percentage'));
  await fill(p, { settings: { cgpaScale: 10 } }); assert.equal(p.$('#x').value, '81.2');
  p = page(labelled('Graduation percentage'));
  await fill(p, { settings: { cgpaScale: 0 } }); assert.equal(p.$('#x').value, '');
  p = page(labelled('CGPA'));
  await fill(p, { profile: { ug_percentage: '76' } }); assert.equal(p.$('#x').value, '8');
});

test('saved answers fill questions outside the details', async () => {
  const p = page(`<form><label for=a>T-shirt size</label><input id=a><label for=b>Why do you want to join our team?</label><textarea id=b></textarea></form>`);
  const answers = [['T-shirt size', 'L'], ['Why do you want to join this team?', 'I like building things.']]
    .map(([q, a]) => ({ q, a, n: p.window.FK_qkey(q) }));
  await fill(p, { answers });
  assert.equal(p.$('#a').value, 'L');
  assert.equal(p.$('#b').value, 'I like building things.');
});

test('learn reads typed answers, including checkbox choices', async () => {
  const p = page(`<form><label for=a>Full Name</label><input id=a value="Asha Verma"><label for=b>T-shirt size</label><input id=b value="XL">
    <fieldset><legend>Preferred roles</legend><label><input type=checkbox name=r checked> SDE</label><label><input type=checkbox name=r> Core</label><label><input type=checkbox name=r checked> Data</label></fieldset></form>`);
  const { entries } = await p.run('learn');
  assert.deepEqual(plain(entries.find(e => e.type === 'profile')), { type: 'profile', key: 'full_name', value: 'Asha Verma', q: 'Full Name' });
  assert.equal(entries.find(e => e.q === 'T-shirt size').a, 'XL');
  assert.equal(entries.find(e => e.q === 'Preferred roles').a, 'SDE, Data');
});
