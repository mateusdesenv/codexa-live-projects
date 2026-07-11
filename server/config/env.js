import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

// Converte env numérica com fallback seguro: evita NaN (que desativaria
// silenciosamente cooldown/bloqueio) quando a variável está ausente ou inválida.
function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function splitOrigins(value) {
  if (!value || value.trim() === '*') return '*';
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3001),
  mongodbUri: required('MONGODB_URI'),
  mongodbDb: process.env.MONGODB_DB || 'codexa_live_projects',
  projectsCollection: process.env.PROJECTS_COLLECTION || 'codexa_live_projects',
  usersCollection: process.env.USERS_COLLECTION || 'codexa_live_projects_users',
  drawsCollection: process.env.DRAWS_COLLECTION || 'codexa_live_projects_draws',
  adminEmail: String(process.env.ADMIN_EMAIL || 'mateus.desenv@gmail.com').trim().toLowerCase(),
  jsonLimit: process.env.JSON_LIMIT || '2mb',
  corsOrigin: splitOrigins(process.env.CORS_ORIGIN || '*'),
  appUrl: String(process.env.APP_URL || '').trim(),
  apiPublicUrl: String(process.env.API_PUBLIC_URL || 'http://127.0.0.1:3001').trim(),
  brevoApiKey: String(process.env.BREVO_API_KEY || '').trim(),
  mailFromEmail: String(process.env.MAIL_FROM_EMAIL || 'no-reply@codexa-web.online').trim(),
  mailFromName: String(process.env.MAIL_FROM_NAME || 'Codexa').trim(),
  discordProjectsWebhookUrl: String(process.env.DISCORD_PROJECTS_WEBHOOK_URL || '').trim(),
  projectCooldownMs: numberOr(process.env.PROJECT_COOLDOWN_MS, 60000),
  abuseBlockThreshold: numberOr(process.env.ABUSE_BLOCK_THRESHOLD, 5),
  // Auto-join no Discord via OAuth. Client ID e Guild ID são públicos; secret,
  // bot token e state secret são sensíveis (fail-closed quando ausentes).
  discordClientId: String(process.env.DISCORD_CLIENT_ID || '').trim(),
  discordClientSecret: String(process.env.DISCORD_CLIENT_SECRET || '').trim(),
  discordBotToken: String(process.env.DISCORD_BOT_TOKEN || '').trim(),
  discordGuildId: String(process.env.DISCORD_GUILD_ID || '').trim(),
  discordRedirectUri: String(process.env.DISCORD_REDIRECT_URI || '').trim(),
  discordStateSecret: String(process.env.DISCORD_STATE_SECRET || '').trim(),
  discordConfirmedUsersWebhookUrl: String(process.env.DISCORD_CONFIRMED_USERS_WEBHOOK_URL || '').trim()
};
