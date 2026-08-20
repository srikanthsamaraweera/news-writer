import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  auth,
  isGoogleAuthConfigured,
  signInWithGoogle,
  signOutFromGoogle,
} from "../services/firebaseAuth";

type AuthContextValue = {
  user: User | null;
  isAuthorized: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  authorizationError: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authorizationError, setAuthorizationError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isGoogleAuthConfigured);

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setIsAuthorized(false);
      setAuthorizationError(null);
      if (!nextUser) {
        setIsLoading(false);
        return;
      }

      try {
        const token = await nextUser.getIdToken();
        const response = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsAuthorized(response.ok);
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: string } | null;
          setAuthorizationError(
            payload?.error || `Authorization API returned HTTP ${response.status}.`,
          );
        }
      } catch (error) {
        setIsAuthorized(false);
        setAuthorizationError(
          error instanceof Error ? error.message : "The authorization API could not be reached.",
        );
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthorized,
      isLoading,
      isConfigured: isGoogleAuthConfigured,
      authorizationError,
      login: async () => {
        await signInWithGoogle();
      },
      logout: signOutFromGoogle,
    }),
    [user, isAuthorized, isLoading, authorizationError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
};
