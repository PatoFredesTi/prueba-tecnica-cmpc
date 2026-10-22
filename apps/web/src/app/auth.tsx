import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError, setSession } from '../lib/api';
import type { LoginResult } from '../lib/types';
type Auth = {
  user: LoginResult['user'] | null;
  login: (session: LoginResult) => void;
  logout: () => void;
  expired: boolean;
};
const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoginResult['user'] | null>(null),
    [expired, setExpired] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const client = useQueryClient();
  const clearSession = useCallback(() => {
    setSession(null);
    setUser(null);
    client.clear();
  }, [client]);
  const login = useCallback(
    (session: LoginResult) => {
      setUser(session.user);
      setExpired(false);
      setSession(session.accessToken, () => {
        clearSession();
        setExpired(true);
      });
    },
    [clearSession],
  );
  useEffect(() => {
    let active = true;
    setRestoring(true);
    setRestoreError('');
    api<LoginResult>('/auth/refresh', { method: 'POST' })
      .then(({ data }) => {
        if (active) login(data);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) clearSession();
        else setRestoreError('No se pudo recuperar tu sesión. Intenta nuevamente.');
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [login, clearSession, attempt]);
  async function logout() {
    setLogoutError('');
    try {
      await api('/auth/logout', { method: 'POST' });
      clearSession();
    } catch {
      setLogoutError('No se pudo cerrar la sesión. Intenta nuevamente.');
    }
  }
  if (restoring) return <p role="status">Recuperando sesión…</p>;
  if (restoreError)
    return (
      <div role="alert">
        {restoreError}{' '}
        <button className="button primary" onClick={() => setAttempt(attempt + 1)}>
          Reintentar
        </button>
      </div>
    );
  return (
    <AuthContext.Provider value={{ user, login, logout, expired }}>
      {logoutError && <p role="alert">{logoutError}</p>}
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Falta AuthProvider');
  return value;
}
export function Protected() {
  const { user } = useAuth(),
    location = useLocation();
  return user ? (
    <Outlet />
  ) : (
    <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  );
}
