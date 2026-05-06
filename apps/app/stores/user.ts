// User store — slim Pinia store for sb-mono. SPA-mode (ssr: false), so no SSR-hydration paths.
// Mirrors np-mono's user store shape (currentUser / userRole / permissions / initAuth) so the
// downstream auth pages, middleware, and v-permission directive can be ported nearly verbatim.

import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { useDocumentVisibility } from "@vueuse/core";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

type AppRole = "admin" | "free" | "pro";

type UserWithProfile = User & { profile?: UserProfile };

export const useUserStore = defineStore("user", () => {
  const supabase = useSupabaseClient();
  const visibility = useDocumentVisibility();

  const currentUser = ref<UserWithProfile | null>(null);
  const isLoading = ref(false);
  const error = ref<unknown>(null);
  const isInitialized = ref(false);
  const permissions = ref<string[]>([]);
  const userRole = ref<AppRole | null>(null);

  const isAuthenticated = computed(() => !!currentUser.value);

  // Fetch profile row from public.users.
  const fetchProfile = async (authUser: User): Promise<UserWithProfile> => {
    const { data, error: profileError } = await supabase
      .from("users")
      .select("id, email, display_name, avatar_url")
      .eq("id", authUser.id)
      .maybeSingle();
    if (profileError) console.error("profile fetch:", profileError);
    return { ...authUser, profile: (data as UserProfile | null) ?? undefined };
  };

  // Decode user_role from JWT claim injected by custom_access_token_hook.
  const readRoleFromJwt = (session: Session | null): AppRole | null => {
    const token = session?.access_token;
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
      const claim = payload?.user_role;
      return claim === "admin" || claim === "free" || claim === "pro"
        ? claim
        : null;
    } catch {
      return null;
    }
  };

  // Pull permissions for the current role via the get_my_permissions() RPC.
  const fetchPermissions = async () => {
    if (!userRole.value) {
      permissions.value = [];
      return;
    }
    const { data, error: rpcError } = await supabase.rpc("get_my_permissions");
    if (rpcError) {
      console.error("permissions fetch:", rpcError);
      permissions.value = [];
      return;
    }
    permissions.value = Array.isArray(data) ? (data as string[]) : [];
  };

  // Sync session → currentUser + role + permissions. Idempotent.
  const synchronizeUserState = async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("session fetch:", sessionError);
      clearData();
      return;
    }
    if (!data.session?.user) {
      clearData();
      return;
    }
    userRole.value = readRoleFromJwt(data.session);
    currentUser.value = await fetchProfile(data.session.user);
    await fetchPermissions();
  };

  const signInWithPassword = async (email: string, password: string) => {
    if (!email || !password)
      throw new Error("Please enter both email and password");
    isLoading.value = true;
    error.value = null;
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;
      await synchronizeUserState();
    } catch (err) {
      error.value = err;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName?: string,
  ) => {
    isLoading.value = true;
    error.value = null;
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: displayName ? { display_name: displayName } : undefined,
        },
      });
      if (authError) throw authError;
    } catch (err) {
      error.value = err;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // Google OAuth — wired but UI button is disabled in v1. Keeping the code so flipping
  // [auth.external.google].enabled in supabase/config.toml is the only change needed.
  const signInWithGoogle = async () => {
    if (typeof window === "undefined") return;
    isLoading.value = true;
    error.value = null;
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (authError) throw authError;
    } catch (err) {
      error.value = err;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const resetPassword = async (email: string) => {
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/reset-password`
        : undefined;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo,
      },
    );
    if (resetError) throw resetError;
  };

  const updatePassword = async (newPassword: string) => {
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updateError) throw updateError;
  };

  const updateProfile = async (
    patch: Partial<Pick<UserProfile, "display_name" | "avatar_url">>,
  ) => {
    if (!currentUser.value?.id) throw new Error("Not signed in");
    const { data, error: updateError } = await supabase
      .from("users")
      .update(patch)
      .eq("id", currentUser.value.id)
      .select("id, email, display_name, avatar_url")
      .single();
    if (updateError) throw updateError;
    if (currentUser.value) {
      currentUser.value.profile = data as UserProfile;
    }
  };

  const signOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) console.error("signout:", signOutError);
    clearData();
  };

  const clearData = () => {
    currentUser.value = null;
    permissions.value = [];
    userRole.value = null;
    error.value = null;
  };

  // Initialize once. Sets up auth-state listener + visibility refresh.
  let listenersReady = false;
  const initAuth = async () => {
    if (!listenersReady) {
      listenersReady = true;
      supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, _session: Session | null) => {
          // setTimeout avoids the well-known Supabase deadlock when calling auth in the listener.
          setTimeout(() => {
            synchronizeUserState().catch(console.error);
          }, 0);
        },
      );
      watch(visibility, (v) => {
        if (v === "visible" && isAuthenticated.value) {
          synchronizeUserState().catch(console.error);
        }
      });
    }
    if (isInitialized.value) return;
    isLoading.value = true;
    try {
      await synchronizeUserState();
      isInitialized.value = true;
    } catch (err) {
      error.value = err;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    currentUser,
    isAuthenticated,
    isLoading,
    isInitialized,
    error,
    userRole,
    permissions,
    signInWithPassword,
    signInWithGoogle,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    synchronizeUserState,
    initAuth,
    clearData,
  };
});
