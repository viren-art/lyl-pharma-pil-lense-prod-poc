/**
 * Parse and apply diecut specifications to AW layout
 * Extracts paper dimensions from Diecut Specification document
 */

/**
 * Parse diecut specification from uploaded document
 * Returns { widthMm, heightMm, foldType, panelDimensions }
 */
export async function parseDiecutSpecification(diecutDocument) {
  // For MVP, we'll extract dimensions from document name or metadata
  // In production, this would use OCR or structured data extraction
  
  // Try to extract dimensions from document name
  // Expected format: "Diecut_210x297_z-fold.pdf" or similar
  const nameMatch = diecutDocument.name.match(/(\d+)\s*x\s*(\d+)/i);
  
  if (nameMatch) {
    const widthMm = parseInt(nameMatch[1], 10);
    const heightMm = parseInt(nameMatch[2], 10);
    
    // Detect fold type from name
    let foldType = 'standard';
    if (diecutDocument.name.toLowerCase().includes('z-fold')) {
      foldType = 'z-fold';
    } else if (diecutDocument.name.toLowerCase().includes('c-fold')) {
      foldType = 'c-fold';
    } else if (diecutDocument.name.toLowerCase().includes('gate-fold')) {
      foldType = 'gate-fold';
    }
    
    return {
      widthMm,
      heightMm,
      foldType,
      panelDimensions: calculatePanelDimensions(widthMm, heightMm, foldType)
    };
  }
  
  // Fallback: use standard A4 dimensions
  console.warn(`[DiecutApplier] Could not parse dimensions from document name: ${diecutDocument.name}. Using A4 default.`);
  return {
    widthMm: 210,
    heightMm: 297,
    foldType: 'standard',
    panelDimensions: []
  };
}

/**
 * Calculate panel dimensions based on fold type
 */
function calculatePanelDimensions(widthMm, heightMm, foldType) {
  const panels = [];
  
  switch (foldType) {
    case 'z-fold':
      // 3 equal panels
      const zPanelWidth = widthMm / 3;
      panels.push(
        { panelNumber: 1, widthMm: zPanelWidth, heightMm },
        { panelNumber: 2, widthMm: zPanelWidth, heightMm },
        { panelNumber: 3, widthMm: zPanelWidth, heightMm }
      );
      break;
      
    case 'c-fold':
      // 3 panels: outer panels slightly smaller
      const cPanelWidth = widthMm / 3;
      panels.push(
        { panelNumber: 1, widthMm: cPanelWidth - 2, heightMm },
        { panelNumber: 2, widthMm: cPanelWidth, heightMm },
        { panelNumber: 3, widthMm: cPanelWidth - 2, heightMm }
      );
      break;
      
    case 'gate-fold':
      // 4 panels: 2 outer gates + 2 inner panels
      const gatePanelWidth = widthMm / 4;
      panels.push(
        { panelNumber: 1, widthMm: gatePanelWidth, heightMm },
        { panelNumber: 2, widthMm: gatePanelWidth, heightMm },
        { panelNumber: 3, widthMm: gatePanelWidth, heightMm },
        { panelNumber: 4, widthMm: gatePanelWidth, heightMm }
      );
      break;
      
    default:
      // No panels for standard (single page)
      break;
  }
  
  return panels;
}

/**
 * Validate diecut dimensions are within acceptable ranges
 */
export function validateDiecutDimensions(diecutSpec) {
  const errors = [];
  
  // Check minimum dimensions (50mm x 50mm)
  if (diecutSpec.widthMm < 50) {
    errors.push('Width must be at least 50mm');
  }
  if (diecutSpec.heightMm < 50) {
    errors.push('Height must be at least 50mm');
  }
  
  // Check maximum dimensions (500mm x 500mm)
  if (diecutSpec.widthMm > 500) {
    errors.push('Width must not exceed 500mm');
  }
  if (diecutSpec.heightMm > 500) {
    errors.push('Height must not exceed 500mm');
  }
  
  // Check aspect ratio (not too extreme)
  const aspectRatio = diecutSpec.widthMm / diecutSpec.heightMm;
  if (aspectRatio < 0.2 || aspectRatio > 5) {
    errors.push('Aspect ratio is too extreme (width/height must be between 0.2 and 5)');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}