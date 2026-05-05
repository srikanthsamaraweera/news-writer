import React from "react";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";

interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  return (
    <>
      <SignedOut>
        <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
          <div
            className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),_rgba(15,23,42,0.95))]"
            aria-hidden="true"
          />
          <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
            <div className="rounded-3xl border border-slate-700 bg-slate-900/75 p-8 shadow-2xl backdrop-blur">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
                Sign in
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Sign in to access the article generator and create WordPress drafts.
              </p>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-cyan-400 px-6 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-300"
                >
                  Continue
                </button>
              </SignInButton>
            </div>
          </main>
        </div>
      </SignedOut>
      <SignedIn>
        <div>
          <div className="fixed right-4 top-4 z-50 rounded-full border border-slate-700 bg-slate-950/80 p-2 shadow-xl backdrop-blur">
            <UserButton afterSignOutUrl="/" />
          </div>
          {children}
        </div>
      </SignedIn>
    </>
  );
};
