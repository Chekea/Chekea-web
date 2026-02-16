const SS_CHECKOUT_KEY = "checkout_payload_v1";
const TTL_MS = 10 * 60 * 1000;

function isValid(data) {
  return data && typeof data.ts === "number" && Array.isArray(data.itemsToPay);
}

export function getCheckoutFromCache() {
  try {
    // ✅ 1) preferir RN injected si existe
    const injected = window.__RN_STATE__?.checkout;
    if (isValid(injected)) {
      // persistir para navegación interna
      sessionStorage.setItem(SS_CHECKOUT_KEY, JSON.stringify(injected));
      return injected.itemsToPay;
    }

    // ✅ 2) fallback session storage
    const raw = sessionStorage.getItem(SS_CHECKOUT_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (!isValid(data)) return null;

    if (Date.now() - data.ts > TTL_MS) {
      sessionStorage.removeItem(SS_CHECKOUT_KEY);
      return null;
    }

    return data.itemsToPay;
  } catch {
    return null;
  }
}
