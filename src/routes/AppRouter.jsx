import React, { useEffect, Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "../state/AuthContext";
import { RNBridgeProvider } from "../state/RNBridgeContext";

import ProtectedRoute from "./ProtectedRoute";
import { installRnBridge } from "../bridge/installRnBridge";

// --- Escaparate (público) ---
import CategoryPage from "../pages/CategoryPage";
import CategoryPageEg from "../pages/new";

// --- Chekea (registro de mercancía) ---
import CrearLoteChekea from "../pages/ChekeaLote";

// Lazy para el resto
const HomePage = lazy(() => import("../pages/Homepage"));
const VerifyUploadPage = lazy(() => import("../pages/Verifyupload"));
const LoginPage = lazy(() => import("../pages/LoginPage"));
const AccountPage = lazy(() => import("../pages/AccountPage"));
const SearchResultsPage = lazy(() => import("../pages/ResultPage"));
const EnviarPaquete = lazy(() => import("../pages/EnviarPaquete"));
const Mudanza = lazy(() => import("../pages/Mudanza"));
const EnvioChina = lazy(() => import("../pages/EnvioChina"));

function AppFallback() {
  return <div style={{ padding: 16 }}>Cargando...</div>;
}

export default function AppRouter({ initialRNState }) {
  // Instala el puente con la app nativa (React Native WebView).
  useEffect(() => {
    const uninstall = installRnBridge();
    return uninstall;
  }, []);

  return (
    <AuthProvider>
      <RNBridgeProvider initialRNState={initialRNState}>
        <Suspense fallback={<AppFallback />}>
          <Routes>
            {/* Escaparate público */}
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchResultsPage />} />
            <Route path="/categoria" element={<CategoryPage />} />
            <Route path="/cate" element={<CategoryPageEg />} />

            {/* Chekea Logistics: envío de paquetes y mudanzas (público) */}
            <Route path="/enviar" element={<EnviarPaquete />} />
            <Route path="/mudanza" element={<Mudanza />} />
            <Route path="/envio-china" element={<EnvioChina />} />

            {/* Registro de mercancía (lote) — requiere sesión */}
            <Route
              path="/lote"
              element={
                <ProtectedRoute>
                  <CrearLoteChekea />
                </ProtectedRoute>
              }
            />

            {/* Verificación de subida */}
            <Route path="/verify/:orderId" element={<VerifyUploadPage />} />

            {/* Cuenta / sesión */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/account" element={<AccountPage />} />

            {/* Cualquier otra ruta vuelve al escaparate */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </RNBridgeProvider>
    </AuthProvider>
  );
}