
import React from 'react';

const messages = [
  "Contacting satellites...",
  "Scanning news feeds...",
  "Analyzing trends...",
  "Consulting with journalists...",
  "Checking the latest headlines...",
  "Compiling top stories...",
];

export const LoadingSpinner: React.FC = () => {
  const [message, setMessage] = React.useState(messages[0]);

  React.useEffect(() => {
    const intervalId = setInterval(() => {
      setMessage(prevMessage => {
        const currentIndex = messages.indexOf(prevMessage);
        const nextIndex = (currentIndex + 1) % messages.length;
        return messages[nextIndex];
      });
    }, 2000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-cyan-500"></div>
      <p className="text-slate-300 text-lg mt-4 font-semibold transition-opacity duration-500">{message}</p>
    </div>
  );
};
