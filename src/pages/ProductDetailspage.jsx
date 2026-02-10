// src/pages/ProductDetailsPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Stack,
  Chip,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  MenuItem,
  Backdrop,
  CircularProgress,
} from "@mui/material";

import StarIcon from "@mui/icons-material/Star";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ShareIcon from "@mui/icons-material/Share";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import ReplayIcon from "@mui/icons-material/Replay";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";

import { useTranslation } from "react-i18next";

import Header from "../components/header";
import ProductGrid from "../components/productgrid";

import {
  getProductByIdFS,
  getRelatedProductsFS,
  getProductColorsFS,
  getProductStylesFS,
  getProductImagesFS,
  updateViewCountFS,
  getFavoriteRefFromProductFS,
  removeFromFavoritesFS,
  addToFavoritesFS,
  addInteraccionFS,
} from "../services/product.firesore.service";

import { useCart } from "../state/CartContext";
import { puntodecimal } from "../utils/Helpers";
import { useAuth } from "../state/AuthContext";

/* -------------------- helpers -------------------- */
const LS_RECENTS = "chekea_recently_viewed_v1";
const LS_SHIP_CITY = "chekea_ship_city_v1";
const LS_SHIP_METHOD = "chekea_ship_method_v1";
const SS_VIEW_PREFIX = "chekea_viewed_once_v1:";

/** ✅ NUEVO: hasPurchased por usuario (guardado desde CheckoutPage) */
const HAS_PURCHASED_SESSION_KEY = "hasPurchasedByUser";
function readHasPurchasedForUser(uid) {
  if (!uid) return null;
  try {
    const raw = sessionStorage.getItem(HAS_PURCHASED_SESSION_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return Object.prototype.hasOwnProperty.call(map, uid) ? Boolean(map[uid]) : null;
  } catch {
    return null;
  }
}

/* -------------------- SIMPLE CACHE (Memory + sessionStorage) -------------------- */
const CACHE_PREFIX = "chekea_cache_v1:";
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 min
const MEM_CACHE = new Map(); // key -> { value, expiresAt }

function now() {
  return Date.now();
}
function isFresh(entry) {
  return entry && entry.expiresAt > now();
}
function cacheGet(key) {
  const m = MEM_CACHE.get(key);
  if (isFresh(m)) return { value: m.value, from: "memory" };

  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (isFresh(parsed)) {
      MEM_CACHE.set(key, parsed);
      return { value: parsed.value, from: "session" };
    }
  } catch {}
  return null;
}
function cacheSet(key, value, ttlMs = CACHE_TTL_MS) {
  const entry = { value, expiresAt: now() + ttlMs };
  MEM_CACHE.set(key, entry);
  try {
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {}
}

/* -------------------- shipping local state -------------------- */
function loadShipCity() {
  return sessionStorage.getItem(LS_SHIP_CITY) || "Malabo";
}
function saveShipCity(city) {
  sessionStorage.setItem(LS_SHIP_CITY, city);
}
function loadShipMethod() {
  return sessionStorage.getItem(LS_SHIP_METHOD) || "AIR";
}
function saveShipMethod(method) {
  sessionStorage.setItem(LS_SHIP_METHOD, method);
}

function addRecentlyViewed(productId) {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_RECENTS) || "[]");
    const next = [productId, ...arr.filter((x) => x !== productId)].slice(0, 20);
    localStorage.setItem(LS_RECENTS, JSON.stringify(next));
  } catch {}
}

function shippingDuration(city, method) {
  if (method === "SEA") return { type: "MONTHS", months: 3 };
  const days = city === "Bata" ? 25 : 19;
  return { type: "DAYS", days };
}
function formatDuration(d) {
  if (!d) return "";
  if (d.type === "MONTHS") return `${d.months} meses`;
  return `${d.days} días`;
}

// tolerancia a nombres de campos
function pickImgUrl(imgDoc) {
  return (
    imgDoc?.Image ??
    imgDoc?.URL ??
    imgDoc?.Imagen ??
    imgDoc?.image ??
    imgDoc?.url ??
    null
  );
}

// precio con tolerancia
function getStylePrice(style) {
  if (!style) return 0;
  const v = style.precio ?? style.Precio ?? style.price ?? style.Price ?? 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* -------------------- envío estimado -------------------- */
const AIR_PRICE_PER_KG = 9000;
const AIR_PRICE_PER_KG_BATA = 16000;

const PESOS = [
  { nombre: "Ultraligero", min: 0.1, max: 0.5 },
  { nombre: "Ligero", min: 0.51, max: 1.1 },
  { nombre: "Medio", min: 1.2, max: 2.0 },
  { nombre: "Pesado", min: 2.01, max: 3.5 },
  { nombre: "Muy pesado", min: 3.51, max: 4.5 },
  { nombre: "Extremadamente pesado", min: 4.51, max: 6.0 },
  { nombre: "Solo Barco", min: 7, max: 7 },
];

const SEA_PRICE_PER_CBM = 170000;
const DIMENSIONES = [
  { nombre: "Paquete pequeño", min: 0.023, max: 0.03 },
  { nombre: "Tamaño personal", min: 0.031, max: 0.15 },
  { nombre: "Paquete mediano", min: 0.151, max: 0.4 },
  { nombre: "Paquete grande", min: 0.401, max: 0.8 },
  { nombre: "Caja estándar", min: 0.801, max: 1.2 },
  { nombre: "Caja extra grande", min: 1.201, max: 1.8 },
  { nombre: "Carga pesada", min: 1.801, max: 2.2 },
  { nombre: "Carga industrial", min: 2.201, max: 3.0 },
  { nombre: "Cama y sofa", min: 3.101, max: 7.0 },
];

function normKey(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function estimateShippingFromProduct(city, { method, pesoTipo, dimensionTipo, qty }) {
  const q = Math.max(1, Number(qty || 1));

  if (method === "AIR") {
    const key = normKey(pesoTipo);
    const found = PESOS.find((x) => normKey(x.nombre) === key);
    if (!found) return null;

    const mid = (found.min + found.max) / 2;

    const estimated =
      city === "Malabo"
        ? Math.round(mid * AIR_PRICE_PER_KG * q)
        : Math.round(mid * AIR_PRICE_PER_KG_BATA * q);

    return {
      mode: "AIR",
      label: found.nombre,
      unit: "kg",
      minValue: found.min,
      maxValue: found.max,
      midValue: mid,
      estimated,
    };
  }

  const key = normKey(dimensionTipo);
  const found = DIMENSIONES.find((x) => normKey(x.nombre) === key);
  if (!found) return null;

  const mid = (found.min + found.max) / 2;
  const estimated = Math.round(mid * SEA_PRICE_PER_CBM * q);

  return {
    mode: "SEA",
    label: found.nombre,
    unit: "cbm",
    minValue: found.min,
    maxValue: found.max,
    midValue: mid,
    estimated,
  };
}

/* -------------------- YouTube -------------------- */
function YouTubeEmbed({ videoId, title = "Chekea Videos" }) {
  if (!videoId) return null;

  return (
    <Paper variant="outlined" sx={{ mt: 2, p: 1.5, borderRadius: 2 }}>
      <Typography sx={{ fontWeight: 900, mb: 1 }}>Video</Typography>

      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "black",
        }}
      >
        <Box
          component="iframe"
          src={`https://www.youtube.com/embed/${encodeURIComponent(
            videoId
          )}?rel=0&modestbranding=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0,
          }}
        />
      </Box>
    </Paper>
  );
}

/* -------------------- Center Loader -------------------- */
function CenterLoader({ text = "Cargando…" }) {
  return (
    <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
      <Stack spacing={2} alignItems="center">
        <CircularProgress />
        <Typography sx={{ fontWeight: 900 }}>{text}</Typography>
      </Stack>
    </Box>
  );
}

/* -------------------- Promo SMS -------------------- */
function StickyPromoSMS({
  message = "🎉 10% de descuento en tu primera compra",
  sub = "Usa el código: PRIMERA10",
  onCopy,
}) {
  return (
    <Box
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (t) => t.zIndex.drawer + 1000,
        px: 1,
        pb: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
        pt: 1,
        pointerEvents: "none",
      }}
    >
      <Paper
        elevation={10}
        sx={{
          mx: "auto",
          maxWidth: 980,
          borderRadius: 999,
          px: { xs: 1.25, sm: 2 },
          py: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          pointerEvents: "auto",
          backdropFilter: "blur(8px)",
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 999,
              display: "grid",
              placeItems: "center",
              bgcolor: "primary.main",
              color: "primary.contrastText",
              flex: "0 0 auto",
            }}
          >
            <LocalOfferIcon fontSize="small" />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontWeight: 900,
                lineHeight: 1.1,
                fontSize: { xs: 13, sm: 14 },
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={message}
            >
              {message}
            </Typography>
            <Typography
              sx={{
                color: "text.secondary",
                fontSize: { xs: 12, sm: 13 },
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={sub}
            >
              {sub}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}

/* -------------------- ✅ Bottom Action Bar (móvil fixed, blanco, arriba de todo) -------------------- */
function BottomActionBar({
  cartSaving,
  disableColorRequired,
  comprarahora,
  addToCart,
  wishOn,
  toggleFavoriteFS,
  favBusy,
  onShare,
}) {
  return (
    <Box
      sx={{
        position: { xs: "fixed", sm: "static" },
        left: { xs: 0, sm: "auto" },
        right: { xs: 0, sm: "auto" },
        bottom: { xs: 0, sm: "auto" },

        // ✅ fondo blanco sólido en móvil
        bgcolor: { xs: "#fff", sm: "transparent" },
        opacity: 1,
        backdropFilter: "none",

        // ✅ por encima de TODO
        zIndex: { xs: 20000, sm: "auto" },

        // ✅ separación visual
        borderTop: { xs: "1px solid", sm: "none" },
        borderColor: { xs: "divider", sm: "transparent" },
        boxShadow: { xs: "0 -10px 25px rgba(0,0,0,0.12)", sm: "none" },

        // ✅ padding + safe area
        px: { xs: 1, sm: 0 },
        py: { xs: 1, sm: 0 },
        pb: { xs: "calc(env(safe-area-inset-bottom, 0px) + 10px)", sm: 0 },
      }}
    >
      <Box sx={{ maxWidth: 980, mx: "auto" }}>
        <Stack
          direction={{ xs: "row", sm: "row" }}
          spacing={1}
          sx={{
            mt: { xs: 0, sm: 2 },
            alignItems: "center",
            "& .cta": { flex: { xs: 1, sm: "unset" } },
            "& .iconBtn": { minWidth: 44, px: 1 },
          }}
        >
          <Button
            className="cta"
            variant="contained"
            onClick={comprarahora}
            disabled={cartSaving || disableColorRequired}
            sx={{ height: { xs: 44, sm: "auto" } }}
          >
            Comprar
          </Button>

          <Button
            className="cta"
            variant="outlined"
            onClick={addToCart}
            disabled={cartSaving || disableColorRequired}
            sx={{ height: { xs: 44, sm: "auto" } }}
          >
            {cartSaving ? "Guardando..." : "Añadir al carrito"}
          </Button>

          <Button
            className="iconBtn"
            variant="text"
            startIcon={
              wishOn ? (
                <FavoriteIcon sx={{ color: "error.main" }} />
              ) : (
                <FavoriteBorderIcon sx={{ color: "text.secondary" }} />
              )
            }
            onClick={toggleFavoriteFS}
            disabled={favBusy || cartSaving}
            sx={{
              color: wishOn ? "error.main" : "text.secondary",
              fontWeight: 700,
            }}
          />

          <Button
            className="iconBtn"
            variant="text"
            startIcon={<ShareIcon />}
            onClick={onShare}
            disabled={cartSaving}
          >
            <Box sx={{ display: { xs: "none", sm: "inline" } }}>Compartir</Box>
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}

export default function ProductDetailsPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { i18n } = useTranslation();

  const cart = useCart();
  const auth = useAuth();
  const userId = auth?.user ? auth.user.uid : null;

  /** ✅ NUEVO: controla banner promo */
  const [hasPurchased, setHasPurchased] = useState(null);

  useEffect(() => {
    setHasPurchased(readHasPurchasedForUser(userId));
  }, [userId]);

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [colors, setColors] = useState([]);
  const [styles, setStyles] = useState([]);
  const [images, setImages] = useState([]);

  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [activeImage, setActiveImage] = useState(null);

  const [shipCity, setShipCity] = useState(loadShipCity());
  const [shipMethod, setShipMethod] = useState(loadShipMethod());
  const [qty, setQty] = useState(1);

  const [wishOn, setWishOn] = useState(false);
  const [favoritoId, setFavoritoId] = useState("");
  const [favBusy, setFavBusy] = useState(false);

  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [cartSaving, setCartSaving] = useState(false);

  // ✅ leer más / leer menos (detalles)
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  useEffect(() => saveShipCity(shipCity), [shipCity]);
  useEffect(() => saveShipMethod(shipMethod), [shipMethod]);

  const productKey = useMemo(() => {
    if (!product) return id ?? null;
    return product.Codigo ?? product.id ?? id ?? null;
  }, [product, id]);

  /* -------------------- load product (CACHE + SWR) -------------------- */
  useEffect(() => {
    let alive = true;

    const resetUI = () => {
      setProduct(null);
      setColors([]);
      setStyles([]);
      setImages([]);
      setRelated([]);
      setSelectedColor(null);
      setSelectedStyle(null);
      setActiveImage(null);
      setDetailsExpanded(false);
    };

    const hydrate = ({ p, c, s, imgs, rel }, isCached) => {
      setFromCache(Boolean(isCached));
      setLoading(false);
      setErr("");

      setProduct(p);
      setColors(c ?? []);
      setStyles(s ?? []);
      setImages(imgs ?? []);
      setRelated(rel ?? []);

      setSelectedColor((c ?? [])[0] ?? null);
      setSelectedStyle((s ?? [])[0] ?? null);

      const primary = pickImgUrl(imgs?.[0]) ?? p?.Imagen ?? p?.image ?? null;
      setActiveImage(primary);

      setDetailsExpanded(false);
    };

    (async () => {
      setErr("");

      const cacheKey = `${CACHE_PREFIX}product_bundle:${id}`;
      const cached = cacheGet(cacheKey);

      if (cached?.value) {
        hydrate(cached.value, true);

        try {
          const p2 = await getProductByIdFS(id);
          if (!alive || !p2) return;

          const [c2, s2, imgs2] = await Promise.all([
            getProductColorsFS(p2.id),
            getProductStylesFS(p2.id),
            getProductImagesFS(p2.id),
          ]);
          if (!alive) return;

          let rel2 = [];
          if (p2.Categoria) {
            rel2 = await getRelatedProductsFS({
              category: p2.Subcategoria,
              excludeId: p2.Codigo ?? p2.id,
              pageSize: 4,
            });
          }
          if (!alive) return;

          const bundle2 = { p: p2, c: c2, s: s2, imgs: imgs2, rel: rel2 };
          cacheSet(cacheKey, bundle2);
          hydrate(bundle2, true);
        } catch {}

        return;
      }

      setLoading(true);
      setFromCache(false);
      resetUI();

      try {
        const p = await getProductByIdFS(id);
        if (!alive) return;

        if (!p) {
          setErr("Producto no encontrado");
          setLoading(false);
          return;
        }

        addRecentlyViewed(p.Codigo ?? p.id ?? id);

        const [c, s, imgs] = await Promise.all([
          getProductColorsFS(p.id),
          getProductStylesFS(p.id),
          getProductImagesFS(p.id),
        ]);
        if (!alive) return;

        let rel = [];
        if (p.Categoria) {
          rel = await getRelatedProductsFS({
            category: p.Subcategoria,
            excludeId: p.Codigo ?? p.id,
            pageSize: 4,
          });
        }
        if (!alive) return;

        const bundle = { p, c: c ?? [], s: s ?? [], imgs: imgs ?? [], rel: rel ?? [] };
        cacheSet(cacheKey, bundle);
        hydrate(bundle, false);
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setErr("Error cargando el producto");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  /* -------------------- view count (1 por sesión) -------------------- */
  useEffect(() => {
    if (!productKey) return;

    (async () => {
      const viewKey = `${SS_VIEW_PREFIX}${productKey}`;
      if (sessionStorage.getItem(viewKey)) return;

      sessionStorage.setItem(viewKey, "1");
      try {
        await updateViewCountFS(productKey);
      } catch (e) {
        console.error("updateViewCountFS failed:", e);
      }
    })();
  }, [productKey]);

  /* -------------------- leer favorito existente -------------------- */
  useEffect(() => {
    if (!productKey) return;

    if (!userId) {
      setWishOn(false);
      setFavoritoId("");
      return;
    }

    let alive = true;

    (async () => {
      try {
        const fav = await getFavoriteRefFromProductFS({ userId, productId: productKey });
        if (!alive) return;

        if (fav?.id) {
          setWishOn(true);
          setFavoritoId(fav.id);
        } else {
          setWishOn(false);
          setFavoritoId("");
        }
      } catch (e) {
        console.error("getFavoriteRefFromProductFS failed:", e);
      }
    })();

    return () => {
      alive = false;
    };
  }, [productKey, userId]);

  /* -------------------- mapped for UI -------------------- */
  const mapped = useMemo(() => {
    if (!product) return null;

    const rawTitle = product.Titulo ?? product.title ?? "";
    const rawDetails = product.Detalles ?? product.description ?? "";
    const vendedor = product.Vendedor;

    const discount = Number(product.Descuento ?? product.discount ?? 0);
    const productPrice = Number(product.Precio ?? product.price ?? 0);

    const stylePrice = getStylePrice(selectedStyle);
    const basePrice = stylePrice > 0 ? stylePrice : productPrice;

    const lang = i18n.language;
    const title =
      lang === "en"
        ? product.title_en ?? rawTitle
        : lang === "fr"
        ? product.title_fr ?? rawTitle
        : rawTitle;

    const finalPrice =
      discount > 0 ? Number((basePrice * (1 - discount / 100)).toFixed(2)) : basePrice;

    const duration = shippingDuration(shipCity, shipMethod);

    const pesoTipo = product.Peso ?? product.peso ?? "";
    const dimensionTipo = product.Dimension ?? product.dimension ?? "";

    const ship = estimateShippingFromProduct(shipCity, {
      method: shipMethod,
      pesoTipo,
      dimensionTipo,
      qty,
    });

    const shipEstimate = ship?.estimated ?? null;

    const imgreal = Boolean(product.Imgreal ?? product.imgreal ?? false);
    const imagenesrealesRaw =
      product.ireal ??
      product.Ireal ??
      product.imagenesreales ??
      product.imagenesReales ??
      product.imagenes_real ??
      product.ImagenesReales ??
      [];

    const imagenesreales = Array.isArray(imagenesrealesRaw)
      ? imagenesrealesRaw.filter(Boolean)
      : [];

    return {
      ...product,
      _title: title,
      _details: rawDetails,
      _rawPrice: basePrice,
      _finalPrice: finalPrice,

      shipDuration: duration,
      shipDurationText: formatDuration(duration),
      vendedor,

      shipEstimate,
      shipRangeText:
        ship?.minValue != null
          ? ship.mode === "AIR"
            ? `${ship.minValue}–${ship.maxValue} kg`
            : `${ship.minValue}–${ship.maxValue} cbm`
          : "",

      rating: product.Rating ?? product.rating ?? "4.0",
      _productKey: productKey,

      imgreal,
      imagenesreales: imgreal ? imagenesreales : [],

      youtubeId: product?.vid ?? null,
    };
  }, [product, i18n.language, shipCity, shipMethod, qty, productKey, selectedStyle]);

  const mappedRelated = useMemo(() => {
    const lang = i18n.language;
    return (related ?? []).map((p) => ({
      ...p,
      id: p.id ?? p.Codigo ?? p.codigo ?? p._id ?? p.docId,
      title: lang === "en" ? p.title_en : lang === "fr" ? p.title_fr : p.Titulo ?? p.title,
      shipping: lang === "en" ? p.shipping_en : lang === "fr" ? p.shipping_fr : p.shipping,
    }));
  }, [related, i18n.language]);

  /* -------------------- favorites toggle (Firestore) -------------------- */
  const toggleFavoriteFS = useCallback(async () => {
    if (!mapped?._productKey) return;

    if (!auth?.isAuthed || !userId) {
      nav("/login");
      return;
    }
    if (favBusy) return;

    const productId = mapped._productKey;
    const subcategoria = mapped.Subcategoria ?? "Otros";

    const next = !wishOn;
    setWishOn(next);
    setFavBusy(true);

    try {
      if (next) {
        await addInteraccionFS({ userId, subcategoria, productId, cantidad: 2 });

        const newFavId = await addToFavoritesFS({
          userId,
          productId,
          productData: mapped,
        });

        setFavoritoId(newFavId || "");
      } else {
        let idToDelete = favoritoId;

        if (!idToDelete) {
          const fav = await getFavoriteRefFromProductFS({ userId, productId });
          idToDelete = fav?.id ?? "";
        }

        if (idToDelete) {
          await removeFromFavoritesFS({ favoritoId: idToDelete, userId, productId });
        }
        setFavoritoId("");
      }
    } catch (e) {
      console.error(e);
      setWishOn((v) => !v);
    } finally {
      setFavBusy(false);
    }
  }, [mapped, auth?.isAuthed, userId, nav, wishOn, favoritoId, favBusy]);

  /* -------------------- cart add (con loader) -------------------- */
  const addToCart = useCallback(async () => {
    if (!mapped) return;

    if (!auth?.isAuthed) {
      nav("/login");
      return;
    }

    setCartSaving(true);
    try {
      const Titulo = mapped._title ?? "Producto";
      const Vendedor = mapped.vendedor;
      const producto = mapped._productKey;

      const precioReal = Number(mapped._finalPrice ?? 0);
      const Envio = Number(mapped.shipEstimate ?? 0);
      const Precio = precioReal;
      const url = window.location.href;
      const subcategoria = mapped.Subcategoria ?? "Otros";

      const Img = activeImage ?? mapped.Imagen ?? mapped.image ?? "";

      const Detalles = [
        shipCity ? `Envío a: ${shipCity}` : null,
        mapped.shipDurationText ? `Entrega: ${mapped.shipDurationText}` : null,
        Envio ? `Envío: ${Envio}` : null,
        selectedColor
          ? `Color: ${
              selectedColor.nombre ??
              selectedColor.name ??
              selectedColor.label ??
              selectedColor.Nombre ??
              ""
            }`
          : null,
        selectedStyle
          ? `Estilo: ${
              selectedStyle.nombre ??
              selectedStyle.name ??
              selectedStyle.label ??
              selectedStyle.Nombre ??
              ""
            }`
          : null,
      ]
        .filter(Boolean)
        .join(" • ");

      await cart.add({
        Producto: producto,
        Titulo,
        Precio,
        Envio,
        Img,
        Vendedor,
        qty,
        Detalles,
        link: url,
      });
      await addInteraccionFS({ userId, subcategoria, producto, cantidad: 4 });
    } finally {
      setCartSaving(false);
    }
  }, [
    mapped,
    activeImage,
    auth?.isAuthed,
    nav,
    cart,
    qty,
    shipCity,
    selectedColor,
    selectedStyle,
    userId,
  ]);

  // comprar ahora
  const comprarahora = useCallback(() => {
    if (!mapped) return;

    if (!auth?.isAuthed) {
      nav("/login");
      return;
    }

    const Titulo = mapped._title ?? "Producto";
    const Vendedor = mapped.vendedor;
    const url = window.location.href;
    const subcategoria = mapped.Subcategoria ?? "Otros";

    const precioReal = Number(mapped._finalPrice ?? 0);
    const Envio = Number(mapped.shipEstimate ?? 0);
    const Precio = precioReal;

    const Img = activeImage ?? mapped.Imagen ?? mapped.image ?? "";

    const Detalles = [
      shipCity ? `Envío a: ${shipCity}` : null,
      mapped.shipDurationText ? `Entrega: ${mapped.shipDurationText}` : null,
      Envio ? `Envío: ${Envio}` : null,
      selectedColor
        ? `Color: ${
            selectedColor.nombre ??
            selectedColor.name ??
            selectedColor.label ??
            selectedColor.Nombre ??
            ""
          }`
        : null,
      selectedStyle
        ? `Estilo: ${
            selectedStyle.nombre ??
            selectedStyle.name ??
            selectedStyle.label ??
            selectedStyle.Nombre ??
            ""
          }`
        : null,
    ]
      .filter(Boolean)
      .join(" • ");

    const buyNowItem = {
      Producto: mapped._productKey,
      Titulo,
      Precio,
      Envio,
      Img,
      Vendedor,
      qty,
      Detalles,
      link: url,
      sub: subcategoria,
    };

    nav("/checkout", { state: { buyNowItem } });
  }, [mapped, auth?.isAuthed, nav, activeImage, qty, shipCity, selectedColor, selectedStyle]);

  const onShare = useCallback(async () => {
    if (!mapped) return;
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: mapped._title, url });
      else {
        await navigator.clipboard.writeText(url);
        alert("Link copiado");
      }
    } catch {}
  }, [mapped]);

  // lista final de miniaturas
  const thumbUrls = useMemo(() => {
    const base = (images ?? []).map(pickImgUrl).filter(Boolean);
    const real = (mapped?.imagenesreales ?? []).filter(Boolean);
    return [...base, ...real.slice(0, 2)];
  }, [images, mapped?.imagenesreales]);

  const disableColorRequired = colors.length > 0 && !selectedColor;

  // ✅ Detecta si hay “más” para mostrar el botón
  const hasMoreDetails = useMemo(() => {
    const txt = String(mapped?._details ?? "").trim();
    return txt.length > 160;
  }, [mapped?._details]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header queryText="" onQueryChange={() => {}} />

      {/* ✅ SOLO mostrar promo si sabemos que NO compró aún */}
      {hasPurchased === false && (
        <StickyPromoSMS
          message="🎉 10% de descuento en tu primera compra"
          sub="No pierdas esta oportunidad y unete al chekeo"
        />
      )}

      {/* Loader global mientras se guarda en carrito */}
      <Backdrop open={cartSaving} sx={{ color: "#fff", zIndex: (t) => t.zIndex.drawer + 999 }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress color="inherit" />
          <Typography sx={{ fontWeight: 900 }}>Guardando en el carrito...</Typography>
        </Stack>
      </Backdrop>

      {/* ✅ padding bottom para que el bar fijo no tape contenido */}
      <Container
        maxWidth="lg"
        sx={{
          px: { xs: 1, sm: 2 },
          py: 3,
          pb: { xs: 12, sm: 11 },
        }}
      >
        {loading ? (
          <CenterLoader text="Cargando producto…" />
        ) : err ? (
          <Alert severity="error">{err}</Alert>
        ) : mapped ? (
          <>
            <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                {/* {fromCache && <Chip size="small" color="success" label="Cache" />} */}
              </Stack>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "420px 1fr" },
                  gap: 2,
                }}
              >
                {/* Image + gallery */}
                <Box>
                  <Box sx={{ position: "relative" }}>
                    <img
                      src={activeImage ?? mapped.Imagen ?? mapped.image}
                      alt={mapped._title}
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        borderRadius: 16,
                        objectFit: "cover",
                      }}
                    />
                  </Box>

                  {thumbUrls.length > 0 && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                      {thumbUrls.map((url, idx) => {
                        const selected = activeImage === url;

                        return (
                          <Box
                            key={`${mapped._productKey}-thumb-${idx}`}
                            onClick={() => setActiveImage(url)}
                            sx={{
                              width: 64,
                              height: 64,
                              borderRadius: 1.5,
                              overflow: "hidden",
                              cursor: "pointer",
                              border: selected ? "2px solid" : "1px solid rgba(0,0,0,0.12)",
                            }}
                          >
                            <img
                              src={url}
                              alt="thumb"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          </Box>
                        );
                      })}
                    </Stack>
                  )}

                  {mapped.imgreal && (mapped.imagenesreales?.length ?? 0) > 0 && (
                    <Paper variant="outlined" sx={{ mt: 2, p: 1.5, borderRadius: 2 }}>
                      <Typography sx={{ fontWeight: 900, mb: 1 }}>Imágenes reales</Typography>
                      <Stack direction="row" spacing={1}>
                        {mapped.imagenesreales.slice(0, 2).map((url, idx) => (
                          <Box
                            key={`${mapped._productKey}-real-${idx}`}
                            onClick={() => setActiveImage(url)}
                            sx={{
                              width: 88,
                              height: 88,
                              borderRadius: 2,
                              overflow: "hidden",
                              cursor: "pointer",
                              border: "1px solid rgba(0,0,0,0.12)",
                            }}
                          >
                            <img
                              src={url}
                              alt={`real-${idx + 1}`}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          </Box>
                        ))}
                      </Stack>
                    </Paper>
                  )}

                  <YouTubeEmbed videoId={mapped.youtubeId} title={mapped._title} />
                </Box>

                {/* Info */}
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    {mapped._title}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 900, marginTop: 2 }}>
                    XFA {puntodecimal(mapped._finalPrice)}
                  </Typography>

                  <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <StarIcon fontSize="small" />
                      <Typography sx={{ fontWeight: 900 }}>{mapped.rating}</Typography>
                    </Stack>

                    <Chip
                      size="small"
                      label={`Visitas:${mapped.Vistos !== undefined ? mapped.Vistos : 50}`}
                      variant="outlined"
                    />
                    <Chip size="small" label="Precio China" variant="outlined" />
                    <Chip size="small" label="Envío África" variant="outlined" />
                  </Stack>

                  {/* ✅ Detalles: solo 4 líneas + Leer más */}
                  <Box sx={{ mt: 1 }}>
                    <Typography
                      sx={{
                        color: "text.secondary",
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        ...(detailsExpanded ? {} : { WebkitLineClamp: 4 }),
                      }}
                    >
                      {mapped._details}
                    </Typography>

                    {hasMoreDetails && (
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => setDetailsExpanded((v) => !v)}
                        sx={{ mt: 0.5, px: 0, fontWeight: 900, textTransform: "none" }}
                      >
                        {detailsExpanded ? "Leer menos" : "Leer más"}
                      </Button>
                    )}
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {/* Color */}
                  {colors.length > 0 && (
                    <>
                      <Typography sx={{ mt: 2, fontWeight: 800 }}>Color</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                        {colors.map((c) => {
                          const name = c.nombre ?? c.name ?? c.label ?? "Color";
                          const hex = c.hex ?? c.color ?? null;
                          const selected = selectedColor?.id === c.id;

                          return (
                            <Chip
                              key={c.id}
                              label={name}
                              onClick={() => setSelectedColor(c)}
                              variant={selected ? "filled" : "outlined"}
                              sx={{
                                ...(hex
                                  ? {
                                      bgcolor: selected ? hex : "transparent",
                                      color: selected ? "#fff" : "inherit",
                                    }
                                  : {}),
                                border: selected ? "2px solid rgba(0,0,0,0.35)" : undefined,
                              }}
                            />
                          );
                        })}
                      </Stack>
                    </>
                  )}

                  {/* Estilo */}
                  {styles.length > 0 && (
                    <>
                      <Typography sx={{ mt: 2, fontWeight: 800 }}>Tallas</Typography>
                      <ToggleButtonGroup
                        value={selectedStyle?.id ?? null}
                        exclusive
                        onChange={(_, v) => {
                          if (!v) return;
                          const found = styles.find((s) => s.id === v);
                          setSelectedStyle(found ?? null);
                        }}
                        sx={{ mt: 1, flexWrap: "wrap" }}
                      >
                        {styles.map((s) => {
                          const name = s.nombre ?? s.name ?? s.label ?? "Estilo";
                          return (
                            <ToggleButton key={s.id} value={s.id}>
                              {name}
                            </ToggleButton>
                          );
                        })}
                      </ToggleButtonGroup>
                    </>
                  )}

                  {/* Cantidad */}
                  <Box sx={{ mt: 2 }}>
                    <Typography sx={{ fontWeight: 800 }}>Cantidad (máx. 9)</Typography>
                    <TextField
                      select
                      size="small"
                      value={qty}
                      onChange={(e) => setQty(Number(e.target.value))}
                      sx={{ mt: 1, width: 140 }}
                    >
                      {Array.from({ length: 9 }).map((_, i) => {
                        const v = i + 1;
                        return (
                          <MenuItem key={v} value={v}>
                            {v}
                          </MenuItem>
                        );
                      })}
                    </TextField>
                  </Box>

                  {/* Ciudad */}
                  <Typography sx={{ mt: 2, fontWeight: 800 }}>Ciudad de entrega</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Chip
                      label="Malabo"
                      color={shipCity === "Malabo" ? "primary" : "default"}
                      onClick={() => setShipCity("Malabo")}
                    />
                    <Chip
                      label="Bata"
                      color={shipCity === "Bata" ? "primary" : "default"}
                      onClick={() => setShipCity("Bata")}
                    />
                  </Stack>

                  {/* Tipo de envío */}
                  <Typography sx={{ mt: 2, fontWeight: 800 }}>Tipo de envío</Typography>
                  <ToggleButtonGroup
                    value={shipMethod}
                    exclusive
                    onChange={(_, v) => v && setShipMethod(v)}
                    sx={{ mt: 1, flexWrap: "wrap" }}
                  >
                    <ToggleButton value="AIR">
                      <FlightTakeoffIcon sx={{ mr: 1 }} />
                      Aéreo
                    </ToggleButton>
                  </ToggleButtonGroup>

                  {/* Envío info */}
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                    <LocalShippingIcon fontSize="small" />
                    <Typography sx={{ color: "text.secondary" }}>
                      Entrega estimada: <b>{mapped.shipDurationText}</b> a <b>{shipCity}</b>
                    </Typography>
                  </Stack>

                  <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
                    Estimación de envío ({shipMethod === "AIR" ? "Aéreo" : "Marítimo"}):{" "}
                    <b>
                      {mapped.shipEstimate != null
                        ? `XFA ${puntodecimal(mapped.shipEstimate)}`
                        : "No disponible"}
                    </b>{" "}
                    (informativo)
                  </Typography>

                  {/* ✅ Botones: desktop normal / móvil fixed blanco arriba de todo */}
                  <BottomActionBar
                    cartSaving={cartSaving}
                    disableColorRequired={disableColorRequired}
                    comprarahora={comprarahora}
                    addToCart={addToCart}
                    wishOn={wishOn}
                    toggleFavoriteFS={toggleFavoriteFS}
                    favBusy={favBusy}
                    onShare={onShare}
                  />

                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Chip icon={<VerifiedUserIcon />} label="Compra protegida" />
                    <Chip icon={<ReplayIcon />} label="Devolución 7 días" />
                  </Stack>

                  <Button sx={{ mt: 2 }} onClick={() => nav(-1)} disabled={cartSaving}>
                    ← Volver
                  </Button>
                </Box>
              </Box>
            </Paper>

            {mappedRelated.length > 0 && (
              <Paper elevation={0} sx={{ mt: 2, p: 2, borderRadius: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 2 }}>
                  Productos relacionados
                </Typography>
                <ProductGrid items={mappedRelated} loading={false} />
              </Paper>
            )}
          </>
        ) : null}
      </Container>
    </Box>
  );
}
