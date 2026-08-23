// -----------------------------------------------------------------------------
// FIREBASE — inicialización única de la app.
//
// IMPORTANTE (lección aprendida):
//   Forzar la caché offline persistente rompía la carga de productos en algunos
//   entornos (WebView / IndexedDB), porque la persistencia falla de forma
//   asíncrona y Firestore acababa devolviendo una caché vacía. Por eso, por
//   defecto usamos Firestore normal (getFirestore), que es el comportamiento que
//   ya funcionaba.
//
//   La caché offline (útil para red mala) queda como OPCIÓN activable: pon
//   VITE_ENABLE_OFFLINE=1 en tu .env para probarla. Si tu entorno la soporta,
//   la app funcionará sin conexión; si algo falla, cae sola a Firestore normal.
//
//   Analytics se carga de forma diferida y comprobando soporte, para que nunca
//   rompa el arranque dentro de un WebView.
// -----------------------------------------------------------------------------

import { initializeApp } from "firebase/app";

import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Configuración Firebase (las claves viven en .env; ver .env.example)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_DATABASEURL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID,
};

if (import.meta.env.DEV && !firebaseConfig.apiKey) {
  console.warn(
    "[Chekea] Falta la configuración de Firebase. Crea un archivo .env con tus " +
      "claves (ver .env.example) y reinicia el servidor."
  );
}

// Inicializar app
const app = initializeApp(firebaseConfig);

// --- Firestore ---
// Por defecto: comportamiento normal (el que ya funcionaba).
// Opcional: caché offline si activas VITE_ENABLE_OFFLINE=1 (con fallback seguro).
let db;
const OFFLINE = String(import.meta.env.VITE_ENABLE_OFFLINE || "") === "1";
if (OFFLINE) {
  try {
    db = initializeFirestore(app, {
      // Caché en disco (IndexedDB), modo de una sola pestaña (más estable en WebView).
      localCache: persistentLocalCache(/* single-tab por defecto */),
    });
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[Chekea] Sin caché offline, uso normal:", e);
    db = getFirestore(app);
  }
} else {
  db = getFirestore(app);
}

// --- Auth ---
// getAuth incluye el resolver de popup/redirect (necesario para el login de
// Google) y ya persiste la sesión localmente. No lo cambiamos.
const auth = getAuth(app);

// --- Storage ---
const storage = getStorage(app);

// --- Analytics: carga diferida y SEGURA (nunca bloquea el arranque) ---
let analytics = null;
if (typeof window !== "undefined" && firebaseConfig.measurementId) {
  import("firebase/analytics")
    .then(({ getAnalytics, isSupported }) =>
      isSupported().then((ok) => {
        if (ok) analytics = getAnalytics(app);
      })
    )
    .catch(() => {
      /* Analytics no disponible (p. ej. en WebView): se ignora. */
    });
}

export { app, analytics, db, auth, storage };
