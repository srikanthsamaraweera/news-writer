import React, { useState, useCallback } from 'react';
import { fetchTrendingTopics, DEFAULT_GEMINI_MODEL } from './services/geminiService';
import type { NewsTopic } from './types';
import { TopicCard } from './components/TopicCard';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorDisplay } from './components/ErrorDisplay';

const GEMINI_MODEL_OPTIONS = [
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
  { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
  { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro-latest' },
  { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash-latest' },
];

const App: React.FC = () => {
  const [topics, setTopics] = useState<NewsTopic[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_GEMINI_MODEL);

  const handleFetchTopics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setTopics(null);
    try {
      const fetchedTopics = await fetchTrendingTopics(selectedModel);
      setTopics(fetchedTopics);
    } catch (err) {
      if (err instanceof Error) {
        const normalizedMessage = err.message.toLowerCase();
        const helpfulMessage = normalizedMessage.includes('overload')
          ? err.message + ' Try another Gemini model from the selector below.'
          : err.message;
        setError(helpfulMessage);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedModel]);

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
            <TopicCard key={index} topic={topic} index={index} selectedModel={selectedModel} />
          ))}
        </div>
      );
    }
    return (
      <div className="text-center p-8 bg-slate-800/30 rounded-lg border border-slate-700">
        <h2 className="text-2xl font-bold text-slate-200">Welcome!</h2>
        <p className="text-slate-400 mt-2">Click the button above to discover uplifting news and positive trends in Sri Lanka.</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-4 sm:p-6 lg:p-8">
      <div
        className="absolute top-0 left-0 w-full h-full bg-cover bg-center opacity-10"
        style={{ backgroundImage: "url('https://picsum.photos/seed/srilanka/1920/1080')" }}
      ></div>
      <main className="relative max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <div className="inline-block bg-cyan-500/10 border border-cyan-500/30 rounded-full px-4 py-1 mb-4">
            <p className="text-sm font-medium text-cyan-400">Powered by Gemini</p>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-100">
            Lankan<span className="text-cyan-400">.org</span>
          </h1>
          <p className="mt-4 text-lg text-slate-400">
            Trending news writer
          </p>
        </header>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 mb-8">
          <label className="flex flex-col text-left text-sm text-slate-300">
            <span className="uppercase tracking-wide text-xs text-slate-400 mb-2">Gemini model</span>
            <select
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              disabled={isLoading}
              className="px-4 py-2 rounded-full bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-colors duration-200 disabled:opacity-70"
            >
              {GEMINI_MODEL_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={handleFetchTopics}
            disabled={isLoading}
            className="inline-flex items-center justify-center px-8 py-3 font-bold text-lg text-slate-900 bg-cyan-400 rounded-full shadow-lg hover:bg-cyan-300 disabled:bg-slate-500 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-cyan-400 focus:ring-opacity-50"
          >
            {isLoading ? 'Fetching...' : 'Get News Topics'}
          </button>
        </div>

        <div className="transition-opacity duration-500">
          {renderContent()}
        </div>
      </main>
      <footer className="text-center mt-12 text-slate-500 text-sm">
        <p>Built by Mathota Sri Kanth Samaraweera.</p>
        <p>&copy; {new Date().getFullYear()} All data is retrieved in real-time.</p>
      </footer>
    </div>
  );
};

export default App;

