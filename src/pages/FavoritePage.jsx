// src/pages/FavoritesPage.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  lazy,
  Suspense,
  memo,
} from "react";

import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

import { useNavigate, Navigate } from "react-router-dom";

import { useEffectiveAuth } from "../state/useEffectiveAuth";
import { getFavoritesPageFS } from "../services/favorites.service";

/* ✅ Lazy components (no se descargan hasta que se necesiten) */
const Header = lazy(() => import("../components/header"));
const ProductGrid = lazy(() => import("../components/productgrid"));

/* =========================
   PERF HELPERS
========================= */
function idle(cb) {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) return window.requestIdleCallback(cb, { timeout: 1200 });
  return window.setTimeout(cb, 250);
}

/* Cache temporal en memoria (por usuario) */
const favCacheByUser = new Map(); // userId -> { items, lastDoc, hasNext, primeraCargaHecha, savedAt }

/* =========================
   UI helpers
========================= */
const InlineError = memo(function InlineError({ text }) {
  if (!text) return null;
  return <Typography sx={{ color: "error.main" }}>{text}</Typography>;
});

const EmptyState = memo(function EmptyState() {
  return (
    <Typography sx={{ color: "text.secondary" }}>
      No tienes favoritos todavía.
    </Typography>
  );
});

export default function FavoritesPage() {
  const auth = useEffectiveAuth(); // ✅ web user OR rn user
  const nav = useNavigate();

  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  // ✅ userId consistente
  const userId = auth.user?.uid || auth.user?.id || null;

  // ✅ state
  const [favDocs, setFavDocs] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ evita setState cuando se desmonta / cambian requests
  const reqIdRef = useRef(0);

  // ✅ mapeo memoizado
  const mappedItems = useMemo(() => {
    return (favDocs || [])
      .filter((f) => !!f?.id)
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

  // ✅ prefetch en idle (mejora TTI / evita lag al pintar grid)
  useEffect(() => {
    const id = idle(() => {
      // Grid casi siempre se usará
      import("../components/productgrid");
      // Header SOLO en desktop
      if (isDesktop) import("../components/header");
    });

    return () => {
      if (typeof window === "undefined") return;
      if ("cancelIdleCallback" in window && typeof id === "number") {
        try {
          window.cancelIdleCallback(id);
        } catch {}
      } else if (typeof id === "number") clearTimeout(id);
    };
  }, [isDesktop]);

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

      const myReqId = ++reqIdRef.current;

      // ✅ 1) Hydrate instantáneo desde memoria (ultra rápido)
      if (!force) {
        const cached = readCache();
        if (cached?.primeraCargaHecha) {
          setFavDocs(cached.items || []);
          setLastDoc(cached.lastDoc || null);
          setHasNext(!!cached.hasNext);
          setError("");
          setLoading(false);

          // ✅ SWR refresh en background (no bloquea)
          idle(async () => {
            try {
              const res = await getFavoritesPageFS({
                userId,
                pageSize: isDesktop ? 12 : 6,
                lastDoc: null,
              });

              // si cambió la request mientras tanto, no pisa
              if (myReqId !== reqIdRef.current) return;

              const items = res.items || [];
              setFavDocs(items);
              setLastDoc(res.lastDoc || null);
              setHasNext(!!res.hasNext);
              writeCache({ items, lastDoc: res.lastDoc || null, hasNext: !!res.hasNext });
            } catch {
              // no ensuciar UI si falla el refresh
            }
          });

          return;
        }
      }

      // ✅ 2) No cache: carga normal
      setLoading(true);
      setError("");

      try {
        const res = await getFavoritesPageFS({
          userId,
          pageSize: isDesktop ? 12 : 6,
          lastDoc: null,
        });

        if (myReqId !== reqIdRef.current) return;

        const items = res.items || [];
        setFavDocs(items);
        setLastDoc(res.lastDoc || null);
        setHasNext(!!res.hasNext);

        writeCache({ items, lastDoc: res.lastDoc || null, hasNext: !!res.hasNext });
      } catch (e) {
        if (myReqId !== reqIdRef.current) return;
        setError(e?.message || "Error cargando favoritos");
      } finally {
        if (myReqId !== reqIdRef.current) return;
        setLoading(false);
      }
    },
    [userId, isDesktop, readCache, writeCache]
  );

  const loadMore = useCallback(async () => {
    if (!userId || !hasNext || loading) return;

    const myReqId = ++reqIdRef.current;

    setLoading(true);
    setError("");

    try {
      const res = await getFavoritesPageFS({
        userId,
        pageSize: isDesktop ? 12 : 6,
        lastDoc,
      });

      if (myReqId !== reqIdRef.current) return;

      const nextItems = res.items || [];
      setFavDocs((prev) => {
        const merged = [...(prev || []), ...nextItems];
        writeCache({ items: merged, lastDoc: res.lastDoc || null, hasNext: !!res.hasNext });
        return merged;
      });

      setLastDoc(res.lastDoc || null);
      setHasNext(!!res.hasNext);
    } catch (e) {
      if (myReqId !== reqIdRef.current) return;
      setError(e?.message || "Error cargando más favoritos");
    } finally {
      if (myReqId !== reqIdRef.current) return;
      setLoading(false);
    }
  }, [userId, hasNext, loading, lastDoc, isDesktop, writeCache]);

  useEffect(() => {
    if (!userId) return;
    loadFirstPage();
  }, [userId, loadFirstPage]);

  // ✅ returns condicionales DESPUÉS de hooks
  if (auth.loading) return null;

  if (!auth.isAuthed) {
    return <Navigate to="/login" replace />;
  }

  const hasItems = mappedItems.length > 0;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", position: "relative" }}>
      {/* ✅ Header SOLO desktop (lazy) */}
      {isDesktop ? (
        <Suspense fallback={null}>
          <Header queryText="" onQueryChange={() => {}} />
        </Suspense>
      ) : null}

      <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2 }, py: { xs: 2, md: 3 } }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
          {/* ✅ UI más clara sin cambiar negocio */}
          <Stack spacing={2}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                Favoritos
              </Typography>

              {isDesktop ? (
                <Button variant="outlined" onClick={() => nav("/account")}>
                  Volver
                </Button>
              ) : null}
            </Box>

            <InlineError text={error} />

            {/* ✅ Grid lazy (solo se descarga cuando se renderiza) */}
            <Suspense
              fallback={
                <Typography sx={{ color: "text.secondary" }}>
                  Cargando favoritos…
                </Typography>
              }
            >
              <ProductGrid items={mappedItems} loading={loading && favDocs.length === 0} />
            </Suspense>

            {!loading && !hasItems ? <EmptyState /> : null}

            {hasNext ? (
              <Button variant="contained" disabled={loading} onClick={loadMore}>
                {loading ? "Cargando..." : "Cargar más"}
              </Button>
            ) : null}
          </Stack>
        </Paper>
      </Container>

      {/* ✅ Acción flotante (misma lógica, mejor performance: fuerza refresh) */}
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