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

