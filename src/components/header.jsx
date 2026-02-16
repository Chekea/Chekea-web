import React, { useCallback, useMemo } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import SearchIcon from "@mui/icons-material/Search";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";

import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

export default function Header({ queryText = "", onQueryChange = () => {} }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const auth = useAuth();

  const accountPath = useMemo(
    () => (auth.isAuthed ? "/account" : "/login"),
    [auth.isAuthed]
  );

  const goSearch = useCallback(() => {
    const q = (queryText || "").trim();
    nav(q ? `/search?q=${encodeURIComponent(q)}` : `/search`);
  }, [nav, queryText]);

  const openWhatsApp = useCallback(() => {
    const phone = "222237169";
    const message = "Hola, necesito ayuda con mi pedido";
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  return (
    <AppBar position="sticky" elevation={0} sx={{ bgcolor: "primary.main" }}>
      <Toolbar>
        <Container
          maxWidth="lg"
          sx={{ display: "flex", gap: 1.5, alignItems: "center", py: 0.5 }}
        >
          {/* Logo */}
          <Typography
            variant="h5"
            onClick={() => nav("/")}
            sx={{
              fontWeight: 900,
              letterSpacing: 0.2,
              fontSize: 24,
              whiteSpace: "nowrap",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <span style={{ color: "#fff" }}>che</span>
            <span style={{ color: "#F2C94C" }}>kea</span>
          </Typography>

          {/* Search */}
          <Box sx={{ flex: 1, display: "flex" }}>
            <TextField
              value={queryText}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") goSearch();
              }}
              placeholder={t("searchPlaceholder")}
              size="small"
              fullWidth
              sx={{
                bgcolor: "rgba(255,255,255,0.12)",
                borderRadius: 2,
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(255,255,255,0.25)",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(255,255,255,0.35)",
                },
                "& input": { color: "#fff" },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <IconButton onClick={goSearch} edge="start" aria-label="Buscar">
                      <SearchIcon sx={{ color: "rgba(255,255,255,0.9)" }} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* Íconos */}
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
            <Tooltip title="Carrito">
              <IconButton color="inherit" onClick={() => nav("/cart")} aria-label="Carrito">
                <ShoppingCartOutlinedIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title={auth.isAuthed ? "Mi cuenta" : "Iniciar sesión"}>
              <IconButton color="inherit" onClick={() => nav(accountPath)} aria-label="Cuenta">
                <PersonOutlineIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Atención al cliente (WhatsApp)">
              <IconButton color="inherit" onClick={openWhatsApp} aria-label="WhatsApp soporte">
                <SupportAgentIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Container>
      </Toolbar>
    </AppBar>
  );
}
