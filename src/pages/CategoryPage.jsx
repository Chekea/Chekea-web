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
import {
  useNavigate,
  useSearchParams,
  useNavigationType,
} from "react-router-dom";

import Header from "../components/header";
import ProductGrid from "../components/productgrid";
import SubcategoryBar from "../components/subcategorybar";

import { getProductsPageFirestore } from "../services/product.firesore.service";

const PAGE_SIZE = 12;

const SUBCATS_BY_CAT = {
  "Moda & Accesorios": [
    "Vestidos",
    "Calzado",
    "Bolsos",
    "Trajes",
    "Pantalones",
    "Camisas",
    "Otros",
  ],
  "Belleza & Accesorios": ["Maquillaje", "Pelo", "Joyas", "Otros"],
  "Complementos para peques": ["Bebés", "Niños", "Moda", "Otros"],
  Hogar: [
    "Cocina",
    "Decoración",
    "Baño",
    "Sala de estar",
    "Dormitorio",
    "Iluminacion",
  ],
};

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

/* ==================== CACHE (memoria) ==================== */
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 60;
const pageCache = new Map();

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

  // LRU bump
  pageCache.delete(key);
  pageCache.set(key, hit);
  return hit;
}

function cacheSet(key, value) {
  pageCache.set(key, value);
  while (pageCache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = pageCache.keys().next().value;
    pageCache.delete(oldestKey);
  }
}

/* ==================== Persistencia: página ==================== */
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
  } catch {}
}

/* ==================== Persistencia: cursor SOLO docId ==================== */
const LAST_DOC_ID_BY_CTX_KEY = "categoryPage:lastDocIdByCtx";

function readLastDocIdMap() {
  try {
    return JSON.parse(sessionStorage.getItem(LAST_DOC_ID_BY_CTX_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLastDocIdMap(map) {
  try {
    sessionStorage.setItem(LAST_DOC_ID_BY_CTX_KEY, JSON.stringify(map));
  } catch {}
}

function getLastDocIdForCtx(ctxKey) {
  return readLastDocIdMap()?.[ctxKey] ?? null;
}

function setLastDocIdForCtx(ctxKey, docId) {
  if (!docId) return;
  const map = readLastDocIdMap();
  map[ctxKey] = docId;
  writeLastDocIdMap(map);
}

function clearLastDocIdForCtx(ctxKey) {
  const map = readLastDocIdMap();
  delete map[ctxKey];
  writeLastDocIdMap(map);
}

export default function CategoryPage() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // 👇 IMPORTANTE: congelamos el tipo de navegación SOLO al montar este componente.
  // Así, los REPLACE internos (setSearchParams con replace:true) NO rompen la lógica.
  const navType = useNavigationType(); // "PUSH" | "POP" | "REPLACE"
  const entryNavTypeRef = useRef(null);
  if (entryNavTypeRef.current === null) entryNavTypeRef.current = navType;
  const entryNavType = entryNavTypeRef.current;

  const category = searchParams.get("cat") ?? "ALL";
  const subcat = searchParams.get("subcat") ?? "ALL";
  const sort = searchParams.get("sort") ?? "newest";
  const page = Number(searchParams.get("p") ?? 1);

  const [queryText, setQueryText] = useState("");
  const [items, setItems] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // snapshots solo en memoria (para paginar dentro del mismo mount)
  const lastDocsRef = useRef({ 1: null });
  const prevCtxRef = useRef(null);

  const ctxKey = useMemo(() => makeCtxKey(category, subcat, sort), [category, subcat, sort]);
  const subcatsForCat = useMemo(() => SUBCATS_BY_CAT[category] ?? [], [category]);

  const updateParams = useCallback(
    (patch) => {
      const next = new URLSearchParams(searchParams);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined) next.delete(k);
        else next.set(k, String(v));
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // proteger ruta
  useEffect(() => {
    if (!category || category === "ALL") nav("/", { replace: true });
  }, [category, nav]);

  // restaurar p si falta
  useEffect(() => {
    const hasP = searchParams.has("p");
    const pVal = Number(searchParams.get("p") ?? 0);
    if (hasP && Number.isFinite(pVal) && pVal >= 1) return;

    const last = readLastState();
    if (!last) return;
    if (last?.ctxKey !== ctxKey) return;

    if (last?.p && Number.isFinite(last.p) && last.p >= 1) {
      updateParams({ p: last.p });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey]);

  // guardar p
  useEffect(() => {
    if (!category || category === "ALL") return;
    if (!Number.isFinite(page) || page < 1) return;

    writeLastState({
      ctxKey,
      cat: category,
      subcat,
      sort,
      p: page,
      ts: Date.now(),
    });
  }, [ctxKey, category, subcat, sort, page]);

  // reset si cambia contexto (cat/subcat/sort)
  useEffect(() => {
    if (prevCtxRef.current === null) {
      prevCtxRef.current = ctxKey;
      return;
    }

    if (prevCtxRef.current !== ctxKey) {
      prevCtxRef.current = ctxKey;
      lastDocsRef.current = { 1: null };
      updateParams({ p: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey]);

  /* ==================== CARGA ====================
     ✅ Avanza SOLO cuando la entrada al mount fue PUSH.
     - page=1 + entryNavType==="PUSH" => usa cursor persistido + bypass cache
     - si no => usa cache normal / no consume cursor
  ================================================ */
  useEffect(() => {
    let alive = true;

    async function load() {
      if (!category || category === "ALL") return;

      const cacheKey = makePageKey(category, subcat, sort, page);

      const isPage1 = page === 1;
      const shouldAdvance = entryNavType === "PUSH"; // ✅ SOLO PUSH real (congelado)
      const bypassCache = isPage1 && shouldAdvance;

      // cache hit (cuando no forzamos avance)
      if (!bypassCache) {
        const cached = cacheGet(cacheKey);
        if (cached) {
          setError("");
          setItems(cached.items ?? []);
          setHasNext(Boolean(cached.hasNext));
          setLoading(false);
          if (cached.lastDocByPage) lastDocsRef.current = cached.lastDocByPage;
          return;
        }
      }

      setLoading(true);
      setError("");

      try {
        const lastDoc = lastDocsRef.current[page] ?? null;

        // Cursor persistido SOLO si queremos avanzar y estamos en p=1 y no hay snapshot
        const savedLastDocId =
          isPage1 && shouldAdvance && !lastDoc ? getLastDocIdForCtx(ctxKey) : null;

        // 1) intento normal
        let res = await getProductsPageFirestore({
          pageSize: PAGE_SIZE,
          category,
          subcategory: subcat,
          sort,
          queryText: "",
          lastDoc,
          lastDocId: savedLastDocId,
        });

        // 2) circular (solo si intentamos avanzar)
        if (
          isPage1 &&
          shouldAdvance &&
          savedLastDocId &&
          (!res?.items || res.items.length === 0)
        ) {
          clearLastDocIdForCtx(ctxKey);
          lastDocsRef.current = { 1: null };

          res = await getProductsPageFirestore({
            pageSize: PAGE_SIZE,
            category,
            subcategory: subcat,
            sort,
            queryText: "",
            lastDoc: null,
            lastDocId: null,
          });
        }

        if (!alive) return;

        const nextItems = res?.items ?? [];
        setItems(nextItems);
        setHasNext(Boolean(res?.hasNext));

        // snapshot next page
        lastDocsRef.current[page + 1] = res?.lastDoc ?? null;

        // persistir cursor SOLO si avanzamos (PUSH) y p=1
        if (isPage1 && shouldAdvance && res?.lastDocId) {
          setLastDocIdForCtx(ctxKey, res.lastDocId);
        }

        if (!bypassCache) {
          cacheSet(cacheKey, {
            ts: Date.now(),
            items: nextItems,
            hasNext: Boolean(res?.hasNext),
            lastDocByPage: { ...lastDocsRef.current },
          });
        }
      } catch (e) {
        console.error(e);
        if (alive) setError(t("loadError"));
      } finally {
        if (!alive) return;
        setLoading(false);
        // no fuerces scroll al volver atrás
        if (entryNavType !== "POP") window.scrollTo({ top: 0, behavior: "auto" });
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [category, subcat, sort, page, t, ctxKey, entryNavType]);

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

  const paginationCount = useMemo(() => (hasNext ? page + 1 : page), [hasNext, page]);

  const onPageChange = useCallback(
    (_e, nextPage) => {
      if (nextPage > page && !hasNext) return;
      updateParams({ p: nextPage });
    },
    [page, hasNext, updateParams]
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header queryText={queryText} onQueryChange={setQueryText} />

      <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2 }, py: 3 }}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 4,
            mb: 2,
            background:
              "linear-gradient(135deg, rgba(15,93,58,0.12), rgba(242,201,76,0.18))",
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
