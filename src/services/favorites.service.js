import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
} from "firebase/firestore";
import { db } from "../config/firebase";

const BUYERS_COL = "compradores";

function mapFavoriteDoc(d) {
  console.log(d.data())
  return { id: d.id, ...d.data() };
}

/**
 * ✅ Lista favoritos del usuario (Fecha desc) con paginación (igual que tu service de productos)
 *
 * Path: compradores/{userId}/misfavoritos
 *
 * Cursor:
 * - lastDoc: DocumentSnapshot | null
 *
 * Retorna:
 * { items, hasNext, lastDoc }
 */
export async function getFavoritesPageFS({ userId, pageSize = 12, lastDoc = null }) {
  if (!userId) throw new Error("userId requerido");

  console.log(userId)
  const colRef = collection(db, BUYERS_COL, userId, "misfavoritos");

  const constraints = [orderBy("Fecha", "desc")];

  if (lastDoc) constraints.push(startAfter(lastDoc));

  constraints.push(limit(pageSize + 1));

  const qy = query(colRef, ...constraints);
  const snap = await getDocs(qy);

  const docs = snap.docs;
  const hasNext = docs.length > pageSize;

  const slice = docs.slice(0, pageSize);
  const items = slice.map(mapFavoriteDoc);
  const nextLastDoc = slice.length ? slice[slice.length - 1] : lastDoc;

  return { items, hasNext, lastDoc: nextLastDoc };
}
