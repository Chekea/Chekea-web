import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    // WebViews modernos (Expo 57 / iOS/Android actuales): menos transpilación = paquete más ligero.
    target: "es2020",
    sourcemap: false,
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 900,

    rollupOptions: {
      output: {
        // Separar las librerías grandes en bloques propios. Beneficios:
        //  - Se descargan EN PARALELO (más rápido en el primer arranque).
        //  - Se cachean aparte: al actualizar tu código, el usuario NO vuelve a
        //    descargar React/MUI/Firebase (aperturas siguientes casi instantáneas).
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("firebase") || id.includes("@firebase")) return "firebase";
          if (id.includes("@mui") || id.includes("@emotion")) return "mui";
          if (id.includes("react-router")) return "router";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("scheduler")
          )
            return "react";
          if (id.includes("i18next") || id.includes("react-i18next")) return "i18n";
          return "vendor";
        },
      },
    },
  },

  server: { host: true },
  preview: { host: true },
});