/** Web Share API helpers — the native "share sheet" on phones. */

export function canShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/**
 * Opens the OS share sheet with a link. Resolves true when the user completed a
 * share, false when they dismissed it or the browser cannot share.
 */
export async function shareLink(input: { title: string; url: string; text?: string }): Promise<boolean> {
  if (!canShare()) return false;
  try {
    await navigator.share({ title: input.title, text: input.text ?? input.title, url: input.url });
    return true;
  } catch (err) {
    // AbortError = user closed the sheet; anything else is a browser refusal.
    if (err instanceof DOMException && err.name === "AbortError") return false;
    return false;
  }
}
