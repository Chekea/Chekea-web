// src/utils/media.js
const FALLBACK_IMG = "https://via.placeholder.com/600?text=Chekea";
const DEFAULT_BUCKET = "chekeaapp-f5abe.appspot.com";

/**
 * Construye URL pública de Firebase Storage (funciona si el objeto es público).
 * Si tu bucket requiere token, guarda URLs completas en Firestore en media.cover.urls.*
 */
export function publicStorageUrl(path, bucket = DEFAULT_BUCKET) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const encoded = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encoded}?alt=media`;
}

/** Save-Data del navegador (Chrome/Android principalmente) */
export function isSaveDataOn() {
  try {
    return !!navigator?.connection?.saveData;
  } catch {
    return false;
  }
}

/**
 * ✅ Devuelve variantes cover como URL lista para usar:
 * Prioridad:
 * 1) media.cover.urls.* (URL completa, recomendado)
 * 2) media.cover.variants.* (path -> publicStorageUrl)
 * 3) Imagen legacy
 */
export function getCoverUrls(product, { bucket } = {}) {
  const variants = product?.media?.cover?.variants || {};
  const urls = product?.media?.cover?.urls || {};
  const raw = product?.Imagen || product?.image || null;

  const out = {
    thumb: urls.thumb || publicStorageUrl(variants.thumb, bucket),
    card: urls.card || publicStorageUrl(variants.card, bucket),
    detail: urls.detail || publicStorageUrl(variants.detail, bucket),
    original: raw,
  };

  // limpia nulls (pero deja original)
  return out;
}

/**
 * Decide qué cover usar (para Card/Listado o PDP).
 * prefer: "thumb" | "card" | "detail"
 */
export function pickCoverUrl(product, { prefer = "card", bucket } = {}) {
  const u = getCoverUrls(product, { bucket });
  if (prefer === "thumb") return u.thumb || u.card || u.detail || u.original || FALLBACK_IMG;
  if (prefer === "detail") return u.detail || u.card || u.thumb || u.original || FALLBACK_IMG;
  return u.card || u.thumb || u.detail || u.original || FALLBACK_IMG;
}

/** Construye srcSet para cover (360/640/1024) */
export function buildCoverSrcSet(product, { bucket } = {}) {
  const u = getCoverUrls(product, { bucket });
  const parts = [];
  if (u.thumb) parts.push(`${u.thumb} 360w`);
  if (u.card) parts.push(`${u.card} 640w`);
  if (u.detail) parts.push(`${u.detail} 1024w`);
  return parts.join(", ");
}

/**
 * ✅ Para docs de subcolección "imagenes":
 * Prioridad:
 * 1) media.urls.* (si lo añades)
 * 2) media.variants.* (path -> publicStorageUrl)
 * 3) Imagen original con token (legacy)
 */
export function getGalleryUrls(imgDoc, { bucket } = {}) {
  const variants = imgDoc?.media?.variants || {};
  const urls = imgDoc?.media?.urls || {};
  const original =
    imgDoc?.Imagen ||
    imgDoc?.Image ||
    imgDoc?.URL ||
    imgDoc?.url ||
    imgDoc?.image ||
    null;

  return {
    thumb: urls.thumb || publicStorageUrl(variants.thumb, bucket),
    detail: urls.detail || publicStorageUrl(variants.detail, bucket),
    original,
  };
}

/** Build srcSet para una imagen de galería (360/1024) */
export function buildGallerySrcSet(imgDoc, { bucket } = {}) {
  const u = getGalleryUrls(imgDoc, { bucket });
  const parts = [];
  if (u.thumb) parts.push(`${u.thumb} 360w`);
  if (u.detail) parts.push(`${u.detail} 1024w`);
  return parts.join(", ");
}