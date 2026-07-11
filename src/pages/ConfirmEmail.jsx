import { useState } from 'react';
import { getUserName, signOutUser } from '../services/firebase.js';
import { resendVerification, upsertUserSession } from '../services/users.js';

export default function ConfirmEmail({ user, onVerified, initialError }) {
  const email = user?.email || '';
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(initialError || '');

  async function handleResend() {
    setStatus('resending');
    setMessage('');
    setError('');

    try {
      await resendVerification({ uid: user?.uid, email });
      setMessage(`Reenviamos o link para ${email}. Confira sua caixa de entrada e o spam.`);
    } catch {
      setError('Não foi possível reenviar o e-mail agora. Tente novamente em instantes.');
    } finally {
      setStatus('idle');
    }
  }

  async function handleRefresh() {
    setStatus('refreshing');
    setMessage('');
    setError('');

    try {
      const profile = await upsertUserSession(user);
      if (profile?.emailVerified === true) {
        onVerified?.();
        return;
      }
      setError('Ainda não confirmamos seu e-mail. Clique no link enviado e tente de novo.');
    } catch {
      setError('Não foi possível checar seu status agora. Tente novamente.');
    } finally {
      setStatus('idle');
    }
  }

  async function handleSignOut() {
    await signOutUser();
  }

  const busy = status !== 'idle';

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="confirm-title">
        <div className="auth-content">
          <span className="login-brand-mark" aria-hidden="true">C</span>
          <p className="eyebrow">Verificação de conta</p>
          <h1 id="confirm-title">Confirme seu e-mail</h1>
          <p style={{ color: 'var(--muted)', marginTop: '10px', lineHeight: 1.6 }}>
            Enviamos um link para <strong style={{ color: 'var(--text)' }}>{email || 'seu e-mail'}</strong>.
            Confirme para liberar o acesso.
          </p>

          {error ? (
            <div className="form-alert" role="alert" style={{ marginTop: '18px' }}>
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="success-message" role="status" style={{ marginTop: '18px' }}>
              {message}
            </div>
          ) : null}

          <div
            className="auth-form"
            style={{ display: 'grid', gap: '12px', marginTop: '22px' }}
          >
            <button
              type="button"
              className="btn btn-primary btn-full"
              onClick={handleResend}
              disabled={busy}
            >
              {status === 'resending' ? 'Reenviando...' : 'Reenviar e-mail'}
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-full"
              onClick={handleRefresh}
              disabled={busy}
            >
              {status === 'refreshing' ? 'Verificando...' : 'Já confirmei — atualizar'}
            </button>

            <button type="button" className="auth-link" onClick={handleSignOut} disabled={busy}>
              Sair {user ? `(${getUserName(user)})` : ''}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
