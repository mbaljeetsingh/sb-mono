<script setup lang="ts">
import { Section, Text, Heading } from "@vue-email/components";
import Layout from "../components/Layout.vue";
import { emailBrand } from "../config";

// Go template variable (processed by Supabase at runtime)
const otpToken = "{{ .Token }}";
</script>

<template>
  <Layout previewText="Verify your identity">
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
        Verify your identity
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
        To complete this sensitive action, please enter the verification code
        below:
      </Text>
    </Section>

    <Section :style="{ paddingBottom: '24px', textAlign: 'center' }">
      <Text
        :style="{
          margin: '0',
          fontSize: '32px',
          fontWeight: '700',
          letterSpacing: '0.1em',
          color: emailBrand.colors.text,
          textAlign: 'center',
          fontFamily: 'monospace',
        }"
      >
        {{ otpToken }}
      </Text>
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
        If you didn't initiate this action, please secure your account
        immediately.
      </Text>
    </Section>
  </Layout>
</template>
