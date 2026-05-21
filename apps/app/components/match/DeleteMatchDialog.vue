<script setup lang="ts">
// Confirm-and-delete dialog for a match. Owns the AlertDialog wiring and the
// call to useDeleteMatch so callers only see a slot for the trigger button
// and a `deleted` event. Keeps SettingsSheet, the matches list, and any
// future surface (history page, admin) using the same destructive flow.

import { ref } from "vue";
import { toast } from "vue-sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@sb/layer-ui/components/ui/alert-dialog";
import { useDeleteMatch } from "@sb/layer-app-base/composables/useDeleteMatch";

const props = defineProps<{
  matchId: string;
  matchLabel?: string;
}>();

const emit = defineEmits<{
  (e: "deleted", matchId: string): void;
}>();

const open = ref(false);
const busy = ref(false);
const { deleteMatch } = useDeleteMatch();

const confirm = async () => {
  if (!props.matchId || busy.value) return;
  busy.value = true;
  try {
    await deleteMatch(props.matchId);
    toast.success("Match deleted");
    open.value = false;
    emit("deleted", props.matchId);
  } catch (err) {
    console.warn("[DeleteMatchDialog] failed", err);
    toast.error("Couldn't delete the match");
  } finally {
    busy.value = false;
  }
};
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogTrigger as-child>
      <slot name="trigger" />
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this match?</AlertDialogTitle>
        <AlertDialogDescription>
          <template v-if="matchLabel">
            <span class="font-medium text-foreground">{{ matchLabel }}</span> —
            this permanently removes the match and all its scoring history.
          </template>
          <template v-else>
            This permanently removes the match and all its scoring history.
          </template>
          Anyone watching the overlay will lose their view. This can't be
          undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="busy">Cancel</AlertDialogCancel>
        <AlertDialogAction
          :disabled="busy"
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          @click="confirm"
        >
          {{ busy ? "Deleting…" : "Delete match" }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
