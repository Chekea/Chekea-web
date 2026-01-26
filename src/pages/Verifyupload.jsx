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
import { compressImage } from "../utils/Helpers";

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function calcTotal(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((acc, it) => {
    const price = safeNumber(it?.precio ?? it?.price ?? it?.Precio ?? 0, 0);
    const qty = Math.max(1, safeNumber(it?.qty ?? it?.cantidad ?? 1, 1));
    return acc + price * qty;
  }, 0);
}

export default function VerifyUploadPage() {
  const { orderId } = useParams();
  const nav = useNavigate();
  const location = useLocation();

  const auth = useAuth();
  const userId = auth?.user?.uid ?? null;

  const itemsToPay = location.state?.itemsToPay ?? null;

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploadPct, setUploadPct] = useState(0);

  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");

  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Enviando comprobante...");

  const [submitted, setSubmitted] = useState(false); // ✅ NUEVO: bloqueo tras éxito

  const nombreOk = nombre.trim().length >= 3;
  const contactoOk = contacto.trim().length >= 6;

  // ✅ si ya se envió con éxito, no permitir resubir
  const canSubmit = !!file && nombreOk && contactoOk && !!userId && !loading && !submitted;

  const computedTotal = useMemo(() => calcTotal(itemsToPay), [itemsToPay]);

  const buildUserInfo = () => ({
    nombre: nombre.trim(),
    contacto: contacto.trim(),
  });

  // ✅ limpiar preview url
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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
        if (!selected.type.startsWith("image/")) {
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
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setUploadPct(pct);
          },
          reject,
          () => resolve(task.snapshot)
        );
      });

      const url = await getDownloadURL(snapshot.ref);

      return { url, path, filename: webpFile.name, contentType: webpFile.type, size: webpFile.size };
    },
    []
  );

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
                <Typography sx={{ mt: 1, textAlign: "center" }}>{uploadPct}%</Typography>
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
            Pedido Id: Ch-<b>{orderId}</b>
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

          <Divider sx={{ my: 2 }} />

          <Typography sx={{ fontWeight: 900 }}>Datos del comprador</Typography>

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

          {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
          {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}

          <Typography sx={{ fontWeight: 900 }}>Instrucciones para completar el proceso</Typography>

          {/* Paso 1: Ingreso al local físico */}
          <Typography sx={{ mb: 2 }}>
            Opcion 1: Ingresa al local físico ubicado en la rotonda de Cine Rial. Contacto: <strong>222222</strong>
          </Typography>

          {/* Paso 2: Ingreso bancario */}
          <Typography sx={{ mb: 2 }}>
            Opcion 2: Realiza el ingreso bancario. Número de cuenta: <strong>XXX-XXXX-XXXX</strong> y Nombre del titular: <strong>Nombre Banco</strong>
          </Typography>

          {/* Paso 3: Código de la compra */}
          <Typography sx={{ mb: 2 }}>
           IMPORTANTE: Asegúrate de incluir el código de la compra al realizar el pago. Código: <strong>Ch-{orderId.slice(-5)}</strong>
          </Typography>

          <Typography sx={{ fontWeight: 900 }}>Subir comprobante</Typography>

          <input
            type="file"
            accept="image/*"
            disabled={loading || submitted}
            onChange={handleFileChange}
          />

          {previewUrl && (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>Vista previa</Typography>

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
            onClick={async () => {
              setErr("");
              setOk("");
              setLoading(true);
              setUploadPct(0);

              try {
                if (!userId) throw new Error("Debes iniciar sesión");
                if (!file) throw new Error("Debes seleccionar una imagen");

                // 1) subir imagen con progreso
                const uploadRes = await uploadVerificationToStorage({
                  orderId,
                  userId,
                  imageFile: file,
                });

                const imageUrl = uploadRes?.url ?? null;

                setLoadingText("Guardando datos del pedido...");

                // 2) guardar compra (usa tus parámetros correctos)
                await createCompraDualFS({
                  userId,
                  compraId: orderId,
                  userInfo: buildUserInfo(),
                  compraData: Array.isArray(itemsToPay) ? itemsToPay : [], 
                  img: imageUrl, 
                });

                setOk("Comprobante enviado correctamente. Estado: PENDIENTE DE VERIFICACIÓN.");
              } catch (e) {
                console.error(e);
                setErr(e?.message || "No se pudo enviar. Inténtalo de nuevo.");
              } finally {
                setLoading(false);
                setLoadingText("Enviando comprobante...");
              }
            }}
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
