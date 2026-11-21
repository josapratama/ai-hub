#!/usr/bin/env node
/**
 * 🌐 [AI Hub & Omni-Agent] Build-Time Translation Synchronizer
 * Downloads latest translations from Polyglot Hub (https://polyglot-hub.josapratama.com)
 * or local fallback, generating clean nested JSON files in src/public/locales/ with ZERO runtime lag.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_SLUG = process.argv[2] || "ai-hub";
const TARGET_DIR = path.resolve(process.cwd(), process.argv[3] || "src/public/locales");
const POLYGLOT_URL = (process.argv[4] || process.env.POLYGLOT_HUB_URL || "https://polyglot-hub.josapratama.com").replace(/\/+$/, "");

function deepMerge(target, source) {
  const output = { ...target };
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    });
  }
  return output;
}

async function syncTranslations() {
  console.log("\n======================================================");
  console.log("🌐 [Polyglot Hub] Build-Time Translation Sync");
  console.log("======================================================");
  console.log(`📦 Project     : "${PROJECT_SLUG}"`);
  console.log(`📡 Server URL  : ${POLYGLOT_URL}`);
  console.log(`📁 Target Dir  : ${TARGET_DIR}`);

  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  const languages = [
    { code: "id", name: "Bahasa Indonesia" },
    { code: "en", name: "English" },
    { code: "ja", name: "Japanese" }
  ];

  let successCount = 0;

  for (const lang of languages) {
    const exportUrl = `${POLYGLOT_URL}/api/v1/export/${PROJECT_SLUG}/${lang.code}?common=true&format=nested`;
    const targetFile = path.join(TARGET_DIR, `${lang.code}.json`);

    let localExisting = {};
    if (fs.existsSync(targetFile)) {
      try {
        localExisting = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
      } catch {}
    }

    try {
      const res = await fetch(exportUrl, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const remoteData = await res.json();
        if (remoteData && Object.keys(remoteData).length > 0) {
          const merged = deepMerge(localExisting, remoteData);
          fs.writeFileSync(targetFile, JSON.stringify(merged, null, 2), "utf-8");
          console.log(`  ✓ Synced ${lang.code}.json (${Object.keys(merged).length} namespaces)`);
          successCount++;
          continue;
        }
      }
    } catch (err) {
      // Fallback to local
    }

    if (Object.keys(localExisting).length > 0) {
      console.log(`  ⚡ Preserved local ${lang.code}.json (${Object.keys(localExisting).length} namespaces)`);
      successCount++;
    } else {
      console.warn(`  ⚠️ Warning: No translations available for ${lang.code}`);
    }
  }

  console.log(`\n✨ Successfully synced ${successCount}/${languages.length} languages!`);
  console.log("======================================================\n");
}

syncTranslations();
