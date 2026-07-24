import { DEFAULT_MODEL } from "../constants/models";
import type { GroundingSource, NewsTopic } from "../types";
import { generateGeminiContent } from "./geminiApiClient";
import { toSafeExternalUrl } from "../utils/contentSecurity";


const jsonFencePattern = /```(json)?([\s\S]*?)```/i;

interface RawManualTopic {
  topic?: unknown;
  summary?: unknown;
}

interface ManualTopicsPayload {
  recentTopics?: unknown;
  fallbackTopics?: unknown;
}

interface ManualTopicsOptions {
  query: string;
  model?: string;
}

export interface ManualTopicsResult {
  topics: NewsTopic[];
  usedFallback: boolean;
}

const escapeDoubleQuotes = (value: string): string => value.replace(/"/g, '\\"');

const buildManualTopicsPrompt = (query: string): string =>
  `You are a real-time news researcher. Use Google Search and the freshest available information to find developments related to "${escapeDoubleQuotes(
    query
  )}" from the last 24 hours.

Return your answer strictly as JSON with the following shape:
{
  "recentTopics": [{ "topic": string, "summary": string }],
  "fallbackTopics": [{ "topic": string, "summary": string }]
}

- "recentTopics" must contain up to 20 unique items from the last 24 hours only. Leave it empty if no truly recent coverage exists.
- "fallbackTopics" must always contain 20 relevant items even if they are older (mention the timeframe in the summary when possible).
- Each summary should stay under 35 words and note timing cues such as "reported 5 hours ago" or "update from March 2024" when helpful.
- Do not include markdown fences, explanations, or additional keys outside of the specified JSON structure.`;

const coerceTopicsArray = (value: unknown): RawManualTopic[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is RawManualTopic =>
      typeof item === "object" &&
      item !== null &&
      "topic" in item &&
      "summary" in item &&
      typeof (item as RawManualTopic).topic === "string" &&
      typeof (item as RawManualTopic).summary === "string"
  );
};

const mapTopics = (rawTopics: RawManualTopic[], sources: GroundingSource[]): NewsTopic[] =>
  rawTopics
    .map((raw) => ({
      topic: String(raw.topic).trim(),
      summary: String(raw.summary).trim(),
      sources,
    }))
    .filter((topic) => topic.topic.length > 0 && topic.summary.length > 0);

export const fetchManualTopics = async ({
  query,
  model = DEFAULT_MODEL,
}: ManualTopicsOptions): Promise<ManualTopicsResult> => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error("Please provide a topic before generating.");
  }

  try {
    const response = await generateGeminiContent({
      model,
      contents: buildManualTopicsPrompt(trimmedQuery),
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const sources: GroundingSource[] =
      groundingMetadata?.groundingChunks
        ?.map((chunk) => ({
          uri: toSafeExternalUrl(chunk.web?.uri ?? "") ?? "",
          title: chunk.web?.title ?? "",
        }))
        .filter((source) => Boolean(source.uri)) ?? [];

    let text = (response.text ?? "").trim();
    const match = text.match(jsonFencePattern);
    if (match && match[2]) {
      text = match[2].trim();
    }

    if (!text) {
      throw new Error("The model returned an empty response.");
    }

    let parsed: ManualTopicsPayload;
    try {
      parsed = JSON.parse(text) as ManualTopicsPayload;
    } catch (error) {
      throw new Error("Failed to parse the JSON response from the API. Please try again.");
    }

    const recentTopics = coerceTopicsArray(parsed.recentTopics);
    const fallbackTopics = coerceTopicsArray(parsed.fallbackTopics);

    const mappedRecent = mapTopics(recentTopics.slice(0, 20), sources);
    const mappedFallback = mapTopics(fallbackTopics.slice(0, 20), sources);

    const finalTopics = mappedRecent.length > 0 ? mappedRecent : mappedFallback;
    const usedFallback = mappedRecent.length === 0;

    if (finalTopics.length === 0) {
      throw new Error("No topics were returned from the API. Please refine your prompt and try again.");
    }

    return {
      topics: finalTopics,
      usedFallback,
    };
  } catch (error) {
    console.error("Error fetching manual topics:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch manual topics: ${error.message}`);
    }
    throw new Error("An unknown error occurred while fetching manual topics.");
  }
};
