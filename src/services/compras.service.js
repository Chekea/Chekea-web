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

/**
 * ✅ Crear compra (guarda en 2 lugares):
 * - compradores/{userId}/miscompras/{compraId}
 * - compras/{compraId}
 */
        
                
 export const getCurrentTimestamp = () => Date.now();


export async function createCompraDualFS({
  userId,
  compraId,
  compraData,
  userInfo,     // opcional: si quieres forzar id (ej: orderId)
  img
}) {
  if (!userId) throw new Error("userId requerido");
    if (!img) throw new Error("img requerido");

  if (!compraData || typeof compraData !== "object") throw new Error("compraData requerida");
  if (!userInfo || typeof userInfo !== "object") throw new Error("userInfo requerida");


  const globalPurchaseDocRef = (id) => doc(db, GLOBAL_PURCHASES_COL, String(id));
  
  const userServiceDocRef = (uid, sid) =>
    doc(db, BUYERS_COL, String(uid), USER_PURCHASES_SUBCOL, String(sid));


  //Eliminar
  // const globalRef = globalPurchaseDocRef(compraId);
  // const userRef = userPurchaseDocRef(userId, compraId);
  try {
    // 1) idCompra
    const idCompra = compraId ;
    const estado = 'Verificando'

    // 2) Guardar servicios en paralelo en: compradores/{uid}/miscompras/{idServicio}
    const serviciosArr = Array.isArray(compraData) ? compraData : [];

  const serviciosPromises = serviciosArr.map(async (item) => {
  const idServicio = getCurrentTimestamp();

  const { id, ...itemSinId } = item; // ⬅️ elimina `id` si existe

  const servicioCompleto = {
    ...itemSinId,
    Codigo: idServicio,
    Fecha: idServicio,
    Usuario: userId,
    Estado: estado,
  };

  console.log(servicioCompleto);

  await setDoc(
    userServiceDocRef(userId, idServicio),
    servicioCompleto,
    { merge: false }
  );

  return idServicio;
});


    const idsCreados = await Promise.all(serviciosPromises);

    // 3) Guardar compra global en: Compras/{idCompra}
    const globalRef = globalPurchaseDocRef(idCompra);

    const compraCompleta = {
      ...userInfo,

      id: idCompra,
      Fecha: idCompra,
      img:img,

      Servicios: idsCreados,
        Estado:estado,
        Usuario:userId


     

      // estados (compat)
     
    };

    console.log(compraCompleta
    
    )

    await setDoc(globalRef, compraCompleta, { merge: false });

    console.log(idCompra)
 


    return { success: true, compraId: idCompra, serviciosIds: idsCreados };
  } catch (error) {
    console.error("Error al subir compra (createCompraDualFS):", error);
    throw error;
  }
}

/**
 * ✅ Listar MISCOMPRAS del usuario con paginación (Fecha desc)
 */
export async function getMisComprasPageFS({
  userId,
  pageSize = 12,
  lastDoc = null,
}) {
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
 * Útil para: status, tracking, guía, notas, etc.
 */
export async function updateCompraDualFS({
  userId,
  compraId,
  patchGlobal = {},
  patchUser = {},
}) {
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
export async function cancelCompraDualFS({
  userId,
  compraId,
  reason = null,
}) {
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