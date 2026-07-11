import { verifyIdToken } from '../config/firebase-admin.js';

const BEARER_PREFIX = 'Bearer ';

function extractBearerToken(req) {
  const header = req.headers?.authorization || '';
  if (!header.startsWith(BEARER_PREFIX)) return '';
  return header.slice(BEARER_PREFIX.length).trim();
}

function unauthorized(res) {
  // Erro genérico: não vaza o motivo (token ausente x inválido x expirado x
  // Admin fail-closed), evitando dar pistas a quem tenta burlar a autenticação.
  return res.status(401).json({ ok: false, error: 'Não autorizado.' });
}

// Middleware de autenticação: valida o ID token do Firebase e injeta a
// identidade derivada do token verificado em req.authUser. Sem token válido a
// requisição é rejeitada com 401 genérico (fail-closed).
export async function requireAuth(req, res, next) {
  const idToken = extractBearerToken(req);
  if (!idToken) return unauthorized(res);

  try {
    const decoded = await verifyIdToken(idToken);
    req.authUser = {
      uid: decoded.uid,
      email: String(decoded.email || '').trim().toLowerCase(),
      emailVerified: decoded.email_verified === true
    };
    return next();
  } catch {
    return unauthorized(res);
  }
}
