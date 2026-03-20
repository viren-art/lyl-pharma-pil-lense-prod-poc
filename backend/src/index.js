import express from 'express';
import cors from 'cors';
import documentRoutes from './routes/documents.js';
import workflowRoutes from './routes/workflows.js';
import generateAWRoutes from './routes/generateAW.js';
import regulatoryAuditRoutes from './routes/regulatoryAudit.js';
import { initializeRegulatoryDatabase } from './services/regulatoryDatabase.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Initialize regulatory database on startup
initializeRegulatoryDatabase()
  .then(() => {
    console.log('[Server] Regulatory database initialized successfully');
  })
  .catch(error => {
    console.error('[Server] Failed to initialize regulatory database:', error);
    process.exit(1);
  });

// Routes
app.use('/api/documents', documentRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/workflows/generate-aw', generateAWRoutes);
app.use('/api/regulatory', regulatoryAuditRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      regulatoryDatabase: 'available',
      auditLog: 'available'
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message,
      retryable: false
    }
  });
});

app.listen(PORT, () => {
  console.log(`[Server] PIL Lens backend running on port ${PORT}`);
});