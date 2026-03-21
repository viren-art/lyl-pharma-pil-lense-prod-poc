import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// ── Middleware ──
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ── Health check ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'pil-lens' });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'pil-lens' });
});

// ── Static files ──
const distDir = path.join(__dirname, 'dist');
const publicDir = fs.existsSync(distDir) ? distDir : path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// ── Load backend routes ──
try {
  const { default: documentsRouter } = await import('./backend/src/routes/documents.js');
  app.use('/api/documents', documentsRouter);
  console.log('[Server] ✓ /api/documents');
} catch (e) {
  console.error('[Server] ✗ documents routes:', e.message);
}

try {
  const { default: workflowsRouter } = await import('./backend/src/routes/workflows.js');
  app.use('/api/workflows', workflowsRouter);
  console.log('[Server] ✓ /api/workflows');
} catch (e) {
  console.error('[Server] ✗ workflows routes:', e.message);
}

try {
  const { default: generateAWRouter } = await import('./backend/src/routes/generateAW.js');
  app.use('/api/generateAW', generateAWRouter);
  console.log('[Server] ✓ /api/generateAW');
} catch (e) {
  console.error('[Server] ✗ generateAW routes:', e.message);
}

try {
  const { default: assessRouter } = await import('./backend/src/routes/assessVariation.js');
  app.use('/api/assessVariation', assessRouter);
  console.log('[Server] ✓ /api/assessVariation');
} catch (e) {
  console.error('[Server] ✗ assessVariation routes:', e.message);
}

// ── SPA catch-all ──
const indexPath = path.join(publicDir, 'index.html');
if (fs.existsSync(indexPath)) {
  app.use('*', (req, res) => {
    if (!req.originalUrl.startsWith('/api/')) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: 'API endpoint not found', path: req.originalUrl });
    }
  });
}

// ── Error handler ──
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message });
});

// ── Start ──
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] PIL Lens running on port ${PORT}`);
});
