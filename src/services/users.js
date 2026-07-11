import { ADMIN_EMAIL, getUserName } from './firebase.js';
import { request } from './storage.js';

const USERS_KEY = 'codexa_live_projects_users';
const MAX_NICKNAME_LENGTH = 32;

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeNickname(value) {
  return String(value || '').trim().slice(0, MAX_NICKNAME_LENGTH);
}

function readUsers() {
  return safeParse(localStorage.getItem(USERS_KEY), []);
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getRole(email) {
  return normalizeEmail(email) === ADMIN_EMAIL ? 'admin' : 'user';
}

export function getDisplayName(profile, authUser) {
  return profile?.publicNickname || profile?.googleName || getUserName(authUser);
}

function normalizeAuthUser(user) {
  return {
    uid: user?.uid || user?.email || '',
    email: normalizeEmail(user?.email),
    googleName: getUserName(user),
    photoURL: user?.photoURL || ''
  };
}

function upsertLocalSession(user) {
  const authUser = normalizeAuthUser(user);
  const timestamp = nowIso();
  const users = readUsers();
  const current = users.find((item) => item.uid === authUser.uid);
  const profile = {
    ...current,
    ...authUser,
    publicNickname: current?.publicNickname || '',
    displayName: current?.publicNickname || authUser.googleName || authUser.email,
    role: getRole(authUser.email),
    // Fallback offline: sem backend disponível não há como bloquear o acesso.
    emailVerified: true,
    firstLoginAt: current?.firstLoginAt || timestamp,
    lastLoginAt: timestamp,
    loginCount: (current?.loginCount || 0) + 1,
    createdAt: current?.createdAt || timestamp,
    updatedAt: timestamp
  };

  writeUsers([profile, ...users.filter((item) => item.uid !== profile.uid)]);
  return profile;
}

export async function upsertUserSession(user) {
  const authUser = normalizeAuthUser(user);

  try {
    const profile = await request('/users/session', {
      method: 'POST',
      body: JSON.stringify(authUser)
    });
    const users = readUsers();
    writeUsers([profile, ...users.filter((item) => item.uid !== profile.uid)]);
    return profile;
  } catch {
    return upsertLocalSession(user);
  }
}

export async function fetchUserProfile(uid) {
  try {
    const profile = await request(`/users/${encodeURIComponent(uid)}`);
    const users = readUsers();
    writeUsers([profile, ...users.filter((item) => item.uid !== profile.uid)]);
    return profile;
  } catch {
    return readUsers().find((item) => item.uid === uid) || null;
  }
}

export async function updateUserProfile(uid, updates) {
  const payload = {
    publicNickname: normalizeNickname(updates.publicNickname)
  };

  try {
    const profile = await request(`/users/${encodeURIComponent(uid)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    const users = readUsers();
    writeUsers([profile, ...users.filter((item) => item.uid !== profile.uid)]);
    return profile;
  } catch {
    const users = readUsers();
    const current = users.find((item) => item.uid === uid);
    if (!current) throw new Error('Usuário não encontrado.');

    const profile = {
      ...current,
      ...payload,
      displayName: payload.publicNickname || current.googleName || current.email,
      updatedAt: nowIso()
    };
    writeUsers([profile, ...users.filter((item) => item.uid !== uid)]);
    return profile;
  }
}

export async function resendVerification({ uid, email }) {
  return request('/users/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ uid, email })
  });
}

// Solicita a URL de autorização do Discord (rota autenticada; o ID token é
// anexado por request). O redirect do browser é feito pelo chamador.
export async function connectDiscord() {
  const payload = await request('/discord/connect');
  return payload.url;
}

// ADMIN: liga/desliga o acesso ao Discord de um usuário. O ID token é anexado
// por request; o backend valida que o chamador é admin.
export async function setUserDiscordAccess(uid, enabled) {
  return request(`/users/${encodeURIComponent(uid)}/discord-access`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled })
  });
}

export async function fetchUsers() {
  try {
    const payload = await request('/users');
    writeUsers(payload.users);
    return payload.users;
  } catch {
    return readUsers().sort((a, b) => new Date(b.lastLoginAt || 0) - new Date(a.lastLoginAt || 0));
  }
}
