// src/services/compras.service.js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  writeBatch,
  
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";

const BUYERS_COL = "compradores";
const USER_PURCHASES_SUBCOL = "miscompras";
const GLOBAL_PURCHASES_COL = "compras";

// ---------- helpers ----------
function userPurchasesColRef(userId) {
  if (!userId) throw new Error("userId requerido");
  return collection(db, BUYERS_COL, userId, USER_PURCHASES_SUBCOL);
}

function userPurchaseDocRef(userId, compraId) {
  if (!userId) throw new Error("userId requerido");
  if (!compraId) throw new Error("compraId requerido");
  return doc(db, BUYERS_COL, userId, USER_PURCHASES_SUBCOL, compraId);
}

function globalPurchaseDocRef(compraId) {
  if (!compraId) throw new Error("compraId requerido");
  return doc(db, GLOBAL_PURCHASES_COL, compraId);
}

function mapDoc(d) {
  return { id: d.id, ...d.data() };
}

export const getCurrentTimestamp = () => Date.now();

/* =========================================================
   ✅ NUEVO FLUJO: RESERVA 48H (sin imagen)
   - Guarda 1 doc por pedido en:
     compradores/{userId}/miscompras/{compraId}
     compras/{compraId}
   - Estado: "PendientePago"
   - ExpiresAt: ms (Date.now + 48h)
========================================================= */

function computeExpiresAtMs(hours = 48) {
  return Date.now() + hours * 60 * 60 * 1000;
}

function isExpiredMs(expiresAtMs) {
  return Number(expiresAtMs) > 0 && Date.now() > Number(expiresAtMs);
}




export async function createReservaDualFS({
  userId,
  compraId,
  compraData,
  userInfo,
  descuento = 0,
  total = 0,
  envio = 0,
  expiresInHours = 48,
}) {
  if (!userId) throw new Error("userId requerido");
  if (!compraId) throw new Error("compraId requerido");

  const nombre = String(userInfo?.nombre ?? "").trim();
  const contacto = String(userInfo?.contacto ?? "").trim();
  if (nombre.length < 3) throw new Error("Nombre inválido");
  if (contacto.length < 6) throw new Error("Teléfono inválido");

  const itemsArr = Array.isArray(compraData) ? compraData.filter(Boolean) : [];
  if (!itemsArr.length) throw new Error("compraData vacía");

  const idCompra = Number(compraId);
  const Estado = "PendientePago";

  const globalRef = doc(db, GLOBAL_PURCHASES_COL, String(idCompra));
  const userItemsCol = collection(db, BUYERS_COL, String(userId), USER_PURCHASES_SUBCOL);

  const batch = writeBatch(db);
  const productosIds = [];

  // 1) Guardar items en el usuario con autoId
  for (const it of itemsArr) {
    const itemRef = doc(userItemsCol); // genera autoId
    productosIds.push(itemRef.id);

    const { id, ...rest } = it || {};

    batch.set(itemRef, {
      ...rest,
      Estado,
      compraId: idCompra,          // ✅ clave
  
    });
  }

  // 2) Guardar cabecera global con punteros (Productos)
  batch.set(globalRef, {
    id: idCompra,
    Fecha: idCompra,

    Usuario: userId,
    Estado,

    nombre,
    contacto,

    Descuento: Number(descuento || 0),
    Total: Number(total || 0),
    Envio: Number(envio || 0),

    ExpiresAt: Date.now() + expiresInHours * 3600 * 1000,

    Productos: productosIds, // ✅ array de autoIds
  });

  await batch.commit();

  return { success: true, compraId: idCompra, productosIds };
}

export async function getReservaGlobalFS({ compraId }) {
  if (!compraId) throw new Error("compraId requerido");
  const ref = doc(db, GLOBAL_PURCHASES_COL, String(compraId));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function expireReservaDualFS({ userId, compraId, reason = "Tiempo 48h sin pago" }) {
  if (!userId) throw new Error("userId requerido");
  if (!compraId) throw new Error("compraId requerido");

  const globalRef = doc(db, GLOBAL_PURCHASES_COL, String(compraId));
  const userRef = doc(db, BUYERS_COL, String(userId), USER_PURCHASES_SUBCOL, String(compraId));

  const snap = await getDoc(globalRef);
  if (!snap.exists()) return false;

  const data = snap.data();
  if (data?.Estado !== "PendientePago") return false;
  if (!isExpiredMs(data?.ExpiresAt)) return false;

  const patch = {
    Estado: "Expirada",
    ExpiredAt: serverTimestamp(),
    ExpireReason: reason,
    updatedAt: getCurrentTimestamp(),
  };

  await Promise.all([updateDoc(globalRef, patch), updateDoc(userRef, patch)]);
  return true;
}

/* =========================================================
   (Tu flujo viejo con imagen) — se mantiene intacto
========================================================= */

export async function createCompraDualFS({
  userId,
  compraId,
  compraData,
  userInfo,
  img,
  descuento,
  total,
  envio,
}) {
  if (!userId) throw new Error("userId requerido");
  if (!img) throw new Error("img requerido"); // 👈 viejo flujo (lo dejamos)

  if (!compraData || typeof compraData !== "object") throw new Error("compraData requerida");
  if (!userInfo || typeof userInfo !== "object") throw new Error("userInfo requerida");

  const globalPurchaseDocRef = (id) => doc(db, GLOBAL_PURCHASES_COL, String(id));
  const userServiceDocRef = (uid, sid) =>
    doc(db, BUYERS_COL, String(uid), USER_PURCHASES_SUBCOL, String(sid));

  try {
    const idCompra = compraId;
    const estado = "Verificando";

    const serviciosArr = Array.isArray(compraData) ? compraData : [];

    const serviciosPromises = serviciosArr.map(async (item) => {
      const idServicio = getCurrentTimestamp();
      const { id, ...itemSinId } = item || {};

      const servicioCompleto = {
        ...itemSinId,
        Codigo: Number(idCompra),
        Fecha: Number(idCompra),
        Usuario: userId,
        Estado: estado,
      };

      await setDoc(userServiceDocRef(userId, idServicio), servicioCompleto, { merge: false });
      return idServicio;
    });

    const idsCreados = await Promise.all(serviciosPromises);

    const globalRef = globalPurchaseDocRef(idCompra);

    const compraCompleta = {
      ...userInfo,
      id: Number(idCompra),
      Fecha: Number(idCompra),
      img: img,
      Servicios: idsCreados,
      Estado: estado,
      Usuario: userId,
      Descuento: descuento,
      Total: total,
      Envio: envio,
    };

    await setDoc(globalRef, compraCompleta, { merge: false });

    return { success: true, compraId: idCompra, serviciosIds: idsCreados };
  } catch (error) {
    console.error("Error al subir compra (createCompraDualFS):", error);
    throw error;
  }
}

/**
 * ✅ Listar MISCOMPRAS del usuario con paginación (Fecha desc)
 */
export async function getMisComprasPageFS({ userId, pageSize = 12, lastDoc = null }) {
  const colRef = userPurchasesColRef(userId);

  const constraints = [orderBy("Fecha", "desc")];
  if (lastDoc) constraints.push(startAfter(lastDoc));
  constraints.push(limit(pageSize + 1));

  const qy = query(colRef, ...constraints);
  const snap = await getDocs(qy);

  const docs = snap.docs;
  const hasNext = docs.length > pageSize;

  const slice = docs.slice(0, pageSize);
  const items = slice.map(mapDoc);
  const nextLastDoc = slice.length ? slice[slice.length - 1] : lastDoc;

  return { items, hasNext, lastDoc: nextLastDoc };
}

/**
 * ✅ Obtener compra global (detalle)
 */
export async function getCompraGlobalFS({ compraId }) {
  const ref = globalPurchaseDocRef(compraId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapDoc(snap);
}

/**
 * ✅ Actualizar compra en ambos docs (sin borrar nunca)
 */
export async function updateCompraDualFS({ userId, compraId, patchGlobal = {}, patchUser = {} }) {
  const now = getCurrentTimestamp();

  const globalRef = globalPurchaseDocRef(compraId);
  const userRef = userPurchaseDocRef(userId, compraId);

  await updateDoc(globalRef, { ...patchGlobal, updatedAt: now });
  await updateDoc(userRef, { ...patchUser, updatedAt: now });

  return true;
}

/**
 * ✅ Cancelar / anular compra (NO se borra)
 */
export async function cancelCompraDualFS({ userId, compraId, reason = null }) {
  const now = getCurrentTimestamp();

  const globalRef = globalPurchaseDocRef(compraId);
  const userRef = userPurchaseDocRef(userId, compraId);

  const patchGlobal = {
    status: "cancelada",
    cancelledAt: now,
    cancelReason: reason,
    updatedAt: now,
  };

  const patchUser = {
    status: "cancelada",
    cancelledAt: now,
    updatedAt: now,
  };

  await updateDoc(globalRef, patchGlobal);
  await updateDoc(userRef, patchUser);

  return true;
}

export async function getCompraById(compradorId, compraId) {
  const ref = doc(db, BUYERS_COL, compradorId, USER_PURCHASES_SUBCOL, compraId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function checkCompras({ userId }) {
  if (!userId) return false;

  try {
    const comprasRef = collection(db, BUYERS_COL, userId, USER_PURCHASES_SUBCOL);
    const q = query(comprasRef, limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (error) {
    console.error("Error verificando miscompras:", error);
    return false;
  }
}