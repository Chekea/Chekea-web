import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useEffectiveAuth } from "../state/useEffectiveAuth";

export default function ProtectedRoute({ children }) {
  const auth = useEffectiveAuth();
  const location = useLocation();

  if (auth.loading) return null;

  if (!auth.isAuthed) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}
