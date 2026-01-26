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

export default function CategoryPage() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /* -------------------- URL params -------------------- */
  const category = searchParams.get("cat") ?? "ALL";
  const subcat = searchParams.get("subcat") ?? "ALL";
  const sort = searchParams.get("sort") ?? "relevance";
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

  /* -------------------- RESET cursores cuando cambia contexto -------------------- */
  useEffect(() => {
    lastDocsRef.current = { 1: null };
    updateParams({ p: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, subcat, sort]);

  /* -------------------- CARGA REAL CON CURSOR -------------------- */
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);      // 🔥 loader ON
      setError("");
      setItems([]);          // 🔥 pantalla limpia

      try {
        const lastDoc = lastDocsRef.current[page] ?? null;

        const res = await getProductsPageFirestore({
          pageSize: PAGE_SIZE,
          category,
          subcategory: subcat,
          sort,
          queryText: "",
          lastDoc, // 🔑 CLAVE para Firestore
        });

        if (!alive) return;

        setItems(res?.items ?? []);
        setHasNext(Boolean(res?.hasNext));

        // 🔑 guarda cursor para la siguiente página
        lastDocsRef.current[page + 1] = res?.lastDoc ?? null;
      } catch (e) {
        console.error(e);
        if (alive) setError(t("loadError"));
      } finally {
        if (alive) {
          setLoading(false); // 🔥 loader OFF
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
