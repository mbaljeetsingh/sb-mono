<script setup lang="ts">
import UpdatePasswordForm from "~/components/auth/UpdatePasswordForm.vue";

definePageMeta({ layout: "auth" });
useSeoMeta({ title: "Reset password", robots: "noindex, nofollow" });
</script>

<template>
  <UpdatePasswordForm />
</template>
