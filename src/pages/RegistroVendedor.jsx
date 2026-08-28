// src/pages/RegistroVendedor.jsx
// Registro de vendedores en Chekea (enlace independiente que se envía al cliente).
// Pide nombre, país, WhatsApp, email, contraseña y qué va a vender. Crea la cuenta
// y guarda los datos; al terminar muestra "Cuenta creada con éxito".

import React, { useState } from "react";
import {
  Container,
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  MenuItem,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import Header from "../components/header";
import { useAuth } from "../state/AuthContext";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";

const PAISES = [
  "Guinea Ecuatorial",
  "Camerún",
  "Gabón",
  "Nigeria",
  "China",
  "España",
  "Otro",
];

export default function RegistroVendedor() {
  const auth = useAuth();
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [pais, setPais] = useState("Guinea Ecuatorial");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [queVende, setQueVende] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [localErr, setLocalErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const validate = () => {
    if (!name.trim()) return "El nombre es obligatorio.";
    if (!pais) return "Elige tu país.";
    if (whatsapp.replace(/\D/g, "").length < 8)
      return "Escribe un número de WhatsApp válido (con código de país).";
    if (!email.trim()) return "El email es obligatorio.";
    if (password.length < 6) return "La contraseña debe tener al menos 6 caracteres.";
    if (!queVende.trim()) return "Cuéntanos qué vas a vender.";
    return "";
  };

  const onSubmit = async () => {
    setLocalErr("");
    auth.clearError();

    const v = validate();
    if (v) {
      setLocalErr(v);
      return;
    }

    setLoading(true);
    try {
      // 1) Crea la cuenta (email + contraseña) y el usuario en Firestore.
      const user = await auth.register({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      // 2) Completa su ficha con los datos del vendedor.
      const { db } = await import("../config/firebase");
      const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
      await setDoc(
        doc(db, "compradores", user.uid),
        {
          Nombre: name.trim(),
          Pais: pais,
          Whatsapp: whatsapp.replace(/\D/g, ""),
          QueVende: queVende.trim(),
          rol: "vendedor",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setDone(true);
    } catch (e) {
      setLocalErr(
        auth.error ||
          "No se pudo crear la cuenta. Puede que el email ya esté registrado."
      );
    } finally {
      setLoading(false);
    }
  };

  // Pantalla de éxito
  if (done) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        <Container maxWidth="sm" sx={{ py: 3 }}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, textAlign: "center" }}>
            <CheckCircleRoundedIcon sx={{ fontSize: 64, color: "#16845A", mb: 1 }} />
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
              ¡Cuenta creada con éxito!
            </Typography>
            <Typography sx={{ color: "#5A5E6C", mb: 3 }}>
              Bienvenido a Chekea, {name.trim() || "vendedor"}. Ya puedes iniciar sesión
              y empezar a registrar tu mercancía.
            </Typography>
            <Stack spacing={1.2}>
              <Button variant="contained" onClick={() => nav("/login")}>
                Iniciar sesión
              </Button>
              <Button onClick={() => nav("/")}>Ir al inicio</Button>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Crear cuenta de vendedor
          </Typography>
          <Typography sx={{ color: "#5A5E6C", fontSize: 14, mt: 0.5 }}>
            Regístrate para vender en Chekea. Es rápido.
          </Typography>

          {(localErr || auth.error) && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {localErr || auth.error}
            </Alert>
          )}

          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />

            
             <TextField
              label="Pais"
              value={name}
              onChange={(e) => setPais(e.target.value)}
              autoComplete="name"
            />
            
            <TextField
              label="Número de WhatsApp (con código de país)"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              type="tel"
              placeholder="Ej.: 240 222 123 456"
            />

            <TextField
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              type="email"
            />

            <TextField
              label="Crear contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              type={showPass ? "text" : "password"}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPass((v) => !v)} edge="end">
                      {showPass ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="¿Qué vas a vender?"
              value={queVende}
              onChange={(e) => setQueVende(e.target.value)}
              multiline
              minRows={2}
              placeholder="Ej.: ropa, electrónica, productos de belleza..."
            />

            <Button variant="contained" onClick={onSubmit} disabled={loading}>
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </Button>

          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}