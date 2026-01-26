import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Container,
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  Alert,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import Header from "../components/header";
import { useAuth } from "../state/AuthContext";

// ✅ NUEVO: servicio Firestore
import { listMyOrdersPageFS } from "../services/orders.firestore.service";

export default function OrdersPage() {
  const auth = useAuth();
  const nav = useNavigate();

  // paging state
  const [orders, setOrders] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasNext, setHasNext] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);
  const hasNextRef = useRef(false);
  const cursorRef = useRef(null);

  // ✅ redirect login (sin side-effect en render)
  useEffect(() => {
    if (!auth.loading && !auth.isAuthed) nav("/login", { replace: true });
  }, [auth.loading, auth.isAuthed, nav]);

  const userId = auth.user?.id;

  // first load
  useEffect(() => {
    let alive = true;

    if (!userId) return;

    (async () => {
      setLoading(true);
      loadingRef.current = true;
      setError("");

      try {
        const res = await listMyOrdersPageFS({
          userId,
          pageSize: 10,
          cursor: null,
        });

        if (!alive) return;

        setOrders(res.items);
        setHasNext(res.hasNext);
        setCursor(res.cursor);

        console.log(res.items,'sss')
        hasNextRef.current = res.hasNext;
        cursorRef.current = res.cursor;
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setError("Error cargando tus compras.");
      } finally {
        if (!alive) return;
        setLoading(false);
        loadingRef.current = false;
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);
      console.log(userId,'estamos')


  const loadMore = async () => {
    if (!userId) return;
    if (loadingRef.current) return;
    if (!hasNextRef.current) return;

    setLoading(true);
    loadingRef.current = true;
    setError("");


    try {
      const res = await listMyOrdersPageFS({
        userId,
        pageSize: 10,
        cursor: cursorRef.current,
      });

      console.log(res,'oi')
      setOrders((prev) => [...prev, ...res.items]);
      setHasNext(res.hasNext);
      setCursor(res.cursor);

      hasNextRef.current = res.hasNext;
      cursorRef.current = res.cursor;
    } catch (e) {
      console.error(e);
      setError("Error cargando más compras.");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  // observer
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: "600px", threshold: 0.01 }
    );

    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const isEmpty = useMemo(() => !loading && orders.length === 0, [loading, orders.length]);

  const orderDetails=(id)=>{
    console.log(id)
  console.log(auth)

    nav(`/orders/${id}`)
  }

  if (auth.loading) return null;
  if (!auth.isAuthed) return null;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header queryText="" onQueryChange={() => {}} />

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
          Mis compras
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {isEmpty ? (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
            <Typography sx={{ color: "text.secondary" }}>
              Aún no tienes compras realizadas.
            </Typography>
            <Button sx={{ mt: 2 }} variant="contained" onClick={() => nav("/")}>
              Ir a la tienda
            </Button>
          </Paper>
        ) : (
          <Stack spacing={2}>
            {orders.map((o) => {
              const mainItem = o;
              console.log(o,'mani')
              const createdAtDate =
                o._createdAtMs ? new Date(o._createdAtMs) :
                o.createdAt?.toDate ? o.createdAt.toDate() :
                o.createdAt ? new Date(o.createdAt) : null;

              return (
                <Paper key={o.id} elevation={0} sx={{ p: 2, borderRadius: 3 }}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "80px 1fr auto" },
                      gap: 2,
                      alignItems: "center",
                    }}
                  >
                    {/* Imagen */}
                    <Box
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: 2,
                        overflow: "hidden",
                        bgcolor: "grey.100",
                      }}
                    >
                      <img
                        src={mainItem?.Img || ""}
                        alt={mainItem?.title || "Producto"}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </Box>

                    {/* Info */}
                    <Box>
                      <Typography sx={{ fontWeight: 900 }}>
                        {mainItem?.Titulo}
                      </Typography>

                
                   
                    </Box>

                    {/* Acciones */}
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}
                    >
                      <Chip label={mainItem?.Estado } />

                      <Button size="small" variant="outlined" onClick={() => orderDetails(o.id)}>
                        Ver detalles
                      </Button>

                    </Stack>
                  </Box>
                </Paper>
              );
            })}

            {/* Sentinel */}
            <Box ref={sentinelRef} sx={{ height: 1 }} />

            <Box sx={{ py: 2, textAlign: "center", color: "text.secondary" }}>
              {loading && orders.length > 0 ? "Cargando más compras..." : null}
              {!hasNext && orders.length > 0 ? "Has llegado al final." : null}
            </Box>
          </Stack>
        )}
      </Container>
    </Box>
  );
}
