import { Router } from 'express';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { sendConfirmedUsersEmbed } from '../services/discord.service.js';
import {
  addUserToGuild,
  buildAuthorizeUrl,
  createState,
  exchangeCode,
  getDiscordUser,
  verifyState
} from '../services/discord-oauth.service.js';
import { findUserByUid, isAdminEmail, setDiscordLink } from '../services/users.service.js';

export const discordRouter = Router();

const DISCORD_ACCENT = 0x5865f2;

function forbidden(res) {
  return res.status(403).json({ ok: false, error: 'Acesso negado.' });
}

// Redirect de volta ao front sinalizando sucesso (1) ou erro (0). Quando APP_URL
// não está configurada, devolve uma página mínima na identidade do app.
function callbackRedirect(res, result) {
  if (env.appUrl) {
    return res.redirect(302, `${env.appUrl}/?discord=${result}`);
  }
  const ok = result === '1';
  return res
    .status(ok ? 200 : 400)
    .type('html')
    .send(
      ok
        ? '<!doctype html><meta charset="utf-8"><title>Discord conectado</title><body style="font-family:Inter,Arial,sans-serif;background:#080b0f;color:#f5f7fa;text-align:center;padding:64px 16px"><h1 style="color:#22c55e">Discord conectado</h1><p>Você entrou na sala do Discord. Pode voltar ao aplicativo.</p></body>'
        : '<!doctype html><meta charset="utf-8"><title>Falha ao conectar</title><body style="font-family:Inter,Arial,sans-serif;background:#080b0f;color:#f5f7fa;text-align:center;padding:64px 16px"><h1 style="color:#ef4444">Não deu para conectar</h1><p>Volte ao aplicativo e tente conectar o Discord de novo.</p></body>'
    );
}

// Só usuário com e-mail confirmado (fonte de verdade: Mongo) ou admin conecta.
function canConnect(user, email) {
  return isAdminEmail(email) || user?.emailVerified === true;
}

// PROTEGIDA: gera o state assinado com o uid do token verificado e devolve a URL
// de autorização. O redirect é feito pelo front (não aqui).
discordRouter.get('/discord/connect', requireAuth, async (req, res, next) => {
  try {
    const { uid, email } = req.authUser;
    const user = await findUserByUid(uid);
    if (!canConnect(user, email)) return forbidden(res);

    const state = createState(uid);
    const url = buildAuthorizeUrl(state);
    res.json({ url });
  } catch (error) {
    next(error);
  }
});

// PÚBLICA: redirect do browser após consentimento no Discord (sem Authorization
// header). A identidade vem do state assinado, não do token.
discordRouter.get('/discord/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '').trim();
    const state = String(req.query.state || '').trim();
    if (!code || !state) return callbackRedirect(res, '0');

    const verified = verifyState(state);
    if (!verified) return callbackRedirect(res, '0');

    const user = await findUserByUid(verified.uid);
    if (!canConnect(user, user?.email)) return callbackRedirect(res, '0');

    const { access_token: accessToken } = await exchangeCode(code);
    const discordUser = await getDiscordUser(accessToken);
    if (!discordUser.id) return callbackRedirect(res, '0');

    await addUserToGuild(discordUser.id, accessToken);
    const updated = await setDiscordLink(verified.uid, {
      discordId: discordUser.id,
      discordUsername: discordUser.username,
      discordEmail: discordUser.email
    });

    // Aviso best-effort: uma falha aqui não derruba o fluxo de sucesso.
    sendConfirmedUsersEmbed({
      title: 'Novo membro confirmado entrou',
      description: `${updated.displayName || updated.email} (${updated.email})`,
      color: DISCORD_ACCENT,
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return callbackRedirect(res, '1');
  } catch {
    // Qualquer erro (config ausente, OAuth, guild) vira redirect de falha limpo.
    return callbackRedirect(res, '0');
  }
});
