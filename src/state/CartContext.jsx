import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

import {
  getCartCache,
  setCartCache,
  subscribeCartFS,
  addToCartFS,
  setQtyCartFS,
  removeFromCartFS,
  clearCartFS,
} from "../services/cart.service";

import { useEffectiveAuth } from "../state/useEffectiveAuth";

const CartContext = createContext(null);

const SEL_CACHE_PREFIX = "cart_selection_v1";
const selKey = (uid) => `${SEL_CACHE_PREFIX}:${uid}`;

function loadSelection(uid) {
  try {
    const raw = localStorage.getItem(selKey(uid));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveSelection(uid, setIds) {
  try {
    localStorage.setItem(selKey(uid), JSON.stringify(Array.from(setIds)));
  } catch {}
}

export function CartProvider({ children }) {
  const auth = useEffectiveAuth();
  const uid = auth?.user?.uid || auth?.user?.id || null; // ✅ única fuente

  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Load cart + subscribe
  useEffect(() => {
    let unsub = null;
    let cancelled = false;

    async function run() {
      setReady(false);
      setItems([]);
      setSelectedIds(new Set());

      if (!uid) {
        setReady(true);
        return;
      }

      // 1) cache items (render rápido)
      const cached = getCartCache(uid);
      if (cached?.items && !cancelled) setItems(cached.items);

      // 2) cache selección
      const sel = loadSelection(uid);
      if (!cancelled) setSelectedIds(sel);

      // 3) realtime
      unsub = subscribeCartFS(
        uid,
        (nextItems) => {
          if (cancelled) return;

          setItems(nextItems);
          setCartCache(uid, nextItems);

          // reconciliar selección
          setSelectedIds((prev) => {
            const existing = new Set(nextItems.map((x) => x.id));
            const next = new Set([...prev].filter((id) => existing.has(id)));
            saveSelection(uid, next);
            return next;
          });

          setReady(true);
        },
        () => setReady(true)
      );

      setReady(true);
    }

    run();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [uid]);

  /** totals */
  const total = useCallback(() => {
    return items.reduce(
      (acc, p) => acc + Number(p.Precio || 0) * Number(p.qty || 0),
      0
    );
  }, [items]);

  const selectedItems = useMemo(() => {
    return items.filter((p) => selectedIds.has(p.id));
  }, [items, selectedIds]);

  const selectedTotal = useCallback(() => {
    return selectedItems.reduce(
      (acc, p) => acc + Number(p.Precio || 0) * Number(p.qty || 0),
      0
    );
  }, [selectedItems]);

  const selectedCount = selectedItems.length;

  /** selection actions */
  const toggleSelect = useCallback(
    (id) => {
      if (!uid) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        saveSelection(uid, next);
        return next;
      });
    },
    [uid]
  );

  const selectAll = useCallback(() => {
    if (!uid) return;
    setSelectedIds(() => {
      const next = new Set(items.map((p) => p.id));
      saveSelection(uid, next);
      return next;
    });
  }, [uid, items]);

  const clearSelection = useCallback(() => {
    if (!uid) return;
    setSelectedIds(() => {
      const next = new Set();
      saveSelection(uid, next);
      return next;
    });
  }, [uid]);

  /** CRUD actions */
  const add = useCallback(
    async (product, { mergeQty = true } = {}) => {
      if (!uid) throw new Error("Usuario no autenticado");
      await addToCartFS(uid, product, { mergeQty });
    },
    [uid]
  );

  const setQty = useCallback(
    async (id, qty) => {
      const safeQty = Math.max(1, Number(qty || 1));
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, qty: safeQty } : p)));
      if (!uid) return;
      await setQtyCartFS(uid, id, safeQty);
    },
    [uid]
  );

  const remove = useCallback(
    async (id) => {
      setItems((prev) => prev.filter((p) => p.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        if (uid) saveSelection(uid, next);
        return next;
      });
      if (!uid) return;
      await removeFromCartFS(uid, id);
    },
    [uid]
  );

  const clear = useCallback(async () => {
    setItems([]);
    setSelectedIds(new Set());
    if (!uid) return;
    await clearCartFS(uid);
    saveSelection(uid, new Set());
  }, [uid]);

  const value = useMemo(
    () => ({
      uid,
      ready,
      items,

      total,

      add,
      setQty,
      remove,
      clear,

      selectedIds,
      toggleSelect,
      selectAll,
      clearSelection,
      selectedItems,
      selectedTotal,
      selectedCount,
    }),
    [
      uid,
      ready,
      items,
      total,
      add,
      setQty,
      remove,
      clear,
      selectedIds,
      toggleSelect,
      selectAll,
      clearSelection,
      selectedItems,
      selectedTotal,
      selectedCount,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}
