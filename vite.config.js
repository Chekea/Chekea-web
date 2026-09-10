import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),

    // --- Service Worker (caché avanzada) ---
    // Precarga la "cáscara" de la app (JS/CSS/HTML) en el dispositivo: tras la
    // primera visita, las siguientes aperturas cargan casi al instante e incluso
    // sin conexión. Además guarda las imágenes de productos para no re-descargarlas.
    // (En Android WebView funciona; en iOS los Service Workers no están soportados,
    //  ahí la velocidad la dan la caché de datos y las cabeceras HTTP.)
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["chekealogo.png", "favicon.png"],
      manifest: {
        name: "Chekea",
        short_name: "Chekea",
        description: "CRECEMOS JUNTOS ",
        theme_color: "#0A0A0A",
        background_color: "#0A0A0A",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/chekealogo.png", sizes: "192x192", type: "image/png" },
          { src: "/chekealogo.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,woff}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "/index.html",
        // No interceptar las llamadas a las APIs de Firebase con el fallback.
        navigateFallbackDenylist: [/^\/__/, /googleapis\.com/, /firebaseio\.com/],
        runtimeCaching: [
          {
            // Imágenes de productos (Firebase Storage): guardarlas y reusarlas.
            urlPattern: ({ url }) =>
              url.href.includes("firebasestorage.googleapis.com") ||
              url.href.includes("firebasestorage.app") ||
              /\.(?:png|jpg|jpeg|webp|gif|avif)$/i.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "chekea-images",
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],

  build: {
    target: "es2020",
    sourcemap: false,
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Separar librerías grandes: descarga en paralelo + mejor caché.
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