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
