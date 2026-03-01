// src/pages/OrderDetailsPage.jsx
import React, {
  useEffect,
  useMemo,
  useCallback,
  useState,
  useRef,
  lazy,
  Suspense,
  memo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Divider,
  Alert,
  Skeleton,
  CircularProgress,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

import { getCompraById } from "../services/compras.service";
import { fechas, puntodecimal } from "../utils/Helpers";
import { useEffectiveAuth } from "../state/useEffectiveAuth";

const Header = lazy(() => import("../components/header"));

/* =========================
   PERF HELPERS
========================= */
function idle(cb) {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) return window.requestIdleCallback(cb, { timeout: 1200 });
  return window.setTimeout(cb, 250);
}

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Igual filosofía que Checkout */
function calcTotalsFast(items, discountAmount = 0) {
  let products = 0;
  let shipping = 0;

  if (Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const qty = Math.max(1, safeNumber(it?.qty ?? 1, 1));
      products += safeNumber(it?.Precio ?? it?.price ?? 0, 0) * qty;
      shipping += safeNumber(it?.Envio ?? it?.shipping ?? 0, 0);
    }
  }

  const discount = safeNumber(discountAmount, 0);
  const final = Number((products - discount + shipping).toFixed(2));

  return {
    productsSubtotal: Number(products.toFixed(2)),
    shippingTotal: Number(shipping.toFixed(2)),
    discountAmount: Number(discount.toFixed(2)),
    finalTotal: final,
  };
}

/* =========================
   Cache (tu mismo enfoque)
========================= */
const orderCache = new Map();
const ORDER_TTL_MS = 2 * 60 * 1000;

function cacheGet(key) {
  const hit = orderCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > ORDER_TTL_MS) {
    orderCache.delete(key);
    return null;
  }
  return hit.value;
}
function cacheSet(key, value) {
  orderCache.set(key, { ts: Date.now(), value });
}

/* =========================
   UI: Item Card (consistente con CheckoutItem)
========================= */
const OrderItemCard = memo(function OrderItemCard({ item }) {
  const title = item?.titulo ?? item?.Titulo ?? item?.title ?? "Producto";
  const qty = item?.qty ?? 1;
  const precio = item?.Precio ?? item?.price ?? 0;
  const envio = item?.Envio ?? item?.shipping ?? 0;

  return (
    <Paper sx={{ p: 2, mb: 1.25, borderRadius: 2 }} variant="outlined">
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
            background: "rgba(0,0,0,0.04)",
          }}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900 }} noWrap title={title}>
            {title}
          </Typography>

          <Typography sx={{ color: "text.secondary" }} variant="body2">
            Cantidad: <b>{qty}</b> • Precio: <b>XFA {puntodecimal(precio)}</b> • Envío:{" "}
            <b>XFA {puntodecimal(envio)}</b>
          </Typography>

          {item?.Detalles ? (
            <Typography sx={{ mt: 0.5, color: "text.secondary" }} variant="body2">
              {item.Detalles}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </Paper>
  );
});

export default function OrderDetailsPage() {
  const { id: orderId } = useParams();
  const nav = useNavigate();

  const auth = useEffectiveAuth();
  const userId = auth?.user?.uid ?? auth?.user?.id ?? null;

  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reqIdRef = useRef(0);

  const goBack = useCallback(() => nav(-1), [nav]);

  /* ✅ prefetch header en idle (desktop) */
  useEffect(() => {
    const id = idle(() => {
      if (isDesktop) import("../components/header");
    });
    return () => {
      if (typeof window === "undefined") return;
      if ("cancelIdleCallback" in window && typeof id === "number") {
        try {
          window.cancelIdleCallback(id);
        } catch {}
      } else if (typeof id === "number") clearTimeout(id);
    };
  }, [isDesktop]);

  /* ✅ Load con cache + SWR */
  useEffect(() => {
    let alive = true;
    const myReqId = ++reqIdRef.current;

    async function load() {
      setError("");

      if (!orderId) {
        setOrder(null);
        setLoading(false);
        setError("No se encontró el ID del pedido.");
        return;
      }

      if (!userId) {
        setOrder(null);
        setLoading(false);
        setError("Debes iniciar sesión para ver el detalle del pedido.");
        return;
      }

      const cacheKey = `order:${userId}:${orderId}`;

      const cached = cacheGet(cacheKey);
      if (cached) {
        setOrder(cached);
        setLoading(false);

        idle(async () => {
          try {
            const fresh = await getCompraById(userId, orderId);
            if (!alive || myReqId !== reqIdRef.current) return;
            if (fresh) {
              cacheSet(cacheKey, fresh);
              setOrder(fresh);
            }
          } catch {}
        });

        return;
      }

      setLoading(true);
      setOrder(null);

      try {
        const data = await getCompraById(userId, orderId);
        if (!alive || myReqId !== reqIdRef.current) return;

        if (!data) {
          setError("No existe este pedido o no tienes acceso.");
          setOrder(null);
        } else {
          setOrder(data);
          cacheSet(cacheKey, data);
        }
      } catch (e) {
        if (!alive || myReqId !== reqIdRef.current) return;
        setError(e?.message || "Error cargando el pedido.");
        setOrder(null);
      } finally {
        if (!alive || myReqId !== reqIdRef.current) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [userId, orderId]);

  if (auth.loading) return null;
  if (!auth.isAuthed) return null;

  // ✅ Normaliza items del pedido (coincide con createReservaDualFS(compraData))
  const items = useMemo(() => {
    const arr =
      order?.compraData ||
      order?.items ||
      order?.products ||
      order?.cart ||
      null;

    if (Array.isArray(arr) && arr.length) return arr;

    // fallback: pedido legacy de 1 producto
    if (order && (order.Img || order.Precio || order.title || order.titulo)) return [order];

    return [];
  }, [order]);

  // ✅ Totales: respeta lo guardado si existe; si no, calcula desde items
  const totals = useMemo(() => {
    const storedDiscount = safeNumber(order?.descuento ?? order?.discountAmount ?? 0, 0);
    const storedTotal = safeNumber(order?.total ?? order?.finalTotal ?? 0, 0);
    const storedEnvio = safeNumber(order?.envio ?? order?.shippingTotal ?? 0, 0);

    // si backend ya te guardó total/envio/descuento, úsalo
    if (storedTotal > 0 || storedEnvio > 0 || storedDiscount > 0) {
      // si no tenemos subtotal, lo estimamos
      const computed = calcTotalsFast(items, storedDiscount);
      return {
        ...computed,
        shippingTotal: storedEnvio || computed.shippingTotal,
        discountAmount: storedDiscount,
        finalTotal: storedTotal || computed.finalTotal,
      };
    }

    return calcTotalsFast(items, 0);
  }, [order, items]);

  const buyerName = order?.userInfo?.nombre || order?.buyer?.name || "";
  const buyerPhone = order?.userInfo?.contacto || order?.buyer?.phone || "";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {isDesktop ? (
        <Suspense fallback={null}>
          <Header queryText="" onQueryChange={() => {}} />
        </Suspense>
      ) : null}

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 2 }}>
          {isDesktop ? (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{
                alignItems: { xs: "flex-start", sm: "center" },
                justifyContent: "space-between",
              }}
            >
              <Button variant="outlined" onClick={goBack}>
                Volver a mis compras
              </Button>
            </Stack>
          ) : null}

          {error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          ) : null}
        </Paper>

        {loading ? (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
            <Skeleton width={240} />
            <Skeleton width={320} />
            <Divider sx={{ my: 2 }} />
            <Skeleton height={36} />
            <Skeleton height={36} />
            <Skeleton height={36} />
            <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
              <CircularProgress size={24} />
            </Box>
          </Paper>
        ) : null}

        {!loading && !order ? (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
            <Typography sx={{ fontWeight: 900 }}>Pedido no disponible</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              Revisa tu sesión o el ID del pedido.
            </Typography>
            <Button sx={{ mt: 2 }} variant="outlined" onClick={goBack}>
              Volver a mis compras
            </Button>
          </Paper>
        ) : null}

        {!loading && order ? (
          <>
            {/* RESUMEN */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 900 }}>
                Pedido  Ck- {order?.Fecha || orderId}
              </Typography>

              {order?.Fecha ? (
                <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                  Fecha de Compra: {fechas(order.Fecha)}
                </Typography>
              ) : null}

              {order?.Estado ? (
                <Typography sx={{ mt: 0.5 }}>
                  Estado: <b>{order.Estado}</b>
                </Typography>
              ) : null}

              {(buyerName || buyerPhone) ? (
                <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                  Comprador: <b>{buyerName || "—"}</b>{buyerPhone ? ` • ${buyerPhone}` : ""}
                </Typography>
              ) : null}

              <Divider sx={{ my: 2 }} />

              <Alert severity="info">
                Este pedido se procesa cuando el pago es confirmado en oficina o banco usando tu código.
              </Alert>
            </Paper>

            {/* PRODUCTOS (UI estilo Checkout) */}
            <Paper elevation={0} sx={{ mt: 2, p: 3, borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 900, mb: 2 }}>
                {items.length > 1 ? "Productos reservados" : "Producto reservado"}
              </Typography>

              {items.length ? (
                <Box>
                  {items.map((it, idx) => (
                    <OrderItemCard
                      key={it?.id ?? `${it?.titulo}-${it?.Precio}-${it?.Img}-${idx}`}
                      item={it}
                    />
                  ))}
                </Box>
              ) : (
                <Typography sx={{ color: "text.secondary" }}>
                  No hay productos asociados a este pedido.
                </Typography>
              )}
            </Paper>

            {/* RESUMEN DE PAGO (idéntico patrón Checkout) */}
            <Paper elevation={0} sx={{ mt: 2, p: 3, borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 900, mb: 1.25 }}>Resumen</Typography>

              <Stack spacing={0.75}>
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

                <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
                  No pedimos comprobantes en la web. El pago se confirma en oficina o banco usando tu código.
                </Typography>
              </Stack>
            </Paper>
          </>
        ) : null}
      </Container>
    </Box>
  );
}