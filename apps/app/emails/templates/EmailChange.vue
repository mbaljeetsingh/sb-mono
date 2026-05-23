<script setup lang="ts">
import { Section, Text, Heading } from "@vue-email/components";
import Layout from "../components/Layout.vue";
import Button from "../components/Button.vue";
import { emailBrand } from "../config";

// Go template variables (processed by Supabase at runtime)
const oldEmail = "{{ .Email }}";
const newEmail = "{{ .NewEmail }}";
</script>

<template>
  <Layout previewText="Confirm email change">
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
        Confirm email change
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
        You've requested to change your email from {{ oldEmail }} to
        {{ newEmail }}. Click the button below to confirm this change.
      </Text>
    </Section>

    <Section :style="{ paddingBottom: '24px', textAlign: 'center' }">
      <Button href="{{ .ConfirmationURL }}"> Confirm Change </Button>
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
        If you didn't request this change, please secure your account
        immediately.
      </Text>
    </Section>
  </Layout>
</template>
