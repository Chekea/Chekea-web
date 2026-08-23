# Modelo de datos de Chekea (arquitectura)

Esta es la referencia única de cómo se guardan y leen los datos. Nació de un
problema real: los productos que subía un vendedor **no aparecían** en el
escaparate y **no se podía contactar al vendedor**, porque en la misma colección
convivían dos formas distintas de "producto".

## La regla de oro

Toda la app entiende un producto a través de **un solo normalizador**:
`src/domain/product.js` → `toProduct(raw)`. Ninguna pantalla debe volver a leer
campos sueltos de Firestore por su cuenta; si necesita un producto, lo pasa por
`toProduct`. Así se acabaron los bugs de "unos con mayúscula y otros con
minúscula".

## Colección `productos`

Es la única colección de productos (la leen el escaparate, la búsqueda y las
categorías, y ahí escribe el alta de mercancía). Cada documento debe tener:

**Campos del escaparate** (para que el producto se vea y se pueda ordenar):
- `Titulo` (texto)
- `Precio` (número; sin puntos ni "FCFA")
- `Categoria` (texto o null)
- `Ciudad` y `Pais`
- `Imagen` (URL) y/o `media.cover.variants.card` (URL)
- `Fecha` (timestamp; el escaparate ordena por aquí)
- `visible` (booleano; la portada solo muestra `visible: true`)

**Identidad del vendedor** (para que el comprador le escriba a ÉL):
- `vendedorId` (uid del vendedor)
- `Whatsapp` (número con código de país, solo dígitos)

**Datos operativos de logística** (recepción y almacén):
- `envio`, `caja`, `codigo`, `nombre`, `cantidad`, `estado`, `createdAt`,
  `media.cover` / `detalles` (imágenes en Storage).

El alta de mercancía (`src/pages/ChekeaLote.jsx`) ya escribe **todos** estos
campos juntos, usando `storefrontFields(...)` del dominio. Por eso un producto
nuevo aparece en el escaparate y lleva el WhatsApp de su vendedor.

## Cómo se decide a quién escribe el comprador

En `src/config/chekea.js` y `src/domain/product.js`:
1. Si el producto trae WhatsApp del vendedor (`Whatsapp`), se usa **ese**.
2. Si no lo trae, se usa el número central de Chekea (`CHEKEA.whatsapp`).

Es decir: los productos nuevos escriben al vendedor; los antiguos que no tengan
número seguirán yendo al central hasta que se les añada `Whatsapp`.

## Publicación (importante)

Hoy, al crear mercancía, el producto se guarda con `visible: true` para que el
vendedor lo vea enseguida. En el modelo Chekea "de manual", la mercancía se
**verifica** antes de publicarse. Si quieres ese flujo (guardar con
`visible: false` y publicar tras verificar), se cambia en un solo sitio:
`storefrontFields` en `src/domain/product.js`. Mientras no exista un panel de
verificación, publicar directo es lo más práctico.

## Productos antiguos

Los que ya tenías cargados siguen funcionando (el normalizador entiende su
formato). Solo les falta el `Whatsapp` del vendedor; cuando quieras que escriban
al vendedor y no al número central, añade ese campo a cada documento (te puedo
preparar un script de una sola vez).

## Otras colecciones

- `compradores`: perfil de usuarios (se crea al registrarse por email).
- `_ids`: uso interno para generar identificadores.

## Por qué esta arquitectura

- **Un solo modelo** = menos bugs y cambios en un único lugar.
- **Vendedor de primera clase** = el negocio funciona (comprador ↔ vendedor).
- **Desnormalizado** (el WhatsApp viaja en el producto) = rápido y offline-friendly,
  sin lecturas extra en cada toque, ideal para redes malas.
