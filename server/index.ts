import { config as loadEnv } from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import path from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const port = Number(process.env.PORT || 8787);
const geminiKey = process.env.GEMINI_API_KEY;
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const authorizedEmails = new Set(
  (process.env.AUTHORIZED_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

if (!geminiKey) {
  throw new Error("GEMINI_API_KEY is required by the server.");
}
const isAdminAuthConfigured = Boolean(firebaseProjectId && authorizedEmails.size > 0);
if (isAdminAuthConfigured && getApps().length === 0) {
  initializeApp({ projectId: firebaseProjectId });
}

const app = express();
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
  app.set("trust proxy", trustProxyHops);
}
const requestLog = new Map<string, number[]>();
const dailyUsage = new Map<string, { day: string; count: number }>();
const RATE_WINDOW_MS = 60_000;
const ANONYMOUS_RATE_LIMIT = 6;
const ANONYMOUS_DAILY_LIMIT = 50;
const AUTHORIZED_RATE_LIMIT = 12;
const AUTHORIZED_DAILY_LIMIT = 200;
const MAX_PROMPT_CHARS = 60_000;
const ALLOWED_MODELS = new Set([
  "gemini-2.5-flash",
]);

app.disable("x-powered-by");
app.use((_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://securetoken.googleapis.com; frame-src https://accounts.google.com https://*.firebaseapp.com; object-src 'none'; base-uri 'self'; form-action 'self'",
  );
  next();
});
app.use(express.json({ limit: "80kb" }));

type AuthorizedRequest = Request & { authorizedUser?: { uid: string; email: string } };

const readAuthorizedUser = async (request: AuthorizedRequest): Promise<boolean> => {
  if (!isAdminAuthConfigured) {
    return false;
  }
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const decoded = await getAuth().verifyIdToken(authorization.slice(7));
  const email = decoded.email?.toLowerCase();
  if (!email || !decoded.email_verified || !authorizedEmails.has(email)) {
    return false;
  }
  request.authorizedUser = { uid: decoded.uid, email };
  return true;
};

const requireAuthorizedUser = async (
  request: AuthorizedRequest,
  response: Response,
  next: NextFunction,
) => {
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    response.status(401).json({ error: "Authentication is required." });
    return;
  }

  try {
    const isAuthorized = await readAuthorizedUser(request);
    if (!isAuthorized) {
      response.status(403).json({ error: "This account is not authorized." });
      return;
    }
    next();
  } catch {
    response.status(401).json({ error: "Your login session is invalid or expired." });
  }
};

const readOptionalAuthorizedUser = async (
  request: AuthorizedRequest,
  response: Response,
  next: NextFunction,
) => {
  if (!request.header("authorization")) {
    next();
    return;
  }
  try {
    await readAuthorizedUser(request);
    next();
  } catch {
    response.status(401).json({ error: "Your login session is invalid or expired." });
  }
};

const enforceRateLimit = (request: AuthorizedRequest, response: Response, next: NextFunction) => {
  const isAuthorized = Boolean(request.authorizedUser);
  const clientAddress = request.ip || request.socket.remoteAddress || "unknown";
  const key = isAuthorized ? `user:${request.authorizedUser?.uid}` : `ip:${clientAddress}`;
  const minuteLimit = isAuthorized ? AUTHORIZED_RATE_LIMIT : ANONYMOUS_RATE_LIMIT;
  const dailyLimit = isAuthorized ? AUTHORIZED_DAILY_LIMIT : ANONYMOUS_DAILY_LIMIT;

  const now = Date.now();
  const recent = (requestLog.get(key) || []).filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  if (recent.length >= minuteLimit) {
    response.setHeader("Retry-After", "60");
    response.status(429).json({ error: "Too many Gemini requests. Please wait a minute and try again." });
    return;
  }
  const today = new Date(now).toISOString().slice(0, 10);
  const daily = dailyUsage.get(key);
  const currentDaily = daily?.day === today ? daily : { day: today, count: 0 };
  if (currentDaily.count >= dailyLimit) {
    response.status(429).json({ error: "The daily Gemini request limit has been reached." });
    return;
  }
  recent.push(now);
  currentDaily.count += 1;
  requestLog.set(key, recent);
  dailyUsage.set(key, currentDaily);
  next();
};

app.get("/api/auth/me", requireAuthorizedUser, (request: AuthorizedRequest, response: Response) => {
  response.json({ email: request.authorizedUser?.email });
});

app.post(
  "/api/gemini/generate",
  readOptionalAuthorizedUser,
  enforceRateLimit,
  async (request: AuthorizedRequest, response: Response) => {
    const { model, contents, useGoogleSearch } = request.body ?? {};
    if (typeof model !== "string" || !ALLOWED_MODELS.has(model)) {
      response.status(400).json({ error: "The selected model is not allowed." });
      return;
    }
    if (typeof contents !== "string" || !contents.trim() || contents.length > MAX_PROMPT_CHARS) {
      response.status(400).json({ error: "The prompt is empty or exceeds the 60,000-character limit." });
      return;
    }

    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: contents }] }],
            tools: useGoogleSearch ? [{ google_search: {} }] : undefined,
          }),
        },
      );
      if (!geminiResponse.ok) {
        const errorPayload = await geminiResponse.json().catch(() => null) as
          | { error?: { status?: string; message?: string } }
          | null;
        const upstreamStatus = errorPayload?.error?.status;
        const upstreamMessage = errorPayload?.error?.message;
        console.error("Gemini upstream error", {
          httpStatus: geminiResponse.status,
          status: upstreamStatus,
          message: upstreamMessage,
          model,
        });

        if (geminiResponse.status === 401 || geminiResponse.status === 403) {
          response.status(502).json({
            error: "Gemini rejected the server API key. Check that the key is valid and permits server-side Generative Language API requests.",
          });
          return;
        }
        if (geminiResponse.status === 404) {
          response.status(502).json({
            error: `The Gemini model "${model}" is unavailable for this API key.`,
          });
          return;
        }
        if (geminiResponse.status === 429) {
          response.status(429).json({
            error: useGoogleSearch
              ? "Google Search grounding is unavailable or its quota is exhausted for this Gemini project. Enable Gemini API billing or use a project with Search-grounding quota."
              : "Gemini quota or rate limit exceeded. Check the Google AI usage dashboard and try again later.",
          });
          return;
        }
        if (geminiResponse.status === 400) {
          response.status(502).json({
            error: upstreamMessage
              ? `Gemini rejected the request: ${upstreamMessage}`
              : "Gemini rejected the request as invalid.",
          });
          return;
        }
        throw new Error(`Gemini returned status ${geminiResponse.status}`);
      }
      const result = await geminiResponse.json() as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          groundingMetadata?: {
            groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
          };
        }>;
      };
      const candidate = result.candidates?.[0];
      const text = candidate?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("") ?? "";
      const groundingChunks = candidate?.groundingMetadata?.groundingChunks ?? [];
      response.json({
        text,
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: groundingChunks.map((chunk) => ({
                web: chunk.web
                  ? { uri: chunk.web.uri ?? "", title: chunk.web.title ?? "" }
                  : undefined,
              })),
            },
          },
        ],
      });
    } catch (error) {
      console.error("Gemini request failed", error);
      response.status(502).json({ error: "Gemini could not complete the request. Please try again." });
    }
  },
);

const currentFile = fileURLToPath(import.meta.url);
const distDirectory = path.resolve(path.dirname(currentFile), "../dist");
app.use(express.static(distDirectory, { index: false }));
app.use((request, response, next) => {
  if (request.method !== "GET" || request.path.startsWith("/api/")) {
    next();
    return;
  }
  response.sendFile(path.join(distDirectory, "index.html"));
});

app.listen(port, () => {
  console.log(`Secure news writer server listening on port ${port}`);
});
