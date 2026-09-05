


// nuevo
// -----------------------------------------------------------------------------
// CHEKEA — configuración de negocio y contacto por WhatsApp.
//
// Modelo de negocio: Chekea es logística + escaparate. NO hay carrito, ni
// checkout, ni favoritos, ni pago en la app. Cuando el comprador toca un
// producto, se abre WhatsApp directamente para hablar con el vendedor (o con
// Chekea) y cerrar la compra por fuera.
// -----------------------------------------------------------------------------


import { logContact } from "../services/contactlog";
export const CHEKEA = {
  // Número central de Chekea para wa.me. DEBE llevar el código de país SIN el "+".
  // Guinea Ecuatorial es 240 (ej.: 240222237169). Cámbialo por el número real.
  // Se usa cuando el producto no trae el WhatsApp del vendedor.
  whatsapp: "240222237169",
  currency: "FCFA",
  // Web pública de Chekea (para incluir el enlace del producto en el mensaje).
  site: "https://www.chekeaa.com",
};

// Deja solo dígitos (wa.me no admite símbolos).
export function normalizePhone(raw) {
  return String(raw || "").replace(/\D/g, "");
}

// Elige el número: el del vendedor si el producto lo trae; si no, el de Chekea.
function pickPhone(product) {
  const seller = normalizePhone(
    product?.Whatsapp ??
      product?.whatsapp ??
      product?.WhatsApp ??
      product?.Telefono ??
      product?.telefono ??
      product?.Contacto ??
      product?.contacto ??
      ""
  );
  return seller || normalizePhone(CHEKEA.whatsapp);
}

// Enlace del producto: abre la web de Chekea buscando ese producto por su
// referencia (o por su nombre). Como no hay página individual de producto,
// este enlace lleva al escaparate y lo localiza.
export function buildProductUrl(product) {
  const codigo = product?.Codigo ?? product?.docId ?? product?.id ?? "";
  const titulo = product?.Titulo ?? product?.title ?? "";
  const q = String(codigo || titulo || "").trim();
  return q ? `${CHEKEA.site}/search?q=${encodeURIComponent(q)}` : CHEKEA.site;
}

// Construye el mensaje precargado con los datos del producto.
export function buildProductMessage(product) {
  const titulo = product?.Titulo ?? product?.title ?? "un producto";
  const codigo = product?.Codigo ?? product?.docId ?? product?.id ?? "";
  const precio = Number(product?.Precio ?? product?.price ?? 0) || 0;
  const lugar = product?.Ciudad ?? product?.ciudad ?? product?.Pais ?? product?.country ?? "";

  let msg = `Hola, me interesa este producto de Chekea: ${titulo}`;
  if (precio > 0) msg += ` (${new Intl.NumberFormat("es-ES").format(precio)} ${CHEKEA.currency})`;
  if (codigo) msg += ` [ref ${codigo}]`;
  if (lugar) msg += ` — ${lugar}`;
  msg += ". ¿Sigue disponible?";
  msg += `\n${buildProductUrl(product)}`;
  return msg;
}

// URL de WhatsApp lista para abrir.
export function buildProductWhatsAppUrl(product) {
  const phone = pickPhone(product);
  const text = encodeURIComponent(buildProductMessage(product));
  return `https://wa.me/${phone}?text=${text}`;
}

// Deduce el tipo de contacto a partir del mensaje (para las estadísticas).
function inferTipo(message = "") {
  const m = String(message).toLowerCase();
  if (m.includes("mudanza") || m.includes("transporte")) return "mudanza";
  if (m.includes("china")) return "china";
  if (m.includes("paquete") || m.includes("envío") || m.includes("envio")) return "envio";
  if (m.includes("ayuda") || m.includes("soporte") || m.includes("información")) return "soporte";
  return "otro";
}

// Abre WhatsApp para contactar por un producto (comportamiento "app nativa").
export function openProductWhatsApp(product) {
  const url = buildProductWhatsAppUrl(product);
  // Registrar el contacto (en segundo plano, no bloquea la apertura).
  logContact({
    tipo: "producto",
    vendedorId: product?.Vendedor ?? product?.sellerId ?? null,
    productoId: product?.Codigo ?? product?.docId ?? null,
    titulo: product?.Titulo ?? product?.title ?? null,
    ciudad: product?.Ciudad ?? product?.ciudad ?? null,
  });
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// WhatsApp general de Chekea (soporte, encargos, logística).
export function openChekeaWhatsApp(message = "Hola, quiero información sobre Chekea.") {
  const phone = normalizePhone(CHEKEA.whatsapp);
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  // Registrar el contacto (en segundo plano, no bloquea la apertura).
  logContact({ tipo: inferTipo(message) });
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}