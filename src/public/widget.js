/**
 * Omni Agent Hub - Universal Embeddable Chatbot Widget
 * Featuring Voice STT/TTS, Interactive Generative UI Cards, Image Lightbox & Action Confirmation
 */
;(function () {
  const currentScript = document.currentScript || (function () {
    const scripts = document.getElementsByTagName('script')
    return scripts[scripts.length - 1]
  })()

  const project = currentScript.getAttribute('data-project') || 'cctv'
  const customTitle = currentScript.getAttribute('data-title') || (project === 'cctv' ? 'Sentinel AI Security' : 'Omni Agent Assistant')
  const apiUrl = currentScript.getAttribute('data-api-url') || (function () {
    try {
      const src = new URL(currentScript.src)
      return `${src.protocol}//${src.host}`
    } catch {
      return window.location.origin
    }
  })()

  if (document.getElementById(`omni-widget-container-${project}`)) return

  const storageKey = `omni_chat_${project}_history`

  const projectSuggestions = {
    cctv: [
      { label: '📊 Status Sistem', prompt: 'Bagaimana status hardware CCTV dan Raspberry Pi sekarang?' },
      { label: '📹 Cek Kamera', prompt: 'Kamera mana saja yang saat ini aktif dan online?' },
      { label: '📸 Foto Live Gerbang', prompt: 'Tolong ambil foto live dari Gerbang Depan sekarang!' },
      { label: '🚨 Ada Orang Asing?', prompt: 'Apakah ada kejadian orang asing atau loitering mencurigakan hari ini?' },
      { label: '🔔 Bunyikan Sirine', prompt: 'Tolong bunyikan sirine darurat selama 5 detik!' },
    ],
    tanicerdas: [
      { label: '🌱 Sensor Tanah', prompt: 'Bagaimana kelembapan tanah dan suhu di kebun sayur?' },
      { label: '💧 Siram Kebun', prompt: 'Tolong aktifkan pompa penyiraman di kebun sayur selama 5 menit.' },
      { label: '⛅ Cek Cuaca', prompt: 'Bagaimana prakiraan cuaca hari ini? Perlu disiram tidak?' },
    ],
    shop: [
      { label: '💰 Omset Hari Ini', prompt: 'Berapa total penjualan dan pesanan toko hari ini?' },
      { label: '📦 Cek Stok Menipis', prompt: 'Produk apa saja yang stoknya mulai menipis di gudang?' },
    ],
    pulse: [
      { label: '🐳 Status Container', prompt: 'Apakah semua container Docker di VPS berjalan normal?' },
      { label: '⚡ Tes Latensi Ping', prompt: 'Berapa latensi ping dan DNS ke server saat ini?' },
    ],
    superadmin: [
      { label: '🌐 Ringkasan Semua Sistem', prompt: 'Berikan ringkasan cepat status CCTV, kebun TaniCerdas, dan server VPS!' },
      { label: '📸 Foto Live Kamera', prompt: 'Ambil foto live dari Gerbang Depan sekarang.' },
      { label: '🧠 Cek Memori Rumah', prompt: 'Apa saja fakta atau aturan rumah yang kamu ingat?' },
      { label: '🌱 Sensor Kebun', prompt: 'Cek kondisi kelembapan tanah di kebun sayur.' },
    ],
  }

  const suggestions = projectSuggestions[project] || projectSuggestions.cctv

  // Stylesheet
  const style = document.createElement('style')
  style.textContent = `
    .omni-chat-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 50%, #6366f1 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 25px -5px rgba(14, 165, 233, 0.5), 0 8px 10px -6px rgba(14, 165, 233, 0.4);
      cursor: pointer;
      z-index: 99999;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .omni-chat-fab:hover {
      transform: scale(1.08) translateY(-2px);
      box-shadow: 0 15px 30px -5px rgba(14, 165, 233, 0.6);
    }
    .omni-chat-fab .ping-dot {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 14px;
      height: 14px;
      background: #10b981;
      border: 2px solid #0f172a;
      border-radius: 50%;
    }
    .omni-chat-modal {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 420px;
      max-width: calc(100vw - 32px);
      height: 640px;
      max-height: calc(100vh - 120px);
      background: #0f172a;
      color: #f8fafc;
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      transform-origin: bottom right;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      opacity: 0;
      transform: scale(0.9) translateY(20px);
      pointer-events: none;
    }
    .omni-chat-modal.open {
      opacity: 1;
      transform: scale(1) translateY(0);
      pointer-events: auto;
    }
    .omni-chat-header {
      background: #1e293b;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #334155;
    }
    .omni-chat-header-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .omni-chat-avatar {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, #0ea5e9, #6366f1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    .omni-chat-title {
      font-size: 14px;
      font-weight: 600;
      color: #f1f5f9;
      margin: 0;
      line-height: 1.2;
    }
    .omni-chat-subtitle {
      font-size: 11px;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 2px;
    }
    .omni-chat-subtitle::before {
      content: '';
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
    }
    .omni-chat-actions {
      display: flex;
      gap: 6px;
    }
    .omni-btn-icon {
      background: transparent;
      border: none;
      color: #94a3b8;
      width: 30px;
      height: 30px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }
    .omni-btn-icon:hover {
      background: #334155;
      color: #ffffff;
    }
    .omni-btn-icon.active {
      color: #38bdf8;
      background: rgba(14, 165, 233, 0.2);
    }
    .omni-chat-body {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: radial-gradient(circle at top right, rgba(14, 165, 233, 0.05), transparent 40%), #0b1120;
    }
    .omni-msg {
      max-width: 88%;
      padding: 11px 15px;
      border-radius: 14px;
      font-size: 13.5px;
      line-height: 1.5;
      word-break: break-word;
      position: relative;
    }
    .omni-msg.user {
      align-self: flex-end;
      background: #0284c7;
      color: #ffffff;
      border-bottom-right-radius: 4px;
    }
    .omni-msg.assistant {
      align-self: flex-start;
      background: #1e293b;
      color: #e2e8f0;
      border-bottom-left-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.06);
    }
    .omni-card {
      background: #090d16;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 12px;
      margin: 8px 0;
    }
    .omni-card-img {
      width: 100%;
      height: 160px;
      object-fit: cover;
      border-radius: 8px;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .omni-card-img:hover {
      opacity: 0.9;
    }
    .omni-action-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      padding: 5px 10px;
      border-radius: 8px;
      background: #0284c7;
      color: #ffffff;
      border: none;
      cursor: pointer;
      margin-top: 6px;
      transition: background 0.2s;
    }
    .omni-action-pill:hover {
      background: #0369a1;
    }
    .omni-action-pill.danger {
      background: #dc2626;
    }
    .omni-action-pill.danger:hover {
      background: #b91c1c;
    }
    .omni-tts-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      color: #94a3b8;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 2px 8px;
      margin-top: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .omni-tts-btn:hover {
      color: #38bdf8;
      background: rgba(14, 165, 233, 0.2);
    }
    .omni-msg.tool-badge {
      font-size: 11px;
      color: #38bdf8;
      background: rgba(14, 165, 233, 0.1);
      border: 1px solid rgba(14, 165, 233, 0.3);
      padding: 4px 10px;
      border-radius: 20px;
      align-self: flex-start;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .omni-msg pre {
      background: #090d16;
      padding: 8px 10px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 12px;
      margin: 6px 0;
    }
    .omni-msg code {
      font-family: monospace;
      background: rgba(0, 0, 0, 0.3);
      padding: 2px 4px;
      border-radius: 4px;
    }
    .omni-suggestions {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding: 8px 14px;
      background: #0f172a;
      border-top: 1px solid #1e293b;
      scrollbar-width: none;
    }
    .omni-suggestions::-webkit-scrollbar {
      display: none;
    }
    .omni-pill {
      white-space: nowrap;
      font-size: 11.5px;
      padding: 5px 10px;
      border-radius: 9999px;
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
      cursor: pointer;
      transition: all 0.2s;
    }
    .omni-pill:hover {
      background: #0ea5e9;
      color: #ffffff;
      border-color: #0ea5e9;
    }
    .omni-chat-footer {
      padding: 12px 14px;
      background: #1e293b;
      border-top: 1px solid #334155;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .omni-input {
      flex: 1;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 10px 14px;
      color: #ffffff;
      font-size: 13.5px;
      outline: none;
      transition: border-color 0.2s;
    }
    .omni-input:focus {
      border-color: #0ea5e9;
    }
    .omni-mic-btn {
      background: #334155;
      color: #94a3b8;
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .omni-mic-btn:hover {
      background: #475569;
      color: #ffffff;
    }
    .omni-mic-btn.recording {
      background: #ef4444;
      color: #ffffff;
      animation: omni-pulse 1s infinite;
    }
    @keyframes omni-pulse {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      70% { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
    .omni-send-btn {
      background: #0ea5e9;
      color: #ffffff;
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .omni-send-btn:hover {
      background: #0284c7;
    }
    .omni-send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .omni-typing {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
    }
    .omni-typing span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #38bdf8;
      animation: omni-bounce 1.4s infinite ease-in-out both;
    }
    .omni-typing span:nth-child(1) { animation-delay: -0.32s; }
    .omni-typing span:nth-child(2) { animation-delay: -0.16s; }
    @keyframes omni-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
  `
  document.head.appendChild(style)

  const container = document.createElement('div')
  container.id = `omni-widget-container-${project}`

  const defaultWelcome = project === 'cctv'
    ? 'Halo! Saya **Sentinel AI**, siap memantau keamanan EdgeSentinel, mengecek status kamera, mengambil foto live kamera, menganalisis orang asing dengan AI Vision, atau membunyikan alarm.'
    : `Halo! Saya asisten AI untuk scope **[${project.toUpperCase()}]**, siap membantu Anda.`

  let messages = []
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) messages = JSON.parse(saved)
  } catch {}
  if (messages.length === 0) {
    messages.push({ role: 'assistant', content: defaultWelcome })
  }

  let autoSpeak = false

  const avatars = {
    cctv: '🛡️',
    tanicerdas: '🌱',
    shop: '🛍️',
    pulse: '⚡',
    superadmin: '🚀',
  }
  const currentAvatar = avatars[project] || '🤖'

  container.innerHTML = `
    <!-- Floating Button -->
    <div class="omni-chat-fab" id="omni-fab-${project}" title="Tanya AI">
      <span class="ping-dot"></span>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10a9.96 9.96 0 0 1-4.708-1.175L2 22l1.175-5.292A9.96 9.96 0 0 1 2 12 10 10 0 0 1 12 2z"></path>
        <path d="M8 12h.01"></path>
        <path d="M12 12h.01"></path>
        <path d="M16 12h.01"></path>
      </svg>
    </div>

    <!-- Modal Window -->
    <div class="omni-chat-modal" id="omni-modal-${project}">
      <div class="omni-chat-header">
        <div class="omni-chat-header-info">
          <div class="omni-chat-avatar">${currentAvatar}</div>
          <div>
            <h4 class="omni-chat-title">${customTitle}</h4>
            <div class="omni-chat-subtitle">Scope: [${project.toUpperCase()}] • Online</div>
          </div>
        </div>
        <div class="omni-chat-actions">
          <button class="omni-btn-icon" id="omni-speak-toggle-${project}" title="Bicara Otomatis (TTS)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
          <button class="omni-btn-icon" id="omni-clear-${project}" title="Hapus Riwayat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
          </button>
          <button class="omni-btn-icon" id="omni-close-${project}" title="Tutup">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <div class="omni-chat-body" id="omni-body-${project}"></div>

      <div class="omni-suggestions" id="omni-suggestions-${project}">
        ${suggestions.map(s => `<button class="omni-pill" data-prompt="${escapeHtml(s.prompt)}">${s.label}</button>`).join('')}
      </div>

      <form class="omni-chat-footer" id="omni-form-${project}">
        <button type="button" class="omni-mic-btn" id="omni-mic-${project}" title="Bicara (Voice Input)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
        </button>
        <input type="text" class="omni-input" id="omni-input-${project}" placeholder="Ketik atau tekan mikrofon..." autocomplete="off" />
        <button type="submit" class="omni-send-btn" id="omni-send-${project}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>
  `

  document.body.appendChild(container)

  // DOM Elements
  const fab = document.getElementById(`omni-fab-${project}`)
  const modal = document.getElementById(`omni-modal-${project}`)
  const closeBtn = document.getElementById(`omni-close-${project}`)
  const clearBtn = document.getElementById(`omni-clear-${project}`)
  const speakToggle = document.getElementById(`omni-speak-toggle-${project}`)
  const micBtn = document.getElementById(`omni-mic-${project}`)
  const chatBody = document.getElementById(`omni-body-${project}`)
  const form = document.getElementById(`omni-form-${project}`)
  const input = document.getElementById(`omni-input-${project}`)
  const sendBtn = document.getElementById(`omni-send-${project}`)
  const suggestionsBox = document.getElementById(`omni-suggestions-${project}`)

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function renderMarkdown(text) {
    if (!text) return ''
    let html = escapeHtml(text)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/`(.*?)`/g, '<code>$1</code>')
    html = html.replace(/\n/g, '<br/>')
    html = html.replace(/^-\s+(.*)/gm, '• $1')
    // Embed clickable image links as preview cards
    html = html.replace(/\[Lihat Snapshot\]\((https?:\/\/[^\s)]+)\)/g, '<div class="omni-card"><img src="$1" class="omni-card-img" onclick="window.open(\'$1\', \'_blank\')" title="Klik untuk membuka ukuran penuh" /><div style="font-size:11px;color:#94a3b8;margin-top:4px;">🔍 Klik gambar untuk membuka ukuran penuh</div></div>')
    return html
  }

  function cleanTextForSpeech(text) {
    return text.replace(/[*#`_\[\]()]/g, '').replace(/https?:\/\/\S+/g, '')
  }

  function speakText(text) {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(cleanTextForSpeech(text))
    utterance.lang = 'id-ID'
    utterance.rate = 1.05
    window.speechSynthesis.speak(utterance)
  }

  function renderMessages() {
    chatBody.innerHTML = ''
    messages.forEach((m) => {
      const div = document.createElement('div')
      div.className = `omni-msg ${m.role}`
      div.innerHTML = renderMarkdown(m.content)

      if (m.role === 'assistant') {
        const ttsBtn = document.createElement('button')
        ttsBtn.className = 'omni-tts-btn'
        ttsBtn.innerHTML = `🔊 Dengar Suara`
        ttsBtn.onclick = () => speakText(m.content)
        div.appendChild(document.createElement('br'))
        div.appendChild(ttsBtn)
      }

      chatBody.appendChild(div)
    })
    chatBody.scrollTop = chatBody.scrollHeight
  }

  function saveMessages() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages))
    } catch {}
  }

  fab.addEventListener('click', () => {
    modal.classList.toggle('open')
    if (modal.classList.contains('open')) {
      input.focus()
      chatBody.scrollTop = chatBody.scrollHeight
    }
  })

  closeBtn.addEventListener('click', () => {
    modal.classList.remove('open')
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  })

  clearBtn.addEventListener('click', () => {
    if (confirm('Hapus seluruh riwayat percakapan?')) {
      messages = [{ role: 'assistant', content: defaultWelcome }]
      saveMessages()
      renderMessages()
    }
  })

  speakToggle.addEventListener('click', () => {
    autoSpeak = !autoSpeak
    speakToggle.classList.toggle('active', autoSpeak)
    if (autoSpeak) {
      speakText('Mode suara aktif. Saya akan membacakan jawaban.')
    } else {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  })

  // Speech Recognition (Voice Input)
  let recognition = null
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (SpeechRecognition) {
    recognition = new SpeechRecognition()
    recognition.lang = 'id-ID'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => {
      micBtn.classList.add('recording')
      input.placeholder = 'Mendengarkan suara Anda...'
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      input.value = transcript
      micBtn.classList.remove('recording')
      input.placeholder = 'Ketik atau tekan mikrofon...'
      setTimeout(() => form.dispatchEvent(new Event('submit')), 300)
    }

    recognition.onerror = () => {
      micBtn.classList.remove('recording')
      input.placeholder = 'Ketik atau tekan mikrofon...'
    }

    recognition.onend = () => {
      micBtn.classList.remove('recording')
      input.placeholder = 'Ketik atau tekan mikrofon...'
    }

    micBtn.addEventListener('click', () => {
      try {
        if (micBtn.classList.contains('recording')) {
          recognition.stop()
        } else {
          recognition.start()
        }
      } catch (e) {
        console.warn('Speech recognition error:', e)
      }
    })
  } else {
    micBtn.title = 'Speech Recognition tidak didukung di browser ini'
    micBtn.style.opacity = '0.4'
  }

  // Suggestion click
  suggestionsBox.addEventListener('click', (e) => {
    const pill = e.target.closest('.omni-pill')
    if (pill) {
      const prompt = pill.getAttribute('data-prompt')
      if (prompt) {
        input.value = prompt
        form.dispatchEvent(new Event('submit'))
      }
    }
  })

  // Send message
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const content = input.value.trim()
    if (!content) return

    messages.push({ role: 'user', content })
    input.value = ''
    renderMessages()
    saveMessages()

    sendBtn.disabled = true
    input.disabled = true

    const typingDiv = document.createElement('div')
    typingDiv.className = 'omni-typing'
    typingDiv.innerHTML = `<span></span><span></span><span></span>`
    chatBody.appendChild(typingDiv)
    chatBody.scrollTop = chatBody.scrollHeight

    try {
      const payload = {
        project,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: false,
      }

      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (typingDiv.parentNode) {
        typingDiv.parentNode.removeChild(typingDiv)
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      
      if (data.toolCalls && data.toolCalls.length > 0) {
        const toolNames = data.toolCalls.map(t => t.toolName).join(', ')
        const toolBadge = document.createElement('div')
        toolBadge.className = 'omni-msg tool-badge'
        toolBadge.innerHTML = `⚡ <em>Menjalankan: ${toolNames}</em>`
        chatBody.appendChild(toolBadge)
      }

      const replyContent = data.content || '(Respon kosong)'
      messages.push({
        role: 'assistant',
        content: replyContent,
      })
      saveMessages()
      renderMessages()

      if (autoSpeak) {
        speakText(replyContent)
      }
    } catch (err) {
      if (typingDiv.parentNode) {
        typingDiv.parentNode.removeChild(typingDiv)
      }
      const errorMsg = err instanceof Error ? err.message : String(err)
      messages.push({
        role: 'assistant',
        content: `⚠️ **Terjadi Kesalahan:**\n${errorMsg}`,
      })
      saveMessages()
      renderMessages()
    } finally {
      sendBtn.disabled = false
      input.disabled = false
      input.focus()
    }
  })

  renderMessages()
})()
