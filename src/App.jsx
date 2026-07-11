import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import ConfirmEmail from './pages/ConfirmEmail.jsx';
import Login from './pages/Login.jsx';
import UserDashboard from './pages/UserDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import { auth, isAdminUser } from './services/firebase.js';
import { upsertUserSession } from './services/users.js';

function LoadingScreen() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Google Firebase</p>
        <h1>Carregando sessão</h1>
      </section>
    </main>
  );
}

function needsConfirmation(user, emailVerified) {
  return Boolean(user) && !isAdminUser(user) && emailVerified !== true;
}

function UserProtectedRoute({ user, loading, emailVerified, children }) {
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (needsConfirmation(user, emailVerified)) return <Navigate to="/confirm-email" replace />;
  return children;
}

function AdminProtectedRoute({ user, loading, children }) {
  if (loading) return <LoadingScreen />;
  return user && isAdminUser(user) ? children : <Navigate to="/" replace />;
}

function ConfirmEmailRoute({ user, loading, emailVerified, onVerified }) {
  const [searchParams] = useSearchParams();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (!needsConfirmation(user, emailVerified)) return <Navigate to="/dashboard" replace />;

  const initialError =
    searchParams.get('verified') === '0'
      ? 'Link inválido ou expirado. Reenvie o e-mail de confirmação.'
      : '';

  return <ConfirmEmail user={user} onVerified={onVerified} initialError={initialError} />;
}

export default function App() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState({ user: null, loading: true });
  const [emailVerified, setEmailVerified] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setAuthState({ user, loading: false });

      if (!user || isAdminUser(user)) {
        setEmailVerified(true);
        return;
      }

      try {
        const profile = await upsertUserSession(user);
        setEmailVerified(profile?.emailVerified === true);
      } catch {
        setEmailVerified(true);
      }
    });
  }, []);

  const { user, loading } = authState;
  const sessionLoading = loading || (Boolean(user) && !isAdminUser(user) && emailVerified === null);

  const handleVerified = useCallback(() => {
    setEmailVerified(true);
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<Login user={user} loading={sessionLoading} />} />
      <Route
        path="/confirm-email"
        element={
          <ConfirmEmailRoute
            user={user}
            loading={sessionLoading}
            emailVerified={emailVerified}
            onVerified={handleVerified}
          />
        }
      />
      <Route
        path="/dashboard"
        element={
          <UserProtectedRoute user={user} loading={sessionLoading} emailVerified={emailVerified}>
            <UserDashboard user={user} />
          </UserProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminProtectedRoute user={user} loading={sessionLoading}>
            <AdminDashboard user={user} />
          </AdminProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
