import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { BrowserRouter } from "react-router-dom";

import "./index.css";
import "./i18n/i18n";
import { theme } from "./theme/theme";
import AppRouter from "./routes/AppRouter";

// 🔥 Estado inyectado desde React Native
const initialRNState = window.__RN_STATE__ || null;



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
