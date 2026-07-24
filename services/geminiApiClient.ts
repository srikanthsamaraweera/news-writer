import { auth } from "./firebaseAuth";

type GenerateRequest = {
  model: string;
  contents: string;
  config?: {
    tools?: Array<{ googleSearch?: Record<string, never> }>;
  };
};

export type GeminiProxyResponse = {
  text?: string;
  candidates?: Array<{
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: { uri?: string; title?: string };
      }>;
    };
  }>;
};

export const generateGeminiContent = async (request: GenerateRequest): Promise<GeminiProxyResponse> => {
  const user = auth?.currentUser;
  const token = user ? await user.getIdToken() : null;
  const response = await fetch("/api/gemini/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      model: request.model,
      contents: request.contents,
      useGoogleSearch: Boolean(request.config?.tools?.some((tool) => tool.googleSearch)),
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | GeminiProxyResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    const message = payload && "error" in payload && payload.error
      ? payload.error
      : `Gemini request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return payload as GeminiProxyResponse;
};
