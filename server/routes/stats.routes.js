import { Router } from 'express';
import { getPublicProjectStats } from '../services/projects.service.js';

// Rota PÚBLICA (sem auth): expõe apenas contagens agregadas para a tela de
// login. Não retorna nenhum dado sensível de projeto ou usuário.
export const statsRouter = Router();

statsRouter.get('/stats', async (_req, res, next) => {
  try {
    const stats = await getPublicProjectStats();
    res.json({ ok: true, stats });
  } catch (error) {
    next(error);
  }
});
