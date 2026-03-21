const express = require('express');
const cors = require('cors');
const compression = require('compression');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// ── Static files (serve frontend build) ──
const distDir = path.join(__dirname, 'dist');
const frontendDist = path.join(__dirname, 'frontend', 'dist');
const publicDir = fs.existsSync(distDir) ? distDir : fs.existsSync(frontendDist) ? frontendDist : path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// ── Load ESM backend routes via dynamic import() ──
async function loadRoutes() {
  // Documents routes
  try {
    const documentsModule = await import('./backend/src/routes/documents.js');
    const documentsRouter = documentsModule.default || documentsModule;
    app.use('/api/documents', documentsRouter);
    console.log('[Server] Loaded /api/documents routes');
  } catch (e) {
    console.error('[Server] Failed to load documents routes:', e.message);
  }

  // Workflows routes (includes review-aw, create-draft, assess-variation, generate-aw)
  try {
    const workflowsModule = await import('./backend/src/routes/workflows.js');
    const workflowsRouter = workflowsModule.default || workflowsModule;
    app.use('/api/workflows', workflowsRouter);
    console.log('[Server] Loaded /api/workflows routes');
  } catch (e) {
    console.error('[Server] Failed to load workflows routes:', e.message);
  }

  // Generate AW routes (legacy endpoint)
  try {
    const generateAWModule = await import('./backend/src/routes/generateAW.js');
    const generateAWRouter = generateAWModule.default || generateAWModule;
    app.use('/api/generateAW', generateAWRouter);
    console.log('[Server] Loaded /api/generateAW routes');
  } catch (e) {
    console.error('[Server] Failed to load generateAW routes:', e.message);
  }

  // Assess Variation routes (legacy endpoint)
  try {
    const assessModule = await import('./backend/src/routes/assessVariation.js');
    const assessRouter = assessModule.default || assessModule;
    app.use('/api/assessVariation', assessRouter);
    console.log('[Server] Loaded /api/assessVariation routes');
  } catch (e) {
    console.error('[Server] Failed to load assessVariation routes:', e.message);
  }

  // ── Catch-all for SPA ──
  if (fs.existsSync(path.join(publicDir, 'index.html'))) {
    app.use('*', (req, res) => {
      if (!req.originalUrl.startsWith('/api/')) {
        res.sendFile(path.join(publicDir, 'index.html'));
      } else {
        res.status(404).json({ error: 'API endpoint not found', path: req.originalUrl });
      }
    });
  }

  // ── Error handler ──
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    console.error('[Error]', err.message);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
    });
  });
}

// ── Start server after loading routes ──
loadRoutes()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] PIL Lens running on port ${PORT}`);
      console.log(`[Server] Health: http://localhost:${PORT}/health`);
    });
  })
  .catch(err => {
    console.error('[Server] Failed to initialize:', err);
    // Start server anyway to serve frontend
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Started with errors on port ${PORT}`);
    });
  });

module.exports = app;
