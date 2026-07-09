import { getUsersCollection } from '../config/mongodb.js';

const ADMIN_EMAIL = 'mateus.desenv@gmail.com';
const MAX_NICKNAME_LENGTH = 32;

const USER_FIELDS = {
  _id: 0,
  uid: 1,
  email: 1,
  googleName: 1,
  photoURL: 1,
  publicNickname: 1,
  displayName: 1,
  role: 1,
  firstLoginAt: 1,
  lastLoginAt: 1,
  loginCount: 1,
  createdAt: 1,
  updatedAt: 1
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

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

function getRole(email) {
  return normalizeEmail(email) === ADMIN_EMAIL ? 'admin' : 'user';
}

function normalizeNickname(value) {
  const nickname = normalizeString(value);
  return nickname.slice(0, MAX_NICKNAME_LENGTH);
}

function getDisplayName(user) {
  return user.publicNickname || user.googleName || user.email || 'Usuario';
}

function normalizeAuthPayload(payload) {
  const user = {
    uid: normalizeString(payload.uid),
    email: normalizeEmail(payload.email),
    googleName: normalizeString(payload.googleName || payload.displayName),
    photoURL: normalizeString(payload.photoURL)
  };

  if (!user.uid) throw createHttpError(400, 'UID do usuário é obrigatório.');
  if (!user.email) throw createHttpError(400, 'E-mail do usuário é obrigatório.');

  return user;
}

async function updateDisplayName(uid) {
  const collection = await getUsersCollection();
  const user = await collection.findOne({ uid }, { projection: USER_FIELDS });
  if (!user) throw createHttpError(404, 'Usuário não encontrado.');

  const displayName = getDisplayName(user);
  if (user.displayName === displayName) return user;

  await collection.updateOne({ uid }, { $set: { displayName, updatedAt: nowIso() } });
  return { ...user, displayName };
}

export async function upsertUserSession(payload) {
  const collection = await getUsersCollection();
  const authUser = normalizeAuthPayload(payload);
  const timestamp = nowIso();

  await collection.updateOne(
    { uid: authUser.uid },
    {
      $set: {
        ...authUser,
        role: getRole(authUser.email),
        lastLoginAt: timestamp,
        updatedAt: timestamp
      },
      $setOnInsert: {
        publicNickname: '',
        firstLoginAt: timestamp,
        createdAt: timestamp
      },
      $inc: { loginCount: 1 }
    },
    { upsert: true }
  );

  return updateDisplayName(authUser.uid);
}

export async function getUserProfile(uid) {
  const collection = await getUsersCollection();
  const user = await collection.findOne({ uid }, { projection: USER_FIELDS });
  if (!user) throw createHttpError(404, 'Usuário não encontrado.');
  return user;
}

export async function updateUserProfile(uid, payload) {
  const collection = await getUsersCollection();
  const publicNickname = normalizeNickname(payload.publicNickname);
  const result = await collection.findOneAndUpdate(
    { uid },
    { $set: { publicNickname, updatedAt: nowIso() } },
    { returnDocument: 'after', projection: USER_FIELDS }
  );

  if (!result) throw createHttpError(404, 'Usuário não encontrado.');
  return updateDisplayName(uid);
}

export async function listUsers() {
  const collection = await getUsersCollection();
  return collection
    .find({}, { projection: USER_FIELDS })
    .sort({ role: 1, lastLoginAt: -1 })
    .toArray();
}
