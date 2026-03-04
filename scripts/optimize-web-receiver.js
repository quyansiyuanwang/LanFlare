const fs = require("fs");
const path = require("path");

console.log("=== Optimizing web-receiver.html ===\n");

const srcPath = path.join(__dirname, "..", "src", "assets", "web-receiver.html");
const distPath = path.join(__dirname, "..", "dist", "src", "assets", "web-receiver.html");

if (!fs.existsSync(srcPath)) {
  console.error("Source file not found");
  process.exit(1);
}

const content = fs.readFileSync(srcPath, "utf-8");
const originalSize = content.length;

// Minify HTML
let minified = content
  // Remove HTML comments
  .replace(/<!--[\s\S]*?-->/g, "")
  // Remove extra whitespace between tags
  .replace(/>\s+</g, "><")
  // Remove whitespace at start/end of lines
  .replace(/^\s+|\s+$/gm, "")
  // Minify CSS
  .replace(/<style>([\s\S]*?)<\/style>/g, (match, css) => {
    const minifiedCss = css
      .replace(/\/\*[\s\S]*?\*\//g, "") // Remove CSS comments
      .replace(/\s+/g, " ") // Collapse whitespace
      .replace(/\s*([{}:;,>+~])\s*/g, "$1") // Remove whitespace around special chars
      .replace(/;}/g, "}") // Remove trailing semicolons
      .trim();
    return `<style>${minifiedCss}</style>`;
  })
  // Minify JavaScript
  .replace(/<script>([\s\S]*?)<\/script>/g, (match, js) => {
    const minifiedJs = js
      .replace(/\/\/.*$/gm, "") // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, "") // Remove multi-line comments
      .replace(/\s+/g, " ") // Collapse whitespace
      .replace(/\s*([{}();,=<>!+\-*\/&|])\s*/g, "$1") // Remove whitespace around operators
      .trim();
    return `<script>${minifiedJs}</script>`;
  })
  .trim();

const newSize = minified.length;
const saved = originalSize - newSize;
const percentage = ((saved / originalSize) * 100).toFixed(1);

// Ensure dist directory exists
const distDir = path.dirname(distPath);
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

fs.writeFileSync(distPath, minified);

console.log(`Original: ${originalSize} bytes`);
console.log(`Minified: ${newSize} bytes`);
console.log(`Saved: ${saved} bytes (${percentage}% reduction)`);
console.log(`\n✅ web-receiver.html optimized\n`);
