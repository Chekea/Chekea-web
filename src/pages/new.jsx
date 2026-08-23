// src/pages/CaEgtegoryPage.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
  memo,
  startTransition,
} from "react";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Alert from "@mui/material/Alert";
import Pagination from "@mui/material/Pagination";
import CircularProgress from "@mui/material/CircularProgress";
import Backdrop from "@mui/material/Backdrop";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Fade from "@mui/material/Fade";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { getProductsPageEG } from "../services/product.firesore.service";

const ProductGrid = lazy(() => import("../components/productgrid"));
const Header = lazy(() => import("../components/header"));

const PAGE_SIZE_DESKTOP = 12;
const PAGE_SIZE_MOBILE = 8;
const CATEGORY_SWITCH_DELAY_MS = 320;
const DEFAULT_CATEGORY = "Creacion de Contenido";

const CATEGORY_CHIPS = [
  { label: "Electronica", value: "Electronica" },
  { label: "Complementos para Peques", value: "Complementos para Peques" },
  { label: "Creacion de Contenido", value: "Creacion de Contenido" },
];

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

function GridSkeleton() {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(2, minmax(0, 1fr))",
          md: "repeat(4, minmax(0, 1fr))",
        },
        gap: 2,
      }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <Paper key={i} elevation={0} sx={{ p: 1.5, borderRadius: 3 }}>
          <Skeleton variant="rounded" height={180} />
          <Skeleton sx={{ mt: 1 }} height={26} />
          <Skeleton width="70%" height={22} />
          <Skeleton width="45%" height={20} />
        </Paper>
      ))}
    </Box>
  );
}

/* ==================== CACHE ==================== */
const CACHE_TTL_MS = 3 * 60 * 1000;
const CACHE_MAX_ENTRIES = 60;
const pageCache = new Map();

function makePageKey(category, page, pageSize) {
  return `${category}__p${page}__s${pageSize}__ge_only`;
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

function idle(cb) {
  if (typeof window === "undefined") return null;
  if ("requestIdleCallback" in window) return window.requestIdleCallback(cb, { timeout: 900 });
  return window.setTimeout(cb, 250);
}

function cancelIdleSafe(id) {
  if (typeof window === "undefined" || id == null) return;

  if ("cancelIdleCallback" in window && typeof id !== "number") {
    try {
      window.cancelIdleCallback(id);
    } catch {}
    return;
  }

  if (typeof id === "number") clearTimeout(id);
}

const CategoryChipsBar = memo(function CategoryChipsBar({
  activeCategory,
  onChangeCategory,
  busy,
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
        {CATEGORY_CHIPS.map((chip) => {
          const selected = chip.value === activeCategory;

          return (
            <Chip
              key={chip.value}
              label={chip.label}
              clickable
              disabled={busy}
              color={selected ? "primary" : "default"}
              variant={selected ? "filled" : "outlined"}
              onClick={() => onChangeCategory(chip.value)}
              sx={{
                fontWeight: 700,
                transition: "all 160ms ease",
                opacity: busy && !selected ? 0.75 : 1,
              }}
            />
          );
        })}
      </Stack>
    </Box>
  );
});

async function fetchCategoryPage({ category, pageSize, lastDoc }) {
  return getProductsPageEG({
    pageSize,
    category,
    sort: "newest",
    queryText: "",
    lastDoc,
    lastDocId: null,
  });
}

export default function CategoryPageEg() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const pageSize = isDesktop ? PAGE_SIZE_DESKTOP : PAGE_SIZE_MOBILE;
  const denseCards = !isDesktop;

  const selectedCategory = useMemo(() => {
    const current = searchParams.get("cat");
    return CATEGORY_CHIPS.some((x) => x.value === current) ? current : DEFAULT_CATEGORY;
  }, [searchParams]);

  const page = Math.max(1, Number(searchParams.get("p") ?? 1));

  const [queryText, setQueryText] = useState("");
  const [items, setItems] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switchingCategory, setSwitchingCategory] = useState(false);
  const [error, setError] = useState("");

  const reqIdRef = useRef(0);
  const lastDocsRef = useRef({});
  const switchDelayRef = useRef(null);

  useEffect(() => {
    const id = idle(() => {
      import("../components/productgrid");
      if (isDesktop) import("../components/header");
    });
    return () => cancelIdleSafe(id);
  }, [isDesktop]);

  useEffect(() => {
    const current = searchParams.get("cat");
    const currentPage = searchParams.get("p");

    if (!CATEGORY_CHIPS.some((x) => x.value === current) || !currentPage) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!CATEGORY_CHIPS.some((x) => x.value === current)) {
            next.set("cat", DEFAULT_CATEGORY);
          }
          if (!currentPage) {
            next.set("p", "1");
          }
          return next;
        },
        { replace: true }
      );
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    return () => {
      if (switchDelayRef.current) clearTimeout(switchDelayRef.current);
    };
  }, []);

  const updateParams = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          let changed = false;

          for (const [k, v] of Object.entries(patch)) {
            if (v == null) {
              if (next.has(k)) {
                next.delete(k);
                changed = true;
              }
            } else {
              const sv = String(v);
              if (next.get(k) !== sv) {
                next.set(k, sv);
                changed = true;
              }
            }
          }

          return changed ? next : prev;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const resetCategoryCursor = useCallback((category) => {
    lastDocsRef.current[category] = { 1: null };
  }, []);

  const getCategoryPageCursor = useCallback((category, pageNumber) => {
    return lastDocsRef.current?.[category]?.[pageNumber] ?? null;
  }, []);

  const setCategoryPageCursor = useCallback((category, pageNumber, doc) => {
    if (!lastDocsRef.current[category]) {
      lastDocsRef.current[category] = { 1: null };
    }
    lastDocsRef.current[category][pageNumber] = doc ?? null;
  }, []);

  const loadPage = useCallback(
    async ({ category, pageNumber, useCache = true, keepVisibleContent = false }) => {
      const myReqId = ++reqIdRef.current;
      const cacheKey = makePageKey(category, pageNumber, pageSize);

      if (useCache) {
        const cached = cacheGet(cacheKey);
        if (cached) {
          if (myReqId !== reqIdRef.current) return;

          setError("");
          setItems(cached.items ?? []);
          setHasNext(Boolean(cached.hasNext));
          setLoading(false);
          setSwitchingCategory(false);

          if (cached.lastDocByPage) {
            lastDocsRef.current[category] = cached.lastDocByPage;
          }

          requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
          return;
        }
      }

      if (!keepVisibleContent) setLoading(true);
      setError("");

      try {
        const lastDoc = getCategoryPageCursor(category, pageNumber);

        const res = await fetchCategoryPage({
          category,
          pageSize,
          lastDoc,
        });

        if (myReqId !== reqIdRef.current) return;

        const fetchedItems = res?.items ?? [];
        setItems(fetchedItems);
        setHasNext(Boolean(res?.hasNext));
        setCategoryPageCursor(category, pageNumber + 1, res?.lastDoc ?? null);

        cacheSet(cacheKey, {
          ts: Date.now(),
          items: fetchedItems,
          hasNext: Boolean(res?.hasNext),
          lastDocByPage: { ...(lastDocsRef.current[category] ?? { 1: null }) },
        });

        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
      } catch (e) {
        console.error(e);
        if (myReqId === reqIdRef.current) {
          setError(t("loadError"));
        }
      } finally {
        if (myReqId !== reqIdRef.current) return;
        setLoading(false);
        setSwitchingCategory(false);
      }
    },
    [getCategoryPageCursor, pageSize, setCategoryPageCursor, t]
  );

  useEffect(() => {
    loadPage({
      category: selectedCategory,
      pageNumber: page,
      useCache: true,
      keepVisibleContent: false,
    });
  }, [selectedCategory, page, loadPage]);

  const lang = i18n.language;
  const mappedItems = useMemo(() => {
    if (!items?.length) return [];

    return items.map((p) => ({
      ...p,
      dense: denseCards,
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
  }, [items, lang, denseCards]);

  const paginationCount = useMemo(() => (hasNext ? page + 1 : page), [hasNext, page]);

  const handleCategoryChange = useCallback(
    (nextCategory) => {
      if (nextCategory === selectedCategory) return;

      if (switchDelayRef.current) {
        clearTimeout(switchDelayRef.current);
      }

      setSwitchingCategory(true);
      setError("");
      resetCategoryCursor(nextCategory);

      switchDelayRef.current = setTimeout(() => {
        startTransition(() => {
          updateParams({ cat: nextCategory, p: 1 });
        });
      }, CATEGORY_SWITCH_DELAY_MS);
    },
    [resetCategoryCursor, selectedCategory, updateParams]
  );

  const handlePageChange = useCallback(
    (_e, nextPage) => {
      if (nextPage > page && !hasNext) return;
      setLoading(true);
      updateParams({ p: nextPage });
    },
    [page, hasNext, updateParams]
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {isDesktop ? (
        <Suspense fallback={null}>
          <Header queryText={queryText} onQueryChange={setQueryText} />
        </Suspense>
      ) : null}

      <Backdrop
        open={switchingCategory}
        sx={{
          color: "#fff",
          zIndex: (t) => t.zIndex.drawer + 1200,
          backdropFilter: "blur(2px)",
        }}
      >
        <Stack spacing={2} alignItems="center">
          <CircularProgress color="inherit" />
          <Typography sx={{ fontWeight: 900 }}>Cargando categoría...</Typography>
        </Stack>
      </Backdrop>

      <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2 }, py: 3 }}>
        <CategoryChipsBar
          activeCategory={selectedCategory}
          onChangeCategory={handleCategoryChange}
          busy={switchingCategory}
        />

        {loading && !items.length ? (
          <CenterLoader />
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : mappedItems.length === 0 ? (
          <Alert severity="info">
            No hay productos disponibles en la categoría <b>{selectedCategory}</b>.
          </Alert>
        ) : (
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 4,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {loading && items.length > 0 ? (
              <Box sx={{ opacity: 0.72 }}>
                <GridSkeleton />
              </Box>
            ) : (
              <Suspense fallback={<GridSkeleton />}>
                <Fade in timeout={180}>
                  <Box>
                    <ProductGrid items={mappedItems} loading={false} />
                  </Box>
                </Fade>
              </Suspense>
            )}

            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Pagination
                count={paginationCount}
                page={page}
                onChange={handlePageChange}
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