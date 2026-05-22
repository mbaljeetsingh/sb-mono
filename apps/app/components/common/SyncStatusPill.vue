<script setup lang="ts">
import { useSyncStatus } from "@sb/layer-app-base/composables/useSyncStatus";
import { Badge } from "@sb/layer-ui/components/ui/badge";
import { useOnline } from "@vueuse/core";
import { CloudOff, CloudUpload } from "lucide-vue-next";

const { total, hasPending } = useSyncStatus();
const online = useOnline();
</script>

<template>
  <Badge
    v-if="hasPending"
    variant="outline"
    :class="
      online
        ? 'gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'gap-1 border-destructive/40 bg-destructive/10 text-destructive'
    "
  >
    <CloudUpload v-if="online" class="size-3.5" />
    <CloudOff v-else class="size-3.5" />
    <span class="text-xs font-medium">
      {{ online ? `Syncing ${total}` : `Offline — ${total} queued` }}
    </span>
  </Badge>
</template>
