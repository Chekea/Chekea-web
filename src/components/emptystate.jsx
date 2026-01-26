import React from "react";
import { Paper, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

export default function EmptyState() {
  const { t } = useTranslation();

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, textAlign: "center" }}>
      <Typography sx={{ fontWeight: 900 }}>{t("empty")}</Typography>
    </Paper>
  );
}
