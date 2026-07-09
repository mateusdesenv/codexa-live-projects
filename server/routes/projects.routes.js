import { Router } from 'express';
import {
  createProject,
  deleteAllProjects,
  deleteProject,
  getProjects,
  updateProject
} from '../services/projects.service.js';

export const projectsRouter = Router();

projectsRouter.get('/projects', async (req, res, next) => {
  try {
    const projects = await getProjects({
      userEmail: req.query.userEmail,
      includeAll: req.query.includeAll === 'true',
      adminEmail: req.query.adminEmail
    });
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/projects', async (req, res, next) => {
  try {
    const project = await createProject(req.body);
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
