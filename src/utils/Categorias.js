import React, { useEffect, useMemo, useRef, useState } from "react";
import { Container, Box, Alert, Paper, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import Header from "../components/header";
import FiltersBar from "../components/filterbar";
import ProductGrid from "../components/productgrid";
import EmptyState from "../components/emptystate";

import { getProductsPageDummy } from "../services/product.dummyservice";

/** -------- helpers -------- */
function clampInt(v, fallback, min = 0, max = 100_000) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const SS_PREFIX = "chekea_home_inf_v1:";

function buildKey({ lang, q, cat, sort, size }) {
  // key por combinación de filtros (para restaurar al volver atrás)
  return `${SS_PREFIX}${lang}|q=${q}|cat=${cat}|sort=${sort}|size=${size}`;
}

function ssRead(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function ssWrite(key, payload) {
  try {
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {}
}

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  // filtros desde URL (persisten con back/forward)
  const queryText = searchParams.get("q") ?? "";
  const category = searchParams.get("cat") ?? "ALL";
  const sort = searchParams.get("sort") ?? "relevance";
  const pageSize = clampInt(searchParams.get("size"), 12, 4, 60);

  // cursor/offset (cuántos items ya “saltamos”)
  const cursor = clampInt(searchParams.get("cursor"), 0, 0, 100_000);

  const key = useMemo(
    () => buildKey({ lang: i18n.language, q: queryText, cat: category, sort, size: pageSize }),
    [i18n.language, queryText, category, sort, pageSize]
  );

  // data acumulada
  const [items, setItems] = useState([]);
  const [hasNext, setHasNext] = useState(false);

  // control
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // refs
  const sentinelRef = useRef(null);
  const restoringRef = useRef(false);
  const cursorRef = useRef(0); // cursor real acumulado para loadMore
  const hasNextRef = useRef(false);
  const loadingRef = useRef(false);

  // helper: actualizar URL sin perder params
  const updateParams = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "") next.delete(k);
      else next.set(k, String(v));
    });
    setSearchParams(next, { replace: true });
  };

  /** -------- Reset cuando cambian filtros/idioma/size -------- */
  useEffect(() => {
    // cuando cambias filtros: reiniciar cursor a 0
    // pero si el usuario viene por back, ya vendrá con cursor en URL
    // así que SOLO reseteamos cuando el cambio lo provocas tú con handlers
    // (lo hacemos en los handlers con cursor:0)
  }, []);

  /** -------- Restaurar cache + scroll al montar/cambiar key -------- */
  useEffect(() => {
    // marca que estamos restaurando para evitar sobrescribir antes de tiempo
    restoringRef.current = true;

    const cached = ssRead(key);

    if (cached && Array.isArray(cached.items)) {
      setItems(cached.items);
      setHasNext(Boolean(cached.hasNext));
      cursorRef.current = clampInt(cached.cursor, 0, 0, 100_000);
      hasNextRef.current = Boolean(cached.hasNext);

      // restaurar cursor en URL si difiere (para que back/forward sea consistente)
      if (cursor !== cursorRef.current) {
        updateParams({ cursor: cursorRef.current });
      }

      // esperar a render y restaurar scroll
      requestAnimationFrame(() => {
        window.scrollTo({ top: cached.scrollY || 0, left: 0, behavior: "auto" });
        restoringRef.current = false;
      });

      return;
    }

    // si no hay cache: estado inicial (carga desde cursor URL)
    setItems([]);
    setHasNext(false);
    cursorRef.current = cursor;
    hasNextRef.current = false;
    restoringRef.current = false;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  /** -------- Guardar cache (items/cursor/hasNext/scroll) -------- */
  useEffect(() => {
    const save = () => {
      // evita guardar mientras se está restaurando y antes de tener data estable
      ssWrite(key, {
        items,
        cursor: cursorRef.current,
        hasNext,
        scrollY: window.scrollY || 0,
      });
    };

    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("pagehide", save);

    return () => {
      save();
      window.removeEventListener("scroll", save);
      window.removeEventListener("pagehide", save);
    };
  }, [key, items, hasNext]);

  /** -------- Fetch: cargar el “primer bloque” cuando items está vacío -------- */
  useEffect(() => {
    let alive = true;

    // si ya tenemos items (restaurados) NO recargues
    if (items.length > 0) return;

    (async () => {
      setLoading(true);
      loadingRef.current = true;
      setError("");

      try {
        const res = await getProductsPageDummy({
          pageSize,
          category,
          sort,
          queryText,
          cursorIndex: cursor, // 0 normalmente
        });

        if (!alive) return;

        setItems(res.items);
        setHasNext(res.hasNext);

        cursorRef.current = cursor + res.items.length;
        hasNextRef.current = res.hasNext;

        // reflejar cursor acumulado en URL (importante para back)
        updateParams({ cursor: cursorRef.current });
      } catch {
        if (!alive) return;
        setError(t("loadError"));
      } finally {
        if (!alive) return;
        setLoading(false);
        loadingRef.current = false;
      }
    })();

    return () => {
      alive = false;
    };
  }, [items.length, pageSize, category, sort, queryText, cursor, t]); // eslint-disable-line react-hooks/exhaustive-deps

  /** -------- Load more (cuando llegas al final) -------- */
  const loadMore = async () => {
    if (loadingRef.current) return;
    if (!hasNextRef.current) return;

    setLoading(true);
    loadingRef.current = true;
    setError("");

    try {
      const res = await getProductsPageDummy({
        pageSize,
        category,
        sort,
        queryText,
        cursorIndex: cursorRef.current,
      });

      setItems((prev) => [...prev, ...res.items]);
      setHasNext(res.hasNext);

      cursorRef.current = cursorRef.current + res.items.length;
      hasNextRef.current = res.hasNext;

      // guarda en URL para que back/forward recupere el “avance”
      updateParams({ cursor: cursorRef.current });
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  /** -------- IntersectionObserver (infinite scroll) -------- */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          loadMore();
        }
      },
      { root: null, rootMargin: "600px", threshold: 0.01 } // precarga antes de llegar al final
    );

    io.observe(el);
    return () => io.disconnect();
  }, [pageSize, category, sort, queryText]); // loadMore usa refs, no dependencias

  /** -------- Map multi-idioma -------- */
  const mappedItems = useMemo(() => {
    const lang = i18n.language;
    const catMap = {
      ELECTRONICS: { es: "Electrónica", en: "Electronics", fr: "Électronique" },
      FASHION: { es: "Moda", en: "Fashion", fr: "Mode" },
      HOME: { es: "Hogar", en: "Home", fr: "Maison" },
      BEAUTY: { es: "Belleza", en: "Beauty", fr: "Beauté" },
    };

    return items.map((p) => ({
      ...p,
      title: lang === "en" ? p.title_en : lang === "fr" ? p.title_fr : p.title,
      shipping: lang === "en" ? p.shipping_en : lang === "fr" ? p.shipping_fr : p.shipping,
      categoryText: catMap[p.category]?.[lang] ?? "",
    }));
  }, [items, i18n.language]);

  /** -------- Handlers: cuando cambia filtro, reinicia y limpia cache -------- */
  const resetToTop = (patch) => {
    // reinicia cursor y limpia estado visible
    updateParams({ ...patch, cursor: 0 });

    // limpia el estado (y cache se reescribe con nuevo key)
    setItems([]);
    setHasNext(false);
    cursorRef.current = 0;
    hasNextRef.current = false;

    // opcional: subir arriba (UX)
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "smooth" }));
  };

  const onQueryChange = (q) => resetToTop({ q });
  const onCategoryChange = (cat) => resetToTop({ cat });
  const onSortChange = (s) => resetToTop({ sort: s });
  const onPageSizeChange = (sz) => resetToTop({ size: sz });

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header queryText={queryText} onQueryChange={onQueryChange} />

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

        <FiltersBar
          category={category}
          onCategoryChange={onCategoryChange}
          sort={sort}
          onSortChange={onSortChange}
          pageSize={pageSize}
          onPageSizeChange={onPageSizeChange}
        />

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        {!loading && mappedItems.length === 0 ? (
          <EmptyState />
        ) : (
          <ProductGrid items={mappedItems} loading={loading && items.length === 0} />
        )}

        {/* sentinel para infinite scroll */}
        <Box ref={sentinelRef} sx={{ height: 1 }} />

        {/* indicador final */}
        <Box sx={{ py: 2, textAlign: "center", color: "text.secondary" }}>
          {loading && items.length > 0 ? "Cargando más productos..." : null}
          {!hasNext && items.length > 0 ? "Has llegado al final." : null}
        </Box>
      </Container>
    </Box>
  );
}
