// src/components/productcart.jsx
import React, { memo, useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import StarIcon from "@mui/icons-material/Star";
import { useNavigate } from "react-router-dom";
import { puntodecimal } from "../utils/Helpers";
import { pickCoverUrl } from "../utils/media";

function areEqual(prev, next) {
  const p = prev.product;
  const n = next.product;
  const pid = p?.Codigo ?? p?._id ?? p?.docId ?? p?.id;
  const nid = n?.Codigo ?? n?._id ?? n?.docId ?? n?.id;

  return pid === nid && prev.isFirst === next.isFirst && prev.dense === next.dense;
}

const ProductCard = memo(function ProductCard({ product, isFirst = false, dense = false }) {
  const navigate = useNavigate();

  const productId = useMemo(
    () => product?.Codigo ?? product?._id ?? product?.docId ?? product?.id ?? null,
    [product]
  );

  const onOpen = useCallback(() => {
    if (!productId) return;
    requestAnimationFrame(() => navigate(`/product/${productId}`));
  }, [navigate, productId]);

  const precio = Number(product?.Precio ?? 0) || 0;
  const discountPct = Number(product?.discount ?? product?.Descuento ?? 0) || 0;

  const finalPrice = useMemo(() => {
    if (discountPct > 0) return Number((precio * (1 - discountPct / 100)).toFixed(2));
    const rebaja = Number(product?.Rebaja ?? 0) || 0;
    return rebaja > 0 ? rebaja : precio;
  }, [precio, discountPct, product?.Rebaja]);

  const title = product?.Titulo ?? product?.title ?? "";
  const category = product?.Categoria ?? "";

  // ✅ SIEMPRE thumb (barato)
  const img = useMemo(() => pickCoverUrl(product, { prefer: "thumb" }), [product]);

  return (
    <Box
      onClick={onOpen}
      role="button"
      sx={{
        borderRadius: 3,
        overflow: "hidden",
        cursor: "pointer",
        bgcolor: "background.paper",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <Box
        component="img"
        src={img}
        alt={title}
        loading={isFirst ? "eager" : "lazy"}
        decoding="async"
        width="320"
        height="160"
        style={{
          width: "100%",
          height: dense ? 150 : 160,
          objectFit: "cover",
          display: "block",
        }}
      />

      <Box sx={{ p: 1.25 }}>
        <Typography sx={{ fontWeight: 900, fontSize: 14 }} noWrap>
          {title}
        </Typography>

        <Typography sx={{ fontSize: 12, color: "text.secondary" }} noWrap>
          {category}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
          <StarIcon sx={{ fontSize: 14 }} />
          <Typography sx={{ fontSize: 12, fontWeight: 700 }}>4.8</Typography>
        </Box>

        <Typography sx={{ fontWeight: 900, fontSize: 15, mt: 1 }}>
          XFA {puntodecimal(finalPrice)}
        </Typography>
      </Box>
    </Box>
  );
}, areEqual);

export default ProductCard;