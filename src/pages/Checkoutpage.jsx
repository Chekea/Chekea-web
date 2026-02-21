// src/pages/CheckoutPage.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef, lazy, Suspense, memo } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

import { useCart } from "../state/CartContext";
import { puntodecimal } from "../utils/Helpers";
import { getCurrentTimestamp, checkCompras } from "../services/compras.service";
import { getCheckoutFromCache } from "../utils/checkoutwebview";
import { useEffectiveAuth } from "../state/useEffectiveAuth";

/* =========================
   PERF HELPERS
========================= */
const Header = lazy(() => import("../components/header"));

function idle(cb) {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) return window.requestIdleCallback(cb, { timeout: 1200 });
  return window.setTimeout(cb, 250);
}

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function calcTotalsFast(items, discountRate) {
  let products = 0;
  let shipping = 0;

  if (Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const qty = Math.max(1, safeNumber(it?.qty ?? 1, 1));
      products += safeNumber(it?.Precio ?? 0, 0) * qty;
      shipping += safeNumber(it?.Envio ?? 0, 0);
    }
  }

  const discount = Number((products * (discountRate || 0)).toFixed(2));
  const final = Number((products - discount + shipping).toFixed(2));

  return {
    productsSubtotal: Number(products.toFixed(2)),
    shippingTotal: Number(shipping.toFixed(2)),
    discountAmount: discount,
    finalTotal: final,
  };
}

/* =========================
   BOTÓN FIXED OPTIMIZADO
========================= */
const MobileFixedPayBar = memo(function MobileFixedPayBar({ visible, total, onPay, disabled }) {
  if (!visible) return null;

  return (
    <Box
      sx={{
        display: { xs: "block", md: "none" },
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: "#fff",
        zIndex: 20000,
        borderTop: "1px solid",
        borderColor: "divider",
        boxShadow: "0 -6px 16px rgba(0,0,0,0.08)",
        px: 1,
        py: 1,
        pb: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
      }}
    >
      <Box sx={{ maxWidth: 980, mx: "auto" }}>
        <Stack spacing={1}>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography sx={{ fontWeight: 900 }}>Total</Typography>
            <Typography sx={{ fontWeight: 900 }}>XFA {puntodecimal(total)}</Typography>
          </Box>

          <Button
            variant="contained"
            fullWidth
            sx={{ height: 46, fontWeight: 900 }}
            onClick={onPay}
            disabled={disabled}
          >
            Realizar Pago (Presencial o Electronico)
          </Button>
        </Stack>
      </Box>
    </Box>
  );
});

/* =========================
   ITEM MEMOIZADO + UI MÁS LIMPIA
   (misma info, menos "ruido")
========================= */
const CheckoutItem = memo(function CheckoutItem({ item, showRemove, onRemove }) {
  const title = item.titulo ?? item.Titulo ?? "Producto";
  const qty = item.qty ?? 1;

  return (
    <Paper sx={{ p: 2, mb: 1.25, borderRadius: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <img
          src={item.Img}
          alt={title}
          loading="lazy"
          decoding="async"
          style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover", flex: "0 0 auto" }}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900 }} noWrap title={title}>
            {title}
          </Typography>

          {/* ✅ Resumen compacto */}
          <Typography sx={{ color: "text.secondary" }} variant="body2">
            Cantidad: <b>{qty}</b> • Precio: <b>XFA {puntodecimal(item.Precio)}</b> • Envío:{" "}
            <b>XFA {puntodecimal(item.Envio)}</b>
          </Typography>

          {/* Detalles siguen ahí (solo si existen) */}
          {item.Detalles ? (
            <Typography sx={{ mt: 0.5, color: "text.secondary" }} variant="body2">
              {item.Detalles}
            </Typography>
          ) : null}
        </Box>

        {showRemove ? (
          <Button variant="outlined" color="error" size="small" onClick={() => onRemove(item.id)}>
            Quitar
          </Button>
        ) : null}
      </Stack>
    </Paper>
  );
});

export default function CheckoutPage() {
  const cart = useCart();
  const nav = useNavigate();
  const location = useLocation();
  const auth = useEffectiveAuth(); // ✅ web user OR rn user

  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  // ✅ preload header SOLO desktop (no bloquea)
  useEffect(() => {
    if (!isDesktop) return;
    const id = idle(() => import("../components/header"));
    return () => {
      if (typeof window === "undefined") return;
      if ("cancelIdleCallback" in window && typeof id === "number") {
        try {
          window.cancelIdleCallback(id);
        } catch {}
      } else if (typeof id === "number") clearTimeout(id);
    };
  }, [isDesktop]);

  // flujo web normal
  const buyNowItem = location.state?.buyNowItem ?? null;
  const selectedIdsArr = location.state?.selectedIds ?? [];
  const isBuyNow = Boolean(buyNowItem);

  // set solo si hay ids
  const selectedIds = useMemo(() => {
    return selectedIdsArr.length ? new Set(selectedIdsArr) : null;
  }, [selectedIdsArr]);

  // flujo webview: items cacheados por bridge RN (sessionStorage o window.__RN_STATE__)
  const webviewItems = useMemo(() => {
    if (location.state) return null; // web normal manda state → prioridad web
    return getCheckoutFromCache();
  }, [location.state]);

  const itemsToPay = useMemo(() => {
    if (buyNowItem) return [buyNowItem];
    if (selectedIds) return cart.items.filter((it) => selectedIds.has(it.id));
    if (Array.isArray(webviewItems) && webviewItems.length) return webviewItems;
    return [];
  }, [buyNowItem, selectedIds, cart.items, webviewItems]);

  const [hasPurchases, setHasPurchases] = useState(null);

  // ✅ evita setState si desmonta
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // ✅ optimización: checkCompras no bloquea render (se hace después)
  useEffect(() => {
    const uid = auth.user?.uid;
    if (!uid) return;

    let cancelled = false;

    const run = () => {
      checkCompras({ userId: uid })
        .then((res) => {
          if (cancelled || !aliveRef.current) return;
          setHasPurchases(res);
        })
        .catch(() => {
          if (cancelled || !aliveRef.current) return;
          setHasPurchases(true);
        });
    };

    // en idle (o timeout) para no afectar TTI
    const id = idle(run);

    return () => {
      cancelled = true;
      if (typeof window === "undefined") return;
      if ("cancelIdleCallback" in window && typeof id === "number") {
        try {
          window.cancelIdleCallback(id);
        } catch {}
      } else if (typeof id === "number") clearTimeout(id);
    };
  }, [auth.user?.uid]);

  const discountRate = hasPurchases === false ? 0.1 : 0;

  // ✅ totales con loop rápido
  const totals = useMemo(() => calcTotalsFast(itemsToPay, discountRate), [itemsToPay, discountRate]);

  const handlePay = useCallback(() => {
    if (!auth.isAuthed) {
      nav("/login");
      return;
    }

    const now = getCurrentTimestamp();

    nav(`/verify/${now}`, {
      state: {
        itemsToPay,
        hasPurchases,
        discountRate,
        productsSubtotal: totals.productsSubtotal,
        shippingTotal: totals.shippingTotal,
        discountAmount: totals.discountAmount,
        finalTotalToPay: totals.finalTotal,
      },
    });
  }, [auth.isAuthed, nav, itemsToPay, hasPurchases, discountRate, totals]);

  const handleRemove = useCallback((id) => cart.remove(id), [cart]);

  const showRemove = !isBuyNow && Boolean(location.state); // solo flujo web con state

  const hasItems = itemsToPay.length > 0;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* ✅ Header solo desktop (lazy + Suspense) */}
      {isDesktop ? (
        <Suspense fallback={null}>
          <Header queryText="" onQueryChange={() => {}} />
        </Suspense>
      ) : null}

      <MobileFixedPayBar
        visible={hasItems}
        total={totals.finalTotal}
        onPay={handlePay}
        disabled={!hasItems}
      />

      <Container maxWidth="lg" sx={{ py: 3, pb: { xs: 13, md: 3 } }}>
        <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Checkout
          </Typography>

          {!hasItems ? (
            <Typography sx={{ mt: 2 }}>No hay productos seleccionados para pagar.</Typography>
          ) : (
            <>
              {/* ✅ UI: sección superior compacta */}
              <Box sx={{ mt: 2 }}>
                {itemsToPay.map((item) => (
                  <CheckoutItem
                    key={item.id ?? `${item.titulo}-${item.Precio}-${item.Img}`}
                    item={item}
                    showRemove={showRemove}
                    onRemove={handleRemove}
                  />
                ))}
              </Box>

              {/* ✅ Resumen más legible y directo */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mt: 2 }}>
                <Stack spacing={0.5}>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography sx={{ fontWeight: 800 }}>Productos</Typography>
                    <Typography sx={{ fontWeight: 900 }}>
                      XFA {puntodecimal(totals.productsSubtotal)}
                    </Typography>
                  </Box>

                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography sx={{ fontWeight: 800 }}>Envío</Typography>
                    <Typography sx={{ fontWeight: 900 }}>
                      XFA {puntodecimal(totals.shippingTotal)}
                    </Typography>
                  </Box>

                  {hasPurchases === false ? (
                    <>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography sx={{ fontWeight: 800, color: "success.main" }}>
                          Descuento (10% solo productos)
                        </Typography>
                        <Typography sx={{ fontWeight: 900, color: "success.main" }}>
                          -XFA {puntodecimal(totals.discountAmount)}
                        </Typography>
                      </Box>
                      <Divider />
                    </>
                  ) : null}

                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography sx={{ fontWeight: 900 }}>Total</Typography>
                    <Typography sx={{ fontWeight: 900 }}>
                      XFA {puntodecimal(totals.finalTotal)}
                    </Typography>
                  </Box>

                 {isDesktop&& <Button variant="contained" fullWidth sx={{ mt: 1 }} onClick={handlePay}>
                    Realizar Pago (Presencial o Electronico)
                  </Button>}

                  {/* ✅ Mensaje mínimo, sin cambiar negocio */}
                  <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
                    Continuarás a la verificación para subir el comprobante del pago.
                  </Typography>
                </Stack>
              </Paper>
            </>
          )}
        </Paper>
      </Container>
    </Box>
  );
}