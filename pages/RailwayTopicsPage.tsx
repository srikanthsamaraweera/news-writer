import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { NewsTopic } from "../types";
import { DEFAULT_MODEL, GEMINI_MODEL_OPTIONS } from "../constants/models";
import { fetchRailwayTopics, generateRailwayArticle } from "../services/railwayService";
import { TopicCard } from "../components/TopicCard";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorDisplay } from "../components/ErrorDisplay";

export const RailwayTopicsPage: React.FC = () => {
  const [topics, setTopics] = useState<NewsTopic[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string>(DEFAULT_MODEL);

  const loadTopics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const railwayTopics = await fetchRailwayTopics({ model });
      setTopics(railwayTopics);
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

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  const handleRefresh = () => {
    void loadTopics();
  };

  const renderContent = () => {
    if (isLoading) {
      return <LoadingSpinner />;
    }
    if (error) {
      return <ErrorDisplay message={error} />;
    }
    if (topics && topics.length > 0) {
      return (
        <div className="grid grid-cols-1 gap-6">
          {topics.map((topic, index) => (
            <TopicCard
              key={`${topic.topic}-${index}`}
              topic={topic}
              index={index}
              model={model}
              generateArticle={generateRailwayArticle}
            />
          ))}
        </div>
      );
    }
    return (
      <div className="text-center p-8 bg-slate-800/30 rounded-lg border border-slate-700">
        <h2 className="text-2xl font-bold text-slate-200">Awaiting inspiration</h2>
        <p className="text-slate-400 mt-2">
          Refresh the list to uncover fresh story ideas celebrating Sri Lanka's railways.
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 w-full h-full bg-cover bg-center opacity-10"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1920&q=80')" }}
        aria-hidden="true"
      />
      <main className="relative max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <div className="inline-block bg-emerald-500/10 border border-emerald-400/30 rounded-full px-4 py-1 mb-4">
            <p className="text-sm font-medium text-emerald-300">Curated for SriLankanRailways.com</p>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-100">
            Railway<span className="text-emerald-400"> Inspirations</span>
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            Discover magazine-worthy story ideas about Sri Lanka's iconic trains and journeys.
          </p>
        </header>

        <div className="flex flex-wrap justify-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <label htmlFor="railway-model" className="text-sm font-semibold text-slate-300">
              Gemini model
            </label>
            <select
              id="railway-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="rounded-full border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition"
            >
              {GEMINI_MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-slate-900">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex items-center justify-center px-8 py-3 font-bold text-lg text-slate-900 bg-emerald-400 rounded-full shadow-lg hover:bg-emerald-300 disabled:bg-slate-500 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-emerald-400 focus:ring-opacity-50"
          >
            {isLoading ? "Refreshing..." : "Refresh Topics"}
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-8 py-3 font-bold text-lg text-emerald-300 border border-emerald-400/60 rounded-full hover:bg-emerald-500/10 transform hover:scale-105 transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-emerald-400 focus:ring-opacity-50"
          >
            Back to News
          </Link>
        </div>

        <div className="transition-opacity duration-500">{renderContent()}</div>
      </main>
      <footer className="relative text-center mt-12 text-slate-500 text-sm">
        <p>Crafted for SriLankanRailways.com.</p>
        <p>&copy; {new Date().getFullYear()} Scenic journeys await.</p>
      </footer>
    </div>
  );
};
