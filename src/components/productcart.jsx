// src/components/productcart.jsx
import React, { memo, useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import { puntodecimal } from "../utils/Helpers";
import { pickCoverUrl } from "../utils/media";
import { openProductWhatsApp } from "../config/chekea";

function areEqual(prev, next) {
  const p = prev.product;
  const n = next.product;
  const pid = p?.Codigo ?? p?._id ?? p?.docId ?? p?.id;
  const nid = n?.Codigo ?? n?._id ?? n?.docId ?? n?.id;

  return pid === nid && prev.isFirst === next.isFirst && prev.dense === next.dense;
}

const ProductCard = memo(function ProductCard({ product, isFirst = false, dense = false }) {
  // Chekea: al tocar el producto se abre WhatsApp (no hay página de producto).
  const onOpen = useCallback(() => {
    openProductWhatsApp(product);
  }, [product]);

  const precio = Number(product?.Precio ?? 0) || 0;
  const discountPct = Number(product?.discount ?? product?.Descuento ?? 0) || 0;

  const finalPrice = useMemo(() => {
    if (discountPct > 0) return Number((precio * (1 - discountPct / 100)).toFixed(2));
    const rebaja = Number(product?.Rebaja ?? 0) || 0;
    return rebaja > 0 ? rebaja : precio;
  }, [precio, discountPct, product?.Rebaja]);

  const title = product?.Titulo ?? product?.title ?? "";
  const category = product?.Categoria ?? "";
  const lugar = product?.Ciudad ?? product?.ciudad ?? product?.Pais ?? "";

  // ✅ SIEMPRE thumb (barato)
  const img = useMemo(() => pickCoverUrl(product, { prefer: "thumb" }), [product]);

  return (
    <Box
      onClick={onOpen}
      role="button"
      aria-label={`Contactar por WhatsApp: ${title}`}
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

        {lugar ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
            <LocationOnOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
            <Typography sx={{ fontSize: 12, color: "text.secondary" }} noWrap>
              {lugar}
            </Typography>
          </Box>
        ) : null}

        <Typography sx={{ fontWeight: 900, fontSize: 15, mt: 1 }}>
          XFA {puntodecimal(finalPrice)}
        </Typography>

        {/* Botón/indicador: deja claro que al tocar se abre WhatsApp */}
        <Box
          sx={{
            mt: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.75,
            bgcolor: "#25D366",
            color: "#fff",
            borderRadius: 2,
            py: 0.75,
            fontWeight: 800,
            fontSize: 13,
          }}
        >
          <WhatsAppIcon sx={{ fontSize: 18 }} />
          Contactar
        </Box>
      </Box>
    </Box>
  );
}, areEqual);

export default ProductCard;
