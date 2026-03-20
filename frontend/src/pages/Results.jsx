import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ResultsDisplay from '../components/ResultsDisplay/ResultsDisplay';

export default function Results() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [workflowResult, setWorkflowResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const workflowId = searchParams.get('workflowId');
    
    if (!workflowId) {
      // Try to get from session storage
      const storedResult = sessionStorage.getItem('pil-lens-last-workflow-result');
      if (storedResult) {
        try {
          setWorkflowResult(JSON.parse(storedResult));
          setLoading(false);
        } catch (err) {
          setError('Failed to load workflow result from session');
          setLoading(false);
        }
      } else {
        setError('No workflow result to display');
        setLoading(false);
      }
      return;
    }

    // Fetch workflow result from API
    fetchWorkflowResult(workflowId);
  }, [searchParams]);

  const fetchWorkflowResult = async (workflowId) => {
    try {
      setLoading(true);
      const sessionId = sessionStorage.getItem('pil-lens-session-id');
      const response = await fetch(`/api/workflows/${workflowId}/result`, {
        headers: {
          'x-session-id': sessionId
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch workflow result');
      }

      const data = await response.json();
      setWorkflowResult(data);
      
      // Store in session storage for quick access
      sessionStorage.setItem('pil-lens-last-workflow-result', JSON.stringify(data));
    } catch (err) {
      console.error('Error fetching workflow result:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!workflowResult) return;

    try {
      const sessionId = sessionStorage.getItem('pil-lens-session-id');
      const response = await fetch(`/api/workflows/${workflowResult.workflowId}/export`, {
        headers: {
          'x-session-id': sessionId
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export PDF report');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `workflow-${workflowResult.workflowType}-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Failed to export PDF report. Please try again.');
    }
  };

  const handleClose = () => {
    navigate('/workflows');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500 mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading workflow results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="text-center">
          <p className="text-rose-400 text-lg mb-4">⚠️ {error}</p>
          <button
            onClick={() => navigate('/workflows')}
            className="px-6 py-2 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700"
          >
            Back to Workflows
          </button>
        </div>
      </div>
    );
  }

  return (
    <ResultsDisplay
      workflowResult={workflowResult}
      onExport={handleExport}
      onClose={handleClose}
    />
  );
}