// src/pages/CheckoutPage.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  lazy,
  Suspense,
  memo,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";

import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

import { useCart } from "../state/CartContext";
import { puntodecimal } from "../utils/Helpers";
import {
  getCurrentTimestamp,
  checkCompras,
  createReservaDualFS,
} from "../services/compras.service";
import { getCheckoutFromCache } from "../utils/checkoutwebview";
import { useEffectiveAuth } from "../state/useEffectiveAuth";

/* =========================
   SHIPPING CONFIG
========================= */
const AIR_PRICE_PER_KG = 9000;
const AIR_PRICE_PER_KG_BATA = 13000;

function idle(cb) {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) return window.requestIdleCallback(cb, { timeout: 1200 });
  return window.setTimeout(cb, 250);
}

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normCity(s) {
  return String(s ?? "").trim().toLowerCase();
}

/**
 * ✅ Calcula envío por item basado en:
 * - ciudad (Malabo/Bata)
 * - pesoKg
 * - qty
 */
function calcShippingForItem(item) {
  const city = normCity(item?.Ciudad ?? item?.city ?? "malabo");
  const qty = Math.max(1, safeNumber(item?.qty ?? 1, 1));

  // peso numérico: preferimos PesoKg; fallback Peso
  const pesoKg =
    safeNumber(item?.PesoKg, NaN);
  const pesoAlt =
    safeNumber(item?.Peso, NaN);

  const weight = Number.isFinite(pesoKg) ? pesoKg : (Number.isFinite(pesoAlt) ? pesoAlt : 0);

  const rate = city === "bata" ? AIR_PRICE_PER_KG_BATA : AIR_PRICE_PER_KG;

  return Math.round(weight * rate * qty);
}

/**
 * ✅ Precalcula totales + añade shipping calculado al item (sin mutar el original).
 */
function buildItemsWithShipping(items) {
  const out = [];
  let productsSubtotal = 0;
  let shippingTotal = 0;

  for (let i = 0; i < (items?.length ?? 0); i++) {
    const it = items[i];
    const qty = Math.max(1, safeNumber(it?.qty ?? 1, 1));
    const price = safeNumber(it?.Precio ?? 0, 0);

    const shipping = calcShippingForItem(it);

    productsSubtotal += price * qty;
    shippingTotal += shipping;

    out.push({
      ...it,
      _qty: qty,
      _shipping: shipping, // ✅ envío calculado (XFA)
    });
  }

  return {
    items: out,
    productsSubtotal: Number(productsSubtotal.toFixed(2)),
    shippingTotal: Number(shippingTotal.toFixed(2)),
  };
}

function calcFinalTotals(productsSubtotal, shippingTotal, discountRate) {
  const discountAmount = Number((productsSubtotal * (discountRate || 0)).toFixed(2));
  const finalTotal = Number((productsSubtotal - discountAmount + shippingTotal).toFixed(2));
  return { discountAmount, finalTotal };
}

/* =========================
   LAZY HEADER
========================= */
const Header = lazy(() => import("../components/header"));

/* =========================
   MOBILE BAR
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
            Crear reserva (48h) y ver instrucciones
          </Button>
        </Stack>
      </Box>
    </Box>
  );
});

/* =========================
   ITEM
========================= */
const CheckoutItem = memo(function CheckoutItem({ item, showRemove, onRemove }) {
  const title = item?.titulo ?? item?.Titulo ?? "Producto";
  const qty = item?._qty ?? item?.qty ?? 1;
  const shipping = item?._shipping ?? 0;

  return (
    <Paper sx={{ p: 2, mb: 1.25, borderRadius: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <img
          src={item?.Img}
          alt={title}
          loading="lazy"
          decoding="async"
          style={{
            width: 72,
            height: 72,
            borderRadius: 12,
            objectFit: "cover",
            flex: "0 0 auto",
          }}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900 }} noWrap title={title}>
            {title}
          </Typography>

          <Typography sx={{ color: "text.secondary" }} variant="body2">
            Cantidad: <b>{qty}</b> • Precio: <b>XFA {puntodecimal(item?.Precio ?? 0)}</b> • Envío:{" "}
            <b>XFA {puntodecimal(shipping)}</b>
          </Typography>

          {item?.Detalles ? (
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
  const auth = useEffectiveAuth();

  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  // preload header SOLO desktop
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

  const selectedIds = useMemo(() => {
    return selectedIdsArr.length ? new Set(selectedIdsArr) : null;
  }, [selectedIdsArr]);

  // flujo webview
  const webviewItems = useMemo(() => {
    if (location.state) return null;
    return getCheckoutFromCache();
  }, [location.state]);

  const rawItemsToPay = useMemo(() => {
    if (buyNowItem) return [buyNowItem];
    if (selectedIds) return cart.items.filter((it) => selectedIds.has(it.id));
    if (Array.isArray(webviewItems) && webviewItems.length) return webviewItems;
    return [];
  }, [buyNowItem, selectedIds, cart.items, webviewItems]);

  // ✅ Optimización clave: anexamos shipping calculado una sola vez
  const computed = useMemo(() => buildItemsWithShipping(rawItemsToPay), [rawItemsToPay]);
  const itemsToPay = computed.items;

  const [hasPurchases, setHasPurchases] = useState(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // checkCompras en idle
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

  const totals = useMemo(() => {
    const { discountAmount, finalTotal } = calcFinalTotals(
      computed.productsSubtotal,
      computed.shippingTotal,
      discountRate
    );

    return {
      productsSubtotal: computed.productsSubtotal,
      shippingTotal: computed.shippingTotal,
      discountAmount,
      finalTotal,
    };
  }, [computed.productsSubtotal, computed.shippingTotal, discountRate]);

  // Datos comprador
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errReserve, setErrReserve] = useState("");

  const nombreOk = nombre.trim().length >= 3;
  const telefonoOk = String(telefono).trim().length >= 6;

  const handleRemove = useCallback((id) => cart.remove(id), [cart]);

  const showRemove = !isBuyNow && Boolean(location.state);
  const hasItems = itemsToPay.length > 0;

  const handleReserve = useCallback(async () => {
    setErrReserve("");

    if (!auth.isAuthed) {
      nav("/login");
      return;
    }
    if (!hasItems) return;

    if (!nombreOk) {
      setErrReserve("Escribe tu nombre y apellidos.");
      return;
    }
    if (!telefonoOk) {
      setErrReserve("Escribe tu teléfono / WhatsApp.");
      return;
    }

    try {
      setSubmitting(true);

      const compraId = getCurrentTimestamp();

      // ✅ guardamos los items con shipping calculado para que quede trazable
      const compraData = itemsToPay.map((it) => ({
        ...it,
        Envio: it._shipping, // si tu backend espera Envio
      }));

      await createReservaDualFS({
        userId: auth.user.uid,
        compraId,
        compraData,
        userInfo: { nombre: nombre.trim(), contacto: String(telefono).trim() },
        descuento: totals.discountAmount,
        total: totals.finalTotal,
        envio: totals.shippingTotal,
        expiresInHours: 48,
      });

      nav(`/order/${compraId}`);
    } catch (e) {
      setErrReserve(e?.message || "No se pudo crear la reserva. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }, [
    auth.isAuthed,
    auth.user?.uid,
    nav,
    hasItems,
    nombreOk,
    telefonoOk,
    nombre,
    telefono,
    itemsToPay,
    totals.discountAmount,
    totals.finalTotal,
    totals.shippingTotal,
  ]);

  const mobileDisabled = !hasItems || !auth.isAuthed || !nombreOk || !telefonoOk || submitting;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {isDesktop ? (
        <Suspense fallback={null}>
          <Header queryText="" onQueryChange={() => {}} />
        </Suspense>
      ) : null}

      <MobileFixedPayBar
        visible={hasItems}
        total={totals.finalTotal}
        onPay={handleReserve}
        disabled={mobileDisabled}
      />

      <Container maxWidth="lg" sx={{ py: 3, pb: { xs: 13, md: 3 } }}>
        <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Checkout
          </Typography>

          {!hasItems ? (
            <Typography sx={{ mt: 2 }}>No hay productos seleccionados para comprar.</Typography>
          ) : (
            <>
              <Box sx={{ mt: 2 }}>
                {itemsToPay.map((item) => (
                  <CheckoutItem
                    key={item.id ?? `${item.Titulo}-${item.Precio}-${item.Img}`}
                    item={item}
                    showRemove={showRemove}
                    onRemove={handleRemove}
                  />
                ))}
              </Box>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mt: 2 }}>
                <Typography sx={{ fontWeight: 900, mb: 1 }}>Datos del comprador</Typography>

                <Stack spacing={1.5}>
                  <TextField
                    label="Nombre y apellidos"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    fullWidth
                    disabled={submitting}
                  />
                  <TextField
                    label="Teléfono / WhatsApp"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    fullWidth
                    disabled={submitting}
                  />

                  {errReserve ? <Alert severity="error">{errReserve}</Alert> : null}

                  <Alert severity="info">
                    Tu pedido se reserva por <b>48 horas</b>. Se procesa cuando confirmamos el pago en oficina o banco.
                  </Alert>
                </Stack>
              </Paper>

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

                  {totals.discountAmount > 0 ? (
                    <>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography sx={{ fontWeight: 800, color: "success.main" }}>
                          Descuento (solo productos)
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

                  {isDesktop ? (
                    <Button
                      variant="contained"
                      fullWidth
                      sx={{ mt: 1, fontWeight: 900 }}
                      onClick={handleReserve}
                      disabled={mobileDisabled}
                    >
                      {submitting ? "Creando reserva..." : "Crear reserva (48h) y ver instrucciones"}
                    </Button>
                  ) : null}

                  <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
Confirmamos el costo final con usted antes del despacho para mas transparencia.                    
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