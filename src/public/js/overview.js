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

    // Also load recent logs
    if (typeof loadLogs === "function") {
      loadLogs();
    }
  } catch (err) {
    console.error("Failed to load overview stats:", err);
  }
}
