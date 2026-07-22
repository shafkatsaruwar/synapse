import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { initSupabaseFromStorage, getSupabase } from "@/lib/supabase";
import { auditLogger } from "@/lib/audit-logger";
import { validateInput, AuthRequestSchema } from "@/lib/validation";

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

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        await initSupabaseFromStorage();
        const supabase = getSupabase();

        if (supabase) {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;

          if (isMounted) {
            setSession(data.session);
            setUser(data.session?.user ?? null);
            if (data.session) {
              await auditLogger.log("AUTH", "user", "success", {
                userId: data.session.user.id,
                details: "Session restored",
              });
            }
          }

          const {
            data: { subscription },
          } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (isMounted) {
              setSession(newSession);
              setUser(newSession?.user ?? null);

              if (event === "SIGNED_IN") {
                await auditLogger.log("AUTH", "user", "success", {
                  userId: newSession?.user.id,
                  details: "User signed in",
                });
              } else if (event === "SIGNED_OUT") {
                await auditLogger.log("AUTH", "user", "success", {
                  details: "User signed out",
                });
              }
            }
          });

          return () => {
            subscription?.unsubscribe();
          };
        }
      } catch (error) {
        console.error("Auth initialization failed");
        await auditLogger.log("AUTH", "user", "failure", {
          errorMessage: "Auth init failed",
        });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const cleanup = initAuth();

    return () => {
      isMounted = false;
      cleanup?.then((unsub) => unsub?.());
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: Error | null }> => {
      try {
        const validated = validateInput(AuthRequestSchema, { email, password });
        const supabase = getSupabase();

        if (!supabase) {
          throw new Error("Supabase not initialized");
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: validated.email,
          password: validated.password,
        });

        if (error) {
          await auditLogger.log("AUTH", "user", "failure", {
            errorMessage: "Sign in failed",
          });
          return { error };
        }

        await auditLogger.log("AUTH", "user", "success", {
          userId: user?.id,
          details: "Sign in successful",
        });

        return { error: null };
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Sign in failed");
        await auditLogger.log("AUTH", "user", "failure", {
          errorMessage: err.message.substring(0, 100),
        });
        return { error: err };
      }
    },
    [user?.id]
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      metadata?: { first_name?: string; last_name?: string }
    ): Promise<{ error: Error | null }> => {
      try {
        const validated = validateInput(AuthRequestSchema, { email, password });
        const supabase = getSupabase();

        if (!supabase) {
          throw new Error("Supabase not initialized");
        }

        const { error } = await supabase.auth.signUp({
          email: validated.email,
          password: validated.password,
          options: {
            data: metadata,
          },
        });

        if (error) {
          await auditLogger.log("AUTH", "user", "failure", {
            errorMessage: "Sign up failed",
          });
          return { error };
        }

        await auditLogger.log("AUTH", "user", "success", {
          details: "User signed up",
        });

        return { error: null };
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Sign up failed");
        await auditLogger.log("AUTH", "user", "failure", {
          errorMessage: err.message.substring(0, 100),
        });
        return { error: err };
      }
    },
    []
  );

  const signOut = useCallback(async (): Promise<void> => {
    try {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        await auditLogger.log("AUTH", "user", "success", {
          details: "User signed out",
        });
      }
    } catch (error) {
      console.error("Sign out failed");
      await auditLogger.log("AUTH", "user", "failure", {
        errorMessage: "Sign out failed",
      });
    }
  }, []);

  const resetPassword = useCallback(
    async (email: string): Promise<{ error: Error | null }> => {
      try {
        const supabase = getSupabase();
        if (!supabase) {
          throw new Error("Supabase not initialized");
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${process.env.EXPO_PUBLIC_APP_URL || "https://synapse-health.app"}/reset-password`,
        });

        if (error) {
          await auditLogger.log("AUTH", "user", "failure", {
            errorMessage: "Password reset failed",
          });
          return { error };
        }

        await auditLogger.log("AUTH", "user", "success", {
          details: "Password reset email sent",
        });

        return { error: null };
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Password reset failed");
        await auditLogger.log("AUTH", "user", "failure", {
          errorMessage: err.message.substring(0, 100),
        });
        return { error: err };
      }
    },
    []
  );

  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      const supabase = getSupabase();
      if (supabase && session) {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        setSession(data.session);
        setUser(data.session?.user ?? null);
      }
    } catch (error) {
      console.error("Session refresh failed");
      await auditLogger.log("AUTH", "user", "failure", {
        errorMessage: "Session refresh failed",
      });
    }
  }, [session]);

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
    throw new Error("useAuth must be used within AuthProvider");
  }

  return ctx;
}
