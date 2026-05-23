<script setup lang="ts">
import { Section, Text, Heading } from "@vue-email/components";
import Layout from "../components/Layout.vue";
import Button from "../components/Button.vue";
import { emailBrand } from "../config";
</script>

<template>
  <Layout previewText="Sign in to your account">
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
        Sign in to your account
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
        Click the button below to securely sign in to your account. This link
        will expire in 1 hour.
      </Text>
    </Section>

    <Section :style="{ paddingBottom: '24px', textAlign: 'center' }">
      <Button href="{{ .ConfirmationURL }}"> Sign In </Button>
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
        If you didn't request this link, you can safely ignore this email.
      </Text>
    </Section>
  </Layout>
</template>
