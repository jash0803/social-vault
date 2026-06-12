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
      await bumpAnalytics("context_menu");
    } else {
      console.warn("Social Vault: fill not applied", res);
    }
  } catch (err) {
    console.warn("Social Vault: fill failed", err);
  }
});

async function bumpAnalytics(actionKey) {
  const { analytics } = await chrome.storage.sync.get("analytics");
  const a = analytics || { totalClicks: 0, perAction: {} };
  a.totalClicks = (a.totalClicks || 0) + 1;
  a.perAction[actionKey] = (a.perAction[actionKey] || 0) + 1;
  await chrome.storage.sync.set({ analytics: a });
}
