
import type { GroundingSource } from "../types";
import { DEFAULT_MODEL } from "../constants/models";
import { NEWS_WRITING_STYLE } from "../prompts/newsWritingStyle";
import { generateGeminiContent } from "./geminiApiClient";
import { sanitizeGeneratedHtml, toSafeExternalUrl } from "../utils/contentSecurity";


const MODEL_PROMPT = `Act as a rigorous digital news editor. Use Google Search to establish the most recent reliable facts from the last 24-48 hours and verify important claims across reputable sources.

Write an original article of about 800 words. The article must:
- Prioritize the latest facts and events.
- Never invent facts, quotations, dates, statistics, sources, or Sri Lankan connections.
- Relate the story to Sri Lanka where the connection is factual and relevant.
- Comply with all Google AdSense program policies.
- Present the article in clean body-safe HTML using <h1>, <h2>, <p>, <strong>, <ul>, and <li> where appropriate; do not use markdown or page-level wrappers.

${NEWS_WRITING_STYLE}`;

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

const buildPrompt = (topic: string): string =>
  `Based on the news topic "${escapeDoubleQuotes(topic)}", please perform the following task:\n\n${MODEL_PROMPT}\n\n${OUTPUT_FORMAT_INSTRUCTIONS}`;

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

const extractGroundingSources = (response: any): GroundingSource[] => {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  return chunks
    .map((chunk: any) => ({
      uri: chunk.web?.uri ?? "",
      title: chunk.web?.title ?? "",
    }))
    .map((source: GroundingSource) => ({ ...source, uri: toSafeExternalUrl(source.uri) ?? "" }))
    .filter((source: GroundingSource) => Boolean(source.uri));
};

const sanitizeArticleHtml = (rawHtml: string): string => {
  return sanitizeGeneratedHtml(rawHtml);
};

export interface ArticleGenerationParams {
  topic: string;
  model?: string;
}

export interface GeneratedArticle {
  html: string;
  sources: GroundingSource[];
  seoKeywords: string[];
}

interface ArticleOptimizationParams {
  topic: string;
  articleHtml: string;
  instruction: string;
  model?: string;
}

const parseGeneratedArticle = (response: any): GeneratedArticle => {
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

  return {
    html,
    seoKeywords,
    sources: extractGroundingSources(response),
  };
};

export const generateArticle = async ({
  topic,
  model = DEFAULT_MODEL,
}: ArticleGenerationParams): Promise<GeneratedArticle> => {
  if (!topic.trim()) {
    throw new Error("Topic is required.");
  }

  try {
    const response = await generateGeminiContent({
      model,
      contents: buildPrompt(topic.trim()),
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    return parseGeneratedArticle(response);
  } catch (error) {
    console.error("Error generating manual article:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate article: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the article.");
  }
};

export const optimizeArticle = async ({
  topic,
  articleHtml,
  instruction,
  model = DEFAULT_MODEL,
}: ArticleOptimizationParams): Promise<GeneratedArticle> => {
  if (!articleHtml.trim() || !instruction.trim()) {
    throw new Error("The current article and an optimization instruction are required.");
  }

  const prompt = `Revise the existing article about "${escapeDoubleQuotes(topic)}" by following the user's instruction.

User instruction:
${instruction.trim()}

Existing article HTML:
${articleHtml}

Requirements:
- Return the complete revised article, not a list of suggestions or a partial excerpt.
- Preserve accurate details and the established editorial style unless the user explicitly asks to change them.
- Use Google Search to verify any new or time-sensitive factual claims requested by the user.
- Do not invent facts, quotations, dates, statistics, sources, or connections.
- Keep body-safe HTML and regenerate SEO keywords so they match the revised article.

${NEWS_WRITING_STYLE}

${OUTPUT_FORMAT_INSTRUCTIONS}`;

  try {
    const response = await generateGeminiContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    return parseGeneratedArticle(response);
  } catch (error) {
    console.error("Error optimizing article:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to optimize article: ${error.message}`);
    }
    throw new Error("An unknown error occurred while optimizing the article.");
  }
};
