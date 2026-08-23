// src/services/feedCache.js
// -----------------------------------------------------------------------------
// Caché en memoria muy simple, con expiración (TTL).
//
// Vive mientras la app esté abierta (sobrevive a cambiar de pantalla y volver,
// que es justo cuando React desmonta y remonta un componente). Así la portada
// no vuelve a descargar de Firestore lo que ya tenía: menos lecturas (coste),
// sin spinner al volver y mejor sensación en redes malas.
//
// No usa localStorage a propósito (evita el problema de cuota que ya tuvimos y
// no deja datos viejos tras cerrar la app). Para persistencia real entre
// recargas está la caché offline de Firestore (opcional, VITE_ENABLE_OFFLINE).
// -----------------------------------------------------------------------------

const store = new Map(); // clave -> { data, ts }

// 5 minutos por defecto: si el usuario vuelve antes, se usa la caché tal cual.
const DEFAULT_TTL = 5 * 60 * 1000;

export function readCache(key, maxAgeMs = DEFAULT_TTL) {
  const entry = store.get(key);
  if (!entry) return null;
  if (maxAgeMs > 0 && Date.now() - entry.ts > maxAgeMs) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function writeCache(key, data) {
  store.set(key, { data, ts: Date.now() });
}

// Útil para forzar recarga (p. ej. un "tirar para refrescar" en el futuro).
export function clearCache(key) {
  if (key) store.delete(key);
  else store.clear();
}
