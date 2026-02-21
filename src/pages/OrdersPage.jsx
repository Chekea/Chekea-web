// src/pages/OrdersPage.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
  memo,
} from "react";

import {
  Container,
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";

import { listMyOrdersPageFS } from "../services/orders.firestore.service";
import { useEffectiveAuth } from "../state/useEffectiveAuth";

/* ✅ Header lazy (solo desktop) */
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
   UI helpers
========================= */
function CenterLoader({ text = "Cargando compras…" }) {
  return (
    <Box sx={{ minHeight: "55vh", display: "grid", placeItems: "center" }}>
      <Stack spacing={1.5} alignItems="center">
        <CircularProgress size={28} />
        <Typography sx={{ fontWeight: 900 }}>{text}</Typography>
      </Stack>
    </Box>
  );
}

/* ✅ Card optimizada: imagen izquierda + texto derecha ocupando todo el espacio */
const OrderCard = memo(function OrderCard({ o, onDetails }) {
  const title = o?.Titulo || "Compra";
  const status = o?.Estado || "—";
  const img = o?.Img || "";

  const createdAtDate = useMemo(() => {
    if (o?._createdAtMs) return new Date(o._createdAtMs);
    if (o?.createdAt?.toDate) return o.createdAt.toDate();
    if (o?.createdAt) return new Date(o.createdAt);
    return null;
  }, [o]);

  const createdAtText = useMemo(() => {
    if (!createdAtDate || Number.isNaN(createdAtDate.getTime())) return null;
    try {
      return createdAtDate.toLocaleString();
    } catch {
      return null;
    }
  }, [createdAtDate]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        {/* Imagen izquierda */}
        <Box
          sx={{
            width: 90,
            height: 90,
            flexShrink: 0,
            borderRadius: 2,
            overflow: "hidden",
            bgcolor: "grey.100",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          {img ? (
            <img
              src={img}
              alt={title}
              loading="lazy"
              decoding="async"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
        </Box>

        {/* Texto derecha (ocupa todo el espacio) */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Typography sx={{ fontWeight: 900 }} noWrap title={title}>
            {title}
          </Typography>

          {createdAtText ? (
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
              {createdAtText}
            </Typography>
          ) : null}

          <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Chip size="small" label={status} />
          </Box>

          <Box sx={{ mt: "auto", pt: 1 }}>
            <Button size="small" variant="outlined" onClick={() => onDetails(o.id)}>
              Ver detalles
            </Button>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
});

export default function OrdersPage() {
  const auth = useEffectiveAuth();
  const nav = useNavigate();

  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const userId = auth.user?.id ?? auth.user?.uid ?? null;

  // paging state
  const [orders, setOrders] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // refs para evitar renders y dobles fetch
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);
  const hasNextRef = useRef(false);
  const cursorRef = useRef(null);
  const reqIdRef = useRef(0);

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

  /* ✅ redirect login (sin side-effect en render) */
  useEffect(() => {
    if (!auth.loading && !auth.isAuthed) nav("/login", { replace: true });
  }, [auth.loading, auth.isAuthed, nav]);

  const orderDetails = useCallback(
    (id) => {
      nav(`/account/orders/${id}`);
    },
    [nav]
  );

  const loadFirstPage = useCallback(async () => {
    if (!userId) return;

    const myReqId = ++reqIdRef.current;

    setLoading(true);
    loadingRef.current = true;
    setError("");

    // reset refs
    cursorRef.current = null;
    hasNextRef.current = false;

    try {
      const res = await listMyOrdersPageFS({
        userId,
        pageSize: isDesktop ? 10 : 8,
        cursor: null,
      });

      if (myReqId !== reqIdRef.current) return;

      const items = res?.items || [];
      setOrders(items);

      const next = !!res?.hasNext;
      setHasNext(next);
      hasNextRef.current = next;

      cursorRef.current = res?.cursor ?? null;
    } catch (e) {
      if (myReqId !== reqIdRef.current) return;
      console.error(e);
      setError("Error cargando tus compras.");
    } finally {
      if (myReqId !== reqIdRef.current) return;
      setLoading(false);
      loadingRef.current = false;
    }
  }, [userId, isDesktop]);

  const loadMore = useCallback(async () => {
    if (!userId) return;
    if (loadingRef.current) return;
    if (!hasNextRef.current) return;

    const myReqId = ++reqIdRef.current;

    setLoading(true);
    loadingRef.current = true;
    setError("");

    try {
      const res = await listMyOrdersPageFS({
        userId,
        pageSize: isDesktop ? 10 : 8,
        cursor: cursorRef.current,
      });

      if (myReqId !== reqIdRef.current) return;

      const nextItems = res?.items || [];
      setOrders((prev) => [...prev, ...nextItems]);

      const next = !!res?.hasNext;
      setHasNext(next);
      hasNextRef.current = next;

      cursorRef.current = res?.cursor ?? null;
    } catch (e) {
      if (myReqId !== reqIdRef.current) return;
      console.error(e);
      setError("Error cargando más compras.");
    } finally {
      if (myReqId !== reqIdRef.current) return;
      setLoading(false);
      loadingRef.current = false;
    }
  }, [userId, isDesktop]);

  /* ✅ first load */
  useEffect(() => {
    if (!userId) return;
    setOrders([]);
    setHasNext(false);
    cursorRef.current = null;
    hasNextRef.current = false;
    loadFirstPage();
  }, [userId, loadFirstPage]);

  /* ✅ observer estable + guard para evitar spam */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !userId) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: "700px", threshold: 0.01 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [userId, loadMore]);

  const isEmpty = useMemo(() => !loading && orders.length === 0, [loading, orders.length]);

  if (auth.loading) return null;
  if (!auth.isAuthed) return null;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* ✅ Header SOLO desktop (lazy) */}
      {isDesktop ? (
        <Suspense fallback={null}>
          <Header queryText="" onQueryChange={() => {}} />
        </Suspense>
      ) : null}

      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* ✅ top bar compacta */}
        <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 2 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between" }}
          >
            
{isDesktop&&
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => nav("/account")}>
                Volver
              </Button>
              <Button variant="contained" onClick={loadFirstPage} disabled={loading}>
                {loading ? "Actualizando…" : "Actualizar"}
              </Button>
            </Stack>}
          </Stack>

          {error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          ) : null}
        </Paper>

        {/* ✅ estados */}
        {loading && orders.length === 0 ? (
          <CenterLoader text="Cargando tus compras…" />
        ) : isEmpty ? (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
            <Typography sx={{ color: "text.secondary" }}>
              Aún no tienes compras realizadas.
            </Typography>
            <Button sx={{ mt: 2 }} variant="contained" onClick={() => nav("/")}>
              Ir a la tienda
            </Button>
          </Paper>
        ) : (
          <>
            <Stack spacing={2}>
              {orders.map((o) => (
                <OrderCard key={o.id} o={o} onDetails={orderDetails} />
              ))}
            </Stack>

            <Divider sx={{ my: 2 }} />

            {/* Sentinel */}
            <Box ref={sentinelRef} sx={{ height: 1 }} />

            <Box sx={{ py: 2, textAlign: "center", color: "text.secondary" }}>
              {loading && orders.length > 0 ? "Cargando más compras..." : null}
              {!hasNext && orders.length > 0 ? "Has llegado al final." : null}
            </Box>
          </>
        )}
      </Container>
    </Box>
  );
}