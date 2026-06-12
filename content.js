// content.js — injected on demand for autofill.
// Messages handled:
//   SV_FILL_FOCUSED { value, targetElementId } — paste a single value into the right-clicked field.
//   SV_FILL_PAGE   { profile }                 — heuristic bulk fill of all matchable fields.

(function () {
  if (window.__socialVaultInjected) return;
  window.__socialVaultInjected = true;

  function setValue(el, value) {
    if (!el) return false;
    const proto =
      el.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function isFillable(el) {
    if (!el) return false;
    if (el.disabled || el.readOnly) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName !== "INPUT") return false;
    const t = (el.type || "text").toLowerCase();
    return ["text", "email", "tel", "url", "search", "number", ""].includes(t);
  }

  function fieldSignals(el) {
    const labelText = (() => {
      if (el.id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl) return lbl.textContent || "";
      }
      const parentLabel = el.closest("label");
      if (parentLabel) return parentLabel.textContent || "";
      return "";
    })();

    // aria-labelledby: resolve every referenced id and join their text.
    // Google Forms wires inputs to their visible question this way.
    const labelledby = el.getAttribute("aria-labelledby") || "";
    const labelledbyText = labelledby
      ? labelledby
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent || "")
          .join(" ")
      : "";

    // Nearest question-wrapping container. Google Forms uses role="listitem"
    // around each question, with the prompt as a [role="heading"] inside.
    let containerText = "";
    const container = el.closest('[role="listitem"], fieldset, [role="group"]');
    if (container) {
      const heading = container.querySelector('[role="heading"]');
      if (heading) containerText = heading.textContent || "";
      if (!containerText) {
        containerText = (container.innerText || container.textContent || "").slice(0, 160);
      }
    }

    return [
      el.type,
      el.name,
      el.id,
      el.autocomplete,
      el.placeholder,
      el.getAttribute("aria-label"),
      labelledbyText,
      labelText,
      containerText,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  const RULES = [
    {
      key: "email",
      match: (s, el) => (el.type === "email" || /email|e-mail/.test(s) ? 5 : 0),
    },
    {
      key: "phone",
      match: (s, el) =>
        el.type === "tel" || /\bphone|\btel(ephone)?|mobile|whatsapp/.test(s) ? 5 : 0,
    },
    {
      key: "name",
      match: (s) => {
        if (/full.?name/.test(s)) return 5;
        // Combined "First and Last Name" — fill with full name.
        if (/first.*last|last.*first/.test(s)) return 5;
        if (/\bname\b/.test(s) && !/user|company|file|first|last|middle/.test(s)) return 3;
        return 0;
      },
    },
    {
      key: "address",
      match: (s) => (/address|street|addr\b/.test(s) ? 4 : 0),
    },
    {
      key: "pincode",
      match: (s) => (/pin.?code|postal|zip/.test(s) ? 5 : 0),
    },
  ];

  // Aliases used when scoring a form field's signal against a saved link's
  // platform. Keys are normalized (lowercased, single-spaced).
  const PORTFOLIO_GROUP = [
    "portfolio",
    "personal website",
    "personal site",
    "website",
    "homepage",
    "personal page",
    "blog",
    "site",
  ];

  const PLATFORM_ALIASES = {
    x: ["x", "twitter", "x.com"],
    twitter: ["twitter", "x", "x.com"],
    github: ["github", "gh"],
    linkedin: ["linkedin", "li"],
    instagram: ["instagram", "insta", "ig"],
    youtube: ["youtube", "yt"],
    facebook: ["facebook", "fb"],
    dribbble: ["dribbble"],
    behance: ["behance"],
    medium: ["medium"],
    portfolio: PORTFOLIO_GROUP,
    website: PORTFOLIO_GROUP,
    "personal website": PORTFOLIO_GROUP,
    "personal site": PORTFOLIO_GROUP,
    homepage: PORTFOLIO_GROUP,
    blog: PORTFOLIO_GROUP,
    site: PORTFOLIO_GROUP,
  };

  // Normalize a platform string: lowercase, replace punctuation with spaces,
  // collapse runs of whitespace. So "Personal-Website" and "personal_website"
  // both resolve to the "personal website" alias group.
  function normalizePlatform(platform) {
    return String(platform || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function aliasesFor(platform) {
    const key = normalizePlatform(platform);
    if (!key) return [];
    return PLATFORM_ALIASES[key] || [key];
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function scoreLink(signal, el, platform) {
    const aliases = aliasesFor(platform);
    if (!aliases.length) return 0;
    let score = 0;
    for (const a of aliases) {
      const re = new RegExp(`\\b${escapeRe(a)}\\b`, "i");
      if (re.test(signal)) score = Math.max(score, 5);
      else if (signal.includes(a)) score = Math.max(score, 3);
    }
    if (score === 0) return 0;
    if (el.type === "url" || /\b(url|link|profile|handle)\b/.test(signal)) score += 1;
    return score;
  }

  function bulkFill(profile) {
    const filled = { count: 0, perField: {} };
    const inputs = Array.from(document.querySelectorAll("input, textarea")).filter(isFillable);
    const consumed = new WeakSet();

    // Pass 1: contact details.
    for (const el of inputs) {
      const s = fieldSignals(el);
      let best = { key: null, score: 0 };
      for (const rule of RULES) {
        const score = rule.match(s, el);
        if (score > best.score) best = { key: rule.key, score };
      }
      if (!best.key || best.score < 3) continue;
      const val = profile.details?.[best.key];
      if (!val) continue;
      if (el.value && el.value.trim() === val.trim()) {
        consumed.add(el);
        continue;
      }
      if (setValue(el, val)) {
        consumed.add(el);
        filled.count++;
        filled.perField[best.key] = (filled.perField[best.key] || 0) + 1;
      }
    }

    // Pass 2: social links by platform name.
    const links = Array.isArray(profile.links) ? profile.links : [];
    if (links.length) {
      for (const el of inputs) {
        if (consumed.has(el)) continue;
        if (el.type === "email" || el.type === "tel") continue;
        const s = fieldSignals(el);
        let best = { link: null, score: 0 };
        for (const link of links) {
          if (!link || !link.platform || !link.link) continue;
          const score = scoreLink(s, el, link.platform);
          if (score > best.score) best = { link, score };
        }
        if (!best.link || best.score < 4) continue;
        const val = best.link.link;
        if (el.value && el.value.trim() === val.trim()) continue;
        if (setValue(el, val)) {
          consumed.add(el);
          filled.count++;
          const k = `link:${best.link.platform}`;
          filled.perField[k] = (filled.perField[k] || 0) + 1;
        }
      }
    }

    return filled;
  }

  function resolveTarget(targetElementId) {
    if (targetElementId != null && chrome.contextMenus?.getTargetElement) {
      try {
        const el = chrome.contextMenus.getTargetElement(targetElementId);
        if (el) return el;
      } catch (_) {}
    }
    if (window.__svLastEditable && document.contains(window.__svLastEditable)) {
      return window.__svLastEditable;
    }
    return document.activeElement;
  }

  document.addEventListener(
    "focusin",
    (e) => {
      if (isFillable(e.target)) window.__svLastEditable = e.target;
    },
    true
  );
  document.addEventListener(
    "contextmenu",
    (e) => {
      if (isFillable(e.target)) window.__svLastEditable = e.target;
    },
    true
  );

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.type) {
      sendResponse({ ok: false, reason: "ignored" });
      return true;
    }
    if (msg.type === "SV_FILL_FOCUSED") {
      const el = resolveTarget(msg.targetElementId);
      if (!isFillable(el)) {
        sendResponse({ ok: false, reason: "no-target", tag: el?.tagName, type: el?.type });
        return true;
      }
      const ok = setValue(el, msg.value);
      sendResponse({ ok, reason: ok ? null : "set-failed" });
      return true;
    }
    if (msg.type === "SV_FILL_PAGE") {
      const result = bulkFill(msg.profile || { details: {}, links: [] });
      sendResponse({ ok: true, ...result });
      return true;
    }
  });
})();
