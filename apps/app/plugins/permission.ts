// v-permission directive — hides an element when the current user lacks the required permission.
// Usage:  <button v-permission="'match.delete.own'">Delete</button>
//         <button v-permission="['theme.use.pro', 'admin.themes.publish']">Premium themes</button>

import { defineNuxtPlugin } from "#app";
import { useUserStore } from "@/stores/user";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive("permission", {
    mounted(el: HTMLElement, binding) {
      const userStore = useUserStore();
      const required = binding.value;
      if (!required) return;

      const granted = Array.isArray(required)
        ? required.some((p: string) => userStore.permissions.includes(p))
        : userStore.permissions.includes(required as string);

      if (!granted) {
        el.style.display = "none";
        el.setAttribute("aria-hidden", "true");
      }
    },
    updated(el: HTMLElement, binding) {
      const userStore = useUserStore();
      const required = binding.value;
      if (!required) return;

      const granted = Array.isArray(required)
        ? required.some((p: string) => userStore.permissions.includes(p))
        : userStore.permissions.includes(required as string);

      if (granted) {
        el.style.display = "";
        el.removeAttribute("aria-hidden");
      } else {
        el.style.display = "none";
        el.setAttribute("aria-hidden", "true");
      }
    },
  });
});
