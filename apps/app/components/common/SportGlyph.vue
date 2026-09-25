<script setup lang="ts">
// The app's sport icon. A thin wrapper over @sb/themes' sport-icon, which
// holds the one copy of every sport's mark (Material Symbols / Material
// Design Icons, Apache 2.0 — see that file and THIRD_PARTY_NOTICES.md) so
// /new, the match list and the broadcast themes all draw the same icon.
//
// Size and colour come from the parent, same as any lucide icon
// (`class="size-4 text-court-badminton-accent"`).

import SportIcon from '@sb/themes/sport-icon';
import type { SportId } from '~/lib/sports';

withDefaults(defineProps<{ sport: SportId; decorative?: boolean }>(), {
  decorative: true,
});
</script>

<template>
  <SportIcon :sport="sport" :decorative="decorative" />
</template>
