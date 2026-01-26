import React, { useEffect, useMemo, useRef, useState } from "react";
import { Container, Box, Alert, Paper, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import Header from "../components/header";
import FiltersBar from "../components/filterbar";
import ProductGrid from "../components/productgrid";
import EmptyState from "../components/emptystate";
import PaginationBarCursor from "../components/paginationbarcursor";
import { getProductsPageDummy } from "../services/product.dummyservice";

// import { getProductsPage } from "../services/product.service";

export default function App() {
  const { t, i18n } = useTranslation();

  // filtros (estado)
  const [queryText, setQueryText] = useState("");
  const [category, setCategory] = useState("ALL");
  const [sort, setSort] = useState("relevance");

  // paginación (estado)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // cursores: cursorByPage[page] = lastDocSnapshot de esa página
  const [cursorByPage, setCursorByPage] = useState({});

  // datos (estado)
  const [items, setItems] = useState([]);
  const [hasNext, setHasNext] = useState(false);

  // loading/error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const topRef = useRef(null);

  // Reset paginación al cambiar filtros, idioma o pageSize
  useEffect(() => {
    setPage(1);
    setCursorByPage({});
  }, [queryText, category, sort, pageSize, i18n.language]);

  // // Cargar página actual desde Firestore
  // useEffect(() => {
  //   let alive = true;

  //   async function run() {
  //     setLoading(true);
  //     setError("");

  //     try {
  //       const cursorDoc = page > 1 ? cursorByPage[page - 1] : null;

  //       const res = await getProductsPage({
  //         pageSize,
  //         category,
  //         sort,
  //         queryText,
  //         cursorDoc,
  //       });

  //       if (!alive) return;

  //       setItems(res.items);
  //       setHasNext(res.hasNext);

  //       setCursorByPage((prev) => {
  //         const next = { ...prev };
  //         if (res.lastDoc) next[page] = res.lastDoc;
  //         return next;
  //       });

  //       topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  //     } catch (e) {
  //       if (!alive) return;
  //       setError(t("loadError"));
  //     } finally {
  //       if (!alive) return;
  //       setLoading(false);
  //     }
  //   }

  //   run();
  //   return () => { alive = false; };
  // }, [page, pageSize, category, sort, queryText, cursorByPage, t]);
  const [cursorIndex, setCursorIndex] = useState(0);

useEffect(() => {
  let alive = true;

  async function run() {
    setLoading(true);
    setError("");

    try {
      const res = await getProductsPageDummy({
        pageSize,
        category,
        sort,
        queryText,
        cursorIndex,
      });

      if (!alive) return;

      setItems(res.items);
      setHasNext(res.hasNext);
    } catch (e) {
      if (!alive) return;
      setError(t("loadError"));
    } finally {
      if (!alive) return;
      setLoading(false);
    }
  }

  run();
  return () => { alive = false; };
}, [pageSize, category, sort, queryText, cursorIndex, t]);


  // Mapeo multi-idioma para UI (sin romper tu DB)
  const mappedItems = useMemo(() => {
    const lang = i18n.language;

    const categoryTextMap = {
      ELECTRONICS: { es: "Electrónica", en: "Electronics", fr: "Électronique" },
      FASHION: { es: "Moda", en: "Fashion", fr: "Mode" },
      HOME: { es: "Hogar", en: "Home", fr: "Maison" },
      BEAUTY: { es: "Belleza", en: "Beauty", fr: "Beauté" },
    };

    return items.map((p) => {
      const title =
        lang === "en" ? (p.title_en ?? p.title) :
        lang === "fr" ? (p.title_fr ?? p.title) :
        p.title;

      const shipping =
        lang === "en" ? (p.shipping_en ?? p.shipping) :
        lang === "fr" ? (p.shipping_fr ?? p.shipping) :
        p.shipping;

      const categoryText = categoryTextMap[p.category]?.[lang] ?? "";

      return { ...p, title, shipping, categoryText };
    });
  }, [items, i18n.language]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header queryText={queryText} onQueryChange={setQueryText} />

      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
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

        <FiltersBar
          category={category}
          onCategoryChange={setCategory}
          sort={sort}
          onSortChange={setSort}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />

        <Box ref={topRef} sx={{ mt: 2 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && mappedItems.length === 0 ? (
          <EmptyState />
        ) : (
          <ProductGrid items={mappedItems} loading={loading} />
        )}

        <PaginationBarCursor
          page={page}
          hasNext={hasNext}
          loading={loading}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      </Container>
    </Box>
  );
}
