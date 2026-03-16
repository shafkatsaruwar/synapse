import React, { createContext, useContext } from "react";

type AuthContextValue = {
  session: null;
  user: null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, metadata?: { first_name?: string; last_name?: string }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value: AuthContextValue = {
    session: null,
    user: null,
    loading: false,
    refreshSession: async () => {},
    signIn: async () => ({ error: null }),
    signUp: async () => ({ error: null }),
    signOut: async () => {},
    resetPassword: async () => ({ error: null }),
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
