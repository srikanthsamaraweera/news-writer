import { GoogleGenAI } from "@google/genai";
import type { NewsTopic } from "../types";
import { DEFAULT_MODEL } from "../constants/models";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

interface RawNewsTopic {
  topic: string;
  summary: string;
}

interface FetchTrendingTopicsOptions {
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

const escapeDoubleQuotes = (value: string): string => value.replace(/"/g, '\"');

const OUTPUT_FORMAT_INSTRUCTIONS = `Return your final answer as a JSON object with exactly two keys: "articleHtml" and "seoKeywords".
- The "articleHtml" value must contain the full HTML article string suitable for direct rendering.
- The "seoKeywords" value must be an array of 6 to 10 unique keyword phrases tailored for Yoast SEO; each phrase should be concise (maximum five words).
- Do not add explanatory text, commentary, or markdown fences outside of the JSON object.`;

const buildArticlePrompt = (topic: string): string =>
  `Based on the news topic "${escapeDoubleQuotes(topic)}", please perform the following task:

Imagine yourself as an SEO expert and a world-class content writer. Your primary goal is to provide the **most recent, up-to-the-minute information** on this topic. Use Google Search to find details and developments specifically from the **last 24-48 hours**.

Write a content of 800 words on the topic. The article should:
- Prioritize the latest facts and events.
- Score high in SEO.
- Be completely original and avoid plagiarism.
- Be written in the style of a professional news reporter or a top-tier blog writer.
- Be a high-quality article with excellent readability.
- Comply with all Google AdSense program policies.
- The content should be true and accurate.
- Content should relate to Sri Lanka.
- Present the final article content in clean, well-structured HTML using tags like <h1>, <h2>, <p>, and <strong>; avoid markdown backticks or extraneous wrappers.

${OUTPUT_FORMAT_INSTRUCTIONS}`;



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

export const fetchTrendingTopics = async (
  options: FetchTrendingTopicsOptions = {}
): Promise<NewsTopic[]> => {
  const { model = DEFAULT_MODEL } = options;

  try {
    const response = await ai.models.generateContent({
      model,
      contents:
        "List the top 20 trending positive or uplifting news topics in Sri Lanka in the last 24 hours. Use google search trends, sri lankan news websites and any other ways to get these topics. Focus on stories about progress, achievements, community, or positive developments. Avoid topics related to crime, political conflict, or disasters. For each topic, provide a concise one-sentence summary. IMPORTANT: Your response must be a valid JSON object with a single key 'trends' which is an array of objects. Each object in the array must have two string properties: 'topic' and 'summary'. Do not include any other text, markdown, or explanations outside of the JSON object.",
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

    return topicsWithSources;
  } catch (error) {
    console.error("Error fetching trending topics:", error);
    if (error instanceof Error) {
      if (error.name === "SyntaxError") {
        throw new Error("Failed to parse the JSON response from the API. Please try again.");
      }
      throw new Error(`Failed to fetch news trends: ${error.message}`);
    }
    throw new Error("An unknown error occurred while fetching news trends.");
  }
};

export interface GeneratedDetailedArticle {
  html: string;
  seoKeywords: string[];
}

export const generateDetailedSummary = async (
  topic: string,
  model: string = DEFAULT_MODEL
): Promise<GeneratedDetailedArticle> => {
  if (!topic.trim()) {
    throw new Error("Topic is required.");
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: buildArticlePrompt(topic.trim()),
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
    console.error("Error generating detailed summary:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate details: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating details.");
  }
};
