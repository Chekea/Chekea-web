import React from "react";
import { Card, CardContent, CardMedia, Typography, Box, Chip, Stack } from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { puntodecimal } from "../utils/Helpers";

export default function ProductCard({ product }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const navegarprod = () => {
    const productId = product?.Codigo ?? product?._id ?? product?.docId ?? product?.id;
    if (!productId) return;
    navigate(`/product/${productId}`);
  };

  const finalPrice =
    product.discount > 0
      ? Number((product.Precio * (1 - product.discount / 100)).toFixed(2))
      : product.Precio;

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 3,
        overflow: "hidden",
        width: "100%",     // ✅ CLAVE: ocupa toda la columna
        minWidth: 0,       // ✅ CLAVE: permite encoger
      }}
    >
      <Box sx={{ cursor: "pointer", width: "100%", minWidth: 0 }} onClick={navegarprod}>
        {/* ✅ el contenedor debe ser relative para el Chip */}
        <Box sx={{ position: "relative", width: "100%" }}>
          <CardMedia
            component="img"
            sx={{
              height: 190,
              width: "100%",       // ✅ CLAVE
              display: "block",
              objectFit: "cover",  // ✅ mejor en móvil
            }}
            image={product.Imagen || "https://via.placeholder.com/600?text=Chekea"}
            alt={product.Titulo}
            loading="lazy"
          />

          {product.discount > 0 && (
            <Chip
              label={`-${product.discount}%`}
              color="secondary"
              sx={{ position: "absolute", top: 10, left: 10, fontWeight: 900 }}
            />
          )}
        </Box>

        <CardContent sx={{ minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 900 }}
            noWrap
            title={product.Titulo}
          >
            {product.Titulo}
          </Typography>

          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {(product.Categoria || "") + (product.shipping ? ` • ${product.shipping}` : "")}
          </Typography>

          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1 }}>
            <StarIcon fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              {product.rating ?? "4.0"}
            </Typography>
          </Stack>

          <Box sx={{ mt: 1.5, display: "flex", alignItems: "baseline", gap: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              XFA {puntodecimal(finalPrice)}
            </Typography>

            {product.discount > 0 && (
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", textDecoration: "line-through" }}
              >
                {product.Precio}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Box>
    </Card>
  );
}
