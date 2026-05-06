// useRolePermissions — thin permission-check helpers reading from the user store.
// Used by middleware (meta.requiredPermission) and the v-permission directive.

import { computed } from "vue";
import { useUserStore } from "@/stores/user";

export function useRolePermissions() {
  const userStore = useUserStore();

  const hasPermission = (permission: string): boolean => {
    return userStore.permissions.includes(permission);
  };

  const hasAnyPermission = (perms: string[]): boolean => {
    return perms.some((p) => userStore.permissions.includes(p));
  };

  const hasRole = (role: "admin" | "free" | "pro"): boolean => {
    return userStore.userRole === role;
  };

  const isAdmin = computed(() => userStore.userRole === "admin");
  const isPro = computed(
    () => userStore.userRole === "pro" || userStore.userRole === "admin",
  );

  return { hasPermission, hasAnyPermission, hasRole, isAdmin, isPro };
}
