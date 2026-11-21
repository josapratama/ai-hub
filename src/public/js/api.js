// AI Hub - Core API Client, Auth & UI Notifications

let adminToken = localStorage.getItem("ai_hub_admin_token") || "aih_admin_secret_2026";

function getAdminToken() {
  return adminToken;
}

function saveAdminToken() {
  const input = document.getElementById("adminTokenInput");
  if (!input) return;
  adminToken = input.value.trim();
  localStorage.setItem("ai_hub_admin_token", adminToken);
  showToast("Master Admin Token updated & saved!", "success");
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

function showToast(message, type = "info", duration = 3200) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const iconName = type === "success" ? "check-circle" : (type === "error" ? "alert-circle" : "info");
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4 flex-shrink-0 mt-0.5"></i>
    <div class="flex-1 break-words">${message}</div>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    toast.style.animation = "toast-fade-out 0.25s ease forwards";
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

function copyToClipboard(text, successMsg = "Copied to clipboard!") {
  if (!navigator.clipboard) {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  } else {
    navigator.clipboard.writeText(text);
  }
  showToast(successMsg, "success");
}
