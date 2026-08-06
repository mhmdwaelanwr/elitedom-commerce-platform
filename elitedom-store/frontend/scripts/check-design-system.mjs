import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const localeDomains = [
  "common",
  "storefront",
  "auth",
  "checkout",
  "account",
  "admin",
  "validation",
  "errors",
];

function read(relativePath) {
  return readFileSync(join(frontendRoot, relativePath), "utf8");
}

function extractObjectKeys(source) {
  return [...source.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):/gm)]
    .map((match) => match[1])
    .sort();
}

const failures = [];

for (const domain of localeDomains) {
  const englishKeys = extractObjectKeys(read(`src/locales/en/${domain}.ts`));
  const arabicKeys = extractObjectKeys(read(`src/locales/ar/${domain}.ts`));
  if (englishKeys.length === 0) {
    failures.push(`${domain}: no English translation keys were found`);
  }
  if (englishKeys.join("|") !== arabicKeys.join("|")) {
    failures.push(`${domain}: Arabic and English keys do not match`);
  }
}

const preferences = read("src/config/preferences.ts");
for (const requiredValue of ["en", "ar", "system", "light", "dark"]) {
  if (!preferences.includes(`"${requiredValue}"`)) {
    failures.push(`preferences: missing ${requiredValue}`);
  }
}

const globalCss = read("src/app/globals.css");
for (const token of [
  "--ds-background",
  "--ds-surface",
  "--ds-elevated",
  "--ds-primary",
  "--ds-accent",
  "--ds-text-muted",
  "--ds-danger",
  "--ds-success",
  "--ds-border",
  "--ds-text",
]) {
  const occurrences = globalCss.split(token).length - 1;
  if (occurrences < 3) {
    failures.push(`theme tokens: ${token} must exist in the theme mapping and both themes`);
  }
}

const foundationFiles = [
  "src/app/layout.tsx",
  "src/components/preferences/PreferenceBar.tsx",
  "src/components/store/SiteHeader.tsx",
  "src/components/store/SiteFooter.tsx",
  "src/components/store/StorefrontSearch.tsx",
  "src/components/admin/AdminShell.tsx",
  "src/providers/AppPreferencesProvider.tsx",
  "src/components/ui/Button.tsx",
  "src/components/ui/Card.tsx",
  "src/components/ui/DataDisplay.tsx",
  "src/components/ui/Feedback.tsx",
  "src/components/ui/FormControls.tsx",
  "src/components/ui/Overlay.tsx",
];

const forbiddenPatterns = [
  { label: "hard-coded hex color", pattern: /#[0-9a-fA-F]{3,8}/ },
  {
    label: "fixed neutral palette",
    pattern: /\b(?:bg|text|border|from|to)-(?:slate|gray|zinc|neutral|stone)-/,
  },
  { label: "forced dark root class", pattern: /className=["'{][^\n]*\bdark\b/ },
];

for (const relativePath of foundationFiles) {
  const source = read(relativePath);
  for (const { label, pattern } of forbiddenPatterns) {
    if (pattern.test(source)) {
      failures.push(`${relativePath}: contains ${label}`);
    }
  }
}

if (!read("src/app/layout.tsx").includes("PREFERENCE_BOOTSTRAP_SCRIPT")) {
  failures.push("layout: preference bootstrap script is not installed");
}

if (failures.length > 0) {
  console.error("Design system checks failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Design system checks passed: ${localeDomains.length} locale domains, semantic tokens, and preference bootstrap validated.`,
);
