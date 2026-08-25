// src/state/AuthContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

// Carga PEREZOSA del servicio de auth (y con él, de Firebase). Gracias a esto
// Firebase NO entra en el paquete inicial: la app pinta primero y Firebase se
// descarga en segundo plano, justo cuando hace falta (sesión / datos).
let _authServicePromise = null;
function getAuthService() {
  if (!_authServicePromise) {
    _authServicePromise = import("../services/auth.service").then((m) => m.authService);
  }
  return _authServicePromise;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // loading inicial (redirect + listener)
  const [error, setError] = useState("");

  const clearError = () => setError("");

  useEffect(() => {
    let unsub = null;
    let cancelled = false;

    (async () => {
      const authService = await getAuthService();
      try {
        // 1) Si vienes de Google Redirect (mobile), captura el resultado.
        if (typeof authService.completeGoogleRedirect === "function") {
          const redirectedUser = await authService.completeGoogleRedirect();
          if (!cancelled && redirectedUser) setUser(redirectedUser);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = authService.mapAuthError?.(e) ?? "Error completing Google redirect";
          setError(msg);
        }
      } finally {
        // 2) Listener de Firebase (fuente de verdad del estado).
        if (!cancelled) {
          unsub = authService.onAuthStateChanged((u) => {
            setUser(u);
            setLoading(false);
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  const login = async ({ email, password }) => {
    clearError();
    let authService;
    try {
      setLoading(true);
      authService = await getAuthService();
      const u = await authService.loginEmailPassword(email, password);
      setUser(u);
      return u;
    } catch (e) {
      const msg = authService?.mapAuthError?.(e) ?? String(e?.message || e);
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const register = async ({ name, email, password }) => {
    clearError();
    let authService;
    try {
      setLoading(true);
      authService = await getAuthService();
      const u = await authService.registerEmailPassword({ name, email, password });
      setUser(u);
      return u;
    } catch (e) {
      const msg = authService?.mapAuthError?.(e) ?? String(e?.message || e);
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In (desktop=popup devuelve user, mobile=redirect devuelve null)
  const loginWithGoogle = async () => {
    clearError();
    let authService;
    try {
      setLoading(true);
      authService = await getAuthService();
      const u = await authService.loginWithGoogle();
      if (u) setUser(u);
      return u;
    } catch (e) {
      const msg = authService?.mapAuthError?.(e) ?? String(e?.message || e);
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    clearError();
    let authService;
    try {
      setLoading(true);
      authService = await getAuthService();
      await authService.logout();
      setUser(null);
    } catch (e) {
      const msg = authService?.mapAuthError?.(e) ?? String(e?.message || e);
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(
    () => ({
      user,
      isAuthed: !!user,
      loading,
      error,
      clearError,
      login,
      register,
      loginWithGoogle,
      logout,
    }),
    [user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}