<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  ProgressIndicator,
  ProgressRoot,
  type ProgressRootProps,
} from "reka-ui";
import { cn } from "@sb/layer-ui/lib/utils";

const props = defineProps<
  ProgressRootProps & { class?: HTMLAttributes["class"] }
>();

const delegatedProps = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <ProgressRoot
    v-bind="delegatedProps"
    :class="
      cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-primary/20',
        props.class,
      )
    "
  >
    <ProgressIndicator
      class="h-full w-full flex-1 bg-primary transition-all"
      :style="`transform: translateX(-${100 - (modelValue ?? 0)}%);`"
    />
  </ProgressRoot>
</template>
