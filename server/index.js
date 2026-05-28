import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspaces.js';
import metricsRoutes from './routes/metrics.js';
import { stopAllWorkspaces } from './services/workspaceManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// CORS — allow the Vite dev server and the production origin
const allowedOrigins = [
  process.env.ALLOWED_ORIGIN,
  `http://localhost:5173`,
  `http://localhost:${PORT}`
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, true); // open CORS — restrict via firewall on VPS
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// Health check (unauthenticated)
app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/metrics', metricsRoutes);

// Serve built frontend in production
const distPath = join(__dirname, '../client/dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_, res) => res.sendFile(join(distPath, 'index.html')));
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Asterope Dashboard  →  http://localhost:${PORT}\n`);
});

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n[${signal}] Shutting down...`);
  await stopAllWorkspaces();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
