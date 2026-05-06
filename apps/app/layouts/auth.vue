<script setup lang="ts">
import AuthFeatures from "~/components/auth/AuthFeatures.vue";
</script>

<template>
  <div class="flex min-h-screen w-full flex-col md:flex-row">
    <AuthFeatures />
    <div class="flex flex-1 items-center justify-center px-4 py-8">
      <div class="w-full max-w-md">
        <slot />
      </div>
    </div>
  </div>
</template>
