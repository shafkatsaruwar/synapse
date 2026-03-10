import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import Constants from "expo-constants";
import { Session, User } from "@supabase/supabase-js";
import { getSupabase, getSupabaseUrl, initSupabaseFromStorage } from "@/lib/supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, metadata?: { first_name?: string; last_name?: string }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    await initSupabaseFromStorage();
    const supabase = getSupabase();
    if (!supabase) {
      console.error("Supabase client not initialized yet");
      return;
    }
    const { data: { session: s } } = await supabase.auth.getSession();
    setSession(s ?? null);
    setUser(s?.user ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    (async () => {
      try {
        await initSupabaseFromStorage();
      } catch (e) {
        console.error("Supabase initialization failed", e);
      }
      if (cancelled) return;
      const supabase = getSupabase();
      if (!supabase) {
        setLoading(false);
        return;
      }
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (cancelled) return;
        setSession(s);
        setUser(s?.user ?? null);
        setLoading(false);
      }).catch((e) => {
        if (!cancelled) {
          console.error("Auth getSession error", e);
          setLoading(false);
        }
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
        if (!cancelled) {
          setSession(s ?? null);
          setUser(s?.user ?? null);
        }
      });
      unsubscribe = () => subscription.unsubscribe();
    })();
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await initSupabaseFromStorage();
    const supabase = getSupabase();
    if (!supabase) {
      console.error("Supabase client not initialized yet");
      return { error: new Error("Sign-in is temporarily unavailable. Please try again later or update to the latest version of the app.") };
    }
    console.log("Supabase URL at signIn:", getSupabaseUrl());
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) console.warn("Supabase signIn error:", error.message, error.status, error);
      return { error: error ?? null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Supabase signIn exception:", msg, e);
      if (e && typeof e === "object" && "cause" in e) console.error("SignIn cause:", (e as { cause?: unknown }).cause);
      if (/network|fetch|failed|unable to resolve|request failed/i.test(msg)) {
        return { error: new Error("Couldn't reach the server. Check your internet connection and try again.") };
      }
      return { error: e instanceof Error ? e : new Error(String(e)) };
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, metadata?: { first_name?: string; last_name?: string }) => {
      await initSupabaseFromStorage();
      const supabase = getSupabase();
      if (!supabase) {
        console.error("Supabase client not initialized yet");
        return { error: new Error("Sign-in is temporarily unavailable. Please try again later or update to the latest version of the app.") };
      }
      const appUrl =
        process.env.EXPO_PUBLIC_APP_URL?.trim() ||
        (typeof Constants.expoConfig?.extra === "object" && (Constants.expoConfig.extra as Record<string, unknown>).EXPO_PUBLIC_APP_URL && String((Constants.expoConfig.extra as Record<string, string>).EXPO_PUBLIC_APP_URL).trim()) ||
        (typeof globalThis !== "undefined" && "location" in globalThis && (globalThis as unknown as { location?: { origin?: string } }).location?.origin);
      const data: Record<string, string> = {};
      if (metadata?.first_name) data.first_name = metadata.first_name;
      if (metadata?.last_name) data.last_name = metadata.last_name;
      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            ...(Object.keys(data).length > 0 ? { data } : {}),
            ...(appUrl ? { emailRedirectTo: appUrl } : {}),
          },
        });
        if (error) console.warn("Supabase signUp error:", error.message, error.status, error);
        return { error: error ?? null };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("Supabase signUp exception:", msg, e);
        if (e && typeof e === "object" && "cause" in e) console.error("SignUp cause:", (e as { cause?: unknown }).cause);
        if (/network|fetch|failed|unable to resolve|request failed/i.test(msg)) {
          return { error: new Error("Couldn't reach the server. Check your internet connection and try again.") };
        }
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      console.error("Supabase client not initialized yet");
      return;
    }
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await initSupabaseFromStorage();
    const supabase = getSupabase();
    if (!supabase) {
      console.error("Supabase client not initialized yet");
      return { error: new Error("Sign-in is temporarily unavailable. Please try again later or update to the latest version of the app.") };
    }
    const appUrl =
      process.env.EXPO_PUBLIC_APP_URL?.trim() ||
      (typeof Constants.expoConfig?.extra === "object" && (Constants.expoConfig.extra as Record<string, unknown>).EXPO_PUBLIC_APP_URL && String((Constants.expoConfig.extra as Record<string, string>).EXPO_PUBLIC_APP_URL).trim()) ||
      (typeof globalThis !== "undefined" && "location" in globalThis && (globalThis as unknown as { location?: { origin?: string } }).location?.origin);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: appUrl || undefined,
    });
    return { error: error ?? null };
  }, []);

  const value: AuthContextValue = {
    session,
    user,
    loading,
    refreshSession,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    console.warn("useAuth called outside AuthProvider");
    return {
      user: null,
      session: null,
      loading: false,
      refreshSession: async () => {},
      signIn: async () => ({ error: null }),
      signOut: async () => {},
      signUp: async () => ({ error: null }),
      resetPassword: async () => ({ error: null }),
    };
  }

  return ctx;
}
