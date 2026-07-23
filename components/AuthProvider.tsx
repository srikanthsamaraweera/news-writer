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

const authorizedEmails = new Set(
  (import.meta.env.VITE_AUTHORIZED_EMAILS ?? "")
    .split(",")
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean),
);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(isGoogleAuthConfigured);

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthorized: Boolean(
        user?.email &&
          user.emailVerified &&
          authorizedEmails.has(user.email.toLowerCase()),
      ),
      isLoading,
      isConfigured: isGoogleAuthConfigured,
      login: async () => {
        await signInWithGoogle();
      },
      logout: signOutFromGoogle,
    }),
    [user, isLoading],
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
