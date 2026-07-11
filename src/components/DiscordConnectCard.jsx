import { useState } from 'react';
import { connectDiscord } from '../services/users.js';
import NerdModal from './NerdModal.jsx';

// Frases nerd exibidas quando o usuário ainda não tem acesso liberado pelo admin.
const NERD_LOCKED_MESSAGES = [
  '🔒 403 Forbidden: você ainda não tem role de acesso ao nosso Discord. Fala com o admin.',
  'Sudo negado: você não está no sudoers do Discord. Só o admin te adiciona.',
  "npm ERR! missing permission: 'discord-access'. Instale pedindo pro admin. 🤓",
  'Seu acesso ao Discord está undefined. Só o admin consegue setar pra true.',
  'Erro 42: a resposta pra tudo existe, mas seu acesso ao Discord ainda não. Chama o admin.',
  'Esse botão está em git stash até o admin liberar seu acesso. 🧑‍💻',
  'Você tentou dar merge no nosso Discord, mas faltou o approve do admin. ✅❌',
  'Acesso ao Discord ainda é 0. Precisa do admin virar esse bit pra 1. 💾'
];

function pickNerdMessage() {
  return NERD_LOCKED_MESSAGES[Math.floor(Math.random() * NERD_LOCKED_MESSAGES.length)];
}

// Card de auto-join no Discord. Aparece só para usuário verificado ainda sem
// vínculo. Se o admin não liberou (discordEnabled !== true), o clique abre um
// modal com uma frase nerd aleatória e NÃO chama o backend. Liberado, segue o
// fluxo normal (pede a URL de autorização e redireciona o browser).
export default function DiscordConnectCard({ discordEnabled }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [nerdMessage, setNerdMessage] = useState('');

  async function handleConnect() {
    if (discordEnabled !== true) {
      setNerdMessage(pickNerdMessage());
      return;
    }

    setIsConnecting(true);
    setError('');
    try {
      const url = await connectDiscord();
      if (!url) throw new Error('URL ausente.');
      window.location.href = url;
    } catch {
      setError('Não deu para abrir o Discord agora. Tente de novo em instantes.');
      setIsConnecting(false);
    }
  }

  return (
    <div className="discord-card">
      <div className="discord-card-text">
        <p className="eyebrow">Comunidade</p>
        <h2>Entrar na sala do Discord</h2>
        <p>
          Conecte sua conta do Discord e a gente te adiciona automaticamente ao
          servidor da live.
        </p>
      </div>
      <button
        type="button"
        className="btn btn-discord btn-full"
        onClick={handleConnect}
        disabled={isConnecting}
      >
        {isConnecting ? 'Abrindo Discord...' : 'Conectar Discord'}
      </button>
      {error ? (
        <span className="form-alert" role="alert">
          {error}
        </span>
      ) : null}
      {nerdMessage ? (
        <NerdModal message={nerdMessage} onClose={() => setNerdMessage('')} />
      ) : null}
    </div>
  );
}
