// @sb/themes — registry of default themes.
//
// Each theme is a Vue component that accepts a common prop interface.
// In v1.x we'll add support for plain HTML+CSS themes with data-bind
// attributes, so contributors don't need to know Vue. For now, Vue SFCs
// are the canonical authoring format.

import type { Component } from "vue";
import type { RacquetConfig, RacquetState } from "@sb/engine";
import BroadcastClassic from "./broadcast-classic/index.vue";
import Filmable from "./filmable/index.vue";
import MinimalBug from "./minimal-bug/index.vue";
import MinimalTypographic from "./minimal-typographic/index.vue";
import TopRibbon from "./top-ribbon/index.vue";

export type ThemeSurface = "overlay" | "scoreboard";

export type ThemeProps = {
  state: RacquetState;
  config: RacquetConfig;
  teamNames: { a: string; b: string };
  meta?: {
    sport?: string;
    sportLabel?: string;
    courtLabel?: string | null;
    round?: string | null;
    category?: string | null;
    venue?: string | null;
    sponsorName?: string | null;
  };
};

export type ThemeManifest = {
  id: string;
  name: string;
  description: string;
  author: string;
  license: string;
  version: string;
  supports: ThemeSurface[];
  supportedSports: string[];
  bundleSizeBytes: number;
};

type ThemeEntry = {
  manifest: ThemeManifest;
  component: Component;
};

export const themes: Record<string, ThemeEntry> = {
  "broadcast-classic": {
    component: BroadcastClassic,
    manifest: {
      id: "broadcast-classic",
      name: "Broadcast Classic",
      description: "ESPN-style lower-third for OBS overlay.",
      author: "Scoreboard core team",
      license: "MIT",
      version: "1.0.0",
      supports: ["overlay"],
      supportedSports: ["badminton", "tennis", "pickleball", "table-tennis"],
      bundleSizeBytes: 0,
    },
  },
  "minimal-bug": {
    component: MinimalBug,
    manifest: {
      id: "minimal-bug",
      name: "Minimal Bug",
      description: "Tiny corner overlay for understated streams.",
      author: "Scoreboard core team",
      license: "MIT",
      version: "1.0.0",
      supports: ["overlay"],
      supportedSports: ["badminton", "tennis", "pickleball", "table-tennis"],
      bundleSizeBytes: 0,
    },
  },
  "top-ribbon": {
    component: TopRibbon,
    manifest: {
      id: "top-ribbon",
      name: "Top Ribbon",
      description: "Center-stage scoreboard banner pinned to the top.",
      author: "Scoreboard core team",
      license: "MIT",
      version: "1.0.0",
      supports: ["overlay"],
      supportedSports: ["badminton", "tennis", "pickleball", "table-tennis"],
      bundleSizeBytes: 0,
    },
  },
  filmable: {
    component: Filmable,
    manifest: {
      id: "filmable",
      name: "Filmable",
      description:
        "High-contrast scoreboard for tablets/TVs filmed by a camera.",
      author: "Scoreboard core team",
      license: "MIT",
      version: "1.0.0",
      supports: ["scoreboard"],
      supportedSports: ["badminton", "tennis", "pickleball", "table-tennis"],
      bundleSizeBytes: 0,
    },
  },
  "minimal-typographic": {
    component: MinimalTypographic,
    manifest: {
      id: "minimal-typographic",
      name: "Minimal Typographic",
      description: "Light, editorial, big-number scoreboard.",
      author: "Scoreboard core team",
      license: "MIT",
      version: "1.0.0",
      supports: ["scoreboard"],
      supportedSports: ["badminton", "tennis", "pickleball", "table-tennis"],
      bundleSizeBytes: 0,
    },
  },
};

export const defaultThemes = {
  overlay: "broadcast-classic",
  scoreboard: "filmable",
} as const;

export const getTheme = (id: string | undefined, surface: ThemeSurface) => {
  const fallback = defaultThemes[surface];
  const entry = (id && themes[id]) || themes[fallback]!;
  // If the theme doesn't support this surface, fall back to the surface default.
  if (!entry.manifest.supports.includes(surface)) {
    return themes[fallback]!;
  }
  return entry;
};
