import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// LYL_DEP: puppeteer@^21.0.0

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * PDF Export Service
 * Generates PDF reports from workflow results with page references and confidence scores
 */

/**
 * Export workflow result as PDF report
 * @param {Object} workflowResult - Complete workflow execution result
 * @returns {Promise<Buffer>} PDF binary data
 */
export async function exportWorkflowResultAsPdf(workflowResult) {
  const { workflowType, output, extractionResults, executedDate, inputDocuments } = workflowResult;

  // Generate HTML content based on workflow type
  const htmlContent = generateReportHtml(workflowType, output, extractionResults, executedDate, inputDocuments);

  // Generate PDF using Puppeteer
  const pdfBuffer = await generatePdfFromHtml(htmlContent);

  return pdfBuffer;
}

/**
 * Generate HTML content for PDF report
 */
function generateReportHtml(workflowType, output, extractionResults, executedDate, inputDocuments) {
  const title = getWorkflowTitle(workflowType);
  const contentHtml = generateWorkflowSpecificContent(workflowType, output);
  const extractionHtml = generateExtractionDetailsHtml(extractionResults, inputDocuments);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title} - PIL Lens Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1f2937;
      padding: 40px;
    }
    
    .header {
      border-bottom: 3px solid #7c3aed;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    .header h1 {
      font-size: 24pt;
      color: #7c3aed;
      margin-bottom: 10px;
    }
    
    .header .meta {
      font-size: 10pt;
      color: #6b7280;
    }
    
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    
    .section h2 {
      font-size: 16pt;
      color: #1f2937;
      margin-bottom: 15px;
      padding-bottom: 5px;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .section h3 {
      font-size: 13pt;
      color: #374151;
      margin-bottom: 10px;
      margin-top: 15px;
    }
    
    .card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
    }
    
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 9pt;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .badge-critical {
      background: #fee2e2;
      color: #991b1b;
    }
    
    .badge-major {
      background: #fef3c7;
      color: #92400e;
    }
    
    .badge-minor {
      background: #d1fae5;
      color: #065f46;
    }
    
    .badge-high {
      background: #fee2e2;
      color: #991b1b;
    }
    
    .badge-medium {
      background: #fef3c7;
      color: #92400e;
    }
    
    .badge-low {
      background: #d1fae5;
      color: #065f46;
    }
    
    .badge-complicated {
      background: #fee2e2;
      color: #991b1b;
    }
    
    .badge-general {
      background: #d1fae5;
      color: #065f46;
    }
    
    .confidence-score {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 9pt;
      font-weight: 600;
    }
    
    .confidence-high {
      background: #d1fae5;
      color: #065f46;
    }
    
    .confidence-medium {
      background: #fef3c7;
      color: #92400e;
    }
    
    .confidence-low {
      background: #fee2e2;
      color: #991b1b;
    }
    
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 15px;
    }
    
    .grid-item {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px;
    }
    
    .grid-item-label {
      font-size: 9pt;
      color: #6b7280;
      margin-bottom: 5px;
    }
    
    .grid-item-value {
      font-size: 11pt;
      font-weight: 600;
      color: #1f2937;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    
    th {
      background: #f3f4f6;
      padding: 10px;
      text-align: left;
      font-size: 10pt;
      font-weight: 600;
      border-bottom: 2px solid #e5e7eb;
    }
    
    td {
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 10pt;
    }
    
    .text-comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 10px;
    }
    
    .text-box {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 10px;
      font-size: 9pt;
      line-height: 1.5;
    }
    
    .text-box-label {
      font-weight: 600;
      color: #6b7280;
      margin-bottom: 5px;
      font-size: 8pt;
    }
    
    .page-reference {
      color: #7c3aed;
      font-size: 9pt;
      font-weight: 600;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      font-size: 9pt;
      color: #6b7280;
    }
    
    @media print {
      body {
        padding: 20px;
      }
      
      .section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="meta">
      <strong>Execution Date:</strong> ${new Date(executedDate).toLocaleString()}<br>
      <strong>Input Documents:</strong> ${inputDocuments.map(d => d.name).join(', ')}
    </div>
  </div>

  ${contentHtml}

  ${extractionHtml}

  <div class="footer">
    <p>Generated by PIL Lens • ${new Date().toLocaleString()}</p>
    <p>This report contains pharmaceutical document analysis results for regulatory review.</p>
  </div>
</body>
</html>
  `;
}

/**
 * Get workflow title
 */
function getWorkflowTitle(workflowType) {
  const titles = {
    create_draft: 'Create PIL Draft - Workflow Results',
    assess_variation: 'Assess Variation - Workflow Results',
    review_aw: 'Review AW - Deviation Report',
    generate_aw: 'Generate AW Draft - Results'
  };
  return titles[workflowType] || 'Workflow Results';
}

/**
 * Generate workflow-specific content HTML
 */
function generateWorkflowSpecificContent(workflowType, output) {
  switch (workflowType) {
    case 'create_draft':
      return generateCreateDraftHtml(output);
    case 'assess_variation':
      return generateVariationHtml(output);
    case 'review_aw':
      return generateDeviationHtml(output);
    case 'generate_aw':
      return generateAWHtml(output);
    default:
      return '<div class="section"><p>Unknown workflow type</p></div>';
  }
}

/**
 * Generate Create PIL Draft HTML
 */
function generateCreateDraftHtml(output) {
  const { sectionAlignment, gapAnalysis, translationChecklist, specialAttentionFlags } = output;

  let html = '<div class="section">';
  html += '<h2>Section Alignment</h2>';
  
  sectionAlignment.forEach(alignment => {
    const confidenceClass = alignment.mappingConfidence >= 0.85 ? 'confidence-high' :
                           alignment.mappingConfidence >= 0.70 ? 'confidence-medium' : 'confidence-low';
    
    html += `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <div><strong>Target Section:</strong> ${escapeHtml(alignment.targetSection)}</div>
            <div><strong>Innovator Section:</strong> ${escapeHtml(alignment.innovatorSection)}</div>
          </div>
          <span class="confidence-score ${confidenceClass}">
            ${(alignment.mappingConfidence * 100).toFixed(0)}% Confidence
          </span>
        </div>
      </div>
    `;
  });
  
  html += '</div>';

  // Gap Analysis
  html += '<div class="section">';
  html += '<h2>Gap Analysis</h2>';
  
  if (gapAnalysis.missingSections.length > 0) {
    html += '<h3>Missing Sections</h3>';
    gapAnalysis.missingSections.forEach(section => {
      html += `<div class="card"><span class="badge badge-critical">Missing</span> ${escapeHtml(section)}</div>`;
    });
  }
  
  if (gapAnalysis.translationRequired.length > 0) {
    html += '<h3>Translation Required</h3>';
    gapAnalysis.translationRequired.forEach(item => {
      html += `
        <div class="card">
          <strong>${escapeHtml(item.section)}</strong><br>
          <span style="font-size: 9pt; color: #6b7280;">
            ${item.sourceLanguage} → ${item.targetLanguage} (${item.complexity} complexity)
          </span>
        </div>
      `;
    });
  }
  
  html += '</div>';

  // Translation Checklist
  html += '<div class="section">';
  html += '<h2>Translation Checklist</h2>';
  html += '<table>';
  html += '<thead><tr><th>Section</th><th>Languages</th><th>Complexity</th></tr></thead>';
  html += '<tbody>';
  
  translationChecklist.forEach(item => {
    const complexityClass = item.complexity === 'high' ? 'badge-high' :
                           item.complexity === 'medium' ? 'badge-medium' : 'badge-low';
    
    html += `
      <tr>
        <td>${escapeHtml(item.section)}</td>
        <td>${item.sourceLanguage} → ${item.targetLanguage}</td>
        <td><span class="badge ${complexityClass}">${item.complexity}</span></td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  html += '</div>';

  // Special Attention Flags
  if (specialAttentionFlags.length > 0) {
    html += '<div class="section">';
    html += '<h2>Special Attention Required</h2>';
    
    specialAttentionFlags.forEach(flag => {
      html += `
        <div class="card">
          <strong>${escapeHtml(flag.section)}</strong><br>
          <span style="color: #d97706; font-size: 10pt;">${escapeHtml(flag.reason)}</span><br>
          <span class="page-reference">Pages: ${flag.pageReferences.join(', ')}</span>
        </div>
      `;
    });
    
    html += '</div>';
  }

  return html;
}

/**
 * Generate Variation Assessment HTML
 */
function generateVariationHtml(output) {
  const { classification, justification, sectionDiffs } = output;

  const classificationClass = classification === 'complicated' ? 'badge-complicated' : 'badge-general';

  let html = '<div class="section">';
  html += '<h2>Classification Result</h2>';
  html += `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0;">Variation Classification</h3>
        <span class="badge ${classificationClass}">${classification.toUpperCase()}</span>
      </div>
      <p>${escapeHtml(justification)}</p>
    </div>
  `;
  html += '</div>';

  // Section Diffs
  html += '<div class="section">';
  html += '<h2>Section-by-Section Changes</h2>';
  
  sectionDiffs.forEach(diff => {
    const significanceClass = diff.significanceScore >= 70 ? 'badge-high' :
                             diff.significanceScore >= 40 ? 'badge-medium' : 'badge-low';
    
    html += `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
          <strong>${escapeHtml(diff.sectionName)}</strong>
          <div>
            <span class="badge ${significanceClass}">${diff.significanceScore} Significance</span>
            <span class="badge" style="margin-left: 5px; background: #e0e7ff; color: #3730a3;">
              ${diff.changeType}
            </span>
          </div>
        </div>
        
        ${diff.changeType !== 'unchanged' ? `
          <div class="text-comparison">
            <div class="text-box">
              <div class="text-box-label">Approved Text</div>
              ${escapeHtml(diff.approvedText)}
            </div>
            <div class="text-box">
              <div class="text-box-label">Updated Text</div>
              ${escapeHtml(diff.updatedText)}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  });
  
  html += '</div>';

  return html;
}

/**
 * Generate Deviation Report HTML
 */
function generateDeviationHtml(output) {
  const { deviations, summary } = output;

  let html = '<div class="section">';
  html += '<h2>Deviation Summary</h2>';
  html += '<div class="grid">';
  html += `
    <div class="grid-item">
      <div class="grid-item-label">Critical Deviations</div>
      <div class="grid-item-value" style="color: #dc2626;">${summary.totalCritical}</div>
    </div>
    <div class="grid-item">
      <div class="grid-item-label">Major Deviations</div>
      <div class="grid-item-value" style="color: #d97706;">${summary.totalMajor}</div>
    </div>
    <div class="grid-item">
      <div class="grid-item-label">Minor Deviations</div>
      <div class="grid-item-value" style="color: #059669;">${summary.totalMinor}</div>
    </div>
    <div class="grid-item">
      <div class="grid-item-label">Total Deviations</div>
      <div class="grid-item-value">${deviations.length}</div>
    </div>
  `;
  html += '</div>';
  html += '</div>';

  // Deviations List
  html += '<div class="section">';
  html += '<h2>Deviation Details</h2>';
  
  deviations.forEach((deviation, idx) => {
    const severityClass = `badge-${deviation.severity}`;
    
    html += `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
          <div>
            <strong>${idx + 1}. ${escapeHtml(deviation.sectionName)}</strong><br>
            <span class="badge ${severityClass}" style="margin-top: 5px; display: inline-block;">
              ${deviation.severity.toUpperCase()}
            </span>
          </div>
          <span class="page-reference">Page ${deviation.pageReference}</span>
        </div>
        
        <div class="text-comparison">
          <div class="text-box">
            <div class="text-box-label">Approved Text</div>
            ${escapeHtml(deviation.approvedText)}
          </div>
          <div class="text-box">
            <div class="text-box-label">Artwork Text</div>
            ${escapeHtml(deviation.artworkText)}
          </div>
        </div>
        
        <div style="margin-top: 10px; font-size: 9pt; color: #6b7280;">
          Confidence: ${(deviation.confidenceScore * 100).toFixed(0)}%
        </div>
      </div>
    `;
  });
  
  html += '</div>';

  return html;
}

/**
 * Generate AW Draft HTML
 */
function generateAWHtml(output) {
  const { market, diecutApplied, sectionsProcessed, generationTimeMs } = output;

  let html = '<div class="section">';
  html += '<h2>Generation Summary</h2>';
  html += '<div class="grid">';
  html += `
    <div class="grid-item">
      <div class="grid-item-label">Target Market</div>
      <div class="grid-item-value">${market === 'taiwan_tfda' ? 'Taiwan TFDA' : 'Thailand Thai FDA'}</div>
    </div>
    <div class="grid-item">
      <div class="grid-item-label">Sections Processed</div>
      <div class="grid-item-value">${sectionsProcessed}</div>
    </div>
    <div class="grid-item">
      <div class="grid-item-label">Diecut Applied</div>
      <div class="grid-item-value">${diecutApplied ? 'Yes' : 'No'}</div>
    </div>
    <div class="grid-item">
      <div class="grid-item-label">Generation Time</div>
      <div class="grid-item-value">${(generationTimeMs / 1000).toFixed(2)}s</div>
    </div>
  `;
  html += '</div>';
  html += '</div>';

  html += '<div class="section">';
  html += '<h2>Generated PDF</h2>';
  html += '<p>The generated artwork PDF is available for download separately.</p>';
  html += '</div>';

  return html;
}

/**
 * Generate extraction details HTML
 */
function generateExtractionDetailsHtml(extractionResults, inputDocuments) {
  let html = '<div class="section">';
  html += '<h2>Extraction Details</h2>';

  extractionResults.forEach((extraction, idx) => {
    const document = inputDocuments.find(d => d.id === extraction.documentId);
    
    html += `
      <h3>${escapeHtml(document?.name || 'Unknown Document')}</h3>
      <p style="font-size: 9pt; color: #6b7280; margin-bottom: 10px;">
        Provider: ${extraction.provider} • Processing Time: ${extraction.processingTimeMs}ms
      </p>
      
      <table>
        <thead>
          <tr>
            <th>Section</th>
            <th>Pages</th>
            <th>Confidence</th>
            <th>Content Preview</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    extraction.sections.forEach(section => {
      const confidenceClass = section.confidenceScore >= 0.85 ? 'confidence-high' :
                             section.confidenceScore >= 0.70 ? 'confidence-medium' : 'confidence-low';
      
      const contentPreview = section.content.substring(0, 100) + (section.content.length > 100 ? '...' : '');
      
      html += `
        <tr>
          <td><strong>${escapeHtml(section.sectionName)}</strong></td>
          <td>${section.pageReferences.join(', ')}</td>
          <td>
            <span class="confidence-score ${confidenceClass}">
              ${(section.confidenceScore * 100).toFixed(0)}%
            </span>
          </td>
          <td style="font-size: 9pt;">${escapeHtml(contentPreview)}</td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
  });

  html += '</div>';
  return html;
}

/**
 * Generate PDF from HTML using Puppeteer
 */
async function generatePdfFromHtml(htmlContent) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}