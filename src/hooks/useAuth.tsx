import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "student";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

const ROLE_FETCH_TIMEOUT_MS = 5000;
const BOOTSTRAP_TIMEOUT_MS = 8000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async (userId: string): Promise<AppRole> => {
    try {
      const roleResponse = await Promise.race([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), ROLE_FETCH_TIMEOUT_MS);
        }),
      ]);

      if (roleResponse === null) {
        console.error("Role fetch timeout after", ROLE_FETCH_TIMEOUT_MS, "ms");
        return "student";
      }

      const { data, error } = roleResponse;

      if (error) {
        console.error("Role fetch error:", error.message);
        return "student";
      }

      if (data && data.length > 0) {
        const isAdmin = data.some((item) => item.role === "admin");
        return isAdmin ? "admin" : (data[0].role as AppRole);
      }
    } catch (err) {
      console.error("Role fetch exception:", err);
    }

    return "student";
  }, []);

  const initialLoadDone = useRef(false);

  const syncAuthState = useCallback(
    async (nextSession: Session | null, isMounted: boolean) => {
      if (!isMounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setRole(null);
        if (!initialLoadDone.current) {
          initialLoadDone.current = true;
        }
        setLoading(false);
        return;
      }

      // Only show loading spinner on initial boot, not on subsequent auth events
      if (!initialLoadDone.current) {
        setLoading(true);
      }

      const userRole = await fetchRole(nextSession.user.id);

      if (!isMounted) return;

      setRole(userRole);
      initialLoadDone.current = true;
      setLoading(false);
    },
    [fetchRole]
  );

  useEffect(() => {
    let isMounted = true;
    let initialResolved = false;

    // 1. Get session first
    supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
      if (error) {
        console.error("Initial session error:", error.message);
      }
      if (!initialResolved && isMounted) {
        initialResolved = true;
        void syncAuthState(currentSession, isMounted);
      }
    });

    // 2. Subscribe to changes — fire-and-forget (no await)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!initialResolved) {
          // Skip — getSession will handle the first sync
          return;
        }
        void syncAuthState(newSession, isMounted);
      }
    );

    const bootstrapTimeout = setTimeout(() => {
      if (isMounted && !initialResolved) {
        console.error("Auth bootstrap timeout after", BOOTSTRAP_TIMEOUT_MS, "ms");
        initialResolved = true;
        setLoading(false);
      }
    }, BOOTSTRAP_TIMEOUT_MS);

    return () => {
      isMounted = false;
      clearTimeout(bootstrapTimeout);
      subscription.unsubscribe();
    };
  }, [syncAuthState]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
