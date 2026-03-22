import { Router } from 'express';
import { getAllTemplates, getTemplate, updateTemplate, learnTemplateFromDocument } from '../services/marketTemplates.js';
import { getDocumentById } from '../services/documentManager.js';

const router = Router();

/**
 * GET /api/config/market-templates
 * List all market section templates
 */
router.get('/', (req, res) => {
  try {
    const templates = getAllTemplates();
    res.json({
      templates,
      count: templates.length
    });
  } catch (error) {
    console.error('[MarketTemplates API] List failed:', error.message);
    res.status(500).json({ error: { code: 'LIST_FAILED', message: error.message } });
  }
});

/**
 * GET /api/config/market-templates/:marketCode
 * Get a specific market template
 */
router.get('/:marketCode', (req, res) => {
  try {
    const template = getTemplate(req.params.marketCode);
    if (!template) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: `Template not found: ${req.params.marketCode}` }
      });
    }
    res.json(template);
  } catch (error) {
    console.error('[MarketTemplates API] Get failed:', error.message);
    res.status(500).json({ error: { code: 'GET_FAILED', message: error.message } });
  }
});

/**
 * PUT /api/config/market-templates/:marketCode
 * Update a market template (manual editing)
 */
router.put('/:marketCode', (req, res) => {
  try {
    const updated = updateTemplate(req.params.marketCode, req.body);
    res.json(updated);
  } catch (error) {
    console.error('[MarketTemplates API] Update failed:', error.message);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: { code: 'UPDATE_FAILED', message: error.message } });
  }
});

/**
 * POST /api/config/market-templates/learn
 * Upload a document and extract market section structure via Claude
 * Body: { documentId, marketCode, marketName }
 */
router.post('/learn', async (req, res) => {
  try {
    const { documentId, marketCode, marketName } = req.body;

    if (!documentId || !marketCode) {
      return res.status(400).json({
        error: { code: 'VALIDATION_FAILED', message: 'documentId and marketCode are required' }
      });
    }

    const document = getDocumentById(documentId);
    if (!document) {
      return res.status(404).json({
        error: { code: 'DOCUMENT_NOT_FOUND', message: `Document ${documentId} not found` }
      });
    }

    const template = await learnTemplateFromDocument(document, marketCode, marketName);
    res.json({
      message: `Template learned from ${document.name}`,
      template
    });
  } catch (error) {
    console.error('[MarketTemplates API] Learn failed:', error.message);
    res.status(500).json({ error: { code: 'LEARN_FAILED', message: error.message } });
  }
});

export default router;
