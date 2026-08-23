import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { BrowserRouter } from "react-router-dom";

import "./index.css";
import "./i18n/i18n";
import { theme } from "./theme/theme";
import AppRouter from "./routes/AppRouter";

// 🔥 Estado inyectado desde React Native (WebView)
const initialRNState = window.__RN_STATE__ || null;

try {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AppRouter initialRNState={initialRNState} />
        </BrowserRouter>
      </ThemeProvider>
    </React.StrictMode>
  );
  // Avisa al autodiagnóstico del index.html de que la app montó bien.
  window.__CHEKEA_MOUNTED__ = true;
} catch (err) {
  // Si el arranque falla, mostrarlo en pantalla en vez de dejar la carga muda.
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML =
      '<div style="min-height:100vh;display:flex;align-items:center;' +
      'justify-content:center;padding:24px;font-family:system-ui,sans-serif;' +
      'color:#0A0A0A;text-align:center">No se pudo iniciar la app.<br>' +
      "Revisa la consola.</div>";
  }
  throw err;
}
