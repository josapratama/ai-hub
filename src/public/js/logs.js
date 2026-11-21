// AI Hub - Realtime Request Logs & Diagnostics

let rawLogsList = [];
let logEventSource = null;

function toggleLiveLogStream() {
  const dot = document.getElementById("liveDot");
  const txt = document.getElementById("liveText");
  if (!dot || !txt) return;

  if (logEventSource) {
    logEventSource.close();
    logEventSource = null;
    dot.className = "w-2 h-2 rounded-full bg-gray-500";
    txt.textContent = "Live Stream (Off)";
    showToast("Live SSE stream paused", "info");
    return;
  }

  dot.className = "w-2 h-2 rounded-full bg-emerald-400 animate-ping";
  txt.textContent = "Live Stream (Active)";
  showToast("Live streaming connection established!", "success");

  logEventSource = new EventSource(`/api/logs/stream?token=${encodeURIComponent(getAdminToken())}`);
  logEventSource.onmessage = (e) => {
    try {
      const newLog = JSON.parse(e.data);
      rawLogsList.unshift(newLog);
      if (rawLogsList.length > 500) rawLogsList.pop();
      filterAndRenderLogs();
    } catch { }
  };
  logEventSource.onerror = () => {
    dot.className = "w-2 h-2 rounded-full bg-red-400";
    txt.textContent = "Stream Reconnecting...";
  };
}

async function loadLogs() {
  try {
    const res = await fetchApi("/api/logs?limit=150");
    if (!res.ok) return;
    rawLogsList = await res.json();

    // Update Project Filter Dropdown
    const projectSelect = document.getElementById("filterProject");
    if (projectSelect) {
      const currentProject = projectSelect.value;
      const projects = Array.from(new Set(rawLogsList.map(l => l.project))).filter(Boolean);
      projectSelect.innerHTML = `<option value="ALL">All Projects</option>` + projects.map(p => `<option value="${p}">${p}</option>`).join("");
      if (projects.includes(currentProject)) {
        projectSelect.value = currentProject;
      }
    }

    filterAndRenderLogs();
  } catch (err) {
    console.error("Failed to load logs:", err);
  }
}

function filterAndRenderLogs() {
  const projFilter = document.getElementById("filterProject")?.value || "ALL";
  const statusFilter = document.getElementById("filterStatus")?.value || "ALL";
  const searchKw = (document.getElementById("searchLogs")?.value || "").toLowerCase().trim();

  let filtered = rawLogsList;
  if (projFilter !== "ALL") {
    filtered = filtered.filter(l => l.project === projFilter);
  }
  if (statusFilter !== "ALL") {
    filtered = filtered.filter(l => l.status === statusFilter);
  }
  if (searchKw) {
    filtered = filtered.filter(l =>
      (l.promptPreview && l.promptPreview.toLowerCase().includes(searchKw)) ||
      (l.responsePreview && l.responsePreview.toLowerCase().includes(searchKw)) ||
      (l.project && l.project.toLowerCase().includes(searchKw)) ||
      (l.modelRequested && l.modelRequested.toLowerCase().includes(searchKw)) ||
      (l.providerUsed && l.providerUsed.toLowerCase().includes(searchKw)) ||
      (l.errorMessage && l.errorMessage.toLowerCase().includes(searchKw))
    );
  }

  const tbody = document.getElementById("logsTableBody");
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-10 text-center text-gray-500 font-medium">No requests match the selected criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((l, idx) => {
    const d = new Date(l.createdAt);
    const timeStr = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
    const statusBadge = l.status === "success"
      ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">200 OK</span>`
      : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-300 border border-red-800" title="${l.errorMessage || ''}">Error</span>`;

    return `
      <tr onclick="inspectLog(${idx})" class="hover:bg-surface-700/50 cursor-pointer transition-colors group">
        <td class="py-2.5 px-3 font-mono text-gray-400 group-hover:text-white">${timeStr}</td>
        <td class="py-2.5 px-3">
          <span class="px-2 py-0.5 rounded font-mono text-[10px] font-semibold bg-brand-900/60 text-brand-300 border border-brand-700/60">${l.project}</span>
        </td>
        <td class="py-2.5 px-3 font-mono text-gray-300 truncate max-w-[150px]">${l.modelRequested}</td>
        <td class="py-2.5 px-3 font-mono text-cyan-300">${l.providerUsed}</td>
        <td class="py-2.5 px-3 font-mono text-amber-300">${(l.promptTokens + l.completionTokens).toLocaleString()}</td>
        <td class="py-2.5 px-3 font-mono text-emerald-400 font-semibold">$${(l.costUsd || 0).toFixed(5)}</td>
        <td class="py-2.5 px-3 font-mono text-gray-400">${l.durationMs}ms</td>
        <td class="py-2.5 px-3">${statusBadge}</td>
      </tr>
    `;
  }).join("");

  if (window.lucide) window.lucide.createIcons();
}

function inspectLog(idx) {
  const log = rawLogsList[idx];
  if (!log) return;

  const modal = document.getElementById("logModal");
  const container = document.getElementById("logModalContent");
  if (!modal || !container) return;

  container.innerHTML = `
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 bg-surface-900/90 rounded-xl border border-surface-700/80 text-xs">
      <div><span class="text-gray-400">ID:</span> <span class="text-white font-mono">${log.id}</span></div>
      <div><span class="text-gray-400">Time:</span> <span class="text-white">${new Date(log.createdAt).toLocaleTimeString()}</span></div>
      <div><span class="text-gray-400">Project:</span> <span class="text-brand-400 font-bold">${log.project}</span></div>
      <div><span class="text-gray-400">Provider:</span> <span class="text-cyan-400 font-bold">${log.providerUsed}</span></div>
      <div><span class="text-gray-400">Model:</span> <span class="text-white font-mono">${log.modelUsed}</span></div>
      <div><span class="text-gray-400">Tokens:</span> <span class="text-amber-400 font-bold">${(log.promptTokens + log.completionTokens).toLocaleString()} (${log.promptTokens} in / ${log.completionTokens} out)</span></div>
      <div><span class="text-gray-400">Cost:</span> <span class="text-emerald-400 font-bold">$${(log.costUsd || 0).toFixed(6)}</span></div>
      <div><span class="text-gray-400">Duration:</span> <span class="text-white font-bold">${log.durationMs}ms</span></div>
      <div><span class="text-gray-400">TTFT:</span> <span class="text-cyan-400 font-bold">${log.ttftMs !== undefined ? `${log.ttftMs}ms` : 'N/A'}</span></div>
    </div>

    <div>
      <div class="flex items-center justify-between mb-1.5">
        <label class="text-[11px] font-bold text-gray-300 uppercase">Input Prompt Preview</label>
        <button onclick="copyToClipboard(document.getElementById('logPromptPreview').textContent, 'Prompt copied!')" class="text-xs text-brand-400 hover:text-white flex items-center gap-1">
          <i data-lucide="copy" class="w-3 h-3"></i> Copy
        </button>
      </div>
      <div id="logPromptPreview" class="p-3 bg-surface-900 rounded-xl border border-surface-700 text-gray-200 text-xs font-mono whitespace-pre-wrap max-h-44 overflow-y-auto">${log.promptPreview || 'No prompt preview available'}</div>
    </div>

    <div>
      <div class="flex items-center justify-between mb-1.5">
        <label class="text-[11px] font-bold text-gray-300 uppercase">Model Output Response</label>
        <button onclick="copyToClipboard(document.getElementById('logRespPreview').textContent, 'Response copied!')" class="text-xs text-brand-400 hover:text-white flex items-center gap-1">
          <i data-lucide="copy" class="w-3 h-3"></i> Copy
        </button>
      </div>
      <div id="logRespPreview" class="p-3 bg-surface-900 rounded-xl border border-surface-700 text-gray-200 text-xs font-mono whitespace-pre-wrap max-h-52 overflow-y-auto">${log.responsePreview || (log.errorMessage ? 'ERROR: ' + log.errorMessage : 'Streaming response')}</div>
    </div>
  `;

  modal.classList.remove("hidden");
  if (window.lucide) window.lucide.createIcons();
}

function closeLogModal() {
  const modal = document.getElementById("logModal");
  if (modal) modal.classList.add("hidden");
}

function downloadLogsCsv() {
  const url = `/api/logs/export?token=${encodeURIComponent(getAdminToken())}`;
  window.open(url, "_blank");
  showToast("Downloading request logs CSV...", "info");
}
