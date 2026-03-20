import express from 'express';
import { getAuditLog } from '../services/regulatoryDatabase.js';

const router = express.Router();

/**
 * GET /api/regulatory/audit-log
 * Retrieve regulatory audit log for compliance reporting
 */
router.get('/audit-log', async (req, res) => {
  try {
    const { market, startDate, endDate, event, limit } = req.query;
    
    const options = {
      market,
      startDate,
      endDate,
      event,
      limit: limit ? parseInt(limit, 10) : 1000
    };
    
    const result = await getAuditLog(options);
    
    res.json({
      success: true,
      total: result.total,
      entries: result.entries,
      filters: options
    });
  } catch (error) {
    console.error('[RegulatoryAudit] Failed to retrieve audit log:', error);
    res.status(500).json({
      error: {
        code: 'AUDIT_LOG_RETRIEVAL_FAILED',
        message: error.message,
        retryable: false
      }
    });
  }
});

/**
 * GET /api/regulatory/audit-log/export
 * Export audit log as CSV for regulatory inspections
 */
router.get('/audit-log/export', async (req, res) => {
  try {
    const { market, startDate, endDate, event } = req.query;
    
    const options = {
      market,
      startDate,
      endDate,
      event,
      limit: 10000 // Higher limit for exports
    };
    
    const result = await getAuditLog(options);
    
    // Convert to CSV
    const headers = ['Timestamp', 'Event', 'Market', 'Product Name', 'Requirements Version', 'Details'];
    const rows = result.entries.map(entry => [
      entry.timestamp,
      entry.event,
      entry.market || '',
      entry.productName || '',
      entry.requirementsVersion || '',
      JSON.stringify({
        errors: entry.errors,
        warnings: entry.warnings,
        mandatorySectionsFound: entry.mandatorySectionsFound,
        mandatorySectionsRequired: entry.mandatorySectionsRequired
      })
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="regulatory-audit-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('[RegulatoryAudit] Failed to export audit log:', error);
    res.status(500).json({
      error: {
        code: 'AUDIT_LOG_EXPORT_FAILED',
        message: error.message,
        retryable: false
      }
    });
  }
});

export default router;