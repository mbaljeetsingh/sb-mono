<script setup lang="ts">
import { Button as EmailButton } from "@vue-email/components";
import { emailBrand } from "../config";

defineProps<{
  href: string;
}>();
</script>

<template>
  <EmailButton
    :href="href"
    :style="{
      backgroundColor: emailBrand.colors.primary,
      color: emailBrand.colors.textInverted,
      padding: '12px 24px',
      borderRadius: '6px',
      fontWeight: '500',
      fontSize: '14px',
      textDecoration: 'none',
      display: 'inline-block',
    }"
  >
    <slot />
  </EmailButton>
</template>
