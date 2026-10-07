<script setup lang="ts">
/**
 * Account deletion. Apple requires in-app deletion wherever accounts can be
 * created and Play requires a deletion path; present on web too. Ported from
 * np-mono's DeleteAccountCard.
 *
 * What happens (see supabase/migrations/*_delete_my_account.sql):
 *   - avatar files are removed here first (storage rejects SQL deletes);
 *   - the delete_my_account RPC deletes the user's matches (events cascade)
 *     and the auth user, in one transaction;
 *   - this device's copies of those matches and the operator's saved player
 *     names are cleared, then the session is dropped.
 * The copy states this before the user confirms.
 */
import { Alert, AlertDescription } from '@sb/layer-ui/components/ui/alert';
import { Button } from '@sb/layer-ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sb/layer-ui/components/ui/dialog';
import { Input } from '@sb/layer-ui/components/ui/input';
import { Label } from '@sb/layer-ui/components/ui/label';
import { del } from 'idb-keyval';
import { Loader2, TriangleAlert } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useUserStore } from '~/stores/user';

const supabase = useSupabaseClient();
const userStore = useUserStore();

const isOpen = ref(false);
const isDeleting = ref(false);
const confirmText = ref('');
const errorMessage = ref<string | null>(null);

const CONFIRM_WORD = 'DELETE';
const canConfirm = computed(
  () => confirmText.value.trim().toUpperCase() === CONFIRM_WORD
);

// Device-local keys that hold this operator's data (see CLAUDE.md's
// localStorage list). sb:theme and sb:device-id are device settings, kept.
const LOCAL_PREFIXES = [
  'sb:recent-players',
  'sb:last-format',
  'sb:control-layout:',
  'sb:render-anchors:',
  'sb:dynamic:',
];

function open() {
  confirmText.value = '';
  errorMessage.value = null;
  isOpen.value = true;
}

async function removeAvatarFiles(userId: string) {
  // Best effort — the avatars bucket is public-read, so leftover files stay
  // fetchable, but a storage hiccup must not block the deletion asked for.
  try {
    const { data: files } = await supabase.storage.from('avatars').list(userId);
    if (files?.length) {
      await supabase.storage
        .from('avatars')
        .remove(files.map((file) => `${userId}/${file.name}`));
    }
  } catch (err) {
    console.warn('avatar cleanup:', err);
  }
}

async function clearLocalData(matchIds: string[]) {
  // Only the deleted matches' event logs — other (anonymous) matches scored
  // on this device may still hold unsynced points.
  await Promise.all(
    matchIds.flatMap((id) => [
      del(`sb:events:${id}`).catch(() => {}),
      del(`sb:tombstones:${id}`).catch(() => {}),
    ])
  );
  try {
    for (const key of Object.keys(localStorage)) {
      if (LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Storage unavailable (private mode) — nothing to clear.
  }
}

async function confirmDelete() {
  const userId = userStore.currentUser?.id;
  if (!canConfirm.value || isDeleting.value || !userId) return;
  isDeleting.value = true;
  errorMessage.value = null;

  try {
    // Read before deleting — afterwards there's no row to find them by.
    const { data: owned } = await supabase
      .from('matches')
      .select('id')
      .eq('owner_id', userId);
    const matchIds = (owned ?? []).map((row) => row.id);

    await removeAvatarFiles(userId);

    // Idempotent: a retry after a lost response finds nothing left to delete
    // and still succeeds, so the teardown below always runs.
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;

    await clearLocalData(matchIds);
    // Local scope: the server-side session died with the user row.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    userStore.clearData();
    isOpen.value = false;
    await navigateTo('/');
  } catch (err) {
    errorMessage.value =
      err instanceof Error
        ? err.message
        : 'Could not delete your account. Please try again.';
  } finally {
    isDeleting.value = false;
  }
}
</script>

<template>
  <section
    v-if="userStore.isAuthenticated"
    class="space-y-4 rounded-lg border border-destructive/40 bg-card p-6 shadow-sm"
  >
    <div>
      <h2 class="text-lg font-semibold text-destructive">Delete account</h2>
      <p class="text-sm text-muted-foreground">
        Permanently deletes your account and every match you own, including
        their scores. Shared overlay and scoreboard links for those matches stop
        working.
      </p>
    </div>
    <Button variant="destructive" @click="open">Delete account</Button>

    <Dialog v-model:open="isOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <TriangleAlert class="size-5 text-destructive" />
            Delete your account?
          </DialogTitle>
          <DialogDescription>This cannot be undone.</DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <ul
            class="list-disc space-y-1 pl-5 text-sm text-muted-foreground marker:text-destructive"
          >
            <li>Your profile, photo and sign-in are removed</li>
            <li>Matches you own are deleted, with their scores</li>
            <li>Your OBS URLs stop working</li>
            <li>Player names saved on this device are cleared</li>
          </ul>

          <Alert v-if="errorMessage" variant="destructive">
            <AlertDescription>{{ errorMessage }}</AlertDescription>
          </Alert>

          <div class="grid gap-2">
            <Label for="confirm-delete">
              Type <span class="font-semibold">{{ CONFIRM_WORD }}</span> to
              confirm
            </Label>
            <Input
              id="confirm-delete"
              v-model="confirmText"
              :placeholder="CONFIRM_WORD"
              autocomplete="off"
              :disabled="isDeleting"
            />
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-2">
          <Button
            variant="outline"
            :disabled="isDeleting"
            @click="isOpen = false"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            :disabled="!canConfirm || isDeleting"
            @click="confirmDelete"
          >
            <Loader2 v-if="isDeleting" class="size-4 animate-spin" />
            {{ isDeleting ? 'Deleting…' : 'Delete my account' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>
