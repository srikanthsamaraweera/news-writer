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
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(isGoogleAuthConfigured);

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setIsAuthorized(false);
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
      } catch {
        setIsAuthorized(false);
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
      login: async () => {
        await signInWithGoogle();
      },
      logout: signOutFromGoogle,
    }),
    [user, isAuthorized, isLoading],
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
