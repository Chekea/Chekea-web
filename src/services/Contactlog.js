// src/services/contactLog.js
// -----------------------------------------------------------------------------
// Registra la actividad de contacto por WhatsApp, de forma ASÍNCRONA y segura.
//
// Dos comportamientos según lo que se toca:
//
//  1) PRODUCTOS: cada clic suma un "visto" DENTRO del propio producto:
//        productos/{idProducto}  ->  { Vistos: +1 }
//     Así luego se pueden devolver/ordenar los productos por popularidad
//     (los más vistos primero). Como el producto ya lleva su vendedorId,
//     los vistos quedan asociados a ese vendedor.
//
//  2) SERVICIOS (envio, mudanza, china, soporte): contador por servicio y día:
//        stats/{servicio}_{YYYY-MM-DD}  ->  { servicio, dia, clicks: +1 }
//
// Claves del diseño:
//  - Carga Firebase de forma diferida (no afecta a la velocidad de arranque).
//  - NUNCA bloquea ni retrasa la apertura de WhatsApp (corre en segundo plano).
//  - Suma atómica (increment): aunque varios pulsen a la vez, cuenta bien.
//  - A prueba de fallos: si algo va mal, se ignora en silencio.
// -----------------------------------------------------------------------------

// Fecha local en formato YYYY-MM-DD (día del cliente).
function diaHoy() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// Se llama SIN await desde quien abre WhatsApp.
export function logContact(data = {}) {
  const servicio = data.tipo || "otro"; // producto | envio | mudanza | china | soporte | otro
  (async () => {
    try {
      const { db } = await import("../config/firebase");
      const { doc, setDoc, increment, serverTimestamp } = await import("firebase/firestore");

      // 1) PRODUCTOS -> suma un "visto" al producto (para ordenar por popularidad).
      if (servicio === "producto") {
        if (!data.productoId) return; // sin id real no tocamos nada
        const pref = doc(db, "productos", String(data.productoId));
        await setDoc(pref, { Vistos: increment(1) }, { merge: true });
        return;
      }

      // 2) SERVICIOS -> contador por servicio y día.
      const dia = diaHoy();
      const ref = doc(db, "stats", `${servicio}_${dia}`);
      await setDoc(
        ref,
        { servicio, dia, clicks: increment(1), fecha: serverTimestamp() },
        { merge: true }
      );
      console.log('exito',        { servicio, dia, clicks: increment(1), fecha: serverTimestamp() },
)
    } catch (e) {
      // Silencioso a propósito: contar nunca debe afectar al usuario.
    }
  })();
}