import React, { memo, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import ProductCard from "./productcart";

/* ===== CONFIGURACIÓN ===== */
const CARD_HEIGHT = 420;
const IMAGE_HEIGHT = 190;
const INITIAL_RENDER = 6; // pinta pocas al inicio (mejor en WebView)
const BATCH_RENDER = 6;   // luego agrega en bloques
/* ========================= */

const SkeletonCard = memo(function SkeletonCard() {
  return (
    <Box
      sx={{
        height: CARD_HEIGHT,
        display: "flex",
        flexDirection: "column",
        borderRadius: 3,
      }}
    >
      <Skeleton variant="rectangular" height={IMAGE_HEIGHT} sx={{ borderRadius: 3 }} />
      <Skeleton height={28} sx={{ mt: 1 }} />
      <Skeleton height={18} width="70%" />
      <Skeleton height={32} sx={{ mt: 1 }} />
      <Box sx={{ mt: "auto" }}>
        <Skeleton variant="rectangular" height={40} width={60} sx={{ borderRadius: 2 }} />
      </Box>
    </Box>
  );
});

// Render progresivo para no bloquear UI thread
function useProgressiveItems(items, loading) {
  const [limit, setLimit] = useState(INITIAL_RENDER);

  useEffect(() => {
    setLimit(INITIAL_RENDER);
    if (loading) return;
    if (!items || items.length <= INITIAL_RENDER) return;

    let cancelled = false;

    const schedule = (fn) => {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        return window.requestIdleCallback(fn, { timeout: 350 });
      }
      return setTimeout(fn, 50);
    };

    let handle = null;

    const loop = () => {
      if (cancelled) return;
      setLimit((prev) => {
        const next = Math.min(items.length, prev + BATCH_RENDER);
        if (next >= items.length) return next;
        handle = schedule(loop);
        return next;
      });
    };

    handle = schedule(loop);

    return () => {
      cancelled = true;
      if (typeof handle === "number") clearTimeout(handle);
      else if (handle && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(handle);
      }
    };
  }, [items, loading]);

  return loading ? [] : items.slice(0, limit);
}

function areEqual(prev, next) {
  return prev.loading === next.loading && prev.items === next.items;
}

const ProductGrid = memo(function ProductGrid({ items = [], loading }) {
  const visibleItems = useProgressiveItems(items, loading);
  const skeletonCount = useMemo(() => 8, []);

  return (
    <Box
      sx={{
        display: "grid",
        gap: { xs: 1, sm: 2 },
        px: { xs: 1, sm: 0 },

        // 2 columnas móvil, 3 en sm, 4 en md+
        gridTemplateColumns: {
          xs: "repeat(2, minmax(0, 1fr))",
          sm: "repeat(3, minmax(0, 1fr))",
          md: "repeat(4, minmax(0, 1fr))",
        },

        // reduce costo layout/pintura en listas (WebView friendly)
        contain: "layout paint style",
        contentVisibility: "auto",
      }}
    >
      {loading
        ? Array.from({ length: skeletonCount }).map((_, i) => (
            <Box key={`sk-${i}`} sx={{ minWidth: 0, height: CARD_HEIGHT }}>
              <SkeletonCard />
            </Box>
          ))
        : visibleItems.map((p, idx) => (
            <Box
              key={p?.id ?? p?._id ?? p?.Codigo ?? `${p?.Titulo}-${p?.Precio}-${idx}`}
              sx={{ minWidth: 0, height: CARD_HEIGHT }}
            >
              {/* misma lógica: ProductCard recibe product */}
              <ProductCard product={p} isFirst={idx === 0} />
            </Box>
          ))}
    </Box>
  );
}, areEqual);

export default ProductGrid;
