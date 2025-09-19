import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { generateArticle, type GeneratedArticle } from "../services/articleGeneratorService";
import { DEFAULT_MODEL, GEMINI_MODEL_OPTIONS } from "../constants/models";
import type { GroundingSource } from "../types";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorDisplay } from "../components/ErrorDisplay";

export const ArticleGeneratorPage: React.FC = () => {
  const [topic, setTopic] = useState<string>("");
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [articleHtml, setArticleHtml] = useState<string | null>(null);
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!copySuccess) {
      return;
    }
    const timeout = window.setTimeout(() => setCopySuccess(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copySuccess]);

  const isGenerateDisabled = useMemo(() => !topic.trim() || isLoading, [topic, isLoading]);

  const handleGenerate = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!topic.trim()) {
        setError("Please enter a topic before generating.");
        return;
      }
      setIsLoading(true);
      setError(null);
      setArticleHtml(null);
      setSources([]);
      setCopySuccess(false);
      try {
        const result: GeneratedArticle = await generateArticle({ topic: topic.trim(), model });
        setArticleHtml(result.html);
        setSources(result.sources);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unexpected error occurred.");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [topic, model]
  );

  const handleCopy = useCallback(async () => {
    if (!articleHtml) {
      return;
    }
    try {
      await navigator.clipboard.writeText(articleHtml);
      setCopySuccess(true);
    } catch (err) {
      console.error("Copy failed", err);
      setError("Unable to copy the article to your clipboard. Please try manually copying it.");
    }
  }, [articleHtml]);

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),_rgba(15,23,42,0.95))]"
        aria-hidden="true"
      />
      <main className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-10 flex flex-col gap-4 text-center">
          <div className="flex items-center justify-between text-sm text-cyan-300">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/60 px-4 py-2 font-semibold text-cyan-300 hover:bg-cyan-500/10"
            >
              Back to home
            </Link>
            <span className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-400/40 rounded-full px-4 py-2 font-semibold shadow-lg shadow-cyan-500/20">
              <span role="img" aria-label="sparkles">
                *
              </span>
              Latest Sri Lankan insights
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-100">
            Manual Article Generator
          </h1>
          <p className="text-lg text-slate-300">
            Generate an 800-word, SEO-forward article grounded in real-time Sri Lankan developments.
          </p>
        </header>

        <section className="bg-slate-900/70 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur">
          <form onSubmit={handleGenerate} className="grid gap-6">
            <div>
              <label htmlFor="topic" className="block text-sm font-semibold text-slate-300 mb-2">
                Topic
              </label>
              <input
                id="topic"
                type="text"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="e.g. Latest Colombo tech startup funding"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition"
              />
            </div>

            <div>
              <label htmlFor="model" className="block text-sm font-semibold text-slate-300 mb-2">
                Gemini model
              </label>
              <select
                id="model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-base text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition"
              >
                {GEMINI_MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-slate-900">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-4 items-center">
              <button
                type="submit"
                disabled={isGenerateDisabled}
                className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-8 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition-transform duration-200 ease-out hover:scale-[1.02] hover:bg-cyan-300 disabled:bg-slate-600 disabled:text-slate-300 disabled:cursor-not-allowed"
              >
                {isLoading ? "Generating..." : "Generate"}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!articleHtml || isLoading}
                className="inline-flex items-center justify-center rounded-full border border-cyan-400/70 px-6 py-3 text-base font-semibold text-cyan-300 transition-all duration-200 hover:bg-cyan-400/10 disabled:border-slate-700 disabled:text-slate-500 disabled:hover:bg-transparent"
              >
                {copySuccess ? "Copied!" : "Copy HTML"}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-8">
              <ErrorDisplay message={error} />
            </div>
          )}

          {isLoading && (
            <div className="mt-10 flex justify-center">
              <LoadingSpinner />
            </div>
          )}

          {articleHtml && !isLoading && (
            <div className="mt-10 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-100">Generated article</h2>
                <p className="text-sm text-slate-400">
                  Review the rendered article below. Copying preserves the HTML structure exactly.
                </p>
              </div>
              <div
                className="bg-white text-slate-900 rounded-3xl p-6 shadow-inner max-h-[65vh] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: articleHtml }}
              />
              {sources.length > 0 && (
                <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-5">
                  <h3 className="text-lg font-semibold text-slate-200">Sources cited by Gemini</h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">
                    {sources.map((source) => (
                      <li key={source.uri}>
                        <a
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
                        >
                          {source.title || source.uri}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-slate-200">HTML output</h3>
                <textarea
                  value={articleHtml}
                  readOnly
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-200 font-mono leading-6 resize-none"
                  rows={10}
                />
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
