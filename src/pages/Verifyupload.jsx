import React, { useMemo, useState, useCallback, useEffect, memo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

/* ✅ MUI imports por archivo (mejor rendimiento) */
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

/* ✅ Header lazy solo desktop */
function useDesktopHeader() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [HeaderComp, setHeaderComp] = useState(null);

  useEffect(() => {
    if (!isDesktop) return;
    let mounted = true;
    import("../components/header").then((mod) => {
      if (mounted) setHeaderComp(() => mod.default);
    });
    return () => {
      mounted = false;
    };
  }, [isDesktop]);

  return { isDesktop, HeaderComp };
}

import { useEffectiveAuth } from "../state/useEffectiveAuth";
import { createCompraDualFS } from "../services/compras.service";

import {
  getDownloadURL,
  ref as storageref,
  uploadBytesResumable,
} from "firebase/storage";
import { storage } from "../config/firebase";

import { compressImage, puntodecimal } from "../utils/Helpers";
import { addInteraccionFS } from "../services/product.firesore.service";

/* ================= helpers ================= */
function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function calcTotalsFast(items, discountAmount) {
  // loop for (más rápido en móviles)
  let productsSubtotal = 0;
  let shippingTotal = 0;

  if (Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const price = safeNumber(it?.precio ?? it?.price ?? it?.Precio ?? 0, 0);
      const qty = Math.max(1, safeNumber(it?.qty ?? it?.cantidad ?? 1, 1));
      productsSubtotal += price * qty;

      const envio = safeNumber(it?.Envio ?? it?.envio ?? 0, 0);
      shippingTotal += envio;
    }
  }

  const total = productsSubtotal - safeNumber(discountAmount, 0) + shippingTotal;
  const computedFinalTotal = Number(total.toFixed(2));

  return { productsSubtotal, shippingTotal, computedFinalTotal };
}

/* ================= memo components ================= */

const LoadingOverlay = memo(function LoadingOverlay({ open, text, pct }) {
  if (!open) return null; // ✅ no render si no loading

  return (
    <Backdrop open sx={{ color: "#fff", zIndex: (t) => t.zIndex.drawer + 999 }}>
      <Paper sx={{ p: 3, borderRadius: 3, minWidth: 320 }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography sx={{ fontWeight: 900 }}>{text}</Typography>

          {pct > 0 && pct < 100 && (
            <Box sx={{ width: "100%" }}>
              <LinearProgress variant="determinate" value={pct} />
              <Typography sx={{ mt: 1, textAlign: "center" }}>{pct}%</Typography>
            </Box>
          )}
        </Stack>
      </Paper>
    </Backdrop>
  );
});

const SubmittedSticky = memo(function SubmittedSticky({ visible, text }) {
  if (!visible) return null;
  return (
    <Box
      sx={{
        position: "sticky",
        top: 0,
        zIndex: (t) => t.zIndex.appBar + 1,
        px: 2,
        py: 1.2,
        bgcolor: "success.main",
        color: "success.contrastText",
      }}
    >
      <Typography sx={{ fontWeight: 900, textAlign: "center" }}>{text}</Typography>
    </Box>
  );
});

const SummaryCard = memo(function SummaryCard({
  codeShort,
  productsSubtotal,
  shippingTotal,
  discountAmount,
  finalTotalToPay,
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
      <Stack spacing={0.5}>
        <Typography sx={{ fontWeight: 900 }}>Resumen</Typography>
        <Typography sx={{ fontWeight: 700 }}>
          Productos: XFA {puntodecimal(productsSubtotal)}
        </Typography>
        <Typography sx={{ fontWeight: 700 }}>
          Envío: XFA {puntodecimal(shippingTotal)}
        </Typography>
        {discountAmount > 0 && (
          <Typography sx={{ fontWeight: 800, color: "success.main" }}>
            Descuento: -XFA {puntodecimal(discountAmount)}
          </Typography>
        )}
        <Divider />
        <Typography sx={{ fontWeight: 900 }}>
          Total a pagar: XFA {puntodecimal(finalTotalToPay)}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          En el pago, usa este código: <b>{codeShort}</b>
        </Typography>
      </Stack>
    </Paper>
  );
});

export default function VerifyUploadPage() {
  const { orderId } = useParams();
  const nav = useNavigate();
  const location = useLocation();

  const { isDesktop, HeaderComp } = useDesktopHeader();

  const auth = useEffectiveAuth();
  const userId = auth?.user?.uid ?? null;

  const itemsToPay = location.state?.itemsToPay ?? [];
  const discountAmount = safeNumber(location.state?.discountAmount ?? 0, 0);
  const finalTotalToPayFromCheckout = location.state?.finalTotalToPay;
  const shipping = location.state?.shippingTotal;

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploadPct, setUploadPct] = useState(0);

  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");

  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Enviando comprobante...");
  const [submitted, setSubmitted] = useState(false);

  const [showBankGuide, setShowBankGuide] = useState(false);
  const [showAccountDetails, setShowAccountDetails] = useState(false);
  const [copied, setCopied] = useState("");

  const nombreOk = nombre.trim().length >= 3;
  const contactoOk = contacto.trim().length >= 6;
  const lockAfterSubmit = submitted;

  const canSubmit = !!file && nombreOk && contactoOk && !!userId && !loading && !submitted;

  const codeShort = useMemo(() => `Ch-${String(orderId ?? "").slice(-5)}`, [orderId]);

  /* ✅ Totales rápidos */
  const { productsSubtotal, shippingTotal, computedFinalTotal } = useMemo(
    () => calcTotalsFast(itemsToPay, discountAmount),
    [itemsToPay, discountAmount]
  );

  const finalTotalToPay = useMemo(() => {
    const n = safeNumber(finalTotalToPayFromCheckout, NaN);
    if (Number.isFinite(n)) return Number(n.toFixed(2));
    return computedFinalTotal;
  }, [finalTotalToPayFromCheckout, computedFinalTotal]);

  const buildUserInfo = useCallback(
    () => ({
      nombre: nombre.trim(),
      contacto: Number(contacto.trim()),
    }),
    [nombre, contacto]
  );

  /* ✅ limpiar previewUrl */
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  /* ✅ si submitted: ocultar datos sensibles */
  useEffect(() => {
    if (submitted) setShowAccountDetails(false);
  }, [submitted]);

  /* ✅ auto-ocultar datos sensibles */
  useEffect(() => {
    if (!showAccountDetails) return;
    const t = setTimeout(() => setShowAccountDetails(false), 20000);
    return () => clearTimeout(t);
  }, [showAccountDetails]);

  const handleFileChange = useCallback(
    (event) => {
      if (lockAfterSubmit) return;
      const input = event.target;
      const selected = input.files?.[0] ?? null;

      setErr("");
      setOk("");

      if (!selected) {
        setFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
        return;
      }

      try {
        if (!selected.type?.startsWith("image/")) {
          throw new Error("Archivo no permitido (solo imágenes)");
        }

        if (previewUrl) URL.revokeObjectURL(previewUrl);

        setFile(selected);
        setPreviewUrl(URL.createObjectURL(selected));
      } catch (e) {
        setFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
        setErr(e?.message ?? "Archivo inválido");
      } finally {
        input.value = "";
      }
    },
    [previewUrl, lockAfterSubmit]
  );

  const clearImage = useCallback(() => {
    if (lockAfterSubmit) return;
    setFile(null);
    setUploadPct(0);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
  }, [previewUrl, lockAfterSubmit]);

  const uploadVerificationToStorage = useCallback(async ({ imageFile, orderId, userId }) => {
    if (!imageFile || !imageFile.type?.startsWith("image/")) {
      throw new Error("Archivo inválido (no es imagen)");
    }

    const MAX_FILE_MB = 8;
    if (imageFile.size / 1024 / 1024 > MAX_FILE_MB) {
      throw new Error(`Imagen muy grande (${MAX_FILE_MB}MB máx)`);
    }

    setLoadingText("Optimizando imagen...");
    const webpFile = await compressImage(imageFile, {
      maxWidth: 1200,
      maxHeight: 900,
      quality: 0.8,
      mimeType: "image/webp",
    });

    const uniqueId =
      (crypto?.randomUUID && crypto.randomUUID()) ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const path = `Imagenes/Verificaciones/${userId}/${orderId}/${uniqueId}.webp`;
    const imageRef = storageref(storage, path);

    setLoadingText("Subiendo imagen...");
    setUploadPct(0);

    const task = uploadBytesResumable(imageRef, webpFile, {
      contentType: webpFile.type,
      cacheControl: "public,max-age=31536000,immutable",
    });

    const snapshot = await new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setUploadPct(pct);
        },
        reject,
        () => resolve(task.snapshot)
      );
    });

    const url = await getDownloadURL(snapshot.ref);

    return { url };
  }, []);

  const subirInteraccion = useCallback(async () => {
    const firstItem = itemsToPay[0];
    if (firstItem?.sub && firstItem?.Producto && userId) {
      await addInteraccionFS({
        userId,
        subcategoria: firstItem.sub,
        productId: firstItem.Producto,
        cantidad: 8,
      });
    }
  }, [itemsToPay, userId]);

  const handleCopy = useCallback(
    async (text, label) => {
      if (lockAfterSubmit) return;
      try {
        await navigator.clipboard.writeText(String(text));
        setCopied(`${label} copiado`);
      } catch {
        setCopied("No se pudo copiar");
      } finally {
        window.clearTimeout(handleCopy._t);
        handleCopy._t = window.setTimeout(() => setCopied(""), 1500);
      }
    },
    [lockAfterSubmit]
  );

  const handleSubmit = useCallback(async () => {
    setErr("");
    setOk("");
    setLoading(true);
    setLoadingText("Enviando comprobante...");
    setUploadPct(0);

    try {
      if (!userId) throw new Error("Debes iniciar sesión");
      if (!file) throw new Error("Debes seleccionar una imagen");
      if (!nombreOk) throw new Error("Escribe tu nombre y apellidos");
      if (!contactoOk) throw new Error("Escribe tu contacto (Tel/WhatsApp)");

      const uploadRes = await uploadVerificationToStorage({
        orderId,
        userId,
        imageFile: file,
      });

      const imageUrl = uploadRes?.url ?? null;

      setLoadingText("Guardando datos del pedido...");

      await createCompraDualFS({
        userId,
        compraId: orderId,
        userInfo: buildUserInfo(),
        compraData: Array.isArray(itemsToPay) ? itemsToPay : [],
        img: imageUrl,
        descuento: discountAmount,
        total: finalTotalToPay,
        envio: shipping,
      });

      setOk("✅ Compra exitosa. Comprobante enviado.");
      setSubmitted(true);

      // no bloquea UI si falla
      subirInteraccion().catch(() => {});
    } catch (e) {
      setErr(e?.message || "No se pudo enviar. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
      setLoadingText("Enviando comprobante...");
    }
  }, [
    userId,
    file,
    nombreOk,
    contactoOk,
    orderId,
    uploadVerificationToStorage,
    buildUserInfo,
    itemsToPay,
    discountAmount,
    finalTotalToPay,
    shipping,
    subirInteraccion,
  ]);

  /* ✅ Datos sensibles (textos tuyos intactos) */
  const accountHolder = "ANA SOLEDAD MAYOMBI BOTOCO";
  const phoneToRecharge = "555 549928";
  const helpPhone = "222 237169";

  /* ✅ Lazy-load guía SOLO cuando se abre */
  const [bankGuideSrc, setBankGuideSrc] = useState(null);
  useEffect(() => {
    if (!showBankGuide || bankGuideSrc) return;
    import("../assets/homeCats/prueba.JPG").then((mod) => {
      setBankGuideSrc(mod.default);
    });
  }, [showBankGuide, bankGuideSrc]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* ✅ Header SOLO desktop */}
      {isDesktop && HeaderComp && <HeaderComp queryText="" onQueryChange={() => {}} />}

      {/* ✅ SMS fijo en pantalla (sin navegar) */}
      <SubmittedSticky visible={submitted} text="✅ Compra exitosa. Comprobante enviado." />

      <LoadingOverlay open={loading} text={loadingText} pct={uploadPct} />

      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Verificación de pago
          </Typography>

          <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
            Pedido ID: <Chip size="small" label={codeShort} sx={{ ml: 1 }} />
          </Typography>

          <Divider sx={{ my: 2 }} />

          {!userId && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Debes iniciar sesión para enviar el comprobante.
              <Button
                sx={{ ml: 1 }}
                size="small"
                onClick={() => nav("/login")}
                disabled={loading || lockAfterSubmit}
              >
                Iniciar sesión
              </Button>
            </Alert>
          )}

          <SummaryCard
            codeShort={codeShort}
            productsSubtotal={productsSubtotal}
            shippingTotal={shippingTotal}
            discountAmount={discountAmount}
            finalTotalToPay={finalTotalToPay}
          />

          <Divider sx={{ my: 2 }} />

          <Typography sx={{ fontWeight: 900, mb: 1 }}>
            Datos del comprador
          </Typography>

          <Stack spacing={1.5} sx={{ mb: 2 }}>
            <TextField
              label="Nombre y apellidos"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              fullWidth
              disabled={loading || lockAfterSubmit}
            />

            <TextField
              label="Contacto (Teléfono / WhatsApp)"
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              fullWidth
              disabled={loading || lockAfterSubmit}
            />
          </Stack>

          <Divider sx={{ my: 2 }} />

          {err && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {err}
            </Alert>
          )}
          {ok && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {ok}
            </Alert>
          )}

          {/* INSTRUCCIONES (tus textos intactos) */}
          <Typography sx={{ fontWeight: 900, mb: 1 }}>
            ¿Cómo completar el pago?
          </Typography>
          <Typography sx={{ color: "text.secondary", mb: 2 }}>
            Elige una opción. Cuando termines, sube una foto o captura del
            comprobante abajo.
          </Typography>

          {/* Opción 1 */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
            <Typography sx={{ fontWeight: 900, mb: 1 }}>
              Opción 1: Pago presencial (en Oficina)
            </Typography>

            <Stack spacing={1}>
              <Typography>
                1) Ve a la Oficina en <b>la rotonda de Cine Rial</b>.
              </Typography>
              <Typography>
                2) Indica el código del pedido: <b>{codeShort}</b>.
              </Typography>
              <Typography>
                3) Realiza el pago y pide un comprobante (recibo / ticket).
              </Typography>
              <Typography>
                4) Sube aquí una foto clara del comprobante para validar tu
                pedido.
              </Typography>

              <Alert severity="info">
                Ayuda / WhatsApp / Teléfono: <b>{helpPhone}</b>
              </Alert>
            </Stack>
          </Paper>

          {/* Opción 2 */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography sx={{ fontWeight: 900, mb: 1 }}>
              Opción 2: BGFI Mobile ingreso
            </Typography>

            <Stack spacing={1}>
              <Typography>1) Abre tu app y selecciona “Ingreso”.</Typography>

              <Alert severity="info" sx={{ mb: 0.5 }}>
                Por seguridad, los datos de ingreso están ocultos. Pulsa{" "}
                <b>“Ver datos para ingresar”</b> y asegúrate de poner{" "}
                <b>{codeShort}</b> en “Concepto / Referencia”.
              </Alert>

              <Button
                variant="contained"
                onClick={() => setShowAccountDetails((v) => !v)}
                disabled={loading || lockAfterSubmit}
                sx={{ alignSelf: "flex-start" }}
              >
                {showAccountDetails ? "Ocultar datos" : "Ver datos para ingresar"}
              </Button>

              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Paso 1: Pulsa “Ver datos”. Paso 2: Haz el ingreso. Paso 3: Guarda
                el comprobante (recibo de banco).
              </Typography>

              <Collapse in={showAccountDetails}>
                <Paper
                  variant="outlined"
                  sx={{ mt: 1, p: 2, borderRadius: 2, bgcolor: "background.paper" }}
                >
                  <Stack spacing={1}>
                    <Typography sx={{ fontWeight: 900 }}>Datos para ingresar</Typography>

                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: "background.default",
                        border: "1px dashed",
                        borderColor: "divider",
                      }}
                    >
                      <Typography>
                        <b>Titular:</b> {accountHolder}
                      </Typography>
                      <Typography>
                        <b>Teléfono a recargar:</b> {phoneToRecharge}
                      </Typography>
                    </Box>

                    {copied && <Alert severity="success">{copied}</Alert>}

                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        onClick={() => handleCopy(accountHolder, "Titular")}
                        disabled={loading || lockAfterSubmit}
                      >
                        Copiar titular
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => handleCopy(phoneToRecharge, "Teléfono")}
                        disabled={loading || lockAfterSubmit}
                      >
                        Copiar teléfono
                      </Button>
                    </Stack>

                    <Alert severity="info">
                      *Se ocultará automáticamente en unos segundos por seguridad.
                    </Alert>
                  </Stack>
                </Paper>
              </Collapse>

              <Typography>4) Sube una foto o captura clara del comprobante abajo.</Typography>

              <Button
                variant="text"
                onClick={() => setShowBankGuide((v) => !v)}
                disabled={loading || lockAfterSubmit}
                sx={{ alignSelf: "flex-start", mt: 0.5 }}
              >
                {showBankGuide
                  ? "Ocultar guía de relleno del banco"
                  : "Ver guía: cómo rellenar en el banco"}
              </Button>

              <Collapse in={showBankGuide}>
                <Box
                  sx={{
                    mt: 1,
                    borderRadius: 2,
                    overflow: "hidden",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  {/* ✅ carga lazy: solo cuando se abre */}
                  {bankGuideSrc ? (
                    <Box
                      component="img"
                      src={bankGuideSrc}
                      alt="Guía de transferencia (ejemplo)"
                      loading="lazy"
                      decoding="async"
                      sx={{
                        width: "100%",
                        display: "block",
                        maxHeight: 320,
                        objectFit: "contain",
                      }}
                    />
                  ) : (
                    <Box sx={{ p: 2 }}>
                      <Typography sx={{ color: "text.secondary" }}>
                        Cargando guía...
                      </Typography>
                      <LinearProgress sx={{ mt: 1 }} />
                    </Box>
                  )}
                </Box>

                <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                  *Ejemplo ilustrativo. Asegúrate de colocar el código{" "}
                  <b>{codeShort}</b> en “Concepto / Referencia”.
                </Typography>
              </Collapse>

              <Alert severity="warning">
                Recuerda verificar todo antes de ingresar. Tu pago puede tardar
                más en verificarse si algo sale mal.
              </Alert>
            </Stack>
          </Paper>

          <Divider sx={{ my: 2 }} />

          <Typography sx={{ fontWeight: 900, mb: 0.5 }}>
            Después de subir el comprobante
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            Tu pedido quedará en estado <b>PENDIENTE DE VERIFICACIÓN</b>. Te
            contactaremos si necesitamos confirmar algún detalle.
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography sx={{ fontWeight: 900, mb: 1 }}>
            Subir comprobante
          </Typography>

          <input
            type="file"
            accept="image/*"
            disabled={loading || lockAfterSubmit}
            onChange={handleFileChange}
          />

          {previewUrl && (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>
                Vista previa
              </Typography>

              <Box
                component="img"
                src={previewUrl}
                alt="Comprobante"
                loading="lazy"
                decoding="async"
                sx={{
                  width: "100%",
                  maxHeight: 360,
                  objectFit: "contain",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                }}
              />

              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  disabled={loading || lockAfterSubmit}
                  onClick={clearImage}
                >
                  Cambiar / quitar imagen
                </Button>
              </Stack>
            </Box>
          )}

          {!submitted ? (
            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 2 }}
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {loading ? "Subiendo..." : "Enviar comprobante"}
            </Button>
          ) : null}

          {submitted ? (
            <Button
              sx={{ mt: 2 }}
              fullWidth
              variant="contained"
              onClick={() => nav("/")}
            >
              Volver
            </Button>
          ) : (
            <Button
              sx={{ mt: 2 }}
              fullWidth
              variant="outlined"
              disabled={loading}
              onClick={() => nav("/")}
            >
              Volver a la tienda
            </Button>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
