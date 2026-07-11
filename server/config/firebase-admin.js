import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
// Importa env para garantir que dotenv.config() já rodou antes de lermos
// process.env.FIREBASE_SERVICE_ACCOUNT (independe da ordem de import em app.js).
import './env.js';

// Inicialização fail-closed do Firebase Admin SDK a partir de env.
// A service account chega como JSON string completo em FIREBASE_SERVICE_ACCOUNT.
// Ausente/inválida => Admin não inicializa e verifyIdToken() sempre rejeita, de
// modo que as rotas autenticadas respondem 401 (nunca liberam acesso sem prova).

let authClient = null;
let initError = null;

// Aceita a service account como JSON cru (produção/Vercel, env var real) OU em
// base64 do JSON. O base64 evita a corrupção do "\n" da private key quando a env
// é carregada de um arquivo .env local (dotenv/dotenvx reinterpreta o escape),
// permitindo rodar localmente com um .env comum.
function decodeServiceAccount(value) {
  if (value.startsWith('{')) {
    return value;
  }
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8').trim();
    if (decoded.startsWith('{')) {
      return decoded;
    }
  } catch {
    // cai para o valor original; o JSON.parse abaixo emite o erro claro
  }
  return value;
}

function parseServiceAccount(raw) {
  const value = String(raw || '').trim();
  if (!value) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT ausente.');
  }
  try {
    return JSON.parse(decodeServiceAccount(value));
  } catch (error) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT inválida (JSON malformado): ${error.message}`);
  }
}

function initFirebaseAdmin() {
  try {
    const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
    const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
    authClient = getAuth(app);
  } catch (error) {
    initError = error;
    console.error(
      '[firebase-admin] Falha ao inicializar o Admin SDK. Rotas autenticadas ' +
        `operam em modo fail-closed (401). Detalhe: ${error.message}`
    );
  }
}

initFirebaseAdmin();

export function isFirebaseAdminReady() {
  return authClient !== null;
}

// Verifica um ID token do Firebase. Rejeita quando o Admin não foi inicializado
// (fail-closed) ou quando o token é inválido/expirado.
export async function verifyIdToken(idToken) {
  if (!authClient) {
    throw initError || new Error('Firebase Admin não inicializado.');
  }
  return authClient.verifyIdToken(idToken);
}
