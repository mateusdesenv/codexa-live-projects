import { getProjectsCollection } from '../config/mongodb.js';
import { env } from '../config/env.js';
import { sendProjectsEmbed } from './discord.service.js';

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
  updatedAt: 1,
  discordNotifiedAt: 1
};

const DISCORD_NEW_PROJECT_COLOR = 0x22c55e; // verde (--primary)

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

export async function getProjects({ userEmail, includeAll = false, adminEmail } = {}) {
  const collection = await getProjectsCollection();
  const canIncludeAll = includeAll && normalizeEmail(adminEmail) === env.adminEmail;
  const filter = canIncludeAll ? {} : { userEmail: normalizeEmail(userEmail) };

  if (!canIncludeAll && !filter.userEmail) {
    return [];
  }

  return collection
    .find(filter, { projection: PROJECT_FIELDS })
    .sort({ createdAt: -1 })
    .toArray();
}

function buildNewProjectEmbed(project) {
  return {
    title: '🚀 Novo projeto cadastrado',
    color: DISCORD_NEW_PROJECT_COLOR,
    fields: [
      { name: 'Projeto', value: String(project.title || '—').slice(0, 256) },
      { name: 'URL', value: String(project.url || '—').slice(0, 256) },
      { name: 'Descrição', value: String(project.description || '—').slice(0, 1024) },
      { name: 'Tecnologias', value: String(project.technologies || '—').slice(0, 256), inline: true },
      { name: 'Status', value: String(project.status || '—'), inline: true },
      {
        name: 'Autor',
        value: `${project.userName || '—'} (${project.userEmail || '—'})`.slice(0, 256)
      }
    ],
    timestamp: new Date().toISOString()
  };
}

// Notifica o Discord uma única vez por projeto. Idempotente: só marca como
// notificado quando o envio dá certo, e usa um guard atômico no Mongo para não
// reenviar em reprocessamentos concorrentes. Best-effort: falha não derruba a
// criação do projeto.
async function notifyProjectCreatedOnce(collection, project) {
  if (project.discordNotifiedAt) return;

  // Guard atômico: só quem conseguir "reservar" o campo envia.
  const claimedAt = nowIso();
  const claim = await collection.updateOne(
    { id: project.id, discordNotifiedAt: { $in: [null, undefined] } },
    { $set: { discordNotifiedAt: claimedAt } }
  );
  if (claim.modifiedCount === 0) return;

  const delivered = await sendProjectsEmbed(buildNewProjectEmbed(project));
  if (!delivered) {
    // Reverte a reserva para permitir nova tentativa futura.
    await collection
      .updateOne({ id: project.id }, { $set: { discordNotifiedAt: null } })
      .catch(() => {});
  }
}

export async function createProject(payload) {
  const collection = await getProjectsCollection();
  const project = assertProjectPayload(payload);
  const timestamp = nowIso();
  const document = {
    ...project,
    createdAt: project.createdAt || timestamp,
    updatedAt: timestamp,
    discordNotifiedAt: null
  };

  await collection.insertOne(document);
  await notifyProjectCreatedOnce(collection, document).catch((error) => {
    console.error('Falha ao notificar projeto no Discord:', error?.message || error);
  });
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
