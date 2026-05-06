/**
 * Fix bare 'layers/ui/components/ui/...' imports to relative paths.
 *
 * The shadcn-vue CLI resolves the 'ui' alias from components.json literally,
 * producing imports like `from 'layers/ui/components/ui/button'` which Vite
 * can't resolve. This script rewrites them to relative paths so the layer is
 * self-consistent and doesn't depend on a Vite alias.
 *
 * Run automatically by scripts/shadcn/index.ts after each `shadcn-vue add`.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const BASE = "layers/ui/components/ui";

function walk(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walk(full));
    } else if (full.endsWith(".vue") || full.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}

let count = 0;

for (const filepath of walk(BASE)) {
  const content = readFileSync(filepath, "utf-8");
  if (!content.includes("layers/ui/components/ui/")) continue;

  const updated = content.replace(
    /from ['"](layers\/ui\/components\/ui\/[^'"]+)['"]/g,
    (match, importPath) => {
      let rel = relative(dirname(filepath), importPath);
      if (!rel.startsWith(".")) rel = "./" + rel;
      return match.replace(importPath, rel);
    },
  );

  if (updated !== content) {
    writeFileSync(filepath, updated);
    console.log(`  Fixed: ${filepath}`);
    count++;
  }
}

console.log(`  ${count} file(s) fixed`);
