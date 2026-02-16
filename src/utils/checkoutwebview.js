const SS_CHECKOUT_KEY = "checkout_payload_v1";
const TTL_MS = 10 * 60 * 1000;

export function getCheckoutFromCache() {
  try {
    const raw = sessionStorage.getItem(SS_CHECKOUT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.ts) return null;
    if (Date.now() - data.ts > TTL_MS) {
      sessionStorage.removeItem(SS_CHECKOUT_KEY);
      return null;
    }
    if (!Array.isArray(data.itemsToPay)) return null;
    return data.itemsToPay;
  } catch {
    return null;
  }
}
