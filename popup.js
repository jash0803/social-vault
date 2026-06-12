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
  const totalClicksEl = $("totalClicks");
  const timeSavedEl = $("timeSaved");
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

  const briefCopy = (btn, label = "Copied!") => {
    const original = btn.textContent;
    btn.textContent = label;
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
    }, 1200);
  };

  async function copyText(text, actionKey, btn) {
    await navigator.clipboard.writeText(text);
    await S.recordAction(actionKey);
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
          <button class="ghost-btn edit" data-index="${index}">Edit</button>
          <button class="primary-btn copy" data-index="${index}">Copy</button>
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

  // Delete-on-edit: long-press the edit button as delete shortcut.
  // (Simpler: surface a delete via right-click of edit button.)
  linksList.addEventListener("contextmenu", async (e) => {
    const btn = e.target.closest("button.edit");
    if (!btn) return;
    e.preventDefault();
    const i = Number(btn.dataset.index);
    if (!Number.isFinite(i)) return;
    const item = activeProfile.links[i];
    if (!item) return;
    if (!confirm(`Delete "${item.platform}"?`)) return;
    activeProfile.links.splice(i, 1);
    await S.putProfile(activeProfile);
    await renderLinks();
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
        copyBtn.className = "primary-btn copy";
        copyBtn.textContent = "Copy";
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

  // ---------- profile card ----------
  function profileCardText() {
    const d = activeProfile.details || {};
    const links = activeProfile.links || [];
    let out = "";
    if (d.name) out += `🌟 ${d.name}'s Profile 🌟\n\n`;
    if (Object.values(d).some(Boolean)) {
      out += "📋 Personal Details:\n";
      DETAIL_FIELDS.forEach(({ key, label }) => {
        if (d[key]) out += `${label}: ${d[key]}\n`;
      });
      out += "\n";
    }
    if (links.length) {
      out += "🔗 Social Links:\n";
      links.forEach(({ platform, link }) => (out += `${platform}: ${link}\n`));
    }
    return out.trim();
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
    totalClicksEl.textContent = a.totalClicks || 0;
    timeSavedEl.textContent = formatTime((a.totalClicks || 0) * 3);
  }

  showAnalyticsBtn.addEventListener("click", async () => {
    await refreshAnalytics();
    analyticsModal.hidden = false;
  });

  // ---------- settings ----------
  openSettingsBtn.addEventListener("click", async () => {
    await renderProfileList();
    await applyThemeUIState();
    settingsModal.hidden = false;
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
