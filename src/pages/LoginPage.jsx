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
  Divider,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

export default function LoginPage() {
  const auth = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localErr, setLocalErr] = useState("");
  const [showPass, setShowPass] = useState(false);

  const onSubmit = async () => {
    setLocalErr("");
    auth.clearError();

    if (!email) {
      setLocalErr("El email es obligatorio.");
      return;
    }
    if (!password) {
      setLocalErr("La contraseña es obligatoria.");
      return;
    }

    try {
      await auth.login({ email, password });
      nav("/account");
    } catch {
      // el error ya queda en auth.error
    }
  };

  const onGoogle = async () => {
    setLocalErr("");
    auth.clearError();
    try {
      await auth.loginWithGoogle();
      nav("/account");
    } catch {
      // error ya queda en auth.error
    }
  };

  const canSubmit = !!email && !!password;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Iniciar sesión
          </Typography>

          {(localErr || auth.error) && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {localErr || auth.error}
            </Alert>
          )}

          <Stack spacing={2} sx={{ mt: 2 }}>
            {/* Google */}
           
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
              autoComplete="current-password"
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

            <Button variant="contained" onClick={onSubmit} disabled={!canSubmit || auth.loading}>
              {auth.loading ? "Procesando..." : "Entrar"}
            </Button>

            <Button onClick={() => nav("/")}>Volver</Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}