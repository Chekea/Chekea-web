import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { getCurrentTimestamp } from "./compras.service";

const BUYERS_COL = "compradores";
const CART_SUBCOL = "micaja";

/* --------------------------------
   CACHE
-------------------------------- */
const CACHE_PREFIX = "cart_cache_v1";
const cacheKey = (userId) => `${CACHE_PREFIX}:${userId}`;

function mapCartDoc(d) {
  return { id: d.id, ...d.data() };
}

export function getCartCache(userId) {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.items || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCartCache(userId, items) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify({ items, updatedAt: Date.now() }));
  } catch {}
}

export function clearCartCache(userId) {
  try {
    localStorage.removeItem(cacheKey(userId));
  } catch {}
}

/* --------------------------------
   REALTIME
-------------------------------- */
export function subscribeCartFS(userId, onChange, onError) {
  if (!userId) throw new Error("userId requerido");

  const colRef = collection(db, BUYERS_COL, userId, CART_SUBCOL);
  const qy = query(colRef, orderBy("Fecha", "desc"));

  return onSnapshot(
    qy,
    (snap) => {
      const items = snap.docs.map(mapCartDoc);
      setCartCache(userId, items);
      onChange(items);
    },
    (err) => onError?.(err)
  );
}

/* --------------------------------
   ADD (Firestore genera el ID)
-------------------------------- */
export async function addToCartFS(userId, product) {
  if (!userId) throw new Error("userId requerido");
  if (!product) throw new Error("product requerido");

  const colRef = collection(db, BUYERS_COL, userId, CART_SUBCOL);

  const payload = {
    Producto: product.Producto ?? null, // opcional
    Titulo: String(product.Titulo ?? "").trim(),
    Precio: Number(product.Precio ?? 0) || 0,
    Img: String(product.Img ?? "").trim(),
    Detalles: product.Detalles ?? "",
    Envio:Number(product.Envio ?? 0) || 0,
    qty: Math.max(1, Number(product.qty ?? 1) || 1),
    Fecha: getCurrentTimestamp(),
  };

  const docRef = await addDoc(colRef, payload);
  console.log(docRef.id)
  return docRef.id; // 🔑 ID generado por Firestore
}

/* --------------------------------
   UPDATE QTY
-------------------------------- */
export async function setQtyCartFS(userId, cartItemId, qty) {
  if (!userId) throw new Error("userId requerido");

  const safeQty = Math.max(1, Number(qty || 1));
  const ref = doc(db, BUYERS_COL, userId, CART_SUBCOL, cartItemId);

  await updateDoc(ref, { qty: safeQty, Fecha: serverTimestamp() });
}

/* --------------------------------
   REMOVE ITEM
-------------------------------- */
export async function removeFromCartFS(userId, cartItemId) {
  if (!userId) throw new Error("userId requerido");

  const ref = doc(db, BUYERS_COL, userId, CART_SUBCOL, cartItemId);
  await deleteDoc(ref);
}

/* --------------------------------
   CLEAR CART
-------------------------------- */
export async function clearCartFS(userId) {
  if (!userId) throw new Error("userId requerido");

  const colRef = collection(db, BUYERS_COL, userId, CART_SUBCOL);
  const snap = await getDocs(colRef);

  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  clearCartCache(userId);
}
