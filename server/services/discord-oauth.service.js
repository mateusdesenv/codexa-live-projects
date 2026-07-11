import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

// Fluxo OAuth do Discord para auto-join no guild. Funções pequenas e isoladas;
// segredos (client secret, bot token, state secret) nunca aparecem em log/resposta.

const AUTHORIZE_URL = 'https://discord.com/api/oauth2/authorize';
const TOKEN_URL = 'https://discord.com/api/oauth2/token';
const USER_URL = 'https://discord.com/api/users/@me';
const OAUTH_SCOPE = 'identify email guilds.join';
const STATE_TTL_MS = 10 * 60 * 1000;

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function base64url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

// Fail-closed: sem os segredos obrigatórios o fluxo não pode assinar/verificar
// state nem falar com o bot. Erro claro, nunca comportamento silencioso.
function requireStateSecret() {
  if (!env.discordStateSecret) {
    throw createHttpError(503, 'Integração Discord indisponível.');
  }
  return env.discordStateSecret;
}

function requireOAuthConfig() {
  const missing = [];
  if (!env.discordClientId) missing.push('DISCORD_CLIENT_ID');
  if (!env.discordClientSecret) missing.push('DISCORD_CLIENT_SECRET');
  if (!env.discordRedirectUri) missing.push('DISCORD_REDIRECT_URI');
  if (missing.length > 0) {
    // Loga só os nomes ausentes (não sensíveis), nunca valores.
    console.error(`[discord-oauth] Config ausente: ${missing.join(', ')}`);
    throw createHttpError(503, 'Integração Discord indisponível.');
  }
}

function requireBotConfig() {
  const missing = [];
  if (!env.discordBotToken) missing.push('DISCORD_BOT_TOKEN');
  if (!env.discordGuildId) missing.push('DISCORD_GUILD_ID');
  if (missing.length > 0) {
    console.error(`[discord-oauth] Config ausente: ${missing.join(', ')}`);
    throw createHttpError(503, 'Integração Discord indisponível.');
  }
}

function signPayload(payloadB64, secret) {
  return base64url(createHmac('sha256', secret).update(payloadB64).digest());
}

// State assinado (HMAC-SHA256) carregando { uid, exp }. Protege contra CSRF e
// garante que o callback só aceita states emitidos por nós, dentro da validade.
export function createState(uid) {
  const secret = requireStateSecret();
  const payload = { uid, exp: Date.now() + STATE_TTL_MS };
  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = signPayload(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

export function verifyState(state) {
  const secret = requireStateSecret();
  const value = String(state || '');
  const parts = value.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  const expected = signPayload(payloadB64, secret);

  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(provided, expectedBuf)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!payload?.uid || typeof payload.exp !== 'number') return null;
  if (payload.exp < Date.now()) return null;
  return { uid: payload.uid };
}

export function buildAuthorizeUrl(state) {
  requireOAuthConfig();
  const params = new URLSearchParams({
    client_id: env.discordClientId,
    redirect_uri: env.discordRedirectUri,
    response_type: 'code',
    scope: OAUTH_SCOPE,
    state,
    prompt: 'consent'
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCode(code) {
  requireOAuthConfig();
  const body = new URLSearchParams({
    client_id: env.discordClientId,
    client_secret: env.discordClientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.discordRedirectUri
  });

  const response = await globalThis.fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    // Nunca logar o corpo (pode ecoar client_secret/code); só o status.
    console.error(`[discord-oauth] Troca de code falhou: ${response.status}`);
    throw createHttpError(502, 'Falha ao autenticar com o Discord.');
  }

  const data = await response.json();
  if (!data?.access_token) {
    throw createHttpError(502, 'Falha ao autenticar com o Discord.');
  }
  return data;
}

export async function getDiscordUser(accessToken) {
  const response = await globalThis.fetch(USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    console.error(`[discord-oauth] Falha ao ler usuário Discord: ${response.status}`);
    throw createHttpError(502, 'Falha ao ler perfil do Discord.');
  }

  const data = await response.json();
  return {
    id: String(data?.id || ''),
    username: String(data?.username || ''),
    email: String(data?.email || '')
  };
}

// Adiciona o usuário ao guild via bot. 201 = adicionado; 204 = já era membro.
// Ambos são sucesso. O bot token nunca é logado.
export async function addUserToGuild(discordUserId, accessToken) {
  requireBotConfig();
  const url = `https://discord.com/api/guilds/${env.discordGuildId}/members/${discordUserId}`;

  const response = await globalThis.fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${env.discordBotToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ access_token: accessToken })
  });

  if (response.status === 201 || response.status === 204) return true;

  console.error(`[discord-oauth] Falha ao adicionar ao guild: ${response.status}`);
  throw createHttpError(502, 'Falha ao entrar no servidor do Discord.');
}
