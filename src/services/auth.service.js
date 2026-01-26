// src/services/auth.service.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from "firebase/auth";

import { auth } from  "../config/firebase"; // asegúrate de exportar auth desde tu firebase.js

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
  if (code === "auth/invalid-email") return "Email inválido.";
  if (code === "auth/user-not-found") return "Usuario no encontrado.";
  if (code === "auth/wrong-password") return "Contraseña incorrecta.";
  if (code === "auth/email-already-in-use") return "Este email ya está registrado.";
  if (code === "auth/weak-password") return "Contraseña débil (mínimo 6 caracteres).";
  if (code === "auth/too-many-requests") return "Demasiados intentos. Intenta más tarde.";
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
    // refresca user con displayName actualizado
    return mapFirebaseUser(auth.currentUser);
  },

  async logout() {
    await signOut(auth);
  },

  onAuthStateChanged(cb) {
    // cb recibe user mapeado (o null)
    return onAuthStateChanged(auth, (u) => cb(mapFirebaseUser(u)));
  },
};
