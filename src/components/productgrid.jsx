import React from "react";
import { Grid, Skeleton, Box } from "@mui/material";
import ProductCard from "./productcart";

/* ===== CONFIGURACIÓN ===== */
const CARD_WIDTH = 190;   // usa 190 si lo quieres más pequeño
const CARD_HEIGHT = 420;
const IMAGE_HEIGHT = 190;
/* ========================= */

function SkeletonCard() {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: CARD_WIDTH,
        height: CARD_HEIGHT,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Skeleton
        variant="rectangular"
        height={IMAGE_HEIGHT}
        sx={{ borderRadius: 3 }}
      />

      <Skeleton height={28} sx={{ mt: 1 }} />
      <Skeleton height={18} width="70%" />
      <Skeleton height={32} sx={{ mt: 1 }} />

      <Box sx={{ mt: "auto" }}>
        <Skeleton
          variant="rectangular"
          height={40}
          width={60}
          sx={{ borderRadius: 2 }}
        />
      </Box>
    </Box>
  );
}

export default function ProductGrid({ items = [], loading }) {
  // 2 columnas móvil, 4 desktop
  const columns = { xs: 6, sm: 6, md: 4, lg: 3 };

  return (
    <Grid container spacing={2}>
      {loading
        ? Array.from({ length: 12 }).map((_, i) => (
            <Grid
              item
              key={i}
              {...columns}
              sx={{
                display: "flex",
                justifyContent: "center",
              }}
            >
              <SkeletonCard />
            </Grid>
          ))
        : items.map((p) => (
            <Grid
              item
    key={p?.id ?? p?._id ?? p?.Codigo ?? `${p?.Titulo}-${p?.Precio}-${idx}`}
            {...columns}
              sx={{
                display: "flex",
                justifyContent: "center",
              }}
            >
              {/* Wrapper que fija el ancho visual */}
              <Box
                sx={{
                  width: "100%",
                  maxWidth: CARD_WIDTH,
                  height: CARD_HEIGHT,
                }}
              >
                <ProductCard product={p}  />
              </Box>
            </Grid>
          ))}
    </Grid>
  );
}
