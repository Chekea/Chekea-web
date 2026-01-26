import React, { useCallback, useMemo, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

import SearchIcon from "@mui/icons-material/Search";
import MenuIcon from "@mui/icons-material/Menu";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";

import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

export default function Header({ queryText = "", onQueryChange = () => {} }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const auth = useAuth();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [open, setOpen] = useState(false);

  const accountPath = useMemo(() => (auth.isAuthed ? "/account" : "/login"), [auth.isAuthed]);

  const go = useCallback(
    (path) => {
      nav(path);
      setOpen(false);
    },
    [nav]
  );

  const goSearch = useCallback(() => {
    const q = (queryText || "").trim();
    nav(q ? `/search?q=${encodeURIComponent(q)}` : `/search`);
    setOpen(false);
  }, [nav, queryText]);

  const openWhatsApp = useCallback(() => {
    const phone = "222237169";
    const message = "Hola, necesito ayuda con mi pedido";
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    setOpen(false);
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  return (
    <AppBar position="sticky" elevation={0} sx={{ bgcolor: "primary.main" }}>
      <Toolbar>
        <Container
          maxWidth="lg"
          sx={{ display: "flex", gap: 1.5, alignItems: "center", py: 0.5 }}
        >
          {/* Mobile: menú */}
          {isMobile && (
            <IconButton color="inherit" onClick={() => setOpen(true)} aria-label="Abrir menú">
              <MenuIcon />
            </IconButton>
          )}

          {/* Logo */}
          <Typography
            variant="h5"
            onClick={() => nav("/")}
            sx={{
              fontWeight: 900,
              letterSpacing: 0.2,
              fontSize: { xs: 18, sm: 22, md: 24 },
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

          {/* Desktop: íconos */}
          {!isMobile && (
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
          )}
        </Container>
      </Toolbar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="left"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: 290 } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 900, fontSize: 18 }}>
            <span style={{ color: theme.palette.primary.main }}>che</span>
            <span style={{ color: theme.palette.secondary.main }}>kea</span>
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {auth.isAuthed ? `Hola, ${auth.user?.email || "Usuario"}` : "Bienvenido"}
          </Typography>
        </Box>

        <Divider />

        <List>
          <ListItemButton onClick={() => go("/")}>
            <ListItemIcon>
              <HomeOutlinedIcon />
            </ListItemIcon>
            <ListItemText primary="Inicio" />
          </ListItemButton>

          <ListItemButton onClick={() => go("/cart")}>
            <ListItemIcon>
              <ShoppingCartOutlinedIcon />
            </ListItemIcon>
            <ListItemText primary="Mi caja" />
          </ListItemButton>

          <ListItemButton onClick={() => go(accountPath)}>
            <ListItemIcon>
              <PersonOutlineIcon />
            </ListItemIcon>
            <ListItemText primary={auth.isAuthed ? "Mi cuenta" : "Iniciar sesión"} />
          </ListItemButton>

          <ListItemButton onClick={openWhatsApp}>
            <ListItemIcon>
              <SupportAgentIcon />
            </ListItemIcon>
            <ListItemText primary="Atención al cliente (WhatsApp)" />
          </ListItemButton>
        </List>

        <Divider />

        <Box sx={{ p: 2 }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Chekea • compras y envíos
          </Typography>
        </Box>
      </Drawer>
    </AppBar>
  );
}
