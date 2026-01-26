import React from "react";
import { Stack, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

export default function PaginationBarCursor({ page, hasNext, loading, onPrev, onNext }) {
  const { t } = useTranslation();

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      sx={{ mt: 3, alignItems: "center", justifyContent: "space-between" }}
    >
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {t("page")} {page}
      </Typography>

      <Stack direction="row" spacing={1} sx={{ width: { xs: "100%", sm: "auto" } }}>
        <Button
          fullWidth
          variant="outlined"
          disabled={loading || page === 1}
          onClick={onPrev}
        >
          {t("prev")}
        </Button>
        <Button
          fullWidth
          variant="contained"
          disabled={loading || !hasNext}
          onClick={onNext}
        >
          {t("next")}
        </Button>
      </Stack>
    </Stack>
  );
}
