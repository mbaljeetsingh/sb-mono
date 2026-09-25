<script setup lang="ts">
// THE sport icon — the one set of per-sport marks used everywhere a sport is
// shown: /new's sport picker, the match list, and every broadcast theme
// header. The app's SportGlyph is a thin wrapper around this file, so there
// is exactly one copy of each shape; do not add sport artwork anywhere else.
//
// Lives in @sb/themes (not the app) because themes render inside OBS
// overlays and can't import from apps/app, while the app can import from
// here.
//
// Sources — both Apache License 2.0, redistributed unmodified apart from
// wrapping (see THIRD_PARTY_NOTICES.md at the repo root):
//  - badminton, padel, pickleball, tennis: Material Symbols (filled),
//    © Google — https://github.com/google/material-design-icons
//    (LICENSE: https://github.com/google/material-design-icons/blob/master/LICENSE)
//  - table-tennis, squash: Material Design Icons, © Pictogrammers —
//    https://github.com/Templarian/MaterialDesign
//    (LICENSE: https://github.com/Templarian/MaterialDesign/blob/master/LICENSE)
//
// Filled marks on a 24×24 grid, painted with currentColor. Size comes from
// the parent: 1em by default (theme headers size it with font-size), or any
// explicit width/height class (`class="size-4"`) in the app.

import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ sport: string | null | undefined; decorative?: boolean }>(),
  { decorative: true }
);

const PATHS: Record<string, string> = {
  badminton:
    'm17.1 8.05l-3.175-3.175L20.3 1.85l.45 4.4zm2.213 1.913q-.463-.088-.763-.438l-.35-.375l2.725-1.3l.05.5q.075.475-.137.888t-.638.612t-.887.113M2 7.5q0-1.65.938-2.575T5.575 4q1.775 0 3.475.675t2.975 1.95q.775.775 1.238 1.75t.462 2.075q0 .8-.237 1.55t-.738 1.375l7.225 7.225l-1.4 1.4l-7.225-7.225q-.65.475-1.387.737t-1.538.238q-1.2-.025-2.262-.575T4.3 13.7q-1.125-1.275-1.713-2.875T2 7.5',
  tennis:
    'M3.425 20L2 18.6l4.1-4.1q.775-.775 1.063-1.937T7.45 9q0-1.45.65-2.85t1.85-2.6q2.275-2.275 5.025-2.575T19.5 2.5q1.8 1.8 1.5 4.55t-2.55 5q-1.2 1.2-2.6 1.85t-2.85.65q-2.425 0-3.55.275T7.525 15.9zm6.875-8.35q1.175 1.15 3.175.85t3.575-1.875q1.6-1.6 1.913-3.588T18.1 3.925q-1.2-1.2-3.137-.9t-3.563 1.9Q9.825 6.5 9.488 8.488t.812 3.162m4.875 10.175Q14 20.65 14 19t1.175-2.825T18 15t2.825 1.175T22 19t-1.175 2.825T18 23t-2.825-1.175',
  padel:
    'm18.6 22l-5.825-5.8l-.7.7q-.575.575-1.312.875t-1.513.3t-1.525-.3T6.4 16.9l-4.225-4.25q-.575-.575-.875-1.312T1 9.825t.3-1.512T2.175 7L5 4.175Q5.575 3.6 6.313 3.3T7.825 3t1.513.3t1.312.875L14.9 8.4q.575.575.875 1.325t.3 1.525t-.3 1.513t-.875 1.312l-.7.7L20 20.6zM5.175 11.1q.325 0 .538-.212t.212-.538t-.212-.537t-.538-.213t-.537.213t-.213.537t.213.538t.537.212m1.6-1.575q.325 0 .538-.212t.212-.538t-.213-.537t-.537-.213t-.537.213t-.213.537t.213.538t.537.212m.175 3.35q.325 0 .538-.213t.212-.537t-.213-.537t-.537-.213t-.537.213t-.213.537t.213.538t.537.212m1.4-4.95q.325 0 .538-.213t.212-.537t-.213-.537t-.537-.213t-.537.213t-.213.537t.213.538t.537.212m.2 3.375q.325 0 .537-.213t.213-.537t-.213-.537T8.55 9.8t-.537.213t-.213.537t.213.538t.537.212m.15 3.35q.325 0 .538-.213t.212-.537t-.212-.537t-.538-.213t-.537.213t-.213.537t.213.538t.537.212m1.425-4.95q.325 0 .538-.213t.212-.537t-.213-.537t-.537-.213t-.537.213t-.213.537t.213.538t.537.212m.175 3.35q.325 0 .538-.213t.212-.537t-.213-.537t-.537-.213t-.537.213t-.213.537t.213.538t.537.212m1.6-1.6q.325 0 .538-.212t.212-.538t-.213-.537t-.537-.213t-.537.213t-.213.537t.213.538t.537.212M19.5 9q-1.45 0-2.475-1.025T16 5.5t1.025-2.475T19.5 2t2.475 1.025T23 5.5t-1.025 2.475T19.5 9',
  pickleball:
    'M18.575 22L12.7 16.125q-.725.65-1.612.95t-1.788.3q-1 0-1.937-.375t-1.688-1.125l-3.8-3.775q-.425-.425-.65-.987T1 9.975t.225-1.137t.65-.988L5.85 3.875q.425-.425.988-.65T7.974 3t1.138.225t.987.65l3.775 3.8q.75.75 1.125 1.688t.375 1.937q0 .9-.312 1.788T14.1 14.7l5.9 5.9zM19.5 9q-1.45 0-2.475-1.025T16 5.5t1.025-2.475T19.5 2t2.475 1.025T23 5.5t-1.025 2.475T19.5 9',
  'table-tennis':
    'M18.5 14c1.4 0 2.5 1.1 2.5 2.5S19.9 19 18.5 19S16 17.9 16 16.5s1.1-2.5 2.5-2.5M7 15s1 1 1 2v3.5c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5V17c0-1 1-2 1-2zm1-1h3s5 0 5-5s-4-7-6.5-7S3 4 3 9s5 5 5 5',
  squash:
    'M18.5 16c1.4 0 2.5 1.1 2.5 2.5S19.9 21 18.5 21S16 19.9 16 18.5s1.1-2.5 2.5-2.5m-8-15C3 1 3 3.7 3 9.8c0 3.4 3.4 7.1 6 8.3V23h3v-4.9c2.6-1.2 6-4.9 6-8.3C18 3.6 18 1 10.5 1m4.9 3.2c.3.4.4 1 .5 1.8H15V3.8c.2.1.3.3.4.4m.6 5.6v.2h-1V7h1zM14 14h-3v-3h3zm-7 0v-3h3v3zM5 9.8V7h1v3H5zM7 7h3v3H7zm4-4c1.4 0 2.4.2 3 .3V6h-3zm-1 3H7V3.4c.6-.2 1.6-.4 3-.4zm1 4V7h3v3zM6 3.8V6h-.9c.1-.8.2-1.4.5-1.8zM5.2 11H6v1.7c-.3-.6-.6-1.1-.8-1.7M8 15h2v1.3l-.2-.1C9.2 16 8.6 15.5 8 15m3.2 1.3H11V15h2c-.6.5-1.2 1-1.8 1.3m3.8-3.6V11h.8c-.2.5-.5 1.1-.8 1.7',
};

const LABELS: Record<string, string> = {
  badminton: 'Badminton',
  tennis: 'Tennis',
  padel: 'Padel',
  pickleball: 'Pickleball',
  'table-tennis': 'Table tennis',
  squash: 'Squash',
};

const path = computed(() => (props.sport ? PATHS[props.sport] : undefined));
</script>

<template>
  <svg
    v-if="path"
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="currentColor"
    class="inline-block shrink-0"
    :aria-hidden="decorative ? 'true' : undefined"
    :role="decorative ? undefined : 'img'"
    :aria-label="decorative ? undefined : LABELS[sport ?? '']"
  >
    <path :d="path" />
  </svg>
</template>
