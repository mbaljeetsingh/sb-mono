<script setup lang="ts">
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Preview,
} from "@vue-email/components";
import { emailBrand } from "../config";

defineProps<{
  previewText?: string;
}>();

const year = new Date().getFullYear();
</script>

<template>
  <Html>
    <Head />
    <Body
      :style="{
        backgroundColor: emailBrand.colors.background,
        fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
      }"
    >
      <Preview v-if="previewText">{{ previewText }}</Preview>
      <Container>
        <Section :style="{ padding: '40px 20px' }">
          <Container
            :style="{
              maxWidth: '480px',
              backgroundColor: emailBrand.colors.surface,
              borderRadius: '12px',
              border: `1px solid ${emailBrand.colors.border}`,
            }"
          >
            <Section :style="{ padding: '40px' }">
              <Section :style="{ paddingBottom: '24px', textAlign: 'center' }">
                <Text
                  :style="{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: emailBrand.colors.text,
                    margin: '0',
                  }"
                >
                  {{ emailBrand.name }}
                </Text>
              </Section>

              <slot />
            </Section>
          </Container>

          <Section
            :style="{ maxWidth: '480px', margin: '0 auto', paddingTop: '24px' }"
          >
            <Text
              :style="{
                margin: '0',
                fontSize: '12px',
                color: '#52525b',
                textAlign: 'center',
              }"
            >
              © {{ year }} {{ emailBrand.name }}. {{ emailBrand.footer }}
            </Text>
          </Section>
        </Section>
      </Container>
    </Body>
  </Html>
</template>
