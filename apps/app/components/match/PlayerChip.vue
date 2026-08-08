<script setup lang="ts">
import { Button } from '@sb/layer-ui/components/ui/button';
import { onLongPress, useVibrate } from '@vueuse/core';
import { ref } from 'vue';
import { POINTER_SLOP_PX } from '~/lib/recent-players';

// One suggestion chip. Its own component purely so each chip owns an element
// ref for `onLongPress` — the composable binds to a single element, and
// @vueuse/components (which ships the `v-on-long-press` directive) isn't a
// dependency here.
//
// Tap fills the field; long-press removes the name from the suggestion list.
// The gesture matches /control's Undo button, which is the most safety-
// critical control in the app — if long-press is trustworthy for correcting a
// live score, it's trustworthy for this.

const props = defineProps<{ name: string }>();

const emit = defineEmits<{
  (e: 'pick', name: string): void;
  (e: 'remove', name: string): void;
}>();

const { vibrate } = useVibrate();

const el = ref<HTMLElement | null>(null);

// Two lessons copied from /control's Undo long-press, both of which cost real
// bugs there:
//
// 1. The short tap must come from a native `click`, never onLongPress's
//    `onMouseUp` option — that fires from pointerup and bails whenever
//    onLongPress cleared its state, which it does as soon as the pointer
//    drifts past `distanceThreshold`. A thumb on a phone drifts constantly,
//    so taps get silently swallowed. A real click also keeps keyboard access
//    (Enter/Space fire click, never pointerup).
// 2. iOS still delivers a click after the long-press fires — swallow that one
//    so removing a name doesn't also fill the field with it. Reset on every
//    new press so a long-press that ends off the chip (no click) can't poison
//    the next tap.
const longPressed = ref(false);

// distanceThreshold is passed explicitly rather than left on VueUse's 10px
// default so it matches the row's pan slop exactly. Any gap between the two
// is a band where the row swallows the tap as a drag while the press still
// counts as a hold — panning would delete a name.
onLongPress(
  el,
  () => {
    vibrate(15);
    longPressed.value = true;
    emit('remove', props.name);
  },
  { delay: 400, distanceThreshold: POINTER_SLOP_PX }
);

const onClick = () => {
  if (longPressed.value) {
    longPressed.value = false;
    return;
  }
  emit('pick', props.name);
};

// Keyboard equivalent of the long-press. Without it a chip is reachable and
// pickable by keyboard but not removable, so a keyboard-only operator can
// never prune a mistyped name — the exact thing removal exists for. Delete and
// Backspace are the conventional keys for dismissing a token/chip.
const onRemoveKey = (e: KeyboardEvent) => {
  e.preventDefault();
  emit('remove', props.name);
};
</script>

<template>
  <Button
    ref="el"
    type="button"
    variant="outline"
    size="sm"
    class="shrink-0 rounded-full font-normal select-none"
    :title="`Tap to use · long-press (or Delete) to remove ${name}`"
    @pointerdown="longPressed = false"
    @keydown.delete="onRemoveKey"
    @keydown.backspace="onRemoveKey"
    @click="onClick"
  >
    {{ name }}
  </Button>
</template>
