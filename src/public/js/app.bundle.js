/* AI HUB Unified Application Bundle */


/* --- START: api.js --- */
// AI Hub - Core API Client, Auth & UI Notifications

const _memStorage = {};
function safeStorageGet(key, fallback = "") {
  try {
    const val = localStorage.getItem(key);
    return val !== null && val !== undefined ? val : fallback;
  } catch {
    return _memStorage[key] !== undefined ? _memStorage[key] : fallback;
  }
}
function safeStorageSet(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch {
    _memStorage[key] = val;
  }
}

let adminToken = safeStorageGet("ai_hub_admin_token", "aih_admin_secret_2026");

function getAdminToken() {
  return adminToken;
}

function saveAdminToken() {
  const input = document.getElementById("adminTokenInput");
  const mobileInput = document.getElementById("adminTokenInputMobile");
  const val = (input?.value || mobileInput?.value || "").trim();
  if (!val) return;

  adminToken = val;
  safeStorageSet("ai_hub_admin_token", adminToken);
  if (input) input.value = val;
  if (mobileInput) mobileInput.value = val;

  const t = window.t || ((k, f) => f || k);
  showToast(t("nav.token_saved", "Master Admin Token berhasil disimpan!"), "success");
  if (typeof refreshAll === "function") {
    refreshAll();
  }
}

async function fetchApi(url, options = {}) {
  const headers = options.headers || {};
  headers["x-admin-token"] = adminToken;
  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  return fetch(url, { ...options, headers });
}

async function apiRequest(endpoint, method = "GET", body = null) {
  const options = { method };
  if (body) options.body = body;
  return fetchApi(endpoint, options);
}

function formatToastMessage(msg) {
  if (typeof msg !== "string") return String(msg);
  
  // Try to parse JSON error message if embedded
  try {
    const jsonMatch = msg.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const errMsg = parsed.error?.message || parsed.error || parsed.message;
      if (errMsg) {
        // Strip out the raw JSON and present clean error
        const prefix = msg.replace(jsonMatch[0], "").replace(/[:\s]+$/, "");
        return `${prefix ? prefix + ': ' : ''}${errMsg}`;
      }
    }
  } catch {}

  // Truncate overly long error dumps
  if (msg.length > 250) {
    return msg.slice(0, 247) + "...";
  }
  return msg;
}

function showToast(message, type = "info", duration = 4000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const cleanMessage = formatToastMessage(message);
  const toast = document.createElement("div");
  toast.className = `toast toast-${type} w-full`;

  const iconName = type === "success" ? "check-circle" : (type === "error" ? "alert-circle" : "info");
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4 flex-shrink-0 mt-0.5"></i>
    <div class="flex-1 break-words text-xs leading-relaxed">${cleanMessage}</div>
    <button onclick="this.parentElement.remove()" class="text-white/60 hover:text-white p-0.5 ml-1 shrink-0">
      <i data-lucide="x" class="w-3.5 h-3.5"></i>
    </button>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    toast.style.animation = "toast-fade-out 0.25s ease forwards";
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

function copyToClipboard(text, successMsg = "Copied to clipboard!") {
  const t = window.t || ((k, f) => f || k);
  const msg = t("common.copied", successMsg);
  if (!navigator.clipboard) {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    showToast(msg, "success");
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    showToast(msg, "success");
  }).catch(() => {
    showToast("Failed to copy", "error");
  });
}

// Global window exposure
window.fetchApi = fetchApi;
window.apiRequest = apiRequest;
window.showToast = showToast;
window.getAdminToken = getAdminToken;
window.saveAdminToken = saveAdminToken;
window.copyToClipboard = copyToClipboard;


/* --- END: api.js --- */

/* --- START: app.js --- */
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
    if (typeof loadPromptPresets === "function") {
      loadPromptPresets();
      if (typeof loadPlaygroundModels === "function") loadPlaygroundModels();
    }
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
  if (typeof loadPromptPresets === "function") {
    loadPromptPresets();
    if (typeof loadPlaygroundModels === "function") loadPlaygroundModels();
  }
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

/* --- END: app.js --- */

/* --- START: overview.js --- */
// AI Hub - Overview & Realtime Analytics View

async function loadStats() {
  try {
    const res = await fetchApi("/api/stats");
    if (!res.ok) return;
    const data = await res.json();
    const s = data.stats;

    // Stat Cards
    const elReq = document.getElementById("statTotalRequests");
    if (elReq) elReq.textContent = s.totalRequests.toLocaleString();

    const elTok = document.getElementById("statTotalTokens");
    if (elTok) elTok.textContent = s.totalTokens.toLocaleString();

    const elCost = document.getElementById("statTotalCost");
    if (elCost) elCost.textContent = `$${(s.totalCostUsd || 0).toFixed(4)}`;

    const elRate = document.getElementById("statSuccessRate");
    if (elRate) elRate.textContent = `${s.successRate}%`;

    const elKeys = document.getElementById("statActiveKeys");
    if (elKeys) elKeys.textContent = s.activeKeysCount;

    const elLat = document.getElementById("statAvgLatency");
    if (elLat && s.avgLatencyMs !== undefined) {
      elLat.textContent = `${s.avgLatencyMs}ms`;
    }

    // Traffic Distribution across all providers
    const dist = s.providerDistribution || {};
    const providerKeys = [
      "gemini", "openai", "anthropic", "openrouter",
      "mistral", "groq", "deepseek", "together",
      "xai", "cohere", "perplexity", "ollama", "audio"
    ];

    const total = providerKeys.reduce((acc, k) => acc + (dist[k] || 0), 0);
    const getPct = (val) => (total > 0 ? Math.round((val / total) * 100) : 0);

    providerKeys.forEach(k => {
      const bar = document.getElementById(`bar-${k}`);
      const lbl = document.getElementById(`lbl-${k}`);
      const pct = getPct(dist[k] || 0);
      if (bar) bar.style.width = `${pct}%`;
      if (lbl) lbl.textContent = `${pct}% (${(dist[k] || 0).toLocaleString()})`;
    });

    // Render 7-day Visual Analytics Trend Chart
    if (s.dailyHistory) {
      window._cachedDailyHistory = s.dailyHistory;
      renderAnalyticsChart(s.dailyHistory);
    }

    // Load System Telemetry
    loadSystemHealth();
    loadCacheStats();

    // Also load recent logs
    if (typeof loadLogs === "function") {
      loadLogs();
    }
  } catch (err) {
    console.error("Failed to load overview stats:", err);
  }
}

async function loadSystemHealth() {
  try {
    const res = await fetchApi("/api/system/health");
    if (!res.ok) return;
    const data = await res.json();
    const elUptime = document.getElementById("sysUptime");
    const elMem = document.getElementById("sysMemory");
    const elPlatform = document.getElementById("sysPlatform");
    if (elUptime) elUptime.textContent = data.uptime;
    if (elMem) elMem.textContent = `${data.memory.rssMb} MB RSS (${data.memory.heapUsedMb} MB Heap)`;
    if (elPlatform) elPlatform.textContent = `${data.platform} • Node ${data.nodeVersion}`;
  } catch {}
}

function renderAnalyticsChart(dailyHistory = []) {
  const container = document.getElementById("analyticsChartContainer");
  const summaryEl = document.getElementById("chartTotalSummary");
  if (!container) return;

  const t = window.t || ((k, fallback) => fallback || k);

  if (!dailyHistory || dailyHistory.length === 0) {
    container.innerHTML = `<div class="w-full text-center py-6 text-gray-500 text-xs">${t("overview.no_logs", "Belum ada data transaksi dalam 7 hari terakhir.")}</div>`;
    return;
  }

  const maxRequests = Math.max(...dailyHistory.map(d => d.requests), 1);
  const total7dRequests = dailyHistory.reduce((acc, d) => acc + d.requests, 0);
  const total7dTokens = dailyHistory.reduce((acc, d) => acc + d.tokens, 0);
  const total7dCost = dailyHistory.reduce((acc, d) => acc + d.costUsd, 0);

  if (summaryEl) {
    summaryEl.innerHTML = `${t("overview.total_7d", "Total 7 Hari")}: <span class="text-white font-bold">${total7dRequests.toLocaleString()} reqs</span> • <span class="text-amber-400 font-bold">${total7dTokens.toLocaleString()} tokens</span> • <span class="text-emerald-400 font-bold">$${total7dCost.toFixed(4)}</span>`;
  }

  container.innerHTML = dailyHistory.map(d => {
    const pct = Math.max(Math.round((d.requests / maxRequests) * 100), d.requests > 0 ? 12 : 4);
    return `
      <div class="flex-1 flex flex-col items-center gap-1 group relative min-w-0">
        <div class="absolute -top-12 bg-surface-900 border border-surface-700 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap shadow-xl">
          <div class="font-bold">${d.date} (${d.label})</div>
          <div class="text-brand-300">${d.requests} reqs • ${d.tokens.toLocaleString()} tokens</div>
          <div class="text-emerald-400">$${d.costUsd.toFixed(4)} USD</div>
        </div>
        <div class="w-full bg-surface-800/80 rounded-t-lg h-24 sm:h-32 flex items-end justify-center p-0.5 sm:p-1 relative overflow-hidden">
          <div class="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-indigo-400 transition-all duration-500 shadow-md group-hover:from-brand-500 group-hover:to-cyan-400"
               style="height: ${pct}%;"></div>
        </div>
        <span class="text-[8px] sm:text-[10px] font-medium text-gray-400 group-hover:text-white transition-colors truncate w-full text-center">${d.label || d.date.slice(5)}</span>
      </div>
    `;
  }).join("");
}

// Realtime KPI incremental update on SSE new log
window.addEventListener("newLogReceived", (e) => {
  const log = e.detail;
  if (!log) return;

  const elReq = document.getElementById("statTotalRequests");
  if (elReq) {
    const cur = parseInt(elReq.textContent.replace(/,/g, "") || "0", 10);
    elReq.textContent = (cur + 1).toLocaleString();
  }

  const elTok = document.getElementById("statTotalTokens");
  if (elTok) {
    const cur = parseInt(elTok.textContent.replace(/,/g, "") || "0", 10);
    const added = (log.promptTokens || 0) + (log.completionTokens || 0);
    elTok.textContent = (cur + added).toLocaleString();
  }

  const elCost = document.getElementById("statTotalCost");
  if (elCost) {
    const cur = parseFloat(elCost.textContent.replace("$", "") || "0");
    elCost.textContent = `$${(cur + (log.costUsd || 0)).toFixed(4)}`;
  }
});

// Cache Metrics
async function loadCacheStats() {
  try {
    const res = await fetchApi("/api/cache/stats");
    if (!res.ok) return;
    const data = await res.json();
    const elRatio = document.getElementById("cacheHitRatio");
    const elSaved = document.getElementById("cacheTokensSaved");
    const elCost = document.getElementById("cacheCostSaved");
    const elEntries = document.getElementById("cacheEntriesCount");

    if (elRatio) elRatio.textContent = `${data.hitRatio}%`;
    if (elSaved) elSaved.textContent = (data.tokensSaved || 0).toLocaleString();
    if (elCost) elCost.textContent = `$${(data.costSavedUsd || 0).toFixed(4)}`;
    if (elEntries) elEntries.textContent = `${data.size || 0} entries`;
  } catch {}
}

async function clearPromptCache() {
  if (!confirm("Hapus seluruh in-memory response cache sekarang?")) return;
  try {
    const res = await fetchApi("/api/cache/clear", { method: "POST" });
    const data = await res.json();
    showToast(`Smart cache dibersihkan (${data.clearedEntries || 0} entri dihapus)`, "success");
    loadCacheStats();
  } catch (err) {
    showToast(`Gagal membersihkan cache: ${err.message}`, "error");
  }
}

// 1-Click Backup Export
function exportHubBackup() {
  const token = getAdminToken();
  window.open(`/api/backup?token=${encodeURIComponent(token)}`, "_blank");
  showToast("Mengunduh backup konfigurasi AI Hub...", "success");
}

// 1-Click Restore Import
async function triggerHubRestore(inputEl) {
  const file = inputEl.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const payload = JSON.parse(e.target.result);
      const storeData = payload.store || payload;
      if (!storeData.apiKeys || !storeData.providerConfigs) {
        throw new Error("File backup tidak valid atau rusak.");
      }

      if (!confirm("PERINGATAN: Memulihkan konfigurasi akan menimpa seluruh API Keys dan Provider saat ini. Lanjutkan?")) {
        inputEl.value = "";
        return;
      }

      const res = await fetchApi("/api/restore", {
        method: "POST",
        body: JSON.stringify({ store: storeData }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal restore");

      showToast("Konfigurasi AI Hub berhasil dipulihkan secara penuh!", "success");
      setTimeout(() => location.reload(), 1200);
    } catch (err) {
      showToast(`Restore gagal: ${err.message}`, "error");
    } finally {
      inputEl.value = "";
    }
  };
  reader.readAsText(file);
}

// Expose globally
window.loadCacheStats = loadCacheStats;
window.clearPromptCache = clearPromptCache;
window.exportHubBackup = exportHubBackup;
window.triggerHubRestore = triggerHubRestore;

// Re-render chart on language change
window.addEventListener("languageChanged", () => {
  if (window._cachedDailyHistory) {
    renderAnalyticsChart(window._cachedDailyHistory);
  }
});

/* --- END: overview.js --- */

/* --- START: agents.js --- */
// AI Hub - Autonomous Agents & MCP Tool Hub Controller
// Manages multi-tenant project scopes, live agent execution, MCP tools, and webhooks

let activeScopeId = "cctv";
let activeScopeData = null;
let agentChatHistory = [];
let availableScopes = [];
let autoSpeakAgent = false;

// Initialize on tab activation
async function initAgentsTab() {
  await loadAvailableScopes();
  await selectScope(activeScopeId);
  loadAgentModelOptions();
  loadAgentAnalytics();
  loadCronJobs();
  loadAgentMemories();
}

async function loadAgentModelOptions() {
  const select = document.getElementById("agentModelSelect");
  if (!select) return;

  try {
    const res = await apiRequest("/api/providers");
    if (!res) return;

    const current = select.value || "gemini-3-flash-preview";
    let html = `<option value="">Auto Router (Default Hub)</option>`;

    for (const [pId, pConf] of Object.entries(res)) {
      if (!pConf.models || pConf.models.length === 0) continue;
      const isConfigured = Boolean(pConf.apiKey || pId === "ollama");
      const icon = isConfigured ? "🟢" : "⚪";
      html += `<optgroup label="${icon} ${pConf.name} (${isConfigured ? 'Active' : 'Unconfigured'})">`;
      for (const m of pConf.models) {
        html += `<option value="${m}">${m}${isConfigured ? ' ★' : ''}</option>`;
      }
      html += `</optgroup>`;
    }
    select.innerHTML = html;
    if (current) select.value = current;
  } catch {}
}

// Load scopes list from /api/agents/projects
async function loadAvailableScopes() {
  try {
    const res = await apiRequest("/api/agents/projects");
    if (res && res.projects) {
      availableScopes = res.projects;
      renderScopePills(res.projects);
    }
  } catch (err) {
    console.error("Failed to load scopes:", err);
  }
}

// Render Scope Switcher Pills
function renderScopePills(projects) {
  const container = document.getElementById("agentScopePills");
  if (!container) return;

  const icons = {
    cctv: "shield",
    flowmeter: "gauge",
    tanicerdas: "sprout",
    shop: "shopping-bag",
    pulse: "server",
    superadmin: "crown",
  };

  container.innerHTML = projects.map(p => {
    const isActive = p.id === activeScopeId;
    const iconName = icons[p.id] || "bot";
    return `
      <button onclick="selectScope('${p.id}')"
        class="agent-scope-btn px-4 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-2 whitespace-nowrap transition-all shadow-sm ${
          isActive
            ? "active bg-indigo-600 text-white border-indigo-400"
            : "bg-surface-800/80 text-gray-400 hover:text-white hover:bg-surface-700/60 border-surface-700/60"
        }">
        <i data-lucide="${iconName}" class="w-4 h-4 ${isActive ? "text-white" : "text-indigo-400"}"></i>
        <span>${p.name.split(" ")[0]}</span>
        <span class="px-1.5 py-0.5 rounded-md text-[10px] ${isActive ? "bg-white/20 text-white" : "bg-surface-900 text-gray-400"}">${p.toolCount}</span>
      </button>
    `;
  }).join("");

  if (window.lucide) window.lucide.createIcons();
}

// Select and switch active scope
async function selectScope(scopeId) {
  activeScopeId = scopeId;
  renderScopePills(availableScopes);

  try {
    const res = await apiRequest(`/api/agents/projects/${scopeId}`);
    if (res) {
      activeScopeData = res;
      renderActiveScopeDetails(res);
      initScopeChat(res);
    }
  } catch (err) {
    console.error("Failed to load scope details:", err);
  }
}

// Render Scope Profile, Quick Suggestions, and MCP Tools Catalog
function renderActiveScopeDetails(scope) {
  // Title & description
  const titleEl = document.getElementById("agentScopeTitle");
  const descEl = document.getElementById("agentScopeDesc");
  const badgeEl = document.getElementById("agentActiveScopeBadge");
  const toolCountEl = document.getElementById("agentScopeToolCount");

  if (titleEl) titleEl.textContent = scope.name;
  if (descEl) descEl.textContent = scope.description;
  if (badgeEl) badgeEl.textContent = scope.id.toUpperCase();
  if (toolCountEl) toolCountEl.textContent = `${scope.tools.length} Tools Connected`;

  // Quick action suggestions
  const suggContainer = document.getElementById("agentQuickSuggestions");
  if (suggContainer && scope.suggestions) {
    suggContainer.innerHTML = scope.suggestions.map(s => `
      <button onclick="runQuickAgentPrompt('${escapeHtml(s.prompt)}')"
        class="text-left text-xs px-3 py-2 rounded-xl bg-surface-900/80 hover:bg-indigo-950/60 text-indigo-300 hover:text-indigo-100 border border-indigo-900/40 hover:border-indigo-500/50 transition-all flex items-center justify-between group shadow-sm">
        <span>${escapeHtml(s.label)}</span>
        <i data-lucide="arrow-right" class="w-3 h-3 text-indigo-400 group-hover:translate-x-0.5 transition-transform"></i>
      </button>
    `).join("");
  }

  // MCP Tools List
  const toolsContainer = document.getElementById("agentMcpToolsList");
  if (toolsContainer && scope.tools) {
    toolsContainer.innerHTML = scope.tools.map(toolName => `
      <div class="tool-badge-pill p-3 rounded-xl flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xs font-mono font-bold text-indigo-300 flex items-center gap-1.5 truncate">
            <i data-lucide="zap" class="w-3.5 h-3.5 text-amber-400 shrink-0"></i>
            <span>${toolName}</span>
          </div>
          <div class="text-[11px] text-gray-400 truncate mt-0.5">MCP Function Endpoint</div>
        </div>
        <button onclick="testToolDirect('${toolName}')"
          class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600/80 hover:bg-indigo-500 text-white shrink-0 shadow-sm transition-colors flex items-center gap-1">
          <i data-lucide="play" class="w-3 h-3"></i> Test
        </button>
      </div>
    `).join("");
  }

  // Update Widget embed preview
  const embedCodeEl = document.getElementById("widgetEmbedCode");
  if (embedCodeEl) {
    const origin = window.location.origin;
    embedCodeEl.textContent = `<script src="${origin}/widget.js" data-project="${scope.id}"><\/script>`;
  }

  if (window.lucide) window.lucide.createIcons();
}

// Initialize chat window for the scope
function initScopeChat(scope) {
  agentChatHistory = [
    {
      role: "assistant",
      content: scope.welcomeMessage || `Halo! Saya asisten pintar untuk scope ${scope.name}. Siap membantu Anda!`,
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    },
  ];
  renderAgentChat();
}

// Render chat messages
function renderAgentChat() {
  const container = document.getElementById("agentChatMessages");
  if (!container) return;

  container.innerHTML = agentChatHistory.map(m => {
    const isUser = m.role === "user";
    const time = m.timestamp || new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

    // Render tool execution card if message has tool calls
    let toolsHtml = "";
    if (m.toolCalls && m.toolCalls.length > 0) {
      toolsHtml = m.toolCalls.map((tc, idx) => `
        <div class="tool-exec-card p-3 rounded-xl mb-2.5 text-xs border border-indigo-500/20 bg-surface-900/80 shadow-inner">
          <div class="flex items-center justify-between text-indigo-300 font-mono font-semibold mb-1.5 flex-wrap gap-1">
            <span class="flex items-center gap-1.5">
              <span class="w-4 h-4 rounded-full bg-amber-400/20 text-amber-400 text-[10px] flex items-center justify-center font-bold font-sans">${idx + 1}</span>
              <i data-lucide="cpu" class="w-3.5 h-3.5 text-amber-400 shrink-0"></i>
              <span>Tool Call: <strong class="text-white">${tc.toolName}</strong></span>
            </span>
            <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-sans font-bold">Executed</span>
          </div>
          ${tc.arguments ? `
            <details class="mt-1 text-[11px] group">
              <summary class="cursor-pointer text-indigo-300 hover:text-indigo-200 select-none font-mono text-[10px] flex items-center gap-1">
                <span>▶ Input Arguments</span>
              </summary>
              <pre class="mt-1 p-2 bg-black/70 rounded-lg text-amber-300 font-mono text-[10px] overflow-x-auto border border-white/5">${escapeHtml(typeof tc.arguments === "string" ? tc.arguments : JSON.stringify(tc.arguments, null, 2))}</pre>
            </details>
          ` : ""}
          ${tc.result ? `
            <details class="mt-1 text-[11px] group" open>
              <summary class="cursor-pointer text-emerald-400 hover:text-emerald-300 select-none font-mono text-[10px] flex items-center gap-1">
                <span>▼ Output Result</span>
              </summary>
              <pre class="mt-1 p-2 bg-black/70 rounded-lg text-emerald-300 font-mono text-[10px] overflow-x-auto border border-white/5">${escapeHtml(typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result, null, 2))}</pre>
            </details>
          ` : ""}
        </div>
      `).join("");
    }

    return `
      <div class="flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1">
        <div class="flex items-center gap-1.5 text-[10px] text-gray-400 px-1">
          <span>${isUser ? "You" : activeScopeData?.name || "Agent"}</span>
          <span>•</span>
          <span>${time}</span>
          ${!isUser && m.modelUsed ? `<span class="text-indigo-400 font-mono">(${m.modelUsed})</span>` : ""}
        </div>

        <div class="max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 text-xs sm:text-sm shadow-md leading-relaxed ${
          isUser ? "chat-msg-user" : "chat-msg-bot text-gray-100"
        }">
          ${toolsHtml}
          <div class="markdown-body select-text">${formatMarkdown(m.content)}</div>

          ${!isUser ? `
            <div class="mt-2 pt-2 border-t border-white/5 flex items-center justify-end gap-2 text-[10px] text-gray-400">
              <button onclick="speakAgentMessage('${escapeHtml(m.content.replace(/'/g, "\\'"))}')"
                class="hover:text-indigo-300 flex items-center gap-1 transition-colors" title="Read Aloud">
                <i data-lucide="volume-2" class="w-3 h-3"></i> Speak
              </button>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
  if (window.lucide) window.lucide.createIcons();
}

// Send user message to agent
async function sendAgentMessage() {
  const inputEl = document.getElementById("agentChatInput");
  const sendBtn = document.getElementById("agentSendBtn");
  if (!inputEl) return;

  const text = inputEl.value.trim();
  if (!text) return;

  // Add user message to history
  agentChatHistory.push({
    role: "user",
    content: text,
    timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
  });
  inputEl.value = "";
  renderAgentChat();

  // Show typing indicator
  const container = document.getElementById("agentChatMessages");
  const typingId = `typing_${Date.now()}`;
  if (container) {
    const typingDiv = document.createElement("div");
    typingDiv.id = typingId;
    typingDiv.className = "flex items-center gap-2 text-xs text-indigo-400 p-2";
    typingDiv.innerHTML = `
      <div class="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"></div>
      <div class="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]"></div>
      <div class="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.4s]"></div>
      <span class="text-[11px] font-medium text-gray-400 ml-1">Executing agent tool reasoning...</span>
    `;
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
  }

  if (sendBtn) sendBtn.disabled = true;

  try {
    const modelPref = document.getElementById("agentModelSelect")?.value || "";
    // Build API messages payload (omit timestamp & toolCalls from outgoing context)
    const messages = agentChatHistory.map(m => ({
      role: m.role,
      content: m.content,
    }));

    const res = await apiRequest("/api/agents/chat", "POST", {
      project: activeScopeId,
      messages,
      model: modelPref || undefined,
    });

    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    if (res && res.content) {
      agentChatHistory.push({
        role: "assistant",
        content: res.content,
        toolCalls: res.toolCalls,
        modelUsed: res.modelUsed,
        timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      });
      renderAgentChat();

      if (autoSpeakAgent) {
        speakAgentMessage(res.content);
      }
    }
  } catch (err) {
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    agentChatHistory.push({
      role: "assistant",
      content: `⚠️ Terjadi kendala saat menghubungi Agent: ${err.message}`,
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    });
    renderAgentChat();
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

// Quick action chip clicked
function runQuickAgentPrompt(prompt) {
  const inputEl = document.getElementById("agentChatInput");
  if (inputEl) {
    inputEl.value = prompt;
    sendAgentMessage();
  }
}

// Clear active chat
function clearAgentChat() {
  if (activeScopeData) {
    initScopeChat(activeScopeData);
    showToast("Chat riwayat dibersihkan", "info", 1500);
  }
}

// Toggle TTS Auto Speak
function toggleAutoSpeak() {
  autoSpeakAgent = !autoSpeakAgent;
  const btn = document.getElementById("agentAutoSpeakBtn");
  if (btn) {
    btn.className = `p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
      autoSpeakAgent
        ? "bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-500/25"
        : "bg-surface-800 text-gray-400 border-surface-700/60 hover:text-white"
    }`;
  }
  showToast(autoSpeakAgent ? "Auto Read-Aloud Aktif" : "Auto Read-Aloud Dimatikan", "info", 1500);
}

// Web Speech Synthesis (TTS)
function speakAgentMessage(text) {
  if (!("speechSynthesis" in window)) {
    showToast("Browser tidak mendukung Web Speech API", "error");
    return;
  }
  window.speechSynthesis.cancel();
  const clean = text.replace(/[*_#`[\]()]/g, " ").replace(/https?:\/\/\S+/g, "").trim();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = "id-ID";
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}

// Web Speech Recognition (STT) Voice Input
function startVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast("Browser Anda tidak mendukung Speech Recognition (Gunakan Chrome)", "error");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "id-ID";
  recognition.interimResults = false;

  const micBtn = document.getElementById("agentMicBtn");
  if (micBtn) micBtn.classList.add("text-rose-400", "animate-pulse");

  recognition.onstart = () => {
    showToast("Mendengarkan suara... Silakan bicara", "info", 2000);
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const inputEl = document.getElementById("agentChatInput");
    if (inputEl) {
      inputEl.value = transcript;
      showToast(`Terdengar: "${transcript}"`, "success", 2000);
    }
  };

  recognition.onerror = (e) => {
    showToast(`Voice error: ${e.error}`, "error");
    if (micBtn) micBtn.classList.remove("text-rose-400", "animate-pulse");
  };

  recognition.onend = () => {
    if (micBtn) micBtn.classList.remove("text-rose-400", "animate-pulse");
  };

  recognition.start();
}

// Direct MCP Tool Test Executor
async function testToolDirect(toolName) {
  try {
    showToast(`Menjalankan tool "${toolName}"...`, "info", 1500);
    const res = await apiRequest(`/api/agents/tools/${toolName}/execute`, "POST", {});
    openToolResultModal(toolName, res);
  } catch (err) {
    openToolResultModal(toolName, { error: err.message });
  }
}

// Modal for Tool Result
function openToolResultModal(toolName, resultData) {
  let modal = document.getElementById("agentToolModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "agentToolModal";
    modal.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="glass-panel rounded-2xl border border-indigo-500/30 max-w-xl w-full p-5 space-y-4 shadow-2xl">
      <div class="flex items-center justify-between border-b border-surface-700/80 pb-3">
        <div class="flex items-center gap-2">
          <i data-lucide="zap" class="w-4 h-4 text-amber-400"></i>
          <h3 class="text-sm font-bold text-white font-mono">${toolName}</h3>
        </div>
        <button onclick="document.getElementById('agentToolModal').remove()" class="text-gray-400 hover:text-white p-1 rounded-lg">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <div>
        <div class="text-[11px] text-gray-400 mb-1 font-semibold uppercase tracking-wider">Raw Execution Result:</div>
        <pre class="p-4 bg-surface-950 rounded-xl border border-surface-800 text-emerald-300 font-mono text-xs overflow-x-auto max-h-80 select-text">${escapeHtml(JSON.stringify(resultData, null, 2))}</pre>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <button onclick="document.getElementById('agentToolModal').remove()" class="px-4 py-2 rounded-xl text-xs font-semibold bg-surface-800 hover:bg-surface-700 text-white transition-colors">
          Tutup
        </button>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

// Load Agent Audit Analytics
async function loadAgentAnalytics() {
  try {
    const res = await apiRequest("/api/agents/analytics");
    if (res && res.data) {
      const elCalls = document.getElementById("agentTotalToolCalls");
      if (elCalls) elCalls.textContent = res.data.totalToolCalls || 0;
    }
  } catch {}
}

// Load Autonomous Cron Patrol Jobs
async function loadCronJobs() {
  try {
    const res = await apiRequest("/api/agents/cron/jobs");
    const container = document.getElementById("agentCronJobsList");
    if (!container || !res || !res.jobs) return;

    container.innerHTML = res.jobs.map(j => `
      <div class="p-3 rounded-xl bg-surface-900/80 border border-surface-700/60 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xs font-bold text-white truncate">${j.name}</div>
          <div class="text-[10px] text-gray-400 truncate">${j.schedule} • ${j.description}</div>
        </div>
        <button onclick="triggerCronJob('${j.id}')"
          class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-surface-700 hover:bg-indigo-600 text-gray-200 hover:text-white shrink-0 transition-colors shadow-sm">
          Jalankan
        </button>
      </div>
    `).join("");
  } catch {}
}

// Trigger Cron Patrol Job
async function triggerCronJob(jobId) {
  try {
    showToast(`Menjalankan cron patrol "${jobId}"...`, "info", 1500);
    const res = await apiRequest(`/api/agents/cron/trigger/${jobId}`, "POST");
    showToast("Patroli selesai dieksekusi", "success", 2000);
    openToolResultModal(`Cron Patrol: ${jobId}`, res);
    loadCronJobs();
  } catch (err) {
    showToast(`Gagal: ${err.message}`, "error");
  }
}

// Load Long-Term Memories
async function loadAgentMemories() {
  try {
    const res = await apiRequest("/api/agents/memory");
    const container = document.getElementById("agentMemoriesList");
    if (!container || !res || !res.memories) return;

    container.innerHTML = res.memories.map(m => `
      <div class="p-2.5 rounded-xl bg-surface-900/60 border border-surface-800 flex items-start justify-between gap-2 text-xs">
        <div>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
            m.category === "security" ? "bg-rose-950 text-rose-300" :
            m.category === "vehicle" ? "bg-amber-950 text-amber-300" :
            m.category === "family" ? "bg-indigo-950 text-indigo-300" : "bg-surface-800 text-gray-400"
          }">${m.category}</span>
          <p class="text-gray-300 mt-1 select-text">${escapeHtml(m.fact)}</p>
        </div>
        <button onclick="deleteMemoryFact('${m.id}')" class="text-gray-500 hover:text-rose-400 p-1 rounded" title="Hapus">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `).join("");

    if (window.lucide) window.lucide.createIcons();
  } catch {}
}

// Add New Memory Fact
async function addMemoryFact() {
  const inputEl = document.getElementById("newMemoryInput");
  const catEl = document.getElementById("newMemoryCategory");
  if (!inputEl || !inputEl.value.trim()) return;

  try {
    await apiRequest("/api/agents/memory", "POST", {
      fact: inputEl.value.trim(),
      category: catEl?.value || "general",
    });
    inputEl.value = "";
    showToast("Fakta tersimpan di memori permanen AI Hub", "success", 2000);
    loadAgentMemories();
  } catch (err) {
    showToast(`Gagal simpan memori: ${err.message}`, "error");
  }
}

// Delete Memory Fact
async function deleteMemoryFact(id) {
  try {
    await apiRequest(`/api/agents/memory/${id}`, "DELETE");
    showToast("Fakta memori dihapus", "info", 1500);
    loadAgentMemories();
  } catch (err) {
    showToast(`Gagal: ${err.message}`, "error");
  }
}

// Simulate WhatsApp inbound message
async function simulateWhatsAppMessage() {
  const inputEl = document.getElementById("waSimulateInput");
  if (!inputEl || !inputEl.value.trim()) return;

  const msg = inputEl.value.trim();
  showToast("Mengirim simulasi WhatsApp...", "info", 1500);

  try {
    const res = await apiRequest("/api/agents/whatsapp/simulate", "POST", {
      message: msg,
    });
    openToolResultModal("WhatsApp Webhook Simulator Result", res);
    inputEl.value = "";
  } catch (err) {
    showToast(`WhatsApp simulation failed: ${err.message}`, "error");
  }
}

// Copy Widget Script
function copyWidgetCode() {
  const codeEl = document.getElementById("widgetEmbedCode");
  if (codeEl) {
    navigator.clipboard.writeText(codeEl.textContent.trim());
    showToast("Widget snippet disalin ke clipboard!", "success", 2000);
  }
}

/* --- END: agents.js --- */

/* --- START: keys.js --- */
// AI Hub - API Key Management & Client Integration Snippets

let allActiveKeys = [];
let activeSnippetKey = "";
let activeSnippetProject = "";
let activeSnippetTab = "python";

async function loadKeys() {
  try {
    const res = await fetchApi("/api/keys");
    if (!res.ok) return;
    const keys = await res.json();
    allActiveKeys = keys.filter(k => k.isActive);

    // Populate Playground Key Selector
    const pgSelect = document.getElementById("pgVirtualKey");
    if (pgSelect) {
      const prevVal = pgSelect.value;
      pgSelect.innerHTML = allActiveKeys.map(k => `<option value="${k.key}">${k.name} (${k.project})</option>`).join("");
      if (prevVal && allActiveKeys.some(k => k.key === prevVal)) {
        pgSelect.value = prevVal;
      }
    }

    const tbody = document.getElementById("keysTableBody");
    if (!tbody) return;

    if (keys.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-gray-500 font-medium">No API keys created yet. Generate one above.</td></tr>`;
      return;
    }

    tbody.innerHTML = keys.map(k => {
      const currentMonthTokens = k.currentMonthTokens !== undefined ? k.currentMonthTokens : k.totalTokens;
      const currentMonthCost = k.currentMonthCostUsd !== undefined ? k.currentMonthCostUsd : k.totalCostUsd;
      const quota = k.maxMonthlyTokens ? `${currentMonthTokens.toLocaleString()} / ${k.maxMonthlyTokens.toLocaleString()}` : `${currentMonthTokens.toLocaleString()}`;
      const expBadge = k.expiresAt ? `<div class="text-[10px] text-amber-400 font-mono">Exp: ${new Date(k.expiresAt).toLocaleDateString()}</div>` : '';
      const ipsBadge = k.allowedIps && k.allowedIps.length > 0 ? `<div class="text-[10px] text-purple-300 font-mono">IP: ${k.allowedIps.join(", ")}</div>` : '';
      const budgetBadge = k.maxMonthlyCostUsd ? `<div class="text-[10px] text-emerald-400 font-mono font-semibold">Bulan Ini: $${(currentMonthCost || 0).toFixed(2)} / $${k.maxMonthlyCostUsd.toFixed(2)}</div>` : '';
      const providerBadge = k.enforceProvider ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-950 text-purple-300 border border-purple-800 ml-1.5">🔒 ${k.enforceProvider}</span>` : '';

      return `
        <tr class="hover:bg-surface-700/40 transition-colors">
          <td class="py-3 px-3.5">
            <div class="font-bold text-white flex items-center">${k.name} ${providerBadge}</div>
            ${expBadge}
            ${ipsBadge}
            ${budgetBadge}
          </td>
          <td class="py-3 px-3.5">
            <span class="px-2 py-0.5 rounded font-mono text-[10px] font-semibold bg-brand-900/60 text-brand-300 border border-brand-700/60">${k.project}</span>
          </td>
          <td class="py-3 px-3.5 font-mono text-gray-300">
            <div class="flex items-center gap-1.5">
              <span class="truncate max-w-[160px] sm:max-w-[200px] text-xs">${k.key}</span>
              <button onclick="copyToClipboard('${k.key}', 'API Key copied to clipboard!')" class="text-gray-400 hover:text-white p-1 rounded hover:bg-surface-700" title="Copy Key">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="openSnippetModal('${k.key}', '${k.project}')" class="text-brand-400 hover:text-white p-1 rounded hover:bg-brand-900/60" title="Get Integration Code">
                <i data-lucide="code" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </td>
          <td class="py-3 px-3.5 font-mono text-gray-300 text-xs">${k.totalRequests.toLocaleString()}</td>
          <td class="py-3 px-3.5 font-mono text-amber-300 text-xs">${quota}</td>
          <td class="py-3 px-3.5 font-mono text-emerald-400 font-bold text-xs">$${(currentMonthCost || 0).toFixed(4)}</td>
          <td class="py-3 px-3.5">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${k.isActive ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'}">
              ${k.isActive ? 'Active' : 'Disabled'}
            </span>
          </td>
          <td class="py-3 px-3.5 text-right">
            <div class="flex items-center justify-end gap-1">
              <button onclick="resetKeyUsage('${k.id}', '${k.name}')" class="text-amber-400 hover:text-amber-300 p-1.5 rounded hover:bg-amber-950/40 transition-colors" title="Reset Monthly Usage to 0">
                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="deleteKey('${k.id}')" class="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-red-950/40 transition-colors" title="Delete Key">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error("Failed to load keys:", err);
  }
}

async function createKey() {
  const nameInput = document.getElementById("newKeyName");
  const projInput = document.getElementById("newKeyProject");
  const quotaInput = document.getElementById("newKeyQuota");
  const budgetInput = document.getElementById("newKeyBudget");
  const provInput = document.getElementById("newKeyEnforceProvider");
  const expiryInput = document.getElementById("newKeyExpiry");
  const ipsInput = document.getElementById("newKeyAllowedIps");

  const name = nameInput?.value.trim();
  const project = projInput?.value.trim();
  const quota = quotaInput?.value.trim();
  const budget = budgetInput?.value.trim();
  const enforceProvider = provInput?.value;
  const expiry = expiryInput?.value.trim();
  const allowedIps = ipsInput?.value.trim();

  if (!name || !project) {
    showToast("Please enter a Key Name and Project Identifier.", "error");
    return;
  }

  const res = await fetchApi("/api/keys", {
    method: "POST",
    body: {
      name,
      project,
      rateLimitRpm: 120,
      maxMonthlyTokens: quota ? Number(quota) : undefined,
      maxMonthlyCostUsd: budget ? Number(budget) : undefined,
      enforceProvider: enforceProvider || undefined,
      expiresInDays: expiry ? Number(expiry) : undefined,
      allowedIps: allowedIps ? allowedIps.split(",").map(s => s.trim()).filter(Boolean) : undefined,
    }
  });

  if (res.ok) {
    if (nameInput) nameInput.value = "";
    if (projInput) projInput.value = "";
    if (quotaInput) quotaInput.value = "";
    if (budgetInput) budgetInput.value = "";
    if (provInput) provInput.value = "";
    if (expiryInput) expiryInput.value = "";
    if (ipsInput) ipsInput.value = "";
    loadKeys();
    showToast(`Project API Key '${name}' generated!`, "success");
  } else {
    showToast("Failed to generate API Key.", "error");
  }
}

async function deleteKey(id) {
  if (!confirm("Are you sure you want to delete this API Key? Client applications using this key will immediately lose access.")) return;
  const res = await fetchApi(`/api/keys/${id}`, { method: "DELETE" });
  if (res.ok) {
    loadKeys();
    showToast("API Key deleted successfully.", "success");
  } else {
    showToast("Failed to delete key.", "error");
  }
}

// Integration Snippet Modal
function openSnippetModal(key, project) {
  activeSnippetKey = key;
  activeSnippetProject = project;
  const elTitle = document.getElementById("snippetTargetProject");
  if (elTitle) {
    elTitle.textContent = `Project: ${project} | Bearer Key: ${key.slice(0, 16)}...`;
  }
  switchSnippetTab(activeSnippetTab);
  const modal = document.getElementById("snippetModal");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) window.lucide.createIcons();
}

function closeSnippetModal() {
  const modal = document.getElementById("snippetModal");
  if (modal) modal.classList.add("hidden");
}

function switchSnippetTab(tab) {
  activeSnippetTab = tab;
  ["python", "nodejs", "nextjs", "curl", "image", "audio"].forEach(t => {
    const btn = document.getElementById(`snipTab-${t}`);
    if (btn) {
      if (t === tab) {
        btn.className = "px-3.5 py-1.5 rounded-lg text-xs font-bold bg-brand-600 text-white shadow-sm";
      } else {
        btn.className = "px-3.5 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-surface-800 transition-colors";
      }
    }
  });

  const host = window.location.origin;
  const pre = document.getElementById("snippetCodeBlock");
  if (!pre) return;

  if (tab === "python") {
    pre.textContent = `from openai import OpenAI

# Connect to AI Hub Gateway
client = OpenAI(
    base_url="${host}/v1",
    api_key="${activeSnippetKey}"
)

# Call any model (Gemini, Claude, GPT, OpenRouter, DeepSeek, Llama)
response = client.chat.completions.create(
    model="gemini-3-flash-preview", # or 'openrouter/auto', 'gpt-4o', 'claude-3-5-sonnet', 'auto'
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello from ${activeSnippetProject}!"}
    ],
    temperature=0.7
)

print(response.choices[0].message.content)`;
  } else if (tab === "nodejs") {
    pre.textContent = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${host}/v1",
  apiKey: "${activeSnippetKey}",
});

async function main() {
  const completion = await client.chat.completions.create({
    model: "gemini-3-flash-preview",
    messages: [
      { role: "user", content: "Hello from ${activeSnippetProject}!" }
    ],
  });

  console.log(completion.choices[0].message.content);
}

main();`;
  } else if (tab === "nextjs") {
    pre.textContent = `// Vercel AI SDK (Next.js App Router)
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const aiHub = createOpenAI({
  baseURL: "${host}/v1",
  apiKey: "${activeSnippetKey}",
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: aiHub("gemini-3-flash-preview"), // or 'auto'
    messages,
  });

  return result.toDataStreamResponse();
}`;
  } else if (tab === "curl") {
    pre.textContent = `curl -X POST ${host}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${activeSnippetKey}" \\
  -d '{
    "model": "gemini-3-flash-preview",
    "messages": [{"role": "user", "content": "Ping AI Hub!"}],
    "temperature": 0.7
  }'`;
  } else if (tab === "image") {
    pre.textContent = `# Universal Image Generation (DALL-E / Gemini Imagen / Pollinations AI)
curl -X POST ${host}/v1/images/generations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${activeSnippetKey}" \\
  -d '{
    "prompt": "A futuristic smart city powered by AI in cyberpunk aesthetic",
    "model": "pollinations",
    "size": "1024x1024",
    "response_format": "url"
  }'`;
  } else if (tab === "audio") {
    pre.textContent = `# Audio Speech-to-Text Transcription (Whisper / Gemini Flash STT)
curl -X POST ${host}/v1/audio/transcriptions \\
  -H "Authorization: Bearer ${activeSnippetKey}" \\
  -F file=@recording.mp3 \\
  -F model="gemini-3-flash-preview"`;
  }
}

window.addEventListener("languageChanged", () => {
  if (typeof loadKeys === "function") {
    loadKeys();
  }
});

function copySnippetCode() {
  const code = document.getElementById("snippetCodeBlock")?.textContent || "";
  copyToClipboard(code, "Integration code snippet copied!");
}

async function resetKeyUsage(id, name) {
  if (!confirm(`Reset kuota pemakaian bulanan untuk '${name}' ke 0?`)) return;
  try {
    const res = await fetchApi(`/api/keys/${id}/reset`, { method: "POST" });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, "success");
      loadKeys();
    } else {
      showToast(data.error || "Gagal mereset kuota", "error");
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* --- END: keys.js --- */

/* --- START: providers.js --- */
// AI Hub - Providers, Health Diagnostics, Smart Routing & Settings

async function loadProviders() {
  try {
    const res = await fetchApi("/api/providers");
    if (!res.ok) return;
    const providers = await res.json();

    // All Cloud & Gateway Providers
    const providerIds = [
      "gemini", "openai", "anthropic", "groq", "deepseek",
      "openrouter", "mistral", "together", "xai", "cohere", "perplexity"
    ];

    providerIds.forEach(pId => {
      const p = providers[pId];
      const badge = document.getElementById(`badge-${pId}`);
      if (badge) {
        if (p?.hasApiKey) {
          badge.textContent = "Configured & Active";
          badge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800";
        } else {
          badge.textContent = "Missing API Key";
          badge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400";
        }
      }
    });

    // Local Ollama
    const oll = providers.ollama;
    const ollUrlInput = document.getElementById("provUrl-ollama");
    if (oll?.baseUrl && ollUrlInput) {
      ollUrlInput.value = oll.baseUrl;
    }

    // Load Settings
    const statsRes = await fetchApi("/api/stats");
    if (statsRes.ok) {
      const statsData = await statsRes.json();
      const settings = statsData.settings || {};

      const defMod = document.getElementById("cfgDefaultModel");
      if (defMod && settings.defaultModel) defMod.value = settings.defaultModel;

      const fbMod = document.getElementById("cfgFallbackModel");
      if (fbMod && settings.fallbackModel) fbMod.value = settings.fallbackModel;

      const sysPr = document.getElementById("cfgSystemPrompt");
      if (sysPr && settings.systemPrompt !== undefined) sysPr.value = settings.systemPrompt;

      const gr = document.getElementById("cfgEnableGuardrails");
      if (gr && settings.enableGuardrails !== undefined) gr.checked = Boolean(settings.enableGuardrails);

      const pii = document.getElementById("cfgEnablePiiRedaction");
      if (pii && settings.enablePiiRedaction !== undefined) pii.checked = Boolean(settings.enablePiiRedaction);

      const wh = document.getElementById("cfgWebhookUrl");
      if (wh && settings.webhookUrl) wh.value = settings.webhookUrl;

      const ca = document.getElementById("cfgCustomAliases");
      if (ca && settings.customAliases) ca.value = JSON.stringify(settings.customAliases, null, 2);
    }
    loadAliases();
  } catch (err) {
    console.error("Failed to load providers:", err);
  }
}

async function saveProvider(id) {
  const input = document.getElementById(`provKey-${id}`);
  if (!input) return;
  const apiKey = input.value.trim();
  if (!apiKey) {
    showToast(`Please enter an API Key for ${id.toUpperCase()}.`, "error");
    return;
  }

  const res = await fetchApi(`/api/providers/${id}`, {
    method: "POST",
    body: { apiKey }
  });

  if (res.ok) {
    input.value = "";
    showToast(`${id.toUpperCase()} credentials saved successfully!`, "success");
    loadProviders();
  } else {
    showToast(`Failed to save ${id.toUpperCase()} API Key.`, "error");
  }
}

async function saveOllamaConfig() {
  const input = document.getElementById("provUrl-ollama");
  const baseUrl = input?.value.trim() || "http://localhost:11434";

  const res = await fetchApi("/api/providers/ollama", {
    method: "POST",
    body: { baseUrl }
  });

  if (res.ok) {
    showToast("Ollama base URL saved!", "success");
    loadProviders();
  } else {
    showToast("Failed to save Ollama config.", "error");
  }
}

async function syncOllamaModels() {
  const baseUrl = document.getElementById("provUrl-ollama")?.value.trim() || "http://localhost:11434";
  showToast("Scanning local Ollama models...", "info");

  try {
    const res = await fetchApi(`/api/providers/ollama/sync`, {
      method: "POST",
      body: { baseUrl }
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Synced ${data.count} local Ollama models! (${data.models.slice(0, 3).join(", ")}...)`, "success");
      loadProviders();
    } else {
      showToast(`Failed to sync Ollama models: ${data.error}`, "error");
    }
  } catch (err) {
    showToast(`Network error scanning Ollama: ${err.message}`, "error");
  }
}

async function testProvider(id) {
  const btn = event?.currentTarget;
  const originalHtml = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block mr-1">⌛</span> Testing...`;
  }

  try {
    const res = await fetchApi(`/api/providers/${id}/test`, { method: "POST" });
    const data = await res.json();
    if (data.success) {
      showToast(`[${id.toUpperCase()} ONLINE] Latency: ${data.latencyMs}ms | Reply: "${data.reply}"`, "success", 4500);
    } else {
      showToast(`[${id.toUpperCase()} OFFLINE] Error: ${data.error || "Connection timed out"}`, "error", 5000);
    }
  } catch (err) {
    showToast(`Network error while testing ${id}: ${err.message}`, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

async function runProviderBenchmark() {
  const btn = document.getElementById("btnBenchmark");
  const grid = document.getElementById("benchmarkResultsGrid");
  if (!btn || !grid) return;

  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin inline-block mr-1">⌛</span> Benchmarking...`;

  try {
    const res = await fetchApi("/api/providers/benchmark", { method: "POST" });
    const data = await res.json();
    if (data.success && Array.isArray(data.benchmark)) {
      grid.innerHTML = data.benchmark.map(item => {
        const isOnline = item.status === "online";
        const latencyColor = item.latencyMs < 500 ? "text-emerald-400" : (item.latencyMs < 1500 ? "text-amber-400" : "text-red-400");
        const borderBadge = isOnline ? "border-emerald-800/80 bg-surface-900/90" : "border-red-800/80 bg-red-950/20";

        return `
          <div class="p-3.5 rounded-xl border ${borderBadge} space-y-1 text-center transition-all hover:scale-102">
            <div class="text-[11px] font-bold text-white truncate">${item.name}</div>
            <div class="text-[10px] text-gray-400 font-mono truncate">${item.model}</div>
            <div class="text-base font-black ${isOnline ? latencyColor : 'text-red-400'}">
              ${isOnline ? `${item.latencyMs}ms` : 'OFFLINE'}
            </div>
            <div class="text-[10px] ${isOnline ? 'text-emerald-300' : 'text-red-400'} truncate">
              ${isOnline ? 'Ping OK' : (item.error || 'Down')}
            </div>
          </div>
        `;
      }).join("");
      showToast("Diagnostic Benchmark completed!", "success");
    } else {
      grid.innerHTML = `<div class="p-3 text-red-400 text-xs col-span-full">Benchmark failed: ${data.error || "Unknown error"}</div>`;
    }
  } catch (err) {
    grid.innerHTML = `<div class="p-3 text-red-400 text-xs col-span-full">Benchmark network error: ${err.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="activity" class="w-4 h-4"></i><span>Run Health Benchmark</span>`;
    if (window.lucide) window.lucide.createIcons();
  }
}

async function saveSettings() {
  const defaultModel = document.getElementById("cfgDefaultModel")?.value;
  const fallbackModel = document.getElementById("cfgFallbackModel")?.value;
  const systemPrompt = document.getElementById("cfgSystemPrompt")?.value.trim();
  const enableGuardrails = document.getElementById("cfgEnableGuardrails")?.checked;
  const enablePiiRedaction = document.getElementById("cfgEnablePiiRedaction")?.checked;
  const webhookUrl = document.getElementById("cfgWebhookUrl")?.value.trim();

  let customAliases = undefined;
  const rawAliases = document.getElementById("cfgCustomAliases")?.value.trim();
  if (rawAliases) {
    try {
      customAliases = JSON.parse(rawAliases);
    } catch (e) {
      showToast("Invalid JSON in Custom Model Aliases: " + e.message, "error");
      return;
    }
  }

  const res = await fetchApi("/api/settings", {
    method: "POST",
    body: { defaultModel, fallbackModel, systemPrompt, enableGuardrails, enablePiiRedaction, webhookUrl, customAliases }
  });

  if (res.ok) {
    showToast("Routing rules, guardrails & settings saved!", "success");
  } else {
    showToast("Failed to save settings.", "error");
  }
}

function downloadBackup() {
  const url = `/api/backup?token=${encodeURIComponent(getAdminToken())}`;
  window.open(url, "_blank");
  showToast("Downloading backup snapshot JSON...", "info");
}

async function restoreBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!confirm("Are you sure you want to restore this configuration snapshot? Current database configuration will be overwritten.")) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const json = JSON.parse(e.target.result);
      const res = await fetchApi("/api/restore", {
        method: "POST",
        body: json,
      });
      const data = await res.json();
      if (data.success) {
        showToast("Database store restored successfully!", "success");
        if (typeof refreshAll === "function") refreshAll();
      } else {
        showToast("Failed to restore: " + (data.error || "Unknown error"), "error");
      }
    } catch (err) {
      showToast("Invalid backup JSON file: " + err.message, "error");
    }
  };
  reader.readAsText(file);
}

async function loadAliases() {
  try {
    const res = await fetchApi("/api/aliases");
    if (!res.ok) return;
    const data = await res.json();
    const tbody = document.getElementById("aliasesTableBody");
    if (!tbody) return;

    const custom = Object.entries(data.customAliases || {});
    const system = Object.entries(data.systemAliases || {});

    if (custom.length === 0 && system.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-gray-500">Belum ada alias model.</td></tr>`;
      return;
    }

    let rows = "";
    custom.forEach(([alias, target]) => {
      rows += `
        <tr class="border-b border-surface-700/40 hover:bg-surface-800/40 text-xs">
          <td class="py-2 px-3 font-mono font-bold text-brand-300">${alias}</td>
          <td class="py-2 px-3 font-mono text-gray-200">➔ ${target}</td>
          <td class="py-2 px-3 text-right">
            <button onclick="deleteCustomAlias('${alias}')" class="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/40" title="Hapus Alias">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </td>
        </tr>
      `;
    });

    system.forEach(([alias, target]) => {
      rows += `
        <tr class="border-b border-surface-700/20 text-xs text-gray-400">
          <td class="py-2 px-3 font-mono text-gray-400">${alias} <span class="text-[9px] px-1 py-0.5 bg-surface-800 rounded font-sans">system</span></td>
          <td class="py-2 px-3 font-mono text-gray-400">➔ ${target}</td>
          <td class="py-2 px-3 text-right text-[10px] italic text-gray-500">Bawaan</td>
        </tr>
      `;
    });

    tbody.innerHTML = rows;
    if (window.lucide) window.lucide.createIcons();
  } catch {}
}

async function addCustomAlias() {
  const aliasInput = document.getElementById("newAliasName");
  const targetInput = document.getElementById("newAliasTarget");
  if (!aliasInput || !targetInput) return;

  const alias = aliasInput.value.trim().toLowerCase();
  const targetModel = targetInput.value.trim();

  if (!alias || !targetModel) {
    showToast("Nama Alias dan Target Model wajib diisi!", "warning");
    return;
  }

  try {
    const res = await fetchApi("/api/aliases", {
      method: "POST",
      body: { alias, targetModel }
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Alias '${alias}' berhasil dipetakan ke '${targetModel}'!`, "success");
      aliasInput.value = "";
      loadAliases();
    } else {
      showToast(data.error || "Gagal menambah alias", "error");
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteCustomAlias(alias) {
  if (!confirm(`Hapus alias '${alias}'?`)) return;
  try {
    const res = await fetchApi(`/api/aliases/${encodeURIComponent(alias)}`, {
      method: "DELETE"
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Alias '${alias}' berhasil dihapus`, "info");
      loadAliases();
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* --- END: providers.js --- */

/* --- START: playground.js --- */
// AI Hub - Interactive Multimodal Playground (Chat, Vision, Audio & Image Generation)

let promptPresetsList = [];
let attachedImageBase64 = null;
let lastPlaygroundResponseText = "";

function getPlaygroundKey() {
  const select = document.getElementById("pgVirtualKey");
  if (select && select.value) return select.value;
  if (window.allActiveKeys && window.allActiveKeys.length > 0) return window.allActiveKeys[0].key;
  return "aih_live_nexuschat_2026";
}

async function loadPlaygroundModels() {
  const select = document.getElementById("pgModel");
  if (!select) return;

  try {
    const res = await fetchApi("/api/providers");
    if (!res.ok) return;
    const providers = await res.json();

    const currentVal = select.value || "gemini-3-flash-preview";
    let html = `
      <optgroup label="⚡ Smart Routing Intents">
        <option value="auto">🔄 auto (AI Hub Dynamic Failover)</option>
        <option value="fastest">⚡ fastest (Groq / Sub-detik)</option>
        <option value="cheapest">💰 cheapest (DeepSeek / Gemini Cost-Saver)</option>
        <option value="smartest">🧠 smartest (GPT-4o / Claude 3.5)</option>
      </optgroup>
    `;

    const activeGroups = [];
    const inactiveGroups = [];

    for (const [pId, pConf] of Object.entries(providers)) {
      if (!pConf.models || pConf.models.length === 0) continue;
      const isConfigured = Boolean(pConf.apiKey || pId === "ollama");
      const icon = isConfigured ? "🟢" : "⚪";
      const statusLabel = isConfigured ? "Active" : "Not Configured";

      const optGroupHtml = `
        <optgroup label="${icon} ${pConf.name} (${statusLabel})">
          ${pConf.models.map(m => `<option value="${m}">${m}${isConfigured ? ' ★' : ''}</option>`).join("")}
        </optgroup>
      `;

      if (isConfigured) {
        activeGroups.push(optGroupHtml);
      } else {
        inactiveGroups.push(optGroupHtml);
      }
    }

    html += activeGroups.join("") + inactiveGroups.join("");
    select.innerHTML = html;
    if (currentVal) select.value = currentVal;
  } catch (err) {
    console.warn("Could not load dynamic models list:", err);
  }
}

async function loadPromptPresets() {
  try {
    const res = await fetchApi("/api/prompt-presets");
    if (!res.ok) return;
    promptPresetsList = await res.json();
    const select = document.getElementById("pgPresetSelect");
    if (select) {
      select.innerHTML = `<option value="">System Preset: Custom (None)</option>` +
        promptPresetsList.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
    }
  } catch (e) {
    console.error("Failed to load prompt presets:", e);
  }
}

function applyPresetToPlayground(presetId) {
  if (!presetId) return;
  const found = promptPresetsList.find(p => p.id === presetId);
  const sysInput = document.getElementById("pgSystem");
  if (found && sysInput) {
    sysInput.value = found.prompt;
    showToast(`Applied preset: ${found.name}`, "info");
  }
}

function handlePlaygroundImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    attachedImageBase64 = e.target.result;
    const imgEl = document.getElementById("pgImagePreview");
    const container = document.getElementById("pgImagePreviewContainer");
    const btnText = document.getElementById("pgImageBtnText");
    if (imgEl) imgEl.src = attachedImageBase64;
    if (container) {
      container.classList.remove("hidden");
      container.classList.add("flex");
    }
    if (btnText) btnText.textContent = "Change Image";
    showToast("Image attached to playground prompt!", "info");
  };
  reader.readAsDataURL(file);
}

function removePlaygroundImage() {
  attachedImageBase64 = null;
  const input = document.getElementById("pgImageInput");
  const container = document.getElementById("pgImagePreviewContainer");
  const btnText = document.getElementById("pgImageBtnText");
  if (input) input.value = "";
  if (container) {
    container.classList.add("hidden");
    container.classList.remove("flex");
  }
  if (btnText) btnText.textContent = "Attach Image";
}

async function uploadAudioPlayground(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const btnText = document.getElementById("pgAudioBtnText");
  if (btnText) btnText.textContent = "Transcribing...";
  showToast("Transcribing audio recording...", "info");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", "gemini-3-flash-preview");

  try {
    const activeKey = getPlaygroundKey();
    const res = await fetch("/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${activeKey}` },
      body: formData,
    });

    const data = await res.json();
    if (data.text) {
      const promptInput = document.getElementById("pgPrompt");
      if (promptInput) {
        promptInput.value = promptInput.value ? promptInput.value + " " + data.text : data.text;
      }
      showToast("Audio transcribed and appended to prompt!", "success");
    } else {
      showToast("Audio transcription failed: " + (data.error?.message || "Unknown error"), "error");
    }
  } catch (err) {
    showToast("Network error during audio transcription: " + err.message, "error");
  } finally {
    if (btnText) btnText.textContent = "Voice / Audio (STT)";
    event.target.value = "";
  }
}

async function speakPlaygroundResponse() {
  if (!lastPlaygroundResponseText) return;
  const btn = document.getElementById("btnTtsPlay");
  if (btn) btn.innerHTML = `<span class="animate-spin inline-block mr-1">⌛</span> Speaking...`;

  try {
    const activeKey = getPlaygroundKey();
    const res = await fetch("/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${activeKey}`,
      },
      body: JSON.stringify({
        input: lastPlaygroundResponseText.slice(0, 400),
        voice: "alloy",
      }),
    });

    if (res.ok) {
      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.play();
      showToast("Playing synthesized audio response...", "info");
    } else {
      showToast("TTS speech synthesis failed upstream.", "error");
    }
  } catch (err) {
    showToast("TTS error: " + err.message, "error");
  } finally {
    if (btn) {
      btn.innerHTML = `<i data-lucide="volume-2" class="w-3.5 h-3.5"></i><span>Read Aloud (TTS)</span>`;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

async function generatePlaygroundImage() {
  const prompt = document.getElementById("pgPrompt")?.value.trim();
  const outBox = document.getElementById("pgOutput");
  const metaBox = document.getElementById("pgMeta");
  const btn = document.getElementById("btnGenerateImage");

  if (!prompt) {
    showToast("Please enter a prompt to generate an image.", "error");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block mr-1">⌛</span><span>Generating...</span>`;
  }
  if (outBox) {
    outBox.innerHTML = `<div class="text-purple-400 font-mono text-xs animate-pulse">Generating AI Image via AI Hub /v1/images/generations...</div>`;
  }
  if (metaBox) metaBox.textContent = "Requesting image generation...";

  const startTime = performance.now();
  const vKey = getPlaygroundKey();

  try {
    const res = await fetch("/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${vKey}`
      },
      body: JSON.stringify({
        prompt,
        model: "pollinations",
        size: "1024x1024",
        response_format: "url"
      })
    });

    const elapsed = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const imgUrl = data.data?.[0]?.url;
    if (!imgUrl) throw new Error("No image URL returned from provider");

    if (outBox) {
      outBox.innerHTML = `
        <div class="flex flex-col items-center gap-3 py-2">
          <img src="${imgUrl}" alt="${prompt}" class="rounded-xl border border-surface-700 shadow-2xl max-h-[460px] object-contain hover:scale-102 transition-transform duration-300" />
          <div class="flex items-center gap-3">
            <a href="${imgUrl}" target="_blank" class="text-xs text-brand-400 hover:text-white hover:underline flex items-center gap-1 font-semibold">
              Open Full Resolution <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            </a>
            <button onclick="copyToClipboard('${imgUrl}', 'Image URL copied!')" class="text-xs text-gray-400 hover:text-white flex items-center gap-1 font-semibold">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy Link
            </button>
          </div>
        </div>
      `;
    }
    if (metaBox) {
      metaBox.textContent = `Completed in ${elapsed}ms | Model: ${data.data?.[0]?.model || 'image-generation'}`;
    }
    showToast("AI Image generated successfully!", "success");
  } catch (err) {
    if (outBox) outBox.innerHTML = `<div class="text-red-400 font-mono text-xs">Error generating image: ${err.message}</div>`;
    if (metaBox) metaBox.textContent = `Failed (${Math.round(performance.now() - startTime)}ms)`;
    showToast("Image generation failed: " + err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="palette" class="w-3.5 h-3.5"></i><span>Generate Image</span>`;
    }
    if (window.lucide) window.lucide.createIcons();
  }
}

async function runPlayground() {
  const model = document.getElementById("pgModel")?.value;
  const systemPrompt = document.getElementById("pgSystem")?.value.trim();
  const prompt = document.getElementById("pgPrompt")?.value.trim();
  const isStreaming = document.getElementById("pgStreaming")?.checked;
  const outBox = document.getElementById("pgOutput");
  const metaBox = document.getElementById("pgMeta");
  const btn = document.getElementById("btnRunPlayground");
  const ttsBtn = document.getElementById("btnTtsPlay");

  if (!prompt) {
    showToast("Please enter a prompt.", "error");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block mr-1">⌛</span><span>Executing...</span>`;
  }
  if (outBox) outBox.textContent = "Connecting to AI Hub Gateway...";
  if (metaBox) metaBox.textContent = "Waiting for response...";
  if (ttsBtn) ttsBtn.classList.add("hidden");

  const startTime = Date.now();
  const activeKey = getPlaygroundKey();

  let userContent = prompt;
  if (attachedImageBase64) {
    userContent = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: attachedImageBase64 } }
    ];
  }

  if (isStreaming) {
    try {
      const messages = [];
      if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: userContent });

      const res = await fetch("/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
        })
      });

      if (!res.ok) {
        const err = await res.text();
        if (outBox) outBox.textContent = `Error (${res.status}): ${err}`;
        showToast(`Request failed (${res.status})`, "error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      if (outBox) outBox.innerHTML = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ") && !trimmed.includes("[DONE]")) {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                if (outBox && window.marked) {
                  outBox.innerHTML = window.marked.parse(fullText);
                }
              }
            } catch {}
          }
        }
      }

      lastPlaygroundResponseText = fullText;
      if (ttsBtn) ttsBtn.classList.remove("hidden");
      const dur = Date.now() - startTime;
      if (metaBox) metaBox.textContent = `Stream finished in ${dur}ms | Model: ${model}`;
    } catch (err) {
      if (outBox) outBox.textContent = `Stream failed: ${err.message}`;
      showToast("Stream connection error: " + err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Execute Prompt</span>`;
      }
      if (window.lucide) window.lucide.createIcons();
    }
  } else {
    try {
      const messages = [];
      if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: userContent });

      const res = await fetch("/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
        })
      });
      const data = await res.json();
      if (res.ok) {
        const reply = data.choices?.[0]?.message?.content || "";
        lastPlaygroundResponseText = reply;
        if (outBox && window.marked) {
          outBox.innerHTML = window.marked.parse(reply);
        }
        if (ttsBtn) ttsBtn.classList.remove("hidden");
        if (metaBox) {
          metaBox.textContent = `Model: ${data.model} | Latency: ${Date.now() - startTime}ms`;
        }
      } else {
        if (outBox) outBox.textContent = `Error: ${data.error?.message || JSON.stringify(data)}`;
        showToast("Gateway error: " + (data.error?.message || "Check logs"), "error");
      }
    } catch (err) {
      if (outBox) outBox.textContent = `Request failed: ${err.message}`;
      showToast("Request failed: " + err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Execute Prompt</span>`;
      }
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

function updatePlaygroundCostEstimate() {
  const prompt = document.getElementById("pgPrompt")?.value || "";
  const system = document.getElementById("pgSystem")?.value || "";
  const totalChars = (prompt + " " + system).trim().length;
  const estTokens = Math.max(Math.ceil(totalChars / 3.8), totalChars > 0 ? 1 : 0);
  const container = document.getElementById("pgCostEstimatorGrid");
  const countEl = document.getElementById("pgEstTokenCount");

  if (countEl) countEl.textContent = `${estTokens.toLocaleString()} tokens (~${totalChars} chars)`;
  if (!container) return;

  const comparison = [
    { name: "Gemini 2.0 Flash", cost: (estTokens / 1_000_000) * 0.10, tag: "Best Value" },
    { name: "DeepSeek Chat", cost: (estTokens / 1_000_000) * 0.14, tag: "Ultra Low Cost" },
    { name: "Groq Llama 3.3", cost: (estTokens / 1_000_000) * 0.59, tag: "Fastest Sub-Second" },
    { name: "GPT-4o Mini", cost: (estTokens / 1_000_000) * 0.15, tag: "OpenAI Efficient" },
    { name: "Claude 3.5 Sonnet", cost: (estTokens / 1_000_000) * 3.00, tag: "Top Reasoning" },
    { name: "GPT-4o", cost: (estTokens / 1_000_000) * 2.50, tag: "Flagship" },
    { name: "Ollama (Local)", cost: 0, tag: "100% Free / Self-Hosted" }
  ];

  container.innerHTML = comparison.map(c => `
    <div class="p-2 rounded-lg bg-surface-900/80 border border-surface-700/60 flex items-center justify-between text-xs">
      <div>
        <div class="font-bold text-white flex items-center gap-1.5">
          <span>${c.name}</span>
          <span class="text-[9px] px-1 py-0.2 rounded bg-surface-800 text-brand-300 font-sans">${c.tag}</span>
        </div>
      </div>
      <div class="font-mono font-bold ${c.cost === 0 ? 'text-emerald-400' : 'text-amber-300'}">
        ${c.cost === 0 ? 'FREE' : `$${c.cost.toFixed(6)}`}
      </div>
    </div>
  `).join("");
}

/* --- END: playground.js --- */
