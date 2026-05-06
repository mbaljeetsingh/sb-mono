<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useUserStore } from "~/stores/user";

definePageMeta({ layout: "auth" });
useSeoMeta({ title: "Signing you in…", robots: "noindex, nofollow" });

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const supabase = useSupabaseClient();

onMounted(async () => {
  // @nuxtjs/supabase + @supabase/ssr (PKCE) auto-detect ?code=… and exchange in the
  // browser client. We re-sync the store, then route the user where they were headed.
  try {
    // If the URL came in with ?code, give the auto-detect a tick to settle.
    if (route.query.code) {
      await new Promise((r) => setTimeout(r, 50));
    }
    await userStore.synchronizeUserState();
  } catch (err) {
    console.error("auth callback:", err);
  }

  const next =
    (route.query.redirect as string) || (route.query.next as string) || "/";
  await router.replace(next);
});
</script>

<template>
  <div class="m-auto flex flex-1 items-center justify-center px-4 py-8">
    <div class="text-center">
      <p class="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  </div>
</template>
