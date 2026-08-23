import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    // Compatibilidad con WebViews de dispositivos de gama media/baja.
    target: "es2019",
    // Menos peso en producción.
    sourcemap: false,
    // Avisa si algún chunk se pasa de tamaño (útil para vigilar el peso en red mala).
    chunkSizeWarningLimit: 900,
  },

  server: {
    // Permite abrir la app desde un teléfono en la misma red Wi-Fi
    // (aparece una URL "Network" al ejecutar npm run dev).
    host: true,
  },

  preview: {
    host: true,
  },
});
