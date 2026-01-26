import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#ff5f00" },     // verde
    secondary: { main: "#F2C94C" },   // amarillo
    background: { default: "#F6F8F7" },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: ["Inter", "system-ui", "Arial", "sans-serif"].join(","),
    h5: { fontWeight: 900 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 800 },
      },
    },
  },
});
