import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Auto-load routes from src/routes/
const routesDir = join(__dirname, 'src', 'routes');
try {
  const routeFiles = readdirSync(routesDir).filter(f => /\.(js|mjs|jsx)$/.test(f) && !f.startsWith('.'));
  for (const file of routeFiles) {
    const routeModule = await import(join(routesDir, file));
    const routeName = file.replace(/\.(js|mjs|jsx)$/, '');
    if (routeModule.default?.use || routeModule.router?.use) {
      app.use(`/api/${routeName}`, routeModule.default || routeModule.router);
    } else if (typeof routeModule.default === 'function') {
      routeModule.default(app);
    }
  }
  console.log(`Loaded ${routeFiles.length} route(s)`);
} catch (err) {
  if (err.code !== 'ENOENT') console.error('Route loading error:', err);
}

// Serve static frontend (for fullstack)
const distPath = join(__dirname, 'dist');
const publicPath = join(__dirname, 'public');
const staticDir = existsSync(distPath) ? distPath : existsSync(publicPath) ? publicPath : null;
if (staticDir) {
  app.use(express.static(staticDir));
  // SPA fallback — must be AFTER API routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(join(staticDir, 'index.html'));
  });
}

// 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
