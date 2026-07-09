import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserName, isAdminUser, signInWithGoogle } from '../services/firebase.js';

export default function Login({ user, loading }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate(isAdminUser(user) ? '/admin' : '/dashboard', { replace: true });
    }
  }, [loading, navigate, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const signedUser = await signInWithGoogle();
      navigate(isAdminUser(signedUser) ? '/admin' : '/dashboard', { replace: true });
    } catch (firebaseError) {
      setError('Não foi possível entrar com Google. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card auth-card-large">
        <div className="auth-content">
          <p className="eyebrow">Live coding • Projetos da galera</p>
          <h1>Envie seu projeto para a live</h1>
          <p>
            Entre com sua conta Google para cadastrar e acompanhar seus projetos.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <button className="btn btn-primary btn-full google-btn" type="submit" disabled={loading || isSubmitting}>
            <span className="google-mark">G</span>
            {isSubmitting ? 'Entrando...' : 'Entrar com Google'}
          </button>

          {error ? <div className="form-alert">{error}</div> : null}

          {user ? <span className="auth-link">Sessão ativa: {getUserName(user)}</span> : null}
        </form>
      </section>
    </main>
  );
}
