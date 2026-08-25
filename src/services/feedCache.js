// src/services/feedCache.js
// -----------------------------------------------------------------------------
// Caché de datos en DOS niveles:
//   1) Memoria  -> instantánea mientras la app está abierta (navegar y volver).
//   2) Disco (localStorage) -> SOBREVIVE a cerrar y reabrir la app, para que la
//      portada muestre productos al instante sin volver a descargar.
//
// Seguridad: solo se guardan DATOS DE TEXTO pequeños (nombre, precio, categoría,
// y la URL de la imagen). Nunca imágenes en sí. Además se limita el tamaño y
// todo va en try/catch, así que nunca puede "llenar" el almacenamiento ni romper
// la app (el problema que tuvimos con las fotos en base64 no puede repetirse).
// -----------------------------------------------------------------------------

const store = new Map(); // clave -> { data, ts }

const LS_PREFIX = "chk_cache:";
const LS_MAX_BYTES = 400 * 1024; // no persistir payloads grandes (por seguridad)

// Niveles de frescura sugeridos (los usa la portada):
export const FRESH_MS = 5 * 60 * 1000; // < 5 min: no hace falta refrescar
export const DAY_MS = 24 * 60 * 60 * 1000; // hasta 24 h: sirve para mostrar al instante

function lsRead(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function lsWrite(key, entry) {
  try {
    const s = JSON.stringify(entry);
    if (s.length > LS_MAX_BYTES) return; // demasiado grande -> no persistimos
    localStorage.setItem(LS_PREFIX + key, s);
  } catch {
    /* almacenamiento lleno o no disponible: se ignora, no rompe nada */
  }
}

export function readCache(key, maxAgeMs = FRESH_MS) {
  const entry = store.get(key) || lsRead(key);
  if (!entry) return null;
  if (maxAgeMs > 0 && Date.now() - entry.ts > maxAgeMs) return null;
  if (!store.has(key)) store.set(key, entry); // calienta memoria desde disco
  return entry.data;
}

export function writeCache(key, data) {
  const entry = { data, ts: Date.now() };
  store.set(key, entry);
  lsWrite(key, entry);
}

export function clearCache(key) {
  if (key) {
    store.delete(key);
    try {
      localStorage.removeItem(LS_PREFIX + key);
    } catch {}
  } else {
    store.clear();
  }
}