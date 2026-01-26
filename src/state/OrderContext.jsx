import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const LS_KEY = "chekea_orders_v1";
const OrdersCtx = createContext(null);

function loadOrders() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
  catch { return []; }
}
function trackingCode() {
  return `CHK-${Math.floor(10000000 + Math.random() * 90000000)}`;
}

export function OrdersProvider({ children }) {
  const [orders, setOrders] = useState(loadOrders);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(orders));
  }, [orders]);

  const api = useMemo(() => ({
    orders,
    createDraft({ userId, items, total, currency }) {
      const id = `order-${Date.now()}`;
      const order = {
        id,
        userId,
        status: "DRAFT",
        currency,
        total,
        items,
        createdAt: new Date().toISOString(),
        tracking: {
          carrier: "Chekea Express",
          code: trackingCode(),
          status: "CREATED",
          updatedAt: new Date().toISOString(),
        },
      };
      setOrders((prev) => [order, ...prev]);
      return order;
    },
    markPaid(orderId, paymentMethod = "PAYPAL_DUMMY") {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: "PAID", paymentMethod, paidAt: new Date().toISOString() }
            : o
        )
      );
    },
    listByUser(userId) {
      return orders.filter((o) => o.userId === userId);
    },
    findByTracking(code) {
      const c = (code || "").trim();
      return orders.find((o) => o.tracking?.code === c) || null;
    },
    advanceTracking(orderId) {
      const flow = ["CREATED", "IN_TRANSIT", "CUSTOMS", "OUT_FOR_DELIVERY", "DELIVERED"];
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          const idx = flow.indexOf(o.tracking?.status || "CREATED");
          const next = flow[Math.min(flow.length - 1, idx + 1)];
          return {
            ...o,
            tracking: { ...o.tracking, status: next, updatedAt: new Date().toISOString() },
          };
        })
      );
    },
  }), [orders]);

  return <OrdersCtx.Provider value={api}>{children}</OrdersCtx.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersCtx);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
}
