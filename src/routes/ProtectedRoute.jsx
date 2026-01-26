import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

export default function ProtectedRoute({ children }) {
  const auth = useAuth();
  const location = useLocation();

  // si tu auth tiene loading inicial, evitamos redirecciones raras
  if (auth.loading) return null;
  

  if (!auth.isAuthed) {
    // guardamos la ruta para volver luego
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}
