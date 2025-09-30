import { GoogleGenAI } from "@google/genai";
import type { NewsTopic } from "../types";
import { DEFAULT_MODEL } from "../constants/models";

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

export const fetchRailwayTopics = async (
  options: FetchRailwayTopicsOptions = {}
): Promise<NewsTopic[]> => {
  const { model = DEFAULT_MODEL } = options;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `You are curating ideas for SriLankanRailways.com, a travel and lifestyle magazine about the island's rail network. Generate a JSON object with the single key "trends" that maps to an array containing 30 distinct railway-related topic objects. Each object must include two string fields: "topic" and "summary".

The topics should be a varied and imaginative mix covering scenic train journeys, luxury or heritage experiences, insider tips, cultural stories along the routes, major stations, history, engineering feats, rail excursions, photography hotspots, dining options, and other stories that would delight tourists and rail enthusiasts alike. It is fine to include timeless or evergreen ideas—these do not need to be recent news.

Keep the phrasing engaging and magazine-worthy. Summaries should highlight why the subject appeals to travelers or showcases something special about Sri Lankan railways.

Return only the JSON. Do not wrap it in markdown or add commentary.`,
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

Deliver the final output as a single block of clean, semantic HTML (use <h1>, <h2>, <p>, <strong>, <ul>/<li> if needed). Do not include markdown fences or explanatory text.`;

export const generateRailwayArticle = async (
  topic: string,
  model: string = DEFAULT_MODEL
): Promise<string> => {
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

    const html = stripCodeFences(response.text ?? "");
    if (!html) {
      throw new Error("The model returned an empty response.");
    }
    return html;
  } catch (error) {
    console.error("Error generating railway article:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate railway article: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the railway article.");
  }
};
