import { Router } from 'express';
import { createDraw, getDraws, getLastDraw } from '../services/draws.service.js';

export const drawsRouter = Router();

drawsRouter.get('/draws', async (req, res, next) => {
  try {
    const draws = await getDraws({ limit: req.query.limit });
    res.json({ draws });
  } catch (error) {
    next(error);
  }
});

drawsRouter.get('/draws/latest', async (_req, res, next) => {
  try {
    const draw = await getLastDraw();
    res.json({ draw });
  } catch (error) {
    next(error);
  }
});

drawsRouter.post('/draws', async (req, res, next) => {
  try {
    const draw = await createDraw(req.body);
    res.status(201).json(draw);
  } catch (error) {
    next(error);
  }
});
