#!/usr/bin/env node
/**
 * Update all shadcn-vue components to latest versions.
 *
 * Handles monorepo quirks: temp tsconfig, import fixup, local patches, cleanup.
 *
 * Usage:
 *   npx tsx ./scripts/shadcn/index.ts                # full update
 *   npx tsx ./scripts/shadcn/index.ts --patches-only # re-apply patches without fetching
 */

import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
const patchesOnly = process.argv.includes("--patches-only");

function run(label: string, fn: () => void) {
  console.log(`\n→ ${label}`);
  fn();
}

function exec(script: string) {
  execSync(`npx tsx ${join(__dirname, script)}`, {
    stdio: "inherit",
    cwd: ROOT,
  });
}

// 1. Fetch latest components (unless --patches-only)
if (!patchesOnly) {
  run("Creating temp tsconfig.json", () => {
    writeFileSync(
      join(ROOT, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@/*": ["./apps/app/*"],
            "layers/ui/*": ["./layers/ui/*"],
          },
        },
      }),
    );
  });

  run("Fetching latest components", () => {
    // Pinned to 2.4.0 — 2.5.0 has catalog: protocol bug.
    // The CLI tries to `pnpm add` deps at workspace root after writing files —
    // this fails in monorepos but the component files are already written, so
    // we tolerate the install failure.
    try {
      execSync("pnpm dlx shadcn-vue@2.4.0 add --all --overwrite", {
        stdio: "inherit",
        cwd: ROOT,
        env: {
          ...process.env,
          npm_config_ignore_workspace_root_check: "true",
        },
      });
    } catch {
      console.log(
        "  ⚠ shadcn-vue install step failed (expected in monorepo — deps already in apps)",
      );
    }
  });

  run("Fixing bare layer imports → relative paths", () => {
    exec("fix-imports.ts");
  });

  run("Removing temp tsconfig.json", () => {
    const tsconfig = join(ROOT, "tsconfig.json");
    if (existsSync(tsconfig)) unlinkSync(tsconfig);
  });
}

// 2. Apply local patches
run("Applying patches", () => {
  exec("apply-patches.ts");
});

console.log(
  "\n✓ Done! Run `pnpm typecheck` and start the dev server to verify.\n",
);
