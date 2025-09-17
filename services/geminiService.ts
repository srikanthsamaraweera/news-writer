import { GoogleGenAI } from "@google/genai";
import type { NewsTopic } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

interface RawNewsTopic {
  topic: string;
  summary: string;
}

export const fetchTrendingTopics = async (model: string = DEFAULT_GEMINI_MODEL): Promise<NewsTopic[]> => {
  try {
    const response = await ai.models.generateContent({
      model,
      contents: "List the top 20 trending positive or uplifting news topics in Sri Lanka in the last 24 hours. Focus on stories about progress, achievements, community, or positive developments. Avoid topics related to crime, political conflict, or disasters. For each topic, provide a concise one-sentence summary. IMPORTANT: Your response must be a valid JSON object with a single key 'trends' which is an array of objects. Each object in the array must have two string properties: 'topic' and 'summary'. Do not include any other text, markdown, or explanations outside of the JSON object.",
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const sources = groundingMetadata?.groundingChunks?.map(chunk => ({
      uri: chunk.web?.uri ?? '',
      title: chunk.web?.title ?? ''
    })).filter(source => source.uri) ?? [];

    let text = response.text.trim();

    // The model may wrap the JSON in markdown backticks, so we extract it.
    const jsonRegex = /```(json)?([\s\S]*?)```/;
    const match = text.match(jsonRegex);
    if (match && match[2]) {
      text = match[2];
    }

    const parsed = JSON.parse(text) as { trends: RawNewsTopic[] };

    if (!parsed.trends || !Array.isArray(parsed.trends)) {
      throw new Error("Invalid response format from API. Expected a 'trends' array.");
    }

    const topicsWithSources: NewsTopic[] = parsed.trends.map(topic => ({
      ...topic,
      sources: sources, // For this app, we'll associate all found sources with each topic.
    }));

    return topicsWithSources;

  } catch (error) {
    console.error("Error fetching trending topics:", error);
    if (error instanceof Error) {
      if (error.name === 'SyntaxError') {
        throw new Error(`Failed to parse the JSON response from the API. Please try again.`);
      }
      throw new Error(`Failed to fetch news trends: ${error.message}`);
    }
    throw new Error("An unknown error occurred while fetching news trends.");
  }
};

export const generateDetailedSummary = async (topic: string, model: string = DEFAULT_GEMINI_MODEL): Promise<string> => {
  try {
    const prompt = `Based on the news topic "${topic}", please perform the following task:

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
- **Your final output must be formatted as a single block of clean, well-structured HTML.** Use appropriate tags like <h1> for the main title, <h2> for subheadings, <p> for paragraphs, and <strong> for important text. Do not wrap the HTML in markdown backticks or any other formatting.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return response.text;
  } catch (error) {
    console.error("Error generating detailed summary:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate details: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating details.");
  }
};
