import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AWGenerator from '../components/AWGenerator/AWGenerator';

export default function GenerateAW() {
  const navigate = useNavigate();
  const [workflowResult, setWorkflowResult] = useState(null);

  const handleComplete = (result) => {
    setWorkflowResult(result);
    // Store result in session storage for Results page
    sessionStorage.setItem('pil-lens-last-workflow-result', JSON.stringify(result));
  };

  const handleError = (error) => {
    console.error('Generate AW workflow error:', error);
  };

  const handleViewResults = () => {
    navigate('/results');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Generate AW Draft</h1>
          <p className="mt-2 text-gray-600">
            Generate formatted artwork PDF from Approved PIL using market-specific templates
          </p>
        </div>

        {/* Workflow Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <span className="text-2xl mr-3">ℹ️</span>
            <div>
              <h3 className="text-sm font-semibold text-blue-900">About This Workflow</h3>
              <p className="text-sm text-blue-800 mt-1">
                This workflow generates a formatted artwork PDF from your Approved PIL using market-specific
                templates (Taiwan TFDA or Thailand Thai FDA). The generated PDF includes correct section ordering,
                fonts, regulatory disclaimers, and emergency contacts. You can optionally apply custom paper
                dimensions from a Diecut Specification.
              </p>
              <p className="text-sm text-blue-800 mt-2">
                <strong>Time saved:</strong> Eliminates 7-10 days of manual AW creation. The generated PDF is
                suitable for refinement in InDesign.
              </p>
            </div>
          </div>
        </div>

        {/* Generator Component */}
        <AWGenerator onComplete={handleComplete} onError={handleError} />

        {/* View Results Button */}
        {workflowResult && (
          <div className="mt-6">
            <button
              onClick={handleViewResults}
              className="w-full bg-gray-900 text-white py-3 px-4 rounded-md font-semibold hover:bg-gray-800 transition-colors"
            >
              View Full Results →
            </button>
          </div>
        )}

        {/* Back to Workflows */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/workflows')}
            className="text-violet-600 hover:text-violet-700 font-medium"
          >
            ← Back to Workflows
          </button>
        </div>
      </div>
    </div>
  );
}