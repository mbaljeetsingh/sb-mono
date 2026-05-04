import type { Config } from "tailwindcss";

export default {
  content: [
    "./components/**/*.{vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.ts",
    "./app.vue",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["system-ui", "sans-serif"],
      },
    },
  },
} satisfies Config;
