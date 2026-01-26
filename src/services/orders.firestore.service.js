// src/services/orders.firestore.service.js
import { db } from "../config/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
} from "firebase/firestore";

function toMs(createdAt) {
  // Timestamp -> ms
  if (!createdAt) return 0;
  if (typeof createdAt?.toDate === "function") return createdAt.toDate().getTime();
  // si ya es Date
  if (createdAt instanceof Date) return createdAt.getTime();
  // si viene como número
  if (typeof createdAt === "number") return createdAt;
  return 0;
}

/**
 * Pagina compras del usuario:
 * compradores/{userId}/miscompras
 *
 * Cursor serializable:
 * { lastCreatedAtMs: number, lastId: string }
 */
export async function listMyOrdersPageFS({ userId, pageSize = 10, cursor = null }) {
  const colRef = collection(db, "compradores", userId, "miscompras");

  const parts = [
    orderBy("Fecha", "desc"),
    // orderBy("__name__", "desc"),
  ];

  if (cursor?.lastCreatedAtMs && cursor?.lastId) {
    parts.push(startAfter(new Date(cursor.lastCreatedAtMs), cursor.lastId));
  }

  parts.push(limit(pageSize));

  const q = query(colRef, ...parts);
  const snap = await getDocs(q);

  const items = snap.docs.map((d) => {
    const data = d.data();
      console.log(data)

    return {
      id: d.id,
      ...data,
      // normalizamos createdAt para UI
     };
  });

  const last = snap.docs[snap.docs.length - 1];

  let nextCursor = null;
  if (last) {
    const lastData = last.data();
    const ms = toMs(lastData.createdAt);
    nextCursor = { lastCreatedAtMs: ms, lastId: last.id };
  }

  return {
    items,
    hasNext: snap.size === pageSize,
    cursor: nextCursor,
  };
}
