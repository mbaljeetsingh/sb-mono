<script setup lang="ts">
defineProps<{ size?: number }>();
</script>

<template>
  <!-- currentColor, unlike the multicolour Google mark: Apple's guidelines
       require the logo be solid black or solid white against its background,
       so it has to invert with the theme rather than sit at a fixed colour. -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size ?? 16"
    :height="size ?? 16"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      d="M17.05 12.54c-.03-2.63 2.15-3.9 2.25-3.96-1.23-1.79-3.13-2.04-3.81-2.07-1.62-.16-3.16.95-3.98.95-.82 0-2.09-.93-3.43-.9-1.76.03-3.39 1.02-4.3 2.6-1.83 3.18-.47 7.89 1.31 10.47.87 1.26 1.91 2.68 3.27 2.63 1.31-.05 1.81-.85 3.4-.85 1.58 0 2.03.85 3.42.82 1.41-.02 2.31-1.29 3.17-2.55.99-1.46 1.4-2.87 1.42-2.95-.03-.01-2.73-1.05-2.76-4.16z"
    />
    <path
      d="M14.47 4.77c.72-.88 1.21-2.09 1.08-3.3-1.04.04-2.3.69-3.05 1.56-.67.77-1.25 2.01-1.09 3.19 1.16.09 2.34-.59 3.06-1.45z"
    />
  </svg>
</template>
