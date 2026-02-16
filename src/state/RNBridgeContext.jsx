import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const RNBridgeContext = createContext(null);

const BRIDGE_NAMESPACE = "RN_BRIDGE_V1";
const STORAGE_KEY_USER = "rn_bridge_user_v1";

// ✅ clave que ya usa tu getCheckoutFromCache()
const STORAGE_KEY_CHECKOUT = "checkout_payload_v1";

const storage = sessionStorage;

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** ✅ solo hidrata si injected trae algo válido */
function isValidCheckoutPayload(p) {
  return p && typeof p.ts === "number" && Array.isArray(p.itemsToPay);
}

function hydrateCheckoutToSession(injectedCheckout) {
  if (!isValidCheckoutPayload(injectedCheckout)) return;

  try {
    const current = safeParse(storage.getItem(STORAGE_KEY_CHECKOUT));
    const currentTs = Number(current?.ts || 0);
    const injectedTs = Number(injectedCheckout.ts || 0);

    // escribe si es más nuevo o si no existía
    if (!currentTs || injectedTs >= currentTs) {
      storage.setItem(STORAGE_KEY_CHECKOUT, JSON.stringify(injectedCheckout));
    }
  } catch {}
}

export function RNBridgeProvider({ children, initialRNState }) {
  const injected = initialRNState || window.__RN_STATE__ || null;

  const [rnUser, setRnUser] = useState(() => {
    try {
      // 1) prioridad máxima: injected
      if (injected?.user?.uid) {
        return {
          uid: injected.user.uid,
          email: injected.user.email ?? null,
          ts: Date.now(),
          source: "rn_injected",
        };
      }
      // 2) fallback session
      const raw = storage.getItem(STORAGE_KEY_USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // ✅ hidrata checkout UNA VEZ (NO rompe web normal)
  useEffect(() => {
    try {
      hydrateCheckoutToSession(injected?.checkout);
    } catch {}
    // solo una vez (queremos snapshot inicial estable)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist user
  useEffect(() => {
    try {
      if (rnUser) storage.setItem(STORAGE_KEY_USER, JSON.stringify(rnUser));
      else storage.removeItem(STORAGE_KEY_USER);
    } catch {}
  }, [rnUser]);

  // bridge updates posteriores (user + checkout opcional)
  useEffect(() => {
    const consume = (msg) => {
      if (!msg || msg.ns !== BRIDGE_NAMESPACE) return;

      if (msg.type === "user_context") {
        setRnUser({
          uid: msg.uid,
          email: msg.email ?? null,
          ts: msg.ts ?? Date.now(),
          source: "rn_webview",
        });
      }

      // ✅ opcional: si RN manda checkout por evento
      if (msg.type === "checkout_payload") {
        const payload = {
          ts: msg.ts ?? Date.now(),
          itemsToPay: Array.isArray(msg.itemsToPay) ? msg.itemsToPay : [],
        };
        hydrateCheckoutToSession(payload);
      }

      if (msg.type === "logout") {
        setRnUser(null);
      }
    };

    const onEvent = (e) => consume(e.detail);

    window.addEventListener(BRIDGE_NAMESPACE, onEvent);

    // consumir queue por si llegó antes
    (window[BRIDGE_NAMESPACE]?.queue || []).forEach(consume);

    return () => window.removeEventListener(BRIDGE_NAMESPACE, onEvent);
  }, []);

  const value = useMemo(
    () => ({
      rnUser,
      isRNAuthed: !!rnUser?.uid,
      clearRN: () => setRnUser(null),
    }),
    [rnUser]
  );

  return <RNBridgeContext.Provider value={value}>{children}</RNBridgeContext.Provider>;
}

export function useRNBridge() {
  const ctx = useContext(RNBridgeContext);
  if (!ctx) throw new Error("useRNBridge must be used within RNBridgeProvider");
  return ctx;
}
