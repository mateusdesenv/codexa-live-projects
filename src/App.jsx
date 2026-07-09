import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import Login from './pages/Login.jsx';
import UserDashboard from './pages/UserDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import { auth, isAdminUser } from './services/firebase.js';

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

function UserProtectedRoute({ user, loading, children }) {
  if (loading) return <LoadingScreen />;
  return user ? children : <Navigate to="/" replace />;
}

function AdminProtectedRoute({ user, loading, children }) {
  if (loading) return <LoadingScreen />;
  return user && isAdminUser(user) ? children : <Navigate to="/" replace />;
}

export default function App() {
  const [authState, setAuthState] = useState({ user: null, loading: true });

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setAuthState({ user, loading: false });
    });
  }, []);

  const { user, loading } = authState;

  return (
    <Routes>
      <Route path="/" element={<Login user={user} loading={loading} />} />
      <Route
        path="/dashboard"
        element={
          <UserProtectedRoute user={user} loading={loading}>
            <UserDashboard user={user} />
          </UserProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminProtectedRoute user={user} loading={loading}>
            <AdminDashboard user={user} />
          </AdminProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
