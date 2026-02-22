// src/pages/ProductDetailsPage.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import { useParams, useNavigate } from "react-router-dom";

import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import ToggleButton from "@mui/material/ToggleButton";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

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
import { useEffectiveAuth } from "../state/useEffectiveAuth";

/* ✅ Lazy-load de componentes pesados */
const ProductGrid = lazy(() => import("../components/productgrid"));
const Header = lazy(() => import("../components/header"));

/* -------------------- helpers -------------------- */
const LS_RECENTS = "chekea_recently_viewed_v1";
const LS_SHIP_CITY = "chekea_ship_city_v1";
const LS_SHIP_METHOD = "chekea_ship_method_v1";
const SS_VIEW_PREFIX = "chekea_viewed_once_v1:";

/** hasPurchased por usuario (guardado desde CheckoutPage) */
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
  const days = city === "Bata" ? 20 : 18;
  return { type: "DAYS", days };
}
function formatDuration(d) {
  if (!d) return "";
  if (d.type === "MONTHS") return `${d.months} meses`;
  return `${d.days} días`;
}

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
function getStylePrice(style) {
  if (!style) return 0;
  const v = style.precio ?? style.Precio ?? style.price ?? style.Price ?? 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* -------------------- envío estimado -------------------- */
const AIR_PRICE_PER_KG = 9000;
const AIR_PRICE_PER_KG_BATA = 13000;

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
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
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

    return { mode: "AIR", label: found.nombre, estimated };
  }

  const key = normKey(dimensionTipo);
  const found = DIMENSIONES.find((x) => normKey(x.nombre) === key);
  if (!found) return null;

  const mid = (found.min + found.max) / 2;
  const estimated = Math.round(mid * SEA_PRICE_PER_CBM * q);

  return { mode: "SEA", label: found.nombre, estimated };
}

/* -------------------- YouTube (lazy: solo si hay id) -------------------- */
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
          loading="lazy"
          src={`https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      </Box>
    </Paper>
  );
}

function CenterLoader({ text = "Cargando…" }) {
  return (
    <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
      <Stack spacing={2} alignItems="center">
        <CircularProgress size={28} />
        <Typography sx={{ fontWeight: 900 }}>{text}</Typography>
      </Stack>
    </Box>
  );
}

function StickyPromoSMS({
  message = "🎉 10% de descuento en tu primera compra",
  sub = "Usa el código: PRIMERA10",
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

/* BottomActionBar igual que el tuyo (sin cambios) */
function BottomActionBar(props) {
  const {
    cartSaving,
    disableColorRequired,
    comprarahora,
    addToCart,
    wishOn,
    toggleFavoriteFS,
    favBusy,
    onShare,
  } = props;

  return (
    <Box
      sx={{
        position: { xs: "fixed", sm: "static" },
        left: { xs: 0, sm: "auto" },
        right: { xs: 0, sm: "auto" },
        bottom: { xs: 0, sm: "auto" },
        bgcolor: { xs: "#fff", sm: "transparent" },
        zIndex: { xs: 20000, sm: "auto" },
        borderTop: { xs: "1px solid", sm: "none" },
        borderColor: { xs: "divider", sm: "transparent" },
        boxShadow: { xs: "0 -10px 25px rgba(0,0,0,0.12)", sm: "none" },
        px: { xs: 1, sm: 0 },
        py: { xs: 1, sm: 0 },
        pb: { xs: "calc(env(safe-area-inset-bottom, 0px) + 10px)", sm: 0 },
      }}
    >
      <Box sx={{ maxWidth: 980, mx: "auto" }}>
        <Stack
          direction="row"
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

function BottomLoginBar({ text = "Inicia sesión para comprar" }) {
  return (
    <Box
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: "#fff",
        zIndex: 20000,
        borderTop: "1px solid",
        borderColor: "divider",
        boxShadow: "0 -10px 25px rgba(0,0,0,0.12)",
        px: 1,
        py: 1,
        pb: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
      }}
    >
      <Box sx={{ maxWidth: 980, mx: "auto" }}>
        <Button fullWidth variant="contained" disabled sx={{ height: 44, fontWeight: 900 }}>
          {text}
        </Button>
      </Box>
    </Box>
  );
}

// ✅ helper para tareas diferibles
function idle(cb) {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) return window.requestIdleCallback(cb, { timeout: 1200 });
  return window.setTimeout(cb, 250);
}

export default function ProductDetailsPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { i18n } = useTranslation();

  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  // ✅ cart/auth
  const cart = useCart();
  const auth = useEffectiveAuth();
  const userId = auth?.user ? auth.user.uid : null;

  // ✅ condición para CTA disabled en móvil si NO hay sesión
  const showLoginBarOnMobile = !isDesktop && !userId;

  const [hasPurchased, setHasPurchased] = useState(null);
  useEffect(() => {
    setHasPurchased(readHasPurchasedForUser(userId));
  }, [userId]);

  // data state
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [colors, setColors] = useState([]);
  const [styles, setStyles] = useState([]);
  const [images, setImages] = useState([]);

  // selections
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [activeImage, setActiveImage] = useState(null);

  // shipping & qty
  const [shipCity, setShipCity] = useState(loadShipCity());
  const [shipMethod, setShipMethod] = useState(loadShipMethod());
  const [qty, setQty] = useState(1);

  // favorites
  const [wishOn, setWishOn] = useState(false);
  const [favoritoId, setFavoritoId] = useState("");
  const [favBusy, setFavBusy] = useState(false);

  // ui flags
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [cartSaving, setCartSaving] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  useEffect(() => saveShipCity(shipCity), [shipCity]);
  useEffect(() => saveShipMethod(shipMethod), [shipMethod]);

  // ✅ Preload header solo en desktop (idle)
  useEffect(() => {
    if (!isDesktop) return;
    const idd = idle(() => import("../components/header"));
    return () => {
      if (typeof window === "undefined") return;
      if ("cancelIdleCallback" in window && typeof idd === "number") {
        try {
          window.cancelIdleCallback(idd);
        } catch {}
      } else if (typeof idd === "number") clearTimeout(idd);
    };
  }, [isDesktop]);

  const productKey = useMemo(() => {
    if (!product) return id ?? null;
    return product.Codigo ?? product.id ?? id ?? null;
  }, [product, id]);

  // ✅ Protege contra responses viejas
  const reqIdRef = useRef(0);

  /* -------------------- load product (CACHE + SWR) -------------------- */
  useEffect(() => {
    let alive = true;
    const myReqId = ++reqIdRef.current;

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

    const hydrate = ({ p, c, s, imgs, rel }) => {
      if (!alive || myReqId !== reqIdRef.current) return;

      setErr("");
      setLoading(false);

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

      // ✅ 1) Si hay cache, pinta INMEDIATO y refresca SWR en background
      if (cached?.value) {
        hydrate(cached.value);

        // refresco SWR (no bloquea UI)
        try {
          const p2 = await getProductByIdFS(id);
          if (!alive || myReqId !== reqIdRef.current || !p2) return;

          const [c2, s2, imgs2] = await Promise.all([
            getProductColorsFS(p2.id),
            getProductStylesFS(p2.id),
            getProductImagesFS(p2.id),
          ]);
          if (!alive || myReqId !== reqIdRef.current) return;

          let rel2 = [];
          if (p2.Categoria) {
            rel2 = await getRelatedProductsFS({
              category: p2.Subcategoria,
              excludeId: p2.Codigo ?? p2.id,
              pageSize: 4,
            });
          }
          if (!alive || myReqId !== reqIdRef.current) return;

          const bundle2 = { p: p2, c: c2, s: s2, imgs: imgs2, rel: rel2 };
          cacheSet(cacheKey, bundle2);
          hydrate(bundle2);
        } catch {}
        return;
      }

      // ✅ 2) Sin cache: loader + fetch paralelo
      setLoading(true);
      resetUI();

      try {
        const p = await getProductByIdFS(id);
        if (!alive || myReqId !== reqIdRef.current) return;

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
        if (!alive || myReqId !== reqIdRef.current) return;

        let rel = [];
        if (p.Categoria) {
          rel = await getRelatedProductsFS({
            category: p.Subcategoria,
            excludeId: p.Codigo ?? p.id,
            pageSize: 4,
          });
        }
        if (!alive || myReqId !== reqIdRef.current) return;

        const bundle = { p, c: c ?? [], s: s ?? [], imgs: imgs ?? [], rel: rel ?? [] };
        cacheSet(cacheKey, bundle);
        hydrate(bundle);
      } catch (e) {
        if (!alive || myReqId !== reqIdRef.current) return;
        console.error(e);
        setErr("Error cargando el producto");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  /* -------------------- view count (1 por sesión) - diferido -------------------- */
  useEffect(() => {
    if (!productKey) return;

    const job = () => {
      const viewKey = `${SS_VIEW_PREFIX}${productKey}`;
      if (sessionStorage.getItem(viewKey)) return;

      sessionStorage.setItem(viewKey, "1");
      updateViewCountFS(productKey).catch((e) => console.error("updateViewCountFS failed:", e));
    };

    const idd = idle(job);
    return () => {
      if (typeof window === "undefined") return;
      if ("cancelIdleCallback" in window && typeof idd === "number") {
        try {
          window.cancelIdleCallback(idd);
        } catch {}
      } else if (typeof idd === "number") clearTimeout(idd);
    };
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
      _finalPrice: finalPrice,
      shipDurationText: formatDuration(duration),
      vendedor: product.Vendedor,
      shipEstimate: ship?.estimated ?? null,
      rating: product.Rating ?? product.rating ?? "4.0",
      _productKey: productKey,
      imgreal,
      imagenesreales: imgreal ? imagenesreales : [],
      youtubeId: product?.vid ?? null,
      Subcategoria: product.Subcategoria ?? product.subcategoria ?? "Otros",
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

  // ✅ Prefetch de ProductGrid SOLO si habrá relacionados (idle)
  useEffect(() => {
    if (mappedRelated.length === 0) return;
    const idd = idle(() => import("../components/productgrid"));
    return () => {
      if (typeof window === "undefined") return;
      if ("cancelIdleCallback" in window && typeof idd === "number") {
        try {
          window.cancelIdleCallback(idd);
        } catch {}
      } else if (typeof idd === "number") clearTimeout(idd);
    };
  }, [mappedRelated.length]);

  /* -------------------- favorites toggle (Firestore) -------------------- */
  const toggleFavoriteFS = useCallback(async () => {
    if (!mapped?._productKey) return;

    if (!userId) {
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
  }, [mapped, userId, nav, wishOn, favoritoId, favBusy]);

  /* -------------------- cart add (con loader) -------------------- */
  const addToCart = useCallback(async () => {
    if (!mapped) return;

    if (!userId) {
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
      const url = window.location.href;

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
        Precio: precioReal,
        Envio,
        Img,
        Vendedor,
        qty,
        Detalles,
        link: url,
      });

      await addInteraccionFS({
        userId,
        subcategoria: mapped.Subcategoria ?? "Otros",
        producto,
        cantidad: 4,
      });
    } finally {
      setCartSaving(false);
    }
  }, [mapped, activeImage, nav, cart, qty, shipCity, selectedColor, selectedStyle, userId]);

  const comprarahora = useCallback(() => {
    if (!mapped) return;

    if (!userId) {
      nav("/login");
      return;
    }

    const url = window.location.href;

    const Envio = Number(mapped.shipEstimate ?? 0);
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
            selectedStyle.name ?? selectedStyle.label ?? selectedStyle.Nombre ?? ""
          }`
        : null,
    ]
      .filter(Boolean)
      .join(" • ");

    const buyNowItem = {
      Producto: mapped._productKey,
      Titulo: mapped._title ?? "Producto",
      Precio: Number(mapped._finalPrice ?? 0),
      Envio,
      Img,
      Vendedor: mapped.vendedor,
      qty,
      Detalles,
      link: url,
      sub: mapped.Subcategoria ?? "Otros",
    };

    nav("/checkout", { state: { buyNowItem } });
  }, [mapped, userId, nav, activeImage, qty, shipCity, selectedColor, selectedStyle]);

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

  const thumbUrls = useMemo(() => {
    const base = (images ?? []).map(pickImgUrl).filter(Boolean);
    const real = (mapped?.imagenesreales ?? []).filter(Boolean);
    return [...base, ...real.slice(0, 2)];
  }, [images, mapped?.imagenesreales]);

  const disableColorRequired = colors.length > 0 && !selectedColor;

  const hasMoreDetails = useMemo(() => {
    const txt = String(mapped?._details ?? "").trim();
    return txt.length > 160;
  }, [mapped?._details]);

  const qtyOptions = useMemo(() => Array.from({ length: 9 }, (_, i) => i + 1), []);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* ✅ Header solo desktop, lazy (sin state/effect extra) */}
      {isDesktop ? (
        <Suspense fallback={null}>
          <Header queryText="" onQueryChange={() => {}} />
        </Suspense>
      ) : null}

      {hasPurchased === false && (
        <StickyPromoSMS
          message="🎉 10% de descuento en tu primera compra"
          sub="No pierdas esta oportunidad y unete al chekeo"
        />
      )}

      <Backdrop open={cartSaving} sx={{ color: "#fff", zIndex: (t) => t.zIndex.drawer + 999 }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress color="inherit" />
          <Typography sx={{ fontWeight: 900 }}>Guardando en el carrito...</Typography>
        </Stack>
      </Backdrop>

      <Container
        maxWidth="lg"
        sx={{
          px: { xs: 1, sm: 2 },
          py: 3,
          pb: { xs: showLoginBarOnMobile ? 10 : 12, sm: 11 },
        }}
      >
        {loading ? (
          <CenterLoader text="Cargando producto…" />
        ) : err ? (
          <Alert severity="error">{err}</Alert>
        ) : mapped ? (
          <>
            {/* --- TU UI EXACTA (sin cambios) --- */}
            <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
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
                      loading="eager"
                      decoding="async"
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
                              loading="lazy"
                              decoding="async"
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
                              loading="lazy"
                              decoding="async"
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

                  <Typography variant="h5" sx={{ fontWeight: 900, mt: 2 }}>
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

                  <Box sx={{ mt: 2 }}>
                    <Typography sx={{ fontWeight: 800 }}>Cantidad (máx. 9)</Typography>
                    <TextField
                      select
                      size="small"
                      value={qty}
                      onChange={(e) => setQty(Number(e.target.value))}
                      sx={{ mt: 1, width: 140 }}
                    >
                      {qtyOptions.map((v) => (
                        <MenuItem key={v} value={v}>
                          {v}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>

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

                  <BottomActionBar
                      cartSaving={cartSaving}
                      disableColorRequired={colors.length > 0 && !selectedColor}
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

            {/* ✅ Relacionados: lazy-load solo si hay data */}
            {mappedRelated.length > 0 && (
              <Paper elevation={0} sx={{ mt: 2, p: 2, borderRadius: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 2 }}>
                  Productos relacionados
                </Typography>

                <Suspense fallback={<CenterLoader text="Cargando relacionados…" />}>
                  <ProductGrid items={mappedRelated} loading={false} />
                </Suspense>
              </Paper>
            )}
          </>
        ) : null}
      </Container>
    </Box>
  );
}