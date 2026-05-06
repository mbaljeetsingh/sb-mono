<script setup lang="ts">
import { ref } from "vue";
import { Button } from "@sb/layer-ui/components/ui/button";
import { Input } from "@sb/layer-ui/components/ui/input";
import { Label } from "@sb/layer-ui/components/ui/label";
import AppLogo from "~/components/common/AppLogo.vue";
import { useAuth } from "~/composables/useAuth";

const { email, isSubmitting, errorMessage, resetPassword } = useAuth();
const sent = ref(false);

const handleSubmit = async () => {
  const result = await resetPassword();
  if (result.success) sent.value = true;
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

    <div v-if="sent">
      <h3 class="text-2xl font-semibold leading-none tracking-tight">
        Check your email
      </h3>
      <p class="mt-2 text-sm text-muted-foreground">
        If an account exists for
        <span class="font-medium text-foreground">{{ email }}</span
        >, we've sent a link to reset your password.
      </p>
      <div class="pt-6">
        <NuxtLink
          to="/auth/signin"
          class="text-sm underline underline-offset-4"
        >
          Back to sign in
        </NuxtLink>
      </div>
    </div>

    <div v-else>
      <div class="flex flex-col space-y-1.5">
        <h3 class="text-2xl font-semibold leading-none tracking-tight">
          Forgot your password?
        </h3>
        <p class="text-sm text-muted-foreground">
          Enter the email you signed up with — we'll send a reset link.
        </p>
      </div>
      <form class="pt-6" @submit.prevent="handleSubmit">
        <div class="flex flex-col gap-6">
          <div class="grid gap-2">
            <Label for="email">Email</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              placeholder="m@example.com"
              required
              autocomplete="email"
            />
          </div>
          <p v-if="errorMessage" class="text-sm text-destructive">
            {{ errorMessage }}
          </p>
          <Button type="submit" :disabled="isSubmitting" class="w-full">
            {{ isSubmitting ? "Sending..." : "Send reset link" }}
          </Button>
        </div>
        <div class="mt-4 text-center text-sm">
          Remembered it?
          <NuxtLink to="/auth/signin" class="underline underline-offset-4">
            Sign in
          </NuxtLink>
        </div>
      </form>
    </div>
  </div>
</template>
