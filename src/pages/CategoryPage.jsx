import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";

import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Pagination from "@mui/material/Pagination";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams, useNavigationType } from "react-router-dom";

import { getProductsPageFirestore } from "../services/product.firesore.service";

const ProductGrid = lazy(() => import("../components/productgrid"));
const SubcategoryBar = lazy(() => import("../components/subcategorybar"));

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
  Hogar: ["Cocina", "Decoración", "Baño", "Sala de estar", "Dormitorio", "Iluminacion"],
};

function CenterLoader({ text = "Cargando productos…" }) {
  return (
    <Box sx={{ minHeight: "55vh", display: "grid", placeItems: "center" }}>
      <Stack spacing={1.5} alignItems="center">
        <CircularProgress size={28} />
        <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{text}</Typography>
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

/* ==================== VIEW SNAPSHOT CACHE (para back) ==================== */
const VIEW_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min
const viewCache = new Map();

function makeViewKey(category, subcat, sort, page) {
  return `VIEW__${category}__${subcat}__${sort}__p${page}`;
}
function viewCacheGet(key) {
  const hit = viewCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > VIEW_CACHE_TTL_MS) {
    viewCache.delete(key);
    return null;
  }
  return hit;
}
function viewCacheSet(key, value) {
  viewCache.set(key, value);
}

/* ==================== Persistencia (web normal) ==================== */
const LAST_STATE_STORAGE_KEY = "categoryPage:lastState";
const LAST_DOC_ID_BY_CTX_KEY = "categoryPage:lastDocIdByCtx";

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

/* ==================== RN WebView Bridge (opcional) ==================== */
const RN_BRIDGE_NS = "RN_BRIDGE_V1";

function isRNWebView() {
  return typeof window !== "undefined" && !!window.ReactNativeWebView;
}
function rnPost(type, payload) {
  if (!isRNWebView()) return;
  try {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ ns: RN_BRIDGE_NS, type, payload, ts: Date.now() })
    );
  } catch {}
}
function rnGetLastDocIdForCtx(ctxKey) {
  try {
    return window.__RN_PERSIST__?.lastDocIdByCtx?.[ctxKey] ?? null;
  } catch {
    return null;
  }
}

export default function CategoryPage() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  // ✅ Header solo desktop
  const [HeaderComp, setHeaderComp] = useState(null);
  useEffect(() => {
    let mounted = true;
    if (!isDesktop) {
      setHeaderComp(null);
      return;
    }
    (async () => {
      const mod = await import("../components/header");
      if (mounted) setHeaderComp(() => mod.default);
    })();
    return () => {
      mounted = false;
    };
  }, [isDesktop]);

  // ✅ Congela navType al montar
  const navType = useNavigationType();
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

  const lastDocsRef = useRef({ 1: null });
  const prevCtxRef = useRef(null);

  const ctxKey = useMemo(() => makeCtxKey(category, subcat, sort), [category, subcat, sort]);
  const subcatsForCat = useMemo(() => SUBCATS_BY_CAT[category] ?? [], [category]);

  // ✅ Notifica a RN el contexto actual (solo WebView)
  useEffect(() => {
    if (!ctxKey || category === "ALL") return;
    rnPost("CTX_CHANGED", { ctxKey, category, subcat, sort });
  }, [ctxKey, category, subcat, sort]);

  const updateParams = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === undefined) next.delete(k);
            else next.set(k, String(v));
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {
    if (!category || category === "ALL") nav("/", { replace: true });
  }, [category, nav]);

  // restaurar p si falta
  useEffect(() => {
    const hasP = searchParams.has("p");
    const pVal = Number(searchParams.get("p") ?? 0);
    if (hasP && Number.isFinite(pVal) && pVal >= 1) return;

    const last = readLastState();
    if (!last || last?.ctxKey !== ctxKey) return;

    if (last?.p && Number.isFinite(last.p) && last.p >= 1) {
      updateParams({ p: last.p });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey]);

  // guardar p
  useEffect(() => {
    if (!category || category === "ALL") return;
    if (!Number.isFinite(page) || page < 1) return;

    writeLastState({ ctxKey, cat: category, subcat, sort, p: page, ts: Date.now() });
  }, [ctxKey, category, subcat, sort, page]);

  // reset si cambia contexto (NO en POP para no romper Back)
  useEffect(() => {
    if (prevCtxRef.current === null) {
      prevCtxRef.current = ctxKey;
      return;
    }
    if (prevCtxRef.current !== ctxKey) {
      prevCtxRef.current = ctxKey;

      if (entryNavType === "POP") return;

      lastDocsRef.current = { 1: null };
      updateParams({ p: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey, entryNavType]);

  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!category || category === "ALL") return;

    let alive = true;
    const myReqId = ++reqIdRef.current;

    async function load() {
      const cacheKey = makePageKey(category, subcat, sort, page);

      // ✅ 1) Si venimos de BACK (POP), restaura snapshot tal cual (items + scroll) y sal
      if (entryNavType === "POP") {
        const vKey = makeViewKey(category, subcat, sort, page);
        const snap = viewCacheGet(vKey);
        if (snap) {
          setError("");
          setItems(snap.items ?? []);
          setHasNext(Boolean(snap.hasNext));
          setLoading(false);
          if (snap.lastDocByPage) lastDocsRef.current = snap.lastDocByPage;

          requestAnimationFrame(() => {
            window.scrollTo({ top: snap.scrollY ?? 0, behavior: "auto" });
          });

          return;
        }
      }

      const isPage1 = page === 1;

      // ✅ cursores: RN (WebView) tiene prioridad, si no existe usa web(sessionStorage)
      const rnLastDocId = rnGetLastDocIdForCtx(ctxKey);
      const webLastDocId = getLastDocIdForCtx(ctxKey);
      const savedCursor = rnLastDocId || webLastDocId;

      // ✅ Web normal: mantén PUSH / WebView: avanza en page1 si hay cursor
      const shouldAdvance = isRNWebView()
        ? isPage1 && !!savedCursor
        : entryNavType === "PUSH";

      const bypassCache = isPage1 && shouldAdvance;

      // ✅ 2) cache normal (pageCache)
      if (!bypassCache) {
        const cached = cacheGet(cacheKey);
        if (cached) {
          setError("");
          setItems(cached.items ?? []);
          setHasNext(Boolean(cached.hasNext));
          setLoading(false);
          if (cached.lastDocByPage) lastDocsRef.current = cached.lastDocByPage;

          // opcional: si cache trae, en PUSH scroll top, en POP ya lo manejamos arriba
          if (entryNavType !== "POP") {
            requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
          }
          return;
        }
      }

      setLoading(true);
      setError("");

      try {
        const lastDoc = lastDocsRef.current[page] ?? null;

        // ✅ usa cursor persistido solo en page 1 cuando no hay snapshot local
        const savedLastDocId = isPage1 && shouldAdvance && !lastDoc ? savedCursor : null;

        let res = await getProductsPageFirestore({
          pageSize: isDesktop ? PAGE_SIZE : 6,
          category,
          subcategory: subcat,
          sort,
          queryText: "",
          lastDoc,
          lastDocId: savedLastDocId,
        });

        // ✅ si el cursor guardado ya no sirve, limpia en web + RN y vuelve a cargar normal
        if (isPage1 && shouldAdvance && savedLastDocId && (!res?.items || res.items.length === 0)) {
          clearLastDocIdForCtx(ctxKey);
          rnPost("CLEAR_LASTDOC_BY_CTX", { ctxKey });

          lastDocsRef.current = { 1: null };
          res = await getProductsPageFirestore({
            pageSize: isDesktop ? PAGE_SIZE : 6,
            category,
            subcategory: subcat,
            sort,
            queryText: "",
            lastDoc: null,
            lastDocId: null,
          });
        }

        if (!alive || myReqId !== reqIdRef.current) return;

        const nextItems = res?.items ?? [];
        setItems(nextItems);
        setHasNext(Boolean(res?.hasNext));
        lastDocsRef.current[page + 1] = res?.lastDoc ?? null;

        // ✅ guarda cursor (page1) -> web + RN opcional
        if (isPage1 && res?.lastDocId) {
          setLastDocIdForCtx(ctxKey, res.lastDocId);
          rnPost("SAVE_LASTDOC_BY_CTX", { ctxKey, lastDocId: res.lastDocId });
        }

        // ✅ cache de páginas (tu cache existente)
        if (!bypassCache) {
          cacheSet(cacheKey, {
            ts: Date.now(),
            items: nextItems,
            hasNext: Boolean(res?.hasNext),
            lastDocByPage: { ...lastDocsRef.current },
          });
        }

        // ✅ scroll top solo cuando NO es back
        if (entryNavType !== "POP") {
          requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
        }
      } catch (e) {
        console.error(e);
        if (alive && myReqId === reqIdRef.current) setError(t("loadError"));
      } finally {
        if (!alive || myReqId !== reqIdRef.current) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [category, subcat, sort, page, t, ctxKey, entryNavType, isDesktop]);

  // ✅ Guarda snapshot de la vista (para que Back muestre igual)
  useEffect(() => {
    if (!category || category === "ALL") return;
    if (loading) return;

    const vKey = makeViewKey(category, subcat, sort, page);
    viewCacheSet(vKey, {
      ts: Date.now(),
      items,
      hasNext,
      lastDocByPage: { ...lastDocsRef.current },
      scrollY: typeof window !== "undefined" ? window.scrollY : 0,
    });
  }, [category, subcat, sort, page, loading, items, hasNext]);

  const lang = i18n.language;
  const mappedItems = useMemo(() => {
    if (!items?.length) return [];
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
  }, [items, lang]);

  const paginationCount = useMemo(() => (hasNext ? page + 1 : page), [hasNext, page]);

  const onPageChange = useCallback(
    (_e, nextPage) => {
      if (nextPage > page && !hasNext) return;
      updateParams({ p: nextPage });
    },
    [page, hasNext, updateParams]
  );

  // Prefetch del grid tras cargar
  useEffect(() => {
    if (!loading) import("../components/productgrid");
  }, [loading]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* ✅ Header solo desktop */}
      {isDesktop && HeaderComp ? (
        <HeaderComp queryText={queryText} onQueryChange={setQueryText} />
      ) : null}

      <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2 }, py: 3 }}>
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
              <Suspense fallback={null}>
                <SubcategoryBar
                  value={subcat}
                  options={["ALL", ...subcatsForCat]}
                  onChange={(v) => updateParams({ subcat: v, p: 1 })}
                />
              </Suspense>
            </Box>
          )}
        </Paper>

        {loading ? (
          <CenterLoader />
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 4 }}>
            <Suspense fallback={<CenterLoader text="Renderizando…" />}>
              <ProductGrid items={mappedItems} loading={false} />
            </Suspense>

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