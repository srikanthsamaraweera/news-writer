import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { DEFAULT_MODEL, GEMINI_MODEL_OPTIONS } from "../constants/models";
import type { NewsTopic } from "../types";
import { fetchManualTopics } from "../services/manualTopicsService";
import {
  generateManualTopicArticle,
  type ManualTopicArticleResult,
} from "../services/manualTopicArticleService";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorDisplay } from "../components/ErrorDisplay";
import { optimizeArticle } from "../services/articleGeneratorService";

type YoastFields = ManualTopicArticleResult["yoast"];

interface ArticleState {
  isGenerating: boolean;
  data: ManualTopicArticleResult | null;
  error: string | null;
  copySuccess: boolean;
  activeYoast: YoastFields | null;
  selectedKeyword: string | null;
}

const INITIAL_ARTICLE_STATE: ArticleState = {
  isGenerating: false,
  data: null,
  error: null,
  copySuccess: false,
  activeYoast: null,
  selectedKeyword: null,
};

const META_DESCRIPTION_MAX_LENGTH = 155;

const htmlToPlainText = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const truncateWithEllipsis = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }
  const truncated = value.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  const base = lastSpace > Math.floor(maxLength * 0.6) ? truncated.slice(0, lastSpace) : truncated;
  return base.replace(/[\s.,;:-]+$/g, "") + "...";
};

const buildMetaDescription = (keyword: string, articleHtml: string): string => {
  const plainText = htmlToPlainText(articleHtml);
  if (!plainText) {
    return truncateWithEllipsis(keyword, META_DESCRIPTION_MAX_LENGTH);
  }
  const keywordPattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  const hydratedText = keywordPattern.test(plainText) ? plainText : `${keyword}. ${plainText}`;
  const cleaned = hydratedText.replace(/\s+/g, " ").trim();
  return truncateWithEllipsis(cleaned, META_DESCRIPTION_MAX_LENGTH);
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const ensureTitleContainsKeyword = (keyword: string, baseTitle: string): string => {
  const safeTitle = baseTitle?.trim() ?? "";
  if (!safeTitle) {
    return keyword;
  }
  if (safeTitle.toLowerCase().includes(keyword.toLowerCase())) {
    return safeTitle;
  }
  return `${keyword} | ${safeTitle}`;
};

const deriveYoastFields = (baseYoast: YoastFields, articleHtml: string, keyword: string): YoastFields => {
  const seoTitle = ensureTitleContainsKeyword(keyword, baseYoast.seoTitle);
  const metaDescription = buildMetaDescription(keyword, articleHtml);
  const slugCandidate = slugify(keyword) || slugify(baseYoast.slug) || slugify(baseYoast.focusKeyphrase);
  const keyphraseSynonyms = Array.from(
    new Set(
      [...baseYoast.keyphraseSynonyms, baseYoast.focusKeyphrase]
        .map((entry) => entry?.trim())
        .filter((entry): entry is string => Boolean(entry && entry.toLowerCase() !== keyword.toLowerCase()))
    )
  );
  const seoKeywords = Array.from(new Set([keyword, ...baseYoast.seoKeywords]));

  return {
    seoTitle,
    focusKeyphrase: keyword,
    metaDescription,
    slug: slugCandidate || slugify(seoTitle),
    keyphraseSynonyms,
    seoKeywords,
  };
};

export const ManualTopicsPage: React.FC = () => {
  const [prompt, setPrompt] = useState<string>("");
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [topics, setTopics] = useState<NewsTopic[] | null>(null);
  const [usedFallback, setUsedFallback] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [articleStates, setArticleStates] = useState<Record<number, ArticleState>>({});
  const [optimizationPrompts, setOptimizationPrompts] = useState<Record<number, string>>({});

  const setArticleState = useCallback(
    (index: number, partial: Partial<ArticleState>) => {
      setArticleStates((previous) => {
        const current = previous[index] ?? INITIAL_ARTICLE_STATE;
        return {
          ...previous,
          [index]: { ...current, ...partial },
        };
      });
    },
    [setArticleStates]
  );

  const handleGenerateArticle = useCallback(
    async (index: number, topicTitle: string) => {
      setArticleState(index, {
        isGenerating: true,
        error: null,
        data: null,
        copySuccess: false,
        activeYoast: null,
        selectedKeyword: null,
      });
      try {
        const result = await generateManualTopicArticle({ topic: topicTitle, model });
        setArticleState(index, {
          isGenerating: false,
          data: result,
          error: null,
          copySuccess: false,
          activeYoast: result.yoast,
          selectedKeyword: result.yoast.focusKeyphrase,
        });
      } catch (err) {
        setArticleState(index, {
          isGenerating: false,
          error:
            err instanceof Error
              ? err.message
              : "An unexpected error occurred while generating the article.",
          copySuccess: false,
          activeYoast: null,
          selectedKeyword: null,
        });
      }
    },
    [model, setArticleState]
  );

  const handleCopyArticle = useCallback(
    async (index: number) => {
      const state = articleStates[index];
      if (!state?.data?.html) {
        setArticleState(index, {
          error: "Please generate the article before copying.",
          copySuccess: false,
        });
        return;
      }

      try {
        await navigator.clipboard.writeText(state.data.html);
        setArticleState(index, { copySuccess: true, error: null });
        window.setTimeout(() => {
          setArticleState(index, { copySuccess: false });
        }, 2000);
      } catch (err) {
        console.error("Copy failed", err);
        setArticleState(index, {
          error: "Unable to copy the article. Please try again.",
          copySuccess: false,
        });
      }
    },
    [articleStates, setArticleState]
  );

  const handleYoastKeywordClick = useCallback(
    (index: number, keyword: string) => {
      const state = articleStates[index];
      if (!state?.data) {
        return;
      }

      const derivedYoast = deriveYoastFields(state.data.yoast, state.data.html, keyword);
      setArticleState(index, {
        activeYoast: derivedYoast,
        selectedKeyword: keyword,
        error: null,
      });
    },
    [articleStates, setArticleState]
  );

  const handleOptimizeArticle = useCallback(
    async (event: React.FormEvent<HTMLFormElement>, index: number, topicTitle: string) => {
      event.preventDefault();
      const state = articleStates[index];
      const instruction = optimizationPrompts[index]?.trim();
      if (!state?.data || !instruction) {
        setArticleState(index, { error: "Enter an instruction for how you want the article changed." });
        return;
      }

      setArticleState(index, { isGenerating: true, error: null, copySuccess: false });
      try {
        const result = await optimizeArticle({
          topic: topicTitle,
          articleHtml: state.data.html,
          instruction,
          model,
        });
        const combinedYoast: YoastFields = {
          ...state.data.yoast,
          seoKeywords: Array.from(new Set([...result.seoKeywords, ...state.data.yoast.seoKeywords])),
        };
        const refreshedYoast = deriveYoastFields(
          combinedYoast,
          result.html,
          state.selectedKeyword || combinedYoast.focusKeyphrase
        );
        setArticleState(index, {
          isGenerating: false,
          data: { html: result.html, yoast: combinedYoast },
          activeYoast: refreshedYoast,
          selectedKeyword: refreshedYoast.focusKeyphrase,
          error: null,
        });
        setOptimizationPrompts((current) => ({ ...current, [index]: "" }));
      } catch (err) {
        setArticleState(index, {
          isGenerating: false,
          error: err instanceof Error ? err.message : "An unexpected error occurred.",
        });
      }
    },
    [articleStates, optimizationPrompts, model, setArticleState]
  );

  const handleGenerate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError("Please enter a prompt before generating topics.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setTopics(null);
    setUsedFallback(false);
    setArticleStates({});
    setOptimizationPrompts({});

    try {
      const result = await fetchManualTopics({ query: trimmedPrompt, model });
      setTopics(result.topics);
      setUsedFallback(result.usedFallback);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 sm:p-8 lg:p-10">
      <main className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-100">Manual Topics Generator</h1>
          <Link
            to="/"
            className="inline-flex items-center rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            Back home
          </Link>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
          <p className="mb-4 text-sm text-slate-400">
            Enter a custom prompt or guidelines to manually generate a set of news topics. Click generate once you are
            ready.
          </p>

          <form onSubmit={handleGenerate} className="space-y-4">
            <label htmlFor="manual-topics-prompt" className="block text-sm font-semibold text-slate-300">
              Prompt
            </label>
            <textarea
              id="manual-topics-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="w-full min-h-[180px] resize-y rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              placeholder="Describe the type of topics you would like to generate..."
            />

            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="manual-topics-model" className="text-sm font-semibold text-slate-300">
                Gemini model
              </label>
              <select
                id="manual-topics-model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="rounded-full border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition"
              >
                {GEMINI_MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-slate-900">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isGenerating || !prompt.trim()}
              className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-8 py-3 text-lg font-bold text-slate-900 shadow-lg transition-all duration-200 hover:bg-cyan-300 focus:outline-none focus:ring-4 focus:ring-cyan-400 focus:ring-opacity-60 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {isGenerating ? "Generating..." : "Generate Topics"}
            </button>
          </form>
        </section>

        <div className="mt-8 space-y-6">
          {error && <ErrorDisplay message={error} />}

          {isGenerating && (
            <div className="flex justify-center">
              <LoadingSpinner />
            </div>
          )}

          {topics && (
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
              <header>
                {usedFallback ? (
                  <p className="text-sm font-semibold text-amber-300">
                    nothing from last 24 hours - displaying 20 older topics related to your prompt.
                  </p>
                ) : (
                  <p className="text-sm text-slate-400">Showing up to 20 trending topics from the last 24 hours.</p>
                )}
              </header>

              <ul className="mt-4 space-y-4">
                {topics.map((topic, index) => {
                  const articleState = articleStates[index] ?? INITIAL_ARTICLE_STATE;
                  const activeYoast = articleState.activeYoast ?? articleState.data?.yoast ?? null;
                  const baseYoast = articleState.data?.yoast ?? null;
                  const baseKeywords = baseYoast?.seoKeywords ?? [];
                  const keywordOptions = Array.from(
                    new Set(
                      [baseYoast?.focusKeyphrase, ...baseKeywords, ...(activeYoast?.seoKeywords ?? [])].filter(
                        (entry): entry is string => Boolean(entry)
                      )
                    )
                  );

                  return (
                    <li
                      key={`${topic.topic}-${index}`}
                      className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm transition hover:border-cyan-500/40"
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          #{index + 1}
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-semibold text-slate-100">{topic.topic}</h3>
                      <p className="mt-2 text-sm text-slate-300">{topic.summary}</p>
                      {topic.sources.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</p>
                          <ul className="mt-1 space-y-1 text-xs text-slate-400">
                            {topic.sources.map((source, sourceIndex) => (
                              <li key={`${source.uri || source.title}-${sourceIndex}`}>
                                {source.uri ? (
                                  <a
                                    href={source.uri}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="text-cyan-300 hover:text-cyan-200"
                                  >
                                    {source.title?.trim() || source.uri}
                                  </a>
                                ) : (
                                  <span>{source.title}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleGenerateArticle(index, topic.topic)}
                          disabled={articleState.isGenerating}
                          className="inline-flex items-center rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow hover:bg-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-400 focus:ring-opacity-60 disabled:cursor-not-allowed disabled:bg-slate-500"
                        >
                          {articleState.isGenerating ? "Generating..." : "Generate article"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyArticle(index)}
                          disabled={!articleState.data || articleState.isGenerating}
                          className="inline-flex items-center rounded-full border border-cyan-400 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/10 focus:outline-none focus:ring-4 focus:ring-cyan-400 focus:ring-opacity-60 disabled:cursor-not-allowed disabled:border-slate-600 disabled:text-slate-500"
                        >
                          Copy HTML
                        </button>
                        {articleState.copySuccess && (
                          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                            Copied!
                          </span>
                        )}
                      </div>

                      {articleState.isGenerating && (
                        <p className="mt-3 text-sm text-cyan-300">Generating article content...</p>
                      )}

                      {articleState.error && (
                        <p className="mt-3 text-sm text-rose-300">{articleState.error}</p>
                      )}

                      {articleState.data && activeYoast && (
                        <div className="mt-4 space-y-4">
                          <div
                            className="prose prose-invert max-w-none text-slate-100"
                            dangerouslySetInnerHTML={{ __html: articleState.data.html }}
                          />

                          <form
                            onSubmit={(event) => handleOptimizeArticle(event, index, topic.topic)}
                            className="rounded-xl border border-cyan-400/30 bg-slate-900/60 p-4"
                          >
                            <label
                              htmlFor={`manual-optimization-${index}`}
                              className="text-sm font-semibold text-cyan-200"
                            >
                              Optimize this article
                            </label>
                            <textarea
                              id={`manual-optimization-${index}`}
                              value={optimizationPrompts[index] ?? ""}
                              onChange={(event) =>
                                setOptimizationPrompts((current) => ({
                                  ...current,
                                  [index]: event.target.value,
                                }))
                              }
                              placeholder="e.g. Strengthen the headline and make the article more concise"
                              rows={3}
                              disabled={articleState.isGenerating}
                              className="mt-2 w-full resize-y rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:opacity-70"
                            />
                            <button
                              type="submit"
                              disabled={!optimizationPrompts[index]?.trim() || articleState.isGenerating}
                              className="mt-3 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
                            >
                              {articleState.isGenerating ? "Optimizing..." : "Apply optimization"}
                            </button>
                          </form>

                          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                              Yoast SEO fields
                            </h4>
                            <dl className="mt-3 space-y-3 text-sm text-slate-300">
                              <div>
                                <dt className="font-semibold text-slate-200">SEO title</dt>
                                <dd className="mt-1">{activeYoast.seoTitle}</dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-slate-200">Focus keyphrase</dt>
                                <dd className="mt-1">{activeYoast.focusKeyphrase}</dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-slate-200">Meta description</dt>
                                <dd className="mt-1">{activeYoast.metaDescription}</dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-slate-200">Slug</dt>
                                <dd className="mt-1">{activeYoast.slug}</dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-slate-200">Keyphrase synonyms</dt>
                                <dd className="mt-1">
                                  {activeYoast.keyphraseSynonyms.length > 0
                                    ? activeYoast.keyphraseSynonyms.join(", ")
                                    : "None"}
                                </dd>
                              </div>
                            </dl>

                            {keywordOptions.length > 0 && (
                              <div className="mt-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Additional SEO keywords
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {keywordOptions.map((keyword) => {
                                    const isSelected =
                                      articleState.selectedKeyword?.toLowerCase() === keyword.toLowerCase();
                                    return (
                                      <button
                                        key={keyword}
                                        type="button"
                                        onClick={() => handleYoastKeywordClick(index, keyword)}
                                        disabled={articleState.isGenerating}
                                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                                          isSelected
                                            ? "border-cyan-200 bg-cyan-300 text-slate-900"
                                            : "border-cyan-400/50 text-cyan-200 hover:bg-cyan-500/10"
                                        } ${
                                          articleState.isGenerating ? "cursor-not-allowed opacity-70" : ""
                                        }`}
                                      >
                                        {keyword}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};
