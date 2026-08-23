// src/state/AuthContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../services/auth.service";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // loading inicial (redirect + listener)
  const [error, setError] = useState("");

  const clearError = () => setError("");

  useEffect(() => {
    let unsub = null;
    let cancelled = false;

    (async () => {
      try {
        // ✅ 1) Si vienes de Google Redirect (mobile), captura el resultado
        // (si no vienes de redirect, devuelve null y no pasa nada)
        if (typeof authService.completeGoogleRedirect === "function") {
          const redirectedUser = await authService.completeGoogleRedirect();
          if (!cancelled && redirectedUser) setUser(redirectedUser);
        }
      } catch (e) {
        // No bloquees el listener por un error de redirect
        if (!cancelled) {
          const msg = authService.mapAuthError?.(e) ?? "Error completing Google redirect";
          setError(msg);
        }
      } finally {
        // ✅ 2) Listener Firebase (fuente de verdad del estado)
        if (cancelled) return;

        unsub = authService.onAuthStateChanged((u) => {
          // u ya debería venir mapeado por tu service
          setUser(u);
          setLoading(false);
        });
      }
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  const login = async ({ email, password }) => {
    clearError();
    try {
      setLoading(true);
      const u = await authService.loginEmailPassword(email, password);
      setUser(u);
      return u;
    } catch (e) {
      const msg = authService.mapAuthError(e);
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const register = async ({ name, email, password }) => {
    clearError();
    try {
      setLoading(true);
      const u = await authService.registerEmailPassword({ name, email, password });
      setUser(u);
      return u;
    } catch (e) {
      const msg = authService.mapAuthError(e);
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Optimizado: Google Sign-In (desktop=popup devuelve user, mobile=redirect devuelve null)
  const loginWithGoogle = async () => {
    clearError();
    try {
      setLoading(true);
      const u = await authService.loginWithGoogle();

      // ✅ En desktop setea inmediatamente. En mobile (redirect) u será null y no tocamos user.
      if (u) setUser(u);

      return u; // null en mobile es esperado
    } catch (e) {
      const msg = authService.mapAuthError(e);
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    clearError();
    try {
      setLoading(true);
      await authService.logout();
      setUser(null);
    } catch (e) {
      const msg = authService.mapAuthError(e);
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