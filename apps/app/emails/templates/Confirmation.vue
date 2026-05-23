<script setup lang="ts">
import { Section, Text, Heading } from "@vue-email/components";
import Layout from "../components/Layout.vue";
import Button from "../components/Button.vue";
import { emailBrand } from "../config";
</script>

<template>
  <Layout previewText="Confirm your email address">
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
        Confirm your email
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
        Thanks for signing up! Please confirm your email address by clicking the
        button below.
      </Text>
    </Section>

    <Section :style="{ paddingBottom: '24px', textAlign: 'center' }">
      <Button href="{{ .ConfirmationURL }}"> Confirm Email </Button>
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
        If you didn't create an account, you can safely ignore this email.
      </Text>
    </Section>
  </Layout>
</template>
