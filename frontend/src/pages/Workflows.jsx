import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WorkflowSelector from '../components/WorkflowSelector/WorkflowSelector';
import DraftResults from '../components/DraftResults/DraftResults';

export default function Workflows() {
  const navigate = useNavigate();
  const [showSelector, setShowSelector] = useState(false);
  const [workflowResult, setWorkflowResult] = useState(null);

  const handleWorkflowStart = (result) => {
    setWorkflowResult(result);
    setShowSelector(false);
  };

  const handleExport = async () => {
    // Placeholder for PDF export functionality
    alert('PDF export functionality will be implemented in Feature 7');
  };

  const handleClose = () => {
    setWorkflowResult(null);
    setShowSelector(false);
  };

  const handleStartNewWorkflow = () => {
    setWorkflowResult(null);
    setShowSelector(true);
  };

  if (workflowResult) {
    return (
      <DraftResults
        workflowResult={workflowResult}
        onExport={handleExport}
        onClose={handleClose}
      />
    );
  }

  if (showSelector) {
    return (
      <WorkflowSelector
        onWorkflowStart={handleWorkflowStart}
        onCancel={handleClose}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          PIL Workflows
        </h1>
        <p className="text-gray-600">
          Select a workflow to process pharmaceutical documents
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create PIL Draft */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center text-2xl">
              📝
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Create PIL Draft
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Generate structured draft outline with section alignment, gap analysis, and translation checklist
              </p>
            </div>
          </div>
          
          <div className="mb-4 p-3 bg-gray-50 rounded-xl">
            <p className="text-xs font-semibold text-gray-500 mb-2">Required Documents:</p>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Innovator PIL</li>
              <li>• Regulatory Source</li>
              <li>• Local Market PIL Format</li>
            </ul>
          </div>

          <button
            onClick={handleStartNewWorkflow}
            className="w-full px-4 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 active:bg-violet-800 transition-colors"
          >
            Start Workflow
          </button>
        </div>

        {/* Assess Variation (Coming Soon) */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 opacity-60">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-2xl">
              🔍
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Assess Variation
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Classify PIL variations as complicated or general with section-by-section diff
              </p>
            </div>
          </div>
          
          <div className="mb-4 p-3 bg-gray-50 rounded-xl">
            <p className="text-xs font-semibold text-gray-500 mb-2">Required Documents:</p>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Approved PIL</li>
              <li>• Updated PIL / Regulatory Announcement</li>
            </ul>
          </div>

          <button
            disabled
            className="w-full px-4 py-3 bg-gray-300 text-gray-500 font-semibold rounded-xl cursor-not-allowed"
          >
            Coming in Feature 5
          </button>
        </div>

        {/* Review AW (Coming Soon) */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 opacity-60">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Review AW
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Detect deviations between AW Draft and Approved PIL with severity scoring
              </p>
            </div>
          </div>
          
          <div className="mb-4 p-3 bg-gray-50 rounded-xl">
            <p className="text-xs font-semibold text-gray-500 mb-2">Required Documents:</p>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• AW Draft PDF</li>
              <li>• Approved PIL</li>
            </ul>
          </div>

          <button
            disabled
            className="w-full px-4 py-3 bg-gray-300 text-gray-500 font-semibold rounded-xl cursor-not-allowed"
          >
            Coming in Feature 5
          </button>
        </div>

        {/* Generate AW Draft (Coming Soon) */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 opacity-60">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-2xl">
              🎨
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Generate AW Draft
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Produce formatted artwork PDF using market-specific templates
              </p>
            </div>
          </div>
          
          <div className="mb-4 p-3 bg-gray-50 rounded-xl">
            <p className="text-xs font-semibold text-gray-500 mb-2">Required Documents:</p>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Approved PIL</li>
              <li>• Market Template (Taiwan/Thailand)</li>
              <li>• Diecut Specification (optional)</li>
            </ul>
          </div>

          <button
            disabled
            className="w-full px-4 py-3 bg-gray-300 text-gray-500 font-semibold rounded-xl cursor-not-allowed"
          >
            Coming in Feature 6
          </button>
        </div>
      </div>
    </div>
  );
}