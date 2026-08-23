import React, { useEffect, useState } from "react";
import { Container, Box, Paper, Typography, Button, Stack } from "@mui/material";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import { useNavigate } from "react-router-dom";
import Header from "../components/header";
import { useAuth } from "../state/AuthContext";

export default function AccountPage() {
  const auth = useAuth();
  const nav = useNavigate();

  // Redirige si no hay sesión (sin romper las reglas de hooks).
  useEffect(() => {
    if (!auth.loading && !auth.isAuthed) nav("/login", { replace: true });
  }, [auth.loading, auth.isAuthed, nav]);

  if (!auth.isAuthed) return null;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header queryText="" onQueryChange={() => {}} />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>Mi cuenta</Typography>
          <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
            {auth.user?.email}
          </Typography>

          <Stack spacing={2} sx={{ mt: 3 }}>
            {/* Acción propia del modelo Chekea: registrar mercancía (lote). */}
            <Button
              variant="contained"
              startIcon={<Inventory2RoundedIcon />}
              onClick={() => nav("/lote")}
            >
              Registrar un lote
            </Button>

            <Button color="error" onClick={() => { auth.logout(); nav("/"); }}>
              Cerrar sesión
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
