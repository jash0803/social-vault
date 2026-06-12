// background.js — MV3 service worker.
// Builds a "Social Vault" context menu under right-click on editable fields.
// Clicking an item injects content.js and tells it to fill the focused field.

const PARENT_ID = "social-vault-root";
const ITEM_PREFIX = "sv:";

const DETAIL_LABELS = {
  name: "Full Name",
  email: "Email",
  phone: "Phone",
  address: "Address",
  pincode: "Pincode",
};

async function getActiveProfile() {
  const { meta } = await chrome.storage.sync.get("meta");
  if (!meta || !meta.activeProfileId) return null;
  const key = `profile:${meta.activeProfileId}`;
  const res = await chrome.storage.sync.get(key);
  return res[key] || null;
}

let rebuildInFlight = null;
let rebuildQueued = false;

function scheduleRebuild() {
  if (rebuildInFlight) {
    rebuildQueued = true;
    return rebuildInFlight;
  }
  rebuildInFlight = (async () => {
    try {
      do {
        rebuildQueued = false;
        await rebuildMenuInternal();
      } while (rebuildQueued);
    } finally {
      rebuildInFlight = null;
    }
  })();
  return rebuildInFlight;
}

async function rebuildMenu() {
  return scheduleRebuild();
}

async function rebuildMenuInternal() {
  await new Promise((resolve) => chrome.contextMenus.removeAll(() => resolve()));
  const profile = await getActiveProfile();

  chrome.contextMenus.create({
    id: PARENT_ID,
    title: profile ? `Social Vault (${profile.name})` : "Social Vault",
    contexts: ["editable"],
  });

  if (!profile) {
    chrome.contextMenus.create({
      id: ITEM_PREFIX + "empty",
      parentId: PARENT_ID,
      title: "Open Social Vault to add data",
      contexts: ["editable"],
      enabled: false,
    });
    return;
  }

  let added = 0;

  for (const [key, label] of Object.entries(DETAIL_LABELS)) {
    const val = profile.details && profile.details[key];
    if (!val) continue;
    chrome.contextMenus.create({
      id: `${ITEM_PREFIX}detail:${key}`,
      parentId: PARENT_ID,
      title: `${label}: ${truncate(val, 40)}`,
      contexts: ["editable"],
    });
    added++;
  }

  if ((profile.links || []).length > 0) {
    chrome.contextMenus.create({
      id: ITEM_PREFIX + "sep",
      parentId: PARENT_ID,
      type: "separator",
      contexts: ["editable"],
    });
    profile.links.forEach((l, i) => {
      chrome.contextMenus.create({
        id: `${ITEM_PREFIX}link:${i}`,
        parentId: PARENT_ID,
        title: `${l.platform}: ${truncate(l.link, 40)}`,
        contexts: ["editable"],
      });
      added++;
    });
  }

  if (added === 0) {
    chrome.contextMenus.create({
      id: ITEM_PREFIX + "empty",
      parentId: PARENT_ID,
      title: "No saved values yet — open Social Vault",
      contexts: ["editable"],
      enabled: false,
    });
  }
}

function truncate(s, n) {
  s = String(s);
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

chrome.runtime.onInstalled.addListener(rebuildMenu);
chrome.runtime.onStartup.addListener(rebuildMenu);

let storageDebounce = null;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (!(changes.meta || Object.keys(changes).some((k) => k.startsWith("profile:")))) return;
  if (storageDebounce) clearTimeout(storageDebounce);
  storageDebounce = setTimeout(() => {
    storageDebounce = null;
    rebuildMenu();
  }, 80);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id || !info.menuItemId || !String(info.menuItemId).startsWith(ITEM_PREFIX)) {
    return;
  }
  const profile = await getActiveProfile();
  if (!profile) return;

  const rest = String(info.menuItemId).slice(ITEM_PREFIX.length);
  let value = null;

  if (rest.startsWith("detail:")) {
    value = profile.details?.[rest.slice("detail:".length)] || null;
  } else if (rest.startsWith("link:")) {
    const idx = Number(rest.slice("link:".length));
    value = profile.links?.[idx]?.link || null;
  }
  if (!value) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [info.frameId ?? 0] },
      files: ["content.js"],
    });
    const res = await chrome.tabs.sendMessage(
      tab.id,
      { type: "SV_FILL_FOCUSED", value, targetElementId: info.targetElementId ?? null },
      info.frameId != null ? { frameId: info.frameId } : undefined
    );
    if (res?.ok) {
      await bumpFill("context_menu", 1);
    } else {
      console.warn("Social Vault: fill not applied", res);
    }
  } catch (err) {
    console.warn("Social Vault: fill failed", err);
  }
});

async function getAnalyticsRaw() {
  const { analytics } = await chrome.storage.sync.get("analytics");
  return analytics || { copies: 0, filledFields: 0, totalClicks: 0, perAction: {} };
}

async function bumpFill(actionKey, count = 1) {
  if (!count || count < 1) return;
  const a = await getAnalyticsRaw();
  a.filledFields = (a.filledFields || 0) + count;
  a.totalClicks = (a.totalClicks || 0) + count;
  a.perAction = a.perAction || {};
  a.perAction[actionKey] = (a.perAction[actionKey] || 0) + count;
  await chrome.storage.sync.set({ analytics: a });
}

// Shared one-shot bulk fill for whichever tab is currently active.
// Used by both the keyboard shortcut and the popup's "Fill this page" button via runtime message.
async function fillActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return { ok: false, reason: "no-tab" };
  if (/^chrome(-extension)?:\/\//.test(tab.url || "")) {
    return { ok: false, reason: "restricted-page" };
  }
  const profile = await getActiveProfile();
  if (!profile) return { ok: false, reason: "no-profile" };

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    const res = await chrome.tabs.sendMessage(tab.id, {
      type: "SV_FILL_PAGE",
      profile: { details: profile.details || {}, links: profile.links || [] },
    });
    if (res?.count) await bumpFill("autofill", res.count);
    return { ok: true, count: res?.count || 0 };
  } catch (err) {
    console.warn("Social Vault: fill page failed", err);
    return { ok: false, reason: "exception", error: String(err) };
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "fill-page") await fillActiveTab();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "SV_RUN_FILL_PAGE") {
    fillActiveTab().then(sendResponse);
    return true;
  }
});
