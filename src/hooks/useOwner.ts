import { useQuery, useQueryClient } from "@tanstack/react-query";

import { sessionQuery } from "@/lib/queries";

/** Owner session state, fetched client-side so public SSR never depends on it. */
export function useOwner() {
  const q = useQuery(sessionQuery);
  return {
    isOwner: q.data?.signedIn ?? false,
    session: q.data,
    loading: q.isPending,
  };
}

/** Invalidates every library read after a write. */
export function useInvalidateLibrary() {
  const qc = useQueryClient();
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["folder"] }),
      qc.invalidateQueries({ queryKey: ["file"] }),
      qc.invalidateQueries({ queryKey: ["folders"] }),
      qc.invalidateQueries({ queryKey: ["stats"] }),
      qc.invalidateQueries({ queryKey: ["search"] }),
      qc.invalidateQueries({ queryKey: ["session"] }),
      qc.invalidateQueries({ queryKey: ["pages"] }),
      qc.invalidateQueries({ queryKey: ["browse"] }),
      qc.invalidateQueries({ queryKey: ["kind"] }),
    ]);
  };
}
