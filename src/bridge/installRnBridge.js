const NS = "RN_BRIDGE_V1";
const SS_USER_KEY = "rn_user_context_v1";
const SS_CHECKOUT_KEY = "checkout_payload_v1";
const TTL_MS = 10 * 60 * 1000;

function safeSet(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function readCachedUser() {
  try {
    const raw = sessionStorage.getItem(SS_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function readCachedCheckout() {
  try {
    const raw = sessionStorage.getItem(SS_CHECKOUT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.ts) return null;
    if (Date.now() - data.ts > TTL_MS) {
      sessionStorage.removeItem(SS_CHECKOUT_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function installRnBridge() {
  // Avisa a RN que la web puede pedir auth si lo necesita
  try {
    window.ReactNativeWebView?.postMessage?.(JSON.stringify({ ns: NS, type: "bridge_ready" }));
  } catch {}

  const onBridge = (msg) => {
    if (!msg || msg.ns !== NS) return;

    if (msg.type === "user_context") {
      safeSet(SS_USER_KEY, { uid: msg.uid ?? "", email: msg.email ?? "" });
    }

    if (msg.type === "checkout_context") {
      if (Array.isArray(msg.itemsToPay)) {
        safeSet(SS_CHECKOUT_KEY, { ts: Date.now(), itemsToPay: msg.itemsToPay });
      }
    }
  };

  const onEvt = (e) => onBridge(e?.detail);

  window.addEventListener(NS, onEvt);

  // También intenta leer de la queue si ya existe
  try {
    const q = window?.[NS]?.queue;
    if (Array.isArray(q) && q.length) {
      for (let i = q.length - 1; i >= 0; i--) {
        const m = q[i];
        if (m?.ns === NS) onBridge(m);
      }
    }
  } catch {}

  return () => window.removeEventListener(NS, onEvt);
}
