# Chrome Web Store listing — paste-ready

## Store listing tab

**Description** (paste as is)

```
Tired of typing your name, roll number, CGPA, 10th and 12th marks into every placement form? FillKaro fills them in one click.

WHAT IT DOES
• Save your details once — personal, contact, college, 10th/12th, links and career
• Click Fill (or press Alt+Shift+F) on any form — Google Forms, college placement portals, internship, job and hackathon applications
• Understands Indian forms: SSC/HSC, Class X/XII, Intermediate, CGPA, active and dead backlogs, gap years, enrollment/PRN/USN
• Picks dropdowns, radio buttons and checkbox lists for you: Male → M, 0 backlogs → No, 8.12 → "8–9", MME → Metallurgical and Materials Engineering
• Learns your answers: fill a form once, click "Save my answers", and the next form fills itself
• Converts CGPA to percentage when a form asks for % (multiplier you choose, default 9.5)
• Matches labels even with small typos ("Adress", "Brnach")

STAY IN CONTROL
• Preview shows exactly what will go into each field before anything changes
• Undo puts the page back after a fill
• Profiles: keep separate details for placements, internships and hackathons
• Highlights filled fields in green and the ones left for you in amber
• Never overwrites what you typed (unless you turn that on)

SAFE BY DESIGN
• Never submits a form for you
• Never ticks "I agree", terms or declaration boxes
• Skips password, OTP, captcha, card, bank, IFSC, UPI, Aadhaar and PAN fields
• A relative's question (father's mobile, emergency contact) never gets your details
• Runs only when you click — it does not read pages in the background

100% PRIVATE
No account, no server, no analytics. Everything stays in your browser's local storage. Export a backup any time, or delete all data in one click.

HOW TO START
1. Install FillKaro — the settings page opens.
2. Fill "My details" (it saves automatically).
3. Open any form → click the FillKaro icon → Fill this page.
```

**Category:** Tools

**Language:** English (UK) — or English (India) if offered

**Store icon:** upload `icons/icon128.png`

**Screenshots:** upload in this order from `store/images/`
1. `screenshot-1-fill.png` — a form filled in one click
2. `screenshot-2-preview.png` — preview before filling
3. `screenshot-3-details.png` — the My details page with profiles
4. `screenshot-4-safety.png` — what it never touches

**Small promo tile:** `store/images/promo-small-440x280.png`
**Marquee promo tile:** `store/images/promo-marquee-1400x560.png` (optional)

**Homepage URL / Support URL:** your GitHub repository URL (or its Issues page for support). Leave blank if you don't have one yet.

**Mature content:** No

## Privacy tab

**Single purpose**

```
FillKaro fills web forms with details and answers the user has saved in the extension, when the user clicks Fill, uses the keyboard shortcut or the right-click menu.
```

**Permission justifications**

| Permission | Paste |
|---|---|
| storage | Saves the user's details, saved answers, profiles and settings locally on their device with chrome.storage.local. Nothing is sent anywhere. |
| activeTab | Reads and fills the form on the current tab only when the user clicks the toolbar button, presses the shortcut or uses the right-click menu. |
| scripting | Injects the form-filling script into the current tab at that moment, to fill fields, preview, undo or save the user's typed answers. |
| contextMenus | Adds "FillKaro: fill this form" and "FillKaro: save my answers from this page" to the right-click menu. |

**Remote code:** No, I am not using remote code.

**Data usage — tick:** Personally identifiable information, Personal communications: no. Leave everything else unticked.

**Certify all three:** not sold to third parties · not used for unrelated purposes · not used for creditworthiness or lending.

**Privacy policy URL:** a public link to `PRIVACY.md` (GitHub repo link, GitHub Pages, or a public Google Doc). Fill in your support email in it first.

## Distribution tab

Public · All regions (or India only if you prefer) · Free.

## Test instructions tab

```
No login needed. 1) After install the settings page opens — fill a few fields under "My details" (e.g. name, email, roll number, CGPA). 2) Open any Google Form or HTML form with fields like Name, Email, Roll number, CGPA. 3) Click the FillKaro toolbar icon → "Preview" to see the plan, then "Fill this page". 4) "Undo fill" restores the page. FillKaro never submits forms.
```
