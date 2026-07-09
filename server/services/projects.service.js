import { getProjectsCollection } from '../config/mongodb.js';

const PROJECT_FIELDS = {
  _id: 0,
  id: 1,
  userName: 1,
  userEmail: 1,
  title: 1,
  url: 1,
  description: 1,
  technologies: 1,
  status: 1,
  seen: 1,
  highlighted: 1,
  createdAt: 1,
  updatedAt: 1
};

const ALLOWED_STATUS = new Set(['Ideia', 'Em andamento', 'Finalizado']);

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

function assertProjectPayload(payload) {
  const project = {
    id: normalizeString(payload.id),
    userName: normalizeString(payload.userName),
    userEmail: normalizeEmail(payload.userEmail),
    title: normalizeString(payload.title),
    url: normalizeString(payload.url),
    description: normalizeString(payload.description),
    technologies: normalizeString(payload.technologies),
    status: normalizeString(payload.status) || 'Em andamento',
    seen: Boolean(payload.seen),
    highlighted: Boolean(payload.highlighted),
    createdAt: payload.createdAt || nowIso()
  };

  if (!project.id) throw createHttpError(400, 'ID do projeto é obrigatório.');
  if (!project.userName) throw createHttpError(400, 'Nome do usuário é obrigatório.');
  if (!project.userEmail) throw createHttpError(400, 'E-mail do usuário é obrigatório.');
  if (!project.title) throw createHttpError(400, 'Nome do projeto é obrigatório.');
  if (!project.url.startsWith('http://') && !project.url.startsWith('https://')) {
    throw createHttpError(400, 'Link do projeto precisa começar com http:// ou https://.');
  }
  if (!project.description) throw createHttpError(400, 'Descrição curta é obrigatória.');
  if (!ALLOWED_STATUS.has(project.status)) throw createHttpError(400, 'Status inválido.');

  return project;
}

function normalizeUpdates(payload) {
  const updates = {};

  if ('title' in payload) updates.title = normalizeString(payload.title);
  if ('url' in payload) updates.url = normalizeString(payload.url);
  if ('description' in payload) updates.description = normalizeString(payload.description);
  if ('technologies' in payload) updates.technologies = normalizeString(payload.technologies);
  if ('status' in payload) updates.status = normalizeString(payload.status);
  if ('seen' in payload) updates.seen = Boolean(payload.seen);
  if ('highlighted' in payload) updates.highlighted = Boolean(payload.highlighted);

  if (updates.url && !updates.url.startsWith('http://') && !updates.url.startsWith('https://')) {
    throw createHttpError(400, 'Link do projeto precisa começar com http:// ou https://.');
  }
  if (updates.status && !ALLOWED_STATUS.has(updates.status)) {
    throw createHttpError(400, 'Status inválido.');
  }

  return updates;
}

export async function getProjects({ userEmail, includeAll = false } = {}) {
  const collection = await getProjectsCollection();
  const filter = includeAll ? {} : { userEmail: normalizeEmail(userEmail) };

  if (!includeAll && !filter.userEmail) {
    return [];
  }

  return collection
    .find(filter, { projection: PROJECT_FIELDS })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function createProject(payload) {
  const collection = await getProjectsCollection();
  const project = assertProjectPayload(payload);
  const timestamp = nowIso();
  const document = {
    ...project,
    createdAt: project.createdAt || timestamp,
    updatedAt: timestamp
  };

  await collection.insertOne(document);
  return document;
}

export async function updateProject(id, payload) {
  const collection = await getProjectsCollection();
  const updates = normalizeUpdates(payload);

  if (Object.keys(updates).length === 0) {
    throw createHttpError(400, 'Nenhum campo válido para atualizar.');
  }

  const result = await collection.findOneAndUpdate(
    { id },
    { $set: { ...updates, updatedAt: nowIso() } },
    { returnDocument: 'after', projection: PROJECT_FIELDS }
  );

  if (!result) throw createHttpError(404, 'Projeto não encontrado.');
  return result;
}

export async function deleteProject(id) {
  const collection = await getProjectsCollection();
  await collection.deleteOne({ id });
}

export async function deleteAllProjects() {
  const collection = await getProjectsCollection();
  await collection.deleteMany({});
}
