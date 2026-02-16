// src/pages/CheckoutPage.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  memo,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";

import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import useMediaQuery from "@mui/material/useMediaQuery";

import { useTheme } from "@mui/material/styles";

import { useCart } from "../state/CartContext";
import { useAuth } from "../state/AuthContext";
import { puntodecimal } from "../utils/Helpers";
import { getCurrentTimestamp, checkCompras } from "../services/compras.service";
import { getCheckoutFromCache } from "../utils/checkoutwebview";

/* =========================
   HEADER SOLO DESKTOP (LAZY)
========================= */
function useDesktopHeader() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [HeaderComp, setHeaderComp] = useState(null);

  useEffect(() => {
    if (!isDesktop) return;

    let mounted = true;

    import("../components/header").then((mod) => {
      if (mounted) setHeaderComp(() => mod.default);
    });

    return () => {
      mounted = false;
    };
  }, [isDesktop]);

  return { isDesktop, HeaderComp };
}

/* =========================
   BOTÓN FIXED OPTIMIZADO
========================= */
const MobileFixedPayBar = memo(function MobileFixedPayBar({
  visible,
  total,
  onPay,
  disabled,
}) {
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
            <Typography sx={{ fontWeight: 900 }}>
              XFA {puntodecimal(total)}
            </Typography>
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
   ITEM MEMOIZADO
========================= */
const CheckoutItem = memo(function CheckoutItem({
  item,
  isBuyNow,
  locationState,
  onRemove,
}) {
  return (
    <Paper sx={{ p: 2, mb: 1.5, borderRadius: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <img
          src={item.Img}
          alt={item.titulo}
          loading="lazy"
          decoding="async"
          style={{
            width: 72,
            height: 72,
            borderRadius: 12,
            objectFit: "cover",
          }}
        />

        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 900 }}>
            {item.titulo}
          </Typography>

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
        </Box>

        {!isBuyNow && locationState && (
          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={() => onRemove(item.id)}
          >
            Quitar
          </Button>
        )}
      </Stack>
    </Paper>
  );
});

export default function CheckoutPage() {
  const cart = useCart();
  const nav = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  const { isDesktop, HeaderComp } = useDesktopHeader();

  const buyNowItem = location.state?.buyNowItem ?? null;
  const selectedIdsArr = location.state?.selectedIds ?? [];
  const isBuyNow = Boolean(buyNowItem);

  const selectedIds =
    selectedIdsArr.length > 0 ? new Set(selectedIdsArr) : null;

  const webviewItems = useMemo(() => {
    if (location.state) return null;
    return getCheckoutFromCache();
  }, [location.state]);

  const itemsToPay = useMemo(() => {
    if (buyNowItem) return [buyNowItem];
    if (selectedIds)
      return cart.items.filter((it) => selectedIds.has(it.id));
    if (webviewItems?.length) return webviewItems;
    return [];
  }, [buyNowItem, selectedIds, cart.items, webviewItems]);

  const [hasPurchases, setHasPurchases] = useState(null);

  useEffect(() => {
    const uid = auth.user?.uid;
    if (!auth.isAuthed || !uid) return;

    let alive = true;

    checkCompras({ userId: uid })
      .then((res) => {
        if (alive) setHasPurchases(res);
      })
      .catch(() => {
        if (alive) setHasPurchases(true);
      });

    return () => {
      alive = false;
    };
  }, [auth.isAuthed, auth.user?.uid]);

  const discountRate = hasPurchases === false ? 0.1 : 0;

  const totals = useMemo(() => {
    let products = 0;
    let shipping = 0;

    for (let i = 0; i < itemsToPay.length; i++) {
      const it = itemsToPay[i];
      const qty = it.qty ?? 1;
      products += it.Precio * qty;
      shipping += it.Envio;
    }

    const discount = products * discountRate;
    const final = products - discount + shipping;

    return {
      productsSubtotal: products,
      shippingTotal: shipping,
      discountAmount: discount,
      finalTotal: final,
    };
  }, [itemsToPay, discountRate]);

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

  const handleRemove = useCallback(
    (id) => cart.remove(id),
    [cart]
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {isDesktop && HeaderComp && (
        <HeaderComp queryText="" onQueryChange={() => {}} />
      )}

      <MobileFixedPayBar
        visible={itemsToPay.length > 0}
        total={totals.finalTotal}
        onPay={handlePay}
        disabled={itemsToPay.length === 0}
      />

      <Container maxWidth="lg" sx={{ py: 3, pb: { xs: 13, md: 3 } }}>
        <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Checkout
          </Typography>

          {/* 🔴 TU TEXTO ORIGINAL SE MANTIENE */}
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography sx={{ fontWeight: 900 }}>
              Aviso importante sobre envíos
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Debido a las festividades del <b>Año Nuevo Chino</b>, las operaciones logísticas
              se encuentran temporalmente pausadas. Los envíos se retomarán a partir del{" "}
              <b>23 de febrero</b>.
            </Typography>
          </Alert>

          {itemsToPay.length === 0 ? (
            <Typography sx={{ mt: 2 }}>
              No hay productos seleccionados para pagar.
            </Typography>
          ) : (
            <>
              <Box sx={{ mt: 2 }}>
                {itemsToPay.map((item) => (
                  <CheckoutItem
                    key={item.id}
                    item={item}
                    isBuyNow={isBuyNow}
                    locationState={location.state}
                    onRemove={handleRemove}
                  />
                ))}
              </Box>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mt: 2 }}>
                <Typography sx={{ fontWeight: 800 }}>
                  Productos: XFA {puntodecimal(totals.productsSubtotal)}
                </Typography>

                <Typography sx={{ fontWeight: 800 }}>
                  Envío: XFA {puntodecimal(totals.shippingTotal)}
                </Typography>

                {hasPurchases === false && (
                  <>
                    <Typography sx={{ fontWeight: 800, color: "success.main" }}>
                      Descuento solo en productos (10%): XFA -
                      {puntodecimal(totals.discountAmount)}
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
                >
                  Realizar Pago (Presencial o Electronico)
                </Button>
              </Paper>
            </>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
