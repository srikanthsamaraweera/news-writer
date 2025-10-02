import { GoogleGenAI } from "@google/genai";
import type { NewsTopic } from "../types";
import { DEFAULT_MODEL } from "../constants/models";
import type { GeneratedDetailedArticle } from "./geminiService";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

interface RawNewsTopic {
  topic: string;
  summary: string;
}

interface FetchRailwayTopicsOptions {
  model?: string;
}

const jsonFencePattern = /```(json)?([\s\S]*?)```/i;

const stripCodeFences = (text: string): string => {
  if (!text) {
    return "";
  }
  const fenceMatch = text.match(/```(?:html)?([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
  return text.trim();
};

const escapeDoubleQuotes = (value: string): string => value.replace(/"/g, '\\"');

const OUTPUT_FORMAT_INSTRUCTIONS = `Return your final answer as a JSON object with exactly two keys: "articleHtml" and "seoKeywords".
- The "articleHtml" value must contain the full HTML article string suitable for direct rendering.
- The "seoKeywords" value must be an array of 6 to 10 unique keyword phrases tailored for Yoast SEO; each phrase should be concise (maximum five words).
- Do not add explanatory text, commentary, or markdown fences outside of the JSON object.`;

const extractJsonPayload = (text: string): string => {
  if (!text) {
    return "";
  }
  const fenceMatch = text.match(/```(?:json)?([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
  return text.trim();
};

const sanitizeArticleHtml = (rawHtml: string): string => {
  const withoutDoctype = rawHtml.replace(/<!DOCTYPE[^>]*>/gi, "").trim();

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return withoutDoctype
      .replace(/<\/?\s*html[^>]*>/gi, "")
      .replace(/<\/?\s*body[^>]*>/gi, "")
      .replace(/<\/?\s*head[^>]*>/gi, "")
      .replace(/<\/?\s*meta[^>]*>/gi, "")
      .replace(/<\/?\s*title[^>]*>/gi, "")
      .trim();
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(withoutDoctype, "text/html");
  doc.querySelectorAll("script, style, head, title, meta, link").forEach((node) => node.remove());
  const sanitized = doc.body.innerHTML.trim();
  return sanitized || withoutDoctype;
};


export const fetchRailwayTopics = async (
  options: FetchRailwayTopicsOptions = {}
): Promise<NewsTopic[]> => {
  const { model = DEFAULT_MODEL } = options;
  const sessionSalt = Math.random().toString(36).slice(2, 10);
  const thematicEmphases = [
    "coastal journeys and seaside vistas",
    "highland escapes and cool-climate adventures",
    "luxury train experiences and premium comfort",
    "family-friendly itineraries and gentle excursions",
    "photography hotspots and dramatic landscapes",
    "culinary discoveries and station-side flavors",
    "heritage locomotives and railway history",
    "wellness getaways and slow travel retreats",
    "festivals, cultural events, and trackside celebrations",
    "eco-conscious travel and sustainable initiatives"
  ];
  const focusHint = thematicEmphases[Math.floor(Math.random() * thematicEmphases.length)];

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `You are curating ideas for SriLankanRailways.com, a travel and lifestyle magazine about the island's rail network. The current session salt is "${sessionSalt}". Use this salt to influence your creative choices so each request with a different salt produces a noticeably different collection of ideas. For this session, place a gentle emphasis on ${focusHint}, while still keeping the overall set diverse.

Leverage Gemini's Google Search capability together with reputable Sri Lankan news and travel websites to surface timely coverage. Compile 30 distinct railway-related story ideas in a valid JSON object with the single key "trends" that maps to an array of objects. Each object must contain two string fields: "topic" and "summary".

Order the array in strict descending chronological order: topic 1 should be the most recent development and topic 30 the oldest. If you must reference older evergreen pieces to reach 30 items, place them toward the end. In every summary, mention the relevant timeframe or publication date (e.g., "October 2025", "last week") and briefly explain why the story would appeal to tourists or rail enthusiasts. Do not fabricate future-dated events.

Keep the phrasing engaging and magazine-worthy. Return only the JSON. Do not wrap it in markdown or add commentary.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const sources =
      groundingMetadata?.groundingChunks
        ?.map((chunk) => ({
          uri: chunk.web?.uri ?? "",
          title: chunk.web?.title ?? "",
        }))
        .filter((source) => source.uri) ?? [];

    let text = (response.text ?? "").trim();

    const match = text.match(jsonFencePattern);
    if (match && match[2]) {
      text = match[2];
    }

    const parsed = JSON.parse(text) as { trends: RawNewsTopic[] };

    if (!parsed.trends || !Array.isArray(parsed.trends)) {
      throw new Error("Invalid response format from API. Expected a 'trends' array.");
    }

    const topicsWithSources: NewsTopic[] = parsed.trends.map((topic) => ({
      ...topic,
      sources,
    }));

    for (let i = topicsWithSources.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [topicsWithSources[i], topicsWithSources[j]] = [topicsWithSources[j], topicsWithSources[i]];
    }

    return topicsWithSources;
  } catch (error) {
    console.error("Error fetching railway topics:", error);
    if (error instanceof Error) {
      if (error.name === "SyntaxError") {
        throw new Error("Failed to parse the JSON response from the API. Please try again.");
      }
      throw new Error(`Failed to fetch railway trends: ${error.message}`);
    }
    throw new Error("An unknown error occurred while fetching railway topics.");
  }
};

const buildRailwayArticlePrompt = (topic: string): string =>
  `You are an expert travel journalist and SEO specialist writing for SriLankanRailways.com, an online magazine dedicated to Sri Lanka's rail journeys.

Write an original article of roughly 800 words about "${escapeDoubleQuotes(
    topic
  )}". Prioritize rich storytelling that would inspire tourists while remaining factual and respectful. The article must:
- Be completely unique and free of plagiarism.
- Feel welcoming to international travelers and local rail enthusiasts alike.
- Highlight sensory details, cultural context, history, practical tips, and reasons the subject is special.
- Be structured for outstanding SEO performance without keyword stuffing.
- Remain suitable for Google AdSense and family-friendly audiences.
- Adopt a polished magazine tone consistent with SriLankanRailways.com.
- Present the final article content in clean, well-structured HTML using tags like <h1>, <h2>, <p>, <strong>, and <ul>/<li>; avoid markdown backticks or extraneous wrappers.

${OUTPUT_FORMAT_INSTRUCTIONS}`;


export const generateRailwayArticle = async (
  topic: string,
  model: string = DEFAULT_MODEL
): Promise<GeneratedDetailedArticle> => {
  if (!topic.trim()) {
    throw new Error("Topic is required.");
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: buildRailwayArticlePrompt(topic.trim()),
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const payloadText = extractJsonPayload(response.text ?? "");
    if (!payloadText) {
      throw new Error("The model returned an empty response.");
    }

    let parsed: { articleHtml?: string; article_html?: string; seoKeywords?: unknown; seo_keywords?: unknown };
    try {
      parsed = JSON.parse(payloadText);
    } catch {
      throw new Error("Failed to parse the JSON response from the model. Please try again.");
    }

    const rawHtml =
      typeof parsed.articleHtml === "string"
        ? parsed.articleHtml
        : typeof parsed.article_html === "string"
        ? parsed.article_html
        : "";
    if (!rawHtml) {
      throw new Error("The model response did not include an articleHtml value.");
    }

    const html = sanitizeArticleHtml(stripCodeFences(rawHtml));
    if (!html) {
      throw new Error("The model returned an empty article.");
    }

    const rawKeywords = Array.isArray(parsed.seoKeywords)
      ? parsed.seoKeywords
      : Array.isArray(parsed.seo_keywords)
      ? parsed.seo_keywords
      : [];
    const seoKeywords = rawKeywords
      .map((keyword) => (typeof keyword === "string" ? keyword.trim() : ""))
      .filter((keyword, index, array) => Boolean(keyword) && array.indexOf(keyword) === index);

    return { html, seoKeywords };
  } catch (error) {
    console.error("Error generating railway article:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate railway article: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the railway article.");
  }
};
