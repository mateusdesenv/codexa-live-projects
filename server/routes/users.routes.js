import { Router } from 'express';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import {
  findUserByUid,
  findUserByVerificationToken,
  findUserWithVerificationToken,
  getUserProfile,
  isAdminEmail,
  listUsers,
  markEmailVerified,
  saveVerificationToken,
  updateUserProfile,
  upsertUserSession
} from '../services/users.service.js';
import {
  createVerificationToken,
  isTokenActive,
  sendVerificationEmail
} from '../services/verification.service.js';

export const usersRouter = Router();

function forbidden(res) {
  return res.status(403).json({ ok: false, error: 'Acesso negado.' });
}

function verifiedRedirect(res, result) {
  if (!env.appUrl) {
    const ok = result === '1';
    return res
      .status(ok ? 200 : 400)
      .type('html')
      .send(
        ok
          ? '<!doctype html><meta charset="utf-8"><title>E-mail confirmado</title><body style="font-family:Inter,Arial,sans-serif;background:#080b0f;color:#f5f7fa;text-align:center;padding:64px 16px"><h1 style="color:#22c55e">E-mail confirmado</h1><p>Sua conta foi liberada. Você já pode voltar ao aplicativo.</p></body>'
          : '<!doctype html><meta charset="utf-8"><title>Link inválido</title><body style="font-family:Inter,Arial,sans-serif;background:#080b0f;color:#f5f7fa;text-align:center;padding:64px 16px"><h1 style="color:#ef4444">Link inválido ou expirado</h1><p>Solicite um novo e-mail de confirmação no aplicativo.</p></body>'
      );
  }
  return res.redirect(302, `${env.appUrl}/?verified=${result}`);
}

// Gera token, persiste no usuário e envia o e-mail de confirmação. Isola os
// efeitos colaterais (DB + envio) para reuso entre session e resend.
async function issueVerification(user) {
  const { token, expiresAt } = createVerificationToken();
  await saveVerificationToken(user.uid, token, expiresAt);
  await sendVerificationEmail({
    email: user.email,
    displayName: user.displayName || user.googleName,
    token
  });
}

// PÚBLICA: acessada pelo link do e-mail (sem ID token). Autentica pelo próprio
// token de verificação de uso único, não pelo Firebase.
usersRouter.get('/users/verify-email', async (req, res, next) => {
  try {
    const token = String(req.query.token || '').trim();
    if (!token) return verifiedRedirect(res, '0');

    const user = await findUserByVerificationToken(token);
    if (!user || !isTokenActive(user)) return verifiedRedirect(res, '0');

    await markEmailVerified(user.uid);
    return verifiedRedirect(res, '1');
  } catch (error) {
    next(error);
  }
});

// A partir daqui, tudo depende de identidade verificada.
usersRouter.use('/users', requireAuth);

// Listagem do admin: só o e-mail verificado do token que for admin acessa.
usersRouter.get('/users', async (req, res, next) => {
  try {
    if (!isAdminEmail(req.authUser.email)) return forbidden(res);
    const users = await listUsers();
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/users/:uid', async (req, res, next) => {
  try {
    // Usuário só lê o próprio perfil; admin lê qualquer um.
    if (req.params.uid !== req.authUser.uid && !isAdminEmail(req.authUser.email)) {
      return forbidden(res);
    }
    const user = await getUserProfile(req.params.uid);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

usersRouter.post('/users/session', async (req, res, next) => {
  try {
    // Identidade sempre do token verificado: uid/email do body são ignorados.
    const user = await upsertUserSession({
      ...req.body,
      uid: req.authUser.uid,
      email: req.authUser.email
    });
    const needsVerification = !isAdminEmail(user.email) && user.emailVerified !== true;

    if (needsVerification) {
      // Verificação de token ativo usa projeção interna (com token), sem expor
      // o token na resposta pública devolvida ao cliente.
      const withToken = await findUserWithVerificationToken(user.uid);
      if (!isTokenActive(withToken)) {
        await issueVerification(user);
      }
    }

    res.status(201).json({
      ...user,
      emailVerified: user.emailVerified === true,
      blocked: user.blocked === true
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.post('/users/resend-verification', async (req, res, next) => {
  try {
    // Reenvia sempre para o próprio usuário do token — sem confiar em uid/email
    // do body (impede acionar envio para outra conta).
    const user = await findUserByUid(req.authUser.uid);

    // Resposta genérica sempre 200 {ok:true}: não revela estado da conta.
    if (user && !isAdminEmail(user.email) && user.emailVerified !== true) {
      await issueVerification(user);
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/users/:uid', async (req, res, next) => {
  try {
    // Só edita o próprio perfil (identidade do token).
    if (req.params.uid !== req.authUser.uid) return forbidden(res);
    const user = await updateUserProfile(req.authUser.uid, req.body);
    res.json(user);
  } catch (error) {
    next(error);
  }
});
