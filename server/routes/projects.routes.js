import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { isAdminEmail } from '../services/users.service.js';
import {
  createProject,
  deleteAllProjects,
  deleteProject,
  getProjects,
  updateProject
} from '../services/projects.service.js';
import { guardProjectCreation } from '../services/project-abuse.service.js';
import { registerProjectCreation } from '../services/users.service.js';

export const projectsRouter = Router();

// Todas as rotas de projeto dependem de identidade verificada.
projectsRouter.use('/projects', requireAuth);

// Escopo decidido pelo e-mail verificado do token: admin vê tudo, usuário
// comum vê apenas os seus. O cliente não escolhe mais o escopo.
projectsRouter.get('/projects', async (req, res, next) => {
  try {
    const { email } = req.authUser;
    const isAdmin = isAdminEmail(email);
    const projects = await getProjects({
      userEmail: email,
      includeAll: isAdmin,
      adminEmail: isAdmin ? email : ''
    });
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/projects', async (req, res, next) => {
  try {
    const { uid, email } = req.authUser;

    // Identidade sempre do token: anti-abuso e gate operam sobre o uid
    // verificado, ignorando qualquer userUid/userEmail vindo do body.
    const guardedUser = await guardProjectCreation(uid, req.body);
    const project = await createProject({ ...req.body, userEmail: email });

    if (guardedUser?.uid) {
      await registerProjectCreation(guardedUser.uid).catch((error) => {
        console.error('Falha ao registrar criação de projeto:', error?.message || error);
      });
    }

    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

projectsRouter.patch('/projects/:id', async (req, res, next) => {
  try {
    const project = await updateProject(req.params.id, req.body);
    res.json(project);
  } catch (error) {
    next(error);
  }
});

projectsRouter.delete('/projects/:id', async (req, res, next) => {
  try {
    await deleteProject(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

projectsRouter.delete('/projects', async (_req, res, next) => {
  try {
    await deleteAllProjects();
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
