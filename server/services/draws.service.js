import crypto from 'node:crypto';
import { getDrawsCollection } from '../config/mongodb.js';

const DRAW_FIELDS = {
  _id: 0,
  id: 1,
  winner: 1,
  participantsCount: 1,
  participants: 1,
  createdBy: 1,
  createdAt: 1
};

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

function normalizeWinner(payload) {
  const winner = payload.winner || {};
  const normalized = {
    id: normalizeString(winner.id),
    title: normalizeString(winner.title),
    url: normalizeString(winner.url),
    userName: normalizeString(winner.userName),
    userEmail: normalizeString(winner.userEmail),
    description: normalizeString(winner.description)
  };

  if (!normalized.id) throw createHttpError(400, 'Projeto sorteado é obrigatório.');
  if (!normalized.title) throw createHttpError(400, 'Nome do projeto sorteado é obrigatório.');

  return normalized;
}

function normalizeParticipants(payload) {
  return Array.isArray(payload.participants)
    ? payload.participants.map((project) => ({
        id: normalizeString(project.id),
        title: normalizeString(project.title),
        userName: normalizeString(project.userName),
        userEmail: normalizeString(project.userEmail)
      })).filter((project) => project.id && project.title)
    : [];
}

export async function createDraw(payload) {
  const collection = await getDrawsCollection();
  const document = {
    id: crypto.randomUUID(),
    winner: normalizeWinner(payload),
    participants: normalizeParticipants(payload),
    participantsCount: Number(payload.participantsCount || payload.participants?.length || 0),
    createdBy: normalizeString(payload.createdBy),
    createdAt: nowIso()
  };

  await collection.insertOne(document);
  return document;
}

export async function getDraws({ limit = 10 } = {}) {
  const collection = await getDrawsCollection();
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);

  return collection
    .find({}, { projection: DRAW_FIELDS })
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .toArray();
}

export async function getLastDraw() {
  const collection = await getDrawsCollection();
  return collection.findOne({}, { projection: DRAW_FIELDS, sort: { createdAt: -1 } });
}
