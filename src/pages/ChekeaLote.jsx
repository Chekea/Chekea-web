import React, { useState, useEffect } from "react";

import {
  Box, Paper, Typography, TextField, Button,
  Stepper, Step, StepButton, Stack, Chip, MenuItem,
  Divider, Avatar, CircularProgress, Alert, IconButton
} from "@mui/material";

import {
  Inventory2Outlined, AddCircleOutline, ArrowForward, ArrowBack,
  CheckCircleOutline, CloudUploadOutlined, Close, EditOutlined,
  DeleteOutline, WarningAmberOutlined
} from "@mui/icons-material";

import { db, storage } from "../config/firebase";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useEffectiveAuth } from "../state/useEffectiveAuth";
import { normalizePhone } from "../config/chekea";
import { CIUDADES, toPrecio, storefrontFields } from "../domain/product";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const LS_KEY = "chekea_lote_draft_v1";

// Aligera el borrador antes de guardarlo: quita las previsualizaciones de imagen
// en base64 (cover/detalles de cada producto). Esas imágenes pesan mucho y NO
// deben vivir en localStorage (llenaban el almacenamiento del navegador). El
// resto del formulario (nombre, cajas, datos del producto) sí se conserva; si el
// usuario recarga, solo tendrá que volver a elegir las imágenes.
function aligerarBorrador(state) {
  return JSON.parse(
    JSON.stringify(state, (key, value) => {
      // Un objeto de imagen procesada es { dataUrl, width, height }: no lo guardamos.
      if (value && typeof value === "object" && typeof value.dataUrl === "string") {
        return null;
      }
      // Por si quedara alguna cadena base64 suelta.
      if (typeof value === "string" && value.startsWith("data:")) return "";
      return value;
    })
  );
}

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);

// Redimensiona la imagen en el navegador y devuelve un dataURL pequeño (tamaño card).
async function procesarImagen(file, { maxLado = 480, calidad = 0.82, tipo = "image/webp" } = {}) {
  const src = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("No se pudo leer el archivo"));
    r.readAsDataURL(file);
  });

  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("No se pudo cargar la imagen"));
    i.src = src;
  });

  const escala = Math.min(1, maxLado / Math.max(img.width, img.height)); // nunca agranda
  const width = Math.max(1, Math.round(img.width * escala));
  const height = Math.max(1, Math.round(img.height * escala));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(img, 0, 0, width, height);

  let dataUrl = canvas.toDataURL(tipo, calidad);
  if (!dataUrl.startsWith(`data:${tipo}`)) {
    // Safari antiguo no exporta webp -> jpeg
    dataUrl = canvas.toDataURL("image/jpeg", calidad);
  }
  return { dataUrl, width, height };
}

function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(",");
  const mime = (meta.match(/data:(.*?);/) || [])[1] || "image/webp";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const extDeMime = (m) => (m.includes("webp") ? "webp" : m.includes("png") ? "png" : "jpg");

// Sube un blob a Storage y devuelve SOLO el link de descarga.
async function subirBlob(blob, path) {
  const r = ref(storage, path);
  await uploadBytes(r, blob, { contentType: blob.type });
  return await getDownloadURL(r);
}

const emptyProduct = () => ({
  id: uid(),
  nombre: "",
  categoria: "",
  categoriaManual: "",
  cantidad: "",
  precio: "",
  cover: null,     // { dataUrl, width, height } -> imagen del producto
  detalles: null   // { dataUrl, width, height } -> imagen del paquete/pegatina
});

// Campos que faltan para considerar un producto "completo".
const faltantesDeProducto = (p) => {
  const f = [];
  if (!p.nombre?.trim()) f.push("nombre");
  if (!p.cantidad || Number(p.cantidad) <= 0) f.push("cantidad");
  if (!p.cover) f.push("imagen del producto");
  if (!p.detalles) f.push("imagen del paquete");
  if (p.categoria === "Otros" && !p.categoriaManual?.trim()) f.push("categoría");
  return f;
};
const productoCompleto = (p) => faltantesDeProducto(p).length === 0;

const steps = ["Información", "Cajas", "Productos", "Confirmar"];

const categorias = [
  "Moda", "Calzado", "Electrónica", "Telefonía", "Accesorios",
  "Belleza", "Hogar", "Automóvil", "Alimentos", "Otros"
];

/* ------------------------------------------------------------------ */
/* Slot de imagen reutilizable                                       */
/* ------------------------------------------------------------------ */

function SlotImagen({ label, valor, procesando, onSelect, onRemove }) {
  if (valor) {
    return (
      <Box sx={{ position: "relative", width: 96, height: 96, borderRadius: 2, overflow: "hidden", border: "1px solid #eee", flexShrink: 0 }}>
        <img src={valor.dataUrl} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        <IconButton size="small" onClick={onRemove} sx={{ position: "absolute", top: 2, right: 2, bgcolor: "rgba(255,255,255,0.9)", "&:hover": { bgcolor: "#fff" } }}>
          <Close fontSize="small" />
        </IconButton>
      </Box>
    );
  }
  return (
    <Button
      component="label"
      variant="outlined"
      disabled={procesando}
      startIcon={procesando ? <CircularProgress size={16} /> : <CloudUploadOutlined />}
      sx={{ borderRadius: 2, textTransform: "none" }}
    >
      {procesando ? "Procesando..." : label}
      <input
        hidden
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onSelect(f);
        }}
      />
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Componente principal                                              */
/* ------------------------------------------------------------------ */

export default function CrearLoteChekea({ vendedorId }) {
  // El vendedor es quien ha iniciado sesión. De aquí sale su identidad y, si
  // existe, su teléfono; su WhatsApp se confirma en el formulario y se guarda
  // en cada producto para que el comprador le escriba a ÉL (no a Chekea).
  const auth = useEffectiveAuth();
  const sellerUid = vendedorId ?? auth?.user?.uid ?? null;

  const [activeStep, setActiveStep] = useState(0);
  const [shipment, setShipment] = useState({ nombre: "", whatsapp: "", ciudad: "Malabo", cajas: [] });

  // Si la cuenta ya tiene un teléfono, lo proponemos como WhatsApp (editable).
  useEffect(() => {
    const tel = normalizePhone(auth?.user?.phoneNumber);
    if (tel && tel.length >= 8) {
      setShipment((s) => (normalizePhone(s.whatsapp).length >= 8 ? s : { ...s, whatsapp: tel }));
    }
  }, [auth?.user?.phoneNumber]);

  const [selectedBoxId, setSelectedBoxId] = useState(null);
  const [product, setProduct] = useState(emptyProduct());
  const [editingProductId, setEditingProductId] = useState(null);

  const [procesando, setProcesando] = useState({ cover: false, detalles: false });
  const [formError, setFormError] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });

  const [borradorCargado, setBorradorCargado] = useState(false);

  /* ---------- Persistencia (localStorage) ---------- */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.shipment) setShipment(d.shipment);
      if (typeof d.activeStep === "number") setActiveStep(d.activeStep);
      if (d.selectedBoxId) setSelectedBoxId(d.selectedBoxId);
      if (d.product) setProduct(d.product);
      if (d.editingProductId) setEditingProductId(d.editingProductId);
      setBorradorCargado(true);
    } catch (e) {
      /* borrador ilegible: se ignora */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          LS_KEY,
          JSON.stringify(aligerarBorrador({ shipment, activeStep, selectedBoxId, product, editingProductId }))
        );
      } catch (e) {
        /* si el cupo se llena, seguimos funcionando en memoria */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [shipment, activeStep, selectedBoxId, product, editingProductId]);

  const descartarBorrador = () => {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    setShipment({ nombre: "", whatsapp: "", ciudad: "Malabo", cajas: [] });
    setSelectedBoxId(null);
    setProduct(emptyProduct());
    setEditingProductId(null);
    setActiveStep(0);
    setBorradorCargado(false);
    setError("");
  };

  /* ---------- Navegación ---------- */

  const canGoTo = (i) => {
    if (i <= activeStep) return true;
    if (i >= 1 && !shipment.nombre.trim()) return false;
    if (i >= 2 && shipment.cajas.length === 0) return false;
    return true;
  };
  const goToStep = (i) => { if (canGoTo(i)) { setFormError(""); setActiveStep(i); } };

  /* ---------- Cajas ---------- */

  const cajaActual = shipment.cajas.find((c) => c.id === selectedBoxId) || null;
  const nextBoxCode = () => `C${String(shipment.cajas.length + 1).padStart(2, "0")}`;

  const addBox = () => {
    const nueva = { id: uid(), codigo: nextBoxCode(), productos: [] };
    setShipment((s) => ({ ...s, cajas: [...s.cajas, nueva] }));
    setSelectedBoxId(nueva.id);
  };

  const updateBoxCodigo = (id, codigo) =>
    setShipment((s) => ({ ...s, cajas: s.cajas.map((c) => (c.id === id ? { ...c, codigo } : c)) }));

  const deleteBox = (id) => {
    setShipment((s) => ({ ...s, cajas: s.cajas.filter((c) => c.id !== id) }));
    if (selectedBoxId === id) setSelectedBoxId(null);
  };

  const abrirProductosDeCaja = (id) => {
    setSelectedBoxId(id);
    setEditingProductId(null);
    setProduct(emptyProduct());
    setFormError("");
    setActiveStep(2);
  };

  /* ---------- Productos ---------- */

  const onSelectImagen = (campo) => async (file) => {
    setProcesando((s) => ({ ...s, [campo]: true }));
    try {
      const img = await procesarImagen(file);
      setProduct((p) => ({ ...p, [campo]: img }));
    } catch (e) {
      alert("No se pudo procesar la imagen. Intenta con otra.");
    } finally {
      setProcesando((s) => ({ ...s, [campo]: false }));
    }
  };

  const quitarImagen = (campo) => setProduct((p) => ({ ...p, [campo]: null }));

  const startNewProduct = () => {
    setEditingProductId(null);
    setProduct(emptyProduct());
    setFormError("");
  };

  const editProduct = (boxId, prodId) => {
    const c = shipment.cajas.find((x) => x.id === boxId);
    const p = c?.productos.find((x) => x.id === prodId);
    if (!p) return;
    setSelectedBoxId(boxId);
    setProduct({ ...p });
    setEditingProductId(prodId);
    setFormError("");
    setActiveStep(2);
  };

  const saveProductForm = () => {
    if (!selectedBoxId) { setFormError("Primero crea o selecciona una caja."); return; }
    if (!product.nombre.trim()) { setFormError("Escribe al menos el nombre del producto."); return; }
    setFormError("");

    setShipment((s) => ({
      ...s,
      cajas: s.cajas.map((c) => {
        if (c.id !== selectedBoxId) return c;
        if (editingProductId) {
          return {
            ...c,
            productos: c.productos.map((p) =>
              p.id === editingProductId ? { ...product, id: editingProductId } : p
            )
          };
        }
        return { ...c, productos: [...c.productos, { ...product, id: product.id || uid() }] };
      })
    }));

    setEditingProductId(null);
    setProduct(emptyProduct());
  };

  const deleteProduct = (boxId, prodId) => {
    setShipment((s) => ({
      ...s,
      cajas: s.cajas.map((c) =>
        c.id === boxId ? { ...c, productos: c.productos.filter((p) => p.id !== prodId) } : c
      )
    }));
    if (editingProductId === prodId) startNewProduct();
  };

  /* ---------- Validación global + envío ---------- */

  const problemas = (() => {
    const arr = [];
    if (!shipment.nombre.trim()) arr.push({ msg: "Falta el nombre del envío", step: 0 });
    if (normalizePhone(shipment.whatsapp).length < 8)
      arr.push({ msg: "Falta tu WhatsApp (con código de país)", step: 0 });
    if (shipment.cajas.length === 0) arr.push({ msg: "Añade al menos una caja", step: 1 });
    shipment.cajas.forEach((c) => {
      if (!c.codigo.trim())
        arr.push({ msg: "Una caja no tiene código", step: 1, boxId: c.id });
      if (c.productos.length === 0)
        arr.push({ msg: `La caja ${c.codigo || "(sin código)"} no tiene productos`, step: 1, boxId: c.id });
      c.productos.forEach((p, i) => {
        const falt = faltantesDeProducto(p);
        if (falt.length)
          arr.push({
            msg: `${c.codigo || "Caja"} · ${p.nombre || `Producto ${i + 1}`}: falta ${falt.join(", ")}`,
            step: 2,
            boxId: c.id,
            prodId: p.id
          });
      });
    });
    return arr;
  })();

  const irAProblema = (prob) => {
    if (prob.boxId) setSelectedBoxId(prob.boxId);
    if (prob.prodId) {
      const c = shipment.cajas.find((x) => x.id === prob.boxId);
      const p = c?.productos.find((x) => x.id === prob.prodId);
      if (p) { setProduct({ ...p }); setEditingProductId(p.id); }
    } else {
      startNewProduct();
    }
    setActiveStep(prob.step);
  };

  const totalProductos = shipment.cajas.reduce((n, c) => n + c.productos.length, 0);

  const finish = async () => {
    if (problemas.length) { setError("Revisa los avisos antes de enviar."); return; }
    setError("");
    setProgreso({ actual: 0, total: totalProductos });
    setEnviando(true);

    try {
      let hechos = 0;
      for (const caja of shipment.cajas) {
        for (let pi = 0; pi < caja.productos.length; pi++) {
          const p = caja.productos[pi];

          // Firestore genera el id
          const productRef = doc(collection(db, "productos"));
          const id = productRef.id;
          const codigo = `P${String(pi + 1).padStart(3, "0")}`;

          const coverBlob = dataUrlToBlob(p.cover.dataUrl);
          const detBlob = dataUrlToBlob(p.detalles.dataUrl);

          // Sube a Storage y recibe SOLO el link de descarga
          const [coverUrl, detallesUrl] = await Promise.all([
            subirBlob(coverBlob, `productos/${id}/cover-card.${extDeMime(coverBlob.type)}`),
            subirBlob(detBlob, `productos/${id}/detalles-card.${extDeMime(detBlob.type)}`)
          ]);

          const categoriaFinal =
            p.categoria === "Otros" ? p.categoriaManual.trim() : p.categoria;

          await setDoc(productRef, {
            // --- Identidad del vendedor (para escribirle por WhatsApp) ---
            vendedorId: sellerUid,
            Whatsapp: normalizePhone(shipment.whatsapp),

            // --- Campos del ESCAPARATE (para que el producto APAREZCA) ---
            ...storefrontFields({
              titulo: p.nombre.trim(),
              precio: p.precio,
              categoria: categoriaFinal,
              ciudad: shipment.ciudad,
              imagen: coverUrl,
            }),
            Fecha: serverTimestamp(),

            // --- Datos operativos de logística (recepción / almacén) ---
            envio: shipment.nombre.trim(),
            caja: caja.codigo.trim(),
            codigo,
            nombre: p.nombre.trim(),
            categoria: categoriaFinal || null,
            cantidad: Number(p.cantidad) || 0,
            precio: toPrecio(p.precio),

            // Solo el LINK (la imagen vive en Storage), tamaño card
            media: { cover: { variants: { card: coverUrl } } }, // imagen del producto
            detalles: { variants: { card: detallesUrl } },       // imagen del paquete

            estado: "pendiente",
            createdAt: serverTimestamp()
          });

          hechos += 1;
          setProgreso({ actual: hechos, total: totalProductos });
        }
      }

      try { localStorage.removeItem(LS_KEY); } catch (e) {}
      setEnviado(true);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Ocurrió un error al enviar la mercancía.");
    } finally {
      setEnviando(false);
    }
  };

  const resetTodo = () => {
    setShipment({ nombre: "", whatsapp: "", ciudad: "Malabo", cajas: [] });
    setSelectedBoxId(null);
    setProduct(emptyProduct());
    setEditingProductId(null);
    setActiveStep(0);
    setEnviado(false);
    setError("");
    setProgreso({ actual: 0, total: 0 });
    setBorradorCargado(false);
  };

  /* ---------- Render ---------- */

  return (
    <Box sx={{ minHeight: "100vh", background: "#F6F7F9", p: 2 }}>
      <Box maxWidth={480} mx="auto">
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="caption" color="text.secondary">CHEKEA</Typography>
          {(shipment.nombre || shipment.cajas.length > 0) && !enviado && (
            <Chip size="small" label="Borrador guardado" variant="outlined" />
          )}
        </Stack>

        <Typography fontWeight={700} fontSize={30} mt={1}>Nueva mercancía</Typography>
        <Typography color="text.secondary" mb={3}>
          Organiza tus productos antes de enviarlos al almacén.
        </Typography>

        {borradorCargado && !enviado && (
          <Alert
            severity="info"
            sx={{ mb: 3, borderRadius: 3 }}
            action={<Button color="inherit" size="small" onClick={descartarBorrador}>Descartar</Button>}
          >
            Recuperamos tu borrador anterior.
          </Alert>
        )}

        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {steps.map((label, i) => (
            <Step key={label}>
              <StepButton onClick={() => goToStep(i)} disabled={!canGoTo(i)}>{label}</StepButton>
            </Step>
          ))}
        </Stepper>

        {/* PASO 1 — Información */}
        {activeStep === 0 && (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            <Avatar sx={{ width: 60, height: 60, mb: 3, bgcolor: "#111" }}>
              <Inventory2Outlined />
            </Avatar>
            <Typography fontWeight={700} fontSize={22} mb={2}>Datos del envío</Typography>
            <TextField
              fullWidth
              label="Nombre del envío (ej.: Productos enero)"
              value={shipment.nombre}
              onChange={(e) => setShipment({ ...shipment, nombre: e.target.value })}
            />
            <TextField
              fullWidth
              type="tel"
              label="Tu WhatsApp (con código de país, ej.: 240222123456)"
              helperText="Los compradores te escribirán a este número por cada producto."
              value={shipment.whatsapp}
              onChange={(e) => setShipment({ ...shipment, whatsapp: e.target.value })}
              sx={{ mt: 2 }}
            />
            <TextField
              fullWidth
              select
              label="Ciudad donde está la mercancía"
              value={shipment.ciudad}
              onChange={(e) => setShipment({ ...shipment, ciudad: e.target.value })}
              sx={{ mt: 2 }}
            >
              {CIUDADES.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
            <Button
              fullWidth variant="contained"
              disabled={!shipment.nombre.trim() || normalizePhone(shipment.whatsapp).length < 8}
              sx={{ mt: 4, borderRadius: 3, py: 1.5, bgcolor: "#111" }}
              endIcon={<ArrowForward />}
              onClick={() => setActiveStep(1)}
            >
              Continuar
            </Button>
          </Paper>
        )}

        {/* PASO 2 — Cajas */}
        {activeStep === 1 && (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            <Typography fontWeight={700} fontSize={22}>Tus cajas</Typography>
            <Typography color="text.secondary" mb={3}>
              Cada caja tiene un código y contiene sus productos.
            </Typography>

            {shipment.cajas.length === 0 && (
              <Alert severity="info" sx={{ mb: 2, borderRadius: 3 }}>
                Aún no tienes cajas. Añade la primera para empezar.
              </Alert>
            )}

            <Stack spacing={2}>
              {shipment.cajas.map((c) => {
                const incompletos = c.productos.filter((p) => !productoCompleto(p)).length;
                return (
                  <Box key={c.id} sx={{ p: 2, border: "1px solid #eee", borderRadius: 3 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        size="small" label="Código caja" value={c.codigo}
                        onChange={(e) => updateBoxCodigo(c.id, e.target.value)}
                        sx={{ flex: 1 }}
                      />
                      <IconButton onClick={() => deleteBox(c.id)}><DeleteOutline /></IconButton>
                    </Stack>

                    <Stack direction="row" spacing={1} alignItems="center" mt={1.5} flexWrap="wrap">
                      <Chip size="small" label={`${c.productos.length} producto(s)`} />
                      {incompletos > 0 && (
                        <Chip size="small" color="warning" icon={<WarningAmberOutlined />} label={`${incompletos} incompleto(s)`} />
                      )}
                    </Stack>

                    <Button
                      fullWidth variant="outlined" sx={{ mt: 2, borderRadius: 2 }}
                      startIcon={<AddCircleOutline />}
                      onClick={() => abrirProductosDeCaja(c.id)}
                    >
                      Ver / añadir productos
                    </Button>
                  </Box>
                );
              })}
            </Stack>

            <Button fullWidth variant="text" sx={{ mt: 2 }} startIcon={<AddCircleOutline />} onClick={addBox}>
              Añadir caja
            </Button>

            <Divider sx={{ my: 3 }} />

            <Stack direction="row" spacing={2}>
              <Button fullWidth variant="outlined" startIcon={<ArrowBack />} sx={{ borderRadius: 3 }} onClick={() => setActiveStep(0)}>
                Atrás
              </Button>
              <Button
                fullWidth variant="contained"
                disabled={shipment.cajas.length === 0}
                sx={{ borderRadius: 3, bgcolor: "#111" }}
                endIcon={<ArrowForward />}
                onClick={() => {
                  if (!selectedBoxId && shipment.cajas[0]) setSelectedBoxId(shipment.cajas[0].id);
                  startNewProduct();
                  setActiveStep(2);
                }}
              >
                Continuar
              </Button>
            </Stack>
          </Paper>
        )}

        {/* PASO 3 — Productos */}
        {activeStep === 2 && (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            {!cajaActual ? (
              <>
                <Alert severity="warning" sx={{ borderRadius: 3, mb: 2 }}>
                  Selecciona una caja para añadir productos.
                </Alert>
                <Button fullWidth variant="contained" sx={{ bgcolor: "#111", borderRadius: 3 }} startIcon={<ArrowBack />} onClick={() => setActiveStep(1)}>
                  Ir a cajas
                </Button>
              </>
            ) : (
              <>
                <TextField
                  select fullWidth size="small" label="Caja"
                  value={selectedBoxId || ""}
                  onChange={(e) => { setSelectedBoxId(e.target.value); startNewProduct(); }}
                  sx={{ mb: 3 }}
                >
                  {shipment.cajas.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.codigo || "Caja sin código"} · {c.productos.length} prod.
                    </MenuItem>
                  ))}
                </TextField>

                <Typography fontWeight={700} fontSize={20} mb={0.5}>
                  {editingProductId ? "Editar producto" : "Nuevo producto"}
                </Typography>
                <Chip
                  size="small"
                  label={`Pegatina P${String(
                    (editingProductId
                      ? cajaActual.productos.findIndex((p) => p.id === editingProductId)
                      : cajaActual.productos.length) + 1
                  ).padStart(3, "0")}`}
                  sx={{ mb: 2 }}
                />

                <Stack spacing={2}>
                  <TextField label="Nombre producto" value={product.nombre}
                    onChange={(e) => setProduct({ ...product, nombre: e.target.value })} />

                  <TextField select label="Categoría" value={product.categoria}
                    onChange={(e) => setProduct({ ...product, categoria: e.target.value })}>
                    {categorias.map((cat) => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
                  </TextField>

                  {product.categoria === "Otros" && (
                    <TextField label="Escribe categoría" value={product.categoriaManual}
                      onChange={(e) => setProduct({ ...product, categoriaManual: e.target.value })} />
                  )}

                  <TextField type="number" label="Cantidad" value={product.cantidad}
                    onChange={(e) => setProduct({ ...product, cantidad: e.target.value })} />

                  <TextField label="Precio referencia FCFA" value={product.precio}
                    onChange={(e) => setProduct({ ...product, precio: e.target.value })} />

                  <Box>
                    <Typography variant="body2" color="text.secondary" mb={1}>Imagen del producto</Typography>
                    <SlotImagen label="Subir imagen" valor={product.cover} procesando={procesando.cover}
                      onSelect={onSelectImagen("cover")} onRemove={() => quitarImagen("cover")} />
                  </Box>

                  <Box>
                    <Typography variant="body2" color="text.secondary" mb={1}>Imagen del paquete (con pegatina)</Typography>
                    <SlotImagen label="Subir imagen" valor={product.detalles} procesando={procesando.detalles}
                      onSelect={onSelectImagen("detalles")} onRemove={() => quitarImagen("detalles")} />
                  </Box>

                  {formError && <Alert severity="error" sx={{ borderRadius: 2 }}>{formError}</Alert>}

                  <Stack direction="row" spacing={1}>
                    <Button
                      fullWidth variant="contained"
                      startIcon={editingProductId ? <CheckCircleOutline /> : <AddCircleOutline />}
                      onClick={saveProductForm}
                      sx={{ background: "#111", borderRadius: 3 }}
                    >
                      {editingProductId ? "Actualizar" : "Guardar producto"}
                    </Button>
                    {editingProductId && (
                      <Button variant="outlined" sx={{ borderRadius: 3 }} onClick={startNewProduct}>Cancelar</Button>
                    )}
                  </Stack>
                </Stack>

                <Divider sx={{ my: 3 }} />

                <Typography fontWeight={600} mb={1}>Productos en esta caja</Typography>

                {cajaActual.productos.length === 0 && (
                  <Typography variant="body2" color="text.secondary">Todavía no hay productos.</Typography>
                )}

                <Stack spacing={1.5}>
                  {cajaActual.productos.map((p, i) => {
                    const completo = productoCompleto(p);
                    return (
                      <Box key={p.id} sx={{ display: "flex", gap: 1.5, alignItems: "center", p: 1, border: "1px solid #eee", borderRadius: 2 }}>
                        <Box sx={{ width: 48, height: 48, borderRadius: 1.5, overflow: "hidden", bgcolor: "#f2f2f2", flexShrink: 0 }}>
                          {p.cover && <img src={p.cover.dataUrl} alt={p.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography noWrap fontWeight={600}>
                            P{String(i + 1).padStart(3, "0")} · {p.nombre || "Sin nombre"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {p.cantidad ? `${p.cantidad} u.` : "sin cantidad"}
                            {p.categoria ? ` · ${p.categoria === "Otros" ? p.categoriaManual : p.categoria}` : ""}
                          </Typography>
                          {!completo && (
                            <Chip size="small" color="warning" icon={<WarningAmberOutlined />} label="Incompleto" sx={{ mt: 0.5, height: 22 }} />
                          )}
                        </Box>
                        <IconButton size="small" onClick={() => editProduct(cajaActual.id, p.id)}><EditOutlined fontSize="small" /></IconButton>
                        <IconButton size="small" onClick={() => deleteProduct(cajaActual.id, p.id)}><DeleteOutline fontSize="small" /></IconButton>
                      </Box>
                    );
                  })}
                </Stack>

                <Divider sx={{ my: 3 }} />

                <Stack direction="row" spacing={2}>
                  <Button fullWidth variant="outlined" startIcon={<ArrowBack />} sx={{ borderRadius: 3 }} onClick={() => setActiveStep(1)}>
                    Cajas
                  </Button>
                  <Button fullWidth variant="contained" endIcon={<ArrowForward />} sx={{ borderRadius: 3, bgcolor: "#111" }} onClick={() => setActiveStep(3)}>
                    Revisar
                  </Button>
                </Stack>
              </>
            )}
          </Paper>
        )}

        {/* PASO 4 — Confirmar */}
        {activeStep === 3 && (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            {enviado ? (
              <>
                <CheckCircleOutline sx={{ fontSize: 50, mb: 2, color: "success.main" }} />
                <Typography fontWeight={700} fontSize={24}>¡Enviado a Chekea!</Typography>
                <Typography color="text.secondary" mb={3}>
                  Se guardaron {progreso.total} producto(s) correctamente.
                </Typography>
                <Button fullWidth variant="contained" sx={{ background: "#111", borderRadius: 3, py: 1.5 }} onClick={resetTodo}>
                  Crear otra mercancía
                </Button>
              </>
            ) : (
              <>
                <Typography fontWeight={700} fontSize={24}>Revisa tu mercancía</Typography>
                <Typography color="text.secondary" mb={3}>
                  {shipment.cajas.length} caja(s) · {totalProductos} producto(s)
                </Typography>

                {problemas.length > 0 && (
                  <Alert severity="warning" sx={{ borderRadius: 3, mb: 2 }}>
                    <Typography fontWeight={600} mb={1}>Hay {problemas.length} cosa(s) por corregir:</Typography>
                    <Stack spacing={0.5}>
                      {problemas.map((prob, i) => (
                        <Stack key={i} direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                          <Typography variant="body2">• {prob.msg}</Typography>
                          <Button size="small" onClick={() => irAProblema(prob)}>Arreglar</Button>
                        </Stack>
                      ))}
                    </Stack>
                  </Alert>
                )}

                {shipment.cajas.map((caja) => (
                  <Box key={caja.id} sx={{ p: 2, background: "#f5f5f5", borderRadius: 3, mb: 2 }}>
                    <Typography fontWeight={700} mb={1}>📦 {caja.codigo || "Sin código"}</Typography>
                    <Stack spacing={1}>
                      {caja.productos.map((p, i) => {
                        const completo = productoCompleto(p);
                        return (
                          <Stack key={p.id} direction="row" spacing={1.5} alignItems="center">
                            <Box sx={{ width: 40, height: 40, borderRadius: 1, overflow: "hidden", bgcolor: "#e6e6e6", flexShrink: 0 }}>
                              {p.cover && <img src={p.cover.dataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography noWrap variant="body2">
                                🏷️ P{String(i + 1).padStart(3, "0")} · {p.nombre || "Sin nombre"} · {p.cantidad || 0} u.
                              </Typography>
                              {!completo && (
                                <Typography variant="caption" color="warning.main">
                                  Incompleto: falta {faltantesDeProducto(p).join(", ")}
                                </Typography>
                              )}
                            </Box>
                            <Button size="small" onClick={() => editProduct(caja.id, p.id)}>Editar</Button>
                          </Stack>
                        );
                      })}
                      {caja.productos.length === 0 && (
                        <Typography variant="caption" color="text.secondary">Sin productos</Typography>
                      )}
                    </Stack>
                  </Box>
                ))}

                {error && <Alert severity="error" sx={{ borderRadius: 3, mb: 2 }}>{error}</Alert>}

                <Stack direction="row" spacing={2}>
                  <Button fullWidth variant="outlined" startIcon={<ArrowBack />} sx={{ borderRadius: 3 }} disabled={enviando} onClick={() => setActiveStep(2)}>
                    Atrás
                  </Button>
                  <Button
                    fullWidth variant="contained"
                    disabled={enviando || problemas.length > 0 || totalProductos === 0}
                    startIcon={enviando ? <CircularProgress size={18} color="inherit" /> : null}
                    sx={{ background: "#111", borderRadius: 3, py: 1.5 }}
                    onClick={finish}
                  >
                    {enviando ? `Enviando ${progreso.actual}/${progreso.total}...` : "Enviar a Chekea"}
                  </Button>
                </Stack>
              </>
            )}
          </Paper>
        )}
      </Box>
    </Box>
  );
}