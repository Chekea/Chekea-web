// src/pages/CheckoutPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Container, Box, Paper, Typography, Stack, Button, Alert, Chip } from "@mui/material";
import Header from "../components/header";
import { useCart } from "../state/CartContext";
import { useAuth } from "../state/AuthContext";
import { useOrders } from "../state/OrderContext";
import { puntodecimal } from "../utils/Helpers";
import { serverTimestamp, Timestamp } from "firebase/firestore";
import { getCurrentTimestamp } from "../services/compras.service";

export default function CheckoutPage() {
  const cart = useCart();
  const nav = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const ordersApi = useOrders();

  const buyNowItem = location.state?.buyNowItem ?? null;
  const selectedIdsArr = location.state?.selectedIds ?? [];
  const selectedIds = useMemo(() => new Set(selectedIdsArr), [selectedIdsArr]);
  
  const isBuyNow = Boolean(buyNowItem);

  const itemsToPay = useMemo(() => {
    if (buyNowItem) return [buyNowItem];
    if (selectedIds.size > 0) return cart.items.filter((it) => selectedIds.has(it.id));
    return [];
  }, [buyNowItem, cart.items, selectedIds]);

  console.log(itemsToPay,'wetin')

  // NOTE: aquí sumo precio * qty (si tu total incluye envío, añade + it.envio * qty)
const totalToPay = useMemo(() => {
  const total = itemsToPay.reduce((acc, it) => {
    const qty = Math.max(1, Number(it.qty ?? 1));
    const precioUnitario = Number(it.Precio ?? 0);
    const envioUnitario = Number(it.Envio ?? 0);
    console.log(envioUnitario)

    return acc + (precioUnitario * qty) + (envioUnitario);
  }, 0);

  return Number(total.toFixed(2));
}, [itemsToPay]);


  const [orderId, setOrderId] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header queryText="" onQueryChange={() => {}} />
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>Checkout</Typography>

          {err && <Alert severity="error" sx={{ mt: 2 }}>{err}</Alert>}

          {itemsToPay.length === 0 ? (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ color: "text.secondary" }}>
                No hay productos seleccionados para pagar.
              </Typography>
              <Button sx={{ mt: 2 }} variant="contained" onClick={() => nav("/cart")}>
                Volver a la caja
              </Button>
            </Box>
          ) : (
            <Box sx={{ mt: 2, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 360px" }, gap: 2 }}>
              <Box>
                <Typography sx={{ fontWeight: 800, mb: 1 }}>
                  {isBuyNow ? "Compra directa" : "Productos seleccionados"}{" "}
                  <Chip size="small" label={`${itemsToPay.length}`} sx={{ ml: 1 }} />
                </Typography>

                <Stack spacing={1}>
                  {itemsToPay.map((item) => (
                    <Paper key={item.id} sx={{ p: 2, mb: 1.5, borderRadius: 2 }}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <img
                          src={item.Img}
                          alt={item.titulo}
                          style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover" }}
                        />

                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontWeight: 900 }}>{item.titulo}</Typography>

                          <Typography sx={{ color: "text.secondary" }}>
                            Cantidad: <b>{item.qty ?? 1}</b>
                          </Typography>

                          <Typography sx={{ mt: 0.5 }}>
                            Precio: <b>XFA {puntodecimal(item.Precio) } </b> 
                          </Typography>
   <Typography sx={{ mt: 0.5 }}>
                            Envio: <b>XFA {puntodecimal(item.Envio) } </b>  
                          </Typography>
                          {/* detalles string del carrito */}
                          {item.Detalles && (
                            <Typography sx={{ mt: 0.5, color: "text.secondary" }} variant="body2">
                              {item.Detalles}
                            </Typography>
                          )}

                          {/* chips si existe item.details */}
                          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                            {item.details?.shipCity && (
                              <Chip size="small" label={`Ciudad: ${item.details.shipCity}`} />
                            )}
                            {item.details?.color?.nombre && (
                              <Chip size="small" label={`Color: ${item.details.color.nombre}`} />
                            )}
                            {item.details?.style?.nombre && (
                              <Chip size="small" label={`Estilo: ${item.details.style.nombre}`} />
                            )}
                            {item.details?.shipMethod && (
                              <Chip
                                size="small"
                                label={`Envío: ${
                                  item.details.shipMethod === "AIR" ? "Aéreo" : "Marítimo"
                                }`}
                              />
                            )}
                          </Stack>

                          {item.details?.shipDurationText && (
                            <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
                              Entrega estimada: <b>{item.details.shipDurationText}</b>
                            </Typography>
                          )}
                        </Box>

                        {/* Solo tiene sentido “Quitar” si viene del carrito */}
                        {!isBuyNow && (
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={() => cart.remove(item.id)}
                          >
                            Quitar
                          </Button>
                        )}
                      </Stack>
                    </Paper>
                  ))}
                </Stack>

                {!isBuyNow && (
                  <Button sx={{ mt: 2 }} onClick={() => cart.clear()}>
                    Vaciar carrito
                  </Button>
                )}
              </Box>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: "fit-content" }}>
                <Typography sx={{ fontWeight: 900 }}>Total: XFA {puntodecimal(totalToPay)}</Typography>
    
                <Button
                  variant="contained"
                  fullWidth
                  sx={{ mt: 2 }}
                  onClick={() => {
                 const now = getCurrentTimestamp();
                    if (!auth.isAuthed) { nav("/login"); return; }

                    
                    nav(`/verify/${now}`,{ state: { itemsToPay } });
                  }}
                >
Realizar Pago (Presencial o Electronico)                </Button>

                <Button sx={{ mt: 1 }} fullWidth onClick={() => nav("/")}>
                  Seguir comprando
                </Button>

                {isBuyNow && (
                  <Button sx={{ mt: 1 }} fullWidth variant="outlined" onClick={() => nav(-1)}>
                    Volver al producto
                  </Button>
                )}
                {!isBuyNow && (
                  <Button sx={{ mt: 1 }} fullWidth variant="outlined" onClick={() => nav("/cart")}>
                    Volver a la caja
                  </Button>
                )}
              </Paper>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
