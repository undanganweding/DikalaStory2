import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/app';
import { geminiProjectRouter } from './server/gemini_project_router';

if (!process.env.AI_SECRET_MASTER_KEY) {
  process.env.AI_SECRET_MASTER_KEY = process.env.GEMINI_API_KEY || 'sinema-isolated-test-master-key-32-bytes!!';
}

async function startServer() {
  const app = createApp();
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Run initial discovery async without blocking server startup
  try {
    geminiProjectRouter.discoverAndValidateAll().catch((err: any) => {
      console.warn('[GeminiRouter] Non-blocking discovery warning:', err?.message || err);
    });
  } catch (err: any) {
    console.warn('[GeminiRouter] Discovery init warning:', err?.message || err);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
