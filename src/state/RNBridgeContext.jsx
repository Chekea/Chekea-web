import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const RNBridgeContext = createContext(null);

const BRIDGE_NAMESPACE = "RN_BRIDGE_V1";
const STORAGE_KEY = "rn_bridge_user_v1";
const storage = sessionStorage;

export function RNBridgeProvider({ children }) {

  const [rnUser, setRnUser] = useState(() => {
    try {
      // 🔥 1️⃣ PRIORIDAD MÁXIMA: estado inyectado por RN
      if (window.__RN_STATE__?.user?.uid) {
        return {
          uid: window.__RN_STATE__.user.uid,
          email: window.__RN_STATE__.user.email,
          ts: Date.now(),
          source: "rn_injected",
        };
      }

      // 2️⃣ fallback a sessionStorage
      const raw = storage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;

    } catch {
      return null;
    }
  });

  // 🔥 persistencia
  useEffect(() => {
    try {
      if (rnUser) storage.setItem(STORAGE_KEY, JSON.stringify(rnUser));
      else storage.removeItem(STORAGE_KEY);
    } catch {}
  }, [rnUser]);

  // 🔥 bridge para updates posteriores
  useEffect(() => {
    const consume = (msg) => {
      if (!msg || msg.ns !== BRIDGE_NAMESPACE) return;

      if (msg.type === "user_context") {
        setRnUser({
          uid: msg.uid,
          email: msg.email,
          ts: msg.ts,
          source: "rn_webview",
        });
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

  return (
    <RNBridgeContext.Provider value={value}>
      {children}
    </RNBridgeContext.Provider>
  );
}

export function useRNBridge() {
  const ctx = useContext(RNBridgeContext);
  if (!ctx) throw new Error("useRNBridge must be used within RNBridgeProvider");
  return ctx;
}
