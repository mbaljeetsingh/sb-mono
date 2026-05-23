<script setup lang="ts">
import { Section, Text, Heading } from "@vue-email/components";
import Layout from "../components/Layout.vue";
import Button from "../components/Button.vue";
import { emailBrand } from "../config";
</script>

<template>
  <Layout previewText="You've been invited">
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
        You've been invited
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
        You've been invited to join {{ emailBrand.name }}. Click the button
        below to accept your invitation and create your account.
      </Text>
    </Section>

    <Section :style="{ paddingBottom: '24px', textAlign: 'center' }">
      <Button href="{{ .ConfirmationURL }}"> Accept Invitation </Button>
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
        If you weren't expecting this invitation, you can safely ignore this
        email.
      </Text>
    </Section>
  </Layout>
</template>
