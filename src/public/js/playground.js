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
  formData.append("model", "gemini-2.0-flash");

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
