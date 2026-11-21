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
  loadAgentAnalytics();
  loadCronJobs();
  loadAgentMemories();
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
      toolsHtml = m.toolCalls.map(tc => `
        <div class="tool-exec-card p-3 rounded-xl mb-3 text-xs">
          <div class="flex items-center justify-between text-indigo-300 font-mono font-semibold mb-1">
            <span class="flex items-center gap-1.5">
              <i data-lucide="cpu" class="w-3.5 h-3.5 text-amber-400"></i>
              Tool Executed: <strong>${tc.toolName}</strong>
            </span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-sans">Success</span>
          </div>
          ${tc.result ? `
            <details class="mt-1.5 text-[11px]">
              <summary class="cursor-pointer text-gray-400 hover:text-gray-200 select-none">View Tool Output JSON</summary>
              <pre class="mt-1 p-2 bg-black/60 rounded text-gray-300 font-mono text-[10px] overflow-x-auto">${escapeHtml(JSON.stringify(tc.result, null, 2))}</pre>
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
