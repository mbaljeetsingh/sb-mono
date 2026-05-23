// Renders the Vue email templates to plain HTML and writes them into
// `supabase/templates/` — that directory is what Supabase Auth uploads
// to GoTrue. Run with `pnpm render-emails` from the repo root.
//
// Implemented as a vitest test because vitest already resolves .vue SFCs
// (which `tsx` alone cannot). It writes files as a side effect.

import { test } from "vitest";
import { render } from "@vue-email/render";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Confirmation from "./templates/Confirmation.vue";
import EmailChange from "./templates/EmailChange.vue";
import Invite from "./templates/Invite.vue";
import MagicLink from "./templates/MagicLink.vue";
import Reauthentication from "./templates/Reauthentication.vue";
import Recovery from "./templates/Recovery.vue";

const here = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(here, "../../../supabase/templates");

const templates = {
  "confirmation.html": Confirmation,
  "email_change.html": EmailChange,
  "invite.html": Invite,
  "magic_link.html": MagicLink,
  "reauthentication.html": Reauthentication,
  "recovery.html": Recovery,
} as const;

test("generate supabase email templates", async () => {
  await fs.mkdir(outputDir, { recursive: true });

  for (const [filename, component] of Object.entries(templates)) {
    const html = await render(component, {}, { pretty: true });
    await fs.writeFile(path.join(outputDir, filename), html);
    console.log(`✓ ${filename}`);
  }
});
