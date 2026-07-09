import { request } from './storage.js';

const DRAWS_KEY = 'codexa_live_projects_draws';

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function readDraws() {
  return safeParse(localStorage.getItem(DRAWS_KEY), []);
}

function writeDraws(draws) {
  localStorage.setItem(DRAWS_KEY, JSON.stringify(draws));
}

function createLocalDraw(payload) {
  return {
    id: crypto.randomUUID(),
    winner: payload.winner,
    participants: payload.participants || [],
    participantsCount: payload.participantsCount || payload.participants?.length || 0,
    createdBy: payload.createdBy || '',
    createdAt: new Date().toISOString()
  };
}

export async function fetchDraws(limit = 10) {
  try {
    const payload = await request(`/draws?limit=${limit}`);
    writeDraws(payload.draws);
    return payload.draws;
  } catch {
    return readDraws().slice(0, limit);
  }
}

export async function fetchLastDraw() {
  try {
    const payload = await request('/draws/latest');
    return payload.draw || null;
  } catch {
    return readDraws()[0] || null;
  }
}

export async function saveDraw(payload) {
  try {
    const draw = await request('/draws', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    writeDraws([draw, ...readDraws().filter((item) => item.id !== draw.id)]);
    return draw;
  } catch {
    const draw = createLocalDraw(payload);
    writeDraws([draw, ...readDraws()]);
    return draw;
  }
}
