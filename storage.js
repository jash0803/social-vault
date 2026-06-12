// storage.js — async wrapper over chrome.storage.sync with one-time localStorage migration.
// Schema (per key, to stay under the 8KB-per-key sync quota):
//   meta              { schemaVersion, activeProfileId, profileIds: [...] }
//   profile:<id>      { id, name, links: [{platform, link}], details: {name, phone, email, address, pincode} }
//   analytics         { totalClicks, perAction: { [key]: number } }
//   settings          { theme: "light" | "dark" | "system" }

const SCHEMA_VERSION = 1;

const DEFAULT_DETAILS = { name: "", phone: "", email: "", address: "", pincode: "" };

const sync = chrome.storage.sync;

const get = (keys) =>
  new Promise((resolve) => sync.get(keys, (res) => resolve(res || {})));

const set = (items) =>
  new Promise((resolve) => sync.set(items, () => resolve()));

const remove = (keys) =>
  new Promise((resolve) => sync.remove(keys, () => resolve()));

const profileKey = (id) => `profile:${id}`;

const newId = () =>
  "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const makeProfile = (name) => ({
  id: newId(),
  name,
  links: [],
  details: { ...DEFAULT_DETAILS },
});

async function getMeta() {
  const { meta } = await get("meta");
  return meta || null;
}

async function setMeta(meta) {
  await set({ meta });
}

async function getSettings() {
  const { settings } = await get("settings");
  return settings || { theme: "system" };
}

async function setSettings(settings) {
  await set({ settings });
}

// Analytics has two semantic buckets:
//   copies        — every time a value is put on the clipboard via Copy buttons
//   filledFields  — every form field that was filled (right-click paste = 1,
//                   "Fill this page" = N matched fields)
// Time saved is derived: copies * 3s + filledFields * 5s.
// `totalClicks` and `perAction` are kept for backward compatibility / breakdown.
const SECONDS_PER_COPY = 3;
const SECONDS_PER_FILL = 5;

async function getAnalytics() {
  const { analytics } = await get("analytics");
  const a = analytics || {};
  return {
    copies: a.copies || 0,
    filledFields: a.filledFields || 0,
    totalClicks: a.totalClicks || 0,
    perAction: a.perAction || {},
  };
}

async function setAnalytics(analytics) {
  await set({ analytics });
}

async function recordCopy(actionKey) {
  const a = await getAnalytics();
  a.copies += 1;
  a.totalClicks += 1;
  a.perAction[actionKey] = (a.perAction[actionKey] || 0) + 1;
  await setAnalytics(a);
  return a;
}

async function recordFill(actionKey, count = 1) {
  if (!count || count < 1) return;
  const a = await getAnalytics();
  a.filledFields += count;
  a.totalClicks += count;
  a.perAction[actionKey] = (a.perAction[actionKey] || 0) + count;
  await setAnalytics(a);
  return a;
}

// Back-compat shim — older call sites can keep calling recordAction.
async function recordAction(actionKey) {
  return recordCopy(actionKey);
}

async function getProfile(id) {
  const key = profileKey(id);
  const res = await get(key);
  return res[key] || null;
}

async function putProfile(profile) {
  await set({ [profileKey(profile.id)]: profile });
}

async function deleteProfile(id) {
  const meta = await getMeta();
  if (!meta) return;
  const remaining = meta.profileIds.filter((p) => p !== id);
  if (remaining.length === 0) return; // never let the user delete the last profile
  meta.profileIds = remaining;
  if (meta.activeProfileId === id) meta.activeProfileId = remaining[0];
  await setMeta(meta);
  await remove(profileKey(id));
}

async function getAllProfiles() {
  const meta = await getMeta();
  if (!meta) return [];
  const keys = meta.profileIds.map(profileKey);
  const res = await get(keys);
  return meta.profileIds.map((id) => res[profileKey(id)]).filter(Boolean);
}

async function getActiveProfile() {
  const meta = await getMeta();
  if (!meta) return null;
  return getProfile(meta.activeProfileId);
}

async function setActiveProfile(id) {
  const meta = await getMeta();
  if (!meta || !meta.profileIds.includes(id)) return;
  meta.activeProfileId = id;
  await setMeta(meta);
}

async function createProfile(name) {
  const meta = (await getMeta()) || {
    schemaVersion: SCHEMA_VERSION,
    activeProfileId: null,
    profileIds: [],
  };
  const profile = makeProfile(name || "Untitled");
  meta.profileIds.push(profile.id);
  if (!meta.activeProfileId) meta.activeProfileId = profile.id;
  await putProfile(profile);
  await setMeta(meta);
  return profile;
}

async function renameProfile(id, name) {
  const p = await getProfile(id);
  if (!p) return;
  p.name = name;
  await putProfile(p);
}

// Migration from localStorage (v0 schema) → chrome.storage.sync (v1).
async function migrateIfNeeded() {
  const meta = await getMeta();
  if (meta && meta.schemaVersion === SCHEMA_VERSION) return;

  const oldLinks = safeParse(localStorage.getItem("socialLinks")) || [];
  const oldDetailsRaw = safeParse(localStorage.getItem("personalDetails")) || {};
  const oldAnalytics = safeParse(localStorage.getItem("linkAnalytics")) || {};

  const profile = makeProfile("Personal");
  profile.links = Array.isArray(oldLinks) ? oldLinks : [];
  profile.details = {
    name: oldDetailsRaw.name || "",
    phone: oldDetailsRaw.phone || "",
    email: oldDetailsRaw.email || "",
    address: oldDetailsRaw.Address || oldDetailsRaw.address || "",
    pincode: oldDetailsRaw.pincode || "",
  };

  const totalClicks = Object.values(oldAnalytics).reduce(
    (sum, n) => sum + (Number(n) || 0),
    0
  );

  const newMeta = {
    schemaVersion: SCHEMA_VERSION,
    activeProfileId: profile.id,
    profileIds: [profile.id],
  };

  await putProfile(profile);
  await setMeta(newMeta);
  await setAnalytics({ totalClicks, perAction: oldAnalytics });

  try {
    localStorage.removeItem("socialLinks");
    localStorage.removeItem("personalDetails");
    localStorage.removeItem("linkAnalytics");
  } catch (_) {}
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch (_) {
    return null;
  }
}

async function exportAll() {
  const meta = await getMeta();
  const profiles = await getAllProfiles();
  const analytics = await getAnalytics();
  const settings = await getSettings();
  return {
    app: "social-vault",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    meta,
    profiles,
    analytics,
    settings,
  };
}

async function importAll(payload, { merge = false } = {}) {
  if (!payload || payload.app !== "social-vault" || !Array.isArray(payload.profiles)) {
    throw new Error("Invalid Social Vault backup file.");
  }

  if (!merge) {
    const existing = await getMeta();
    if (existing) {
      const oldKeys = existing.profileIds.map(profileKey);
      if (oldKeys.length) await remove(oldKeys);
    }
    await remove(["meta", "analytics", "settings"]);
  }

  for (const p of payload.profiles) {
    if (!p || !p.id || !p.name) continue;
    await putProfile({
      id: p.id,
      name: p.name,
      links: Array.isArray(p.links) ? p.links : [],
      details: { ...DEFAULT_DETAILS, ...(p.details || {}) },
    });
  }

  const meta = payload.meta || {
    schemaVersion: SCHEMA_VERSION,
    activeProfileId: payload.profiles[0].id,
    profileIds: payload.profiles.map((p) => p.id),
  };
  meta.schemaVersion = SCHEMA_VERSION;
  await setMeta(meta);
  if (payload.analytics) await setAnalytics(payload.analytics);
  if (payload.settings) await setSettings(payload.settings);
}

window.SVStorage = {
  SCHEMA_VERSION,
  DEFAULT_DETAILS,
  SECONDS_PER_COPY,
  SECONDS_PER_FILL,
  migrateIfNeeded,
  getMeta,
  setMeta,
  getSettings,
  setSettings,
  getAnalytics,
  recordAction,
  recordCopy,
  recordFill,
  getProfile,
  putProfile,
  deleteProfile,
  getAllProfiles,
  getActiveProfile,
  setActiveProfile,
  createProfile,
  renameProfile,
  exportAll,
  importAll,
};
