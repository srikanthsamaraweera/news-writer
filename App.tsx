import React, { useState, useCallback } from 'react';
import { fetchTrendingTopics } from './services/geminiService';
import type { NewsTopic } from './types';
import { TopicCard } from './components/TopicCard';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorDisplay } from './components/ErrorDisplay';

const App: React.FC = () => {
  const [topics, setTopics] = useState<NewsTopic[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchTopics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setTopics(null);
    try {
      const fetchedTopics = await fetchTrendingTopics();
      setTopics(fetchedTopics);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

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
            <TopicCard key={index} topic={topic} index={index} />
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
        style={{backgroundImage: "url('https://picsum.photos/seed/srilanka/1920/1080')"}}
      ></div>
      <main className="relative max-w-4xl mx-auto">
        <header className="text-center mb-8">
            <div className="inline-block bg-cyan-500/10 border border-cyan-500/30 rounded-full px-4 py-1 mb-4">
                <p className="text-sm font-medium text-cyan-400">Powered by Gemini</p>
            </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-100">
            Sri Lanka's <span className="text-cyan-400">Positive News</span>
          </h1>
          <p className="mt-4 text-lg text-slate-400">
            Your daily dose of uplifting stories and positive developments from across the nation.
          </p>
        </header>

        <div className="flex justify-center mb-8">
          <button
            onClick={handleFetchTopics}
            disabled={isLoading}
            className="inline-flex items-center justify-center px-8 py-3 font-bold text-lg text-slate-900 bg-cyan-400 rounded-full shadow-lg hover:bg-cyan-300 disabled:bg-slate-500 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-cyan-400 focus:ring-opacity-50"
          >
            {isLoading ? 'Fetching...' : 'Get Positive News'}
          </button>
        </div>

        <div className="transition-opacity duration-500">
          {renderContent()}
        </div>
      </main>
      <footer className="text-center mt-12 text-slate-500 text-sm">
        <p>Built by a world-class senior frontend React engineer.</p>
        <p>&copy; {new Date().getFullYear()} All data is retrieved in real-time.</p>
      </footer>
    </div>
  );
};

export default App;