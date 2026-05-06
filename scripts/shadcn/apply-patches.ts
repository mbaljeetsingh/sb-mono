/**
 * Apply local patches to shadcn-vue components after update.
 *
 * Reads patches.json and applies find/replace operations to keep our
 * customizations intact when upstream changes would break the UI.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATCHES_FILE = join(__dirname, "patches.json");
const UI_DIR = "layers/ui/components/ui";

type Patch = { file: string; find: string; replace: string; reason: string };

const patches: Patch[] = JSON.parse(readFileSync(PATCHES_FILE, "utf-8"));

let applied = 0;
let skipped = 0;

for (const patch of patches) {
  const filepath = join(UI_DIR, patch.file);

  if (!existsSync(filepath)) {
    console.log(`  SKIP (not found): ${patch.file}`);
    skipped++;
    continue;
  }

  const content = readFileSync(filepath, "utf-8");

  if (!content.includes(patch.find)) {
    if (content.includes(patch.replace)) {
      console.log(`  OK (already applied): ${patch.file}`);
    } else {
      console.log(
        `  WARN (pattern not found): ${patch.file} — ${patch.reason}`,
      );
      skipped++;
    }
    continue;
  }

  const updated = content.replace(patch.find, patch.replace);
  writeFileSync(filepath, updated);
  console.log(`  Patched: ${patch.file} — ${patch.reason}`);
  applied++;
}

console.log(`  ${applied} patch(es) applied, ${skipped} skipped`);
