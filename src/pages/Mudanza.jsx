// src/pages/Mudanza.jsx
// Chekea Logistics — Mudanza y transporte.
// El cliente elige el tipo de vehículo (pequeño o grande) y los datos del
// traslado; al final se abre WhatsApp con la petición ya escrita. La
// conversación continúa en WhatsApp, con experiencia nativa dentro de la app.

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
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import { openChekeaWhatsApp } from "../config/chekea";

const VEHICULOS = [
  {
    id: "pequeno",
    titulo: "Coche pequeño",
    desc: "Pocas cajas o cosas ligeras",
    Icon: DirectionsCarRoundedIcon,
  },
  {
    id: "grande",
    titulo: "Coche grande",
    desc: "Mudanza completa o muebles",
    Icon: LocalShippingRoundedIcon,
  },
];

export default function Mudanza() {
  const nav = useNavigate();

  const [vehiculo, setVehiculo] = useState("");
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [fecha, setFecha] = useState("");
  const [detalle, setDetalle] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");

  const puedeEnviar = useMemo(() => !!vehiculo, [vehiculo]);

  const enviar = () => {
    const v = VEHICULOS.find((x) => x.id === vehiculo);
    const L = [];
    L.push("*Nueva petición de mudanza/transporte — Chekea*");
    if (v) L.push(`Vehículo: ${v.titulo} (${v.desc})`);
    if (origen.trim() || destino.trim())
      L.push(`Ruta: ${origen.trim() || "?"} → ${destino.trim() || "?"}`);
    if (fecha.trim()) L.push(`Fecha: ${fecha.trim()}`);
    if (detalle.trim()) L.push(`Qué transportar: ${detalle.trim()}`);
    if (nombre.trim()) L.push(`Nombre: ${nombre.trim()}`);
    if (telefono.trim()) L.push(`Teléfono: ${telefono.trim()}`);
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
        <Typography sx={{ fontWeight: 900, fontSize: 18 }}>Mudanza y transporte</Typography>
      </Box>

      <Container maxWidth="sm" sx={{ px: { xs: 1.8, sm: 2.2 }, py: 2, pb: 5 }}>
        <Typography sx={{ color: "#676B7D", fontSize: 14, mb: 2 }}>
          Elige el vehículo y cuéntanos el traslado. Al final se abre WhatsApp
          con tu petición lista para confirmar.
        </Typography>

        {/* Vehículo */}
        <Typography sx={{ fontWeight: 900, fontSize: 15, mb: 1 }}>Tipo de vehículo</Typography>
        <Stack spacing={1.2} sx={{ mb: 2.5 }}>
          {VEHICULOS.map(({ id, titulo, desc, Icon }) => {
            const on = vehiculo === id;
            return (
              <Box
                key={id}
                onClick={() => setVehiculo(id)}
                role="button"
                sx={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  borderRadius: 3,
                  p: 1.6,
                  border: on ? "2px solid #ff5f00" : "1px solid #E7E9F2",
                  bgcolor: on ? "#FFF3E8" : "#FFFFFF",
                  transition: "all .12s ease",
                }}
              >
                <Box
                  sx={{
                    width: 46,
                    height: 46,
                    borderRadius: 2,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: on ? "#FFE2C2" : "#F1F3F9",
                    color: on ? "#C36B14" : "#5A5E6C",
                    flexShrink: 0,
                  }}
                >
                  <Icon />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 900, fontSize: 15, color: "#11152C" }}>
                    {titulo}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: "#767989" }}>{desc}</Typography>
                </Box>
              </Box>
            );
          })}
        </Stack>

        {/* Ruta y detalles */}
        <Typography sx={{ fontWeight: 900, fontSize: 15, mb: 1 }}>Detalles</Typography>
        <Stack spacing={1.4} sx={{ mb: 3 }}>
          <TextField size="small" label="Desde (origen)" value={origen} onChange={(e) => setOrigen(e.target.value)} />
          <TextField size="small" label="Hasta (destino)" value={destino} onChange={(e) => setDestino(e.target.value)} />
          <TextField size="small" label="Fecha aproximada" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <TextField
            size="small"
            label="¿Qué hay que transportar?"
            multiline
            minRows={2}
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
          />
          <TextField size="small" label="Nombre (opcional)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <TextField size="small" type="tel" label="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </Stack>

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
          Se abrirá WhatsApp con tu petición ya escrita para confirmarla.
        </Typography>
      </Container>
    </Box>
  );
}
