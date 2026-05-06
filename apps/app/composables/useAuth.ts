// useAuth — thin wrapper exposing auth ops + form-local state for the signin/signup/forgot pages.
// Delegates everything stateful to useUserStore. Mirrors np-mono's shape so form components port cleanly.

import { ref } from "vue";
import { useUserStore } from "@/stores/user";

export function useAuth() {
  const userStore = useUserStore();

  // Form-local state — separate from store error so two forms can be open without cross-talk.
  const email = ref("");
  const password = ref("");
  const confirmPassword = ref("");
  const displayName = ref("");
  const errorMessage = ref<string | null>(null);
  const isSubmitting = ref(false);

  const reset = () => {
    email.value = "";
    password.value = "";
    confirmPassword.value = "";
    displayName.value = "";
    errorMessage.value = null;
  };

  const captureError = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    return "Something went wrong. Please try again.";
  };

  const signInWithPassword = async () => {
    isSubmitting.value = true;
    errorMessage.value = null;
    try {
      await userStore.signInWithPassword(email.value.trim(), password.value);
      return { success: true as const };
    } catch (err) {
      errorMessage.value = captureError(err);
      return { success: false as const };
    } finally {
      isSubmitting.value = false;
    }
  };

  const signUp = async () => {
    isSubmitting.value = true;
    errorMessage.value = null;
    try {
      if (password.value !== confirmPassword.value) {
        throw new Error("Passwords do not match");
      }
      if (password.value.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      await userStore.signUp(
        email.value.trim(),
        password.value,
        displayName.value.trim() || undefined,
      );
      return { success: true as const };
    } catch (err) {
      errorMessage.value = captureError(err);
      return { success: false as const };
    } finally {
      isSubmitting.value = false;
    }
  };

  const signInWithGoogle = async () => {
    // UI button is disabled in v1 — this stays here so flipping the button to enabled "just works".
    isSubmitting.value = true;
    errorMessage.value = null;
    try {
      await userStore.signInWithGoogle();
    } catch (err) {
      errorMessage.value = captureError(err);
    } finally {
      isSubmitting.value = false;
    }
  };

  const signOut = async () => {
    await userStore.signOut();
    await navigateTo("/auth/signin");
  };

  const resetPassword = async () => {
    isSubmitting.value = true;
    errorMessage.value = null;
    try {
      await userStore.resetPassword(email.value.trim());
      return { success: true as const };
    } catch (err) {
      errorMessage.value = captureError(err);
      return { success: false as const };
    } finally {
      isSubmitting.value = false;
    }
  };

  const updatePassword = async (newPassword: string) => {
    isSubmitting.value = true;
    errorMessage.value = null;
    try {
      await userStore.updatePassword(newPassword);
      return { success: true as const };
    } catch (err) {
      errorMessage.value = captureError(err);
      return { success: false as const };
    } finally {
      isSubmitting.value = false;
    }
  };

  return {
    email,
    password,
    confirmPassword,
    displayName,
    errorMessage,
    isSubmitting,
    reset,
    signInWithPassword,
    signInWithGoogle,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
  };
}
