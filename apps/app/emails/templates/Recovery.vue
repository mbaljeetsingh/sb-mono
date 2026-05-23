<script setup lang="ts">
import { Section, Text, Heading } from "@vue-email/components";
import Layout from "../components/Layout.vue";
import Button from "../components/Button.vue";
import { emailBrand } from "../config";
</script>

<template>
  <Layout previewText="Reset your password">
    <Section :style="{ paddingBottom: '16px' }">
      <Heading
        :style="{
          margin: '0',
          fontSize: '20px',
          fontWeight: '600',
          color: emailBrand.colors.text,
          textAlign: 'center',
        }"
      >
        Reset your password
      </Heading>
    </Section>

    <Section :style="{ paddingBottom: '24px' }">
      <Text
        :style="{
          margin: '0',
          fontSize: '14px',
          lineHeight: '24px',
          color: emailBrand.colors.textMuted,
          textAlign: 'center',
        }"
      >
        We received a request to reset your password. Click the button below to
        choose a new password.
      </Text>
    </Section>

    <Section :style="{ paddingBottom: '24px', textAlign: 'center' }">
      <Button href="{{ .ConfirmationURL }}"> Reset Password </Button>
    </Section>

    <Section>
      <Text
        :style="{
          margin: '0',
          fontSize: '12px',
          lineHeight: '20px',
          color: '#71717a',
          textAlign: 'center',
        }"
      >
        If you didn't request a password reset, you can safely ignore this
        email.
      </Text>
    </Section>
  </Layout>
</template>
