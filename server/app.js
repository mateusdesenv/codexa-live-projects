import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.routes.js';
import { projectsRouter } from './routes/projects.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(compression());
  app.use(cors({
    origin: env.corsOrigin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  }));
  app.use(express.json({ limit: env.jsonLimit }));
  app.use(express.urlencoded({ extended: false, limit: env.jsonLimit }));

  if (env.nodeEnv !== 'test') {
    app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  }

  app.get('/', (_req, res) => {
    res.json({
      ok: true,
      service: 'codexa-live-projects-api',
      collection: env.projectsCollection,
      endpoints: [
        'GET /api/health',
        'GET /api/projects',
        'POST /api/projects',
        'PATCH /api/projects/:id',
        'DELETE /api/projects/:id',
        'DELETE /api/projects'
      ]
    });
  });

  app.use('/api', healthRouter);
  app.use('/api', projectsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
