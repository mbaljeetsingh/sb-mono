<script setup lang="ts">
import SignupForm from "~/components/auth/SignupForm.vue";

definePageMeta({ layout: "auth" });
useSeoMeta({ title: "Sign up", robots: "noindex, nofollow" });
</script>

<template>
  <SignupForm />
</template>
