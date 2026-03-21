/**
 * Pharmaceutical Validation Guardrails
 * Post-LLM validation checks to ensure output quality and patient safety.
 * No hallucination tolerance — flag uncertainty instead of guessing.
 */

// Known pharmaceutical section names
const KNOWN_SECTION_PATTERNS = [
  'product name', 'active ingredient', 'composition',
  'indication', 'therapeutic', 'dosage', 'administration', 'posology',
  'contraindication', 'warning', 'precaution', 'special warning',
  'adverse', 'undesirable effect', 'side effect',
  'drug interaction', 'interaction',
  'pregnancy', 'lactation', 'fertility',
  'storage', 'shelf life',
  'overdose', 'overdosage',
  'pharmacolog', 'pharmacokinetic', 'pharmacodynamic',
  'manufacturer', 'marketing authorisation',
];

/**
 * Validate extraction results
 * @param {Array} sections - Extracted sections
 * @param {number} actualPageCount - Actual document page count (if known)
 * @returns {Object} Validation result with warnings
 */
export function validateExtraction(sections, actualPageCount) {
  const warnings = [];

  for (const section of sections) {
    // Confidence scores must be 0-1
    if (typeof section.confidenceScore !== 'number' ||
        section.confidenceScore < 0 || section.confidenceScore > 1) {
      warnings.push({
        type: 'invalid_confidence',
        section: section.sectionName,
        message: `Invalid confidence score: ${section.confidenceScore}`,
        corrected: true
      });
      section.confidenceScore = Math.max(0, Math.min(1, section.confidenceScore || 0.5));
    }

    // Critical sections need confidence >= 0.85
    const isCritical = isCriticalSection(section.sectionName);
    if (isCritical && section.confidenceScore < 0.85) {
      warnings.push({
        type: 'low_critical_confidence',
        section: section.sectionName,
        message: `Critical section "${section.sectionName}" has low confidence: ${section.confidenceScore}`,
        corrected: false
      });
    }

    // Page references must be within actual page count
    if (actualPageCount && section.pageReferences) {
      const invalidPages = section.pageReferences.filter(p => p < 1 || p > actualPageCount);
      if (invalidPages.length > 0) {
        warnings.push({
          type: 'invalid_page_reference',
          section: section.sectionName,
          message: `Page references ${invalidPages.join(', ')} outside document range (1-${actualPageCount})`,
          corrected: true
        });
        section.pageReferences = section.pageReferences.filter(p => p >= 1 && p <= actualPageCount);
      }
    }

    // Validate section name looks pharmaceutical
    if (!isKnownSectionPattern(section.sectionName)) {
      warnings.push({
        type: 'unknown_section_name',
        section: section.sectionName,
        message: `Section name "${section.sectionName}" does not match known pharmaceutical terminology`,
        corrected: false
      });
    }

    // Validate dosage values in content
    const dosageWarnings = validateDosageValues(section.sectionName, section.content);
    warnings.push(...dosageWarnings);
  }

  return {
    valid: warnings.filter(w => !w.corrected).length === 0,
    warnings,
    correctedCount: warnings.filter(w => w.corrected).length,
    warningCount: warnings.filter(w => !w.corrected).length
  };
}

/**
 * Validate deviation detection results
 * @param {Array} deviations - Detected deviations
 * @param {number} maxPageCount - Maximum page count across documents
 * @returns {Object} Validation result with warnings
 */
export function validateDeviations(deviations, maxPageCount) {
  const warnings = [];

  for (const deviation of deviations) {
    // Severity must be valid
    if (!['critical', 'major', 'minor'].includes(deviation.severity)) {
      warnings.push({
        type: 'invalid_severity',
        section: deviation.sectionName,
        message: `Invalid severity "${deviation.severity}" — defaulting to "major"`,
        corrected: true
      });
      deviation.severity = 'major';
    }

    // Page reference must be valid
    if (maxPageCount && deviation.pageReference) {
      if (deviation.pageReference < 1 || deviation.pageReference > maxPageCount) {
        warnings.push({
          type: 'invalid_page_reference',
          section: deviation.sectionName,
          message: `Page reference ${deviation.pageReference} outside document range`,
          corrected: true
        });
        deviation.pageReference = 1;
      }
    }

    // Confidence must be 0-1
    if (typeof deviation.confidenceScore === 'number') {
      if (deviation.confidenceScore < 0 || deviation.confidenceScore > 1) {
        deviation.confidenceScore = Math.max(0, Math.min(1, deviation.confidenceScore));
      }
    }

    // Critical deviations involving dosage should cross-check values
    if (deviation.severity === 'critical' && deviation.deviationType === 'incorrect-text') {
      const dosageWarnings = validateDosageValues(deviation.sectionName, deviation.approvedText);
      warnings.push(...dosageWarnings);
    }
  }

  return {
    valid: warnings.filter(w => !w.corrected).length === 0,
    warnings,
    correctedCount: warnings.filter(w => w.corrected).length,
    warningCount: warnings.filter(w => !w.corrected).length
  };
}

/**
 * Validate variation classification
 */
export function validateClassification(result) {
  const warnings = [];

  if (!['complicated', 'general', 'COMPLICATED', 'GENERAL'].includes(result.classification)) {
    warnings.push({
      type: 'invalid_classification',
      message: `Invalid classification "${result.classification}" — must be "complicated" or "general"`,
      corrected: false
    });
  }

  if (typeof result.confidenceScore === 'number') {
    if (result.confidenceScore < 0 || result.confidenceScore > 1) {
      result.confidenceScore = Math.max(0, Math.min(1, result.confidenceScore));
      warnings.push({ type: 'corrected_confidence', message: 'Confidence score clamped to 0-1', corrected: true });
    }

    // Low-confidence classifications need flagging
    if (result.confidenceScore < 0.80) {
      warnings.push({
        type: 'low_classification_confidence',
        message: `Classification confidence ${result.confidenceScore} is below 80% threshold — requires human review`,
        corrected: false
      });
    }
  }

  return { valid: warnings.filter(w => !w.corrected).length === 0, warnings };
}

// ── Internal helpers ──

function isCriticalSection(sectionName) {
  const name = sectionName.toLowerCase();
  return name.includes('dosage') || name.includes('administration') ||
         name.includes('warning') || name.includes('precaution') ||
         name.includes('contraindication') || name.includes('active ingredient');
}

function isKnownSectionPattern(sectionName) {
  const name = sectionName.toLowerCase();
  return KNOWN_SECTION_PATTERNS.some(pattern => name.includes(pattern)) ||
         // Accept numbered sections like "4.2 Posology"
         /^\d+(\.\d+)*\s+/.test(sectionName) ||
         // Accept CJK/Thai headings
         /[\u4E00-\u9FFF\u0E00-\u0E7F\uAC00-\uD7AF]/.test(sectionName) ||
         // Accept DOCUMENT HEADER (our generated section)
         name === 'document header';
}

function validateDosageValues(sectionName, content) {
  const warnings = [];
  if (!content) return warnings;

  const name = sectionName.toLowerCase();
  if (!name.includes('dosage') && !name.includes('administration') && !name.includes('posology')) {
    return warnings;
  }

  // Check for suspiciously high dosage values
  const dosageMatches = content.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|units?)\b/gi) || [];
  for (const match of dosageMatches) {
    const numMatch = match.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      const value = parseFloat(numMatch[1]);
      if (value === 0) {
        warnings.push({
          type: 'suspicious_dosage',
          section: sectionName,
          message: `Zero dosage value found: "${match}" — likely extraction error`,
          corrected: false
        });
      }
      if (value > 10000) {
        warnings.push({
          type: 'suspicious_dosage',
          section: sectionName,
          message: `Unusually high dosage value: "${match}" — verify accuracy`,
          corrected: false
        });
      }
    }
  }

  return warnings;
}
