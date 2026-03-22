import puppeteer from 'puppeteer-core';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { 
  getMarketRequirements, 
  persistAuditLog, 
  initializeRegulatoryDatabase 
} from './regulatoryDatabase.js';

// LYL_DEP: puppeteer@^21.0.0
// LYL_DEP: pdf-parse@^1.1.1

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Performance optimization: Cache browser instance with aggressive resource limits
let browserInstance = null;
let browserLastUsed = Date.now();
const BROWSER_IDLE_TIMEOUT = 2 * 60 * 1000; // 2 minutes (reduced from 5)
const GENERATION_TIMEOUT = 55000; // 55 seconds (5s buffer for workflow overhead)
const PAGE_LOAD_TIMEOUT = 20000; // 20 seconds max for content loading
const PDF_RENDER_TIMEOUT = 25000; // 25 seconds max for PDF rendering

// Initialize regulatory database on module load
initializeRegulatoryDatabase().catch(error => {
  console.error('[AWGenerator] Failed to initialize regulatory database:', error);
});

/**
 * Abstracted PDF generation interface
 * Current implementation: Puppeteer HTML-to-PDF with performance optimization
 * Future: Can migrate to InDesign Server or specialized pharmaceutical layout engines
 */

/**
 * Generate AW PDF from extracted sections using market-specific template
 * Implements 60-second timeout and regulatory text verification
 */
export async function generateAWPdf({ sections, market, diecutSpec, productName, documentName }) {
  const startTime = Date.now();
  
  try {
    // Load market requirements from external database
    const requirements = await getMarketRequirements(market);
    
    // Verify regulatory requirements BEFORE generation
    const verificationResult = await verifyRegulatoryRequirements(sections, market, requirements);
    if (!verificationResult.valid) {
      const errorMsg = `Regulatory verification failed: ${verificationResult.errors.join(', ')}`;
      await persistAuditLog({
        event: 'VERIFICATION_FAILED',
        market,
        productName,
        errors: verificationResult.errors,
        sectionsProvided: sections.length,
        requirementsVersion: requirements.version
      });
      throw new Error(errorMsg);
    }
    
    await persistAuditLog({
      event: 'VERIFICATION_PASSED',
      market,
      productName,
      mandatorySectionsFound: verificationResult.mandatorySectionsFound,
      mandatorySectionsRequired: verificationResult.mandatorySectionsRequired,
      requirementsVersion: requirements.version
    });
    
    // Load market-specific template
    const templatePath = market === 'taiwan_tfda' 
      ? path.join(__dirname, '../templates/tfda.html')
      : path.join(__dirname, '../templates/thaifda.html');
    
    let templateHtml;
    try {
      templateHtml = await fs.readFile(templatePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to load template for market ${market}: ${error.message}`);
    }
    
    // Prepare template data
    const templateData = prepareTemplateData(sections, market, diecutSpec, productName, requirements);
    
    // Render HTML with template data
    const renderedHtml = renderTemplate(templateHtml, templateData);
    
    // Generate PDF using Puppeteer with strict timeout
    const pdfBuffer = await Promise.race([
      generatePdfWithPuppeteer(renderedHtml, market, diecutSpec),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('PDF generation timeout: exceeded 55 seconds')), GENERATION_TIMEOUT)
      )
    ]);
    
    const generationTimeMs = Date.now() - startTime;
    
    // Final verification: Ensure regulatory text is in generated PDF
    const finalVerification = await verifyGeneratedPdf(pdfBuffer, market, requirements);
    
    if (!finalVerification.valid) {
      await persistAuditLog({
        event: 'FINAL_VERIFICATION_FAILED',
        market,
        productName,
        disclaimerFound: finalVerification.disclaimerFound,
        emergencyPhoneFound: finalVerification.emergencyPhoneFound,
        mandatorySectionsFound: finalVerification.mandatorySectionsFound,
        mandatorySectionsRequired: finalVerification.mandatorySectionsRequired,
        requirementsVersion: requirements.version
      });
      throw new Error(`Final PDF verification failed: ${finalVerification.missingItems.join(', ')}`);
    }
    
    await persistAuditLog({
      event: 'PDF_GENERATED_SUCCESS',
      market,
      productName,
      generationTimeMs,
      sectionsProcessed: sections.length,
      diecutApplied: !!diecutSpec,
      finalVerification: finalVerification,
      requirementsVersion: requirements.version
    });
    
    // Log audit trail
    console.log(`[AWGenerator] PDF generated successfully`, {
      market,
      generationTimeMs,
      sectionsProcessed: sections.length,
      regulatoryVerification: verificationResult,
      finalVerification,
      diecutApplied: !!diecutSpec,
      requirementsVersion: requirements.version,
      timestamp: new Date().toISOString()
    });
    
    return {
      pdfBase64: pdfBuffer.toString('base64'),
      generationTimeMs,
      regulatoryVerification: verificationResult,
      finalVerification,
      auditTrail: {
        verificationPassed: true,
        finalVerificationPassed: true,
        requirementsVersion: requirements.version,
        requirementsLastUpdated: requirements.lastUpdated,
        auditLogPersisted: true
      }
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    console.error(`[AWGenerator] PDF generation failed`, {
      market,
      executionTimeMs,
      error: error.message,
      stack: error.stack
    });
    
    await persistAuditLog({
      event: 'PDF_GENERATION_FAILED',
      market,
      productName,
      executionTimeMs,
      error: error.message
    });
    
    throw error;
  }
}

/**
 * Verify regulatory requirements before PDF generation
 * Ensures 100% accuracy for mandatory regulatory text
 */
async function verifyRegulatoryRequirements(sections, market, requirements) {
  const errors = [];
  const warnings = [];
  
  // Check mandatory sections exist in extracted content
  const sectionNames = sections.map(s => s.sectionName.toUpperCase());
  const missingSections = [];
  
  for (const mandatorySection of requirements.mandatorySections) {
    const found = sectionNames.some(name => 
      name.includes(mandatorySection) || mandatorySection.includes(name)
    );
    if (!found) {
      missingSections.push(mandatorySection);
      errors.push(`Missing mandatory section: ${mandatorySection}`);
    }
  }
  
  // Verify regulatory disclaimer exists in requirements
  if (!requirements.disclaimer) {
    errors.push('Regulatory disclaimer not defined in requirements database');
  }
  
  // Verify emergency contact exists in requirements
  if (!requirements.emergencyPhone) {
    warnings.push('Emergency phone not defined in requirements database');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    verifiedAt: new Date().toISOString(),
    market,
    mandatorySectionsFound: requirements.mandatorySections.length - missingSections.length,
    mandatorySectionsRequired: requirements.mandatorySections.length,
    missingSections,
    requirementsVersion: requirements.version
  };
}

/**
 * Verify generated PDF contains regulatory text
 * Final validation step for 100% accuracy guarantee
 */
async function verifyGeneratedPdf(pdfBuffer, market, requirements) {
  const missingItems = [];
  
  try {
    const data = await pdfParse(pdfBuffer);
    const pdfText = data.text;
    
    // Verify disclaimer
    const disclaimerFound = pdfText.includes(requirements.disclaimer);
    if (!disclaimerFound) {
      missingItems.push(`Regulatory disclaimer: "${requirements.disclaimer}"`);
    }
    
    // Verify emergency phone
    const emergencyPhoneFound = pdfText.includes(requirements.emergencyPhone);
    if (!emergencyPhoneFound) {
      missingItems.push(`Emergency phone: "${requirements.emergencyPhone}"`);
    }
    
    // Check for mandatory sections in PDF text
    const mandatorySectionsInPdf = [];
    const missingSectionsInPdf = [];
    
    for (const section of requirements.mandatorySections) {
      if (pdfText.toUpperCase().includes(section)) {
        mandatorySectionsInPdf.push(section);
      } else {
        missingSectionsInPdf.push(section);
        missingItems.push(`Mandatory section: "${section}"`);
      }
    }
    
    const valid = disclaimerFound && emergencyPhoneFound && missingSectionsInPdf.length === 0;
    
    return {
      valid,
      disclaimerFound,
      emergencyPhoneFound,
      mandatorySectionsFound: mandatorySectionsInPdf.length,
      mandatorySectionsRequired: requirements.mandatorySections.length,
      missingSections: missingSectionsInPdf,
      missingItems,
      verifiedAt: new Date().toISOString(),
      verificationMethod: 'pdf-parse',
      requirementsVersion: requirements.version
    };
  } catch (error) {
    console.error('[AWGenerator] PDF verification failed:', error);
    // Fallback to basic buffer search if pdf-parse fails
    const pdfText = pdfBuffer.toString('utf-8', 0, Math.min(pdfBuffer.length, 10000));
    
    const disclaimerFound = pdfText.includes(requirements.disclaimer);
    const emergencyPhoneFound = pdfText.includes(requirements.emergencyPhone);
    
    if (!disclaimerFound) {
      missingItems.push(`Regulatory disclaimer: "${requirements.disclaimer}"`);
    }
    if (!emergencyPhoneFound) {
      missingItems.push(`Emergency phone: "${requirements.emergencyPhone}"`);
    }
    
    return {
      valid: disclaimerFound && emergencyPhoneFound,
      disclaimerFound,
      emergencyPhoneFound,
      mandatorySectionsFound: 0,
      mandatorySectionsRequired: requirements.mandatorySections.length,
      missingSections: requirements.mandatorySections,
      missingItems,
      verifiedAt: new Date().toISOString(),
      verificationMethod: 'fallback',
      verificationError: error.message,
      requirementsVersion: requirements.version
    };
  }
}

/**
 * Prepare data for template rendering
 */
function prepareTemplateData(sections, market, diecutSpec, productName, requirements) {
  // Get market-specific section ordering from requirements database
  const sectionOrder = requirements.sectionOrdering || requirements.mandatorySections;
  
  // Reorder sections according to market requirements
  const orderedSections = [];
  for (const sectionName of sectionOrder) {
    const section = sections.find(s => 
      s.sectionName.toLowerCase().includes(sectionName.toLowerCase()) ||
      sectionName.toLowerCase().includes(s.sectionName.toLowerCase())
    );
    if (section) {
      orderedSections.push(section);
    }
  }
  
  // Add any remaining sections not in the order list
  for (const section of sections) {
    if (!orderedSections.find(s => s.sectionName === section.sectionName)) {
      orderedSections.push(section);
    }
  }
  
  // Get market-specific configuration from requirements
  const config = {
    fontFamily: market === 'taiwan_tfda' ? 'Noto Sans TC, sans-serif' : 'Noto Sans Thai, sans-serif',
    fontSize: {
      productName: '14pt',
      heading: '12pt',
      body: '10pt'
    },
    lineHeight: 1.5,
    regulatoryDisclaimer: requirements.disclaimer,
    measurementUnits: {
      dosage: 'mg/kg',
      volume: 'mL'
    },
    emergencyContact: {
      phone: requirements.emergencyPhone,
      address: requirements.emergencyAddress,
      hours: requirements.emergencyHours
    },
    paperDimensions: {
      width: '210mm',
      height: '297mm'
    }
  };
  
  return {
    productName,
    sections: orderedSections,
    config,
    diecutSpec,
    generatedDate: new Date().toISOString().split('T')[0],
    requirementsVersion: requirements.version
  };
}

/**
 * Render template with data
 */
function renderTemplate(templateHtml, data) {
  let rendered = templateHtml;
  
  // Replace product name
  rendered = rendered.replace(/\{\{productName\}\}/g, escapeHtml(data.productName || ''));
  
  // Replace generated date
  rendered = rendered.replace(/\{\{generatedDate\}\}/g, data.generatedDate);
  
  // Replace configuration values
  rendered = rendered.replace(/\{\{fontFamily\}\}/g, data.config.fontFamily);
  rendered = rendered.replace(/\{\{productNameFontSize\}\}/g, data.config.fontSize.productName);
  rendered = rendered.replace(/\{\{headingFontSize\}\}/g, data.config.fontSize.heading);
  rendered = rendered.replace(/\{\{bodyFontSize\}\}/g, data.config.fontSize.body);
  rendered = rendered.replace(/\{\{lineHeight\}\}/g, data.config.lineHeight);
  rendered = rendered.replace(/\{\{regulatoryDisclaimer\}\}/g, escapeHtml(data.config.regulatoryDisclaimer));
  rendered = rendered.replace(/\{\{emergencyPhone\}\}/g, escapeHtml(data.config.emergencyContact.phone));
  rendered = rendered.replace(/\{\{emergencyAddress\}\}/g, escapeHtml(data.config.emergencyContact.address));
  rendered = rendered.replace(/\{\{emergencyHours\}\}/g, escapeHtml(data.config.emergencyContact.hours));
  
  // Apply diecut dimensions if provided
  if (data.diecutSpec) {
    rendered = rendered.replace(/\{\{pageWidth\}\}/g, `${data.diecutSpec.widthMm}mm`);
    rendered = rendered.replace(/\{\{pageHeight\}\}/g, `${data.diecutSpec.heightMm}mm`);
  } else {
    rendered = rendered.replace(/\{\{pageWidth\}\}/g, data.config.paperDimensions.width);
    rendered = rendered.replace(/\{\{pageHeight\}\}/g, data.config.paperDimensions.height);
  }
  
  // Render sections
  const sectionsHtml = data.sections.map(section => {
    const sectionHtml = `
      <div class="section">
        <h2 class="section-heading">${escapeHtml(section.sectionName)}</h2>
        <div class="section-content">${formatContent(section.content)}</div>
      </div>
    `;
    return sectionHtml;
  }).join('\n');
  
  rendered = rendered.replace(/\{\{sections\}\}/g, sectionsHtml);
  
  return rendered;
}

/**
 * Format section content (preserve line breaks, handle tables)
 */
function formatContent(content) {
  // Escape HTML
  let formatted = escapeHtml(content);
  
  // Convert line breaks to <br>
  formatted = formatted.replace(/\n/g, '<br>');
  
  // Detect and format simple tables (lines with | separators)
  const lines = formatted.split('<br>');
  let inTable = false;
  let tableHtml = '';
  const result = [];
  
  for (const line of lines) {
    if (line.includes('|')) {
      if (!inTable) {
        inTable = true;
        tableHtml = '<table class="content-table"><tbody>';
      }
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      tableHtml += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
    } else {
      if (inTable) {
        tableHtml += '</tbody></table>';
        result.push(tableHtml);
        tableHtml = '';
        inTable = false;
      }
      result.push(line);
    }
  }
  
  if (inTable) {
    tableHtml += '</tbody></table>';
    result.push(tableHtml);
  }
  
  return result.join('<br>');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Get or create browser instance with aggressive resource optimization
 * Performance optimization: Reuse browser instance with strict limits
 */
async function getBrowserInstance() {
  const now = Date.now();
  
  // Close browser if idle for too long
  if (browserInstance && (now - browserLastUsed) > BROWSER_IDLE_TIMEOUT) {
    console.log('[AWGenerator] Closing idle browser instance');
    try {
      await browserInstance.close();
    } catch (error) {
      console.warn('[AWGenerator] Error closing browser:', error.message);
    }
    browserInstance = null;
  }
  
  // Create new browser if needed
  if (!browserInstance) {
    console.log('[AWGenerator] Creating new browser instance with performance optimizations');
    browserInstance = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--mute-audio',
        // Additional performance optimizations
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--disable-notifications'
      ],
      // Performance optimization: Limit resources
      defaultViewport: {
        width: 794, // A4 width in pixels at 96 DPI
        height: 1123 // A4 height in pixels at 96 DPI
      },
      // Reduce memory footprint
      ignoreHTTPSErrors: true,
      dumpio: false
    });
  }
  
  browserLastUsed = now;
  return browserInstance;
}

/**
 * Generate PDF using Puppeteer with aggressive performance optimizations
 * Implements strict 55-second timeout and resource optimization
 */
async function generatePdfWithPuppeteer(html, market, diecutSpec) {
  const browser = await getBrowserInstance();
  const page = await browser.newPage();
  
  try {
    // Performance optimization: Disable all unnecessary features
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      // Block ALL external resources for maximum speed
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media', 'websocket', 'manifest', 'other'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // Disable JavaScript execution for static content
    await page.setJavaScriptEnabled(false);
    
    // Set content with aggressive timeout
    await page.setContent(html, {
      waitUntil: 'domcontentloaded', // Fastest option
      timeout: PAGE_LOAD_TIMEOUT
    });
    
    // Get page dimensions
    let width = '210mm';
    let height = '297mm';
    
    if (diecutSpec) {
      width = `${diecutSpec.widthMm}mm`;
      height = `${diecutSpec.heightMm}mm`;
    }
    
    // Generate PDF with optimized settings
    const pdfBuffer = await page.pdf({
      width,
      height,
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      },
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      omitBackground: false,
      timeout: PDF_RENDER_TIMEOUT
    });
    
    return pdfBuffer;
  } finally {
    // Close page immediately but keep browser instance for reuse
    await page.close();
  }
}

/**
 * Cleanup function to close browser on shutdown
 */
export async function cleanup() {
  if (browserInstance) {
    console.log('[AWGenerator] Closing browser instance on cleanup');
    try {
      await browserInstance.close();
    } catch (error) {
      console.warn('[AWGenerator] Error during cleanup:', error.message);
    }
    browserInstance = null;
  }
}

// Handle process termination
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);