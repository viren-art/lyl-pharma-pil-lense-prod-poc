import { Router } from 'express';
import { getGlobalStats } from '../middleware/sessionManager.js';

const router = Router();

/**
 * Health check endpoint for Cloud Run probes and SLA monitoring
 * Returns service status, memory usage, and business hours context
 */
router.get('/', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const sessionStats = getGlobalStats();
  
  // Check if service is healthy
  const heapUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
  const isHealthy = heapUsagePercent < 0.9;
  
  // Determine if current time is within business hours (9:00-18:00 GMT+8 Monday-Friday)
  const now = new Date();
  const gmtPlus8 = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
  const hour = gmtPlus8.getHours();
  const day = gmtPlus8.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const isBusinessHours = (day >= 1 && day <= 5) && (hour >= 9 && hour < 18);
  
  // Check external service availability
  const servicesAvailable = {
    googleDocumentAi: !!process.env.GOOGLE_DOCAI_API_KEY,
    claudeApi: !!process.env.CLAUDE_API_KEY,
    puppeteer: true, // Chromium installed in Docker
  };
  const allServicesAvailable = Object.values(servicesAvailable).every(v => v);
  
  const healthStatus = {
    status: isHealthy && allServicesAvailable ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    businessHours: {
      current: isBusinessHours,
      timezone: 'GMT+8',
      hours: '9:00-18:00 Monday-Friday',
    },
    services: servicesAvailable,
    memoryUsage: {
      heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsagePercent: Math.round(heapUsagePercent * 100),
      documentsInMemory: sessionStats.totalDocuments,
    },
    sessions: {
      active: sessionStats.activeSessions,
      totalDocuments: sessionStats.totalDocuments,
      totalWorkflows: sessionStats.totalWorkflows,
    },
    sla: {
      target: '95% uptime during business hours',
      currentStatus: isHealthy && allServicesAvailable ? 'meeting' : 'degraded',
    },
  };
  
  // Return 200 for healthy, 503 for degraded
  const statusCode = isHealthy && allServicesAvailable ? 200 : 503;
  
  // Log health check for Cloud Monitoring
  if (!isHealthy || !allServicesAvailable) {
    console.warn('Health check degraded', {
      heapUsagePercent: Math.round(heapUsagePercent * 100),
      servicesAvailable,
      isBusinessHours,
      timestamp: healthStatus.timestamp,
    });
  }
  
  res.status(statusCode).json(healthStatus);
});

/**
 * SLA metrics endpoint for monitoring dashboard
 * Returns uptime and latency metrics for business hours tracking
 */
router.get('/sla', (req, res) => {
  const sessionStats = getGlobalStats();
  const memoryUsage = process.memoryUsage();
  
  // Calculate uptime since last restart
  const uptimeSeconds = process.uptime();
  const uptimeHours = Math.floor(uptimeSeconds / 3600);
  const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
  
  const slaMetrics = {
    uptime: {
      seconds: Math.round(uptimeSeconds),
      formatted: `${uptimeHours}h ${uptimeMinutes}m`,
      target: '95% during business hours (9:00-18:00 GMT+8 Monday-Friday)',
    },
    performance: {
      memoryUsagePercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      documentsInMemory: sessionStats.totalDocuments,
      documentLimit: 100,
      capacityRemaining: Math.round(((100 - sessionStats.totalDocuments) / 100) * 100),
    },
    sessions: {
      active: sessionStats.activeSessions,
      totalWorkflows: sessionStats.totalWorkflows,
    },
    timestamp: new Date().toISOString(),
  };
  
  res.json(slaMetrics);
});

export default router;