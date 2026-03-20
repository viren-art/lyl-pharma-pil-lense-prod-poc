import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

// LYL: Page imports will be injected here by Build Agent
// SCAFFOLD_PAGES_START
const Home = lazy(() => import('./pages/Home'));
const SessionInfo = lazy(() => import('./pages/SessionInfo'));
// SCAFFOLD_PAGES_END

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <Routes>
          {/* LYL: Routes will be injected here by Build Agent */}
          {/* SCAFFOLD_ROUTES_START */}
          <Route path="/" element={<Home />} />
          <Route path="/sessioninfo" element={<SessionInfo />} />
          {/* SCAFFOLD_ROUTES_END */}
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
