# Social Vault — Privacy Policy

_Last updated: 2026-06-12_

Social Vault is a Chrome extension that stores the social links and contact details you choose to enter, so you can copy them or paste them into web forms from a right-click menu.

## What we collect

**Nothing leaves your device.** Social Vault has no servers, no analytics provider, and no third-party data sharing.

The only data the extension stores is data you enter yourself:

- Social links (platform name + URL) you add
- Personal details you add: full name, phone, email, address, pincode
- Profile names you create
- Local usage counters (how many times you copied or filled a value), used only to render the in-extension "Analytics" view

## Where the data is stored

Your data is stored in `chrome.storage.sync`. Chrome encrypts this storage and ties it to your Google account so it can sync across devices where you are signed in to Chrome. Anthropic does not have access to it. The author of this extension does not have access to it.

If you sign out of Chrome or use a profile without sync enabled, your data stays only on the local device.

## Permissions and why each is needed

| Permission | Why |
|---|---|
| `clipboardWrite` | Copy your saved links and details to the clipboard when you click "Copy". |
| `storage` | Save your profile data in Chrome's encrypted, account-tied storage. |
| `contextMenus` | Add a right-click "Social Vault" menu inside form fields so you can paste a saved value. |
| `scripting` + `activeTab` | Inject a small helper into the page you are currently on, only when you pick a value from the right-click "Social Vault" menu, so it can paste that value into the focused field. |
| `host_permissions: <all_urls>` | Required so the right-click menu helper can run on whichever page you choose. The extension only acts when you click a menu item; it does not run automatically. |

## What we do **not** do

- We do not transmit your data to any server.
- We do not include analytics, telemetry, or crash reporting SDKs.
- We do not sell or share any data.
- We do not show ads.

## Network requests

The extension only makes one type of network request: it loads small favicon images from `www.google.com/s2/favicons` so each saved link displays a recognizable icon. No saved data is sent in this request — only the domain of the link you saved is included in the URL, the same way a browser would when fetching a favicon.

## Data deletion

To delete your data, open the extension → Settings → delete each profile, or uninstall the extension. Uninstalling removes the extension's storage from your Chrome profile.

## Contact

Questions about this policy: jashshah780@gmail.com
