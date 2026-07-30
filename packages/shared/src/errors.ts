// Uniform error handling (ported from np-mono). Use getErrorMessage() in
// catch blocks instead of `(err as Error).message` — catch values are
// `unknown` and the cast crashes on non-Error throws. handleError() is the
// one-liner for "surface this to the user as a toast".
import { toast } from 'vue-sonner';

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

export function handleError(error: unknown): void {
  toast.error('Error', { description: getErrorMessage(error) });
}
