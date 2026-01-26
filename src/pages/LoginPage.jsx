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
  InputAdornment,
  IconButton,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import Header from "../components/header";
import { useAuth } from "../state/AuthContext";

import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

export default function LoginPage() {
  const auth = useAuth();
  const nav = useNavigate();

  const [mode, setMode] = useState("login"); // "login" | "register"

  const [name, setName] = useState(""); // register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [localErr, setLocalErr] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);

  const validate = () => {
    if (!email) return "El email es obligatorio.";
    if (!password) return "La contraseña es obligatoria.";

    if (mode === "register") {
      if (!name) return "El nombre es obligatorio.";
      if (!password2) return "Confirma tu contraseña.";
      if (password !== password2) return "Las contraseñas no coinciden.";
      if (password.length < 6) return "La contraseña debe tener al menos 6 caracteres.";
    }
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

    try {
      if (mode === "login") {
        await auth.login({ email, password });
      } else {
        await auth.register({ name, email, password });
      }
      nav("/account");
    } catch {
      // el error ya queda en auth.error
    }
  };

  const switchMode = () => {
    setLocalErr("");
    auth.clearError();
    setPassword("");
    setPassword2("");
    setMode(mode === "login" ? "register" : "login");
  };

  const canSubmit =
    !!email &&
    !!password &&
    (mode === "login" || (!!name && !!password2 && password === password2));

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header queryText="" onQueryChange={() => {}} />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </Typography>

          {(localErr || auth.error) && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {localErr || auth.error}
            </Alert>
          )}

          <Stack spacing={2} sx={{ mt: 2 }}>
            {mode === "register" && (
              <TextField
                label="Nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            )}

            <TextField
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              type="email"
            />

            <TextField
              label="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
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

            {mode === "register" && (
              <TextField
                label="Confirmar contraseña"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                autoComplete="new-password"
                type={showPass2 ? "text" : "password"}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPass2((v) => !v)} edge="end">
                        {showPass2 ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            )}

            <Button
              variant="contained"
              onClick={onSubmit}
              disabled={!canSubmit || auth.loading}
            >
              {auth.loading ? "Procesando..." : mode === "login" ? "Entrar" : "Registrarme"}
            </Button>

            <Button onClick={switchMode}>
              {mode === "login" ? "Crear cuenta" : "Ya tengo cuenta"}
            </Button>

            <Button onClick={() => nav("/")}>Volver</Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
