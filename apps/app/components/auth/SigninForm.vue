<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { Button } from "@sb/layer-ui/components/ui/button";
import { Input } from "@sb/layer-ui/components/ui/input";
import { Label } from "@sb/layer-ui/components/ui/label";
import { Separator } from "@sb/layer-ui/components/ui/separator";
import GoogleIcon from "~/components/icons/GoogleIcon.vue";
import AppLogo from "~/components/common/AppLogo.vue";
import { useAuth } from "~/composables/useAuth";

const { email, password, isSubmitting, errorMessage, signInWithPassword } =
  useAuth();

const route = useRoute();
const router = useRouter();

const handleSignin = async () => {
  const result = await signInWithPassword();
  if (result.success) {
    const redirect = (route.query.redirect as string) || "/";
    await router.push(redirect);
  }
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <div class="flex flex-col space-y-1.5">
        <AppLogo
          link-to="/auth/signin"
          size="xl"
          emphasized
          class="mb-8 justify-center md:hidden"
        />
        <h3 class="text-2xl font-semibold leading-none tracking-tight">
          Sign in
        </h3>
        <p class="text-sm text-muted-foreground">
          Enter your email below to sign in to your account
        </p>
      </div>
      <div class="pt-6">
        <form @submit.prevent="handleSignin">
          <div class="flex flex-col gap-6">
            <div class="grid gap-2">
              <Label for="email">Email</Label>
              <Input
                id="email"
                v-model="email"
                type="email"
                placeholder="m@example.com"
                required
              />
            </div>
            <div class="grid gap-2">
              <div class="flex items-center">
                <Label for="password">Password</Label>
                <NuxtLink
                  to="/auth/forgot-password"
                  class="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                >
                  Forgot your password?
                </NuxtLink>
              </div>
              <Input
                id="password"
                v-model="password"
                type="password"
                required
              />
            </div>
            <p v-if="errorMessage" class="text-sm text-destructive">
              {{ errorMessage }}
            </p>
            <Button type="submit" :disabled="isSubmitting" class="w-full">
              {{ isSubmitting ? "Signing in..." : "Sign in" }}
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
            Don't have an account?
            <NuxtLink to="/auth/signup" class="underline underline-offset-4">
              Sign up
            </NuxtLink>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
