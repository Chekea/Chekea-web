// src/services/auth.service.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  getRedirectResult,
  signInWithRedirect,
} from "firebase/auth";

import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../config/firebase";

function mapFirebaseUser(u) {
  if (!u) return null;
  return {
    id: u.uid,
    uid: u.uid,
    email: u.email ?? "",
    name: u.displayName ?? "",
    photoURL: u.photoURL ?? "",
    phoneNumber: u.phoneNumber ?? "",
  };
}

function mapAuthError(e) {
  const code = e?.code || "";

  // Email/password
  if (code === "auth/invalid-email") return "Email inválido.";
  if (code === "auth/user-not-found") return "Usuario no encontrado.";
  if (code === "auth/wrong-password") return "Contraseña incorrecta.";
  if (code === "auth/email-already-in-use") return "Este email ya está registrado.";
  if (code === "auth/weak-password") return "Contraseña débil (mínimo 6 caracteres).";
  if (code === "auth/too-many-requests") return "Demasiados intentos. Intenta más tarde.";

  // Google popup (mejor UX)
  if (code === "auth/popup-closed-by-user") return "Cerraste la ventana de Google. Intenta de nuevo.";
  if (code === "auth/cancelled-popup-request") return "Solicitud cancelada. Intenta de nuevo.";
  if (code === "auth/popup-blocked") return "El navegador bloqueó el popup. Permítelo e intenta de nuevo.";
  if (code === "auth/unauthorized-domain") return "Dominio no autorizado en Firebase (Authorized domains).";

  return "Error de autenticación. Intenta de nuevo.";
}

export const authService = {
  mapFirebaseUser,
  mapAuthError,

  async loginEmailPassword(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return mapFirebaseUser(cred.user);
  },

  async registerEmailPassword({ name, email, password }) {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

    if (name?.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
    }

    // ✅ NEGOCIO ACTUAL (NO CAMBIADO): solo registrando por email/password se crea en Firestore
    await setDoc(doc(db, "compradores", cred.user.uid), {
      uid: cred.user.uid,
      Email: cred.user.email ?? "",
      Nombre: name?.trim() ?? "",
      Img: cred.user.photoURL ?? "",
      Contacto: cred.user.phoneNumber ?? "",
      createdAt: serverTimestamp(),
    });

    return mapFirebaseUser(auth.currentUser);
  },


  
async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      // En móvil NO devuelve user aquí; redirige
      await signInWithRedirect(auth, provider);
      return null;
    }

    const cred = await signInWithPopup(auth, provider);
    return mapFirebaseUser(cred.user);
  },

  // ✅ NUEVO: completar el login después del redirect (llamar al cargar la app)
  async completeGoogleRedirect() {
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    return mapFirebaseUser(result.user);
  },
  async logout() {
    await signOut(auth);
  },

  onAuthStateChanged(cb) {
    return onAuthStateChanged(auth, (u) => cb(mapFirebaseUser(u)));
  },
};