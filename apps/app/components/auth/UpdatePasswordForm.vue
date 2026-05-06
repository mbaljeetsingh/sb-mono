<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { Button } from "@sb/layer-ui/components/ui/button";
import { Input } from "@sb/layer-ui/components/ui/input";
import { Label } from "@sb/layer-ui/components/ui/label";
import AppLogo from "~/components/common/AppLogo.vue";
import { useAuth } from "~/composables/useAuth";

const router = useRouter();
const { isSubmitting, errorMessage, updatePassword } = useAuth();

const newPassword = ref("");
const confirmNewPassword = ref("");
const localError = ref<string | null>(null);
const updated = ref(false);

const handleSubmit = async () => {
  localError.value = null;
  if (newPassword.value !== confirmNewPassword.value) {
    localError.value = "Passwords do not match";
    return;
  }
  if (newPassword.value.length < 6) {
    localError.value = "Password must be at least 6 characters";
    return;
  }
  const result = await updatePassword(newPassword.value);
  if (result.success) {
    updated.value = true;
    setTimeout(() => router.push("/"), 1500);
  }
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <AppLogo
      link-to="/"
      size="xl"
      emphasized
      class="mb-8 justify-center md:hidden"
    />

    <div v-if="updated">
      <h3 class="text-2xl font-semibold leading-none tracking-tight">
        Password updated
      </h3>
      <p class="mt-2 text-sm text-muted-foreground">
        Redirecting you to the app…
      </p>
    </div>

    <div v-else>
      <div class="flex flex-col space-y-1.5">
        <h3 class="text-2xl font-semibold leading-none tracking-tight">
          Set a new password
        </h3>
        <p class="text-sm text-muted-foreground">
          Choose a new password for your account.
        </p>
      </div>
      <form class="pt-6" @submit.prevent="handleSubmit">
        <div class="flex flex-col gap-6">
          <div class="grid gap-2">
            <Label for="newPassword">New password</Label>
            <Input
              id="newPassword"
              v-model="newPassword"
              type="password"
              required
              autocomplete="new-password"
            />
          </div>
          <div class="grid gap-2">
            <Label for="confirmNewPassword">Confirm new password</Label>
            <Input
              id="confirmNewPassword"
              v-model="confirmNewPassword"
              type="password"
              required
              autocomplete="new-password"
            />
          </div>
          <p v-if="localError || errorMessage" class="text-sm text-destructive">
            {{ localError || errorMessage }}
          </p>
          <Button type="submit" :disabled="isSubmitting" class="w-full">
            {{ isSubmitting ? "Updating..." : "Update password" }}
          </Button>
        </div>
      </form>
    </div>
  </div>
</template>
