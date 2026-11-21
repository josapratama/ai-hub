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
    model="gemini-2.0-flash", # or 'openrouter/auto', 'gpt-4o', 'claude-3-5-sonnet', 'auto'
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
    model: "gemini-2.0-flash",
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
    model: aiHub("gemini-2.0-flash"), // or 'auto'
    messages,
  });

  return result.toDataStreamResponse();
}`;
  } else if (tab === "curl") {
    pre.textContent = `curl -X POST ${host}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${activeSnippetKey}" \\
  -d '{
    "model": "gemini-2.0-flash",
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
  -F model="gemini-2.0-flash"`;
  }
}

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
