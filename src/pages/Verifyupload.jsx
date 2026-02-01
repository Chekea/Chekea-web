import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Container,
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Divider,
  Stack,
  TextField,
  Backdrop,
  CircularProgress,
  LinearProgress,
  Chip,
  Collapse,
} from "@mui/material";

import Header from "../components/header";
import { useAuth } from "../state/AuthContext";
import { createCompraDualFS } from "../services/compras.service";

import {
  getDownloadURL,
  ref as storageref,
  uploadBytesResumable,
} from "firebase/storage";
import { storage } from "../config/firebase";

import { compressImage, puntodecimal } from "../utils/Helpers";

// ✅ Tu imagen guía local (ya la tenías)
import prueba from "../assets/homeCats/prueba.JPG";

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function calcProductsSubtotal(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((acc, it) => {
    const price = safeNumber(it?.precio ?? it?.price ?? it?.Precio ?? 0, 0);
    const qty = Math.max(1, safeNumber(it?.qty ?? it?.cantidad ?? 1, 1));
    return acc + price * qty;
  }, 0);
}

function calcShippingTotal(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((acc, it) => {
    const envio = safeNumber(it?.Envio ?? it?.envio ?? 0, 0);
    return acc + envio;
  }, 0);
}

export default function VerifyUploadPage() {
  const { orderId } = useParams();
  const nav = useNavigate();
  const location = useLocation();

  const auth = useAuth();
  const userId = auth?.user?.uid ?? null;

  const itemsToPay = location.state?.itemsToPay ?? [];
  const discountAmount = safeNumber(location.state?.discountAmount ?? 0, 0);
  const finalTotalToPayFromCheckout = location.state?.finalTotalToPay;

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

  // ✅ Mostrar/ocultar guía imagen banco
  const [showBankGuide, setShowBankGuide] = useState(false);

  // ✅ Mostrar/ocultar datos sensibles de cuenta
  const [showAccountDetails, setShowAccountDetails] = useState(false);

  // ✅ Feedback copiar
  const [copied, setCopied] = useState("");

  const nombreOk = nombre.trim().length >= 3;
  const contactoOk = contacto.trim().length >= 6;

  const canSubmit =
    !!file && nombreOk && contactoOk && !!userId && !loading && !submitted;

  const productsSubtotal = useMemo(
    () => calcProductsSubtotal(itemsToPay),
    [itemsToPay]
  );
  const shippingTotal = useMemo(
    () => calcShippingTotal(itemsToPay),
    [itemsToPay]
  );

  const computedFinalTotal = useMemo(() => {
    const total = productsSubtotal - discountAmount + shippingTotal;
    return Number(total.toFixed(2));
  }, [productsSubtotal, discountAmount, shippingTotal]);

  const finalTotalToPay = useMemo(() => {
    const n = safeNumber(finalTotalToPayFromCheckout, NaN);
    if (Number.isFinite(n)) return Number(n.toFixed(2));
    return computedFinalTotal;
  }, [finalTotalToPayFromCheckout, computedFinalTotal]);

  const codeShort = useMemo(() => `Ch-${String(orderId ?? "").slice(-5)}`, [orderId]);
  // const fullCode = useMemo(() => `Ch-${orderId}`, [orderId]); // si lo necesitas más tarde

  const buildUserInfo = useCallback(
    () => ({
      nombre: nombre.trim(),
      contacto: contacto.trim(),
    }),
    [nombre, contacto]
  );

  // ✅ Limpieza previewUrl
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ✅ Seguridad UX: si se envió, ocultar datos sensibles
  useEffect(() => {
    if (submitted) setShowAccountDetails(false);
  }, [submitted]);

  // ✅ Auto-ocultar datos sensibles después de X segundos (opcional, recomendado)
  useEffect(() => {
    if (!showAccountDetails) return;
    const t = setTimeout(() => setShowAccountDetails(false), 20000); // 20s
    return () => clearTimeout(t);
  }, [showAccountDetails]);

  const handleFileChange = useCallback(
    (event) => {
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
        console.error(e);
        setFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
        setErr(e?.message ?? "Archivo inválido");
      } finally {
        input.value = "";
      }
    },
    [previewUrl]
  );

  const clearImage = useCallback(() => {
    setFile(null);
    setUploadPct(0);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
  }, [previewUrl]);

  const uploadVerificationToStorage = useCallback(
    async ({ imageFile, orderId, userId }) => {
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
            const pct = Math.round(
              (snap.bytesTransferred / snap.totalBytes) * 100
            );
            setUploadPct(pct);
          },
          reject,
          () => resolve(task.snapshot)
        );
      });

      const url = await getDownloadURL(snapshot.ref);

      return {
        url,
        path,
        filename: webpFile.name,
        contentType: webpFile.type,
        size: webpFile.size,
      };
    },
    []
  );

  const handleCopy = useCallback(async (text, label) => {
    try {
      await navigator.clipboard.writeText(String(text));
      setCopied(`${label} copiado`);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("No se pudo copiar");
      setTimeout(() => setCopied(""), 1500);
    }
  }, []);

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
      });

      setOk(
        "Comprobante enviado correctamente. Estado: PENDIENTE DE VERIFICACIÓN."
      );
      setSubmitted(true);
    } catch (e) {
      console.error(e);
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
  ]);

  // ✅ Datos sensibles (si quieres, muévelos a env/DB)
  const accountHolder = "ANA SOLEDAD MAYOMBI BOTOCO";
  const phoneToRecharge = "555 549928";
  const helpPhone = "222 237169";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header queryText="" onQueryChange={() => {}} />

      <Backdrop
        open={loading}
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 999 }}
      >
        <Paper sx={{ p: 3, borderRadius: 3, minWidth: 320 }}>
          <Stack spacing={2} alignItems="center">
            <CircularProgress />
            <Typography sx={{ fontWeight: 900 }}>{loadingText}</Typography>

            {uploadPct > 0 && uploadPct < 100 && (
              <Box sx={{ width: "100%" }}>
                <LinearProgress variant="determinate" value={uploadPct} />
                <Typography sx={{ mt: 1, textAlign: "center" }}>
                  {uploadPct}%
                </Typography>
              </Box>
            )}
          </Stack>
        </Paper>
      </Backdrop>

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
              <Button sx={{ ml: 1 }} size="small" onClick={() => nav("/login")}>
                Iniciar sesión
              </Button>
            </Alert>
          )}

          {/* RESUMEN */}
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
              disabled={loading || submitted}
            />

            <TextField
              label="Contacto (Teléfono / WhatsApp)"
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              fullWidth
              disabled={loading || submitted}
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

          {/* INSTRUCCIONES */}
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

              {/* ✅ guía de seguridad + botón */}
              <Alert severity="info" sx={{ mb: 0.5 }}>
                Por seguridad, los datos de ingreso están ocultos. Pulsa{" "}
                <b>“Ver datos para ingresar”</b> y asegúrate de poner{" "}
                <b>{codeShort}</b> en “Concepto / Referencia”.
              </Alert>

              <Button
                variant="contained"
                onClick={() => setShowAccountDetails((v) => !v)}
                disabled={loading || submitted}
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
                  sx={{
                    mt: 1,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: "background.paper",
                  }}
                >
                  <Stack spacing={1}>
                    <Typography sx={{ fontWeight: 900 }}>
                      Datos para ingresar
                    </Typography>

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

                    <Alert severity="info">
                      *Se ocultará automáticamente en unos segundos por
                      seguridad.
                    </Alert>
                  </Stack>
                </Paper>
              </Collapse>

         
              <Typography>
                4) Sube una foto o captura clara del comprobante abajo.
              </Typography>

              {/* ✅ NUEVO: botón para mostrar imagen guía */}
              <Button
                variant="text"
                onClick={() => setShowBankGuide((v) => !v)}
                disabled={loading || submitted}
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
                  <Box
                    component="img"
                    src={prueba}
                    alt="Guía de transferencia (ejemplo)"
                    sx={{
                      width: "100%",
                      display: "block",
                      maxHeight: 320,
                      objectFit: "contain",
                    }}
                  />
                </Box>

                <Typography
                  variant="body2"
                  sx={{ mt: 1, color: "text.secondary" }}
                >
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
            disabled={loading || submitted}
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
                  disabled={loading || submitted}
                  onClick={clearImage}
                >
                  Cambiar / quitar imagen
                </Button>
              </Stack>
            </Box>
          )}

          <Button
            variant="contained"
            fullWidth
            sx={{ mt: 2 }}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {loading ? "Subiendo..." : "Enviar comprobante"}
          </Button>

          {submitted && (
            <Button
              sx={{ mt: 1 }}
              fullWidth
              variant="outlined"
              onClick={() => nav("/miscompras")}
            >
              Ver mis compras
            </Button>
          )}

          <Button
            sx={{ mt: 2 }}
            fullWidth
            variant="outlined"
            disabled={loading}
            onClick={() => nav("/")}
          >
            Volver a la tienda
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}
