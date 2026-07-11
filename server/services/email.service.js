import { env } from '../config/env.js';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

function buildPayload({ to, toName, subject, htmlContent }) {
  return {
    sender: { email: env.mailFromEmail, name: env.mailFromName },
    to: [{ email: to, name: toName || to }],
    subject,
    htmlContent
  };
}

export async function sendTransactionalEmail({ to, toName, subject, htmlContent }) {
  if (!env.brevoApiKey) {
    throw new Error('BREVO_API_KEY não configurada.');
  }

  let response;
  try {
    response = await globalThis.fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': env.brevoApiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(buildPayload({ to, toName, subject, htmlContent }))
    });
  } catch (cause) {
    console.error('Falha ao chamar Brevo:', cause?.message || cause);
    throw new Error('Falha ao enviar e-mail transacional.');
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error(`Brevo respondeu ${response.status}: ${detail}`);
    throw new Error('Falha ao enviar e-mail transacional.');
  }

  return true;
}
