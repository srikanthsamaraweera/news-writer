import React, { useCallback, useEffect, useState } from "react";
import {
  getAuthStatus,
  logout,
  startWordPressLogin,
  type AuthenticatedUser,
} from "../services/authService";
import { LoadingSpinner } from "./LoadingSpinner";
import { ErrorDisplay } from "./ErrorDisplay";

interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const status = await getAuthStatus();
      setUser(status.authenticated ? status.user : null);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to check login status.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),_rgba(15,23,42,0.95))]"
          aria-hidden="true"
        />
        <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
          <div className="rounded-3xl border border-slate-700 bg-slate-900/75 p-8 shadow-2xl backdrop-blur">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
              Sign in with WordPress
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Use your WordPress account to access the article generator and create draft posts.
            </p>
            {error && (
              <div className="mt-6">
                <ErrorDisplay message={error} />
              </div>
            )}
            <button
              type="button"
              onClick={startWordPressLogin}
              className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-cyan-400 px-6 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-300"
            >
              Continue with WordPress
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div>
      <div className="fixed right-4 top-4 z-50 flex items-center gap-3 rounded-full border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs text-slate-200 shadow-xl backdrop-blur">
        <span>{user.name || user.email || "WordPress user"}</span>
        <button
          type="button"
          onClick={logout}
          className="font-semibold text-cyan-300 hover:text-cyan-200"
        >
          Sign out
        </button>
      </div>
      {children}
    </div>
  );
};
