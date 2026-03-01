// src/pages/CartPage.jsx
import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Container,
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  IconButton,
  Checkbox,
  Divider,
  Chip,
  Pagination,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useNavigate } from "react-router-dom";
import Header from "../components/header";
import { useCart } from "../state/CartContext";
import { puntodecimal } from "../utils/Helpers";

const PAGE_SIZE = 12;

/* -------------------- helpers seguros -------------------- */
function toNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function qtyOf(item) {
  const q = toNumber(item?.qty);
  return q > 0 ? q : 1;
}

/** peso en KG (normaliza). Prioridad: PesoKg > Peso */
function pesoKgOf(item) {
  return toNumber(item?.PesoKg ?? item?.pesoKg ?? item?.Peso ?? item?.peso ?? 0);
}

export default function CartPage() {
  const cart = useCart();
  const nav = useNavigate();

  const [page, setPage] = useState(1);

  // -------- derived state --------
  const items = cart.items ?? [];
  const itemsLen = items.length;
  const selectedIds = cart.selectedIds; // Set
  const selectedCount = cart.selectedCount ?? 0;

  const allSelected = useMemo(
    () => itemsLen > 0 && selectedCount === itemsLen,
    [itemsLen, selectedCount]
  );

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(itemsLen / PAGE_SIZE)),
    [itemsLen]
  );

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  /**
   * ✅ Totales:
   * - totalAll: suma de productos (precio * qty)
   * - totalSelected: suma de productos seleccionados (precio * qty)
   * - totalPesoAllKg: suma de pesos (kg * qty) de toda la caja
   * - totalPesoSelectedKg: suma de pesos (kg * qty) solo seleccionados
   */
  const totals = useMemo(() => {
    let totalAll = 0;
    let totalSelected = 0;

    let totalPesoAllKg = 0;
    let totalPesoSelectedKg = 0;

    for (const it of items) {
      const q = qtyOf(it);

      const priceRow = toNumber(it?.Precio) * q;
      totalAll += priceRow;

      const pesoRow = pesoKgOf(it) * q;
      totalPesoAllKg += pesoRow;

      if (selectedIds?.has(it.id)) {
        totalSelected += priceRow;
        totalPesoSelectedKg += pesoRow;
      }
    }

    return {
      totalAll: Number(totalAll.toFixed(2)),
      totalSelected: Number(totalSelected.toFixed(2)),
      totalPesoAllKg: Number(totalPesoAllKg.toFixed(3)),
      totalPesoSelectedKg: Number(totalPesoSelectedKg.toFixed(3)),
    };
  }, [items, selectedIds]);

  // -------- handlers (stable) --------
  const goCheckout = useCallback(() => {
    nav("/checkout", {
      state: {
        selectedIds: Array.from(selectedIds ?? []),
        totalPesoSelectedKg: totals.totalPesoSelectedKg, // ✅ PASAMOS EL PESO TOTAL
      },
    });
  }, [selectedIds, nav, totals.totalPesoSelectedKg]);

  const onPageChange = useCallback((_e, nextPage) => {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) cart.clearSelection();
    else cart.selectAll();
  }, [allSelected, cart]);

  const showMobileFixedCTA = cart.ready && itemsLen > 0;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header queryText="" onQueryChange={() => {}} />

      <Container
        maxWidth="lg"
        sx={{
          py: { xs: 2, md: 3 },
          pb: { xs: showMobileFixedCTA ? 10 : 3, md: 3 },
        }}
      >
        {/* Header */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{
            alignItems: { xs: "stretch", sm: "center" },
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Mi caja
          </Typography>

          {itemsLen > 0 && (
            <Chip
              label={`Seleccionados: ${selectedCount}/${itemsLen}`}
              variant="outlined"
              sx={{ width: { xs: "fit-content", sm: "auto" } }}
            />
          )}
        </Stack>

        {!cart.ready ? (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
            <Typography sx={{ color: "text.secondary" }}>Cargando tu caja…</Typography>
          </Paper>
        ) : itemsLen === 0 ? (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
            <Typography sx={{ color: "text.secondary" }}>Tu caja está vacía.</Typography>
            <Button sx={{ mt: 2 }} variant="contained" onClick={() => nav("/")}>
              Ir a la tienda
            </Button>
          </Paper>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 360px" },
              gap: 2,
              alignItems: "start",
            }}
          >
            {/* LISTA */}
            <Stack spacing={1}>
              {/* Toolbar */}
              <Paper elevation={0} sx={{ p: { xs: 1.25, sm: 1.5 }, borderRadius: 3 }}>
                <Stack spacing={1}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Checkbox
                      checked={allSelected}
                      indeterminate={!allSelected && selectedCount > 0}
                      onChange={toggleAll}
                    />
                    <Typography sx={{ fontWeight: 800 }}>
                      {allSelected ? "Todo seleccionado" : "Seleccionar productos"}
                    </Typography>
                  </Box>

                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ flexWrap: "wrap" }}
                  >
                    <Button size="small" onClick={cart.selectAll}>
                      Seleccionar todo
                    </Button>
                    <Button size="small" onClick={cart.clearSelection}>
                      Limpiar selección
                    </Button>
                    <Button size="small" color="error" onClick={cart.clear}>
                      Vaciar caja
                    </Button>
                  </Stack>
                </Stack>
              </Paper>

              {/* ITEMS */}
              {pagedItems.map((p) => {
                const checked = selectedIds?.has(p.id);
                const q = qtyOf(p);
                const subtotalProducto = toNumber(p?.Precio) * q;
                const pesoRow = pesoKgOf(p) * q;

                return (
                  <Paper
                    key={p.id}
                    elevation={0}
                    sx={{
                      p: { xs: 1.25, sm: 2 },
                      borderRadius: 3,
                      border: checked ? "1px solid" : "1px solid transparent",
                      borderColor: checked ? "primary.main" : "transparent",
                      transition: "150ms ease",
                    }}
                  >
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "auto 64px 1fr auto", sm: "auto 64px 1fr auto" },
                        alignItems: "center",
                        gap: { xs: 1, sm: 2 },
                      }}
                    >
                      <Checkbox checked={checked} onChange={() => cart.toggleSelect(p.id)} />

                      <Box
                        sx={{
                          width: 64,
                          height: 64,
                          borderRadius: 2,
                          overflow: "hidden",
                          bgcolor: "rgba(0,0,0,0.04)",
                          flex: "0 0 auto",
                        }}
                      >
                        <img
                          src={p.Img}
                          alt={p.Titulo}
                          width="64"
                          height="64"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                          loading="lazy"
                          decoding="async"
                        />
                      </Box>

                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 900 }} noWrap title={p.Titulo}>
                          {p.Titulo}
                        </Typography>

                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Producto: XFA {puntodecimal(subtotalProducto)}
                        </Typography>

                        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
                          Cantidad: <b>{q}</b> • Peso: <b>{pesoRow.toFixed(3)} kg</b>
                        </Typography>

                        {p.Detalles ? (
                          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                            {p.Detalles}
                          </Typography>
                        ) : null}
                      </Box>

                      <IconButton onClick={() => cart.remove(p.id)} aria-label="Eliminar">
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Box>
                  </Paper>
                );
              })}

              {/* Pagination */}
              {pageCount > 1 && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 1 }}>
                  <Pagination
                    count={pageCount}
                    page={page}
                    onChange={onPageChange}
                    color="primary"
                    shape="rounded"
                    siblingCount={0}
                    boundaryCount={1}
                  />
                </Box>
              )}
            </Stack>

            {/* RESUMEN */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 2,
                height: "fit-content",
                position: { md: "sticky" },
                top: { md: 90 },
              }}
            >
              <Typography sx={{ fontWeight: 900, mb: 1 }}>Resumen</Typography>

              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                <Typography sx={{ color: "text.secondary" }}>Seleccionados</Typography>
                <Typography sx={{ fontWeight: 900 }}>{selectedCount}</Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                <Typography sx={{ color: "text.secondary" }}>Peso seleccionados</Typography>
                <Typography sx={{ fontWeight: 900 }}>
                  {totals.totalPesoSelectedKg} kg
                </Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
                <Typography sx={{ color: "text.secondary" }}>Total seleccionados</Typography>
                <Typography sx={{ fontWeight: 900 }}>
                  XFA {puntodecimal(totals.totalSelected)}
                </Typography>
              </Box>

              <Button
                variant="contained"
                fullWidth
                disabled={selectedCount === 0}
                onClick={goCheckout}
                sx={{ display: { xs: "none", md: "flex" } }}
              >
                Ir a pagar seleccionados
              </Button>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ color: "text.secondary" }}>Total de la caja</Typography>
                <Typography sx={{ fontWeight: 700 }}>
                  XFA {puntodecimal(totals.totalAll)}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                <Typography sx={{ color: "text.secondary" }}>Peso total caja</Typography>
                <Typography sx={{ fontWeight: 700 }}>
                  {totals.totalPesoAllKg} kg
                </Typography>
              </Box>

              {selectedCount === 0 ? (
                <Typography sx={{ mt: 1, color: "text.secondary" }} variant="body2">
                  Selecciona al menos un producto para pagar.
                </Typography>
              ) : null}
            </Paper>
          </Box>
        )}
      </Container>

      {/* CTA MÓVIL */}
      {showMobileFixedCTA ? (
        <Box
          sx={{
            display: { xs: "block", md: "none" },
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1200,
            bgcolor: "background.paper",
            borderTop: "1px solid",
            borderColor: "divider",
            boxShadow: "0 -8px 24px rgba(0,0,0,0.08)",
            pb: "env(safe-area-inset-bottom)",
          }}
        >
          <Container maxWidth="lg" sx={{ py: 1.25 }}>
            <Button
              variant="contained"
              fullWidth
              size="large"
              disabled={selectedCount === 0}
              onClick={goCheckout}
              sx={{ fontWeight: 900, borderRadius: 2 }}
            >
              Ir a pagar seleccionados
            </Button>
          </Container>
        </Box>
      ) : null}
    </Box>
  );
}