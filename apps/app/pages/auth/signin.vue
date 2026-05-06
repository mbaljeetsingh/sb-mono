<script setup lang="ts">
import SigninForm from "~/components/auth/SigninForm.vue";

definePageMeta({ layout: "auth" });
useSeoMeta({ title: "Sign in", robots: "noindex, nofollow" });
</script>

<template>
  <SigninForm />
</template>
