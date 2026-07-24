import React from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { ArticleGeneratorPage } from "./pages/ArticleGeneratorPage";
import { ManualTopicsPage } from "./pages/ManualTopicsPage";
import { RailwayTopicsPage } from "./pages/RailwayTopicsPage";
import { useAuth } from "./components/AuthProvider";

const ProtectedRailwayRoute: React.FC = () => {
  const { isAuthorized, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-slate-900" aria-label="Checking login" />;
  }

  return isAuthorized ? <RailwayTopicsPage /> : <Navigate to="/" replace />;
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/generate" element={<ArticleGeneratorPage />} />
      <Route path="/manual-topics" element={<ManualTopicsPage />} />
      <Route path="/railways" element={<ProtectedRailwayRoute />} />
    </Routes>
  );
};

export default App;
