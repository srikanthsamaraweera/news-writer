import { GoogleGenAI } from "@google/genai";
import { DEFAULT_MODEL } from "../constants/models";
import { NEWS_WRITING_STYLE } from "../prompts/newsWritingStyle";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const stripCodeFences = (text: string): string => {
  if (!text) {
    return "";
  }
  const fenceMatch = text.match(/```(?:html|json)?([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
  return text.trim();
};

const escapeDoubleQuotes = (value: string): string => value.replace(/"/g, '\\"');

const OUTPUT_FORMAT_INSTRUCTIONS = `Return your final answer strictly as JSON with the following shape:
{
  "articleHtml": string,
  "yoast": {
    "seoTitle": string,
    "focusKeyphrase": string,
    "metaDescription": string,
    "slug": string,
    "keyphraseSynonyms": string[],
    "seoKeywords": string[]
  }
}

- The "articleHtml" must contain only body-safe HTML tags (h1-h3, p, ul, ol, li, strong, em, blockquote, a). Avoid <html>, <head>, or <body>.
- Populate every Yoast field with the strongest possible option for ranking and readability.
- Do not include markdown fences, explanations, or additional keys.`;

const buildPrompt = (topic: string): string =>
  `You are a rigorous digital news editor. Using Google Search and the latest reliable information available from the last 24-48 hours, craft an original article of about 600 words about "${escapeDoubleQuotes(
    topic
  )}".

Requirements:
- Verify important claims across reputable sources and never invent facts, quotations, dates, statistics, sources, or connections.
- Ensure full compliance with Google AdSense policies.
- Highlight Sri Lanka connections only when they are factual and relevant.
- Use body-safe HTML and logical headings only where they help the reader.
- Deliver Yoast SEO values that are ready to paste into a WordPress post editor.

${NEWS_WRITING_STYLE}

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
      .replace(/<\/?\s*head[^>]*>/gi, "")
      .replace(/<\/?\s*body[^>]*>/gi, "")
      .trim();
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(withoutDoctype, "text/html");
  doc.querySelectorAll("script, style, head, title, meta, link").forEach((node) => node.remove());
  const sanitized = doc.body.innerHTML.trim();
  return sanitized || withoutDoctype;
};

export interface ManualTopicArticleParams {
  topic: string;
  model?: string;
}

export interface ManualTopicArticleResult {
  html: string;
  yoast: {
    seoTitle: string;
    focusKeyphrase: string;
    metaDescription: string;
    slug: string;
    keyphraseSynonyms: string[];
    seoKeywords: string[];
  };
}

export const generateManualTopicArticle = async ({
  topic,
  model = DEFAULT_MODEL,
}: ManualTopicArticleParams): Promise<ManualTopicArticleResult> => {
  if (!topic.trim()) {
    throw new Error("Topic is required to generate an article.");
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: buildPrompt(topic.trim()),
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const payloadText = extractJsonPayload(response.text ?? "");
    if (!payloadText) {
      throw new Error("The model returned an empty response.");
    }

    let parsed: {
      articleHtml?: string;
      article_html?: string;
      yoast?: {
        seoTitle?: unknown;
        focusKeyphrase?: unknown;
        metaDescription?: unknown;
        slug?: unknown;
        keyphraseSynonyms?: unknown;
        seoKeywords?: unknown;
      };
    };
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

    const yoast = parsed.yoast ?? {};
    const sanitizeString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
    const sanitizeStringArray = (value: unknown): string[] =>
      Array.isArray(value)
        ? value
            .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
            .filter((entry, index, array) => Boolean(entry) && array.indexOf(entry) === index)
        : [];

    const seoTitle = sanitizeString(yoast.seoTitle);
    const focusKeyphrase = sanitizeString(yoast.focusKeyphrase);
    const metaDescription = sanitizeString(yoast.metaDescription);
    const slug = sanitizeString(yoast.slug);
    const keyphraseSynonyms = sanitizeStringArray(yoast.keyphraseSynonyms);
    const seoKeywords = sanitizeStringArray(yoast.seoKeywords);

    if (!seoTitle || !focusKeyphrase || !metaDescription || !slug) {
      throw new Error("The model response did not include all required Yoast SEO fields.");
    }

    return {
      html,
      yoast: {
        seoTitle,
        focusKeyphrase,
        metaDescription,
        slug,
        keyphraseSynonyms,
        seoKeywords,
      },
    };
  } catch (error) {
    console.error("Error generating manual topic article:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate article: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the article.");
  }
};
