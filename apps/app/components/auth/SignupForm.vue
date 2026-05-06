<script setup lang="ts">
import { ref } from "vue";
import { Button } from "@sb/layer-ui/components/ui/button";
import { Input } from "@sb/layer-ui/components/ui/input";
import { Label } from "@sb/layer-ui/components/ui/label";
import { Separator } from "@sb/layer-ui/components/ui/separator";
import GoogleIcon from "~/components/icons/GoogleIcon.vue";
import AppLogo from "~/components/common/AppLogo.vue";
import { useAuth } from "~/composables/useAuth";

const {
  email,
  password,
  confirmPassword,
  displayName,
  isSubmitting,
  errorMessage,
  signUp,
} = useAuth();

const success = ref(false);

const handleSignup = async () => {
  const result = await signUp();
  if (result.success) success.value = true;
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <div v-if="success">
      <div class="flex flex-col space-y-1.5">
        <h3 class="text-2xl font-semibold leading-none tracking-tight">
          Thanks for signing up!
        </h3>
        <p class="text-sm text-muted-foreground">
          Check your email to confirm your account
        </p>
      </div>
      <div class="pt-6 text-sm text-muted-foreground">
        We sent a confirmation link to
        <span class="font-medium text-foreground">{{ email }}</span
        >. Click it to finish creating your account, then come back here to sign
        in.
      </div>
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
        <AppLogo
          link-to="/auth/signup"
          size="xl"
          emphasized
          class="mb-8 justify-center md:hidden"
        />
        <h3 class="text-2xl font-semibold leading-none tracking-tight">
          Sign up
        </h3>
        <p class="text-sm text-muted-foreground">
          Create a new Scoreboard account
        </p>
      </div>
      <div class="pt-6">
        <form @submit.prevent="handleSignup">
          <div class="flex flex-col gap-6">
            <div class="grid gap-2">
              <Label for="displayName">Display name</Label>
              <Input
                id="displayName"
                v-model="displayName"
                type="text"
                placeholder="How should we address you?"
                autocomplete="name"
              />
            </div>
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
            <div class="grid gap-2">
              <Label for="password">Password</Label>
              <Input
                id="password"
                v-model="password"
                type="password"
                required
                autocomplete="new-password"
              />
            </div>
            <div class="grid gap-2">
              <Label for="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                v-model="confirmPassword"
                type="password"
                required
                autocomplete="new-password"
              />
            </div>
            <p v-if="errorMessage" class="text-sm text-destructive">
              {{ errorMessage }}
            </p>
            <Button type="submit" :disabled="isSubmitting" class="w-full">
              {{ isSubmitting ? "Creating account..." : "Sign up" }}
            </Button>

            <div class="my-2 flex items-center gap-3">
              <Separator class="flex-1" />
              <span class="text-xs text-muted-foreground"
                >Or continue with</span
              >
              <Separator class="flex-1" />
            </div>

            <Button
              type="button"
              variant="outline"
              class="w-full"
              :disabled="true"
              :title="'Google sign-in coming soon'"
            >
              <GoogleIcon :size="16" class="mr-2" />
              Continue with Google
            </Button>
          </div>
          <div class="mt-4 text-center text-sm">
            Already have an account?
            <NuxtLink to="/auth/signin" class="underline underline-offset-4">
              Sign in
            </NuxtLink>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
