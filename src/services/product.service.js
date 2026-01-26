import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Colección: products
 * Campos recomendados:
 * title, title_en, title_fr
 * image, price, discount, rating, shipping, shipping_en, shipping_fr
 * category (BASE): ELECTRONICS | FASHION | HOME | BEAUTY | ...
 * createdAt (timestamp)
 *
 * Búsqueda:
 * Firestore no es full-text. Aquí se deja búsqueda opcional por prefijo si tienes title_lower.
 */

function normalizeSort(sort) {
  if (sort === "price_asc") return { field: "price", dir: "asc" };
  if (sort === "price_desc") return { field: "price", dir: "desc" };
  if (sort === "rating_desc") return { field: "rating", dir: "desc" };
  return { field: "createdAt", dir: "desc" };
}

function searchRange(q) {
  const s = q.trim().toLowerCase();
  return { s, end: s + "\uf8ff" };
}

export async function getProductsPage({
  pageSize,
  category,   // "ALL" o una categoría base (ELECTRONICS...)
  sort,
  queryText,
  cursorDoc,  // lastDoc de la página anterior
}) {
  const ref = collection(db, "products");
  const order = normalizeSort(sort);

  // Base query
  let q = query(ref, orderBy(order.field, order.dir), limit(pageSize));

  // Category filter
  if (category && category !== "ALL") {
    q = query(
      ref,
      where("category", "==", category),
      orderBy(order.field, order.dir),
      limit(pageSize)
    );
  }

  // Optional prefix search (requires title_lower)
  if (queryText?.trim()) {
    const { s, end } = searchRange(queryText);
    q = query(
      ref,
      where("title_lower", ">=", s),
      where("title_lower", "<=", end),
      orderBy("title_lower", "asc"),
      limit(pageSize)
    );
  }

  // Cursor
  if (cursorDoc) {
    q = query(q, startAfter(cursorDoc));
  }

  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lastDoc = snap.docs[snap.docs.length - 1] ?? null;

  return { items, lastDoc, hasNext: items.length === pageSize };
}

