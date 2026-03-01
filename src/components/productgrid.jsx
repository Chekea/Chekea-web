// src/components/productgrid.jsx
import React, { memo, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import ProductCard from "./productcart";

/* ===== CONFIGURACIÓN ===== */
const IMAGE_HEIGHT = 190;

// En móvil: render inicial menor
const INITIAL_RENDER_MOBILE = 4;
const BATCH_RENDER_MOBILE = 4;

// Desktop puede renderizar más
const INITIAL_RENDER_DESKTOP = 8;
const BATCH_RENDER_DESKTOP = 8;

// Skeletons
const SKELETON_COUNT_MOBILE = 6;
const SKELETON_COUNT_DESKTOP = 10;
/* ========================= */

const SkeletonCard = memo(function SkeletonCard({ dense = false }) {
  const h = dense ? 300 : 360;
  const imgH = dense ? 150 : IMAGE_HEIGHT;

  return (
    <Box
      sx={{
        height: h,
        display: "flex",
        flexDirection: "column",
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      <Skeleton variant="rectangular" height={imgH} />
      <Box sx={{ p: 1.25 }}>
        <Skeleton height={22} />
        <Skeleton height={16} width="70%" />
        <Skeleton height={28} sx={{ mt: 1 }} />
      </Box>
    </Box>
  );
});

// Render progresivo para no bloquear UI thread
function useProgressiveItems(items, loading, { initial, batch }) {
  const [limit, setLimit] = useState(initial);

  useEffect(() => {
    setLimit(initial);
    if (loading) return;
    if (!items || items.length <= initial) return;

    let cancelled = false;

    const schedule = (fn) => {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        return window.requestIdleCallback(fn, { timeout: 250 });
      }
      return window.setTimeout(fn, 50);
    };

    let handle = null;

    const loop = () => {
      if (cancelled) return;
      setLimit((prev) => {
        const next = Math.min(items.length, prev + batch);
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
        try {
          window.cancelIdleCallback(handle);
        } catch {}
      }
    };
  }, [items, loading, initial, batch]);

  return loading ? [] : items.slice(0, limit);
}

function areEqual(prev, next) {
  return prev.loading === next.loading && prev.items === next.items;
}

const ProductGrid = memo(function ProductGrid({ items = [], loading }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const dense = !isDesktop;

  const progressiveCfg = useMemo(
    () => ({
      initial: isDesktop ? INITIAL_RENDER_DESKTOP : INITIAL_RENDER_MOBILE,
      batch: isDesktop ? BATCH_RENDER_DESKTOP : BATCH_RENDER_MOBILE,
    }),
    [isDesktop]
  );

  const visibleItems = useProgressiveItems(items, loading, progressiveCfg);
  const skeletonCount = isDesktop ? SKELETON_COUNT_DESKTOP : SKELETON_COUNT_MOBILE;

  return (
    <Box
      sx={{
        display: "grid",
        gap: { xs: 1, sm: 2 },
        px: { xs: 1, sm: 0 },
        gridTemplateColumns: {
          xs: "repeat(2, minmax(0, 1fr))",
          sm: "repeat(3, minmax(0, 1fr))",
          md: "repeat(4, minmax(0, 1fr))",
        },
        contain: "layout paint style",
        ...(isDesktop ? { contentVisibility: "auto" } : null),
      }}
    >
      {loading
        ? Array.from({ length: skeletonCount }).map((_, i) => (
            <Box key={`sk-${i}`} sx={{ minWidth: 0 }}>
              <SkeletonCard dense={dense} />
            </Box>
          ))
        : visibleItems.map((p, idx) => (
            <Box
              key={p?.docId ?? p?.id ?? p?._id ?? p?.Codigo ?? `${p?.Titulo}-${p?.Precio}-${idx}`}
              sx={{ minWidth: 0 }}
            >
              <ProductCard product={p} isFirst={idx === 0} dense={dense} />
            </Box>
          ))}
    </Box>
  );
}, areEqual);

export default ProductGrid;