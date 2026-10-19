# FillKaro — One-Click Form Filler

Save your details once. Fill placement forms, Google Forms, internship and hackathon applications in one click. FillKaro also learns the answers you type, so the next form fills itself.

## Try it on your computer

1. Unzip `fillkaro.zip`.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped `fillkaro` folder.
4. The settings page opens. Fill **My details** (it saves automatically).
5. Open any form and click the FillKaro icon → **Fill this page**, or press **Alt+Shift+F**, or right-click → *FillKaro: fill this form*.

After you change any file, press the reload icon on FillKaro's card in `chrome://extensions`.

## How it works

| Piece | What it does |
|---|---|
| **My details** | About 50 fields: personal, contact, college (CGPA, backlogs, gap, roll no.), 10th/12th, links, career. |
| **Matching** | Reads each question from its label, Google Forms heading, `aria-*`, placeholder, nearby text or field name. Understands Indian wordings: *SSC % = 10th*, *HSC / Intermediate = 12th*, *Class X*, *Year of passing*, *Dead backlogs*, *Enrollment / PRN*. |
| **Saved answers** | Questions outside your details ("Why do you want to join?", "T-shirt size"). Similar wordings match too. |
| **Save my answers from this page** | Fill a form yourself once, then click this. New answers go to Saved answers, and known fields go into My details (only if they were empty). |
| **Choices** | Picks the right option in dropdowns, radio buttons and Google Forms lists: *Male → M*, *0 backlogs → No*, *4th year → IV Year*, *MME → Metallurgical and Materials Engineering*, *8.12 → 8–9 range*. |
| **Formats** | Trims `+91` when a field takes 10 digits, writes date of birth in the format the placeholder asks for, and fills number fields with numbers only. |
| **Checkboxes** | Ticks multi-choice checkbox questions ("Skills", "Preferred roles", Google Forms checkbox lists) from your details or a saved answer like *SDE, Core*. Only ticks, never unticks. |
| **Preview** | Shows what each question will get before anything on the page changes, then **Fill these now**. |
| **Undo fill** | Puts back what the last fill changed on the page. Google Forms radio choices can't be cleared by any script, so those are reported for you to clear. |
| **Profiles** | Separate sets of details (Placements, Internships, Hackathons). Switch in the popup or on the settings page. |
| **CGPA ↔ %** | If a form asks for a percentage and you only saved CGPA (or the reverse), FillKaro converts using the multiplier in Settings (default 9.5, 0 turns it off). |
| **Typos** | Labels with small typos still match: *Adress*, *Brnach*, *Graduaton year*. |

## Safety rules built in

- Never clicks **Submit**. Never ticks a lone checkbox or any consent / terms / declaration box.
- Skips password, OTP, captcha, card, bank account, IFSC, UPI, Aadhaar and PAN fields.
- Doesn't overwrite what's already typed (can be turned on in Settings).
- A relative's question (father's mobile, emergency contact) never gets *your* details.
- Runs only when you click — no background reading of pages.

## Files

```
manifest.json        Manifest V3, permissions: storage, activeTab, scripting, contextMenus
background.js        shortcut + right-click menu
src/fields.js        the profile schema and question wordings (add new fields here)
src/engine.js        finds questions on the page, matches, fills, learns
src/store.js         storage + injection helpers
popup.html / ui/popup.*      the toolbar popup
options.html / ui/options.*  My details, Saved answers, Settings & backup
icons/               16, 32, 48, 128 px
```

To add a field, add one line to `src/fields.js` with the wordings forms use for it. The settings page and matching pick it up automatically.

## Tests and packaging (needs Node 18+)

```
npm install        # once — installs jsdom for the tests
npm test           # engine, storage and popup/settings tests, all offline
npm run package    # builds dist/fillkaro-store.zip for the Web Store
```

`package.json`, `tests/`, `node_modules/` and `dist/` are dev-only and are not put in the store zip.

## Known limits

- Works on the main page, not inside forms embedded from another website (open the Google Form link directly).
- File-upload fields (resume PDF) are left for you; Chrome doesn't let extensions pick files.
- Multi-page forms: press Fill again on each page.
- Doesn't run on `chrome://` pages or the Chrome Web Store (Chrome blocks all extensions there).

---

## Publishing on the Chrome Web Store

**Package:** run `npm run package` and upload `dist/fillkaro-store.zip` (the zip has `manifest.json` at its root).

**Category:** Tools (or Productivity › Tools).

**Short description (from manifest):**
Save your details once, fill placement forms, Google Forms & applications in one click. Learns your answers. Data stays local.

**Detailed description (starter):**
> Tired of typing your name, roll number, CGPA, 10th and 12th marks into every placement form?
> FillKaro fills them in one click.
>
> • Save your details once — personal, college, school, links, career
> • Works on Google Forms, college placement forms, internship and job applications
> • Understands Indian forms: SSC/HSC, Class X/XII, backlogs, gap years, enrollment/PRN
> • Learns your answers: fill a form once, click "Save my answers", and the next form fills itself
> • Picks dropdowns and radio options for you
> • Preview before filling, and undo a fill in one click
> • Separate profiles for placements, internships and hackathons
> • Never submits a form, never ticks consent boxes, skips passwords/OTP/Aadhaar/PAN/card fields
> • 100% private: no account, no server — everything stays in your browser
>
> Shortcut: Alt+Shift+F

**Single purpose:** Fill web forms with the user's saved details and answers.

**Permission justifications:**

| Permission | Justification to paste |
|---|---|
| `storage` | Saves the user's details and saved answers locally on their device. |
| `activeTab` | Reads and fills the form on the current tab only when the user clicks the toolbar button, presses the shortcut or uses the right-click menu. |
| `scripting` | Injects the form-filling script into the current tab at that moment. |
| `contextMenus` | Adds "Fill this form" and "Save my answers from this page" to the right-click menu. |

No host permissions are requested, so there is no "read and change all your data on all websites" warning at install.

**Data usage form:** tick *Personally identifiable information*, *Personal communications: no*, and declare that data is **not** sent off the device, not sold, and not used for anything unrelated. Link the privacy policy (`PRIVACY.md`, host it on GitHub Pages or atyant.in/fillkaro-privacy).

**Screenshots needed:** 1280×800 — popup on a Google Form after filling (green highlights), the My details page, the Saved answers page.
