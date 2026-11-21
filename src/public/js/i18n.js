/**
 * AI Hub - Polyglot Hub Client i18n Engine
 * Provides instant multi-language support (ID, EN, JA) with zero runtime latency.
 */

(function () {
  const SUPPORTED_LANGS = ["id", "en", "ja"];
  const DEFAULT_LANG = "id";

  let currentLang = localStorage.getItem("ai_hub_locale") || DEFAULT_LANG;
  if (!SUPPORTED_LANGS.includes(currentLang)) {
    currentLang = DEFAULT_LANG;
  }

  let dictionaries = {};
  let isLoaded = false;

  async function loadDictionary(lang) {
    if (dictionaries[lang]) return dictionaries[lang];
    try {
      const res = await fetch(`/locales/${lang}.json`);
      if (res.ok) {
        dictionaries[lang] = await res.json();
        return dictionaries[lang];
      }
    } catch (e) {
      console.warn(`[i18n] Failed to load dictionary for ${lang}`, e);
    }
    return {};
  }

  function getNestedValue(obj, keyPath) {
    if (!obj || !keyPath) return null;
    const parts = keyPath.split(".");
    let curr = obj;
    for (const p of parts) {
      if (curr && typeof curr === "object" && p in curr) {
        curr = curr[p];
      } else {
        return null;
      }
    }
    return curr;
  }

  function t(key, fallback) {
    const dict = dictionaries[currentLang] || {};
    const val = getNestedValue(dict, key);
    if (val !== null && val !== undefined) return val;

    // Fallback to Indonesian then fallback string or key
    if (currentLang !== "id" && dictionaries["id"]) {
      const idVal = getNestedValue(dictionaries["id"], key);
      if (idVal !== null && idVal !== undefined) return idVal;
    }
    return fallback !== undefined ? fallback : key;
  }

  function applyTranslations(root = document) {
    // Text content
    const elements = root.querySelectorAll("[data-i18n]");
    elements.forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const translation = t(key, el.textContent.trim());
      if (translation) {
        el.textContent = translation;
      }
    });

    // Placeholders
    const inputs = root.querySelectorAll("[data-i18n-placeholder]");
    inputs.forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      const translation = t(key, el.getAttribute("placeholder"));
      if (translation) {
        el.setAttribute("placeholder", translation);
      }
    });

    // Titles / Tooltips
    const titled = root.querySelectorAll("[data-i18n-title]");
    titled.forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      const translation = t(key, el.getAttribute("title"));
      if (translation) {
        el.setAttribute("title", translation);
      }
    });

    // Update active state on language selector buttons/dropdown
    document.querySelectorAll(".lang-option").forEach((btn) => {
      const l = btn.getAttribute("data-lang");
      if (l === currentLang) {
        btn.classList.add("bg-brand-600", "text-white", "font-bold");
        btn.classList.remove("text-gray-400", "hover:text-white");
      } else {
        btn.classList.remove("bg-brand-600", "text-white", "font-bold");
        btn.classList.add("text-gray-400", "hover:text-white");
      }
    });

    const langBadge = document.getElementById("currentLangBadge");
    if (langBadge) {
      const map = { id: "🇮🇩 ID", en: "🇬🇧 EN", ja: "🇯🇵 JA" };
      langBadge.textContent = map[currentLang] || currentLang.toUpperCase();
    }
  }

  async function setLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    currentLang = lang;
    localStorage.setItem("ai_hub_locale", lang);
    document.documentElement.lang = lang;

    await loadDictionary(lang);
    applyTranslations();

    // Notify any custom components that might need re-rendering
    window.dispatchEvent(new CustomEvent("languageChanged", { detail: { lang } }));
  }

  // Initialize
  async function initI18n() {
    await loadDictionary("id"); // Always load default
    if (currentLang !== "id") {
      await loadDictionary(currentLang);
    }
    isLoaded = true;
    document.documentElement.lang = currentLang;
    applyTranslations();
  }

  // Expose to window
  window.i18n = {
    t,
    setLanguage,
    applyTranslations,
    getLanguage: () => currentLang,
  };
  window.t = t;
  window.setLanguage = setLanguage;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initI18n);
  } else {
    initI18n();
  }
})();
