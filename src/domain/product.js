// src/domain/product.js
// -----------------------------------------------------------------------------
// FUENTE ÚNICA DE VERDAD del "Producto" en Chekea.
//
// Problema que resuelve: en Firestore conviven productos con distintos esquemas
// (unos con Titulo/Precio en mayúscula, otros con nombre/precio en minúscula, y
// la imagen a veces plana y a veces anidada en media.cover). Antes cada pantalla
// normalizaba a su manera, lo que causaba bugs (productos que no aparecían o sin
// imagen, o sin poder contactar al vendedor).
//
// A partir de aquí, TODA la app entiende el producto a través de `toProduct`.
// -----------------------------------------------------------------------------

import { CHEKEA, normalizePhone } from "../config/chekea";

// Ciudades donde opera Chekea (para el alta de mercancía y filtros).
export const CIUDADES = ["Malabo", "Bata", "Ebibeyin", "Mongomo", "Luba", "Riaba"];

// Convierte un precio en cualquier formato ("50.000", "50000 FCFA", 50000) a número.
export function toPrecio(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Extrae la URL de imagen probando todas las formas posibles (plana o anidada).
export function imagenDe(p = {}) {
  return (
    p.image ??
    p.imagen ??
    p.thumbnail ??
    p.photo ??
    p.foto ??
    p.images?.[0] ??
    p.Imagen ??
    p.media?.cover?.urls?.card ??
    p.media?.cover?.variants?.card ??
    p.media?.cover?.url ??
    p.cover?.variants?.card ??
    ""
  );
}

// WhatsApp del vendedor a partir de las variantes de campo que pueda traer.
export function whatsappDe(p = {}) {
  return normalizePhone(
    p.Whatsapp ??
      p.whatsapp ??
      p.WhatsApp ??
      p.vendedorWhatsapp ??
      p.Telefono ??
      p.telefono ??
      p.Contacto ??
      p.contacto ??
      ""
  );
}

// Normaliza CUALQUIER documento de Firestore a un Producto canónico.
export function toProduct(raw = {}) {
  return {
    id: raw.id ?? raw._id ?? raw.docId ?? raw.Codigo ?? raw.codigo ?? "",
    titulo: raw.Titulo ?? raw.titulo ?? raw.title ?? raw.nombre ?? raw.Nombre ?? "Producto",
    precio: toPrecio(raw.Precio ?? raw.precio ?? raw.price ?? raw.priceValue),
    categoria: raw.Categoria ?? raw.categoria ?? raw.category ?? "",
    ciudad: raw.Ciudad ?? raw.ciudad ?? raw.Pais ?? raw.country ?? "",
    imagen: imagenDe(raw),
    vendedorId: raw.vendedorId ?? raw.sellerId ?? null,
    whatsapp: whatsappDe(raw),
    visible: raw.visible !== false,
    estado: raw.estado ?? "",
    // Conservamos el documento original por si alguna pantalla necesita un campo suelto.
    _raw: raw,
  };
}

// Número al que debe escribir el comprador: el del vendedor o, si no hay, el central.
export function sellerWhatsappOf(productOrRaw = {}) {
  const wa = productOrRaw?.whatsapp ?? whatsappDe(productOrRaw);
  return wa || normalizePhone(CHEKEA.whatsapp);
}

// Construye los campos que un producto necesita para APARECER en el escaparate.
// Se usa al crear mercancía para que el flujo vendedor -> escaparate funcione.
export function storefrontFields({ titulo, precio, categoria, ciudad, imagen }) {
  return {
    Titulo: titulo || "Producto",
    Precio: toPrecio(precio),
    Categoria: categoria || null,
    Ciudad: ciudad || "",
    Pais: "Guinea Ecuatorial",
    Imagen: imagen || "",
    visible: true,
  };
}
