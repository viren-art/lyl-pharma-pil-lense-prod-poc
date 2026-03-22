/**
 * Python Document Service Client
 *
 * Proxies document operations to the Python FastAPI microservice
 * running on port 8081 on the same container.
 *
 * Provides high-fidelity Word extraction (with formatting) and
 * template-cloned Word generation matching approved Lotus PIL format.
 */

const PYTHON_SERVICE_URL = process.env.PYTHON_DOC_SERVICE_URL || 'http://localhost:8081';

/**
 * Check if the Python service is available
 */
export async function isPythonServiceAvailable() {
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(3000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Extract Word document with full formatting metadata
 * Returns: paragraphs with bold/italic/font info, tables, images
 */
export async function extractWordWithFormatting(buffer, filename = 'document.docx') {
  const formData = new FormData();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  formData.append('file', blob, filename);

  const response = await fetch(`${PYTHON_SERVICE_URL}/extract/word`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Python word extraction failed: ${error}`);
  }

  return response.json();
}

/**
 * Extract tables from PDF using camelot/tabula
 * Better than Claude Vision for complex clinical trial tables
 */
export async function extractPdfTables(buffer, filename = 'document.pdf') {
  const formData = new FormData();
  const blob = new Blob([buffer], { type: 'application/pdf' });
  formData.append('file', blob, filename);

  const response = await fetch(`${PYTHON_SERVICE_URL}/extract/pdf-tables`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(60000)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Python PDF table extraction failed: ${error}`);
  }

  return response.json();
}

/**
 * Generate Word document matching approved Lotus PIL format
 * If templateBuffer is provided, clones exact formatting from it
 */
export async function generateWord(sections, productName, marketCode, mode, templateBuffer = null) {
  const formData = new FormData();
  formData.append('sections_json', JSON.stringify(sections));
  formData.append('product_name', productName || '');
  formData.append('market_code', marketCode || 'taiwan_tfda');
  formData.append('mode', mode || 'tc');

  if (templateBuffer) {
    const blob = new Blob([templateBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    formData.append('template_file', blob, 'template.docx');
  }

  const response = await fetch(`${PYTHON_SERVICE_URL}/generate/word`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Python word generation failed: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generate PDF with CJK fonts
 */
export async function generatePdf(sections, productName, marketCode) {
  const formData = new FormData();
  formData.append('sections_json', JSON.stringify(sections));
  formData.append('product_name', productName || '');
  formData.append('market_code', marketCode || 'taiwan_tfda');

  const response = await fetch(`${PYTHON_SERVICE_URL}/generate/pdf`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Python PDF generation failed: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
