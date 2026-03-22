// HomePage.jsx
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
  Divider,
  CircularProgress,
} from "@mui/material";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import AccessTimeFilledRoundedIcon from "@mui/icons-material/AccessTimeFilledRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import WhatshotRoundedIcon from "@mui/icons-material/WhatshotRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";

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
  getProductsByCountry,
} from "../services/product.firesore.service";
import { useEffectiveAuth } from "../state/useEffectiveAuth";

function clampInt(v, fallback, min = 1, max = 100000) {
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

function normalizeProduct(p, lang) {
  return {
    ...p,
    id: p.id ?? p._id ?? crypto.randomUUID(),
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
    image:
      p.image ??
      p.imagen ??
      p.thumbnail ??
      p.photo ??
      p.foto ??
      p.images?.[0] ??
      p.Imagen ??
      "",
    price:
      p.price ??
      p.precio ??
      p.Precio ??
      p.priceValue ??
      0,
    country: p.country ?? p.Pais ?? "",
  };
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  onAction,
  accent = "primary",
  rightNode = null,
}) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      alignItems={{ xs: "flex-start", md: "center" }}
      justifyContent="space-between"
      spacing={2}
      sx={{ mb: 2 }}
    >
      <Box>
        {eyebrow ? (
          <Chip
            label={eyebrow}
            size="small"
            color={accent}
            sx={{ mb: 1, fontWeight: 700 }}
          />
        ) : null}

        <Typography
          variant="h5"
          sx={{
            fontWeight: 900,
            letterSpacing: "-0.02em",
            fontSize: { xs: "1.25rem", md: "1.65rem" },
          }}
        >
          {title}
        </Typography>

        {subtitle ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, maxWidth: 760 }}
          >
            {subtitle}
          </Typography>
        ) : null}
      </Box>

      <Stack direction="row" spacing={1} alignItems="center">
        {rightNode}
        {actionLabel ? (
          <Button
            variant="text"
            onClick={onAction}
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{ fontWeight: 800 }}
          >
            {actionLabel}
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
}

function SectionBlock({
  title,
  subtitle,
  items,
  loading,
  actionLabel,
  onAction,
  eyebrow,
  accent = "primary",
  emptyText = "No hay productos disponibles por ahora.",
  rightNode = null,
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, md: 2 },
        borderRadius: 4,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <SectionHeader
        title={title}
        subtitle={subtitle}
        actionLabel={actionLabel}
        onAction={onAction}
        eyebrow={eyebrow}
        accent={accent}
        rightNode={rightNode}
      />

      {loading ? (
        <Box sx={{ minHeight: 220, display: "grid", placeItems: "center" }}>
          <Stack spacing={1.5} alignItems="center">
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Cargando productos...
            </Typography>
          </Stack>
        </Box>
      ) : items?.length ? (
        <ProductGrid items={items} />
      ) : (
        <Box sx={{ py: 2 }}>
          <EmptyState title="Sin resultados" subtitle={emptyText} />
        </Box>
      )}
    </Paper>
  );
}

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const nav = useNavigate();
  const { user } = useEffectiveAuth();
  const userId = user?.uid ?? null;

  const category = searchParams.get("cat") ?? "ALL";
  const subcat = searchParams.get("subcat") ?? "ALL";
  const sort = searchParams.get("sort") ?? "relevance";
  const pageSize = clampInt(searchParams.get("size"), 12, 4, 60);
  const page = clampInt(searchParams.get("p"), 1, 1, 100000);
  const isAll = category === "ALL";

  const [queryText, setQueryText] = useState("");
  const [items, setItems] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);

  const [newItems, setNewItems] = useState([]);
  const [loadingAll, setLoadingAll] = useState(false);

  const [localGQItems, setLocalGQItems] = useState([]);
  const [loadingLocalGQ, setLoadingLocalGQ] = useState(false);

  const [error, setError] = useState("");

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

  const onCategoryEspecial = useCallback(()=>{
nav(`/cate`);

  },[])
  const onCategoryChange = useCallback(
    (cat, nextSubcat) => {
      if (cat === "ALL") {
        nav("/");
        return;
      }

      const qs = new URLSearchParams();
      qs.set("cat", cat);
      qs.set("label", "");
      qs.set("subcat", nextSubcat ?? "ALL");
      qs.set("sort", sort);
      qs.set("size", String(pageSize));

      nav(`/categoria?${qs.toString()}`);
    },
    [nav, sort, pageSize]
  );

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

  useEffect(() => {
    setError("");
    setItems([]);
    setHasNext(false);
    setNewItems([]);

    pagesRef.current = {};
    lastDocsRef.current = { 1: null };
    hasNextByPageRef.current = {};

    if (page !== 1) updateParams({ p: 1 });
  }, [category, subcat, sort, pageSize, i18n.language, page, updateParams]);

  const loadAllSections = useCallback(async () => {
    if (!isAll) return;

    setLoadingAll(true);
    setError("");

    try {
      const res = await getHomeSectionsFS({ size: 6, userId });
      setNewItems(Array.isArray(res?.recientes) ? res.recientes : []);
    } catch (e) {
      console.error(e);
      setError(t("loadError"));
    } finally {
      setLoadingAll(false);
    }
  }, [isAll, t, userId]);

  useEffect(() => {
    if (isAll) loadAllSections();
  }, [isAll, loadAllSections]);

  const loadLocalGQSection = useCallback(async () => {
    if (!isAll) return;

    setLoadingLocalGQ(true);

    try {
      const res = await getProductsByCountry({
        country: "Guinea Ecuatorial",
        pageSize: 8,
      });

      setLocalGQItems(Array.isArray(res?.items) ? res.items : []);
    } catch (e) {
      console.error(e);
      setLocalGQItems([]);
    } finally {
      setLoadingLocalGQ(false);
    }
  }, [isAll]);

  useEffect(() => {
    loadLocalGQSection();
  }, [loadLocalGQSection]);

  const loadPage = useCallback(
    async (targetPage) => {
      if (isAll || loadingRef.current) return;

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
        for (let p = 1; p <= targetPage; p += 1) {
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
    if (!isAll) loadPage(page);
  }, [isAll, page, loadPage]);

  const mappedItems = useMemo(
    () => (items ?? []).map((p) => normalizeProduct(p, i18n.language)),
    [items, i18n.language]
  );

  const mappedNewItems = useMemo(
    () => (newItems ?? []).map((p) => normalizeProduct(p, i18n.language)),
    [newItems, i18n.language]
  );

  const mappedLocalGQItems = useMemo(
    () => (localGQItems ?? []).map((p) => normalizeProduct(p, i18n.language)),
    [localGQItems, i18n.language]
  );

  const paginationCount = hasNext ? page + 1 : page;

  const onPageChange = useCallback(
    (_e, nextPage) => {
      if (nextPage > page && !hasNext) return;
      updateParams({ p: nextPage });
    },
    [page, hasNext, updateParams]
  );

  const openLocal48hSearch = useCallback(() => {
    const qs = new URLSearchParams();
    qs.set("country", "Guinea Ecuatorial");
    qs.set("city", "Malabo");
    qs.set("delivery", "48h");
    qs.set("sort", "relevance");
    qs.set("size", "12");
    nav(`/search?${qs.toString()}`);
  }, [nav]);

  const openSectionSearch = useCallback(
    (extra = {}) => {
      const qs = new URLSearchParams();

      Object.entries(extra).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          qs.set(key, String(value));
        }
      });

      nav(`/search?${qs.toString()}`);
    },
    [nav]
  );

  const heroStats = useMemo(
    () => [
      { icon: <Inventory2RoundedIcon sx={{ fontSize: 18 }} />, label: "Stock local" },
      { icon: <AccessTimeFilledRoundedIcon sx={{ fontSize: 18 }} />, label: "Entrega 48h" },
      { icon: <PlaceRoundedIcon sx={{ fontSize: 18 }} />, label: "Malabo" },
      { icon: <LocalShippingRoundedIcon sx={{ fontSize: 18 }} />, label: "Más rápido" },
    ],
    []
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header
        queryText={queryText}
        onQueryChange={setQueryText}
        onSearchClick={onSearchClick}
      />

      <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2 }, py: { xs: 2, md: 3 } }}>
        {error ? (
          <Alert severity="error" sx={{ mt: 1, mb: 2 }}>
            {error}
          </Alert>
        ) : null}

    

        {isAll ? (
          <Box sx={{ mb: 3 }}>
            <SectionBlock
              eyebrow="Entrega a domicilio en 48h  en Malabo"
              accent="success"
              title="Ya en Guinea Ecuatorial"
              subtitle="Productos disponibles localmente para entrega rápida en Malabo."
              items={mappedLocalGQItems}
              loading={loadingLocalGQ}
              actionLabel="Ver todos"
              onAction={onCategoryEspecial}
              emptyText="Aún no hay productos locales con entrega 48h disponibles."
              rightNode={
                <Chip
                  icon={<LocalShippingRoundedIcon />}
                  label="Entrega estimada: 48h"
                  color="success"
                  variant="filled"
                  sx={{ fontWeight: 800 }}
                />
              }
            />
          </Box>
        ) : null}
         <Stack spacing={3}>
            <SectionBlock
              eyebrow="Compra Por Encargo"
              accent="info"
              title="Recién llegados"
              subtitle="Lo último en entrar al catálogo."
              items={mappedNewItems}
              loading={loadingAll}
              // actionLabel="Ver más"
              onAction={() => openSectionSearch({ sort: "newest", size: 12 })}
              emptyText="Todavía no hay novedades disponibles."
            />
          </Stack>

        <CategoryIconsBar value={category} onChange={onCategoryChange} variant="grid" />

        <Paper
          elevation={0}
          sx={{
            mt: 1,
            mb: 2,
            borderRadius: 3,
            px: 1,
            py: 0.5,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <SubcategoryBar
            category={category}
            items={subcatsForCat}
            value={subcat}
            onChange={onSubcatChange}
          />
        </Paper>

       
      </Container>
    </Box>
  );
}