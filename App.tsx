import React from "react";
import { Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { ArticleGeneratorPage } from "./pages/ArticleGeneratorPage";
import { RailwayTopicsPage } from "./pages/RailwayTopicsPage";

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/generate" element={<ArticleGeneratorPage />} />
      <Route path="/railways" element={<RailwayTopicsPage />} />
    </Routes>
  );
};

export default App;
