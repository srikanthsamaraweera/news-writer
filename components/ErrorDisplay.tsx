
import React from 'react';

interface ErrorDisplayProps {
  message: string;
}

const ErrorIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message }) => {
  return (
    <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-5 rounded-lg relative flex flex-col items-center text-center shadow-lg">
        <ErrorIcon />
        <strong className="font-bold text-lg mt-2">An error occurred</strong>
        <span className="block sm:inline mt-1">{message}</span>
    </div>
  );
};
