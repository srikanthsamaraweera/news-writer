import React from "react";
import { Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { ArticleGeneratorPage } from "./pages/ArticleGeneratorPage";
import { ManualTopicsPage } from "./pages/ManualTopicsPage";
import { RailwayTopicsPage } from "./pages/RailwayTopicsPage";
import { AuthGate } from "./components/AuthGate";

const App: React.FC = () => {
  return (
    <AuthGate>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/generate" element={<ArticleGeneratorPage />} />
        <Route path="/manual-topics" element={<ManualTopicsPage />} />
        <Route path="/railways" element={<RailwayTopicsPage />} />
      </Routes>
    </AuthGate>
  );
};

export default App;
