// popup.js — Social Vault popup logic.
// Depends on storage.js (window.SVStorage).

(async function () {
  const S = window.SVStorage;

  await S.migrateIfNeeded();

  // First-launch case: no profile exists yet.
  if (!(await S.getMeta())) {
    await S.createProfile("Personal");
  }

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);
  const profileSwitcher = $("profileSwitcher");
  const fillPageBtn = $("fillPage");
  const fillStatus = $("fillStatus");
  const tabBtns = document.querySelectorAll(".tab-btn:not(.theme-btn)");
  const tabContents = document.querySelectorAll(".tab-content");
  const addForm = $("addForm");
  const linksList = $("linksList");
  const cancelLinkEdit = $("cancelLinkEdit");
  const personalDetails = $("personalDetails");
  const shareProfileBtn = $("shareProfile");
  const showAnalyticsBtn = $("showAnalytics");
  const openSettingsBtn = $("openSettings");
  const profileCardModal = $("profileCardModal");
  const profileCardEl = $("profileCard");
  const copyProfileCardBtn = $("copyProfileCard");
  const analyticsModal = $("analyticsModal");
  const timeSavedEl = $("timeSaved");
  const timeSavedBreakdownEl = $("timeSavedBreakdown");
  const copyCountEl = $("copyCount");
  const copyTimeEl = $("copyTime");
  const fillCountEl = $("fillCount");
  const fillTimeEl = $("fillTime");
  const entriesCountEl = $("entriesCount");
  const entriesBreakdownEl = $("entriesBreakdown");
  const settingsModal = $("settingsModal");
  const profileListEl = $("profileList");
  const newProfileForm = $("newProfileForm");
  const newProfileName = $("newProfileName");
  const exportBtn = $("exportBtn");
  const importBtn = $("importBtn");
  const importFile = $("importFile");

  let activeProfile = await S.getActiveProfile();

  // ---------- helpers ----------
  const faviconUrl = (url) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return "assets/default-favicon.jpg";
    }
  };

  const formatTime = (sec) => {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  };

  const SHORTCUT_LABELS = {
    _execute_action: "Open Social Vault",
    "fill-page": "Fill the current page",
  };

  // Source of truth for the manifest's suggested_key bindings. Shown for both
  // OSes regardless of where the user is running, so the alternate is visible.
  const SHORTCUT_BINDINGS = {
    _execute_action: { mac: "Cmd+Shift+S", other: "Ctrl+Shift+S" },
    "fill-page": { mac: "Cmd+Shift+F", other: "Ctrl+Shift+F" },
  };

  const MODIFIER_ORDER = ["Cmd", "Ctrl", "Alt", "Option", "Shift"];

  const ICONS = {
    copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    edit: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
  };

  const briefCopy = (btn) => {
    const original = btn.innerHTML;
    btn.innerHTML = ICONS.check;
    btn.disabled = true;
    btn.classList.add("did-copy");
    setTimeout(() => {
      btn.innerHTML = original;
      btn.disabled = false;
      btn.classList.remove("did-copy");
    }, 1200);
  };

  async function copyText(text, actionKey, btn) {
    await navigator.clipboard.writeText(text);
    await S.recordCopy(actionKey);
    if (btn) briefCopy(btn);
    refreshAnalytics();
  }

  // ---------- profile switcher ----------
  async function renderProfileSwitcher() {
    const profiles = await S.getAllProfiles();
    const meta = await S.getMeta();
    profileSwitcher.innerHTML = "";
    for (const p of profiles) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === meta.activeProfileId) opt.selected = true;
      profileSwitcher.appendChild(opt);
    }
  }

  profileSwitcher.addEventListener("change", async () => {
    await S.setActiveProfile(profileSwitcher.value);
    activeProfile = await S.getActiveProfile();
    await renderAll();
  });

  // ---------- links ----------
  async function renderLinks() {
    linksList.innerHTML = "";
    (activeProfile.links || []).forEach(({ platform, link }, index) => {
      const li = document.createElement("li");
      li.className = "link-item";
      li.innerHTML = `
        <img class="favicon" alt="" src="${faviconUrl(link)}" />
        <div class="link-meta">
          <span class="link-platform"></span>
          <a class="link-url" target="_blank" rel="noopener noreferrer"></a>
        </div>
        <div class="link-actions">
          <button class="icon-action edit" data-index="${index}" title="Edit" aria-label="Edit">${ICONS.edit}</button>
          <button class="icon-action danger delete" data-index="${index}" title="Delete" aria-label="Delete">${ICONS.trash}</button>
          <button class="icon-action primary copy" data-index="${index}" title="Copy" aria-label="Copy">${ICONS.copy}</button>
        </div>
      `;
      li.querySelector(".link-platform").textContent = platform;
      const a = li.querySelector(".link-url");
      a.textContent = link;
      a.href = link;
      linksList.appendChild(li);
    });

    linksList.querySelectorAll("button.copy").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const i = Number(btn.dataset.index);
        const item = activeProfile.links[i];
        if (!item) return;
        await copyText(item.link, `link:${item.platform}`, btn);
      });
    });
    linksList.querySelectorAll("button.edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.index);
        const item = activeProfile.links[i];
        if (!item) return;
        $("platform").value = item.platform;
        $("link").value = item.link;
        addForm.dataset.editIndex = String(i);
        addForm.querySelector("button[type='submit']").textContent = "Update link";
        cancelLinkEdit.classList.remove("hidden");
      });
    });
    linksList.querySelectorAll("button.delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const i = Number(btn.dataset.index);
        const item = activeProfile.links[i];
        if (!item) return;
        if (!confirm(`Delete "${item.platform}"?`)) return;
        activeProfile.links.splice(i, 1);
        await S.putProfile(activeProfile);
        await renderLinks();
      });
    });
  }

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const platform = $("platform").value.trim();
    const link = $("link").value.trim();
    if (!platform || !link) return;

    const links = activeProfile.links || [];
    if (addForm.dataset.editIndex !== undefined) {
      links[Number(addForm.dataset.editIndex)] = { platform, link };
      delete addForm.dataset.editIndex;
      addForm.querySelector("button[type='submit']").textContent = "Add link";
      cancelLinkEdit.classList.add("hidden");
    } else {
      links.push({ platform, link });
    }
    activeProfile.links = links;
    await S.putProfile(activeProfile);
    addForm.reset();
    await renderLinks();
  });

  cancelLinkEdit.addEventListener("click", () => {
    delete addForm.dataset.editIndex;
    addForm.reset();
    addForm.querySelector("button[type='submit']").textContent = "Add link";
    cancelLinkEdit.classList.add("hidden");
  });

  // ---------- personal details ----------
  const DETAIL_FIELDS = [
    { key: "name", label: "Full Name" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "address", label: "Address" },
    { key: "pincode", label: "Pincode" },
  ];

  // Inline-edit details. `editing` is null in view mode, or a draft dict in edit mode.
  let detailsEditing = null;

  async function renderDetails() {
    const d = activeProfile.details || {};
    const hasAny = DETAIL_FIELDS.some(({ key }) => d[key]);
    // When the profile has no saved details yet, open in edit mode by default
    // so all fields render as empty inputs ready to fill in.
    if (!hasAny && detailsEditing === null) {
      detailsEditing = { ...d };
    }
    const editing = detailsEditing !== null;
    personalDetails.innerHTML = "";

    const toolbar = document.createElement("div");
    toolbar.className = "row details-toolbar";
    if (editing) {
      const save = document.createElement("button");
      save.className = "primary-btn";
      save.textContent = "Save";
      save.addEventListener("click", async () => {
        activeProfile.details = { ...d, ...detailsEditing };
        detailsEditing = null;
        await S.putProfile(activeProfile);
        await renderDetails();
      });
      const cancel = document.createElement("button");
      cancel.className = "ghost-btn";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", async () => {
        detailsEditing = null;
        await renderDetails();
      });
      toolbar.append(save, cancel);
    } else {
      const edit = document.createElement("button");
      edit.className = "ghost-btn edit-all";
      edit.textContent = "Edit details";
      edit.addEventListener("click", async () => {
        detailsEditing = { ...d };
        await renderDetails();
      });
      toolbar.append(edit);
    }
    personalDetails.appendChild(toolbar);

    const container = document.createElement("div");
    container.className = "details-container";

    DETAIL_FIELDS.forEach(({ key, label }) => {
      const value = editing ? (detailsEditing[key] ?? "") : (d[key] || "");
      if (!editing && !value) return;

      const row = document.createElement("div");
      row.className = "detail-row";

      const meta = document.createElement("div");
      meta.className = "detail-meta";
      const lbl = document.createElement("span");
      lbl.className = "detail-label";
      lbl.textContent = label;
      meta.appendChild(lbl);

      if (editing) {
        const input = document.createElement("input");
        input.type = key === "email" ? "email" : key === "phone" ? "tel" : "text";
        input.placeholder = label;
        input.value = value;
        input.className = "detail-input";
        input.addEventListener("input", () => {
          detailsEditing[key] = input.value;
        });
        meta.appendChild(input);
        row.appendChild(meta);
      } else {
        const val = document.createElement("span");
        val.className = "detail-value";
        val.textContent = value;
        meta.appendChild(val);
        const copyBtn = document.createElement("button");
        copyBtn.className = "icon-action primary copy";
        copyBtn.title = "Copy";
        copyBtn.setAttribute("aria-label", "Copy");
        copyBtn.innerHTML = ICONS.copy;
        copyBtn.addEventListener("click", async (e) => {
          await copyText(value, `detail:${key}`, e.currentTarget);
        });
        row.append(meta, copyBtn);
      }
      container.appendChild(row);
    });

    personalDetails.appendChild(container);
  }

  // ---------- tabs ----------
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      $(btn.dataset.tab + "Section").classList.add("active");
    });
  });

  // ---------- autofill ----------
  function renderFillShortcutHint() {
    const wrap = document.getElementById("fillShortcut");
    if (!wrap) return;
    wrap.innerHTML = "";
    const binding = SHORTCUT_BINDINGS["fill-page"];

    const mac = document.createElement("kbd");
    mac.className = "shortcut-keys";
    mac.textContent = prettyShortcut(binding.mac);
    mac.title = "macOS";

    const sep = document.createElement("span");
    sep.className = "shortcut-sep";
    sep.textContent = "/";

    const other = document.createElement("kbd");
    other.className = "shortcut-keys";
    other.textContent = prettyShortcut(binding.other);
    other.title = "Windows / Linux";

    wrap.append(mac, sep, other);
  }
  renderFillShortcutHint();

  function setFillStatus(text) {
    fillStatus.textContent = text;
    const wrap = document.getElementById("fillShortcut");
    if (wrap) wrap.classList.toggle("hidden", !!text);
  }

  fillPageBtn.addEventListener("click", async () => {
    setFillStatus("Filling…");
    fillPageBtn.disabled = true;
    try {
      const res = await chrome.runtime.sendMessage({ type: "SV_RUN_FILL_PAGE" });
      if (!res?.ok) {
        const map = {
          "no-tab": "No tab.",
          "restricted-page": "Not allowed here.",
          "no-profile": "No profile.",
        };
        setFillStatus(map[res?.reason] || "Failed.");
        return;
      }
      const n = res.count || 0;
      setFillStatus(n ? `Filled ${n}.` : "No matches.");
      refreshAnalytics();
    } finally {
      fillPageBtn.disabled = false;
      // Restore the shortcut hint after a short pause so the user can read the status.
      setTimeout(() => setFillStatus(""), 2200);
    }
  });

  // ---------- profile card ----------
  function profileCardText() {
    const d = activeProfile.details || {};
    const links = activeProfile.links || [];
    const lines = [];

    if (d.name) {
      lines.push(d.name);
      lines.push("—".repeat(Math.min(d.name.length, 24)));
    }

    const contactBits = [];
    if (d.email) contactBits.push(d.email);
    if (d.phone) contactBits.push(d.phone);
    if (contactBits.length) lines.push(contactBits.join("  ·  "));

    const locationBits = [];
    if (d.address) locationBits.push(d.address);
    if (d.pincode) locationBits.push(d.pincode);
    if (locationBits.length) lines.push(locationBits.join(", "));

    if (links.length) {
      if (lines.length) lines.push("");
      lines.push("Links");
      links.forEach(({ platform, link }) => lines.push(`• ${platform}: ${link}`));
    }

    return lines.join("\n").trim() || "No profile data yet.";
  }

  function renderProfileCardHTML() {
    const d = activeProfile.details || {};
    const links = activeProfile.links || [];
    let html = "";
    if (Object.values(d).some(Boolean)) {
      html += `<section class="card-section"><h4>Personal</h4>`;
      DETAIL_FIELDS.forEach(({ key, label }) => {
        if (d[key]) {
          const row = document.createElement("div");
          row.className = "card-row";
          const l = document.createElement("strong");
          l.textContent = label + ": ";
          const v = document.createElement("span");
          v.textContent = d[key];
          row.append(l, v);
          html += row.outerHTML;
        }
      });
      html += `</section>`;
    }
    if (links.length) {
      html += `<section class="card-section"><h4>Links</h4>`;
      links.forEach(({ platform, link }) => {
        const row = document.createElement("div");
        row.className = "card-row";
        const l = document.createElement("strong");
        l.textContent = platform + ": ";
        const v = document.createElement("span");
        v.textContent = link;
        row.append(l, v);
        html += row.outerHTML;
      });
      html += `</section>`;
    }
    profileCardEl.innerHTML = html || "<p>No profile data yet.</p>";
  }

  shareProfileBtn.addEventListener("click", () => {
    renderProfileCardHTML();
    profileCardModal.hidden = false;
  });

  copyProfileCardBtn.addEventListener("click", async () => {
    await copyText(profileCardText(), "profile_card", copyProfileCardBtn);
  });

  // ---------- modals ----------
  document.querySelectorAll(".close-modal").forEach((btn) =>
    btn.addEventListener("click", () => {
      btn.closest(".modal").hidden = true;
    })
  );
  window.addEventListener("click", (e) => {
    document.querySelectorAll(".modal").forEach((m) => {
      if (e.target === m) m.hidden = true;
    });
  });

  // ---------- analytics ----------
  async function refreshAnalytics() {
    const a = await S.getAnalytics();
    const copies = a.copies || 0;
    const fills = a.filledFields || 0;
    const copySec = copies * S.SECONDS_PER_COPY;
    const fillSec = fills * S.SECONDS_PER_FILL;
    const totalSec = copySec + fillSec;

    timeSavedEl.textContent = formatTime(totalSec);
    timeSavedBreakdownEl.textContent =
      copies + fills > 0
        ? `${formatTime(copySec)} from copies · ${formatTime(fillSec)} from fills`
        : "Copy something or fill a form to get started.";

    copyCountEl.textContent = copies;
    copyTimeEl.textContent = `${formatTime(copySec)} saved · ${S.SECONDS_PER_COPY}s each`;
    fillCountEl.textContent = fills;
    fillTimeEl.textContent = `${formatTime(fillSec)} saved · ${S.SECONDS_PER_FILL}s each`;

    // Entries on the active profile
    const links = (activeProfile?.links || []).length;
    const details = Object.values(activeProfile?.details || {}).filter(Boolean).length;
    entriesCountEl.textContent = links + details;
    entriesBreakdownEl.textContent = `${links} link${links === 1 ? "" : "s"} · ${details} detail${details === 1 ? "" : "s"}`;
  }

  showAnalyticsBtn.addEventListener("click", async () => {
    await refreshAnalytics();
    analyticsModal.hidden = false;
  });

  // ---------- settings ----------
  openSettingsBtn.addEventListener("click", async () => {
    await renderProfileList();
    await applyThemeUIState();
    await renderShortcutList();
    settingsModal.hidden = false;
  });

  function prettyShortcut(s) {
    if (!s) return "Not set";
    // Tokenize on '+' or whitespace; also split out unicode modifier symbols.
    const tokens = s
      .replace(/⌘/g, "+Command")
      .replace(/⇧/g, "+Shift")
      .replace(/⌥/g, "+Option")
      .replace(/⌃/g, "+Control")
      .split(/[+\s]+/)
      .filter(Boolean);
    const map = {
      command: "Cmd",
      cmd: "Cmd",
      meta: "Cmd",
      control: "Ctrl",
      ctrl: "Ctrl",
      option: "Option",
      alt: "Alt",
      shift: "Shift",
    };
    const norm = tokens.map((t) => map[t.toLowerCase()] || t.toUpperCase());
    // Reorder so modifiers always come first in a canonical order, then the key.
    const mods = [];
    const keys = [];
    for (const t of norm) (MODIFIER_ORDER.includes(t) ? mods : keys).push(t);
    mods.sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b));
    return [...mods, ...keys].join("+");
  }

  async function renderShortcutList() {
    const el = document.getElementById("shortcutList");
    if (!el) return;
    el.innerHTML = "";
    const cmds = await new Promise((resolve) => chrome.commands.getAll(resolve));
    for (const cmd of cmds) {
      const li = document.createElement("li");
      li.className = "shortcut-row";

      const label = document.createElement("span");
      label.className = "shortcut-label";
      label.textContent = SHORTCUT_LABELS[cmd.name] || cmd.description || cmd.name;

      const keysWrap = document.createElement("span");
      keysWrap.className = "shortcut-keys-wrap";

      const binding = SHORTCUT_BINDINGS[cmd.name];
      const macStr = binding ? binding.mac : null;
      const otherStr = binding ? binding.other : null;

      if (macStr) {
        const macKbd = document.createElement("kbd");
        macKbd.className = "shortcut-keys";
        macKbd.textContent = prettyShortcut(macStr);
        macKbd.title = "macOS";
        keysWrap.appendChild(macKbd);
      }
      if (otherStr) {
        const sep = document.createElement("span");
        sep.className = "shortcut-sep";
        sep.textContent = "/";
        keysWrap.appendChild(sep);

        const otherKbd = document.createElement("kbd");
        otherKbd.className = "shortcut-keys";
        otherKbd.textContent = prettyShortcut(otherStr);
        otherKbd.title = "Windows / Linux";
        keysWrap.appendChild(otherKbd);
      }
      if (!macStr && !otherStr) {
        const kbd = document.createElement("kbd");
        kbd.className = "shortcut-keys";
        kbd.textContent = prettyShortcut(cmd.shortcut);
        if (!cmd.shortcut) kbd.classList.add("unset");
        keysWrap.appendChild(kbd);
      }

      li.append(label, keysWrap);
      el.appendChild(li);
    }
  }

  document.getElementById("openShortcutsPage")?.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });

  async function renderProfileList() {
    const meta = await S.getMeta();
    const profiles = await S.getAllProfiles();
    profileListEl.innerHTML = "";
    profiles.forEach((p) => {
      const li = document.createElement("li");
      li.className = "profile-row";
      li.innerHTML = `
        <span class="profile-name"></span>
        <span class="row">
          <button class="ghost-btn rename">Rename</button>
          <button class="ghost-btn danger delete" ${profiles.length === 1 ? "disabled" : ""}>Delete</button>
        </span>
      `;
      li.querySelector(".profile-name").textContent =
        p.name + (p.id === meta.activeProfileId ? " (active)" : "");
      li.querySelector(".rename").addEventListener("click", async () => {
        const name = prompt("Rename profile", p.name);
        if (!name) return;
        await S.renameProfile(p.id, name.trim());
        await renderProfileList();
        await renderProfileSwitcher();
      });
      li.querySelector(".delete").addEventListener("click", async () => {
        if (!confirm(`Delete profile "${p.name}"? This cannot be undone.`)) return;
        await S.deleteProfile(p.id);
        activeProfile = await S.getActiveProfile();
        await renderAll();
        await renderProfileList();
      });
      profileListEl.appendChild(li);
    });
  }

  newProfileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = newProfileName.value.trim();
    if (!name) return;
    await S.createProfile(name);
    newProfileName.value = "";
    activeProfile = await S.getActiveProfile();
    await renderProfileList();
    await renderProfileSwitcher();
  });

  exportBtn.addEventListener("click", async () => {
    const data = await S.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `social-vault-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const merge = confirm("OK = merge into existing data. Cancel = replace everything.");
      await S.importAll(payload, { merge });
      activeProfile = await S.getActiveProfile();
      await renderAll();
      alert("Import complete.");
    } catch (err) {
      alert("Import failed: " + err.message);
    } finally {
      importFile.value = "";
    }
  });

  // ---------- theme ----------
  async function applyTheme(theme) {
    document.body.dataset.theme = theme;
    const resolved =
      theme === "system"
        ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : theme;
    document.body.dataset.resolvedTheme = resolved;
  }

  async function applyThemeUIState() {
    const { theme } = await S.getSettings();
    document.querySelectorAll(".theme-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.theme === theme);
    });
  }

  document.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const theme = btn.dataset.theme;
      await S.setSettings({ theme });
      await applyTheme(theme);
      await applyThemeUIState();
    });
  });

  // ---------- master render ----------
  async function renderAll() {
    await renderProfileSwitcher();
    await renderLinks();
    await renderDetails();
    await refreshAnalytics();
  }

  const { theme } = await S.getSettings();
  await applyTheme(theme);
  await renderAll();
})();
