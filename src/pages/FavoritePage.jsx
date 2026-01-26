import React, { useEffect, useMemo, useState } from "react";
import { Container, Box, Paper, Typography, Button, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";
import Header from "../components/header";
import { useAuth } from "../state/AuthContext";
import { getFavoritesPageFS } from "../services/favorites.service";
import ProductGrid from "../components/productgrid"; // ajusta la ruta si es distinta

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
      .filter((f) => !!f.id) // sin ProductoId no podemos mostrarlo bien
      .map((f) => ({
        // ✅ IMPORTANTE: id debe ser el id real del producto para que ProductGrid navegue al detalle
        id: f.ProdId,

        // Campos típicos de producto (los que ya guardas en favoritos)
        Titulo: f.Titulo,
        Precio: f.Precio,
        Imagen: f.Imagen,
        Stock: f.Stock,
        Categoria: f.Categoria,

        // Extra por si luego quieres quitar favorito desde la card
        Codigo: f.id,
      }));
  }, [favDocs]);

  async function loadFirstPage() {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const res = await getFavoritesPageFS({ userId, pageSize: 12, lastDoc: null });
      setFavDocs(res.items);
      setLastDoc(res.lastDoc);
      setHasNext(res.hasNext);
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
      setFavDocs((prev) => [...prev, ...res.items]);
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
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
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
            {error ? (
              <Typography sx={{ color: "error.main" }}>{error}</Typography>
            ) : null}

            {/* ✅ AQUÍ va tu grid ya existente */}
            <ProductGrid
              items={mappedItems}
              loading={loading && favDocs.length === 0}
            />

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
    </Box>
  );
}
