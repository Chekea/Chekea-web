import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Container,
  Box,
  Paper,
  Typography,
  Alert,
  Pagination,
  CircularProgress,
  Stack,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import Header from "../components/header";
import ProductGrid from "../components/productgrid";
import SubcategoryBar from "../components/subcategorybar";

import { getProductsPageFirestore } from "../services/product.firesore.service";

const PAGE_SIZE = 12;

const SUBCATS_BY_CAT = {
  "Moda & Accesorios": ["Vestidos", "Calzado", "Bolsos", "Trajes", "Pantalones", "Camisas", "Otros"],
  "Belleza & Accesorios": ["Maquillaje", "Pelo", "Joyas", "Otros"],
  "Complementos para peques": ["Bebés", "Niños", "Moda", "Otros"],
  Hogar: ["Cocina", "Decoración", "Baño", "Sala de estar", "Dormitorio", "Iluminacion"],
};

/* -------------------- Loader centrado -------------------- */
function CenterLoader({ text = "Cargando productos…" }) {
  return (
    <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
      <Stack spacing={2} alignItems="center">
        <CircularProgress />
        <Typography sx={{ fontWeight: 900 }}>{text}</Typography>
      </Stack>
    </Box>
  );
}

/* ==================== CACHE (ya añadido) ====================
   - Cache en memoria para volver atrás sin re-descargar
   - TTL + LRU
   - Guarda items/hasNext y lastDocsRef (cursores)
============================================================== */
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const CACHE_MAX_ENTRIES = 60;

const pageCache = new Map(); // key -> { ts, items, hasNext, lastDocByPage }

function makePageKey(category, subcat, sort, page) {
  return `${category}__${subcat}__${sort}__p${page}`;
}

function cacheGet(key) {
  const hit = pageCache.get(key);
  if (!hit) return null;

  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    pageCache.delete(key);
    return null;
  }

  // LRU touch
  pageCache.delete(key);
  pageCache.set(key, hit);
  return hit;
}

function cacheSet(key, value) {
  pageCache.set(key, value);

  // LRU trim
  while (pageCache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = pageCache.keys().next().value;
    pageCache.delete(oldestKey);
  }
}

/* ==================== PERSISTENCIA PAGINACIÓN (NUEVO) ====================
   Guarda/recupera el último "p" (y filtros) para volver atrás al mismo estado
   incluso si la URL del detalle no conserva ?p=...
============================================================================ */
const LAST_STATE_STORAGE_KEY = "categoryPage:lastState";

function makeCtxKey(category, subcat, sort) {
  return `${category}__${subcat}__${sort}`;
}

function readLastState() {
  try {
    const raw = sessionStorage.getItem(LAST_STATE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLastState(state) {
  try {
    sessionStorage.setItem(LAST_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}
/* ==================== /PERSISTENCIA PAGINACIÓN ==================== */

export default function CategoryPage() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /* -------------------- URL params -------------------- */
  const category = searchParams.get("cat") ?? "ALL";
  const subcat = searchParams.get("subcat") ?? "ALL";
  const sort = searchParams.get("sort") ?? "newest";
  const page = Number(searchParams.get("p") ?? 1);

  /* -------------------- state -------------------- */
  const [queryText, setQueryText] = useState("");
  const [items, setItems] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* 🔑 cursor por página (OBLIGATORIO en Firestore) */
  const lastDocsRef = useRef({ 1: null });

  /* -------------------- redirect si no hay categoría -------------------- */
  useEffect(() => {
    if (!category || category === "ALL") {
      nav("/", { replace: true });
    }
  }, [category, nav]);

  /* -------------------- helpers -------------------- */
  const updateParams = useCallback(
    (patch) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([k, v]) => {
        if (v === null || v === undefined) next.delete(k);
        else next.set(k, String(v));
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const subcatsForCat = useMemo(() => {
    return SUBCATS_BY_CAT[category] ?? [];
  }, [category]);

  /* -------------------- RESTAURAR PAGINACIÓN AL VOLVER ATRÁS (NUEVO) --------------------
     Si falta "p" en la URL (o es inválido), recupera el último estado guardado.
     Esto es lo que hace que al volver del detalle regrese al mismo número de página.
  -------------------------------------------------------------------------------------- */
  useEffect(() => {
    const hasP = searchParams.has("p");
    const pVal = Number(searchParams.get("p") ?? 0);

    // solo restaurar si NO viene p válido
    if (hasP && Number.isFinite(pVal) && pVal >= 1) return;

    const last = readLastState();
    if (!last) return;

    // restaura solo si coincide el "contexto" (cat/subcat/sort)
    const ctx = makeCtxKey(category, subcat, sort);
    if (last?.ctxKey !== ctx) return;

    // aplica p guardado (y respeta tu reemplazo)
    if (last?.p && Number.isFinite(last.p) && last.p >= 1) {
      updateParams({ p: last.p });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, subcat, sort]);

  /* -------------------- GUARDAR ESTADO DE PAGINACIÓN (NUEVO) -------------------- */
  useEffect(() => {
    if (!category || category === "ALL") return;
    if (!Number.isFinite(page) || page < 1) return;

    writeLastState({
      ctxKey: makeCtxKey(category, subcat, sort),
      cat: category,
      subcat,
      sort,
      p: page,
      ts: Date.now(),
    });
  }, [category, subcat, sort, page]);

  /* -------------------- RESET cursores cuando cambia contexto -------------------- */
  useEffect(() => {
    lastDocsRef.current = { 1: null };
    updateParams({ p: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, subcat, sort]);

  /* -------------------- CARGA REAL CON CURSOR + CACHING -------------------- */
  useEffect(() => {
    let alive = true;

    async function load() {
      const cacheKey = makePageKey(category, subcat, sort, page);

      // ✅ Si hay cache => pinta al instante y NO re-descarga
      const cached = cacheGet(cacheKey);
      if (cached) {
        setError("");
        setItems(cached.items ?? []);
        setHasNext(Boolean(cached.hasNext));
        setLoading(false);

        if (cached.lastDocByPage) {
          lastDocsRef.current = cached.lastDocByPage;
        }
        return;
      }

      // Sin cache => comportamiento original
      setLoading(true);
      setError("");
      setItems([]);

      try {
        const lastDoc = lastDocsRef.current[page] ?? null;

        const res = await getProductsPageFirestore({
          pageSize: PAGE_SIZE,
          category,
          subcategory: subcat,
          sort,
          queryText: "",
          lastDoc,
        });

        if (!alive) return;

        setItems(res?.items ?? []);
        setHasNext(Boolean(res?.hasNext));

        // guarda cursor para la siguiente página
        lastDocsRef.current[page + 1] = res?.lastDoc ?? null;

        // guardar en cache
        cacheSet(cacheKey, {
          ts: Date.now(),
          items: res?.items ?? [],
          hasNext: Boolean(res?.hasNext),
          lastDocByPage: { ...lastDocsRef.current },
        });
      } catch (e) {
        console.error(e);
        if (alive) setError(t("loadError"));
      } finally {
        if (alive) {
          setLoading(false);
          window.scrollTo({ top: 0, behavior: "auto" });
        }
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [category, subcat, sort, page, t]);

  /* -------------------- idioma -------------------- */
  const mappedItems = useMemo(() => {
    const lang = i18n.language;
    return items.map((p) => ({
      ...p,
      title:
        lang === "en"
          ? p.title_en ?? p.title ?? p.Titulo
          : lang === "fr"
          ? p.title_fr ?? p.title ?? p.Titulo
          : p.title_es ?? p.title ?? p.Titulo,
      shipping:
        lang === "en"
          ? p.shipping_en ?? p.shipping
          : lang === "fr"
          ? p.shipping_fr ?? p.shipping
          : p.shipping_es ?? p.shipping,
    }));
  }, [items, i18n.language]);

  /* -------------------- pagination -------------------- */
  const paginationCount = hasNext ? page + 1 : page;

  const onPageChange = (_e, nextPage) => {
    if (nextPage > page && !hasNext) return;
    updateParams({ p: nextPage });
  };

  /* -------------------- render -------------------- */
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header queryText={queryText} onQueryChange={setQueryText} />

      <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2 }, py: 3 }}>
        {/* Hero */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 4,
            mb: 2,
            background: "linear-gradient(135deg, rgba(15,93,58,0.12), rgba(242,201,76,0.18))",
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            {category}
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            {subcat === "ALL" ? t("deals") : subcat}
          </Typography>

          {subcatsForCat.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <SubcategoryBar
                value={subcat}
                options={["ALL", ...subcatsForCat]}
                onChange={(v) => updateParams({ subcat: v, p: 1 })}
              />
            </Box>
          )}
        </Paper>

        {loading ? (
          <CenterLoader />
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 4 }}>
            <ProductGrid items={mappedItems} loading={false} />

            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Pagination
                count={paginationCount}
                page={page}
                onChange={onPageChange}
                color="primary"
                shape="rounded"
              />
            </Box>
          </Paper>
        )}
      </Container>
    </Box>
  );
}
