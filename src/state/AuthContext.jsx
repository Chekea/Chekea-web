// src/state/AuthContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../services/auth.service";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // loading inicial (listener)
  const [error, setError] = useState("");

  useEffect(() => {
    // listener Firebase
    const unsub = authService.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const clearError = () => setError("");

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
