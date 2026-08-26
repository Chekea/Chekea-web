// src/pages/EnvioChina.jsx
// Chekea Logistics — Envíos China → Guinea Ecuatorial.
// El cliente elige destino (precio/kg) y tipo de carga (normal o avión), deja su
// WhatsApp, y COPIA la dirección de envío (que incluye su número como referencia
// para identificar su paquete cuando llegue al almacén).

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Button,
  IconButton,
  TextField,
  Stack,
  Alert,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import FlightTakeoffRoundedIcon from "@mui/icons-material/FlightTakeoffRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { openChekeaWhatsApp } from "../config/chekea";

const DESTINOS = [
  { id: "malabo", label: "China → Malabo", precioKg: 11500 },
  { id: "bata", label: "China → Bata", precioKg: 13500 },
];

// Carga con polvo, batería o líquidos: va por avión y cuesta más por kg.
const PRECIO_AVION_KG = 25000;

// Datos FIJOS del almacén en China. El nombre del destinatario cambia según el
// destino (ChMa = Malabo, ChBa = Bata) y el número del cliente va DELANTE.
const TEL_ALMACEN = "18171337454";
const DIR_FISICA = "广东东莞市石碣镇崇焕中路111号(马拉博仓库)";

function fcfa(n) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${new Intl.NumberFormat("es-ES").format(Math.round(n))} FCFA`;
}

function digits(s) {
  return String(s || "").replace(/\D/g, "");
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function OptionCard({ selected, onClick, children }) {
  return (
    <Box
      onClick={onClick}
      role="button"
      sx={{
        cursor: "pointer",
        borderRadius: 3,
        px: 1.6,
        py: 1.4,
        textAlign: "center",
        fontWeight: 800,
        fontSize: 13.5,
        border: selected ? "2px solid #ff5f00" : "1px solid #E7E9F2",
        bgcolor: selected ? "#FFF3E8" : "#FFFFFF",
        color: selected ? "#C36B14" : "#3A3E4C",
        transition: "all .12s ease",
      }}
    >
      {children}
    </Box>
  );
}

export default function EnvioChina() {
  const nav = useNavigate();

  const [destino, setDestino] = useState("");
  const [tipoCarga, setTipoCarga] = useState(""); // "normal" | "especial"
  const [whatsapp, setWhatsapp] = useState("");
  const [copiado, setCopiado] = useState(false);

  const dest = DESTINOS.find((d) => d.id === destino) || null;

  const precioKg = useMemo(() => {
    if (tipoCarga === "especial") return PRECIO_AVION_KG;
    return dest ? dest.precioKg : null;
  }, [tipoCarga, dest]);

  const waOk = digits(whatsapp).length >= 8;

  // Nombre del destinatario según destino: ChMa (Malabo) o ChBa (Bata).
  const nombreDest = destino === "bata" ? "ChBa" : "ChMa";
  const destOk = !!destino;
  const puedeGenerar = waOk && destOk;

  // Dirección que el cliente copiará: su número DELANTE + ChMa/ChBa + almacén.
  const direccionTexto = useMemo(
    () => `${nombreDest} ${TEL_ALMACEN} ${DIR_FISICA} + ${whatsapp}`,
    [whatsapp, nombreDest]
  );

  const copiar = async () => {
    if (!puedeGenerar) return;
    const ok = await copyText(direccionTexto);
    if (ok) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  const avisar = () => {
    const L = [];
    L.push("Hola!! quiero hacer un Envio\n");
    if (dest) L.push(`Ruta: ${dest.label}\n`);
    L.push(
      `Tipo de carga: ${
        tipoCarga === "especial"
          ? "Contiene polvo, batería o líquidos (por avión)"
          : "Carga normal"
      }`
    );
    if (precioKg) L.push(`Precio: ${fcfa(precioKg)}/kg`);
    openChekeaWhatsApp(L.join("\n"));
  };

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#F7F8FC" }}>
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "#FFFFFF",
          borderBottom: "1px solid #EEF0F6",
          px: 1,
          py: 1,
          pt: "calc(env(safe-area-inset-top) + 8px)",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <IconButton onClick={() => nav(-1)} aria-label="Volver">
          <ArrowBackRoundedIcon />
        </IconButton>
        <Typography sx={{ fontWeight: 900, fontSize: 18 }}>Envíos China → Guinea</Typography>
      </Box>

      <Container maxWidth="sm" sx={{ px: { xs: 1.8, sm: 2.2 }, py: 2, pb: 5 }}>
        {/* Destino */}
        <Typography sx={{ fontWeight: 900, fontSize: 15, mb: 1 }}>Destino</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.1 }}>
          {DESTINOS.map((d) => (
            <OptionCard key={d.id} selected={destino === d.id} onClick={() => setDestino(d.id)}>
              {d.label}
              <Box sx={{ mt: 0.4, fontSize: 12, fontWeight: 700, color: "#16845A" }}>
                {fcfa(d.precioKg)}/kg
              </Box>
            </OptionCard>
          ))}
        </Box>

        {/* Tipo de carga */}
        <Typography sx={{ fontWeight: 900, fontSize: 15, mb: 1, mt: 2 }}>Tipo de carga</Typography>
        <Stack spacing={1.1}>
          <OptionCard selected={tipoCarga === "normal"} onClick={() => setTipoCarga("normal")}>
            <LocalShippingRoundedIcon sx={{ fontSize: 18, mb: 0.3, display: "block", mx: "auto" }} />
            Carga normal
          </OptionCard>
          <OptionCard selected={tipoCarga === "especial"} onClick={() => setTipoCarga("especial")}>
            <FlightTakeoffRoundedIcon sx={{ fontSize: 18, mb: 0.3, display: "block", mx: "auto" }} />
            Contiene polvo, batería o líquidos (por avión) · {fcfa(PRECIO_AVION_KG)}/kg
          </OptionCard>
        </Stack>

        {/* Precio vigente */}
        {precioKg ? (
          <Box sx={{ mt: 1.5, p: 1.6, borderRadius: 3, bgcolor: "#0e3a53", color: "#fff" }}>
            <Typography sx={{ fontSize: 13, opacity: 0.85 }}>Precio de envío</Typography>
            <Typography sx={{ fontWeight: 950, fontSize: 22 }}>{fcfa(precioKg)}/kg</Typography>
          </Box>
        ) : null}

        {/* Avisos IMPORTANTES */}
        <Alert severity="warning" sx={{ borderRadius: 3, mt: 2, mb: 1.5 }}>
          Los teléfonos, iPads y ordenadores <b>no se envían por avión</b>.
        </Alert>
        <Alert severity="error" sx={{ borderRadius: 3, mb: 2 }}>
          Si tu paquete contiene <b>polvo, batería o líquidos</b> y no lo indicas,
          podrías <b>perder tu paquete</b>. Avísanos siempre eligiendo el tipo de carga.
        </Alert>

        {/* Número de WhatsApp (obligatorio) */}
        <Typography sx={{ fontWeight: 900, fontSize: 15, mb: 1 }}>Tu número de WhatsApp</Typography>
        <TextField
          fullWidth
          size="small"
          type="tel"
          placeholder="Ej.: 240 222 123 456"
          helperText="Lo añadimos a tu dirección para identificar tu paquete cuando llegue."
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          sx={{ mb: 2 }}
        />

        {/* Dirección para enviar el paquete (copiable solo con el número escrito) */}
        <Typography sx={{ fontWeight: 900, fontSize: 15, mb: 1 }}>
          Dirección para enviar tu paquete
        </Typography>

        {puedeGenerar ? (
          <Box sx={{ border: "1px solid #E7E9F2", borderRadius: 3, overflow: "hidden", mb: 1 }}>
            <Box
              sx={{
                p: 1.6,
                bgcolor: "#F7F8FC",
                fontFamily: "monospace",
                fontSize: 13.5,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                color: "#11152C",
              }}
            >
              {direccionTexto} 
            </Box>
            <Button
              fullWidth
              onClick={copiar}
              startIcon={copiado ? <CheckRoundedIcon /> : <ContentCopyRoundedIcon />}
              sx={{
                borderRadius: 0,
                py: 1.3,
                fontWeight: 900,
                color: "#fff",
                bgcolor: copiado ? "#16845A" : "#ff5f00",
                "&:hover": { bgcolor: copiado ? "#136e4b" : "#e85700" },
              }}
            >
              {copiado ? "¡Dirección copiada!" : "Copiar dirección"}
            </Button>
          </Box>
        ) : (
          <Alert severity="info" sx={{ borderRadius: 3, mb: 1 }}>
            {!destOk
              ? "Elige primero el destino (Malabo o Bata) para generar tu dirección."
              : "Escribe tu número de WhatsApp arriba para generar tu dirección de envío."}
          </Alert>
        )}

        {/* Avisar por WhatsApp (opcional) */}
        <Button
          fullWidth
          onClick={avisar}
          disabled={!destino || !tipoCarga || !waOk}
          startIcon={<WhatsAppIcon />}
          variant="outlined"
          sx={{
            mt: 2,
            borderRadius: 3,
            py: 1.2,
            fontWeight: 800,
            textTransform: "none",
            borderColor: "#25D366",
            color: "#128C3E",
            "&:hover": { borderColor: "#1FBE5A", bgcolor: "rgba(37,211,102,.06)" },
          }}
        >
          Avisarnos por WhatsApp que vas a enviar
        </Button>
      </Container>
    </Box>
  );
}