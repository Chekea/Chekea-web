// src/pages/OrderDetailsPage.jsx
import React, {
  useEffect,
  useMemo,
  useCallback,
  useState,
  useRef,
  lazy,
  Suspense,
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

/* =========================
   Constantes / helpers
========================= */
const LS_SHIP_CITY = "chekea_ship_city_v1";

/* Cache ultra-simple en memoria (por usuario+orderId) */
const orderCache = new Map(); // key -> { ts, value }
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

function getShippingDays(city) {
  return city === "Bata" ? 20 : 15;
}

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

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

  /* ✅ prefetch en idle (desktop) */
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

  /* localStorage solo 1 vez */
  const shipCityLS = useMemo(() => {
    try {
      return localStorage.getItem(LS_SHIP_CITY) || "";
    } catch {
      return "";
    }
  }, []);

  const shipCity = useMemo(() => {
    const fromOrder =
      order?.shipping?.city ||
      order?.address?.city ||
      order?.deliveryCity ||
      "";
    return shipCityLS || fromOrder || "—";
  }, [shipCityLS, order]);

  const shipDays = useMemo(() => getShippingDays(shipCity), [shipCity]);

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

      // ✅ 1) hydrate inmediato desde memoria
      const cached = cacheGet(cacheKey);
      if (cached) {
        setOrder(cached);
        setLoading(false);

        // ✅ SWR refresh en background (no bloquea)
        idle(async () => {
          try {
            const fresh = await getCompraById(userId, orderId);
            if (!alive || myReqId !== reqIdRef.current) return;
            if (fresh) {
              cacheSet(cacheKey, fresh);
              setOrder(fresh);
            }
          } catch {
            // no ensuciar UI si falla refresh
          }
        });

        return;
      }

      // ✅ 2) no cache: carga normal
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

  const totalPagado = useMemo(() => {
    const precio = safeNumber(order?.Precio, 0);
    const envio = safeNumber(order?.Envio, 0);
    return precio + envio;
  }, [order]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* ✅ Header lazy SOLO desktop */}
      {isDesktop ? (
        <Suspense fallback={null}>
          <Header queryText="" onQueryChange={() => {}} />
        </Suspense>
      ) : null}

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 2 }}>
          {isDesktop&&<Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between" }}
          >
            

            <Button variant="outlined" onClick={goBack}>
              Volver a mis compras
            </Button>
          </Stack>
}
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
              <Typography sx={{ fontWeight: 900 }}>Pedido {order.id}</Typography>

              <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                Fecha de Compra: {fechas(order.Fecha)}
              </Typography>

              <Typography sx={{ mt: 0.5 }}>
                Estado: <b>{order.Estado}</b>
              </Typography>

              <Divider sx={{ my: 2 }} />

             
            </Paper>

            {/* PRODUCTO */}
            <Paper elevation={0} sx={{ mt: 2, p: 3, borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 900, mb: 2 }}>
                Producto comprado
              </Typography>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                  {/* Imagen izquierda */}
                  <Box
                    sx={{
                      width: 90,
                      height: 90,
                      flexShrink: 0,
                      borderRadius: 2,
                      overflow: "hidden",
                      bgcolor: "action.hover",
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    {order?.Img ? (
                      <img
                        src={order.Img}
                        alt={order?.title ?? "Producto"}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : null}
                  </Box>

                  {/* Texto derecha ocupa todo */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900 }} noWrap title={order?.title ?? "Producto"}>
                      {order?.title ?? "Producto"}
                    </Typography>

                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                      Precio: XFA {order?.Precio ?? "—"} • Cantidad: {order?.qty ?? 1}
                    </Typography>

                    {order?.Detalles ? (
                      <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                        Detalles: {order.Detalles}
                      </Typography>
                    ) : null}

                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                      Tiempo estimado: <b>{shipDays} días</b>
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Paper>

            {/* TOTAL */}
            <Paper elevation={0} sx={{ mt: 2, p: 3, borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 900 }}>Total pagado</Typography>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                {puntodecimal(totalPagado)} XFA
              </Typography>
            </Paper>

            
          </>
        ) : null}
      </Container>
    </Box>
  );
}