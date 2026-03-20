/**
 * Severity Scorer
 * Assigns severity levels (critical, major, minor) to deviations
 * based on deviation type and regulatory impact
 */

/**
 * Classify deviation severity based on type
 * @param {string} deviationType - Type of deviation detected
 * @returns {string} Severity level: 'critical', 'major', or 'minor'
 */
export function classifySeverity(deviationType) {
  // Critical deviations: Patient safety impact
  const criticalTypes = [
    'dosage_error',           // Incorrect dosage could harm patients
    'missing_warning',        // Missing safety warnings endangers patients
    'wrong_ingredient_info'   // Wrong active ingredient information is dangerous
  ];
  
  // Major deviations: Regulatory compliance impact
  const majorTypes = [
    'missing_section',        // Required sections must be present
    'content_error'           // Significant text changes affect meaning
  ];
  
  // Minor deviations: Formatting/presentation only
  const minorTypes = [
    'formatting_difference',  // Font, spacing, layout changes
    'spacing_difference'      // Whitespace variations
  ];
  
  if (criticalTypes.includes(deviationType)) {
    return 'critical';
  }
  
  if (majorTypes.includes(deviationType)) {
    return 'major';
  }
  
  if (minorTypes.includes(deviationType)) {
    return 'minor';
  }
  
  // Default to major for unknown types (conservative approach)
  console.warn(`[SeverityScorer] Unknown deviation type: ${deviationType}, defaulting to major`);
  return 'major';
}

/**
 * Get severity score (numeric) for sorting/filtering
 * @param {string} severity - Severity level
 * @returns {number} Numeric score (higher = more severe)
 */
export function getSeverityScore(severity) {
  const scores = {
    critical: 3,
    major: 2,
    minor: 1
  };
  
  return scores[severity] || 2; // Default to major
}

/**
 * Get severity color for UI display
 * @param {string} severity - Severity level
 * @returns {string} Tailwind color class
 */
export function getSeverityColor(severity) {
  const colors = {
    critical: 'rose',    // Red for critical
    major: 'amber',      // Yellow/orange for major
    minor: 'slate'       // Gray for minor
  };
  
  return colors[severity] || 'amber';
}

/**
 * Get severity label for display
 * @param {string} severity - Severity level
 * @returns {string} Human-readable label
 */
export function getSeverityLabel(severity) {
  const labels = {
    critical: 'Critical',
    major: 'Major',
    minor: 'Minor'
  };
  
  return labels[severity] || 'Major';
}

/**
 * Check if deviation requires immediate attention
 * @param {string} severity - Severity level
 * @returns {boolean} True if critical severity
 */
export function requiresImmediateAttention(severity) {
  return severity === 'critical';
}

/**
 * Get regulatory impact description
 * @param {string} severity - Severity level
 * @returns {string} Impact description
 */
export function getRegulatoryImpact(severity) {
  const impacts = {
    critical: 'Patient safety risk - immediate correction required before approval',
    major: 'Regulatory compliance issue - must be corrected for approval',
    minor: 'Formatting inconsistency - recommended to fix but not blocking'
  };
  
  return impacts[severity] || impacts.major;
}