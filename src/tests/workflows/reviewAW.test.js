import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeReviewAW, clearWorkflowExecutions } from '../../src/workflows/reviewAW.js';
import * as documentManager from '../../src/services/documentManager.js';
import * as extractionRouter from '../../src/services/extractionRouter.js';
import * as deviationDetector from '../../src/services/deviationDetector.js';

describe('Review AW Workflow - Performance and Completeness', () => {
  beforeEach(() => {
    clearWorkflowExecutions();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Performance Requirements', () => {
    it('should complete within 120 seconds for typical documents', async () => {
      // Mock documents
      const awDraft = {
        id: 'aw-draft-1',
        name: 'test-aw-draft.pdf',
        type: 'aw_draft',
        pageCount: 12
      };

      const approvedPil = {
        id: 'approved-pil-1',
        name: 'test-approved-pil.pdf',
        type: 'approved_pil',
        pageCount: 10
      };

      vi.spyOn(documentManager, 'getDocumentById')
        .mockImplementation((id) => {
          if (id === 'aw-draft-1') return awDraft;
          if (id === 'approved-pil-1') return approvedPil;
          return null;
        });

      // Mock extraction (simulate realistic timing)
      const mockSections = [
        { sectionName: 'PRODUCT NAME', content: 'Test Product', pageReferences: [1], confidenceScore: 0.95 },
        { sectionName: 'DOSAGE', content: 'Take once daily', pageReferences: [3], confidenceScore: 0.92 }
      ];

      vi.spyOn(extractionRouter, 'extractDocument')
        .mockImplementation(async () => {
          // Simulate extraction time (2-3 seconds per document)
          await new Promise(resolve => setTimeout(resolve, 2500));
          return {
            provider: 'google_docai',
            sections: mockSections,
            pageImages: [],
            processingTimeMs: 2500
          };
        });

      // Mock deviation detection (simulate realistic timing)
      vi.spyOn(deviationDetector, 'detectDeviations')
        .mockImplementation(async () => {
          // Simulate Claude API call (3-5 seconds)
          await new Promise(resolve => setTimeout(resolve, 4000));
          return {
            deviations: [
              {
                severity: 'critical',
                sectionName: 'DOSAGE',
                approvedText: 'Take once daily',
                artworkText: 'Take twice daily',
                deviationType: 'dosage_error',
                pageReference: 3,
                confidenceScore: 0.98,
                description: 'Dosage frequency changed'
              }
            ],
            processingTimeMs: 4000,
            completenessVerified: true
          };
        });

      const startTime = Date.now();
      const result = await executeReviewAW('aw-draft-1', 'approved-pil-1', 'test-session');
      const executionTimeMs = Date.now() - startTime;

      // Verify completion within 120 seconds
      expect(executionTimeMs).toBeLessThan(120000);
      expect(result.executionTimeMs).toBeLessThan(120000);
      expect(result.performanceMetrics.withinTimeLimit).toBe(true);

      // Verify performance metrics are tracked
      expect(result.performanceMetrics).toHaveProperty('extractionTimeMs');
      expect(result.performanceMetrics).toHaveProperty('deviationTimeMs');
      expect(result.performanceMetrics).toHaveProperty('totalTimeMs');
    });

    it('should throw error if workflow exceeds 120 second limit', async () => {
      const awDraft = {
        id: 'aw-draft-1',
        name: 'test-aw-draft.pdf',
        type: 'aw_draft',
        pageCount: 50 // Large document
      };

      const approvedPil = {
        id: 'approved-pil-1',
        name: 'test-approved-pil.pdf',
        type: 'approved_pil',
        pageCount: 45
      };

      vi.spyOn(documentManager, 'getDocumentById')
        .mockImplementation((id) => {
          if (id === 'aw-draft-1') return awDraft;
          if (id === 'approved-pil-1') return approvedPil;
          return null;
        });

      // Mock slow extraction (simulate timeout scenario)
      vi.spyOn(extractionRouter, 'extractDocument')
        .mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 65000)); // 65 seconds per document
          return {
            provider: 'google_docai',
            sections: [],
            pageImages: [],
            processingTimeMs: 65000
          };
        });

      await expect(
        executeReviewAW('aw-draft-1', 'approved-pil-1', 'test-session')
      ).rejects.toThrow(/exceeded.*time limit/i);
    });
  });

  describe('Completeness Verification', () => {
    it('should verify all deviations are detected including missing sections', async () => {
      const awDraft = {
        id: 'aw-draft-1',
        name: 'test-aw-draft.pdf',
        type: 'aw_draft'
      };

      const approvedPil = {
        id: 'approved-pil-1',
        name: 'test-approved-pil.pdf',
        type: 'approved_pil'
      };

      vi.spyOn(documentManager, 'getDocumentById')
        .mockImplementation((id) => {
          if (id === 'aw-draft-1') return awDraft;
          if (id === 'approved-pil-1') return approvedPil;
          return null;
        });

      const approvedSections = [
        { sectionName: 'PRODUCT NAME', content: 'Test Product', pageReferences: [1], confidenceScore: 0.95 },
        { sectionName: 'DOSAGE', content: 'Take once daily', pageReferences: [3], confidenceScore: 0.92 },
        { sectionName: 'WARNINGS', content: 'Do not use if pregnant', pageReferences: [5], confidenceScore: 0.90 }
      ];

      const artworkSections = [
        { sectionName: 'PRODUCT NAME', content: 'Test Product', pageReferences: [1], confidenceScore: 0.95 },
        { sectionName: 'DOSAGE', content: 'Take twice daily', pageReferences: [3], confidenceScore: 0.92 }
        // WARNINGS section missing
      ];

      vi.spyOn(extractionRouter, 'extractDocument')
        .mockImplementation(async (docId) => {
          return {
            provider: 'google_docai',
            sections: docId === 'approved-pil-1' ? approvedSections : artworkSections,
            pageImages: [],
            processingTimeMs: 2000
          };
        });

      vi.spyOn(deviationDetector, 'detectDeviations')
        .mockImplementation(async (approved, artwork) => {
          // Should detect missing WARNINGS section
          const deviations = [
            {
              severity: 'critical',
              sectionName: 'DOSAGE',
              approvedText: 'Take once daily',
              artworkText: 'Take twice daily',
              deviationType: 'dosage_error',
              pageReference: 3,
              confidenceScore: 0.98,
              description: 'Dosage frequency changed'
            },
            {
              severity: 'major',
              sectionName: 'WARNINGS',
              approvedText: 'Do not use if pregnant',
              artworkText: '',
              deviationType: 'missing_section',
              pageReference: 5,
              confidenceScore: 0.99,
              description: 'WARNINGS section missing from artwork'
            }
          ];

          return {
            deviations,
            processingTimeMs: 3000,
            completenessVerified: true
          };
        });

      const result = await executeReviewAW('aw-draft-1', 'approved-pil-1', 'test-session');

      // Verify completeness flag is set
      expect(result.completenessVerified).toBe(true);

      // Verify missing section was detected
      const missingSection = result.deviations.find(d => d.deviationType === 'missing_section');
      expect(missingSection).toBeDefined();
      expect(missingSection.sectionName).toBe('WARNINGS');
      expect(missingSection.severity).toBe('major');
    });

    it('should detect all deviation types (critical, major, minor)', async () => {
      const awDraft = {
        id: 'aw-draft-1',
        name: 'test-aw-draft.pdf',
        type: 'aw_draft'
      };

      const approvedPil = {
        id: 'approved-pil-1',
        name: 'test-approved-pil.pdf',
        type: 'approved_pil'
      };

      vi.spyOn(documentManager, 'getDocumentById')
        .mockImplementation((id) => {
          if (id === 'aw-draft-1') return awDraft;
          if (id === 'approved-pil-1') return approvedPil;
          return null;
        });

      vi.spyOn(extractionRouter, 'extractDocument')
        .mockResolvedValue({
          provider: 'google_docai',
          sections: [],
          pageImages: [],
          processingTimeMs: 2000
        });

      vi.spyOn(deviationDetector, 'detectDeviations')
        .mockResolvedValue({
          deviations: [
            {
              severity: 'critical',
              sectionName: 'DOSAGE',
              deviationType: 'dosage_error',
              approvedText: 'Take once daily',
              artworkText: 'Take twice daily',
              pageReference: 3,
              confidenceScore: 0.98,
              description: 'Dosage error'
            },
            {
              severity: 'major',
              sectionName: 'INDICATIONS',
              deviationType: 'content_error',
              approvedText: 'Treatment of cancer',
              artworkText: 'Treatment',
              pageReference: 2,
              confidenceScore: 0.92,
              description: 'Content simplified'
            },
            {
              severity: 'minor',
              sectionName: 'STORAGE',
              deviationType: 'formatting_difference',
              approvedText: 'Store at room temperature.',
              artworkText: 'Store at room temperature.\n',
              pageReference: 8,
              confidenceScore: 0.85,
              description: 'Line break added'
            }
          ],
          processingTimeMs: 3000,
          completenessVerified: true
        });

      const result = await executeReviewAW('aw-draft-1', 'approved-pil-1', 'test-session');

      // Verify all severity levels detected
      expect(result.summary.totalCritical).toBe(1);
      expect(result.summary.totalMajor).toBe(1);
      expect(result.summary.totalMinor).toBe(1);

      // Verify deviations array contains all types
      expect(result.deviations).toHaveLength(3);
      expect(result.deviations.some(d => d.severity === 'critical')).toBe(true);
      expect(result.deviations.some(d => d.severity === 'major')).toBe(true);
      expect(result.deviations.some(d => d.severity === 'minor')).toBe(true);
    });
  });
});