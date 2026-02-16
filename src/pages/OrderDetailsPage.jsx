import React, { useEffect, useMemo, useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Chip,
  Divider,
  Alert,
  Skeleton,
} from "@mui/material";

import Header from "../components/header";
import { useAuth } from "../state/AuthContext";
import { getCompraById } from "../services/compras.service";
import { fechas, puntodecimal } from "../utils/Helpers";
import { useEffectiveAuth } from "../state/useEffectiveAuth";

const LS_SHIP_CITY = "chekea_ship_city_v1";

function getShippingDays(city) {
  return city === "Bata" ? 20 : 15;
}

function formatCreatedAt(v) {
  if (!v) return "—";
  try {
    const d =
      typeof v === "number"
        ? new Date(v)
        : typeof v === "string"
        ? new Date(v)
        : typeof v?.toDate === "function"
        ? v.toDate()
        : new Date(v);

    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
  } catch {
    return "—";
  }
}

export default function OrderDetailsPage() {
  const { id: orderId } = useParams();
  const nav = useNavigate();
  const auth = useEffectiveAuth();
  const userId = auth?.user?.uid ?? null;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // localStorage solo 1 vez
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
  const createdAtLabel = useMemo(() => formatCreatedAt(order?.createdAt), [order]);

  const goBack = useCallback(() => nav(-1), [nav]);


  useEffect(() => {
    let alive = true;

    async function load() {
      setError("");
      setLoading(true);

      if (!orderId) {
        setError("No se encontró el ID del pedido.");
        setOrder(null);
        setLoading(false);
        return;
      }

      if (!userId) {
        setError("Debes iniciar sesión para ver el detalle del pedido.");
        setOrder(null);
        setLoading(false);
        return;
      }

      try {
        const data = await getCompraById(userId, orderId);
        if (!alive) return;

        if (!data) {
          setError("No existe este pedido o no tienes acceso.");
          setOrder(null);
        } else {
          setOrder(data);
        }
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Error cargando el pedido.");
        setOrder(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [userId, orderId]);

  const items = useMemo(() => (Array.isArray(order?.items) ? order.items : []), [order]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header queryText="" onQueryChange={() => {}} />

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
          Detalle de la compra
        </Typography>

        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
            <Skeleton width={240} />
            <Skeleton width={320} />
            <Divider sx={{ my: 2 }} />
            <Skeleton height={36} />
            <Skeleton height={36} />
            <Skeleton height={36} />
          </Paper>
        ) : null}

        {!loading && !order ? (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
            <Typography sx={{ fontWeight: 900 }}>Pedido no disponible</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              Revisa tu sesión o el ID del pedido.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button variant="outlined" onClick={goBack}>
                Volver a mis compras
              </Button>
            </Stack>
          </Paper>
        ) : null}

        {!loading && order ? (
          <>
            {/* RESUMEN */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 900 }}>Pedido {order.id}</Typography>

              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Fecha de Compra: {fechas(order.Fecha)}
              </Typography>
   <Typography sx={{ mt: 0.5 }}>
                Estado: <b>{order.Estado}</b>
              </Typography>
              <Divider sx={{ my: 2 }} />

             
            </Paper>

            {/* PRODUCTOS */}
            <Paper elevation={0} sx={{ mt: 2, p: 3, borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 900, mb: 2 }}>
                Producto comprado
              </Typography>
  <Paper
                    key={order?.id ?? idx}
                    variant="outlined"
                    sx={{ p: 2, borderRadius: 2 }}
                  >
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "80px 1fr auto" },
                        gap: 2,
                        alignItems: "center",
                      }}
                    >
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          borderRadius: 2,
                          overflow: "hidden",
                          bgcolor: "action.hover",
                        }}
                      >
                        {order?.Img ? (
                          <img
                            src={order.Img}
                            alt={order?.title ?? "Producto"}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            loading="lazy"
                          />
                        ) : null}
                      </Box>

                      <Box>
                        <Typography sx={{ fontWeight: 900 }}>
                          {order?.title ?? "Producto"}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Precio: XFA{order?.Precio ?? "—"} • Cantidad: {order?.qty ?? 1}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Detalles: {order.Detalles}
                        </Typography>
                          <Typography sx={{ mt: 0.5 }}>
                Tiempo estimado: <b>{shipDays} días</b>
              </Typography>
                      </Box>

                      {/* <Button
                        size="small"
                        disabled={!order?.id}
                        onClick={() => nav(`/product/${order.Producto}`)}
                      >
                        Ver producto
                      </Button> */}
                    </Box>
                  </Paper>
            </Paper>

           

            {/* TOTAL */}
            <Paper elevation={0} sx={{ mt: 2, p: 3, borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 900 }}>Total pagado</Typography>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                {puntodecimal(order.Precio + order.Envio) } XFA
              </Typography>
            </Paper>

            {/* ACCIONES */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 3 }}>
              <Button variant="outlined" onClick={goBack}>
                Volver a mis compras
              </Button>

             
            </Stack>
          </>
        ) : null}
      </Container>
    </Box>
  );
}
