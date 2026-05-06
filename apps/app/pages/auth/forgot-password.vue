<script setup lang="ts">
import ForgotPasswordForm from "~/components/auth/ForgotPasswordForm.vue";

definePageMeta({ layout: "auth" });
useSeoMeta({ title: "Forgot password", robots: "noindex, nofollow" });
</script>

<template>
  <ForgotPasswordForm />
</template>
