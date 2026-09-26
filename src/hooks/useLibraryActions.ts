import { useServerFn } from "@tanstack/react-start";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { useInvalidateLibrary } from "@/hooks/useOwner";
import { haptic } from "@/lib/haptics";
import type { LinkStyle } from "@/lib/links";
import {
  createFolder,
  deleteItem,
  deleteItems,
  enablePages,
  moveItem,
  moveItems,
  purgeCdn,
  refreshLibrary,
  renameItem,
  saveLabel,
  saveOrder,
  setHidden,
  signOut,
  updateSettings,
} from "@/lib/library.functions";

function messageOf(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  return "Kuch gadbad ho gayi — dobara try karo.";
}

/**
 * Owner write actions with one shared "busy" flag, success toasts in past
 * tense, and a library-wide cache refresh after every change.
 */
export function useLibraryActions() {
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidateLibrary();

  const fns = {
    createFolder: useServerFn(createFolder),
    renameItem: useServerFn(renameItem),
    moveItem: useServerFn(moveItem),
    moveItems: useServerFn(moveItems),
    deleteItem: useServerFn(deleteItem),
    deleteItems: useServerFn(deleteItems),
    saveOrder: useServerFn(saveOrder),
    saveLabel: useServerFn(saveLabel),
    setHidden: useServerFn(setHidden),
    updateSettings: useServerFn(updateSettings),
    purgeCdn: useServerFn(purgeCdn),
    refreshLibrary: useServerFn(refreshLibrary),
    enablePages: useServerFn(enablePages),
    signOut: useServerFn(signOut),
  };

  const run = useCallback(
    async <T,>(work: () => Promise<T>, success: string): Promise<T | undefined> => {
      if (busy) return undefined;
      setBusy(true);
      try {
        const out = await work();
        await invalidate();
        haptic("light");
        toast.success(success);
        return out;
      } catch (err) {
        toast.error(messageOf(err));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [busy, invalidate],
  );

  return {
    busy,
    createFolder: (parent: string, name: string) =>
      run(() => fns.createFolder({ data: { parent, name } }), "Folder ban gaya"),
    rename: (path: string, newName: string) =>
      run(() => fns.renameItem({ data: { path, newName } }), "Rename ho gaya"),
    move: (path: string, toFolder: string) =>
      run(() => fns.moveItem({ data: { path, toFolder } }), "Move ho gaya"),
    moveMany: (paths: string[], toFolder: string) =>
      run(() => fns.moveItems({ data: { paths, toFolder } }), paths.length === 1 ? "Move ho gaya" : `${paths.length} items move ho gaye`),
    remove: (path: string) => run(() => fns.deleteItem({ data: { path } }), "Delete ho gaya"),
    removeMany: (paths: string[]) =>
      run(() => fns.deleteItems({ data: { paths } }), paths.length === 1 ? "Delete ho gaya" : `${paths.length} items delete ho gaye`),
    saveOrder: (folder: string, names: string[]) =>
      run(() => fns.saveOrder({ data: { folder, names } }), "Order save ho gaya"),
    saveLabel: (path: string, label: { title: string; note: string }) =>
      run(() => fns.saveLabel({ data: { path, ...label } }), "Save ho gaya"),
    setHidden: (path: string, hidden: boolean) =>
      run(() => fns.setHidden({ data: { path, hidden } }), hidden ? "Visitors se chhup gaya" : "Sabko dikh raha hai"),
    setLinkStyle: (linkStyle: LinkStyle) => run(() => fns.updateSettings({ data: { linkStyle } }), "Default link badal gaya"),
    /** Empty string clears the public address; viewer links fall back to the current origin. */
    setAppUrl: (appUrl: string) =>
      run(() => fns.updateSettings({ data: { appUrl } }), appUrl.trim() ? "App ka address save ho gaya — viewer links ab isi par banenge" : "App ka address hata diya"),
    purgeAll: () => run(() => fns.purgeCdn({ data: {} }), "CDN cache refresh ho gaya"),
    refresh: () => run(() => fns.refreshLibrary(), "Library refresh ho gayi"),
    enablePages: () => run(() => fns.enablePages(), "GitHub Pages chalu ho gaya — 1-2 minute mein live"),
    signOut: () => run(() => fns.signOut(), "Sign out ho gaya"),
    /** After the upload endpoint finished: refresh caches without a toast (the sheet shows its own). */
    refreshAfterUpload: () => invalidate(),
  };
}
