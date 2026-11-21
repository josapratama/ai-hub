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
      renderAnalyticsChart(s.dailyHistory);
    }

    // Load System Telemetry
    loadSystemHealth();

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

  if (!dailyHistory || dailyHistory.length === 0) {
    container.innerHTML = `<div class="w-full text-center py-8 text-gray-500 text-xs">Belum ada data transaksi dalam 7 hari terakhir.</div>`;
    return;
  }

  const maxRequests = Math.max(...dailyHistory.map(d => d.requests), 1);
  const total7dRequests = dailyHistory.reduce((acc, d) => acc + d.requests, 0);
  const total7dTokens = dailyHistory.reduce((acc, d) => acc + d.tokens, 0);
  const total7dCost = dailyHistory.reduce((acc, d) => acc + d.costUsd, 0);

  if (summaryEl) {
    summaryEl.innerHTML = `Total 7 Hari: <span class="text-white font-bold">${total7dRequests.toLocaleString()} reqs</span> • <span class="text-amber-400 font-bold">${total7dTokens.toLocaleString()} tokens</span> • <span class="text-emerald-400 font-bold">$${total7dCost.toFixed(4)}</span>`;
  }

  container.innerHTML = dailyHistory.map(d => {
    const pct = Math.max(Math.round((d.requests / maxRequests) * 100), d.requests > 0 ? 12 : 4);
    return `
      <div class="flex-1 flex flex-col items-center gap-2 group relative">
        <div class="absolute -top-12 bg-surface-900 border border-surface-700 text-white text-[10px] px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap shadow-xl">
          <div class="font-bold">${d.date} (${d.label})</div>
          <div class="text-brand-300">${d.requests} requests • ${d.tokens.toLocaleString()} tokens</div>
          <div class="text-emerald-400">$${d.costUsd.toFixed(4)} USD</div>
        </div>
        <div class="w-full bg-surface-800/80 rounded-t-lg h-32 flex items-end justify-center p-1 relative overflow-hidden">
          <div class="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-indigo-400 transition-all duration-500 shadow-md group-hover:from-brand-500 group-hover:to-cyan-400"
               style="height: ${pct}%;"></div>
        </div>
        <span class="text-[10px] font-medium text-gray-400 group-hover:text-white transition-colors truncate w-full text-center">${d.label || d.date.slice(5)}</span>
      </div>
    `;
  }).join("");
}
