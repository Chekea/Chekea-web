# Chekea Web

Escaparate + logística para Guinea Ecuatorial (React + Vite + Firebase),
preparado para ejecutarse dentro de un **WebView** de una app React Native, en
**redes con mala conexión** y con **sensación de app nativa**.

**Modelo de negocio (importante):** Chekea NO es una tienda con carrito. El
comprador ve productos y, al tocar uno, **se abre WhatsApp directamente** para
hablar con Chekea/el vendedor y cerrar la compra por fuera. No hay carrito, ni
checkout, ni favoritos, ni pago dentro de la app.

---

## Puesta en marcha

Requisitos: **Node 18+** y npm.

```bash
npm install
cp .env.example .env      # y rellena tus claves de Firebase
npm run dev               # desarrollo (muestra una URL local y otra de red)
npm run build             # producción -> carpeta dist/
npm run preview           # previsualizar el build
```

Las credenciales de Firebase van en `.env` (ver `.env.example`).

---

## Cómo funciona el escaparate

- La **home** (`/`) y la **búsqueda** (`/search`) y las **categorías**
  (`/categoria`) muestran los productos que hay en Firestore (colección
  `productos`, solo los que tienen `visible: true`).
- Cada tarjeta de producto lleva un botón verde **“Contactar”**. Al tocarla se
  abre **WhatsApp** con un mensaje ya escrito que incluye el producto, el precio
  y la referencia.
- No existe página de producto, ni carrito, ni favoritos, ni pedidos de compra.

### El número de WhatsApp

Se configura en **`src/config/chekea.js`**:

```js
export const CHEKEA = {
  whatsapp: "222237169",  // <-- número central de Chekea (cámbialo por el tuyo)
  currency: "FCFA",
};
```

- Por defecto, todos los mensajes van a ese número central de Chekea.
- Si en el futuro guardas el WhatsApp del vendedor en cada producto (campos
  admitidos: `Whatsapp`, `whatsapp`, `Telefono`, `Contacto`…), el botón usará
  ese número automáticamente y, si no lo hay, el central.

---

## Registro de mercancía (vendedor)

- `/lote` — asistente para registrar un lote con sus cajas y productos, y subir
  fotos (las imágenes se guardan en **Firebase Storage**). Requiere sesión.
- `/verify/:orderId` — verificación de subida.
- La cuenta (`/account`) permite iniciar sesión y acceder a “Registrar un lote”.

---

## Optimizaciones (WebView / red mala / app nativa)

- **Arranque a prueba de fallos:** `index.html` muestra el logo mientras carga y,
  si algo impide iniciar, explica el problema en pantalla (no se queda mudo).
  `src/main.jsx` envuelve el arranque en `try/catch`.
- **Analytics seguro:** Firebase Analytics se carga solo si el entorno lo
  soporta; nunca rompe el arranque dentro del WebView.
- **Sensación nativa (`src/index.css`):** sin rebote elástico, sin flash azul al
  tocar, sin menús de “mantener pulsado”, sin zoom por doble toque, respeto del
  notch (safe-area) y altura estable.
- **Recargas sin 404 (`firebase.json`):** reescritura SPA (`** -> /index.html`)
  y caché de assets, necesarias porque se usa `BrowserRouter`.
- **Build para gama baja (`vite.config.js`):** target `es2019` y acceso por red
  local para probar en un teléfono real.
- **Almacenamiento del navegador bajo control:** el borrador del lote NO guarda
  las imágenes en base64 (antes llenaba el almacenamiento y bloqueaba Firestore).
- **Caché offline opcional:** `VITE_ENABLE_OFFLINE=1` en `.env` la activa (con
  fallback seguro). Apagada por defecto.

---

## Integración con la app nativa (WebView)

- RN inyecta el estado inicial en `window.__RN_STATE__` (por ejemplo el usuario).
- Eventos en caliente vía `CustomEvent("RN_BRIDGE_V1", { detail: { ns, type … } })`:
  `user_context`, `logout`, etc.
- La web avisa `window.ReactNativeWebView.postMessage({ ns, type: "bridge_ready" })`.
- La sesión combina la de Firebase con la inyectada por RN (`useEffectiveAuth`).

---

## Despliegue (Firebase Hosting)

```bash
npm run build
firebase deploy --only hosting
```

`firebase.json` sirve `dist/`, reescribe rutas a `index.html` y cachea assets.
Hosting solo publica los archivos; **los productos se leen directamente de
Firestore**, no hace falta ningún servidor propio.

---

## Seguridad

- **Rota tu clave SSH:** el paquete original incluía una clave privada; se ha
  excluido. Genera una nueva y no guardes claves en el repositorio.
- **Reglas de Firestore:** define reglas para las colecciones `productos`,
  `compradores` y las que uses, antes de producción.

---

## Estructura (tras la limpieza)

```
src/
  config/firebase.js   Init de Firebase (offline opcional + analytics seguro)
  config/chekea.js     Número de WhatsApp y apertura de chat por producto
  main.jsx             Arranque (con manejo de errores)
  routes/              AppRouter (rutas del modelo) y ProtectedRoute
  state/               Auth y puente RN (RNBridgeContext, useEffectiveAuth)
  bridge/              installRnBridge (eventos RN -> web)
  services/            product.firesore.service, auth.service, compras.service
  pages/               Homepage, ResultPage (búsqueda), CategoryPage, new,
                       ChekeaLote (registro), Verifyupload, LoginPage, AccountPage
  components/          header, productgrid, productcart (tarjeta -> WhatsApp), subcategorybar
  i18n/ theme/ utils/  Internacionalización, tema MUI y utilidades
```

Se eliminaron del proyecto: carrito, checkout, favoritos, pedidos de compra,
página de producto y sus servicios (ya no forman parte del modelo).
