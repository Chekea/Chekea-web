import React, { memo, useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import StarIcon from "@mui/icons-material/Star";
import { useNavigate } from "react-router-dom";
import { puntodecimal } from "../utils/Helpers";

const FALLBACK_IMG = "https://via.placeholder.com/600?text=Chekea";

function areEqual(prev, next) {
  return prev.product === next.product && prev.isFirst === next.isFirst;
}

const ProductCard = memo(function ProductCard({ product, isFirst = false }) {
  const navigate = useNavigate();

  // ✅ misma lógica de negocio para ID
  const productId = useMemo(() => {
    return product?.Codigo ?? product?._id ?? product?.docId ?? product?.id ?? null;
  }, [product]);

  const navegarprod = useCallback(() => {
    if (!productId) return;
    // rAF ayuda a que el tap se sienta más fluido en WebView
    requestAnimationFrame(() => navigate(`/product/${productId}`));
  }, [navigate, productId]);

  // ✅ misma lógica de negocio para discount/precio
  const discount = Number(product?.discount ?? 0) || 0;
  const precio = Number(product?.Precio ?? 0) || 0;

  const finalPrice = useMemo(() => {
    return discount > 0 ? Number((precio * (1 - discount / 100)).toFixed(2)) : precio;
  }, [precio, discount]);

  const title = product?.Titulo ?? "";
  const category = product?.Categoria ?? "";
  const shipping = product?.shipping ?? "";
  const rating = product?.rating ?? "4.0";
  const img = product?.Imagen || FALLBACK_IMG;

  return (
    <Box
      onClick={navegarprod}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") navegarprod();
      }}
      sx={{
        borderRadius: 3,
        overflow: "hidden",
        width: "100%",
        minWidth: 0,
        cursor: "pointer",
        backgroundColor: "background.paper",
        border: "1px solid rgba(0,0,0,0.06)",
        contain: "layout paint style",
      }}
    >
      {/* Imagen */}
      <Box sx={{ position: "relative", width: "100%" }}>
        <Box
          component="img"
          src={img}
          alt={title}
          loading={isFirst ? "eager" : "lazy"}
          decoding="async"
          {...(isFirst ? { fetchpriority: "high" } : {})}
          style={{
            width: "100%",
            height: 190,
            display: "block",
            objectFit: "cover",
          }}
        />

        {discount > 0 && (
          <Box
            sx={{
              position: "absolute",
              top: 10,
              left: 10,
              px: 1,
              py: 0.5,
              borderRadius: 999,
              fontWeight: 900,
              fontSize: 12,
              bgcolor: "secondary.main",
              color: "secondary.contrastText",
            }}
          >
            -{discount}%
          </Box>
        )}
      </Box>

      {/* Contenido */}
      <Box sx={{ p: 1.25, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 900, fontSize: 14 }} noWrap title={title}>
          {title}
        </Typography>

        <Typography
          sx={{ color: "text.secondary", fontSize: 12 }}
          noWrap
          title={category + (shipping ? ` • ${shipping}` : "")}
        >
          {category}
          {shipping ? ` • ${shipping}` : ""}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.75 }}>
          <StarIcon sx={{ fontSize: 16 }} />
          <Typography sx={{ fontWeight: 800, fontSize: 12 }}>{rating}</Typography>
        </Box>

        <Box sx={{ mt: 1, display: "flex", alignItems: "baseline", gap: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: 16 }}>
            XFA {puntodecimal(finalPrice)}
          </Typography>

          {discount > 0 && (
            <Typography
              sx={{
                color: "text.secondary",
                textDecoration: "line-through",
                fontSize: 12,
              }}
            >
              {puntodecimal(precio)}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}, areEqual);

export default ProductCard;
