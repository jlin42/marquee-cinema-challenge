"use client";

import { useEffect, useRef } from "react";

/**
 * Drives a native <dialog> as a modal: open/closed follows `isOpen`.
 * The browser handles focus trapping, the backdrop and the inert background.
 *
 * - Without `onDismiss`, Escape is blocked: the visitor must make an explicit choice.
 * - With `onDismiss`, Escape or a click on the backdrop calls it.
 */
export function useModalDialog(isOpen: boolean, onDismiss?: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      e.preventDefault(); // React state decides when the dialog closes
      onDismissRef.current?.();
    };
    // A click whose target is the <dialog> itself landed on the backdrop.
    const onClick = (e: MouseEvent) => {
      if (e.target === dialog) onDismissRef.current?.();
    };
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("click", onClick);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("click", onClick);
    };
  }, []);

  return ref;
}
