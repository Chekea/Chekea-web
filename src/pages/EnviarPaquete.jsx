// src/pages/EnviarPaquete.jsx
// Chekea Logistics — Enviar un paquete.
// El cliente arma su pedido DENTRO de la app (ruta, tipo de paquete, lista de
// contenido y contacto) y al final se abre WhatsApp con el mensaje ya escrito.
// Toda la conversación sigue en WhatsApp, pero la experiencia se siente nativa.

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  IconButton,
  TextField,
  Chip,
  Stack,
  Divider,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import { openChekeaWhatsApp } from "../config/chekea";

const RUTAS = [
  "Dentro de Malabo",
  "Malabo → Bata",
];

const TIPOS = [
  "Documentos",
  "Caja pequeña",
  "Caja mediana",
  "Frágil",
  "Otro",
];

// Tarjeta de opción seleccionable (mismo lenguaje visual en toda la app).
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

export default function EnviarPaquete() {
  const nav = useNavigate();

  const [ruta, setRuta] = useState("");
  const [entrega, setEntrega] = useState("domicilio"); // domicilio | recogida
  const [tipos, setTipos] = useState([]); // varios
  const [items, setItems] = useState([]); // lista de contenido
  const [itemText, setItemText] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [zona, setZona] = useState("");
  const [notas, setNotas] = useState("");

  const toggleTipo = (t) =>
    setTipos((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const addItem = () => {
    const v = itemText.trim();
    if (!v) return;
    setItems((prev) => [...prev, v]);
    setItemText("");
  };

  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const puedeEnviar = useMemo(
    () => ruta && (items.length > 0 || tipos.length > 0),
    [ruta, items.length, tipos.length]
  );

  const enviar = () => {
    const L = [];
    L.push("*Nueva petición de envío — Chekea*");
    if (ruta) L.push(`Ruta: ${ruta}`);
    L.push(`Entrega: ${entrega === "domicilio" ? "A domicilio" : "Recogida en punto"}`);
    if (tipos.length) L.push(`Tipo de paquete: ${tipos.join(", ")}`);
    if (items.length) {
      L.push("Contenido:");
      items.forEach((it) => L.push(`- ${it}`));
    }
    if (nombre.trim()) L.push(`Nombre: ${nombre.trim()}`);
    if (telefono.trim()) L.push(`Teléfono: ${telefono.trim()}`);
    if (zona.trim()) L.push(`Zona/Dirección: ${zona.trim()}`);
    if (notas.trim()) L.push(`Notas: ${notas.trim()}`);
    openChekeaWhatsApp(L.join("\n"));
  };

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#F7F8FC" }}>
      {/* Encabezado propio: da sensación de pantalla nativa */}
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
        <Typography sx={{ fontWeight: 900, fontSize: 18 }}>Enviar un paquete</Typography>
      </Box>

      <Container maxWidth="sm" sx={{ px: { xs: 1.8, sm: 2.2 }, py: 2, pb: 5 }}>
        <Typography sx={{ color: "#676B7D", fontSize: 14, mb: 1.5 }}>
          Completa tu pedido y te llevamos el paquete. Al final se abre WhatsApp
          con todo listo para confirmar.
        </Typography>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.6,
            bgcolor: "#EEF9F2",
            color: "#16845A",
            fontWeight: 800,
            fontSize: 13,
            px: 1.4,
            py: 0.9,
            borderRadius: 2,
            mb: 2.5,
          }}
        >
          Envíos desde 500 FCFA · según la distancia
        </Box>

        {/* Ruta */}
        <Typography sx={{ fontWeight: 900, fontSize: 15, mb: 1 }}>¿A dónde va?</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.1, mb: 2.5 }}>
          {RUTAS.map((r) => (
            <OptionCard key={r} selected={ruta === r} onClick={() => setRuta(r)}>
              {r}
            </OptionCard>
          ))}
        </Box>

        {/* Entrega */}
        <Typography sx={{ fontWeight: 900, fontSize: 15, mb: 1 }}>Entrega</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.1, mb: 2.5 }}>
          <OptionCard selected={entrega === "domicilio"} onClick={() => setEntrega("domicilio")}>
            <HomeRoundedIcon sx={{ fontSize: 18, mb: 0.3, display: "block", mx: "auto" }} />
            A domicilio
          </OptionCard>
          <OptionCard selected={entrega === "recogida"} onClick={() => setEntrega("recogida")}>
            <StorefrontRoundedIcon sx={{ fontSize: 18, mb: 0.3, display: "block", mx: "auto" }} />
            Recogida en punto
          </OptionCard>
        </Box>

        {/* Tipo de paquete */}
        <Typography sx={{ fontWeight: 900, fontSize: 15, mb: 1 }}>Tipo de paquete</Typography>
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2.5 }}>
          {TIPOS.map((t) => (
            <Chip
              key={t}
              label={t}
              onClick={() => toggleTipo(t)}
              variant={tipos.includes(t) ? "filled" : "outlined"}
              sx={{
                fontWeight: 700,
                bgcolor: tipos.includes(t) ? "#ff5f00" : "transparent",
                color: tipos.includes(t) ? "#fff" : "#3A3E4C",
                borderColor: "#E0E2EC",
                "&:hover": { bgcolor: tipos.includes(t) ? "#e85700" : "rgba(0,0,0,.04)" },
              }}
            />
          ))}
               <Typography sx={{  color: "#8A8D9A", fontSize: 12, mt: 1 }}>
          Recuerda que para cosas grandes es mejor pedir un coche.
        </Typography>
        
        </Stack>
          

        {/* Lista de contenido */}
        <Typography sx={{ fontWeight: 900, fontSize: 15, mb: 1 }}>¿Qué envías?</Typography>
        <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Ej.: 2 pares de zapatos"
            value={itemText}
            onChange={(e) => setItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
          />
          <Button
            onClick={addItem}
            variant="contained"
            sx={{ minWidth: 44, borderRadius: 2, bgcolor: "#111", px: 0 }}
            aria-label="Añadir"
          >
            <AddRoundedIcon />
          </Button>
        </Box>
        {items.length > 0 && (
          <Paper elevation={0} sx={{ border: "1px solid #EEF0F6", borderRadius: 2, mb: 2.5 }}>
            {items.map((it, i) => (
              <Box key={i}>
                <Box sx={{ display: "flex", alignItems: "center", px: 1.4, py: 1 }}>
                  <Typography sx={{ flex: 1, fontSize: 14 }}>{it}</Typography>
                  <IconButton size="small" onClick={() => removeItem(i)} aria-label="Quitar">
                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>
                {i < items.length - 1 && <Divider />}
              </Box>
            ))}
          </Paper>
        )}

        {/* Contacto */}
        <Typography sx={{ fontWeight: 900, fontSize: 15, mb: 1, mt: 1 }}>
          Tus datos (opcional)
        </Typography>
        <Stack spacing={1.4} sx={{ mb: 3 }}>
          <TextField size="small" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <TextField size="small" type="tel" label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          <TextField size="small" label="Zona o dirección" value={zona} onChange={(e) => setZona(e.target.value)} />
          <TextField size="small" label="Notas" multiline minRows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </Stack>

        {/* Enviar petición */}
        <Button
          fullWidth
          onClick={enviar}
          disabled={!puedeEnviar}
          startIcon={<WhatsAppIcon />}
          sx={{
            bgcolor: "#25D366",
            color: "#fff",
            borderRadius: 3,
            py: 1.4,
            fontWeight: 900,
            fontSize: 15.5,
            boxShadow: "0 10px 22px rgba(37,211,102,.32)",
            "&:hover": { bgcolor: "#1FBE5A" },
            "&.Mui-disabled": { bgcolor: "#CDEBD8", color: "#fff" },
          }}
        >
          Mandar petición
        </Button>
        <Typography sx={{ textAlign: "center", color: "#8A8D9A", fontSize: 12, mt: 1 }}>
          Se abrirá WhatsApp con tu pedido ya escrito para confirmarlo.
        </Typography>
      </Container>
    </Box>
  );
}