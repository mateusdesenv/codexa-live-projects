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
  updatedAt: 1,
  emailVerified: 1,
  emailVerifiedAt: 1,
  lastProjectCreatedAt: 1,
  abuseAttempts: 1,
  lastAbuseAttemptAt: 1,
  blocked: 1,
  blockedAt: 1,
  discordId: 1,
  discordUsername: 1,
  discordEmail: 1,
  discordJoinedAt: 1
};

// Projeção interna: inclui o token de verificação e sua expiração. Uso restrito
// a fluxos que precisam validar o token (nunca serializada em resposta pública).
const USER_FIELDS_WITH_TOKEN = {
  ...USER_FIELDS,
  verificationToken: 1,
  verificationTokenExpiresAt: 1
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

export function isAdminEmail(email) {
  return normalizeEmail(email) === ADMIN_EMAIL;
}

// Recupera o doc bruto (com _id) por e-mail normalizado. Uso interno para a
// migração transparente por e-mail: precisamos do _id para consolidar com
// segurança quando o uid de um registro existente precisa ser adotado.
async function findRawUserByEmail(collection, email) {
  return collection.findOne({ email: normalizeEmail(email) });
}

// Migração transparente por e-mail (grandfather). Quando um usuário antigo faz
// login com um uid novo (o projeto Firebase mudou), casamos pelo e-mail do
// token verificado e ADOTAMOS o uid novo no registro existente, preservando
// perfil (publicNickname, role, firstLoginAt, createdAt, projetos por e-mail) e
// marcando emailVerified: true — ele já existia e é conta Google verificada,
// não deve reconfirmar. Consolida com segurança um eventual doc órfão criado
// com o uid novo (fonte de verdade do perfil = registro antigo por e-mail).
async function migrateUserUid(collection, existingByEmail, authUser, timestamp, isAdmin) {
  // Remove um possível doc já criado com o uid novo para não colidir com o
  // índice único ao adotar o uid no registro antigo. O registro antigo (por
  // e-mail) permanece como fonte de verdade do perfil.
  if (existingByEmail.uid !== authUser.uid) {
    await collection.deleteOne({ uid: authUser.uid, _id: { $ne: existingByEmail._id } });
  }

  const setFields = {
    ...authUser,
    role: getRole(authUser.email),
    emailVerified: true,
    emailVerifiedAt: existingByEmail.emailVerifiedAt || timestamp,
    verificationToken: null,
    verificationTokenExpiresAt: null,
    lastLoginAt: timestamp,
    updatedAt: timestamp
  };
  if (isAdmin) setFields.emailVerifiedAt = timestamp;

  await collection.updateOne(
    { _id: existingByEmail._id },
    { $set: setFields, $inc: { loginCount: 1 } }
  );

  return updateDisplayName(authUser.uid);
}

export async function upsertUserSession(payload) {
  const collection = await getUsersCollection();
  const authUser = normalizeAuthPayload(payload);
  const timestamp = nowIso();
  const isAdmin = isAdminEmail(authUser.email);

  // Match por uid (verificado do token). Se já existe, é o fluxo normal atual.
  const existingByUid = await collection.findOne({ uid: authUser.uid }, { projection: { _id: 1 } });

  // Se não achou por uid, tenta casar por e-mail (sempre do token verificado,
  // nunca do body): usuário antigo cujo uid mudou → adota o uid novo.
  if (!existingByUid) {
    const existingByEmail = await findRawUserByEmail(collection, authUser.email);
    if (existingByEmail) {
      return migrateUserUid(collection, existingByEmail, authUser, timestamp, isAdmin);
    }
  }

  const setFields = {
    ...authUser,
    role: getRole(authUser.email),
    lastLoginAt: timestamp,
    updatedAt: timestamp
  };

  // Admin nunca é bloqueado. Para usuários comuns, o valor de emailVerified é
  // definido apenas na criação ($setOnInsert), preservando um true já existente.
  const insertFields = {
    publicNickname: '',
    firstLoginAt: timestamp,
    createdAt: timestamp,
    lastProjectCreatedAt: null,
    abuseAttempts: 0,
    blocked: false,
    blockedAt: null
  };

  if (isAdmin) {
    setFields.emailVerified = true;
    setFields.emailVerifiedAt = timestamp;
    setFields.verificationToken = null;
    setFields.verificationTokenExpiresAt = null;
  } else {
    insertFields.emailVerified = false;
    insertFields.emailVerifiedAt = null;
    insertFields.verificationToken = null;
    insertFields.verificationTokenExpiresAt = null;
  }

  await collection.updateOne(
    { uid: authUser.uid },
    {
      $set: setFields,
      $setOnInsert: insertFields,
      $inc: { loginCount: 1 }
    },
    { upsert: true }
  );

  return updateDisplayName(authUser.uid);
}

export async function saveVerificationToken(uid, token, expiresAt) {
  const collection = await getUsersCollection();
  await collection.updateOne(
    { uid },
    {
      $set: {
        verificationToken: token,
        verificationTokenExpiresAt: expiresAt,
        updatedAt: nowIso()
      }
    }
  );
}

export async function findUserByVerificationToken(token) {
  const collection = await getUsersCollection();
  return collection.findOne({ verificationToken: token }, { projection: USER_FIELDS_WITH_TOKEN });
}

export async function findUserByUid(uid) {
  const collection = await getUsersCollection();
  return collection.findOne({ uid }, { projection: USER_FIELDS });
}

// Uso interno: recupera o usuário com token de verificação para decisões de
// fluxo (ex.: reemitir token). Nunca serializar o retorno em resposta pública.
export async function findUserWithVerificationToken(uid) {
  const collection = await getUsersCollection();
  return collection.findOne({ uid }, { projection: USER_FIELDS_WITH_TOKEN });
}

export async function findUserByEmail(email) {
  const collection = await getUsersCollection();
  return collection.findOne({ email: normalizeEmail(email) }, { projection: USER_FIELDS });
}

export async function markEmailVerified(uid) {
  const collection = await getUsersCollection();
  const timestamp = nowIso();
  await collection.updateOne(
    { uid },
    {
      $set: {
        emailVerified: true,
        emailVerifiedAt: timestamp,
        verificationToken: null,
        verificationTokenExpiresAt: null,
        updatedAt: timestamp
      }
    }
  );
}

// Vincula a conta do Discord ao usuário (por uid) após o auto-join bem-sucedido.
// discordId/discordUsername/discordEmail não são segredo — entram na projeção pública.
export async function setDiscordLink(uid, { discordId, discordUsername, discordEmail }) {
  const collection = await getUsersCollection();
  const timestamp = nowIso();
  const result = await collection.findOneAndUpdate(
    { uid },
    {
      $set: {
        discordId: normalizeString(discordId),
        discordUsername: normalizeString(discordUsername),
        discordEmail: normalizeEmail(discordEmail),
        discordJoinedAt: timestamp,
        updatedAt: timestamp
      }
    },
    { returnDocument: 'after', projection: USER_FIELDS }
  );

  if (!result) throw createHttpError(404, 'Usuário não encontrado.');
  return result;
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

const ABUSE_RESET_AFTER_MS = 10 * 60 * 1000; // histórico de abuso "esfria" após 10 min

function shouldResetAbuse(user) {
  if (!user?.lastAbuseAttemptAt) return true;
  const last = new Date(user.lastAbuseAttemptAt).getTime();
  if (Number.isNaN(last)) return true;
  return Date.now() - last > ABUSE_RESET_AFTER_MS;
}

// Registra uma criação de projeto bem-sucedida: atualiza o carimbo de tempo. O
// histórico de tentativas de abuso só é zerado se a última tentativa tiver
// ocorrido há mais de 10 minutos; caso contrário, a contagem acumulada é
// preservada para que o bloqueio permaneça alcançável dentro de uma rajada.
export async function registerProjectCreation(uid) {
  const collection = await getUsersCollection();
  const timestamp = nowIso();
  const user = await collection.findOne(
    { uid },
    { projection: { lastAbuseAttemptAt: 1 } }
  );

  const setFields = {
    lastProjectCreatedAt: timestamp,
    updatedAt: timestamp
  };
  if (shouldResetAbuse(user)) {
    setFields.abuseAttempts = 0;
  }

  await collection.updateOne({ uid }, { $set: setFields });
}

// Incrementa o contador de tentativas de abuso, carimba o instante da tentativa
// e devolve o novo total.
export async function incrementAbuseAttempts(uid) {
  const collection = await getUsersCollection();
  const timestamp = nowIso();
  const result = await collection.findOneAndUpdate(
    { uid },
    { $inc: { abuseAttempts: 1 }, $set: { lastAbuseAttemptAt: timestamp, updatedAt: timestamp } },
    { returnDocument: 'after', projection: USER_FIELDS }
  );
  return result?.abuseAttempts ?? 0;
}

// Marca o usuário como bloqueado. Só grava blockedAt na primeira vez, para
// preservar o instante original do bloqueio em reprocessamentos.
export async function blockUser(uid) {
  const collection = await getUsersCollection();
  const timestamp = nowIso();
  await collection.updateOne(
    { uid },
    { $set: { blocked: true, updatedAt: timestamp } }
  );
  await collection.updateOne(
    { uid, blockedAt: { $in: [null, undefined] } },
    { $set: { blockedAt: timestamp } }
  );
}

export async function listUsers() {
  const collection = await getUsersCollection();
  return collection
    .find({}, { projection: USER_FIELDS })
    .sort({ role: 1, lastLoginAt: -1 })
    .toArray();
}
