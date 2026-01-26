import React, { memo, useMemo } from "react";
import { Box, Typography, ButtonBase } from "@mui/material";

// Ajusta rutas:
import imgVestidos from "../assets/homeCats/vestidos.png";
import imgTops from "../assets/homeCats/tops.png";
import imgPlus from "../assets/homeCats/tallas-grandes.png";
import imgConjuntos from "../assets/homeCats/conjuntos.png";
import imgAbajo from "../assets/homeCats/partes-abajo.png";
import imgBolsos from "../assets/homeCats/bolsos.png";
import imgHombre from "../assets/homeCats/hombre.png";
import pelo from "../assets/homeCats/PELOS.png";

import imgKids from "../assets/homeCats/ninos-bebes.png";
import imgJerseys from "../assets/homeCats/jerseis-cardigans.png";
import joyas from "../assets/homeCats/ffff.jpg";
import imgSudaderas from "../assets/homeCats/sudaderas.png";
import imgAbrigos from "../assets/homeCats/abrigos-chaquetas.png";

const CategoryIconsBar = memo(function CategoryIconsBar({
  value = "ALL",
  onChange,
  variant = "grid", // "grid" | "row"
}) {
  const items = useMemo(
    () => [
      { label: "Vestidos", cat: "Moda & Accesorios", subcat: "Vestidos", img: imgVestidos },
      { label: "Tops", cat: "Moda & Accesorios", subcat: "Camisas", img: imgTops },
      { label: "Tallas Grandes", cat: "Moda & Accesorios", subcat: "Tallas Grandes", img: imgPlus },
      { label: "Conjuntos", cat: "Moda & Accesorios", subcat: "Trajes", img: imgConjuntos },
      { label: "Partes de abajo", cat: "Moda & Accesorios", subcat: "Pantalones", img: imgAbajo },
      { label: "Bolsos y Equipaje", cat: "Moda & Accesorios", subcat: "Bolsos", img: imgBolsos },
      { label: "Hombre", cat: "Moda & Accesorios", subcat: "Otros", img: imgHombre },
       { label: "Pelos", cat: "Belleza & Accesorios", subcat: "Pelo", img: pelo },
       { label: "Joyas", cat: "Belleza & Accesorios", subcat: "Joyas", img: joyas },
       { label: "Maquillaje", cat: "Belleza & Accesorios", subcat: "Otros", img: imgHombre },

      // { label: "Niños y Bebés", cat: "Complementos para peques", subcat: "Niños", img: imgKids },
      // { label: "Jerséis y Cárdigans", cat: "Moda & Accesorios", subcat: "Otros", img: imgJerseys },
      { label: "Sudaderas", cat: "Moda & Accesorios", subcat: "Otros", img: imgSudaderas },
      { label: "Abrigos y Chaquetas", cat: "Moda & Accesorios", subcat: "Otros", img: imgAbrigos },
    ],
    []
  );

  const isGrid = variant === "grid";

  return (
    <Box sx={{ mt: 1.5, mb: 2 }}>
      <Box
        sx={
          isGrid
            ? {
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(3, minmax(0, 1fr))",
                  sm: "repeat(4, minmax(0, 1fr))",
                  md: "repeat(6, minmax(0, 1fr))",
                },
                gap: { xs: 1.5, sm: 2 },
              }
            : {
                display: "flex",
                gap: 2,
                overflowX: "auto",
                pb: 1,
                "::-webkit-scrollbar": { height: 6 },
                "::-webkit-scrollbar-thumb": { borderRadius: 10 },
              }
        }
      >
        {/* Opción ALL */}
        {/* <QuickIcon
          active={value === "ALL"}
          label="Todo"
          img={null}
          onClick={() => onChange?.("ALL", "ALL")}
        /> */}

        {items.map((it) => (
          <QuickIcon
            key={it.label}
            active={value === it.cat}
            label={it.label}
            img={it.img}
            onClick={() => onChange?.(it.cat, it.subcat,it.label)}
          />
        ))}
      </Box>
    </Box>
  );
});

export default CategoryIconsBar;

const QuickIcon = memo(function QuickIcon({ label, img, onClick, active }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        borderRadius: 3,
        py: 0.75,
        transition: "transform .12s ease, opacity .12s ease",
        opacity: active ? 1 : 0.95,
        "&:hover": { transform: "translateY(-1px)", opacity: 1 },
        "&:focus-visible": { outline: "3px solid rgba(15,93,58,0.25)" },
      }}
    >
      <Box sx={{ width: "100%", textAlign: "center" }}>
        <Box
          sx={{
            width: { xs: 84, sm: 92 },
            height: { xs: 84, sm: 92 },
            mx: "auto",
            borderRadius: "50%",
            bgcolor: "rgba(0,0,0,0.06)",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            outline: active ? "2px solid rgba(15,93,58,0.35)" : "2px solid transparent",
          }}
        >
          {img ? (
            <Box
              component="img"
              src={img}
              alt={label}
              loading="lazy"
              decoding="async"
              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Typography sx={{ fontWeight: 900, fontSize: 14 }}>ALL</Typography>
          )}
        </Box>

        <Typography
          sx={{
            mt: 1,
            fontSize: { xs: 12.5, sm: 13 },
            fontWeight: 700,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            px: 0.5,
          }}
          title={label}
        >
          {label}
        </Typography>
      </Box>
    </ButtonBase>
  );
});
