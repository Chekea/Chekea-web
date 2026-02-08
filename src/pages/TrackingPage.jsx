import React, { useState } from "react";
import {
  Container,
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
} from "@mui/material";
import Header from "../components/header";
import { useOrders } from "../state/OrderContext";

export default function TrackingPage() {
  const ordersApi = useOrders();
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header queryText="" onQueryChange={() => {}} />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Tracking
          </Typography>
          <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
            Ingresa tu código (ej: CHK-12345678)
          </Typography>

          {/* ✅ AVISO (SMS) en el medio */}
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography sx={{ fontWeight: 900 }}>
              Aviso importante sobre envíos
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Debido a las festividades del Año Nuevo Chino, las operaciones logísticas
              estarán temporalmente pausadas. Los envíos se retomarán a partir del{" "}
              <b>23 de febrero</b>.
            </Typography>
          </Alert>

          {err && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {err}
            </Alert>
          )}

          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Código de tracking"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button
              variant="contained"
              onClick={() => {
                setErr("");
                const found = ordersApi.findByTracking(code);
                if (!found) {
                  setResult(null);
                  setErr("No se encontró ese código.");
                  return;
                }
                setResult(found);
              }}
            >
              Buscar
            </Button>

            {result && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography sx={{ fontWeight: 900 }}>
                  Orden: {result.id}
                </Typography>
                <Typography sx={{ color: "text.secondary" }}>
                  Carrier: {result.tracking.carrier}
                </Typography>
                <Typography sx={{ color: "text.secondary" }}>
                  Estado: {result.tracking.status}
                </Typography>
                <Button
                  sx={{ mt: 1 }}
                  onClick={() => ordersApi.advanceTracking(result.id)}
                >
                  Simular avance de estado
                </Button>
              </Paper>
            )}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
