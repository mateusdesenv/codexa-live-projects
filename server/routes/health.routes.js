import { Router } from 'express';
import { env } from '../config/env.js';
import { getDb } from '../config/mongodb.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res, next) => {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });

    res.json({
      ok: true,
      service: 'codexa-live-projects-api',
      environment: env.nodeEnv,
      database: env.mongodbDb,
      collection: env.projectsCollection,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});
