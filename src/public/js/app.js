// AI Hub - App Initialization, Routing & Layout Controller

let currentTab = "overview";

function switchTab(tab) {
  currentTab = tab;
  const tabs = ["overview", "agents", "keys", "providers", "playground", "docs"];

  tabs.forEach(t => {
    const view = document.getElementById(`view-${t}`);
    const btn = document.getElementById(`tab-${t}`);
    const mobileBtn = document.getElementById(`mobile-tab-${t}`);

    if (t === tab) {
      if (view) view.classList.remove("hidden");
      if (btn) {
        btn.className = "tab-btn px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 tab-active";
      }
      if (mobileBtn) {
        mobileBtn.className = "px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 tab-active";
      }
    } else {
      if (view) view.classList.add("hidden");
      if (btn) {
        btn.className = "tab-btn px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 text-gray-400 hover:text-white hover:bg-surface-700/60";
      }
      if (mobileBtn) {
        mobileBtn.className = "px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 text-gray-400 hover:text-white hover:bg-surface-700/60";
      }
    }
  });

  // Mobile menu close on select
  closeMobileMenu();

  if (window.lucide) window.lucide.createIcons();

  if (tab === "overview" && typeof loadStats === "function") loadStats();
  if (tab === "agents" && typeof initAgentsTab === "function") initAgentsTab();
  if (tab === "keys" && typeof loadKeys === "function") loadKeys();
  if (tab === "providers" && typeof loadProviders === "function") {
    loadProviders();
    if (typeof loadAliases === "function") loadAliases();
  }
  if (tab === "playground") {
    if (typeof loadPromptPresets === "function") loadPromptPresets();
    if (typeof updatePlaygroundCostEstimate === "function") updatePlaygroundCostEstimate();
  }
}

function toggleMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  if (menu) menu.classList.toggle("hidden");
}

function closeMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  if (menu) menu.classList.add("hidden");
}

function refreshAll() {
  if (typeof loadStats === "function") loadStats();
  if (typeof loadKeys === "function") loadKeys();
  if (typeof loadProviders === "function") loadProviders();
  if (typeof loadPromptPresets === "function") loadPromptPresets();
  if (typeof loadAvailableScopes === "function") loadAvailableScopes();
  if (typeof loadAgentAnalytics === "function") loadAgentAnalytics();
  showToast("Dashboard metrics refreshed", "info", 1800);
}

// Initial Boot
document.addEventListener("DOMContentLoaded", () => {
  const tokenInput = document.getElementById("adminTokenInput");
  if (tokenInput) {
    tokenInput.value = getAdminToken();
  }

  // Initial load
  refreshAll();

  if (window.lucide) window.lucide.createIcons();
});
