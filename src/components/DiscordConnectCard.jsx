import { useState } from 'react';
import { connectDiscord } from '../services/users.js';

// Card de auto-join no Discord. Aparece só para usuário verificado ainda sem
// vínculo. O botão pede a URL de autorização e redireciona o browser.
export default function DiscordConnectCard() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  async function handleConnect() {
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
    </div>
  );
}
