<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@sb/layer-ui/components/ui/alert-dialog';
import { Button } from '@sb/layer-ui/components/ui/button';
import { useClipboard } from '@vueuse/core';
import { Plus, Trash2 } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import { toast } from 'vue-sonner';
import { useDynamicUrls } from '~/composables/useDynamicUrls';

// Account-level home for permanent OBS URLs. This is where the URL *lives*;
// the per-match "Put on air" button is where it gets pointed. Splitting the two
// is the whole design — you copy the URL once, ever, and rebind every match.

const { urls, loaded, refresh, create, remove, urlFor } = useDynamicUrls();

onMounted(refresh);

const creating = ref(false);
const onCreate = async () => {
  creating.value = true;
  const row = await create();
  creating.value = false;
  if (!row) {
    toast.error("Couldn't create an OBS URL");
    return;
  }
  toast.success('OBS URL created');
  navigateTo(`/d/${row.id}`);
};

// Open-state and delete-target are separate refs on purpose. Folding them into
// one meant that clicking AlertDialogAction — which closes the dialog itself —
// nulled the target before the confirm handler read it, so the delete silently
// did nothing. Closing must never clear what we're about to act on.
const deleteTarget = ref<{ id: string; name: string } | null>(null);
const deleteOpen = ref(false);
const deleting = ref(false);

const askDelete = (url: { id: string; name: string }) => {
  deleteTarget.value = { id: url.id, name: url.name };
  deleteOpen.value = true;
};

const onConfirmDelete = async () => {
  const target = deleteTarget.value;
  if (!target || deleting.value) return;
  deleting.value = true;
  const ok = await remove(target.id);
  deleting.value = false;
  deleteOpen.value = false;
  deleteTarget.value = null;
  toast[ok ? 'success' : 'error'](
    ok ? 'OBS URL deleted' : "Couldn't delete that URL"
  );
};

const { copy: clipboardCopy } = useClipboard({ legacy: true });
const copy = async (id: string) => {
  await clipboardCopy(urlFor(id));
  toast.success('OBS URL copied');
};
</script>

<template>
  <section class="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
    <div>
      <h2 class="text-lg font-semibold">Stream setup</h2>
      <p class="text-sm text-muted-foreground">
        A permanent URL for OBS. Paste it into a browser source once, then point
        it at whichever match should be on air.
      </p>
    </div>

    <div
      v-if="loaded && urls.length === 0"
      class="text-sm text-muted-foreground"
    >
      You don't have one yet.
    </div>

    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="u in urls"
        :key="u.id"
        class="flex items-center gap-3 rounded-md border border-border bg-surface p-3"
      >
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-semibold">{{ u.name }}</span>
          <span
            class="mt-0.5 block truncate font-mono text-[11px] text-fg-muted"
          >
            {{ urlFor(u.id) }}
          </span>
        </span>
        <Button type="button" variant="ghost" size="sm" @click="copy(u.id)">
          Copy
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          @click="navigateTo(`/d/${u.id}`)"
        >
          Manage
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Delete this OBS URL"
          @click="askDelete(u)"
        >
          <Trash2 class="size-4" />
        </Button>
      </li>
    </ul>

    <Button type="button" :disabled="creating" @click="onCreate">
      <Plus class="size-4" />
      {{ urls.length === 0 ? 'Create my OBS URL' : 'Add another URL' }}
    </Button>

    <!-- Deleting strands whatever is already pasted into OBS, and the id can't
         be recovered — that's worth a confirm even though rebinding isn't. -->
    <AlertDialog v-model:open="deleteOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this OBS URL?</AlertDialogTitle>
          <AlertDialogDescription>
            <span v-if="deleteTarget" class="font-medium text-foreground">
              {{ deleteTarget.name }}
            </span>
            — any OBS browser source using it will go blank, and the URL can't
            be recovered. You'd have to paste a new one into OBS.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleting">Cancel</AlertDialogCancel>
          <AlertDialogAction
            :disabled="deleting"
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="onConfirmDelete"
          >
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>
