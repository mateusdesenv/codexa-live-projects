import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { drawsRouter } from './routes/draws.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { projectsRouter } from './routes/projects.routes.js';
import { usersRouter } from './routes/users.routes.js';

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
      collections: {
        projects: env.projectsCollection,
        users: env.usersCollection,
        draws: env.drawsCollection
      },
      endpoints: [
        'GET /api/health',
        'GET /api/projects',
        'POST /api/projects',
        'PATCH /api/projects/:id',
        'DELETE /api/projects/:id',
        'DELETE /api/projects',
        'GET /api/users',
        'GET /api/users/:uid',
        'POST /api/users/session',
        'PATCH /api/users/:uid',
        'GET /api/draws',
        'GET /api/draws/latest',
        'POST /api/draws'
      ]
    });
  });

  app.use('/api', healthRouter);
  app.use('/api', projectsRouter);
  app.use('/api', usersRouter);
  app.use('/api', drawsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
