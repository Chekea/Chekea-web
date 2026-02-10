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

export default function CartPage() {
  const cart = useCart();
  const nav = useNavigate();

  const [page, setPage] = useState(1);

  // -------- Derived state (minimize repeated lookups) --------
  const itemsLen = cart.items?.length ?? 0;
  const selectedCount = cart.selectedCount;

  const totalAll = useMemo(() => Number(cart.total().toFixed(2)), [cart]);
  const totalSelected = useMemo(() => Number(cart.selectedTotal().toFixed(2)), [cart]);

  const allSelected = useMemo(
    () => itemsLen > 0 && selectedCount === itemsLen,
    [itemsLen, selectedCount]
  );

  const pageCount = useMemo(() => Math.max(1, Math.ceil(itemsLen / PAGE_SIZE)), [itemsLen]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return cart.items.slice(start, start + PAGE_SIZE);
  }, [cart.items, page]);

  // -------- Handlers (stable) --------
  const goCheckout = useCallback(() => {
    nav("/checkout", { state: { selectedIds: Array.from(cart.selectedIds) } });
  }, [cart.selectedIds, nav]);

  const onPageChange = useCallback((_e, nextPage) => {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) cart.clearSelection();
    else cart.selectAll();
  }, [allSelected, cart]);

  const showMobileFixedCTA = cart.ready && itemsLen > 0; // siempre visible en móvil (aunque deshabilitado si 0)

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header queryText="" onQueryChange={() => {}} />

      <Container
        maxWidth="lg"
        sx={{
          py: { xs: 2, md: 3 },
          // ✅ espacio para que el botón fijo no tape la paginación / último item
          pb: { xs: showMobileFixedCTA ? 10 : 3, md: 3 },
        }}
      >
        {/* Header row responsive */}
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
              {/* toolbar responsive */}
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

              {/* ✅ items paginados */}
              {pagedItems.map((p) => {
                const checked = cart.selectedIds.has(p.id);

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
                        }}
                      >
                        <img
                          src={p.Img}
                          alt={p.Titulo}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          loading="lazy"
                        />
                      </Box>

                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 900 }} noWrap>
                          {p.Titulo}
                        </Typography>

                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          XFA {puntodecimal(p.Precio)}{" "}
                          <Box component="span" sx={{ mx: 0.5 }}>
                            +
                          </Box>
                          (Envío) {puntodecimal(p.Envio)}
                        </Typography>

                        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
                          Cantidad: <b>{p.qty ?? 1}</b>
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

              {/* ✅ pagination */}
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

            {/* RESUMEN - sticky en desktop */}
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

              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
                <Typography sx={{ color: "text.secondary" }}>Total seleccionados</Typography>
                <Typography sx={{ fontWeight: 900 }}>XFA {puntodecimal(totalSelected)}</Typography>
              </Box>

              {/* ✅ este botón solo desktop; en móvil será fijo abajo */}
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
                <Typography sx={{ fontWeight: 700 }}>XFA {puntodecimal(totalAll)}</Typography>
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

      {/* ✅ MISMO BOTÓN, FIXED ABAJO SOLO EN MÓVIL (sin extras) */}
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
            pb: "env(safe-area-inset-bottom)", // iOS safe area
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
