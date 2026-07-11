import { env } from '../config/env.js';

// Isola o efeito colateral de POST em webhook do Discord. Best-effort: nunca
// lança para o chamador — apenas loga (sem vazar a URL completa do webhook).

function maskWebhookUrl(url) {
  const value = String(url || '');
  if (!value) return '(vazio)';
  const idMatch = value.match(/webhooks\/(\d+)/);
  return idMatch ? `webhook#${idMatch[1]}` : 'webhook';
}

async function postToWebhook(webhookUrl, body) {
  if (!webhookUrl) {
    console.warn('Discord webhook não configurado; alerta ignorado.');
    return false;
  }

  let response;
  try {
    response = await globalThis.fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (cause) {
    console.error(
      `Falha ao chamar Discord (${maskWebhookUrl(webhookUrl)}):`,
      cause?.message || cause
    );
    return false;
  }

  if (!response.ok) {
    console.error(`Discord respondeu ${response.status} (${maskWebhookUrl(webhookUrl)}).`);
    return false;
  }

  return true;
}

export function sendProjectsWebhook(payload) {
  return postToWebhook(env.discordProjectsWebhookUrl, payload);
}

export function sendProjectsEmbed(embed) {
  return sendProjectsWebhook({ embeds: [embed] });
}

export function sendConfirmedUsersWebhook(payload) {
  return postToWebhook(env.discordConfirmedUsersWebhookUrl, payload);
}

export function sendConfirmedUsersEmbed(embed) {
  return sendConfirmedUsersWebhook({ embeds: [embed] });
}
