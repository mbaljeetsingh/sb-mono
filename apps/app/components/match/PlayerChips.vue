<script setup lang="ts">
import { useElementSize, useEventListener } from '@vueuse/core';
import { computed, ref } from 'vue';
import PlayerChip from '~/components/match/PlayerChip.vue';
import { POINTER_SLOP_PX, suggestNames } from '~/lib/recent-players';

// Inline suggestion row under a name field on /new. Deliberately NOT a
// combobox: the chips sit in the page flow, so the operator can fill all four
// doubles names without the keyboard ever opening — no layout shift, no
// dropdown fighting the keyboard for the bottom half of a phone screen. When
// they do type, this same row filters in place rather than a popover
// appearing over it.
//
// Visibility is derived purely from the suggestion list being non-empty, with
// no focus tracking. That's what keeps it robust: a focus/blur rule would hide
// the row on blur *before* the tap that caused the blur could register, the
// classic autocomplete race. Here `exclude` carries all four name fields
// including this one, so a field holding an exact stored name filters that
// name out, the row empties, and it collapses on its own.

const props = defineProps<{
  /** Full MRU list from `useRecentPlayers`. */
  list: string[];
  /** This field's current text. Filters the row as the operator types. */
  query: string;
  /** Every name field in the match, this one included. */
  exclude: string[];
  /** Describes the field this row belongs to, for screen readers. */
  label: string;
  /** Show the long-press hint. Set on the first row only, until first removal. */
  showHint?: boolean;
}>();

defineEmits<{
  (e: 'pick', name: string): void;
  (e: 'remove', name: string): void;
}>();

const suggestions = computed(() =>
  suggestNames(props.list, props.query, props.exclude)
);

// Drag-to-pan, mouse only. Touch already scrolls this row natively with
// momentum, and hijacking pointermove there would replace good native
// behaviour with a worse hand-rolled copy — so the handlers bail on any
// non-mouse pointer.
//
// The reason this needs care rather than being three lines: a drag that starts
// on a chip still ends in a `click`, which would fill the field with whatever
// name happened to be under the cursor when you finished panning. Two guards
// handle it — onLongPress cancels itself once the pointer passes its distance
// threshold (so panning can't delete a name either), and `moved` swallows the
// trailing click in the capture phase before it reaches the chip.
const rowEl = ref<HTMLElement | null>(null);
const startX = ref(0);
const startScroll = ref(0);
const dragging = ref(false);
const moved = ref(false);

// Whether the row actually overflows. Drives the cursor affordance only —
// the gesture itself re-checks at pointerdown, where the measurement is
// guaranteed current. `width` from useElementSize is the reactive trigger
// (scrollWidth isn't reactive on its own), and the chip count matters too
// since filtering changes the row's contents without resizing the container.
const { width } = useElementSize(rowEl);
const isPannable = computed(() => {
  void width.value;
  void suggestions.value.length;
  const el = rowEl.value;
  return !!el && el.scrollWidth > el.clientWidth;
});

const onPointerDown = (e: PointerEvent) => {
  // Cleared before the pointer-type check, not after. Bailing early used to
  // leave a stale `moved` from a previous mouse drag, and on a hybrid
  // touch-and-mouse laptop the next finger tap would be swallowed by it.
  moved.value = false;
  if (e.pointerType !== 'mouse' || !rowEl.value) return;
  // Nothing to pan means no drag, and — more importantly — no click-swallowing.
  // Without this a short row still armed `moved` on a few px of cursor drift,
  // so an ordinary click on a chip silently did nothing.
  if (rowEl.value.scrollWidth <= rowEl.value.clientWidth) return;
  dragging.value = true;
  startX.value = e.clientX;
  startScroll.value = rowEl.value.scrollLeft;
};

// Bound to the window, not the row: releasing outside the row (or dragging
// past its edge, which is exactly what panning to the end feels like) must
// still move and still end the drag.
useEventListener(globalThis.window, 'pointermove', (e: PointerEvent) => {
  if (!dragging.value || !rowEl.value) return;
  const dx = e.clientX - startX.value;
  // Shared slop so a shaky click isn't read as a drag and swallowed — and so
  // this threshold and onLongPress's cancel threshold are the same number.
  if (Math.abs(dx) > POINTER_SLOP_PX) moved.value = true;
  rowEl.value.scrollLeft = startScroll.value - dx;
});

useEventListener(globalThis.window, 'pointerup', () => {
  dragging.value = false;
});

const onClickCapture = (e: MouseEvent) => {
  if (!moved.value) return;
  moved.value = false;
  e.stopPropagation();
  e.preventDefault();
};
</script>

<template>
  <div v-if="suggestions.length" class="mt-2">
    <!-- One scrolling line on every viewport: touch swipes it, a mouse drags
         it (see the pan handlers above). A single line keeps the next field on
         screen, which a wrapping row of ten names does not — and it means the
         row behaves the same everywhere instead of reflowing into a different
         shape at a breakpoint. `cursor-grab` is the only affordance a mouse
         user gets that the row is draggable, so it's load-bearing, not
         decoration — and gated on isPannable, since promising a drag on a row
         that already fits is a worse lie than showing no cursor at all. -->
    <div
      ref="rowEl"
      role="group"
      :aria-label="label"
      class="flex gap-2 overflow-x-auto select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      :class="isPannable ? 'md:cursor-grab md:active:cursor-grabbing' : ''"
      @pointerdown="onPointerDown"
      @click.capture="onClickCapture"
    >
      <PlayerChip
        v-for="name in suggestions"
        :key="name"
        :name="name"
        @pick="$emit('pick', name)"
        @remove="$emit('remove', name)"
      />
    </div>
    <p v-if="showHint" class="mt-1.5 text-[11px] text-fg-subtle">
      Long-press a name to remove it
    </p>
  </div>
</template>
