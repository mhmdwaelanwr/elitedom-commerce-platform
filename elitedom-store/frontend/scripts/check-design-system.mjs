import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const requiredFiles = [
  "index.html",
  "vite.config.ts",
  "src/main.tsx",
  "src/router.tsx",
  "src/pages/HomePage.tsx",
  "src/pages/admin/LaunchControlPage.tsx",
  "src/styles/globals.css",
];
const failures = [];

for (const relativePath of requiredFiles) {
  if (!existsSync(join(frontendRoot, relativePath))) {
    failures.push(`React/Vite baseline: missing ${relativePath}`);
  }
}

const forbiddenNextFiles = [
  "next.config.ts",
  "next-env.d.ts",
  "src/app/layout.tsx",
  "src/app/page.tsx",
];
for (const relativePath of forbiddenNextFiles) {
  if (existsSync(join(frontendRoot, relativePath))) {
    failures.push(`React/Vite baseline: Next.js file is still present: ${relativePath}`);
  }
}

const legacySignatures = ["glass-navbar", "commerce-card", "surface-grid", "gradient-text"];
for (const relativePath of requiredFiles) {
  if (!existsSync(join(frontendRoot, relativePath))) continue;
  const source = readFileSync(join(frontendRoot, relativePath), "utf8");
  for (const signature of legacySignatures) {
    if (source.includes(signature)) {
      failures.push(`${relativePath}: contains legacy UI signature ${signature}`);
    }
  }
}

if (failures.length > 0) {
  console.error("React/Vite frontend checks failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("React/Vite frontend baseline validated.");
