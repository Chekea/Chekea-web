import React, { useEffect, useMemo, useState } from "react";
import { Container, Box, Paper, Typography, Button, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";
import Header from "../components/header";
import { useAuth } from "../state/AuthContext";
import { getFavoritesPageFS } from "../services/favorites.service";
import ProductGrid from "../components/productgrid"; // ajusta la ruta si es distinta

// ✅ Cache temporal en memoria (vive mientras la app esté abierta)
const favCacheByUser = new Map(); // userId -> { primeraCargaHecha, items, lastDoc, hasNext, savedAt }

export default function FavoritesPage() {
  const auth = useAuth();
  const nav = useNavigate();

  if (!auth.isAuthed) {
    nav("/login");
    return null;
  }

  // ✅ AJUSTA esto si tu uid viene como auth.user.uid
  const userId = auth.user?.id || auth.user?.uid;

  const [favDocs, setFavDocs] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const mappedItems = useMemo(() => {
    // 🔁 Convertimos favorito -> item compatible con ProductGrid
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

  function readCache() {
    if (!userId) return null;
    return favCacheByUser.get(userId) || null;
  }

  function writeCache(next) {
    if (!userId) return;
    favCacheByUser.set(userId, { ...next, primeraCargaHecha: true, savedAt: Date.now() });
  }

  async function loadFirstPage({ force = false } = {}) {
    if (!userId) return;

    // ✅ Si NO es forzado: al volver atrás usamos cache y NO llamamos backend
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

    // ✅ Primera vez o forzado => llamar backend
    setLoading(true);
    setError("");
    try {
      const res = await getFavoritesPageFS({ userId, pageSize: 12, lastDoc: null });
      setFavDocs(res.items);
      setLastDoc(res.lastDoc);
      setHasNext(res.hasNext);

      writeCache({ items: res.items, lastDoc: res.lastDoc, hasNext: res.hasNext });
    } catch (e) {
      setError(e?.message || "Error cargando favoritos");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!userId || !hasNext || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await getFavoritesPageFS({ userId, pageSize: 12, lastDoc });

      setFavDocs((prev) => {
        const merged = [...prev, ...res.items];
        writeCache({ items: merged, lastDoc: res.lastDoc, hasNext: res.hasNext });
        return merged;
      });

      setLastDoc(res.lastDoc);
      setHasNext(res.hasNext);
    } catch (e) {
      setError(e?.message || "Error cargando más favoritos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", position: "relative" }}>
      <Header queryText="" onQueryChange={() => {}} />

      <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2 }, py: { xs: 2, md: 3 } }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Mis favoritos
          </Typography>
          <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
            {auth.user.email}
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

      {/* ✅ Botón flotante profesional: forzar refresh (salta el cache y actualiza cache) */}
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
