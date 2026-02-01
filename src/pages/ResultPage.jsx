// src/pages/SearchResultsPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Container, Paper, Typography, Stack, TextField, MenuItem, Button, Alert } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import Header from "../components/header";
import ProductGrid from "../components/productgrid";
import { searchProductsFS } from "../services/product.firesore.service";

function clampInt(v, fallback, min = 0, max = 1_000_000) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function clampNum(v, fallback, min = 0, max = 1_000_000) {
  const n = Number(String(v ?? ""));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export default function SearchResultsPage() {
  const [params, setParams] = useSearchParams();
  const topRef = useRef(null);

  // --- URL state ---
  const q = params.get("q") ?? "";
  const cat = params.get("cat") ?? "ALL";
  const sort = params.get("sort") ?? "newest";
  const pageSize = clampInt(params.get("size"), 12, 4, 60);

  const min = params.get("min") ? clampNum(params.get("min"), 0) : null;
  const max = params.get("max") ? clampNum(params.get("max"), 0) : null;

  // --- data state ---
  const [items, setItems] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasNext, setHasNext] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const updateParams = (patch, replace = true) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "") next.delete(k);
      else next.set(k, String(v));
    });
    setParams(next, { replace });
  };

  // reset cursor cuando cambian filtros/búsqueda
  const resetKey = useMemo(() => JSON.stringify({ q, cat, sort, min, max, pageSize }), [q, cat, sort, min, max, pageSize]);

  useEffect(() => {
    setItems([]);
    setLastDoc(null);
    setHasNext(false);
  }, [resetKey]);

  // fetch first page (o refetch con filtros)
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr("");

      try {
        const res = await searchProductsFS({
          qText: q,
          category: cat,
          sort,
          pageSize,
          lastDoc: null,
          minPrice: min,
          maxPrice: max,
        });
        

        if (!alive) return;

        setItems(res.items);
        setLastDoc(res.lastDoc);
        setHasNext(res.hasNext);
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setErr("No se pudieron cargar los resultados.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [resetKey]); // 👈 se recarga cuando cambian filtros

  const loadMore = async () => {
    if (loading || !hasNext) return;
    setLoading(true);
    setErr("");

    try {
      const res = await searchProductsFS({
        qText: q,
        category: cat,
        sort,
        pageSize,
        lastDoc,
        minPrice: min,
        maxPrice: max,
      });

      setItems((prev) => [...prev, ...res.items]);
      setLastDoc(res.lastDoc);
      setHasNext(res.hasNext);
    } catch (e) {
      console.error(e);
      setErr("No se pudo cargar más.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Header reutiliza la barra y escribe en URL */}
      <Header
        queryText={q}
        onQueryChange={(val) => updateParams({ q: val }, true)}
      />

      <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2 }, py: { xs: 2, md: 3 } }}>
        <Box ref={topRef} />

        <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            Resultados {q ? `para “${q}”` : ""}
          </Typography>

          {/* Filtros */}
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{ mt: 2 }}
          >
            <TextField
              select
              size="small"
              label="Categoría"
              value={cat}
              onChange={(e) => updateParams({ cat: e.target.value })}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="ALL">Todas</MenuItem>
              <MenuItem value="FASHION">Moda</MenuItem>
              <MenuItem value="BEAUTY">Belleza</MenuItem>
              <MenuItem value="HOME">Hogar</MenuItem>
              <MenuItem value="SPORTS">Deporte</MenuItem>
              <MenuItem value="BABY">Bebés</MenuItem>
              <MenuItem value="ELECTRONICS">Electrónica</MenuItem>
              <MenuItem value="OTHERS">Otros</MenuItem>
            </TextField>


        
            <TextField
              select
              size="small"
              label="Orden"
              value={sort}
              onChange={(e) => updateParams({ sort: e.target.value })}
              sx={{ minWidth: 180 }}
            >
             <MenuItem value="relevance">Por defecto</MenuItem>

              <MenuItem value="newest">Más nuevos</MenuItem>
              
              <MenuItem value="price_asc">Precio (↑)</MenuItem>
              <MenuItem value="price_desc">Precio (↓)</MenuItem>
            </TextField>

            {/* <TextField
              size="small"
              label="Precio mínimo"
              value={min ?? ""}
              onChange={(e) => updateParams({ min: e.target.value || "" })}
              sx={{ width: { xs: "100%", md: 160 } }}
            />
            <TextField
              size="small"
              label="Precio máximo"
              value={max ?? ""}
              onChange={(e) => updateParams({ max: e.target.value || "" })}
              sx={{ width: { xs: "100%", md: 160 } }}
            /> */}

            {/* <Button
              variant="outlined"
              onClick={() => updateParams({ cat: "ALL", sort: "newest", min: "", max: "" })}
              sx={{ ml: { md: "auto" } }}
            >
              Limpiar filtros
            </Button> */}
          </Stack>
        </Paper>

        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

        <ProductGrid items={items} loading={loading && items.length === 0} />

        {/* Load more */}
        <Stack alignItems="center" sx={{ mt: 2 }}>
          {hasNext ? (
            <Button variant="contained" onClick={loadMore} disabled={loading}>
              {loading ? "Cargando..." : "Cargar más"}
            </Button>
          ) : (
            <Typography sx={{ color: "text.secondary", mt: 1 }}>
              No hay más resultados.
            </Typography>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
