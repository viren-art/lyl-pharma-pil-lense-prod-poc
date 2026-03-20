import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Regulatory Requirements Database
 * External JSON-based database for regulatory text requirements with version control
 * Supports audit trail persistence and compliance tracking
 */

const DB_PATH = path.join(__dirname, '../config/regulatory-requirements.json');
const AUDIT_LOG_PATH = path.join(__dirname, '../logs/regulatory-audit.jsonl');

// In-memory cache for performance
let requirementsCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load regulatory requirements from external JSON database
 * Implements version control and change tracking
 */
export async function loadRegulatoryRequirements() {
  const now = Date.now();
  
  // Return cached version if still valid
  if (requirementsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL) {
    return requirementsCache;
  }
  
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    const requirements = JSON.parse(data);
    
    // Validate schema
    if (!requirements.version || !requirements.lastUpdated || !requirements.markets) {
      throw new Error('Invalid regulatory requirements database schema');
    }
    
    // Update cache
    requirementsCache = requirements;
    cacheTimestamp = now;
    
    console.log('[RegulatoryDB] Loaded requirements database', {
      version: requirements.version,
      lastUpdated: requirements.lastUpdated,
      markets: Object.keys(requirements.markets)
    });
    
    return requirements;
  } catch (error) {
    console.error('[RegulatoryDB] Failed to load requirements database:', error);
    
    // Fallback to hardcoded defaults if database unavailable
    console.warn('[RegulatoryDB] Using fallback hardcoded requirements');
    return getFallbackRequirements();
  }
}

/**
 * Get requirements for specific market
 */
export async function getMarketRequirements(market) {
  const db = await loadRegulatoryRequirements();
  
  if (!db.markets[market]) {
    throw new Error(`Unknown market: ${market}. Available markets: ${Object.keys(db.markets).join(', ')}`);
  }
  
  return {
    ...db.markets[market],
    version: db.version,
    lastUpdated: db.lastUpdated
  };
}

/**
 * Persist audit log entry to JSONL file
 * Ensures compliance audit trail survives process restarts
 */
export async function persistAuditLog(auditEntry) {
  try {
    // Ensure logs directory exists
    const logsDir = path.dirname(AUDIT_LOG_PATH);
    await fs.mkdir(logsDir, { recursive: true });
    
    // Append to JSONL file (one JSON object per line)
    const logLine = JSON.stringify({
      ...auditEntry,
      timestamp: auditEntry.timestamp || new Date().toISOString(),
      pid: process.pid
    }) + '\n';
    
    await fs.appendFile(AUDIT_LOG_PATH, logLine, 'utf-8');
    
    console.log('[RegulatoryDB] Audit log persisted', {
      event: auditEntry.event,
      market: auditEntry.market,
      timestamp: auditEntry.timestamp
    });
  } catch (error) {
    console.error('[RegulatoryDB] Failed to persist audit log:', error);
    // Don't throw - audit logging failure should not block PDF generation
  }
}

/**
 * Retrieve audit log entries for compliance reporting
 */
export async function getAuditLog(options = {}) {
  const { market, startDate, endDate, event, limit = 1000 } = options;
  
  try {
    const data = await fs.readFile(AUDIT_LOG_PATH, 'utf-8');
    const lines = data.trim().split('\n');
    
    let entries = lines
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(entry => entry !== null);
    
    // Apply filters
    if (market) {
      entries = entries.filter(e => e.market === market);
    }
    
    if (event) {
      entries = entries.filter(e => e.event === event);
    }
    
    if (startDate) {
      entries = entries.filter(e => new Date(e.timestamp) >= new Date(startDate));
    }
    
    if (endDate) {
      entries = entries.filter(e => new Date(e.timestamp) <= new Date(endDate));
    }
    
    // Sort by timestamp descending (newest first)
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Apply limit
    entries = entries.slice(0, limit);
    
    return {
      total: entries.length,
      entries
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Audit log file doesn't exist yet
      return { total: 0, entries: [] };
    }
    console.error('[RegulatoryDB] Failed to read audit log:', error);
    throw error;
  }
}

/**
 * Update regulatory requirements database
 * Implements version control and change tracking
 */
export async function updateRegulatoryRequirements(updates, changeReason) {
  try {
    const currentDb = await loadRegulatoryRequirements();
    
    // Increment version
    const versionParts = currentDb.version.split('.');
    versionParts[versionParts.length - 1] = String(Number(versionParts[versionParts.length - 1]) + 1);
    const newVersion = versionParts.join('.');
    
    const updatedDb = {
      ...currentDb,
      version: newVersion,
      lastUpdated: new Date().toISOString(),
      changeHistory: [
        ...(currentDb.changeHistory || []),
        {
          version: newVersion,
          timestamp: new Date().toISOString(),
          reason: changeReason,
          changes: updates
        }
      ],
      markets: {
        ...currentDb.markets,
        ...updates
      }
    };
    
    // Write to database
    await fs.writeFile(DB_PATH, JSON.stringify(updatedDb, null, 2), 'utf-8');
    
    // Clear cache to force reload
    requirementsCache = null;
    cacheTimestamp = null;
    
    // Log update to audit trail
    await persistAuditLog({
      event: 'REQUIREMENTS_UPDATED',
      version: newVersion,
      changeReason,
      updatedMarkets: Object.keys(updates)
    });
    
    console.log('[RegulatoryDB] Requirements database updated', {
      version: newVersion,
      changeReason,
      updatedMarkets: Object.keys(updates)
    });
    
    return updatedDb;
  } catch (error) {
    console.error('[RegulatoryDB] Failed to update requirements database:', error);
    throw error;
  }
}

/**
 * Fallback hardcoded requirements (used if database unavailable)
 */
function getFallbackRequirements() {
  return {
    version: '1.0.0-fallback',
    lastUpdated: new Date().toISOString(),
    markets: {
      taiwan_tfda: {
        disclaimer: '本藥須由醫師處方使用',
        emergencyPhone: '+886-2-1234-5678',
        mandatorySections: [
          'PRODUCT NAME',
          'ACTIVE INGREDIENTS',
          'INDICATIONS',
          'DOSAGE AND ADMINISTRATION',
          'CONTRAINDICATIONS',
          'WARNINGS AND PRECAUTIONS',
          'ADVERSE REACTIONS',
          'STORAGE'
        ]
      },
      thailand_fda: {
        disclaimer: 'ยานี้ต้องใช้ตามใบสั่งแพทย์',
        emergencyPhone: '+66-2-123-4567',
        mandatorySections: [
          'PRODUCT NAME',
          'ACTIVE INGREDIENTS',
          'THERAPEUTIC INDICATIONS',
          'POSOLOGY AND METHOD OF ADMINISTRATION',
          'CONTRAINDICATIONS',
          'SPECIAL WARNINGS AND PRECAUTIONS FOR USE',
          'UNDESIRABLE EFFECTS',
          'STORAGE CONDITIONS'
        ]
      }
    }
  };
}

/**
 * Initialize regulatory database (create if not exists)
 */
export async function initializeRegulatoryDatabase() {
  try {
    await fs.access(DB_PATH);
    console.log('[RegulatoryDB] Database exists, loading...');
  } catch {
    console.log('[RegulatoryDB] Database not found, creating initial version...');
    
    const initialDb = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      changeHistory: [
        {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          reason: 'Initial database creation',
          changes: {}
        }
      ],
      markets: {
        taiwan_tfda: {
          disclaimer: '本藥須由醫師處方使用',
          emergencyPhone: '+886-2-1234-5678',
          emergencyAddress: '台北市信義區',
          emergencyHours: '09:00-18:00',
          mandatorySections: [
            'PRODUCT NAME',
            'ACTIVE INGREDIENTS',
            'INDICATIONS',
            'DOSAGE AND ADMINISTRATION',
            'CONTRAINDICATIONS',
            'WARNINGS AND PRECAUTIONS',
            'ADVERSE REACTIONS',
            'DRUG INTERACTIONS',
            'USE IN SPECIAL POPULATIONS',
            'OVERDOSAGE',
            'PHARMACOLOGY',
            'STORAGE'
          ],
          sectionOrdering: [
            'PRODUCT NAME',
            'ACTIVE INGREDIENTS',
            'INDICATIONS',
            'DOSAGE AND ADMINISTRATION',
            'CONTRAINDICATIONS',
            'WARNINGS AND PRECAUTIONS',
            'ADVERSE REACTIONS',
            'DRUG INTERACTIONS',
            'USE IN SPECIAL POPULATIONS',
            'OVERDOSAGE',
            'PHARMACOLOGY',
            'STORAGE'
          ]
        },
        thailand_fda: {
          disclaimer: 'ยานี้ต้องใช้ตามใบสั่งแพทย์',
          emergencyPhone: '+66-2-123-4567',
          emergencyAddress: 'Bangkok',
          emergencyHours: '09:00-17:00',
          mandatorySections: [
            'PRODUCT NAME',
            'ACTIVE INGREDIENTS',
            'THERAPEUTIC INDICATIONS',
            'POSOLOGY AND METHOD OF ADMINISTRATION',
            'CONTRAINDICATIONS',
            'SPECIAL WARNINGS AND PRECAUTIONS FOR USE',
            'UNDESIRABLE EFFECTS',
            'INTERACTION WITH OTHER MEDICINAL PRODUCTS',
            'PREGNANCY AND LACTATION',
            'OVERDOSE',
            'PHARMACODYNAMIC PROPERTIES',
            'PHARMACOKINETIC PROPERTIES',
            'STORAGE CONDITIONS'
          ],
          sectionOrdering: [
            'PRODUCT NAME',
            'ACTIVE INGREDIENTS',
            'THERAPEUTIC INDICATIONS',
            'POSOLOGY AND METHOD OF ADMINISTRATION',
            'CONTRAINDICATIONS',
            'SPECIAL WARNINGS AND PRECAUTIONS FOR USE',
            'UNDESIRABLE EFFECTS',
            'INTERACTION WITH OTHER MEDICINAL PRODUCTS',
            'PREGNANCY AND LACTATION',
            'OVERDOSE',
            'PHARMACODYNAMIC PROPERTIES',
            'PHARMACOKINETIC PROPERTIES',
            'STORAGE CONDITIONS'
          ]
        }
      }
    };
    
    // Ensure config directory exists
    const configDir = path.dirname(DB_PATH);
    await fs.mkdir(configDir, { recursive: true });
    
    await fs.writeFile(DB_PATH, JSON.stringify(initialDb, null, 2), 'utf-8');
    
    console.log('[RegulatoryDB] Initial database created', {
      version: initialDb.version,
      markets: Object.keys(initialDb.markets)
    });
  }
  
  // Load to validate
  await loadRegulatoryRequirements();
}