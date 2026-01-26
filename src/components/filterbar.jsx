import React from "react";
import { Paper, Box, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import { useTranslation } from "react-i18next";

/**
 * Categorías BASE para que no dependan del idioma en DB.
 * En Firestore: category = "ELECTRONICS" etc.
 */
const CATEGORIES_BASE = [
  { key: "ALL", label: { es: "Todas", en: "All", fr: "Toutes" } },
  { key: "ELECTRONICS", label: { es: "Electrónica", en: "Electronics", fr: "Électronique" } },
  { key: "Moda & Accesorios", label: { es: "Moda", en: "Fashion", fr: "Mode" } },
  { key: "Hogar", label: { es: "Hogar", en: "Home", fr: "Maison" } },
  { key: "Belleza & Accesorios", label: { es: "Belleza", en: "Beauty", fr: "Beauté" } },
];

export default function FiltersBar({
  category,
  onCategoryChange,
  sort,
  onSortChange,
  pageSize,
  onPageSizeChange,
}) {
  const { t, i18n } = useTranslation();

  const catLabel = (c) => c.label[i18n.language] ?? c.label.es;

  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
          gap: 2,
          alignItems: "center",
        }}
      >
        <FormControl fullWidth size="small">
          <InputLabel>{t("category")}</InputLabel>
          <Select
            label={t("category")}
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            {CATEGORIES_BASE.map((c) => (
              <MenuItem key={c.key} value={c.key}>
                {catLabel(c)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel>{t("sort")}</InputLabel>
          <Select
            label={t("sort")}
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
          >
            <MenuItem value="relevance">{t("relevance")}</MenuItem>
            <MenuItem value="price_asc">{t("priceAsc")}</MenuItem>
            <MenuItem value="price_desc">{t("priceDesc")}</MenuItem>
            <MenuItem value="rating_desc">{t("ratingDesc")}</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel>{t("perPage")}</InputLabel>
          <Select
            label={t("perPage")}
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {[8, 12, 16, 24].map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Paper>
  );
}
