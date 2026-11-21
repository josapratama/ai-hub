# AI Hub 🚀

> **Enterprise-grade Centralized AI Gateway, Multi-Provider LLM Router & Token Analytics**

AI Hub bertindak sebagai pintu gerbang (Gateway) tunggal untuk semua kebutuhan AI di ekosistem Anda. Alih-alih setiap proyek (`nexus-chat`, `resumecraft-ai`, script Python, bot WhatsApp, dll.) menyimpan API key pihak ketiga secara terpisah, semuanya cukup terhubung ke AI Hub dengan API Key proyek internal.

---

## 🌟 Fitur Utama

1. **Universal OpenAI-Compatible API (`/v1/chat/completions`)**:
   - Mendukung format standar OpenAI baik JSON biasa maupun **Streaming SSE (`stream: true`)**.
   - Bekerja secara *drop-in* dengan semua SDK AI populer: Vercel AI SDK, `openai-node`, Python `openai`, LangChain, cURL, dll.
2. **Multi-Provider Support (12+ AI Engines)**:
   - **Google Gemini**: `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash`
   - **OpenAI**: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`
   - **Anthropic Claude**: `claude-3-5-sonnet`, `claude-3-5-haiku`
   - **OpenRouter**: Access hundreds of models across multiple platforms
   - **Mistral AI**: `mistral-large-latest`, `codestral-latest`, `mistral-small-latest`
   - **Together AI**: Open-source AI cloud (`deepseek-v3`, `llama-3.3-70b-instruct`)
   - **xAI Grok**: `grok-2-latest`, `grok-beta`
   - **Cohere**: `command-r-plus`, `command-r`
   - **Perplexity**: `sonar-pro`, `sonar`
   - **Groq**: Ultra-fast inference (`llama-3.3-70b-versatile`, `mixtral-8x7b-32768`)
   - **DeepSeek**: `deepseek-chat`, `deepseek-reasoner`
   - **Ollama (Self-Hosted / Local)**: `llama3.1`, `mistral`, `deepseek-r1`, `qwen2.5`, `llava`
3. **Otomatis Failover & Fallback (Zero Downtime)**:
   - Jika Gemini API terkena kuota habis (HTTP 429) atau timeout, AI Hub otomatis mengalihkan request ke model cadangan (misal: `gpt-4o-mini` atau Ollama lokal) secara transparan.
4. **Satu Titik Penggantian Kunci (Single Point of Key Rotation)**:
   - Ganti atau perbarui API Key Gemini / OpenAI cukup sekali di dashboard AI Hub. Seluruh aplikasi Anda langsung menggunakan kunci baru tanpa perlu restart atau ganti file `.env`.
5. **Project API Key Management & Token Analytics**:
   - Terbitkan API key unik untuk setiap aplikasi (misal: `aih_live_nexuschat_...`, `aih_live_resumecraft_...`).
   - Pantau total request, token yang terpakai, dan latensi per aplikasi.
6. **Modern Web Dashboard & Built-in Playground**:
   - Akses di `http://localhost:4000` untuk memantau traffic real-time, mengelola API key, dan menguji prompt langsung di browser.

---

## 🚀 Cara Menjalankan

### Opsi A: Development Lokal (Node.js)

```bash
cd project/ai-hub

# 1. Install dependencies
pnpm install

# 2. Siapkan file .env (opsional isi GEMINI_API_KEY / OPENAI_API_KEY)
cp .env.example .env

# 3. Jalankan server
pnpm dev
```

Server akan aktif di:
- **Dashboard Admin**: `http://localhost:4000` (Token default: `aih_admin_secret_2026`)
- **API Endpoint**: `http://localhost:4000/v1`

---

### Opsi B: Docker / VPS Deployment

```bash
cd project/ai-hub
docker compose up -d --build
```

---

## 🔌 Cara Menghubungkan ke Proyek Anda

### 1. Hubungkan ke `nexus-chat`
Di file `project/nexus-chat/.env`:
```env
OPENAI_BASE_URL="http://localhost:4000/v1"
OPENAI_API_KEY="aih_live_nexuschat_2026"
```
Di `nexus-chat`, pilih model apapun (misal `gemini-2.0-flash`, `gpt-4o-mini`, `llama3.1`), semua akan diproses mulus melalui AI Hub!

---

### 2. Hubungkan ke `resumecraft-ai`
Gunakan fetch standar OpenAI atau Vercel AI SDK dengan:
- **Base URL**: `http://localhost:4000/v1`
- **API Key**: `aih_live_resumecraft_2026`

Contoh panggilan cURL:
```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer aih_live_default_key_2026" \
  -d '{
    "model": "gemini-2.0-flash",
    "messages": [
      {"role": "system", "content": "Anda adalah asisten AI yang cerdas."},
      {"role": "user", "content": "Halo AI Hub!"}
    ]
  }'
```

Contoh Python (`openai` SDK):
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000/v1",
    api_key="aih_live_default_key_2026"
)

response = client.chat.completions.create(
    model="gemini-2.0-flash",
    messages=[{"role": "user", "content": "Hai, jelaskan AI Hub!"}]
)

print(response.choices[0].message.content)
```

---

## 📋 Default Pre-configured API Keys

| Proyek | API Key | Batas RPM | Status |
| :--- | :--- | :--- | :--- |
| **Nexus-Chat** | `aih_live_nexuschat_2026` | 120 RPM | Aktif |
| **ResumeCraft AI** | `aih_live_resumecraft_2026` | 120 RPM | Aktif |
| **General / Test** | `aih_live_default_key_2026` | 60 RPM | Aktif |

Kunci baru dapat dibuat kapan saja secara instan melalui Dashboard Web.
