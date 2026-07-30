<script setup lang="ts">
// Shared QR dialog — opens with a single URL, renders a large scannable code,
// shows the URL underneath, exposes Copy. Reused from the primary "Get set
// up" Control step and the per-row thumbnails in the URL-list disclosure.

import { computed } from 'vue';
import QrcodeVue from 'qrcode.vue';
import { useClipboard } from '@vueuse/core';
import { Clipboard } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Button } from '@sb/layer-ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@sb/layer-ui/components/ui/dialog';

const props = defineProps<{
  open: boolean;
  url: string;
  title: string;
  description?: string;
  sensitive?: boolean;
}>();

const emit = defineEmits<(e: 'update:open', v: boolean) => void>();

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
});

const { copy } = useClipboard({ legacy: true });
const onCopy = async () => {
  await copy(props.url);
  toast.success(`${props.title} URL copied`);
};
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          {{ title }}
          <span
            v-if="sensitive"
            class="px-1.5 py-0.5 rounded-sm bg-warning-soft text-warning text-[10px] font-bold tracking-[0.06em]"
          >
            Sensitive
          </span>
        </DialogTitle>
        <DialogDescription v-if="description">
          {{ description }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col items-center gap-4 pt-2">
        <div class="rounded-md bg-white p-3 shadow-sm">
          <!-- Bumping render-size + level=H gives us a code that still
               scans cleanly when shown across a room (or zoomed slightly
               via the operator's phone camera). -->
          <QrcodeVue
            :value="url"
            :size="240"
            level="H"
            :margin="0"
            render-as="svg"
          />
        </div>

        <div
          class="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-[11px] break-all text-fg-muted"
        >
          {{ url }}
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          class="w-full"
          @click="onCopy"
        >
          <Clipboard class="mr-2 size-4" />
          Copy URL
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
