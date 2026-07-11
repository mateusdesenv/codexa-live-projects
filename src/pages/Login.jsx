import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserName, isAdminUser, signInWithGoogle } from '../services/firebase.js';
import { fetchStats } from '../services/storage.js';

const formatCount = (value) => String(Math.max(0, Number(value) || 0)).padStart(2, '0');

function buildQueueCards(stats) {
  return [
    {
      label: 'Fila da live',
      title: 'Projetos enviados',
      value: stats ? formatCount(stats.total) : '—',
      meta: stats ? `+${Math.max(0, Number(stats.today) || 0)} hoje` : 'atualizando…'
    },
    {
      label: 'Em análise',
      title: 'Aguardando revisão',
      value: stats ? formatCount(stats.inAnalysis) : '—',
      meta: 'curadoria Codexa'
    },
    {
      label: 'Aprovado',
      title: 'Prontos para mostrar',
      value: stats ? formatCount(stats.highlighted) : '—',
      meta: 'ao vivo'
    }
  ];
}

export default function Login({ user, loading }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!loading && user) {
      navigate(isAdminUser(user) ? '/admin' : '/dashboard', { replace: true });
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    let active = true;

    const load = () => {
      fetchStats()
        .then((data) => {
          if (active) setStats(data);
        })
        .catch(() => {});
    };

    load();
    const interval = setInterval(load, 20000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', load);

    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', load);
    };
  }, []);

  const queueCards = buildQueueCards(stats);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const signedUser = await signInWithGoogle();
      navigate(isAdminUser(signedUser) ? '/admin' : '/dashboard', { replace: true });
    } catch (firebaseError) {
      console.error(
        `Google sign-in failed: ${firebaseError?.code || 'unknown'} - ${firebaseError?.message || 'Sem mensagem'}`
      );
      if (firebaseError?.code === 'auth/unauthorized-domain') {
        setError('Domínio local não autorizado no Firebase. Abra pelo localhost:5173 ou adicione 127.0.0.1 nos domínios autorizados.');
      } else {
        setError('Não foi possível entrar com Google. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page login-page">
      <section className="login-shell" aria-labelledby="login-title">
        <div className="login-hero">
          <div className="login-brand">
            <span className="login-brand-mark">C</span>
            <span>Codexa Live Projects</span>
          </div>

          <div className="login-copy">
            <p className="eyebrow">Live coding • Projetos da galera</p>
            <h1 id="login-title" className="login-title">Sua vitrine para aparecer na live</h1>
            <p>
              Envie seu projeto, acompanhe a curadoria e deixe tudo pronto para
              ser apresentado em uma experiência Codexa.
            </p>
          </div>

          <div className="login-preview" aria-label="Resumo dos projetos da live">
            {queueCards.map((card, index) => (
              <article className={`queue-card queue-card-${index + 1}`} key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.title}</p>
                <small>{card.meta}</small>
              </article>
            ))}
          </div>

          <div className="login-trust-row" aria-label="Benefícios do acesso">
            <span>Acesso por Google</span>
            <span>Dados por usuário</span>
            <span>Sessão segura</span>
          </div>
        </div>

        <aside className="login-panel">
          <div className="login-panel-header">
            <span className="panel-kicker">Login único</span>
            <h2>Entre para cadastrar seu projeto</h2>
            <p>
              O acesso identifica sua conta e libera o ambiente correto para
              acompanhar seus projetos.
            </p>
          </div>

          <form className="auth-form login-form" onSubmit={handleSubmit}>
            <button className="btn btn-primary btn-full google-btn login-google-btn" type="submit" disabled={loading || isSubmitting}>
              <span className="google-mark">G</span>
              <span>{isSubmitting ? 'Entrando...' : 'Entrar com Google'}</span>
            </button>

            {error ? <div className="form-alert">{error}</div> : null}

            {user ? <span className="auth-link">Sessão ativa: {getUserName(user)}</span> : null}
          </form>

          <p className="login-security-note">
            Autenticação via Firebase Google Auth com sessão persistente no navegador.
          </p>
        </aside>
      </section>
    </main>
  );
}
