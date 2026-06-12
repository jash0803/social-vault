// content.js — injected on demand by the right-click "Social Vault" menu.
// Handles SV_FILL_FOCUSED { value }: writes the value into the currently focused input/textarea.

(function () {
  if (window.__socialVaultInjected) return;
  window.__socialVaultInjected = true;

  // Use the native prototype setter so React/Vue notice the change.
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

  function resolveTarget(targetElementId) {
    // Prefer the element the user actually right-clicked. After opening the
    // context menu, document.activeElement is usually no longer the input.
    if (targetElementId != null && chrome.contextMenus?.getTargetElement) {
      try {
        const el = chrome.contextMenus.getTargetElement(targetElementId);
        if (el) return el;
      } catch (_) {}
    }
    // Fallbacks: last focused editable element, then current activeElement.
    if (window.__svLastEditable && document.contains(window.__svLastEditable)) {
      return window.__svLastEditable;
    }
    return document.activeElement;
  }

  // Track the most recently focused editable element so we have a fallback
  // when the context menu has already stolen focus.
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
    if (!msg || msg.type !== "SV_FILL_FOCUSED") {
      sendResponse({ ok: false, reason: "ignored" });
      return true;
    }
    const el = resolveTarget(msg.targetElementId);
    if (!isFillable(el)) {
      sendResponse({ ok: false, reason: "no-target", tag: el?.tagName, type: el?.type });
      return true;
    }
    const ok = setValue(el, msg.value);
    sendResponse({ ok, reason: ok ? null : "set-failed" });
    return true;
  });
})();
