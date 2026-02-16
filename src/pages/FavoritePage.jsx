import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Container, Box, Paper, Typography, Button, Stack } from "@mui/material";
import { useNavigate, Navigate } from "react-router-dom";
import Header from "../components/header";
import { useEffectiveAuth } from "../state/useEffectiveAuth";
import { getFavoritesPageFS } from "../services/favorites.service";
import ProductGrid from "../components/productgrid";

// Cache temporal en memoria
const favCacheByUser = new Map();

export default function FavoritesPage() {
  const auth = useEffectiveAuth(); // ✅ web user OR rn user
  const nav = useNavigate();

  // ✅ Hooks SIEMPRE arriba (sin returns antes)
  const [favDocs, setFavDocs] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ userId consistente (en RN lo mandamos como uid; en web puede ser uid o id)
  const userId = auth.user?.uid || auth.user?.id || null;

  const mappedItems = useMemo(() => {
    return favDocs
      .filter((f) => !!f.id)
      .map((f) => ({
        id: f.ProdId,
        Titulo: f.Titulo,
        Precio: f.Precio,
        Imagen: f.Imagen,
        Stock: f.Stock,
        Categoria: f.Categoria,
        Codigo: f.id,
      }));
  }, [favDocs]);

  const readCache = useCallback(() => {
    if (!userId) return null;
    return favCacheByUser.get(userId) || null;
  }, [userId]);

  const writeCache = useCallback(
    (next) => {
      if (!userId) return;
      favCacheByUser.set(userId, {
        ...next,
        primeraCargaHecha: true,
        savedAt: Date.now(),
      });
    },
    [userId]
  );

  const loadFirstPage = useCallback(
    async ({ force = false } = {}) => {
      if (!userId) return;

      if (!force) {
        const cached = readCache();
        if (cached?.primeraCargaHecha) {
          setFavDocs(cached.items || []);
          setLastDoc(cached.lastDoc || null);
          setHasNext(!!cached.hasNext);
          setError("");
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      setError("");
      try {
        const res = await getFavoritesPageFS({ userId, pageSize: 12, lastDoc: null });
        setFavDocs(res.items || []);
        setLastDoc(res.lastDoc || null);
        setHasNext(!!res.hasNext);
        writeCache({
          items: res.items || [],
          lastDoc: res.lastDoc || null,
          hasNext: !!res.hasNext,
        });
      } catch (e) {
        setError(e?.message || "Error cargando favoritos");
      } finally {
        setLoading(false);
      }
    },
    [userId, readCache, writeCache]
  );

  const loadMore = useCallback(async () => {
    if (!userId || !hasNext || loading) return;

    setLoading(true);
    setError("");
    try {
      const res = await getFavoritesPageFS({ userId, pageSize: 12, lastDoc });

      setFavDocs((prev) => {
        const merged = [...prev, ...(res.items || [])];
        writeCache({ items: merged, lastDoc: res.lastDoc || null, hasNext: !!res.hasNext });
        return merged;
      });

      setLastDoc(res.lastDoc || null);
      setHasNext(!!res.hasNext);
    } catch (e) {
      setError(e?.message || "Error cargando más favoritos");
    } finally {
      setLoading(false);
    }
  }, [userId, hasNext, loading, lastDoc, writeCache]);

  // ✅ cargar cuando cambie userId (web o RN)
  useEffect(() => {
    if (!userId) return;
    loadFirstPage();
  }, [userId, loadFirstPage]);

  // ✅ returns condicionales DESPUÉS de hooks
  if (auth.loading) return null;

  if (!auth.isAuthed) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", position: "relative" }}>
      <Header queryText="" onQueryChange={() => {}} />

      <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2 }, py: { xs: 2, md: 3 } }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Mis favoritos
          </Typography>

          <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
            {auth.user?.email || "Usuario WebView"}
          </Typography>

          <Stack spacing={2} sx={{ mt: 2 }}>
            {error ? <Typography sx={{ color: "error.main" }}>{error}</Typography> : null}

            <ProductGrid items={mappedItems} loading={loading && favDocs.length === 0} />

            {!loading && mappedItems.length === 0 ? (
              <Typography sx={{ color: "text.secondary" }}>
                No tienes favoritos todavía.
              </Typography>
            ) : null}

            {hasNext ? (
              <Button variant="contained" disabled={loading} onClick={loadMore}>
                {loading ? "Cargando..." : "Cargar más"}
              </Button>
            ) : null}

            <Button variant="outlined" onClick={() => nav("/account")}>
              Volver
            </Button>
          </Stack>
        </Paper>
      </Container>

      <Button
        variant="contained"
        onClick={() => loadFirstPage({ force: true })}
        disabled={loading}
        sx={{
          position: "fixed",
          right: 16,
          bottom: 16,
          borderRadius: 999,
          px: 2.5,
          py: 1.25,
          boxShadow: 6,
          zIndex: 1300,
        }}
      >
        {loading ? "Actualizando..." : "Actualizar"}
      </Button>
    </Box>
  );
}
