import { env } from '../config/env.js';
import {
  blockUser,
  findUserByUid,
  incrementAbuseAttempts,
  isAdminEmail
} from './users.service.js';
import { sendProjectsEmbed } from './discord.service.js';

const DISCORD_ALERT_COLOR = 0xef4444; // vermelho (--danger) para alertas de abuso

function createHttpError(status, code) {
  const error = new Error(code);
  error.status = status;
  error.code = code;
  return error;
}

function isWithinCooldown(user) {
  if (!user?.lastProjectCreatedAt) return false;
  const last = new Date(user.lastProjectCreatedAt).getTime();
  if (Number.isNaN(last)) return false;
  return Date.now() - last < env.projectCooldownMs;
}

function attemptedProjectFields(payload) {
  return [
    { name: 'Projeto', value: String(payload?.title || '(sem título)').slice(0, 256) },
    { name: 'URL', value: String(payload?.url || '(sem url)').slice(0, 256) },
    {
      name: 'Descrição',
      value: String(payload?.description || '(sem descrição)').slice(0, 1024)
    }
  ];
}

function userFields(user) {
  return [
    { name: 'Usuário', value: String(user?.displayName || user?.googleName || '—'), inline: true },
    { name: 'E-mail', value: String(user?.email || '—'), inline: true },
    { name: 'UID', value: String(user?.uid || '—'), inline: true }
  ];
}

async function alertAbuseAttempt(user, payload, attempts) {
  await sendProjectsEmbed({
    title: '🚫 Tentativa de cadastro bloqueada (cooldown)',
    color: DISCORD_ALERT_COLOR,
    fields: [
      ...userFields(user),
      { name: 'Tentativas', value: String(attempts), inline: true },
      ...attemptedProjectFields(payload)
    ],
    timestamp: new Date().toISOString()
  });
}

async function alertAccountBlocked(user, attempts) {
  await sendProjectsEmbed({
    title: '⛔ Conta bloqueada por abuso',
    color: DISCORD_ALERT_COLOR,
    fields: [
      ...userFields(user),
      { name: 'Tentativas', value: String(attempts), inline: true }
    ],
    timestamp: new Date().toISOString()
  });
}

// Verifica se o usuário pode criar um projeto. Efeitos colaterais (incremento de
// tentativas, bloqueio, alertas Discord) são best-effort e não derrubam o fluxo
// além de sinalizar a rejeição via erro HTTP genérico.
//
// Retorna o usuário resolvido quando a criação é permitida; lança erro 429 com
// code PROCESSING_UNAVAILABLE quando bloqueada, ou 403 EMAIL_NOT_VERIFIED
// quando o e-mail ainda não foi confirmado (gate enforçado no servidor).
export async function guardProjectCreation(uid, attemptedProject = {}) {
  const userUid = String(uid || '').trim();
  if (!userUid) return null; // sem uid não há como rastrear; segue o fluxo normal

  const user = await findUserByUid(userUid);
  if (!user) return null;

  if (user.blocked === true) {
    throw createHttpError(429, 'PROCESSING_UNAVAILABLE');
  }

  // Gate de e-mail enforçado no backend: só admin ou e-mail verificado no nosso
  // Mongo pode criar projeto. Não é abuso — não incrementa contador.
  if (!isAdminEmail(user.email) && user.emailVerified !== true) {
    throw createHttpError(403, 'EMAIL_NOT_VERIFIED');
  }

  if (isWithinCooldown(user)) {
    const attempts = await incrementAbuseAttempts(userUid);
    await alertAbuseAttempt(user, attemptedProject, attempts).catch(() => {});

    if (attempts >= env.abuseBlockThreshold) {
      await blockUser(userUid);
      await alertAccountBlocked(user, attempts).catch(() => {});
    }

    throw createHttpError(429, 'PROCESSING_UNAVAILABLE');
  }

  return user;
}
