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

interface ArticleState {
  isGenerating: boolean;
  data: ManualTopicArticleResult | null;
  error: string | null;
  copySuccess: boolean;
}

const INITIAL_ARTICLE_STATE: ArticleState = {
  isGenerating: false,
  data: null,
  error: null,
  copySuccess: false,
};

export const ManualTopicsPage: React.FC = () => {
  const [prompt, setPrompt] = useState<string>("");
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [topics, setTopics] = useState<NewsTopic[] | null>(null);
  const [usedFallback, setUsedFallback] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [articleStates, setArticleStates] = useState<Record<number, ArticleState>>({});

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
      });
      try {
        const result = await generateManualTopicArticle({ topic: topicTitle, model });
        setArticleState(index, {
          isGenerating: false,
          data: result,
          error: null,
          copySuccess: false,
        });
      } catch (err) {
        setArticleState(index, {
          isGenerating: false,
          error:
            err instanceof Error
              ? err.message
              : "An unexpected error occurred while generating the article.",
          copySuccess: false,
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
                  const yoast = articleState.data?.yoast;

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

                      {articleState.data && yoast && (
                        <div className="mt-4 space-y-4">
                          <div
                            className="prose prose-invert max-w-none text-slate-100"
                            dangerouslySetInnerHTML={{ __html: articleState.data.html }}
                          />

                          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                              Yoast SEO fields
                            </h4>
                            <dl className="mt-3 space-y-3 text-sm text-slate-300">
                              <div>
                                <dt className="font-semibold text-slate-200">SEO title</dt>
                                <dd className="mt-1">{yoast.seoTitle}</dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-slate-200">Focus keyphrase</dt>
                                <dd className="mt-1">{yoast.focusKeyphrase}</dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-slate-200">Meta description</dt>
                                <dd className="mt-1">{yoast.metaDescription}</dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-slate-200">Slug</dt>
                                <dd className="mt-1">{yoast.slug}</dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-slate-200">Keyphrase synonyms</dt>
                                <dd className="mt-1">
                                  {yoast.keyphraseSynonyms.length > 0
                                    ? yoast.keyphraseSynonyms.join(", ")
                                    : "None"}
                                </dd>
                              </div>
                            </dl>

                            {yoast.seoKeywords.length > 0 && (
                              <div className="mt-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Additional SEO keywords
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {yoast.seoKeywords.map((keyword) => (
                                    <span
                                      key={keyword}
                                      className="rounded-full border border-cyan-400/50 px-3 py-1 text-xs font-medium text-cyan-200"
                                    >
                                      {keyword}
                                    </span>
                                  ))}
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
