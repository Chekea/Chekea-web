// src/pages/CheckoutPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Container,
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Alert,
  Chip,
  Divider,
} from "@mui/material";
import Header from "../components/header";
import { useCart } from "../state/CartContext";
import { useAuth } from "../state/AuthContext";
import { puntodecimal } from "../utils/Helpers";
import { getCurrentTimestamp, checkCompras } from "../services/compras.service";

export default function CheckoutPage() {
  const cart = useCart();
  const nav = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  const buyNowItem = location.state?.buyNowItem ?? null;
  const selectedIdsArr = location.state?.selectedIds ?? [];

  const selectedIds = useMemo(() => new Set(selectedIdsArr), [selectedIdsArr]);
  const isBuyNow = Boolean(buyNowItem);

  // Items a pagar: buyNow o selección del carrito
  const itemsToPay = useMemo(() => {
    if (buyNowItem) return [buyNowItem];
    if (selectedIds.size > 0) return cart.items.filter((it) => selectedIds.has(it.id));
    return [];
  }, [buyNowItem, cart.items, selectedIds]);

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // null = verificando, true = ya tiene compras, false = no tiene compras
  const [hasPurchases, setHasPurchases] = useState(null);

  // Verifica si el usuario ya compró para aplicar descuento
  useEffect(() => {
    let alive = true;

    async function run() {
      setErr("");

      if (!auth.isAuthed || !auth.user?.uid) {
        if (alive) setHasPurchases(null);
        return;
      }

      try {
        if (alive) setHasPurchases(null); // verificando
        const result = await checkCompras({ userId: auth.user.uid }); // true si tiene compras
        if (alive) setHasPurchases(result);
      } catch (e) {
        console.error(e);
        if (alive) setHasPurchases(true); // fallback: no descuento
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [auth.isAuthed, auth.user?.uid]);

  // ✅ Descuento: 10% SOLO al precio del producto (NO al envío)
  const discountRate = hasPurchases === false ? 0.10 : 0;

  /**
   * Vamos a desglosar:
   * - productsSubtotal: suma de (Precio * qty) sin envío
   * - shippingTotal: suma de Envio (por item; si es por unidad, multiplica por qty)
   * - discountAmount: 10% de productsSubtotal
   * - finalTotal: (productsSubtotal - discountAmount) + shippingTotal
   */
  const totals = useMemo(() => {
    const productsSubtotal = itemsToPay.reduce((acc, it) => {
      const qty = Math.max(1, Number(it.qty ?? 1));
      const precioUnitario = Number(it.Precio ?? 0);
      return acc + precioUnitario * qty;
    }, 0);

    const shippingTotal = itemsToPay.reduce((acc, it) => {
      const qty = Math.max(1, Number(it.qty ?? 1));
      const envioUnitario = Number(it.Envio ?? 0);

      // ⚠️ Si tu envío es por unidad, usa: (envioUnitario * qty)
      // Si tu envío es por producto (una sola vez), deja: envioUnitario
      return acc + envioUnitario; // cambia a: acc + (envioUnitario * qty) si aplica
    }, 0);

    const discountAmount = Number((productsSubtotal * discountRate).toFixed(2));

    const finalTotal = Number((productsSubtotal - discountAmount + shippingTotal).toFixed(2));

    return {
      productsSubtotal: Number(productsSubtotal.toFixed(2)),
      shippingTotal: Number(shippingTotal.toFixed(2)),
      discountAmount,
      finalTotal,
    };
  }, [itemsToPay, discountRate]);

  const handlePay = useCallback(() => {
    setErr("");

    const now = getCurrentTimestamp();

    if (!auth.isAuthed) {
      nav("/login");
      return;
    }

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

  const handleGoCart = useCallback(() => nav("/cart"), [nav]);
  const handleGoHome = useCallback(() => nav("/"), [nav]);
  const handleBack = useCallback(() => nav(-1), [nav]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header queryText="" onQueryChange={() => {}} />

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Checkout
          </Typography>

          {err && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {err}
            </Alert>
          )}

          {itemsToPay.length === 0 ? (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ color: "text.secondary" }}>
                No hay productos seleccionados para pagar.
              </Typography>
              <Button sx={{ mt: 2 }} variant="contained" onClick={handleGoCart}>
                Volver a la caja
              </Button>
            </Box>
          ) : (
            <Box
              sx={{
                mt: 2,
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 360px" },
                gap: 2,
              }}
            >
              {/* LISTA */}
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
                          style={{
                            width: 72,
                            height: 72,
                            borderRadius: 12,
                            objectFit: "cover",
                          }}
                        />

                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontWeight: 900 }}>{item.titulo}</Typography>

                          <Typography sx={{ color: "text.secondary" }}>
                            Cantidad: <b>{item.qty ?? 1}</b>
                          </Typography>

                          <Typography sx={{ mt: 0.5 }}>
                            Precio: <b>XFA {puntodecimal(item.Precio)}</b>
                          </Typography>

                          <Typography sx={{ mt: 0.5 }}>
                            Envio: <b>XFA {puntodecimal(item.Envio)}</b>
                          </Typography>

                          {item.Detalles && (
                            <Typography
                              sx={{ mt: 0.5, color: "text.secondary" }}
                              variant="body2"
                            >
                              {item.Detalles}
                            </Typography>
                          )}

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

              {/* RESUMEN */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: "fit-content" }}>
                <Stack spacing={1}>
                  <Typography sx={{ fontWeight: 800 }}>
                    Productos: XFA {puntodecimal(totals.productsSubtotal)}
                  </Typography>

                  <Typography sx={{ fontWeight: 800 }}>
                    Envío: XFA {puntodecimal(totals.shippingTotal)}
                  </Typography>

                  {hasPurchases === null && auth.isAuthed && (
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      Verificando descuento...
                    </Typography>
                  )}

                  {hasPurchases === false && (
                    <>
                      <Typography sx={{ fontWeight: 800, color: "success.main" }}>
                        Descuento solo en productos (10%): XFA -{puntodecimal(totals.discountAmount)}
                      </Typography>
                      <Divider />
                    </>
                  )}

                  <Typography sx={{ fontWeight: 900 }}>
                    Total: XFA {puntodecimal(totals.finalTotal)}
                  </Typography>

                  <Button
                    variant="contained"
                    fullWidth
                    sx={{ mt: 1 }}
                    onClick={handlePay}
                    disabled={loading || itemsToPay.length === 0}
                  >
                    Realizar Pago (Presencial o Electronico)
                  </Button>

                  <Button sx={{ mt: 1 }} fullWidth onClick={handleGoHome}>
                    Seguir comprando
                  </Button>

                  {isBuyNow ? (
                    <Button sx={{ mt: 1 }} fullWidth variant="outlined" onClick={handleBack}>
                      Volver al producto
                    </Button>
                  ) : (
                    <Button
                      sx={{ mt: 1 }}
                      fullWidth
                      variant="outlined"
                      onClick={handleGoCart}
                    >
                      Volver a la caja
                    </Button>
                  )}
                </Stack>
              </Paper>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
