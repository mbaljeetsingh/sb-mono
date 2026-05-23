// Shared constants used by the Vue email templates. Single brand (Scoreboard),
// so values are inlined rather than abstracted behind a brand-config struct.

export const emailBrand = {
  name: "Scoreboard",
  footer: "Open-source by Underlings. All rights reserved.",
  colors: {
    background: "#000000",
    surface: "#242424",
    border: "#424242",
    text: "#FFFFFF",
    textMuted: "#B8B8B8",
    textInverted: "#000000",
    primary: "#FFFFFF",
  },
} as const;

export type EmailBrand = typeof emailBrand;
