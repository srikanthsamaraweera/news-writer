import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const apiKey = process.env.GEMINI_API_KEY;
const model = process.argv.find((argument) => argument.startsWith("gemini-")) || "gemini-2.5-flash";
const useGoogleSearch = process.argv.includes("--search");

if (!apiKey) {
  console.error("GEMINI_API_KEY is missing. Add it to .env.local.");
  process.exit(1);
}

const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "Reply with only the word OK." }] }],
      tools: useGoogleSearch ? [{ google_search: {} }] : undefined,
    }),
  },
);

const payload = await response.json().catch(() => null) as
  | { error?: { code?: number; status?: string; message?: string } }
  | { candidates?: unknown[] }
  | null;

if (!response.ok) {
  const error = payload && "error" in payload ? payload.error : undefined;
  console.error(`Gemini check failed: HTTP ${response.status}`);
  if (error?.status) console.error(`Status: ${error.status}`);
  if (error?.message) console.error(`Message: ${error.message}`);
  process.exit(1);
}

console.log(
  `Gemini check passed for ${model}${useGoogleSearch ? " with Google Search" : ""} (HTTP ${response.status}).`,
);
