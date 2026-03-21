import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import DocumentsPage from './pages/DocumentsPage'
import WorkflowsPage from './pages/WorkflowsPage'
import ResultsPage from './pages/ResultsPage'

const NAV_ITEMS = [
  { to: '/documents', label: 'Documents' },
  { to: '/workflows', label: 'Workflows' },
  { to: '/results', label: 'Results' },
]

export default function App() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-navy-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            {/* Brand */}
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-lg tracking-tight">PIL Lens</span>
              <span className="text-navy-300 text-[10px] font-medium leading-tight hidden sm:block">
                Powered by LYL
              </span>
            </div>

            {/* Nav Links */}
            <div className="flex items-center gap-1">
              {NAV_ITEMS.map(item => {
                const isActive = location.pathname === item.to ||
                  (item.to === '/documents' && location.pathname === '/')
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'text-navy-200 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Pages */}
      <main>
        <Routes>
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="*" element={<Navigate to="/documents" replace />} />
        </Routes>
      </main>
    </div>
  )
}
