import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useEffectiveAuth } from "../state/useEffectiveAuth";

// Loader ligero (sin dependencias pesadas) para no parpadear a blanco mientras
// se resuelve el estado de sesión. Da sensación de app nativa.
function MiniLoader() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          border: "3px solid rgba(0,0,0,.15)",
          borderTopColor: "#0A0A0A",
          borderRadius: "50%",
          display: "inline-block",
          animation: "chk-spin .8s linear infinite",
        }}
      />
      <style>{"@keyframes chk-spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

export default function ProtectedRoute({ children }) {
  const auth = useEffectiveAuth();
  const location = useLocation();

  if (auth.loading) return <MiniLoader />;

  if (!auth.isAuthed) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}
