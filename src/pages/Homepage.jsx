// ✅ HomePage.jsx (Optimizado)
// - Iconos tipo burbuja (CategoryIconsBar) -> cambia cat + subcat
// - ALL usa getHomeSectionsFS() (nuevo/descuentos/relevantes) ya vienen con 6
// - descuentos con countdown 24h + reiniciar
// - sección "Recomendados para ti" abajo (sin duplicar items de ALL cuando aplica)
// - paginación con caché por página + lastDoc encadenado

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Container,
  Box,
  Alert,
  Paper,
  Typography,
  Pagination,
  Stack,
  Button,
  Chip,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useSearchParams, useNavigate } from "react-router-dom";

import Header from "../components/header";
import ProductGrid from "../components/productgrid";
import EmptyState from "../components/emptystate";
import CategoryIconsBar from "../components/categoryIconbar";
import SubcategoryBar from "../components/subcategorybar";

import {
  getProductsPageFirestore,
  getHomeSectionsFS,
} from "../services/product.firesore.service";

/** helpers */
function clampInt(v, fallback, min = 1, max = 100_000) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const SUBCATS_BY_CAT = {
  "Moda & Accesorios": ["Vestidos", "Calzado", "Bolsos", "Trajes", "Pantalones", "Camisas", "Otros"],
  "Belleza & Accesorios": ["Maquillaje", "Pelo", "Joyas", "Otros"],
  "Complementos para peques": ["Bebés", "Niños", "Moda", "Otros"],
  Hogar: ["Cocina", "Decoración", "Baño", "Sala de estar", "Dormitorio", "Iluminacion"],
};

const MS_24H = 24 * 60 * 60 * 1000;
const DISCOUNT_DEADLINE_KEY = "chekea_discount_24h_deadline_ms";

function pad2(n) {
  return String(n).padStart(2, "0");
}
function formatMsToHMS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

console.log("MODE:", import.meta.env.MODE);
console.log("ALL ENV:", import.meta.env,'HOLA');
function CountdownChip({ label = "Termina en", msLeft = 0 }) {
  return (
    <Chip
      variant="filled"
      label={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800 }}>{label}</Typography>
          <Typography sx={{ fontFamily: "monospace", fontSize: 13, fontWeight: 900 }}>
            {formatMsToHMS(msLeft)}
          </Typography>
        </Box>
      }
      sx={{ borderRadius: 2 }}
    />
  );
}

function Section({ title, subtitle, right, items, loading }) {
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 4,
        p: { xs: 2, md: 2.5 },
        mb: 2,
        bgcolor: "background.paper",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 900, fontSize: { xs: 16, sm: 18 } }}>{title}</Typography>
          {subtitle ? (
            <Typography sx={{ color: "text.secondary", mt: 0.25, fontSize: 13 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {right ? <Box>{right}</Box> : null}
      </Box>

      <Box sx={{ mt: 1.5 }}>
        <ProductGrid items={items} loading={loading && (items?.length ?? 0) === 0} />
      </Box>
    </Paper>
  );
}

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const nav = useNavigate();

  const category = searchParams.get("cat") ?? "ALL";
  const subcat = searchParams.get("subcat") ?? "ALL";
  const sort = searchParams.get("sort") ?? "relevance";
  const pageSize = clampInt(searchParams.get("size"), 12, 4, 60);
  const page = clampInt(searchParams.get("p"), 1, 1, 100000);

  const isAll = category === "ALL";

  const [queryText, setQueryText] = useState("");

  // normal list
  const [items, setItems] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);

  // ALL sections
  const [newItems, setNewItems] = useState([]);
  const [discountItems, setDiscountItems] = useState([]);
  const [relevantItems, setRelevantItems] = useState([]);
  const [loadingAll, setLoadingAll] = useState(false);

  // recommended bottom
  const [recommendedItems, setRecommendedItems] = useState([]);
  const [loadingRec, setLoadingRec] = useState(false);

  const [error, setError] = useState("");

  // countdown
  const [discountDeadlineMs, setDiscountDeadlineMs] = useState(null);
  const [msLeft, setMsLeft] = useState(0);

  // pagination cache refs
  const pagesRef = useRef({});
  const lastDocsRef = useRef({ 1: null });
  const hasNextByPageRef = useRef({});
  const loadingRef = useRef(false);

  const updateParams = useCallback(
    (patch) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([k, v]) => {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const scrollToTop = useCallback(() => {
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  }, []);

  const resetToTop = useCallback(
    (patch) => {
      // reset pagination cache
      pagesRef.current = {};
      lastDocsRef.current = { 1: null };
      hasNextByPageRef.current = {};

      setItems([]);
      setHasNext(false);
      setError("");

      updateParams({ ...patch, p: 1 });
      scrollToTop();
    },
    [updateParams, scrollToTop]
  );

  // ✅ iconbar -> cat + subcat (2 params)
  const onCategoryChange = useCallback(
  (cat, nextSubcat) => {
    // si quieres que "Todo" vuelva al home
    console.log('sorry')
    if (cat === "ALL") {
      nav("/"); 
      return;
    }

    const qs = new URLSearchParams();
    qs.set("cat", cat);
    qs.set('label','')
    qs.set("subcat", nextSubcat ?? "ALL");
    qs.set("sort", sort);
    qs.set("size", String(pageSize));
    

    nav(`/categoria?${qs.toString()}`);
  },
  [nav, sort, pageSize]
);

  // const onCategoryChange = useCallback(
  //   (cat, nextSubcat) => {
  //     resetToTop({ cat, subcat: nextSubcat ?? "ALL" });
  //   },
  //   [resetToTop]
  // );

  const onSubcatChange = useCallback(
    (nextSub) => {
      if (!category || category === "ALL") {
        resetToTop({ subcat: "ALL" });
        return;
      }
      resetToTop({ subcat: nextSub });
    },
    [resetToTop, category]
  );

  const onSearchClick = useCallback(
    (q) => {
      const text = (q ?? "").trim();
      if (!text) return;

      const qs = new URLSearchParams();
      qs.set("q", text);

      if (category && category !== "ALL") qs.set("cat", category);
      if (subcat && subcat !== "ALL") qs.set("subcat", subcat);

      qs.set("sort", sort);
      qs.set("size", String(pageSize));

      nav(`/search?${qs.toString()}`);
    },
    [nav, category, subcat, sort, pageSize]
  );

  const subcatsForCat = useMemo(() => {
    if (!category || category === "ALL") return [];
    return SUBCATS_BY_CAT[category] ?? [];
  }, [category]);

  // ✅ countdown init (solo ALL)
  useEffect(() => {
    if (!isAll) return;

    const now = Date.now();
    const stored = Number(sessionStorage.getItem(DISCOUNT_DEADLINE_KEY) || 0);
    const valid = stored && stored > now;

    const deadline = valid ? stored : now + MS_24H;
    sessionStorage.setItem(DISCOUNT_DEADLINE_KEY, String(deadline));

    setDiscountDeadlineMs(deadline);
    setMsLeft(Math.max(0, deadline - now));
  }, [isAll]);

  // ✅ tick
  useEffect(() => {
    if (!isAll || !discountDeadlineMs) return;

    const tick = () => setMsLeft(Math.max(0, discountDeadlineMs - Date.now()));
    tick();

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isAll, discountDeadlineMs]);

  const refreshDiscountCycle = useCallback(() => {
    const now = Date.now();
    const next = now + MS_24H;
    sessionStorage.setItem(DISCOUNT_DEADLINE_KEY, String(next));
    setDiscountDeadlineMs(next);
    setMsLeft(MS_24H);
  }, []);

  // si llega a 0, reinicia ciclo
  useEffect(() => {
    if (!isAll) return;
    if (discountDeadlineMs && msLeft === 0) refreshDiscountCycle();
  }, [isAll, discountDeadlineMs, msLeft, refreshDiscountCycle]);

  // ✅ hard reset (cuando cambian filtros / idioma)
  useEffect(() => {
    setError("");
    setItems([]);
    setHasNext(false);

    setNewItems([]);
    setDiscountItems([]);
    setRelevantItems([]);

    pagesRef.current = {};
    lastDocsRef.current = { 1: null };
    hasNextByPageRef.current = {};

    if (page !== 1) updateParams({ p: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, subcat, sort, pageSize, i18n.language]);

  // ✅ ALL sections loader
  const loadAllSections = useCallback(async () => {
    if (!isAll) return;

    setLoadingAll(true);
    setError("");

    try {
     const res = await getHomeSectionsFS({ size: 6 });
setNewItems(res.recientes ?? []);

    } catch (e) {
      console.error(e);
      setError(t("loadError"));
    } finally {
      setLoadingAll(false);
    }
  }, [isAll, t]);

  useEffect(() => {
    if (!isAll) return;
    loadAllSections();
  }, [isAll, loadAllSections]);

  // refresca secciones cuando cambia el ciclo del countdown
  useEffect(() => {
    if (!isAll) return;
    if (discountDeadlineMs) loadAllSections();
  }, [isAll, discountDeadlineMs, loadAllSections]);

  // ✅ normal: pagination loader (solo cuando NO es ALL)
  const loadPage = useCallback(
    async (targetPage) => {
      if (isAll) return;
      if (loadingRef.current) return;

      // cache hit
      const cached = pagesRef.current[targetPage];
      if (Array.isArray(cached)) {
        setItems(cached);
        setHasNext(Boolean(hasNextByPageRef.current[targetPage]));
        setError("");
        scrollToTop();
        return;
      }

      setLoading(true);
      loadingRef.current = true;
      setError("");

      try {
        // carga incremental hasta targetPage para poder encadenar lastDoc
        for (let p = 1; p <= targetPage; p++) {
          if (Array.isArray(pagesRef.current[p])) continue;

          const lastDocForThisPage = lastDocsRef.current[p] ?? null;

          const res = await getProductsPageFirestore({
            pageSize,
            category,
            subcategory: subcat,
            sort,
            queryText: "",
            lastDoc: lastDocForThisPage,
          });

          pagesRef.current[p] = res?.items ?? [];
          hasNextByPageRef.current[p] = Boolean(res?.hasNext);
          lastDocsRef.current[p + 1] = res?.lastDoc ?? null;
        }

        setItems(pagesRef.current[targetPage] || []);
        setHasNext(Boolean(hasNextByPageRef.current[targetPage]));
      } catch (e) {
        console.error(e);
        setError(t("loadError"));
      } finally {
        setLoading(false);
        loadingRef.current = false;
        scrollToTop();
      }
    },
    [isAll, pageSize, category, subcat, sort, t, scrollToTop]
  );

  useEffect(() => {
    if (isAll) return;
    loadPage(page);
  }, [isAll, page, loadPage]);

  // ✅ map idioma (memo + callback)
  const mapLang = useCallback(
    (arr) => {
      const lang = i18n.language;
      return (arr ?? []).map((p) => ({
        ...p,
        title:
          lang === "en"
            ? p.title_en ?? p.titleEn ?? p.title ?? p.Titulo ?? ""
            : lang === "fr"
            ? p.title_fr ?? p.titleFr ?? p.title ?? p.Titulo ?? ""
            : p.title_es ?? p.title ?? p.Titulo ?? "",
        shipping:
          lang === "en"
            ? p.shipping_en ?? p.shippingEn ?? p.shipping ?? ""
            : lang === "fr"
            ? p.shipping_fr ?? p.shippingFr ?? p.shipping ?? ""
            : p.shipping_es ?? p.shipping ?? "",
      }));
    },
    [i18n.language]
  );



  // ✅ Recomendados (abajo)
  const loadRecommendations = useCallback(async () => {
    setLoadingRec(true);
    try {
      // Reglas:
      // - En ALL: recomenda "relevance" sin filtros (o ALL/ALL según tu backend)
      // - En categoría: filtra por category/subcat actual
      const recCategory = isAll ? "ALL" : category;
      const recSubcat = isAll ? "ALL" : subcat;

      const res = await getProductsPageFirestore({
        pageSize: 12, // traigo más para poder filtrar duplicados
        category: recCategory,
        subcategory: recSubcat,
        sort: "relevance",
        queryText: "",
        lastDoc: null,
      });

      let list = res?.items ?? [];

      // si estás en ALL, evita duplicar items de las 3 secciones
      if (isAll) {
        const taken = new Set(
          [
            ...(relevantItems ?? []),
          ]
            .map((p) => p?.id ?? p?.docId ?? p?._id)
            .filter(Boolean)
        );

        list = list.filter((p) => {
          const pid = p?.id ?? p?.docId ?? p?._id;
          return !pid || !taken.has(pid);
        });
      }

      setRecommendedItems(list.slice(0, 6));
    } catch (e) {
      console.error(e);
      setRecommendedItems([]);
    } finally {
      setLoadingRec(false);
    }
  }, [isAll, category, subcat, newItems, discountItems, relevantItems]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations, i18n.language, category, subcat]);

  const mappedRecommendedItems = useMemo(
    () => mapLang(recommendedItems),
    [recommendedItems, mapLang]
  );

  const paginationCount = hasNext ? page + 1 : page;
  const onPageChange = useCallback(
    (_e, nextPage) => {
      if (nextPage > page && !hasNext) return;
      updateParams({ p: nextPage });
    },
    [page, hasNext, updateParams]
  );


  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header queryText={queryText} onQueryChange={setQueryText} onSearchClick={onSearchClick} />

      <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2 }, py: { xs: 2, md: 3 } }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 4,
            mb: 2,
            background: "linear-gradient(135deg, rgba(15,93,58,0.12), rgba(242,201,76,0.18))",
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 900, fontSize: { xs: 20, sm: 24, md: 28 } }}>
            {t("brandLine")}
          </Typography>
          <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
            Chekea • {t("deals")}
          </Typography>
        </Paper>

        {/* ✅ Iconos tipo burbuja */}
<CategoryIconsBar value={category} onChange={onCategoryChange} variant="grid" />

        <Paper
          elevation={0}
          sx={{ mt: 1, mb: 2, borderRadius: 3, px: 1, py: 0.5, bgcolor: "background.paper" }}
        >
          <SubcategoryBar category={category} items={subcatsForCat} value={subcat} onChange={onSubcatChange} />
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
          {/* ✅ Recomendados abajo también en categorías */}
            {/* <Section
              title="Recomendados para ti"
              subtitle="Basado en tu categoría actual"
              items={recommendedItems}
              loading={loadingRec}
            /> */}

   
      </Container>
    </Box>
  );
}
