import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "src", "public");
const distPublicDir = path.join(rootDir, "dist", "public");

function compileIndex(sourceDir, destFile) {
  const templatePath = path.join(sourceDir, "index.html");
  if (!fs.existsSync(templatePath)) return;

  let html = fs.readFileSync(templatePath, "utf-8");
  html = html.replace(/<!--#include\s+file=["'](.+?)["']\s*-->/g, (_match, relPath) => {
    const compPath = path.join(sourceDir, relPath);
    if (fs.existsSync(compPath)) {
      return fs.readFileSync(compPath, "utf-8");
    }
    console.warn(`[BuildViews] Warning: Component ${relPath} not found in ${sourceDir}`);
    return `<!-- Missing: ${relPath} -->`;
  });

  const destDir = path.dirname(destFile);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.writeFileSync(destFile, html, "utf-8");
  console.log(`[BuildViews] Successfully compiled ${destFile}`);
}

// Compile dist/public/index.html
compileIndex(publicDir, path.join(distPublicDir, "index.html"));
