import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { haptic } from "@/lib/haptics";

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Copies text, shows a short toast, and exposes a brief "copied" state for the button. */
export function useCopy(successMessage = "Link copy ho gaya") {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  const copy = useCallback(
    async (text: string, message?: string) => {
      haptic("light");
      const ok = await writeClipboard(text);
      if (ok) {
        setCopied(true);
        toast.success(message ?? successMessage);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1600);
      } else {
        toast.error("Copy nahi ho paaya — link ko select karke copy karo.");
      }
      return ok;
    },
    [successMessage],
  );

  return { copy, copied };
}
