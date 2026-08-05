import { useRef, useCallback } from "react";
import { toast } from "sonner";

interface UndoableActionOptions {
  /** Message shown in the toast while the countdown runs */
  message: string;
  /** The irreversible work to do after the delay */
  onConfirm: () => Promise<void>;
  /** Optional callback if the user hits Undo — e.g. restore optimistic state */
  onUndo?: () => void;
  /** How long (ms) the user has to undo. Default: 5000 */
  delayMs?: number;
  /** Toast shown on success */
  successMessage?: string;
  /** Toast shown on failure */
  errorMessage?: string;
}

/**
 * Delays a destructive action by `delayMs` and shows a toast with an
 * Undo button. If the user doesn't undo, `onConfirm` runs after the delay.
 *
 * Usage:
 *   const { trigger } = useUndoableAction();
 *   trigger({ message: "Batch will be deleted...", onConfirm: () => deleteIt() });
 */
export function useUndoableAction() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastIdRef = useRef<string | number | null>(null);

  const trigger = useCallback(
    ({
      message,
      onConfirm,
      onUndo,
      delayMs = 5000,
      successMessage = "Done.",
      errorMessage = "Action failed. Please try again.",
    }: UndoableActionOptions) => {
      // Cancel any previous pending action from this hook instance
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        if (toastIdRef.current !== null) toast.dismiss(toastIdRef.current);
      }

      let undone = false;

      const id = toast(message, {
        duration: delayMs,
        description: `You have ${delayMs / 1000} seconds to undo.`,
        action: {
          label: "Undo",
          onClick: () => {
            undone = true;
            clearTimeout(timerRef.current!);
            onUndo?.();
            toast.success("Action cancelled.");
          },
        },
      });

      toastIdRef.current = id;

      timerRef.current = setTimeout(async () => {
        if (undone) return;
        try {
          await onConfirm();
          toast.dismiss(id);
          toast.success(successMessage);
        } catch (err) {
          console.error("[useUndoableAction] onConfirm failed:", err);
          toast.error(errorMessage);
        } finally {
          toastIdRef.current = null;
          timerRef.current = null;
        }
      }, delayMs);
    },
    []
  );

  return { trigger };
}