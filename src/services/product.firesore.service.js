// ✅ src/services/product.firesore.service.js
// Ajustado para HomePage:
// - getHomeSectionsFS(): devuelve 3 secciones ya listas (6 items cada una)
//   * nuevo: Fecha desc (6)
//   * descuentos: Precio > 30000 (6)
//   * relevantes: orderBy("Vistos","desc") (6)  ✅ (requiere índice Vistos desc)
// - Mantiene tu getProductsPageFirestore + searchProductsFS con category/subcategory

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  writeBatch,
  where,
  
  runTransaction,
  updateDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { extractValidTokens } from "../utils/Helpers";

const PRODUCTS_COL = "productos";

function mapDoc(d) {
  const data = d.data();
  return { id: d.id, ...data };
}

function normalizeQueryText(q) {
  return (q || "").trim().toLowerCase();
}

/**
 * SORT SUPPORTED:
 * - "relevance" (fallback: Fecha desc)
 * - "price_asc"
 * - "price_desc"
 * - "newest"
 */
function buildSort(sort) {
  switch (sort) {
    case "price_asc":
      return { field: "Precio", dir: "asc" };
    case "price_desc":
      return { field: "Precio", dir: "desc" };
    case "newest":
      return { field: "Fecha", dir: "asc" };
    case "relevance":
    default:
      return { field: "Fecha", dir: "desc" };
  }
}

/**
 * ✅ Cursor pagination Firestore:
 * lastDoc: DocumentSnapshot | null
 *
 * ✅ subcategory
 */


export async function getProductsPageFirestore({
  pageSize = 12,
  category = "ALL",
  subcategory = "ALL",
  sort = "newest",
  queryText = "",
  lastDoc = null,      // DocumentSnapshot (si ya lo tienes)
  lastDocId = null,    // ✅ SOLO ID (persistible)
}) {
  const qText = normalizeQueryText(queryText);
  const { field, dir } = buildSort(sort);

  const colRef = collection(db, PRODUCTS_COL);
  const constraints = [];

  if (category && category !== "ALL") constraints.push(where("Categoria", "==", category));
  if (subcategory && subcategory !== "ALL") constraints.push(where("Subcategoria", "==", subcategory));
  if (qText) constraints.push(where("searchKeywords", "array-contains", qText));

  constraints.push(orderBy(field, dir));

  // ✅ si me pasan id, recupero el snapshot
  let effectiveLastDoc = lastDoc;
  if (!effectiveLastDoc && lastDocId) {
    const snap = await getDoc(doc(db, PRODUCTS_COL, lastDocId));
    if (snap.exists()) effectiveLastDoc = snap;
  }

  if (effectiveLastDoc) constraints.push(startAfter(effectiveLastDoc));

  constraints.push(limit(pageSize + 1));

  const qy = query(colRef, ...constraints);
  const snap = await getDocs(qy);

  const docs = snap.docs;
  const hasNext = docs.length > pageSize;

  const slice = docs.slice(0, pageSize);
  const items = slice.map(mapDoc);

  const nextLastDoc = slice.length ? slice[slice.length - 1] : effectiveLastDoc;

  return {
    items,
    hasNext,
    lastDoc: nextLastDoc,                 // snapshot para paginación normal
    lastDocId: nextLastDoc ? nextLastDoc.id : lastDocId, // ✅ id para persistir
  };
}

export async function getProductByIdFirestore(id) {
  const ref = doc(db, PRODUCTS_COL, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapDoc(snap);
}

export async function getProductByIdFS(id) {
  if (!id) return null;
  const ref = doc(db, PRODUCTS_COL, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * ✅ Home sections (para category === "ALL")
 * Reglas:
 * - nuevo: 6 por Fecha desc
 * - descuentos: 6 por Precio > 30000, ordenados por Precio desc
 * - relevantes: 6 por Vistos desc (server), fallback cliente si falla
 *
 * Importante: "descuentos" NO usa campo Descuento. Es Precio > 30000.
 *
 * Retorna:
 * { nuevo: [], descuentos: [], relevantes: [] }
 */
export async function getHomeSectionsFS({ size = 6 } = {}) {
  const colRef = collection(db, PRODUCTS_COL);

  // 🔥 SOLO MÁS RECIENTES (server-side)
  const newestQ = query(
    colRef,
    where("visible", "==", true),
    orderBy("Fecha", "desc"),
    limit(size)
  );

  const snap = await getDocs(newestQ);
  const recientes = snap.docs.map(mapDoc);

  return { recientes };
}



/**
 * ✅ Relacionados por categoría
 */
export async function getRelatedProductsFS({ category, excludeId, pageSize = 8 }) {
  if (!category) return [];

  console.log(category)
  const qy = query(
    collection(db, PRODUCTS_COL),
    where("Subcategoria", "==", category),
    orderBy("Fecha", "desc"),
    limit(pageSize + 5)
  );

  const snap = await getDocs(qy);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return items.filter((x) => x.id !== excludeId).slice(0, pageSize);
}

export async function getProductColorsFS(productId) {
  const ref = collection(db, PRODUCTS_COL, productId, "colores");
  const snap = await getDocs(ref);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getProductStylesFS(productId) {
  const ref = collection(db, PRODUCTS_COL, productId, "tallas");
  const snap = await getDocs(ref);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getProductImagesFS(productId) {
  const ref = collection(db, PRODUCTS_COL, productId, "imagenes");
  const snap = await getDocs(ref);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ======================================================
   ✅ VISTOS + INTERACCION + FAVORITOS + INTERESES
   ====================================================== */

function generateFirestoreId() {
  return doc(collection(db, "_ids")).id;
}

export async function actualizarCInteresFS(userId, categoria) {
  if (!userId || !categoria) return;

  const ref = doc(db, "compradores", userId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists() ? snap.data()?.CInteres || [] : [];

    let intereses = Array.isArray(cur) ? cur : [];
    intereses = intereses.filter((i) => i !== categoria);
    intereses.push(categoria);

    if (intereses.length > 4) intereses = intereses.slice(-4);

    tx.set(ref, { CInteres: intereses }, { merge: true });
  });
}

export async function updateViewCountFS(productId) {
  if (!productId) return;
  const ref = doc(db, PRODUCTS_COL, productId);
  await updateDoc(ref, { Vistos: increment(1) });
}

export async function addInteraccionFS({ userId, subcategoria, productId, cantidad }) {
  if (!userId || !productId) return;
  console.log('estamos on amigo',subcategoria)
  const ref = doc(db, PRODUCTS_COL, productId);
  await updateDoc(ref, { Interaccion: increment(cantidad) });
  if (subcategoria) await actualizarCInteresFS(userId, subcategoria);
}

export async function getFavoriteRefFromProductFS({ userId, productId }) {
  if (!userId || !productId) return null;
  const ref = doc(db, PRODUCTS_COL, productId, "favoritos", userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { idDoc: snap.id, ...snap.data() };
}

export async function addToFavoritesFS({ userId, productId, productData }) {
  if (!userId || !productId) throw new Error("userId/productId requerido");

  const favoritoId = generateFirestoreId();

  const userFavRef = doc(db, "compradores", userId, "misfavoritos", favoritoId);
  const productFavRef = doc(db, PRODUCTS_COL, productId, "favoritos", userId);

  console.log(productId)
  const favoriteData = {
    Codigo: favoritoId,
    id: productId,
    Titulo: productData?.Titulo ?? productData?.title ?? "",
    Precio: productData?.Precio ?? productData?.price ?? 0,
    Imagen: productData?.Imagen ?? productData?.image ?? "",
    Stock: productData?.Stock ?? productData?.stock ?? 0,
    Categoria: productData?.Categoria ?? productData?.category ?? "",
    Subcategoria: productData?.Subcategoria ?? productData?.subcategory ?? "",
    Fecha: serverTimestamp(),
  };

  console.log(favoriteData)
  await Promise.all([
    setDoc(userFavRef, favoriteData, { merge: false }),
    setDoc(productFavRef, { userId, id: favoritoId, Fecha: serverTimestamp() }, { merge: true }),
  ]);

  return favoritoId;
}

export async function removeFromFavoritesFS({ favoritoId, userId, productId }) {
  if (!favoritoId || !userId || !productId) return;

  const userFavRef = doc(db, "compradores", userId, "misfavoritos", favoritoId);
  const productFavRef = doc(db, PRODUCTS_COL, productId, "favoritos", userId);

  await Promise.all([deleteDoc(userFavRef), deleteDoc(productFavRef)]);
}

/**
 * ✅ Search + subcategory
 */
export async function searchProductsFS({
  qText = "",
  category = "ALL",
  subcategory = "ALL",
  sort = "relevance",
  pageSize = 12,
  lastDoc = null,
  minPrice,
  maxPrice,
}) {
  const tokens = extractValidTokens(qText);

  const colRef = collection(db, PRODUCTS_COL);
  const constraints = [];

  if (category && category !== "ALL") constraints.push(where("Categoria", "==", category));
  
  if (subcategory && subcategory !== "ALL") constraints.push(where("Subcategoria", "==", subcategory));

  if (typeof minPrice === "number") constraints.push(where("Precio", ">=", minPrice));
  if (typeof maxPrice === "number") constraints.push(where("Precio", "<=", maxPrice));

  if (tokens.length > 0) constraints.push(where("Ttoken", "array-contains-any", tokens));

  const { field, dir } = buildSort(sort);
    constraints.push(where("visible", "==", true));

    console.log(field,dir)

  constraints.push(orderBy(field, dir));

  if (lastDoc) constraints.push(startAfter(lastDoc));
  constraints.push(limit(pageSize * 3));

  const qy = query(colRef, ...constraints);
  const snap = await getDocs(qy);

  const filtered = snap.docs
    .map(mapDoc)
    .filter((p) => tokens.length === 0 || tokens.every((t) => (p.Ttoken || []).includes(t)));

  const pageItems = filtered.slice(0, pageSize);
  const hasNext = filtered.length > pageSize;

  const nextLastDoc = pageItems.length > 0 ? snap.docs[snap.docs.length - 1] : lastDoc;

  return { items: pageItems, hasNext, lastDoc: nextLastDoc };
}

export async function hideOtrosYDeporte() {
  const colRef = collection(db, "productos");

  const q = query(
    colRef,
    where("Categoria", "in", ["Otros", "Deporte"])
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    console.log("No hay productos para actualizar");
    return;
  }

  const batch = writeBatch(db);

  snap.forEach((d) => {
  console.log(d.id)
    batch.update(doc(db, "productos", d.id), {
      visible: false
    });
  });

  await batch.commit();

  console.log("Actualización completada");
}
export async function setVisibleTrueByCategory() {
  const colRef = collection(db, "productos");

  const q = query(
    colRef,
    where("Categoria", "in", [
      "Moda & Accesorios",
      "Hogar",
      "Complementos para peques",
      "Belleza & Accesorios"
    ])
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    console.log("No hay productos para actualizar");
    return;
  }

  const batch = writeBatch(db);

  snap.forEach((d) => {
    console.log(d.id)
    batch.update(doc(db, "productos", d.id), {
      visible: true
    });
  });

  await batch.commit();

  console.log(`✅ ${snap.size} productos marcados como visible:true`);
}

 
export async function setImgrealFalseForVisibleProducts() {
  const colRef = collection(db, "productos");

  const q = query(
    colRef,
    where("visible", "==", true)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    console.log("No hay productos visibles para actualizar");
    return;
  }

  const batch = writeBatch(db);
  let count = 0;

  snap.forEach((d) => {
    batch.update(doc(db, "productos", d.id), {
      Imgreal: false,
    });
    count++;
  });

  await batch.commit();

  console.log(`✅ ${count} productos visibles marcados como Imgreal:false`);
}
