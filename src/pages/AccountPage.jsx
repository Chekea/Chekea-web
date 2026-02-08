import React, { useState } from "react";
import { Container, Box, Paper, Typography, Button, Stack, TextField } from "@mui/material";
import { useNavigate } from "react-router-dom";
import Header from "../components/header";
import { useAuth } from "../state/AuthContext";

export default function AccountPage() {
  const auth = useAuth();
  const nav = useNavigate();

  if (!auth.isAuthed) {
    nav("/login");
    return null;
  }

  console.log(auth)
  const [name, setName] = useState(auth.user?.name || "");
  const [phone, setPhone] = useState(auth.user?.phone || "");

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header queryText="" onQueryChange={() => {}} />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>Mi cuenta</Typography>
          <Typography sx={{ color: "text.secondary", mt: 0.5 }}>{auth.user.email}</Typography>

          <Stack spacing={2} sx={{ mt: 2 }}>
         
            <Button variant="outlined" onClick={() => nav("/account/orders")}>
              Mis compras
            </Button>
 
            <Button variant="outlined" onClick={() => nav("/account/favorites")}>
              Mis favoritos
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
