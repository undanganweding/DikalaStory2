import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { apiRouter } from './routes';

dotenv.config();

if (!process.env.AI_SECRET_MASTER_KEY) {
  process.env.AI_SECRET_MASTER_KEY = process.env.GEMINI_API_KEY || 'sinema-isolated-test-master-key-32-bytes!!';
}

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Ensure JSON response header for all /api routes
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Type', 'application/json');
    next();
  });

  // API router mounted under /api
  app.use('/api', apiRouter);

  // Unmatched /api handler - return JSON 404 for API requests
  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API route not found' });
  });

  // Global server error handling
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({
      error: err?.message || 'Internal Server Error',
    });
  });

  return app;
}
