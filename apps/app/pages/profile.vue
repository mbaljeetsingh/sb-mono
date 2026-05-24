<script setup lang="ts">
import { computed, ref, watchEffect, useTemplateRef } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@sb/layer-ui/components/ui/button";
import { Input } from "@sb/layer-ui/components/ui/input";
import { Label } from "@sb/layer-ui/components/ui/label";
import ProfilePhotoUpload from "~/components/common/ProfilePhotoUpload.vue";
import { useUserStore } from "~/stores/user";
import { useAuth } from "~/composables/useAuth";

definePageMeta({ requiresAuth: true });
useSeoMeta({ title: "Profile", robots: "noindex, nofollow" });

const userStore = useUserStore();
const { updatePassword: doUpdatePassword } = useAuth();

const displayName = ref("");
const avatarUrl = ref<string | null>(null);
const isSavingProfile = ref(false);
const profileError = ref<string | null>(null);

const photoUploadRef =
  useTemplateRef<InstanceType<typeof ProfilePhotoUpload>>("photoUpload");

watchEffect(() => {
  const profile = userStore.currentUser?.profile;
  displayName.value = profile?.display_name ?? "";
  avatarUrl.value = profile?.avatar_url ?? null;
});

const fallbackInitial = computed(() => {
  const source = (
    displayName.value ||
    userStore.currentUser?.email ||
    "?"
  ).trim();
  return (source.charAt(0) || "?").toUpperCase();
});

const saveProfile = async () => {
  isSavingProfile.value = true;
  profileError.value = null;
  try {
    let nextAvatar = avatarUrl.value;

    // If the user picked a new file in the dropzone, upload it first and use the public URL.
    if (photoUploadRef.value?.hasNewImage) {
      const uploaded = await photoUploadRef.value.uploadPhoto();
      if (uploaded) {
        nextAvatar = uploaded;
      }
    }

    await userStore.updateProfile({
      display_name: displayName.value.trim() || null,
      avatar_url: nextAvatar,
    });

    photoUploadRef.value?.reset();
    toast.success("Profile updated");
  } catch (err) {
    profileError.value =
      err instanceof Error ? err.message : "Failed to save profile";
  } finally {
    isSavingProfile.value = false;
  }
};

const newPassword = ref("");
const confirmNewPassword = ref("");
const isSavingPassword = ref(false);
const passwordError = ref<string | null>(null);

const savePassword = async () => {
  passwordError.value = null;
  if (newPassword.value !== confirmNewPassword.value) {
    passwordError.value = "Passwords do not match";
    return;
  }
  if (newPassword.value.length < 6) {
    passwordError.value = "Password must be at least 6 characters";
    return;
  }
  isSavingPassword.value = true;
  const result = await doUpdatePassword(newPassword.value);
  isSavingPassword.value = false;
  if (result.success) {
    toast.success("Password updated");
    newPassword.value = "";
    confirmNewPassword.value = "";
  } else {
    passwordError.value = "Failed to update password";
  }
};
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-8 px-4 py-10">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ displayName || userStore.currentUser?.email }}
      </h1>
      <p class="text-sm text-muted-foreground">
        Role: <span class="font-medium">{{ userStore.userRole ?? "—" }}</span>
      </p>
    </header>

    <section class="space-y-6 rounded-lg border bg-card p-6 shadow-sm">
      <div>
        <h2 class="text-lg font-semibold">Profile</h2>
        <p class="text-sm text-muted-foreground">
          Shown on shared scoreboards and overlays.
        </p>
      </div>

      <form class="space-y-6" @submit.prevent="saveProfile">
        <ProfilePhotoUpload
          v-if="userStore.currentUser?.id"
          ref="photoUpload"
          v-model="avatarUrl"
          :user-id="userStore.currentUser.id"
          :fallback-text="fallbackInitial"
          :loading="isSavingProfile"
          @error="(msg: string) => (profileError = msg)"
        />

        <div class="grid gap-2">
          <Label for="displayName">Display name</Label>
          <Input
            id="displayName"
            v-model="displayName"
            type="text"
            placeholder="Your public name"
          />
        </div>

        <p v-if="profileError" class="text-sm text-destructive">
          {{ profileError }}
        </p>

        <Button type="submit" :disabled="isSavingProfile">
          {{ isSavingProfile ? "Saving..." : "Save profile" }}
        </Button>
      </form>
    </section>

    <section class="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
      <div>
        <h2 class="text-lg font-semibold">Change password</h2>
        <p class="text-sm text-muted-foreground">
          Updates immediately. You'll stay signed in.
        </p>
      </div>
      <form class="space-y-4" @submit.prevent="savePassword">
        <div class="grid gap-2">
          <Label for="newPassword">New password</Label>
          <Input
            id="newPassword"
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            required
          />
        </div>
        <div class="grid gap-2">
          <Label for="confirmNewPassword">Confirm new password</Label>
          <Input
            id="confirmNewPassword"
            v-model="confirmNewPassword"
            type="password"
            autocomplete="new-password"
            required
          />
        </div>
        <p v-if="passwordError" class="text-sm text-destructive">
          {{ passwordError }}
        </p>
        <Button type="submit" :disabled="isSavingPassword">
          {{ isSavingPassword ? "Updating..." : "Update password" }}
        </Button>
      </form>
    </section>
  </div>
</template>
