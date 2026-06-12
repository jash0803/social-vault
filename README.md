# Social Vault

Save your social links and contact details once. Then autofill them into any web form, paste them via right-click, or copy them with one click.

Social Vault is a Manifest V3 Chrome extension. All data lives in Chrome's encrypted sync storage — nothing is ever sent to a server.

## Features

- **Fill this page** — one click in the popup (or `Cmd/Ctrl + Shift + F`) populates every matching field on the current page. Recognizes Name, Email, Phone, Address, Pincode, plus social link fields by platform name (LinkedIn, X / Twitter, GitHub, Instagram, YouTube, Medium, Portfolio / Personal Website, etc.). Works on framework-driven forms (React, Vue, Google Forms) by firing native input events.
- **Right-click to paste** — right-click any form field and pick a saved value from the **Social Vault** submenu.
- **Multiple profiles** — keep Work and Personal separate. Switch profiles from the popup header dropdown.
- **Inline detail editing** — Details tab opens with all fields visible. Click **Edit details** to update inline; **Save** to persist.
- **Icon row actions** — each link row has compact icon buttons for Edit, Delete, and Copy. Copy flashes a checkmark on success.
- **Shareable profile card** — clean, share-friendly text card combining details and links.
- **Sync across devices** — backed by `chrome.storage.sync`, your data follows your Google account into any Chrome where you're signed in.
- **JSON import / export** — full backup and restore from Settings.
- **Keyboard shortcuts** — viewable and customizable from Settings.
- **Light, dark, and system themes**.
- **Local usage analytics** — see total copies/fills and how much time you've saved.

## Keyboard shortcuts

| Action | macOS | Windows / Linux |
|---|---|---|
| Open Social Vault | `Cmd+Shift+S` | `Ctrl+Shift+S` |
| Fill the current page | `Cmd+Shift+F` | `Ctrl+Shift+F` |

Customize at `chrome://extensions/shortcuts` (Settings → "Customize these at..." link). Chrome only honors `suggested_key` on a fresh install — existing users of older versions may need to set their preferred binding manually.

## Install (developer mode)

1. Clone or download this repo.
2. Open `chrome://extensions/`.
3. Toggle **Developer mode** on (top-right).
4. Click **Load unpacked** and select this folder.
5. Pin the Social Vault icon to your toolbar.

Video walkthrough: <https://www.youtube.com/watch?v=kanIAQYImhY>

## How to use

1. **Add data.** Open the popup (`Cmd/Ctrl + Shift + S`). Add your social links under **Links**. Under **Details**, fill the inline inputs and click **Save**.
2. **Fill a form.** Open the form, click **Fill this page** in the popup, or press `Cmd/Ctrl + Shift + F`.
3. **Paste a single value.** Right-click any input on a page and choose **Social Vault → \<value\>**.
4. **Copy.** Hit the clipboard icon next to any link or detail.
5. **Share your profile.** Click **Share profile** in the popup footer to copy a clean text card.
6. **Manage profiles.** Open the gear icon → add, rename, or delete profiles; switch the active profile from the header dropdown.
7. **Back up.** Settings → **Export JSON**. Restore with **Import JSON** (merge or replace).

## How autofill matches fields

The matcher reads each input's `type`, `name`, `id`, `autocomplete`, `placeholder`, `aria-label`, `aria-labelledby` target text, associated `<label>` text, and the nearest question container (`role="listitem"`, `fieldset`, `role="group"` — needed for Google Forms).

- Contact details are matched by keywords (`email`, `phone` / `tel` / `mobile`, `name` / `full name` / `first and last name`, `address` / `street`, `pincode` / `postal` / `zip`).
- Social links are matched by platform name with a small alias table. A saved **X** link also fills "Twitter" fields, and a saved **Portfolio** link fills fields labeled "Personal Website", "Homepage", "Blog", or "Site".

If a field is already filled with the same value, the matcher leaves it alone.

## File layout

```
manifest.json                MV3 manifest, permissions, commands
popup.html                   Popup UI
popup.js                     Popup logic — links/details, autofill trigger, settings
style.css                    Modern light/dark theme
storage.js                   chrome.storage.sync wrapper + migration
background.js                Service worker — right-click menu, command shortcut, scripting injection
content.js                   Injected on demand — handles SV_FILL_PAGE (bulk fill) and SV_FILL_FOCUSED (single field)
icon{16,32,48,128}.png       Toolbar / store icons
assets/                      Screenshots, logo, fallback favicon
PRIVACY.md                   Privacy policy (linked from the Web Store listing)
STORE_LISTING.md             Copy + permission justifications for the store submission
```

## Privacy

Social Vault does **not** transmit your data anywhere. See [PRIVACY.md](PRIVACY.md) for the full policy and a per-permission breakdown.

## Roadmap

- Drag-to-reorder links
- Link tagging (Pro / Social / Dev)
- Per-site autofill overrides

## Contributing

Issues and PRs welcome. For UI changes, please include before/after screenshots.

## License

MIT — see source headers.
