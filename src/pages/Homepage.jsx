// HomePage_Chequea_redesign.jsx
// Portada de Chekea. Optimizada para no volver a descargar los productos cada
// vez que el usuario entra y sale de la pantalla (usa una caché en memoria).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import FlightTakeoffRoundedIcon from "@mui/icons-material/FlightTakeoffRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import HeadphonesRoundedIcon from "@mui/icons-material/HeadphonesRounded";
import CheckroomRoundedIcon from "@mui/icons-material/CheckroomRounded";
import WeekendRoundedIcon from "@mui/icons-material/WeekendRounded";
import SpaRoundedIcon from "@mui/icons-material/SpaRounded";
import SportsEsportsRoundedIcon from "@mui/icons-material/SportsEsportsRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { useNavigate } from "react-router-dom";

import { useTranslation } from "react-i18next";

// El servicio de datos (y con él Firebase) se carga de forma DIFERIDA dentro de
// las funciones de carga, para que la portada se pinte antes de traer los datos.
import { useEffectiveAuth } from "../state/useEffectiveAuth";
import { openProductWhatsApp, openChekeaWhatsApp } from "../config/chekea";
import { imagenDe } from "../domain/product";
import { pickCoverUrl } from "../utils/media";
import { readCache, writeCache, FRESH_MS, DAY_MS } from "../services/feedCache";



const POPULAR_CATEGORIES = [
  { label: "Electrónica", icon: HeadphonesRoundedIcon, route: "/categoria?cat=Electrónica" },
  { label: "Moda", icon: CheckroomRoundedIcon, route: "/categoria?cat=Moda%20%26%20Accesorios" },
  { label: "Hogar", icon: WeekendRoundedIcon, route: "/categoria?cat=Hogar" },
  { label: "Belleza", icon: SpaRoundedIcon, route: "/categoria?cat=Belleza%20%26%20Accesorios" },
  { label: "Deportes", icon: SportsEsportsRoundedIcon, route: "/categoria?cat=Deportes" },
];

// Baraja una copia del array (Fisher-Yates) y devuelve como máximo n elementos.
// Se usa para mostrar destacados aleatorios sin descargar todo el catálogo.
function pickRandom(arr, n) {
  const a = Array.isArray(arr) ? [...arr] : [];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// Imagen para las tarjetas de la portada: usa la MINIATURA (más ligera) si el
// producto tiene variantes; si no (productos antiguos), cae a la imagen normal.
function thumbDe(p) {
  const v = p?.media?.cover?.variants || {};
  const u = p?.media?.cover?.urls || {};
  if (v.thumb || u.thumb || v.card || u.card) {
    return pickCoverUrl(p, { prefer: "thumb" });
  }
  return imagenDe(p);
}

function normalizeProduct(p, lang) {
  return {
    ...p,
    id:
      p.id ??
      p._id ??
      p.slug ??
      `${p.title ?? p.Titulo ?? "producto"}-${p.price ?? p.precio ?? "0"}`,
    title:
      lang === "en"
        ? p.title_en ?? p.titleEn ?? p.title ?? p.Titulo ?? "Producto"
        : lang === "fr"
          ? p.title_fr ?? p.titleFr ?? p.title ?? p.Titulo ?? "Produit"
          : p.title_es ?? p.title ?? p.Titulo ?? "Producto",
    shipping:
      lang === "en"
        ? p.shipping_en ?? p.shippingEn ?? p.shipping ?? "Alta calidad"
        : lang === "fr"
          ? p.shipping_fr ?? p.shippingFr ?? p.shipping ?? "Haute qualité"
          : p.shipping_es ?? p.shipping ?? "Alta calidad",
    image: thumbDe(p),
    price: p.price ?? p.precio ?? p.Precio ?? p.priceValue ?? 0,
    country: p.country ?? p.Pais ?? "",
  };
}

function formatXaf(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "Consultar";
  return `${new Intl.NumberFormat("es-ES").format(Math.round(n))} FCFA`;
}



function TopFeedHeader({ onSearch }) {
  return (
    <Box sx={{ pt: 1.5, pb: 1.5 }}>
     

      <Stack direction="row" spacing={1.2} alignItems="center">
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            height: 48,
            px: 1.6,
            borderRadius: "16px",
            display: "flex",
            alignItems: "center",
            gap: 1,
            bgcolor: "#F4F4FA",
            border: "1px solid #EEEFF7",
          }}
        >
          <LocationOnOutlinedIcon sx={{ fontSize: 21, color: "#15172E" }} />
          <Typography
            noWrap
            sx={{
              flex: 1,
              fontWeight: 650,
              color: "#11152C",
              fontSize: 14.5,
            }}
          >
            Malabo, Guinea Ecuatorial
          </Typography>
          <KeyboardArrowDownRoundedIcon sx={{ color: "#5F6273" }} />
        </Paper>
{/* 
        <IconButton
          aria-label="Buscar"
          onClick={onSearch}
          sx={{
            width: 48,
            height: 48,
            borderRadius: "16px",
            bgcolor: "#FFFFFF",
            border: "1px solid #EEEFF7",
            boxShadow: "0 10px 26px rgba(17, 21, 44, .07)",
            "&:hover": { bgcolor: "#FFFFFF" },
          }}
        >
          <SearchRoundedIcon sx={{ color: "#11152C" }} />
        </IconButton> */}
      </Stack>
    </Box>
  );
}

function HeroBanner({ onExplore }) {
  return (
    <Paper
      elevation={0}
      sx={{
        position: "relative",
        overflow: "hidden",
        minHeight: { xs: 202, sm: 218 },
        borderRadius: "22px",
        px: { xs: 2.2, sm: 2.8 },
        py: { xs: 2.4, sm: 2.8 },
        color: "#FFFFFF",
        background:
          "radial-gradient(circle at 92% 16%, rgba(255,255,255,.22) 0 0, transparent 26%), linear-gradient(135deg, #221D94 0%, #2722AF 48%, #1A176B 100%)",
        boxShadow: "0 16px 38px rgba(36, 31, 160, .24)",
      }}
    >
      <Box sx={{ position: "relative", zIndex: 2, width: "64%" }}>
        <Typography
          sx={{
            fontWeight: 950,
            letterSpacing: "-0.04em",
            lineHeight: 1.04,
            fontSize: { xs: 26, sm: 31 },
            mb: 1.2,
          }}
        >
          Todo lo que necesitas de China, más cerca de ti 🚀
        </Typography>

        <Typography
          sx={{
            fontSize: { xs: 14.5, sm: 15.5 },
            lineHeight: 1.35,
            color: "rgba(255,255,255,.86)",
            mb: 2,
          }}
        >
          Compras, encargos y envíos de manera fácil y segura.
        </Typography>

        <Button
          variant="contained"
          onClick={onExplore}
          sx={{
            bgcolor: "#FF8A16",
            color: "#FFFFFF",
            borderRadius: "14px",
            px: 2.6,
            py: 1.05,
            fontWeight: 900,
            textTransform: "none",
            boxShadow: "0 10px 20px rgba(255, 138, 22, .34)",
            "&:hover": { bgcolor: "#EA7A0D" },
          }}
        >
          Explorar productos
        </Button>
      </Box>

      <FlightTakeoffRoundedIcon
        sx={{
          position: "absolute",
          zIndex: 1,
          right: { xs: 20, sm: 34 },
          top: { xs: 35, sm: 28 },
          fontSize: { xs: 92, sm: 110 },
          color: "rgba(255,255,255,.93)",
          transform: "rotate(-12deg)",
          filter: "drop-shadow(0 18px 18px rgba(0,0,0,.18))",
        }}
      />

      <Paper
        elevation={0}
        sx={{
          position: "absolute",
          zIndex: 2,
          right: { xs: 66, sm: 92 },
          bottom: 18,
          width: 44,
          height: 68,
          borderRadius: "12px",
          bgcolor: "#FFFFFF",
          boxShadow: "0 12px 28px rgba(0,0,0,.20)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <LogoMark />
      </Paper>

      <Box
        sx={{
          position: "absolute",
          right: { xs: 12, sm: 22 },
          bottom: 14,
          zIndex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(2, 34px)",
          gap: "7px",
          transform: "rotate(-1deg)",
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <Box
            key={i}
            sx={{
              width: 36,
              height: 36,
              borderRadius: "8px",
              background: i % 2 ? "#C49C6A" : "#D9B47C",
              border: "1px solid rgba(255,255,255,.24)",
              boxShadow: "0 8px 16px rgba(0,0,0,.12)",
            }}
          />
        ))}
      </Box>

      <Box
        sx={{
          position: "absolute",
          right: { xs: 6, sm: 16 },
          top: 0,
          bottom: 0,
          width: 120,
          background:
            "linear-gradient(90deg, rgba(36,31,160,0) 0%, rgba(36,31,160,.35) 100%)",
        }}
      />
    </Paper>
  );
}

function QuickActionCard({ action, onClick }) {
  const Icon = action.icon;
  return (
    <CardActionArea
      onClick={onClick}
      sx={{
        borderRadius: "18px",
        height: "100%",
        overflow: "hidden",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          height: "100%",
          minHeight: 132,
          borderRadius: "18px",
          px: 1.2,
          py: 1.55,
          textAlign: "center",
          bgcolor: action.bg,
          border: "1px solid rgba(17,21,44,.04)",
        }}
      >
        <Avatar
          sx={{
            width: 46,
            height: 46,
            mx: "auto",
            mb: 1,
            bgcolor: action.iconBg,
            color: action.color,
          }}
        >
          <Icon />
        </Avatar>

        <Typography
          sx={{
            whiteSpace: "pre-line",
            color: action.color,
            fontWeight: 950,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            fontSize: { xs: 16, sm: 17 },
          }}
        >
          {action.title}
        </Typography>

        <Typography
          sx={{
            mt: 0.7,
            color: alpha(action.color, 0.72),
            fontWeight: 650,
            fontSize: 12.5,
            lineHeight: 1.2,
          }}
        >
          {action.subtitle}
        </Typography>
      </Paper>
    </CardActionArea>
  );
}



function LogisticsBanner({ onNavigate }) {
  const cards = [
     {
      title: "Registrar Mercancía",
      desc: "Servicio reservado solo para vendedores",
      Icon: Inventory2RoundedIcon,
      route: "/lote",
      grad: "linear-gradient(135deg,#16845A 0%,#6c9078ff 100%)",
    },
    {
      title: "Enviar un paquete",
      desc: "Malabo · Bata · a domicilio o recogida",
      Icon: LocalShippingRoundedIcon,
      route: "/enviar",
      grad: "linear-gradient(135deg,#2455C7 0%,#3A6BE0 100%)",
    },
    {
      title: "Mudanza y transporte",
      desc: "Coche pequeño o camión grande",
      Icon: DirectionsCarRoundedIcon,
      route: "/mudanza",
      grad: "linear-gradient(135deg,#C36B14 0%,#F28A14 100%)",
    },
    {
      title: "Envíos China → Guinea",
      desc: "Precio por kg · Malabo y Bata",
      Icon: FlightTakeoffRoundedIcon,
      route: "/envio-china",
      grad: "linear-gradient(135deg,#7A1FA2 0%,#B24BD8 100%)",
    },
  ];
  return (
    <Box sx={{ mt: 3 }}>
      <Typography
        sx={{ color: "#11152C", fontWeight: 950, letterSpacing: "-0.035em", fontSize: { xs: 19, sm: 21 }, mb: 1.4 }}
      >
        Chekea Logistics
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.3 }}>
        {cards.map(({ title, desc, Icon, route, grad }) => (
          <Box
            key={route}
            onClick={() => onNavigate(route)}
            role="button"
            sx={{
              cursor: "pointer",
              borderRadius: "18px",
              p: 1.8,
              minHeight: 132,
              color: "#fff",
              background: grad,
              boxShadow: "0 12px 26px rgba(17,21,44,.12)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2,
                bgcolor: "rgba(255,255,255,.22)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Icon />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: 15.5, lineHeight: 1.15 }}>{title}</Typography>
              <Typography sx={{ fontSize: 12.2, color: "rgba(255,255,255,.9)", mt: 0.4 }}>{desc}</Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function SectionTitle({ title, action = "Ver todas", onAction, onShuffle }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 3, mb: 1.4 }}>
      <Typography
        sx={{
          color: "#11152C",
          fontWeight: 950,
          letterSpacing: "-0.035em",
          fontSize: { xs: 19, sm: 21 },
        }}
      >
        {title}
      </Typography>

      <Stack direction="row" alignItems="center" spacing={0.5}>
        {onShuffle ? (
          <IconButton
            onClick={onShuffle}
            aria-label="Barajar"
            size="small"
            sx={{ color: "#2845CC" }}
          >
            <RefreshRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        ) : null}

        {action ? (
          <Button
            onClick={onAction}
            endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{
              minWidth: "auto",
              px: 0.5,
              color: "#2845CC",
              fontWeight: 850,
              textTransform: "none",
              fontSize: 14,
            }}
          >
            {action}
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
}


function ProductImage({ src, alt }) {
  if (!src) {
    return (
      <Box
        sx={{
          height: 112,
          display: "grid",
          placeItems: "center",
          bgcolor: "#F5F6FA",
          borderRadius: "14px",
        }}
      >
        <Inventory2RoundedIcon sx={{ fontSize: 44, color: "#C8CCD8" }} />
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      loading="lazy"
      sx={{
        width: "100%",
        height: 112,
        objectFit: "contain",
        display: "block",
        bgcolor: "#F5F6FA",
        borderRadius: "14px",
      }}
    />
  );
}

function ProductCard({ product, onOpen }) {
  return (
    <Card
      elevation={0}
      sx={{
        position: "relative",
        borderRadius: "16px",
        bgcolor: "#FFFFFF",
        border: "1px solid #EEF0F6",
        boxShadow: "0 10px 26px rgba(17, 21, 44, .05)",
        overflow: "hidden",
      }}
    >
      <CardActionArea onClick={onOpen} sx={{ p: 0.8, pb: 1.1 }}>
       

        <ProductImage src={product.image} alt={product.title} />

        <CardContent sx={{ p: 0.4, pt: 1, "&:last-child": { pb: 0 } }}>
          <Typography
            noWrap
            sx={{
              color: "#11152C",
              fontWeight: 900,
              letterSpacing: "-0.02em",
              fontSize: 14.2,
              lineHeight: 1.2,
            }}
          >
            {product.title}
          </Typography>
          <Typography
            noWrap
            sx={{
              color: "#686B78",
              fontWeight: 600,
              fontSize: 12.2,
              mt: 0.2,
            }}
          >
            {product.shipping}
          </Typography>
          <Typography
            noWrap
            sx={{
              color: "#F28A14",
              fontWeight: 950,
              fontSize: 14.5,
              mt: 0.7,
              letterSpacing: "-0.02em",
            }}
          >
            {formatXaf(product.price)}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function ProductsPreview({ title, items, loading, onViewAll, onOpenProduct, onShuffle }) {
  const visibleItems = items.slice(0, 6);

  return (
    <Box>
      <SectionTitle title={title} onAction={onViewAll} onShuffle={onShuffle} />

      {loading ? (
        <Box sx={{ minHeight: 210, display: "grid", placeItems: "center" }}>
          <Stack spacing={1.2} alignItems="center">
            <CircularProgress size={26} />
            <Typography sx={{ color: "#676B7D", fontWeight: 650, fontSize: 13 }}>
              Cargando productos...
            </Typography>
          </Stack>
        </Box>
      ) : visibleItems.length ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 1.1,
          }}
        >
          {visibleItems.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onOpen={() => onOpenProduct(product)}
            />
          ))}
        </Box>
      ) : (
        <Paper
          elevation={0}
          sx={{
            borderRadius: "18px",
            border: "1px solid #EEF0F6",
            bgcolor: "#FFFFFF",
            p: 2.2,
            textAlign: "center",
          }}
        >
          <Inventory2RoundedIcon sx={{ fontSize: 36, color: "#C7CBD8", mb: 1 }} />
          <Typography sx={{ fontWeight: 900, color: "#11152C" }}>Sin productos todavía</Typography>
          <Typography sx={{ color: "#696D7D", fontSize: 13, mt: 0.4 }}>
            Cuando haya productos disponibles aparecerán aquí.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}



export default function HomePage() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const { user } = useEffectiveAuth();
  const userId = user?.uid ?? null;

  // Claves de caché (los "recientes" pueden depender del usuario).
  const recientesKey = `home:recientes:${userId ?? "anon"}`;
  const gqKey = "home:gq";

  // Estado inicial DESDE disco (hasta 24 h): al reabrir la app, los productos
  // aparecen al instante sin esperar a la red. Luego se refrescan por detrás.
  const [newItems, setNewItems] = useState(() => readCache(recientesKey, DAY_MS) || []);
  const [localGQItems, setLocalGQItems] = useState(() => readCache(gqKey, DAY_MS) || []);
  const [loadingAll, setLoadingAll] = useState(() => (readCache(recientesKey, DAY_MS) ? false : true));
  const [loadingLocalGQ, setLoadingLocalGQ] = useState(() => (readCache(gqKey, DAY_MS) ? false : true));
  const [error, setError] = useState("");
  // Cambia en cada apertura de la portada -> muestra destacados distintos.
  // Tócalo con setShuffleKey(Date.now()) si quieres un botón "barajar".
  const [shuffleKey, setShuffleKey] = useState(() => Date.now());

  const go = useCallback(
    (route) => {
      if (typeof route === "string" && route.startsWith("wa:")) {
        openChekeaWhatsApp(route.slice(3) || undefined);
        return;
      }
      nav(route);
    },
    [nav]
  );

  const loadAllSections = useCallback(
    async ({ force = false } = {}) => {
      // 1) Muestra al instante lo guardado (aunque sea de hace horas).
      const cached = readCache(recientesKey, DAY_MS);
      if (cached) {
        setNewItems(cached);
        setLoadingAll(false);
      }
      // 2) Si es reciente (< 5 min) y no forzamos, no gastamos red.
      if (!force && readCache(recientesKey, FRESH_MS)) return;
      // 3) Refresca por detrás (spinner solo si no había nada que mostrar).
      if (!cached) setLoadingAll(true);
      setError("");
      try {
        const { getHomeSectionsFS } = await import("../services/product.firesore.service");
        // Traemos un grupo más amplio (no todo) para poder mostrar una muestra al azar.
        const res = await getHomeSectionsFS({ size: 18, userId });
        const data = Array.isArray(res?.recientes) ? res.recientes : [];
        setNewItems(data);
        writeCache(recientesKey, data);
      } catch (e) {
        console.error(e);
        if (!cached) setError(t("loadError") || "No se pudieron cargar los productos.");
      } finally {
        setLoadingAll(false);
      }
    },
    [t, userId, recientesKey]
  );

  const loadLocalGQSection = useCallback(
    async ({ force = false } = {}) => {
      const cached = readCache(gqKey, DAY_MS);
      if (cached) {
        setLocalGQItems(cached);
        setLoadingLocalGQ(false);
      }
      if (!force && readCache(gqKey, FRESH_MS)) return;
      if (!cached) setLoadingLocalGQ(true);
      try {
        const { getProductsByCountry } = await import("../services/product.firesore.service");
        const res = await getProductsByCountry({
          country: "Guinea Ecuatorial",
          pageSize: 18,
        });
        const data = Array.isArray(res?.items) ? res.items : [];
        setLocalGQItems(data);
        writeCache(gqKey, data);
      } catch (e) {
        console.error(e);
        if (!cached) setLocalGQItems([]);
      } finally {
        setLoadingLocalGQ(false);
      }
    },
    [gqKey]
  );

  useEffect(() => {
    // Portada: SOLO productos de Guinea Ecuatorial.
    loadLocalGQSection();
  }, [loadLocalGQSection]);

  const mappedNewItems = useMemo(
    () => (newItems ?? []).map((p) => normalizeProduct(p, i18n.language)),
    [newItems, i18n.language]
  );

  const mappedLocalGQItems = useMemo(
    () => (localGQItems ?? []).map((p) => normalizeProduct(p, i18n.language)),
    [localGQItems, i18n.language]
  );

  // SOLO productos de Guinea Ecuatorial (no caemos nunca a otros países).
  const featuredPool = mappedLocalGQItems;
  // Muestra ALEATORIA de 6. Se recalcula al abrir la portada (shuffleKey) o al
  // llegar nuevos datos, pero NO en cada re-render (así no "salta" sola).
  const featuredItems = useMemo(
    () => pickRandom(featuredPool, 6),
    [featuredPool, shuffleKey]
  );
  const featuredLoading = loadingLocalGQ;

  const openProduct = useCallback((product) => {
    // Chekea: al tocar un producto se abre WhatsApp directamente.
    openProductWhatsApp(product);
  }, []);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#F7F8FC",
        background:
          "linear-gradient(180deg, #FBFBFF 0%, #F7F8FC 42%, #FFFFFF 100%)",
      }}
    >
      <Container
        maxWidth="sm"
        sx={{
          px: { xs: 1.6, sm: 2.2 },
          pb: 4,
        }}
      >
        <TopFeedHeader onSearch={() => go("/search")} />

        {error ? (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 3 }}>
            {error}
          </Alert>
        ) : null}



        <LogisticsBanner onNavigate={go} />

        <ProductsPreview
          title="Productos destacados"
          items={featuredItems}
          loading={featuredLoading}
          onViewAll={() => go("/cate")}
          onOpenProduct={openProduct}
          onShuffle={() => setShuffleKey(Date.now())}
        />

       

      </Container>
    </Box>
  );
}