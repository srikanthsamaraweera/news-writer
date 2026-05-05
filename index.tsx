import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const MissingClerkKey = () => (
  <div style={{ minHeight: "100vh", padding: "48px", background: "#020617", color: "#e2e8f0" }}>
    <h1 style={{ margin: 0, fontSize: "28px" }}>Clerk is not configured</h1>
    <p style={{ maxWidth: "640px", lineHeight: 1.6 }}>
      Add <code>VITE_CLERK_PUBLISHABLE_KEY</code> to <code>.env.local</code>, then stop and restart
      <code> npm run dev</code>.
    </p>
  </div>
);

root.render(
  <React.StrictMode>
    {clerkPublishableKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ClerkProvider>
    ) : (
      <MissingClerkKey />
    )}
  </React.StrictMode>
);
