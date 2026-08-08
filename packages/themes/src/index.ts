// @sb/themes — registry of default themes.
//
// Each theme is a Vue component that accepts a common prop interface.
// In v1.x we'll add support for plain HTML+CSS themes with data-bind
// attributes, so contributors don't need to know Vue. For now, Vue SFCs
// are the canonical authoring format.

import type { RacquetConfig, RacquetState } from '@sb/engine';
import type { Component } from 'vue';
import ArenaBoard from './arena-board/index.vue';
import BroadcastClassic from './broadcast-classic/index.vue';
import Filmable from './filmable/index.vue';
import MinimalBug from './minimal-bug/index.vue';
import MinimalTypographic from './minimal-typographic/index.vue';
import ScoreBug from './score-bug/index.vue';
import Scorecard from './scorecard/index.vue';
import TopRibbon from './top-ribbon/index.vue';
import TourCard from './tour-card/index.vue';
import VerticalBoard from './vertical-board/index.vue';
import VerticalStack from './vertical-stack/index.vue';

export type ThemeSurface = 'overlay' | 'scoreboard';

export type ThemeProps = {
  state: RacquetState;
  config: RacquetConfig;
  teamNames: { a: string; b: string };
  /**
   * Doubles partner names per engine slot. Preferred over splitting
   * `teamNames` on " / " — that split depends on the joined string staying in
   * lockstep with the `players` column, which older matches don't. Optional so
   * singles callers and previews can omit it.
   */
  players?: { a1: string; a2: string; b1: string; b2: string };
  meta?: {
    sport?: string;
    sportLabel?: string;
    courtLabel?: string | null;
    round?: string | null;
    category?: string | null;
    venue?: string | null;
    sponsorName?: string | null;
    /**
     * Short per-side codes for the plate small surfaces render instead of a
     * name ("INA", "AXE"). Themes derive a code from the name when this is
     * absent, so nothing depends on it being set — it exists so an operator can
     * correct a bad guess, and as the seam richer side badges (flags, club
     * crests, per E2.5 branding) hang off later.
     */
    codes?: { a?: string | null; b?: string | null } | null;
    // Suppress the LIVE pill. Used by the post-game render page where the
    // overlay is being burned into recorded video — "LIVE" would be a lie.
    // Defaults to live (undefined / true).
    isLive?: boolean;
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
  'tour-card': {
    component: TourCard,
    manifest: {
      id: 'tour-card',
      name: 'Tour Card',
      description:
        'World-tour lower third — boxed per-game cells, code plates, flat broadcast ink.',
      author: 'Scoreboard core team',
      license: 'MIT',
      version: '1.0.0',
      supports: ['overlay'],
      supportedSports: ['badminton', 'tennis', 'pickleball', 'table-tennis'],
      bundleSizeBytes: 0,
    },
  },
  'score-bug': {
    component: ScoreBug,
    manifest: {
      id: 'score-bug',
      name: 'Score Bug',
      description:
        'Compact stacked corner bug (300px) with team codes and game cells — the TV-feed footprint.',
      author: 'Scoreboard core team',
      license: 'MIT',
      version: '1.0.0',
      supports: ['overlay'],
      supportedSports: ['badminton', 'tennis', 'pickleball', 'table-tennis'],
      bundleSizeBytes: 0,
    },
  },
  'arena-board': {
    component: ArenaBoard,
    manifest: {
      id: 'arena-board',
      name: 'Arena Board',
      description:
        'Official scoring-table board — row per team, labelled columns, framed digit windows.',
      author: 'Scoreboard core team',
      license: 'MIT',
      version: '1.0.0',
      supports: ['scoreboard'],
      supportedSports: ['badminton', 'tennis', 'pickleball', 'table-tennis'],
      bundleSizeBytes: 0,
    },
  },
  'vertical-board': {
    component: VerticalBoard,
    manifest: {
      id: 'vertical-board',
      name: 'Vertical Board',
      description:
        'Full-bleed team panels for a tablet propped courtside. Portrait-first, works landscape.',
      author: 'Scoreboard core team',
      license: 'MIT',
      version: '1.0.0',
      supports: ['scoreboard'],
      supportedSports: ['badminton', 'tennis', 'pickleball', 'table-tennis'],
      bundleSizeBytes: 0,
    },
  },
  'broadcast-classic': {
    component: BroadcastClassic,
    manifest: {
      id: 'broadcast-classic',
      name: 'Broadcast Classic',
      description: 'ESPN-style lower-third for OBS overlay.',
      author: 'Scoreboard core team',
      license: 'MIT',
      version: '1.0.0',
      supports: ['overlay'],
      supportedSports: ['badminton', 'tennis', 'pickleball', 'table-tennis'],
      bundleSizeBytes: 0,
    },
  },
  'minimal-bug': {
    component: MinimalBug,
    manifest: {
      id: 'minimal-bug',
      name: 'Minimal Bug',
      description: 'Tiny corner overlay for understated streams.',
      author: 'Scoreboard core team',
      license: 'MIT',
      version: '1.0.0',
      supports: ['overlay'],
      supportedSports: ['badminton', 'tennis', 'pickleball', 'table-tennis'],
      bundleSizeBytes: 0,
    },
  },
  'top-ribbon': {
    component: TopRibbon,
    manifest: {
      id: 'top-ribbon',
      name: 'Top Ribbon',
      description: 'Center-stage scoreboard banner pinned to the top.',
      author: 'Scoreboard core team',
      license: 'MIT',
      version: '1.0.0',
      supports: ['overlay'],
      supportedSports: ['badminton', 'tennis', 'pickleball', 'table-tennis'],
      bundleSizeBytes: 0,
    },
  },
  filmable: {
    component: Filmable,
    manifest: {
      id: 'filmable',
      name: 'Filmable',
      description:
        'High-contrast scoreboard for tablets/TVs filmed by a camera.',
      author: 'Scoreboard core team',
      license: 'MIT',
      version: '1.0.0',
      supports: ['scoreboard'],
      supportedSports: ['badminton', 'tennis', 'pickleball', 'table-tennis'],
      bundleSizeBytes: 0,
    },
  },
  'minimal-typographic': {
    component: MinimalTypographic,
    manifest: {
      id: 'minimal-typographic',
      name: 'Minimal Typographic',
      description: 'Light, editorial, big-number scoreboard.',
      author: 'Scoreboard core team',
      license: 'MIT',
      version: '1.0.0',
      supports: ['scoreboard'],
      supportedSports: ['badminton', 'tennis', 'pickleball', 'table-tennis'],
      bundleSizeBytes: 0,
    },
  },
  'vertical-stack': {
    component: VerticalStack,
    manifest: {
      id: 'vertical-stack',
      name: 'Vertical Stack',
      description:
        'Bottom-center stacked overlay sized for portrait streams (TikTok / Reels / IG Live).',
      author: 'Scoreboard core team',
      license: 'MIT',
      version: '1.0.0',
      supports: ['overlay'],
      supportedSports: ['badminton', 'tennis', 'pickleball', 'table-tennis'],
      bundleSizeBytes: 0,
    },
  },
  scorecard: {
    component: Scorecard,
    manifest: {
      id: 'scorecard',
      name: 'Scorecard',
      description:
        'Tournament-program-style scoreboard with a column per game and per-team rows.',
      author: 'Scoreboard core team',
      license: 'MIT',
      version: '1.0.0',
      supports: ['scoreboard'],
      supportedSports: ['badminton', 'tennis', 'pickleball', 'table-tennis'],
      bundleSizeBytes: 0,
    },
  },
};

export const defaultThemes = {
  overlay: 'broadcast-classic',
  scoreboard: 'filmable',
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
