// Firebase core
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// Firestore
import { getFirestore } from "firebase/firestore";

// Auth
import { getAuth } from "firebase/auth";

// Storage
import { getStorage } from "firebase/storage";

// Configuración Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_DATABASEURL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:import.meta.env.VITE_MEASUREMENT_ID
};

// Inicializar app
const app = initializeApp(firebaseConfig);

// Servicios
const analytics = getAnalytics(app);
const db = getFirestore(app);     // 🔥 Firestore
const auth = getAuth(app);        // 🔐 Auth
const storage = getStorage(app);  // 📦 Storage

// Exportar
export {
  app,
  analytics,
  db,
  auth,
  storage
};
