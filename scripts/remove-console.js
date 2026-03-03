const fs = require("fs");
const path = require("path");

console.log("=== Removing Console Statements for Production ===\n");

// Files to process
const filesToProcess = [
  "dist/main.js",
  "dist/src/main/clipboard-sync.js",
  "dist/src/main/connection-auth.js",
  "dist/src/main/discovery.js",
  "dist/src/main/transfer.js",
  "dist/src/main/web-receiver.js",
];

let totalRemoved = 0;
let totalSaved = 0;

filesToProcess.forEach((file) => {
  const filePath = path.join(__dirname, "..", file);

  if (!fs.existsSync(filePath)) {
    return;
  }

  const originalContent = fs.readFileSync(filePath, "utf-8");
  const originalSize = originalContent.length;

  // Remove console.log statements
  let newContent = originalContent.replace(/console\.log\([^)]*\);?/g, "");

  // Remove console.error statements (keep in production for debugging)
  // Optionally comment this line to keep console.error
  // newContent = newContent.replace(/console\.error\([^)]*\);?/g, '');

  const newSize = newContent.length;
  const saved = originalSize - newSize;

  if (saved > 0) {
    fs.writeFileSync(filePath, newContent);
    const fileName = path.basename(file);
    console.log(`✓ ${fileName}: removed ${saved} bytes`);
    totalRemoved++;
    totalSaved += saved;
  }
});

console.log(`\n✅ Removed console statements from ${totalRemoved} files`);
console.log(`💾 Total saved: ${totalSaved} bytes (${(totalSaved / 1024).toFixed(2)} KB)\n`);
