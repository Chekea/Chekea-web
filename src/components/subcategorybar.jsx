import React from "react";
import { Box, Chip } from "@mui/material";

export default function SubcategoryBar({ items = [], value = "ALL", onChange }) {
  if (!items || items.length === 0) return null;

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1,
        overflowX: "auto",
         py: 1,
        px: 0.5,
        mb: 1,
        "&::-webkit-scrollbar": { height: 6 },
      }}
    >
      <Chip
        label="Todas"
        clickable
        onClick={() => onChange("ALL")}
        variant={value === "ALL" ? "filled" : "outlined"}
        sx={{ flex: "0 0 auto", fontWeight: 700 }}
      />
      {items.map((sc) => (
        <Chip
          key={sc}
          label={sc}
          clickable
          onClick={() => onChange(sc)}
          variant={value === sc ? "filled" : "outlined"}
          sx={{ flex: "0 0 auto", fontWeight: 700 }}
        />
      ))}
    </Box>
  );
}
