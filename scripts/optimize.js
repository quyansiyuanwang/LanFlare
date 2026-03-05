const fs = require("fs");
const path = require("path");

// Minify CSS by removing comments and extra whitespace
function minifyCSS(css) {
  return (
    css
      // Remove comments
      .replace(/\/\*[\s\S]*?\*\//g, "")
      // Remove extra whitespace
      .replace(/\s+/g, " ")
      // Remove whitespace around special characters
      .replace(/\s*([{}:;,>+~])\s*/g, "$1")
      // Remove trailing semicolons
      .replace(/;}/g, "}")
      .trim()
  );
}

// Minify HTML by removing comments and extra whitespace
function minifyHTML(html) {
  return (
    html
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, "")
      // Remove extra whitespace between tags
      .replace(/>\s+</g, "><")
      // Remove whitespace at start/end of lines
      .replace(/^\s+|\s+$/gm, "")
      .trim()
  );
}

// Create optimized build
const srcDir = path.join(__dirname, "..", "src", "renderer");
const distDir = path.join(__dirname, "..", "dist", "renderer");

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Minify CSS
const cssPath = path.join(srcDir, "assets", "styles.css");
const cssContent = fs.readFileSync(cssPath, "utf-8");
const minifiedCSS = minifyCSS(cssContent);
fs.writeFileSync(path.join(distDir, "styles.min.css"), minifiedCSS);

console.log(
  `CSS: ${cssContent.length} -> ${minifiedCSS.length} bytes (${Math.round((1 - minifiedCSS.length / cssContent.length) * 100)}% reduction)`
);

// Minify HTML
const htmlPath = path.join(srcDir, "index.html");
const htmlContent = fs.readFileSync(htmlPath, "utf-8");
const minifiedHTML = minifyHTML(htmlContent).replace("assets/styles.css", "assets/styles.min.css");
fs.writeFileSync(path.join(distDir, "index.min.html"), minifiedHTML);

console.log(
  `HTML: ${htmlContent.length} -> ${minifiedHTML.length} bytes (${Math.round((1 - minifiedHTML.length / htmlContent.length) * 100)}% reduction)`
);

// Copy JS as-is (already optimized)
const jsPath = path.join(srcDir, "app.js");
fs.copyFileSync(jsPath, path.join(distDir, "app.js"));

console.log("Optimization complete!");
