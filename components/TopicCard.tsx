import React, { useState } from 'react';
import type { NewsTopic } from '../types';
import { generateDetailedSummary } from '../services/geminiService';
import { DEFAULT_MODEL } from '../constants/models';

interface TopicCardProps {
  topic: NewsTopic;
  index: number;
  model?: string;
  generateArticle?: (topic: string, model?: string) => Promise<string>;
}

const LinkIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const GenerateIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);

const CopyIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const CheckIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

export const TopicCard: React.FC<TopicCardProps> = ({
  topic,
  index,
  model = DEFAULT_MODEL,
  generateArticle,
}) => {
  const [detailedSummary, setDetailedSummary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  const generate = generateArticle ?? generateDetailedSummary;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const summary = await generate(topic.topic, model);
      setDetailedSummary(summary);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyHtml = () => {
    if (detailedSummary) {
      navigator.clipboard
        .writeText(detailedSummary)
        .then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2500);
        })
        .catch((err) => {
          console.error('Failed to copy HTML: ', err);
          alert('Failed to copy HTML to clipboard.');
        });
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6 shadow-lg transition-all duration-300 ease-in-out">
      <style>{`
            .article-content h1 { font-size: 1.875rem; font-weight: 800; color: #94a3b8; margin-bottom: 0.75rem; margin-top: 1rem; }
            .article-content h2 { font-size: 1.5rem; font-weight: 700; color: #cbd5e1; margin-bottom: 0.5rem; margin-top: 1.5rem; }
            .article-content p { margin-bottom: 1rem; line-height: 1.6; }
            .article-content strong { color: #e2e8f0; font-weight: 600; }
        `}</style>
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-cyan-900/50 text-cyan-400 font-bold text-lg">
          {index + 1}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-cyan-400 mb-2">{topic.topic}</h3>

          {detailedSummary ? (
            <div className="article-content text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: detailedSummary }} />
          ) : (
            <p className="text-slate-300 leading-relaxed min-h-[4em]">{topic.summary}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-4">
            {!detailedSummary && !isGenerating && (
              <button
                onClick={handleGenerate}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-cyan-300 bg-cyan-900/50 border border-cyan-800 rounded-md hover:bg-cyan-800/70 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-cyan-500 transition-all duration-200"
              >
                <GenerateIcon />
                Generate Article
              </button>
            )}

            {isGenerating && (
              <div className="flex items-center text-slate-400 px-4 py-2">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Generating...</span>
              </div>
            )}

            {detailedSummary && !isGenerating && (
              <button
                onClick={handleCopyHtml}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-emerald-300 bg-emerald-900/50 border border-emerald-800 rounded-md hover:bg-emerald-800/70 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-emerald-500 transition-all duration-200"
              >
                {copySuccess ? <CheckIcon /> : <CopyIcon />}
                {copySuccess ? 'Copied!' : 'Copy HTML'}
              </button>
            )}
          </div>

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

          {topic.sources && topic.sources.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <h4 className="text-sm font-semibold text-slate-400 mb-2">Sources:</h4>
              <ul className="space-y-2">
                {topic.sources.map((source, idx) => (
                  <li key={idx}>
                    <a
                      href={source.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-500 hover:text-cyan-300 transition-colors duration-200 text-sm flex items-center group"
                    >
                      <LinkIcon />
                      <span className="group-hover:underline truncate">{source.title || new URL(source.uri).hostname}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
