# Chrome Web Store listing copy

Source of truth for the Web Store submission. Not loaded by the extension.

---

## Name
Social Vault

## Short description (≤132 chars)
Save your social links and contact details once. Copy them, or right-click any form field to paste a saved value.

## Category
Productivity

## Language
English

---

## Detailed description (~1500 chars)

Social Vault is the fastest way to share the same handful of details you type into forms every day — your name, email, phone, and your LinkedIn / Twitter / GitHub / portfolio links.

Save them once. Then, on any web form:

• Right-click a field and pick a value from the "Social Vault" menu to paste it in.
• Or open the popup and copy any value with one click.

**Features**

✓ Save unlimited social links and contact details.
✓ Multiple profiles — keep Work and Personal separate, switch in one click.
✓ Right-click context menu to paste a specific saved value into any form.
✓ One-click shareable profile card.
✓ Inline edit for personal details — no separate form.
✓ Light, dark, and system themes.
✓ Sync across your Chrome browsers via your Google account.
✓ JSON import/export for backups.
✓ Local usage analytics — see how much time you saved.

**Privacy**

Your data never leaves your device. No servers, no analytics, no ads. Stored in Chrome's encrypted sync storage, tied to your Google account. Read the full policy at the privacy link below.

**Who it's for**

Freelancers, recruiters, students, job seekers, and anyone who fills the same forms more than once a week.

---

## Single-purpose statement

Stores the user's own social links and contact details, and inserts or copies them into web forms when the user requests it.

## Permission justifications

| Permission | Justification (for the submission form) |
|---|---|
| `clipboardWrite` | Required to put the user's saved value on the clipboard when they click "Copy". |
| `storage` | Required to persist the user's saved profiles between sessions and across devices using Chrome sync storage. |
| `contextMenus` | Required to add a right-click "Social Vault" menu inside form fields, listing the user's saved values. |
| `scripting` | Required to inject a small helper script into the current page when the user picks a value from the right-click "Social Vault" context menu, so it can paste the value into the focused field. |
| `activeTab` | Lets the helper script run only on the user's currently focused tab, in response to the user's menu click, instead of requesting broad access proactively. |
| `host_permissions: <all_urls>` | The right-click menu must work on whatever page the user is on. The helper script only runs when the user picks a menu item — never automatically. |

## Data usage disclosures (Chrome Web Store form)

- **Personally identifiable information**: yes — the user enters their own. Stored locally / in Chrome sync. Not collected or sold.
- **Authentication information**: no
- **Personal communications**: no
- **Financial / payment**: no
- **Health**: no
- **Location**: no
- **Web history**: no
- **User activity**: no (in-extension counters are not transmitted)
- **Website content**: no

Confirm: "I do not sell or transfer user data to third parties." ✓
Confirm: "I do not use or transfer user data for purposes unrelated to my item's single purpose." ✓
Confirm: "I do not use or transfer user data to determine creditworthiness or for lending purposes." ✓

## URLs to provide

- Homepage URL: https://github.com/<your-username>/social-vault
- Privacy policy URL: https://raw.githubusercontent.com/<your-username>/social-vault/main/PRIVACY.md
- Support URL: https://github.com/<your-username>/social-vault/issues

## Screenshots

All sourced from `assets/`:

1. `assets/1.png` — "Save your links and details once."
2. `assets/2.png` — "Switch between Work and Personal profiles."
3. `assets/3.png` — "Right-click any form field to paste a saved value."
4. `assets/4.png` — "Share your profile card. Track time saved."

Required size: 1280×800 or 640×400. Resize if needed before upload.

## Small promo tile

Create a 440×280 tile from `assets/logo.png` for the store carousel.
