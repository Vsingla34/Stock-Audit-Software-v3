import { toast } from "sonner";

/**
 * Maps known Supabase / network error substrings to friendly messages.
 * An empty string means "pass through the original message as-is"
 * (used when the service already returns a human-readable string).
 */
const ERROR_MAP: Array<{ match: string; message: string }> = [
  { match: "JWT expired",            message: "Your session has expired. Please log in again." },
  { match: "Failed to fetch",        message: "No internet connection. Your changes will sync when you're back online." },
  { match: "NetworkError",           message: "Network error. Please check your connection and try again." },
  { match: "duplicate key",          message: "This record already exists. Please check for duplicates." },
  { match: "violates foreign key",   message: "This record is linked to other data and cannot be deleted yet." },
  { match: "row-level security",     message: "You don't have permission to perform this action." },
  { match: "Invalid login",          message: "Incorrect email or password. Please try again." },
  { match: "Email not confirmed",    message: "Please verify your email address before logging in." },
  { match: "User already registered",message: "An account with this email already exists." },
  { match: "Token has expired",      message: "This verification code has expired. Please request a new one." },
  { match: "Invalid OTP",            message: "Incorrect verification code. Please check and try again." },
  { match: "timeout",                message: "The request timed out. Please try again." },
  { match: "Validation Failed",      message: "" }, // already human-readable — pass through
  { match: "Session expired",        message: "" }, // already human-readable — pass through
  { match: "No client account",      message: "" }, // already human-readable — pass through
];

/**
 * Converts any thrown value into a friendly string.
 * Falls back to `fallback` if nothing matches.
 */
export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : JSON.stringify(error);

  for (const entry of ERROR_MAP) {
    if (raw.toLowerCase().includes(entry.match.toLowerCase())) {
      // Empty message = use the original (already readable) message
      return entry.message || raw;
    }
  }

  return fallback;
}

/**
 * Shows a `sonner` error toast with a friendly message,
 * and always logs the raw error to the console for debugging.
 */
export function toastError(error: unknown, fallback?: string): void {
  const message = getErrorMessage(error, fallback);
  toast.error(message);
  console.error("[App Error]", error);
}

/**
 * Wraps an async function: shows a loading toast, then
 * a success or error toast depending on the outcome.
 *
 * Usage:
 *   await withToast(
 *     () => SupabaseDataService.deleteUploadBatch(id),
 *     { loading: "Deleting...", success: "Batch deleted.", fallback: "Delete failed." }
 *   );
 */
export async function withToast<T>(
  fn: () => Promise<T>,
  options: { loading: string; success: string; fallback?: string }
): Promise<T | undefined> {
  const id = toast.loading(options.loading);
  try {
    const result = await fn();
    toast.success(options.success, { id });
    return result;
  } catch (error) {
    const message = getErrorMessage(error, options.fallback);
    toast.error(message, { id });
    console.error("[App Error]", error);
    return undefined;
  }
}