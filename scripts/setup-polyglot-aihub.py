import json
import os
import sys

# Dictionaries for AI Hub
translations = {
    "nav": {
        "title": { "id": "AI HUB", "en": "AI HUB", "ja": "AI HUB" },
        "gateway_badge": { "id": "Gateway", "en": "Gateway", "ja": "ゲートウェイ" },
        "status_online": { "id": "Online • Multi-Provider", "en": "Online • Multi-Provider", "ja": "オンライン • マルチプロバイダー" },
        "overview": { "id": "Overview", "en": "Overview", "ja": "概要" },
        "agents": { "id": "Agents & MCP", "en": "Agents & MCP", "ja": "エージェント & MCP" },
        "keys": { "id": "API Keys & Budgets", "en": "API Keys & Budgets", "ja": "APIキー & 予算" },
        "providers": { "id": "Providers & Routing", "en": "Providers & Routing", "ja": "プロバイダー & ルーティング" },
        "playground": { "id": "Playground & Studio", "en": "Playground & Studio", "ja": "プレイグラウンド" },
        "docs": { "id": "Docs", "en": "Docs", "ja": "ドキュメント" },
        "master_token": { "id": "Master Admin Token", "en": "Master Admin Token", "ja": "マスター管理者トークン" },
        "save": { "id": "Simpan", "en": "Save", "ja": "保存" },
        "refresh": { "id": "Segarkan", "en": "Refresh", "ja": "更新" },
        "language": { "id": "Bahasa", "en": "Language", "ja": "言語" },
    },
    "overview": {
        "total_requests": { "id": "Total Permintaan", "en": "Total Requests", "ja": "リクエスト総数" },
        "total_tokens": { "id": "Total Token", "en": "Total Tokens", "ja": "トークン総数" },
        "est_cost": { "id": "Est. Biaya (USD)", "en": "Est. Cost (USD)", "ja": "推定コスト (USD)" },
        "success_rate": { "id": "Tingkat Sukses", "en": "Success Rate", "ja": "成功率" },
        "active_keys": { "id": "Kunci Aktif", "en": "Active Keys", "ja": "アクティブキー" },
        "avg_latency": { "id": "Rata-rata Latensi", "en": "Avg Latency", "ja": "平均レイテンシ" },
        "node_platform": { "id": "Node & Platform:", "en": "Node & Platform:", "ja": "Node & プラットフォーム:" },
        "ram": { "id": "RAM:", "en": "RAM:", "ja": "RAM:" },
        "uptime": { "id": "Uptime:", "en": "Uptime:", "ja": "稼働時間:" },
        "loading": { "id": "Memuat...", "en": "Loading...", "ja": "読み込み中..." },
        "daily_traffic_title": { "id": "Traffic Harian & Konsumsi Token (7 Hari Terakhir)", "en": "Daily Traffic & Token Consumption (Last 7 Days)", "ja": "日次トラフィック & トークン消費（過去7日間）" },
        "daily_traffic_subtitle": { "id": "Statistik real-time tren harian", "en": "Real-time daily transaction trends", "ja": "リアルタイムの日次トランザクション傾向" },
        "legend_requests": { "id": "Total Permintaan", "en": "Total Requests", "ja": "リクエスト総数" },
        "legend_tokens": { "id": "Konsumsi Token", "en": "Token Consumption", "ja": "トークン消費" },
        "calculating_summary": { "id": "Menghitung akumulasi transaksi...", "en": "Calculating total transactions...", "ja": "トランザクション累計を計算中..." },
        "provider_dist_title": { "id": "Distribusi Traffic Penyedia Realtime", "en": "Live Provider Traffic Distribution", "ja": "プロバイダートラフィック分散（リアルタイム）" },
        "provider_dist_subtitle": { "id": "Telemetri auto-balance multi-provider", "en": "Auto-balanced multi-provider telemetry", "ja": "自動バランシングマルチプロバイダーテレメトリ" },
        "logs_title": { "id": "Log Permintaan Realtime", "en": "Realtime Request Logs", "ja": "リアルタイムリクエストログ" },
        "live_stream_off": { "id": "Live Stream (Nonaktif)", "en": "Live Stream (Off)", "ja": "ライブ配信 (オフ)" },
        "live_stream_on": { "id": "Live Stream (Aktif)", "en": "Live Stream (On)", "ja": "ライブ配信 (オン)" },
        "search_logs": { "id": "Cari prompt, model...", "en": "Search prompt, model...", "ja": "プロンプト、モデルを検索..." },
        "all_projects": { "id": "Semua Project", "en": "All Projects", "ja": "すべてのプロジェクト" },
        "all_status": { "id": "Semua Status", "en": "All Status", "ja": "すべてのステータス" },
        "status_success": { "id": "Berhasil (200)", "en": "Success (200)", "ja": "成功 (200)" },
        "status_error": { "id": "Error / Anggaran Habis", "en": "Error / Budget Exceeded", "ja": "エラー / 予算超過" },
        "export_csv": { "id": "CSV", "en": "CSV", "ja": "CSV" },
        "export_json": { "id": "JSON", "en": "JSON", "ja": "JSON" },
        "clear_logs": { "id": "Bersihkan", "en": "Clear", "ja": "クリア" },
        "refresh_logs": { "id": "Segarkan", "en": "Refresh", "ja": "更新" },
        "col_time": { "id": "Waktu", "en": "Time", "ja": "時刻" },
        "col_project": { "id": "Project", "en": "Project", "ja": "プロジェクト" },
        "col_model": { "id": "Model Diminta", "en": "Model Requested", "ja": "要求モデル" },
        "col_provider": { "id": "Penyedia Digunakan", "en": "Provider Used", "ja": "使用プロバイダー" },
        "col_tokens": { "id": "Token", "en": "Tokens", "ja": "トークン" },
        "col_cost": { "id": "Est. Biaya", "en": "Est. Cost", "ja": "推定コスト" },
        "col_latency": { "id": "Latensi", "en": "Latency", "ja": "レイテンシ" },
        "col_status": { "id": "Status", "en": "Status", "ja": "ステータス" },
        "no_logs": { "id": "Belum ada riwayat transaksi permintaan tercatat.", "en": "No request transactions recorded yet.", "ja": "リクエスト履歴はまだありません。" },
    },
    "agents": {
        "title": { "id": "Omni Agents & Hub Tool MCP", "en": "Omni Agents & MCP Tool Hub", "ja": "Omni Agents & MCPツールハブ" },
        "subtitle": { "id": "Asisten otonom terintegrasi ke EdgeSentinel CCTV, Flow Meter ESP32, TaniCerdas IoT, Toko Online, dan Pulse VPS Monitor.", "en": "Autonomous assistants integrated with CCTV, IoT, Store, and VPS.", "ja": "CCTV、IoT、店舗、VPSと連携した自律型アシスタント。" },
        "cron_patrol": { "id": "Patroli Cron:", "en": "Cron Patrol:", "ja": "Cronパトロール:" },
        "active": { "id": "Aktif", "en": "Active", "ja": "有効" },
        "tool_calls": { "id": "Panggilan Tool:", "en": "Tool Calls:", "ja": "ツール呼び出し:" },
        "model_label": { "id": "Model LLM untuk Reasoning:", "en": "LLM Reasoning Model:", "ja": "推論用LLMモデル:" },
        "auto_router": { "id": "Auto Router (Default Hub)", "en": "Auto Router (Default Hub)", "ja": "オートルーター (デフォルト)" },
        "quick_suggestions": { "id": "Aksi Cepat (Quick Suggestions):", "en": "Quick Suggestions:", "ja": "クイックアクション:" },
        "mcp_catalog_title": { "id": "Katalog MCP Function Tools", "en": "MCP Function Tools Catalog", "ja": "MCP機能ツールカタログ" },
        "mcp_catalog_desc": { "id": "Tools ini dapat dipanggil otomatis oleh Agent atau melalui protokol standard MCP.", "en": "Tools executed autonomously by Agent or standard MCP clients.", "ja": "エージェントまたはMCPクライアントから実行可能なツール。" },
        "cron_title": { "id": "Patroli Otonom (Cron Engine)", "en": "Autonomous Patrols (Cron Engine)", "ja": "自律パトロール (Cronエンジン)" },
        "cron_desc": { "id": "Tugas otomatis terjadwal yang berjalan di latar belakang.", "en": "Active scheduled background tasks.", "ja": "定期実行されるバックグラウンドタスク。" },
        "memory_title": { "id": "Long-Term Memory Store (Fakta & Konteks)", "en": "Long-Term Memory Store", "ja": "長期記憶ストア (事実 & コンテキスト)" },
        "memory_desc": { "id": "Fakta dan preferensi yang diingat agen antar percakapan.", "en": "Persisted memory recalled across sessions.", "ja": "セッション間で保持される記憶。" },
        "add_memory": { "id": "+ Tambah Memori", "en": "+ Add Memory", "ja": "+ 記憶を追加" },
        "wa_simulator_title": { "id": "Simulasi WhatsApp Inbound", "en": "WhatsApp Inbound Simulator", "ja": "WhatsApp受信シミュレーター" },
        "wa_simulator_desc": { "id": "Uji alur webhook chat masuk sebelum ke server produksi.", "en": "Test inbound webhook chat parsing.", "ja": "受信チャットWebhookのテスト。" },
        "embed_title": { "id": "Snippet Integrasi Web Universal", "en": "Universal Web Embed Snippet", "ja": "Web埋め込みスニペット" },
        "embed_desc": { "id": "Pasang asisten ini ke aplikasi web manapun cukup dengan 1 tag script.", "en": "Embed this agent into any web application.", "ja": "Webアプリに1つのscriptタグで埋め込み。" },
        "chat_title": { "id": "Konsol Percakapan Interaktif", "en": "Interactive Agent Console", "ja": "対話型エージェントコンソール" },
        "clear_chat": { "id": "Bersihkan Chat", "en": "Clear Chat", "ja": "チャットをクリア" },
        "input_placeholder": { "id": "Tanyakan agen atau berikan perintah (misal: cek snapshot cctv, siram tanaman)...", "en": "Ask agent or give a command (e.g. check CCTV snapshot, water plants)...", "ja": "エージェントに質問または指示を入力..." },
        "voice_record": { "id": "Input Suara", "en": "Voice Input", "ja": "音声入力" },
        "send": { "id": "Kirim", "en": "Send", "ja": "送信" },
    },
    "keys": {
        "title": { "id": "Virtual API Keys & Pengendalian Anggaran", "en": "Virtual API Keys & Budget Guardrails", "ja": "仮想APIキー & 予算管理" },
        "subtitle": { "id": "Terbitkan virtual key dengan kuota bulanan, pembatasan provider, dan limit USD ketat.", "en": "Issue isolated API keys with strict quotas, provider locks, and spending limits.", "ja": "月次クォータ、プロバイダー制限、USD上限付きキーを発行。" },
        "create_title": { "id": "Buat Virtual API Key Baru", "en": "Create New Virtual Key", "ja": "新しい仮想キーを作成" },
        "name_label": { "id": "Nama Kunci / Label Project:", "en": "Key Name / Project Label:", "ja": "キー名 / プロジェクト:" },
        "name_placeholder": { "id": "Contoh: EdgeSentinel Production, Mobile App...", "en": "e.g. EdgeSentinel Production, Mobile App...", "ja": "例: 本番環境、モバイルアプリ..." },
        "monthly_quota": { "id": "Kuota Permintaan Bulanan:", "en": "Monthly Request Quota:", "ja": "月間リクエストクォータ:" },
        "monthly_quota_placeholder": { "id": "0 = Tanpa Batas", "en": "0 for unlimited", "ja": "0 = 無制限" },
        "monthly_cost_cap": { "id": "Batas Pengeluaran Bulanan (USD):", "en": "Monthly Cost Limit (USD):", "ja": "月額上限 (USD):" },
        "monthly_cost_placeholder": { "id": "Contoh: 10.00 (0 = Bebas)", "en": "e.g. 10.00 (0 for no limit)", "ja": "例: 10.00 (0 = 無制限)" },
        "provider_lock": { "id": "Kunci ke Provider Tertentu (Opsional):", "en": "Lock to Specific Provider:", "ja": "特定プロバイダーに固定:" },
        "all_providers": { "id": "Semua Provider (Auto-Failover)", "en": "All Providers (Auto Failover)", "ja": "全プロバイダー (自動フェイルオーバー)" },
        "btn_create": { "id": "Terbitkan Virtual Key", "en": "Generate Virtual Key", "ja": "仮想キーを発行" },
        "active_title": { "id": "Daftar Virtual Key Terdaftar", "en": "Active Virtual Keys", "ja": "有効な仮想キー一覧" },
        "col_name": { "id": "Nama", "en": "Name", "ja": "名前" },
        "col_key": { "id": "Virtual Key", "en": "API Key", "ja": "APIキー" },
        "col_quota_usage": { "id": "Penggunaan Kuota", "en": "Request Usage", "ja": "リクエスト使用量" },
        "col_cost_usage": { "id": "Pengeluaran (USD)", "en": "Cost Usage (USD)", "ja": "コスト使用量 (USD)" },
        "col_status": { "id": "Status", "en": "Status", "ja": "ステータス" },
        "col_actions": { "id": "Aksi", "en": "Actions", "ja": "操作" },
    },
    "providers": {
        "title": { "id": "Penyedia Model AI Didukung", "en": "Supported AI Providers", "ja": "サポート対象AIプロバイダー" },
        "subtitle": { "id": "Konfigurasi API key, uji koneksi, dan pantau latensi riil di 12 penyedia AI.", "en": "Configure API keys, test connections, and benchmark latencies across 12 AI providers.", "ja": "12のAIプロバイダーでAPIキー設定、接続テスト、レイテンシ測定。" },
        "benchmark_title": { "id": "Live Provider Diagnostic & Benchmark Matrix", "en": "Live Provider Diagnostic & Benchmark Matrix", "ja": "プロバイダー診断 & ベンチマークマトリクス" },
        "benchmark_subtitle": { "id": "Uji latensi riil, ketersediaan koneksi upstream, dan model aktif secara komprehensif.", "en": "Test real latency, upstream connectivity, and active models across all providers.", "ja": "全プロバイダーの実測レイテンシ、アップストリーム接続、有効モデルを包括テスト。" },
        "benchmark_btn": { "id": "Jalankan Benchmark Semua", "en": "Run Benchmark All", "ja": "全ベンチマークを実行" },
        "save_config": { "id": "Simpan Kunci", "en": "Save Key", "ja": "キーを保存" },
        "test_btn": { "id": "Uji", "en": "Test", "ja": "テスト" },
        "routing_title": { "id": "Pengaturan Global Routing & Failover", "en": "Global Routing & Failover Settings", "ja": "グローバルルーティング & フェイルオーバー設定" },
        "routing_desc": { "id": "Konfigurasi strategi failover otomatis ketika penyedia primer mengalami rate-limit atau timeout.", "en": "Configure automatic failover strategies when primary providers encounter rate-limits or timeouts.", "ja": "プライマリプロバイダーがレート制限やタイムアウトに達した際の自動フェイルオーバー設定。" },
        "routing_save": { "id": "Simpan Aturan Routing", "en": "Save Routing Rules", "ja": "ルーティング設定を保存" },
        "alias_title": { "id": "Visual Model Alias Manager", "en": "Visual Model Alias Manager", "ja": "モデルエイリアスマネージャー" },
        "alias_desc": { "id": "Petakan alias ramah (seperti fast, vision, reasoning) ke model konkret tanpa mengubah kode aplikasi pemanggil.", "en": "Map friendly aliases (e.g. fast, vision, reasoning) to concrete models without modifying client code.", "ja": "クライアントコードを変更せず、扱いやすいエイリアスをモデルにマッピング。" },
        "add_alias": { "id": "Tambah Alias", "en": "Add Alias", "ja": "エイリアス追加" },
    },
    "playground": {
        "title": { "id": "Multi-Modal Playground Studio", "en": "Multi-Modal Playground Studio", "ja": "マルチモーダルプレイグラウンドスタジオ" },
        "subtitle": { "id": "Uji analisis visi, transkripsi audio, system prompt, dan streaming respon model.", "en": "Test vision, audio transcription, system prompts, and model streaming.", "ja": "画像認識、音声文字起こし、プロンプト、ストリーミングをテスト。" },
        "mode_chat": { "id": "Mode Chat", "en": "Chat Mode", "ja": "チャットモード" },
        "mode_completion": { "id": "Mode Teks Bebas", "en": "Completion / Raw", "ja": "テキスト補完" },
        "preset_label": { "id": "Preset Prompt Siap Pakai:", "en": "Prompt Preset:", "ja": "プロンプトプリセット:" },
        "upload_media": { "id": "Upload Gambar atau Audio (Vision & Whisper):", "en": "Upload Image or Audio (Vision & Whisper):", "ja": "画像または音声をアップロード:" },
        "temperature": { "id": "Temperatur (Kreativitas):", "en": "Temperature:", "ja": "温度 (創造性):" },
        "max_tokens": { "id": "Token Maksimal:", "en": "Max Tokens:", "ja": "最大トークン:" },
        "send_prompt": { "id": "Kirim Permintaan", "en": "Send Request", "ja": "送信" },
        "clear": { "id": "Reset", "en": "Reset", "ja": "リセット" },
        "response_title": { "id": "Hasil Respon Realtime", "en": "Live Output Stream", "ja": "リアルタイム出力結果" },
    },
    "docs": {
        "title": { "id": "Gateway Kompatibel OpenAI SDK", "en": "OpenAI SDK Compatible Gateway", "ja": "OpenAI SDK 互換ゲートウェイ" },
        "subtitle": { "id": "Kompatibel 1:1 dengan OpenAI SDK. Cukup ubah baseURL dan gunakan virtual API key Anda.", "en": "Drop-in replacement for OpenAI API. Just change baseURL and your virtual API key.", "ja": "OpenAI APIと完全互換。baseURLと仮想キーを変更するだけで動作。" },
    },
    "modals": {
        "log_title": { "id": "Detail Transaksi Permintaan", "en": "Request Transaction Details", "ja": "リクエストトランザクション詳細" },
        "close": { "id": "Tutup", "en": "Close", "ja": "閉じる" },
        "copy_json": { "id": "Salin JSON", "en": "Copy JSON", "ja": "JSONをコピー" },
        "code_title": { "id": "Contoh Integrasi Kode", "en": "Code Integration Snippet", "ja": "コード連携スニペット" },
        "copy_code": { "id": "Salin Kode", "en": "Copy Code", "ja": "コードをコピー" }
    }
}

# 1. Generate local nested JSON dictionaries for id, en, ja
locales_dir = os.path.join(os.path.dirname(__file__), "..", "src", "public", "locales")
os.makedirs(locales_dir, exist_ok=True)

for lang in ["id", "en", "ja"]:
    nested = {}
    for ns, keys in translations.items():
        nested[ns] = {}
        for k, v in keys.items():
            nested[ns][k] = v[lang]
    
    target_path = os.path.join(locales_dir, f"{lang}.json")
    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(nested, f, ensure_ascii=False, indent=2)
    print(f"Generated {target_path} ({len(nested)} namespaces)")

# 2. Update Polyglot Hub store (both local and ready for VPS)
polyglot_store_path = os.path.join(os.path.dirname(__file__), "..", "..", "polyglot-hub", "backend", "data", "polyglot-store.json")
if os.path.exists(polyglot_store_path):
    with open(polyglot_store_path, "r", encoding="utf-8") as f:
        store = json.load(f)
    
    # Ensure project exists
    projects = store.get("projects", [])
    proj_aihub = next((p for p in projects if p.get("slug") == "ai-hub"), None)
    if not proj_aihub:
        proj_aihub = {
            "id": "proj_aihub",
            "name": "AI Hub & Omni-Agent",
            "slug": "ai-hub",
            "description": "Multi-Provider AI Gateway, Model Routing, Omni-Agents, and MCP Tool Orchestrator",
            "icon": "🤖",
            "createdAt": "2026-11-21T08:00:00.000Z",
            "updatedAt": "2026-11-21T08:00:00.000Z"
        }
        projects.append(proj_aihub)
        store["projects"] = projects

    # Insert or update translations
    existing_translations = store.get("translations", [])
    # Filter out old aihub translations
    updated_translations = [t for t in existing_translations if t.get("projectId") != "proj_aihub"]

    count = 1
    for ns, keys in translations.items():
        for k, v in keys.items():
            full_key = f"{ns}.{k}"
            record = {
                "id": f"t_aihub_{count}",
                "projectId": "proj_aihub",
                "key": full_key,
                "namespace": ns,
                "translations": {
                    "id": v["id"],
                    "en": v["en"],
                    "ja": v["ja"]
                },
                "createdAt": "2026-11-21T08:00:00.000Z",
                "updatedAt": "2026-11-21T08:00:00.000Z"
            }
            updated_translations.append(record)
            count += 1
    
    store["translations"] = updated_translations
    with open(polyglot_store_path, "w", encoding="utf-8") as f:
        json.dump(store, f, ensure_ascii=False, indent=2)
    print(f"Updated Polyglot Hub store with {count-1} translation keys for ai-hub!")

print("All translations generated successfully.")
