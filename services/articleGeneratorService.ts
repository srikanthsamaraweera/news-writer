import { GoogleGenAI } from "@google/genai";
import type { GroundingSource } from "../types";
import { DEFAULT_MODEL } from "../constants/models";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const MODEL_PROMPT = `Imagine yourself as an SEO expert and a world-class content writer. Your primary goal is to provide the **most recent, up-to-the-minute information** on this topic. Use Google Search to find details and developments specifically from the **last 24-48 hours**.

Write a content of 800 words on the topic. The article should:
- Prioritize the latest facts and events.
- Score high in SEO.
- Be completely original and avoid plagiarism.
- Be written in the style of a professional news reporter or a top-tier blog writer.
- Be a high-quality article with excellent readability.
- Comply with all Google AdSense program policies.
- The content should be true and accurate.
- Content should relate to Sri Lanka.
- **Your final output must be formatted as a single block of clean, well-structured HTML.** Use appropriate tags like <h1> for the main title, <h2> for subheadings, <p> for paragraphs, and <strong> for important text. Do not wrap the HTML in markdown backticks or any other formatting.`;

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

const buildPrompt = (topic: string): string =>
  `Based on the news topic "${escapeDoubleQuotes(topic)}", please perform the following task:\n\n${MODEL_PROMPT}`;

const extractGroundingSources = (response: any): GroundingSource[] => {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  return chunks
    .map((chunk: any) => ({
      uri: chunk.web?.uri ?? "",
      title: chunk.web?.title ?? "",
    }))
    .filter((source: GroundingSource) => Boolean(source.uri));
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

export interface ArticleGenerationParams {
  topic: string;
  model?: string;
}

export interface GeneratedArticle {
  html: string;
  sources: GroundingSource[];
}

export const generateArticle = async ({
  topic,
  model = DEFAULT_MODEL,
}: ArticleGenerationParams): Promise<GeneratedArticle> => {
  if (!topic.trim()) {
    throw new Error("Topic is required.");
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: buildPrompt(topic.trim()),
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const html = sanitizeArticleHtml(stripCodeFences(response.text ?? ""));
    if (!html) {
      throw new Error("The model returned an empty response.");
    }

    const sources = extractGroundingSources(response);

    return { html, sources };
  } catch (error) {
    console.error("Error generating manual article:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate article: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the article.");
  }
};
