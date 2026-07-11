import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { sendTransactionalEmail } from './email.service.js';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const TEMPLATE_URL = new URL('../emails/confirm-account.html', import.meta.url);
const EMAIL_SUBJECT = 'Confirme seu e-mail — Codexa';

let cachedTemplate;

async function loadTemplate() {
  if (cachedTemplate === undefined) {
    cachedTemplate = await readFile(fileURLToPath(TEMPLATE_URL), 'utf8');
  }
  return cachedTemplate;
}

function replaceAll(source, search, value) {
  return source.split(search).join(value);
}

// NAME comes with a leading space so "Olá{{NAME}}," reads naturally, or "Olá,"
// when the display name is empty.
function greetingName(displayName) {
  const name = String(displayName || '').trim();
  return name ? ` ${name}` : '';
}

export function createVerificationToken() {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  return { token, expiresAt };
}

export function isTokenActive(user) {
  if (!user?.verificationToken || !user?.verificationTokenExpiresAt) return false;
  return new Date(user.verificationTokenExpiresAt).getTime() > Date.now();
}

export function buildConfirmUrl(token) {
  return `${env.apiPublicUrl}/api/users/verify-email?token=${encodeURIComponent(token)}`;
}

async function renderConfirmEmail({ token, displayName }) {
  const template = await loadTemplate();
  const withUrl = replaceAll(template, '{{CONFIRM_URL}}', buildConfirmUrl(token));
  return replaceAll(withUrl, '{{NAME}}', greetingName(displayName));
}

export async function sendVerificationEmail({ email, displayName, token }) {
  const htmlContent = await renderConfirmEmail({ token, displayName });
  await sendTransactionalEmail({
    to: email,
    toName: String(displayName || '').trim() || email,
    subject: EMAIL_SUBJECT,
    htmlContent
  });
}
