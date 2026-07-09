import { Router } from 'express';
import {
  getUserProfile,
  listUsers,
  updateUserProfile,
  upsertUserSession
} from '../services/users.service.js';

export const usersRouter = Router();

usersRouter.get('/users', async (_req, res, next) => {
  try {
    const users = await listUsers();
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/users/:uid', async (req, res, next) => {
  try {
    const user = await getUserProfile(req.params.uid);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

usersRouter.post('/users/session', async (req, res, next) => {
  try {
    const user = await upsertUserSession(req.body);
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/users/:uid', async (req, res, next) => {
  try {
    const user = await updateUserProfile(req.params.uid, req.body);
    res.json(user);
  } catch (error) {
    next(error);
  }
});
