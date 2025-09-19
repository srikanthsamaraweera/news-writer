import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { fetchTrendingTopics } from "../services/geminiService";
import { DEFAULT_MODEL, GEMINI_MODEL_OPTIONS } from "../constants/models";
import type { NewsTopic } from "../types";
import { TopicCard } from "../components/TopicCard";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorDisplay } from "../components/ErrorDisplay";

export const HomePage: React.FC = () => {
  const [topics, setTopics] = useState<NewsTopic[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string>(DEFAULT_MODEL);

  const handleFetchTopics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setTopics(null);
    try {
      const fetchedTopics = await fetchTrendingTopics({ model });
      setTopics(fetchedTopics);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [model]);

  const renderContent = () => {
    if (isLoading) {
      return <LoadingSpinner />;
    }
    if (error) {
      return <ErrorDisplay message={error} />;
    }
    if (topics) {
      return (
        <div className="grid grid-cols-1 gap-6">
          {topics.map((topic, index) => (
            <TopicCard key={index} topic={topic} index={index} model={model} />
          ))}
        </div>
      );
    }
    return (
      <div className="text-center p-8 bg-slate-800/30 rounded-lg border border-slate-700">
        <h2 className="text-2xl font-bold text-slate-200">Welcome!</h2>
        <p className="text-slate-400 mt-2">
          Click the button above to discover uplifting news and positive trends in Sri Lanka.
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 w-full h-full bg-cover bg-center opacity-10"
        style={{ backgroundImage: "url('https://picsum.photos/seed/srilanka/1920/1080')" }}
        aria-hidden="true"
      />
      <main className="relative max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <div className="inline-block bg-cyan-500/10 border border-cyan-500/30 rounded-full px-4 py-1 mb-4">
            <p className="text-sm font-medium text-cyan-400">Powered by Gemini</p>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-100">
            Lankan<span className="text-cyan-400">.org</span>
          </h1>
          <p className="mt-4 text-lg text-slate-400">Trending news writer</p>
        </header>

        <div className="flex flex-wrap justify-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <label htmlFor="home-model" className="text-sm font-semibold text-slate-300">
              Gemini model
            </label>
            <select
              id="home-model"
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
            onClick={handleFetchTopics}
            disabled={isLoading}
            className="inline-flex items-center justify-center px-8 py-3 font-bold text-lg text-slate-900 bg-cyan-400 rounded-full shadow-lg hover:bg-cyan-300 disabled:bg-slate-500 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-cyan-400 focus:ring-opacity-50"
          >
            {isLoading ? "Fetching..." : "Get News Topics"}
          </button>
          <Link
            to="/generate"
            className="inline-flex items-center justify-center px-8 py-3 font-bold text-lg text-cyan-300 border border-cyan-400/60 rounded-full hover:bg-cyan-500/10 transform hover:scale-105 transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-cyan-400 focus:ring-opacity-50"
          >
            Manual Article Generator
          </Link>
        </div>

        <div className="transition-opacity duration-500">{renderContent()}</div>
      </main>
      <footer className="relative text-center mt-12 text-slate-500 text-sm">
        <p>Built by Mathota Sri Kanth Samaraweera.</p>
        <p>&copy; {new Date().getFullYear()} All data is retrieved in real-time.</p>
      </footer>
    </div>
  );
};
