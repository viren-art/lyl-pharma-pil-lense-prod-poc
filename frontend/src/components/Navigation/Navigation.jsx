import { Link, useLocation } from 'react-router-dom';

/**
 * Navigation Component
 * Three-screen navigation (Documents, Workflows, Results) with breadcrumb trail
 */
export default function Navigation() {
  const location = useLocation();

  const navItems = [
    { path: '/documents', label: 'Documents', icon: '📁' },
    { path: '/workflows', label: 'Workflows', icon: '⚙️' },
    { path: '/results', label: 'Results', icon: '📊' }
  ];

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const getBreadcrumbs = () => {
    const path = location.pathname;
    const breadcrumbs = [{ label: 'Home', path: '/' }];

    if (path.startsWith('/documents')) {
      breadcrumbs.push({ label: 'Documents', path: '/documents' });
    } else if (path.startsWith('/workflows')) {
      breadcrumbs.push({ label: 'Workflows', path: '/workflows' });
      
      if (path.includes('/create-draft')) {
        breadcrumbs.push({ label: 'Create PIL Draft', path: '/workflows/create-draft' });
      } else if (path.includes('/assess-variation')) {
        breadcrumbs.push({ label: 'Assess Variation', path: '/workflows/assess-variation' });
      } else if (path.includes('/review-aw')) {
        breadcrumbs.push({ label: 'Review AW', path: '/workflows/review-aw' });
      } else if (path.includes('/generate-aw')) {
        breadcrumbs.push({ label: 'Generate AW Draft', path: '/workflows/generate-aw' });
      }
    } else if (path.startsWith('/results')) {
      breadcrumbs.push({ label: 'Results', path: '/results' });
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-zinc-900/80 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        {/* Main Navigation */}
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl">💊</span>
              <span className="text-xl font-bold text-white">PIL Lens</span>
            </Link>

            <div className="flex items-center gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-colors ${
                    isActive(item.path)
                      ? 'bg-violet-600 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <SessionIndicator />
          </div>
        </div>

        {/* Breadcrumb Trail */}
        {breadcrumbs.length > 1 && (
          <div className="flex items-center gap-2 pb-3 text-sm">
            {breadcrumbs.map((crumb, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {idx > 0 && <span className="text-zinc-600">/</span>}
                {idx === breadcrumbs.length - 1 ? (
                  <span className="text-white font-semibold">{crumb.label}</span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="text-zinc-400 hover:text-white transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

/**
 * Session Indicator Component
 * Shows current session status and document count
 */
function SessionIndicator() {
  const sessionId = sessionStorage.getItem('pil-lens-session-id');
  const documentCount = parseInt(sessionStorage.getItem('pil-lens-document-count') || '0', 10);

  if (!sessionId) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-zinc-800/50 rounded-xl border border-white/5">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        <span className="text-xs text-zinc-400">Session Active</span>
      </div>
      <div className="h-4 w-px bg-white/10" />
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-400">Documents:</span>
        <span className="text-sm font-semibold text-white">{documentCount}/100</span>
      </div>
    </div>
  );
}