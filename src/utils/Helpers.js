export const HOME_SCROLL_PREFIX = "chekea_home_scroll:";

export function getScrollKey(searchParams) {
  return `${HOME_SCROLL_PREFIX}${searchParams.toString()}`;
}

export function saveScroll(key) {
  try {
    sessionStorage.setItem(key, String(window.scrollY || 0));
  } catch {}
}

export function restoreScroll(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw == null) return false;
    const y = Number(raw);
    if (!Number.isFinite(y)) return false;

    requestAnimationFrame(() => {
      window.scrollTo({ top: y, left: 0, behavior: "auto" });
    });
    return true;
  } catch {
    return false;
  }
}

export const compressImage = async (file, opts = {}) => {
  const {
    maxWidth = 1200,
    maxHeight = 900,
    quality = 0.8, // 0..1
    mimeType = "image/webp",
  } = opts;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = () => {
      const img = new Image();
      img.src = reader.result;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          if (width > height && width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          } else if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("No se pudo comprimir la imagen"));
            // Convertimos a File para mantener name/type
            const nameBase = (file.name || "comprobante").replace(/\.[^/.]+$/, "");
            const outFile = new File([blob], `${nameBase}.webp`, { type: mimeType });
            resolve(outFile);
          },
          mimeType,
          quality
        );
      };

      img.onerror = () => reject(new Error("No se pudo leer la imagen"));
    };

    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
  });
};
export let puntodecimal = n => {
  if (n !== undefined) {
    return Math.trunc(n)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
};
export function extractValidTokens(text) {
  if (!text) return [];

  return text
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 3)   // 👈 SOLO > 3 letras
    .slice(0, 3);                // 👈 máximo 3 tokens
}
// 9. Memoizar formateador de fechas
const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});
export const fechas = timestamp => {
  if (!timestamp) return 'Sin fecha';

  // Si es un Timestamp de Firestore
  if (timestamp.toDate) {
    timestamp = timestamp.toDate();
  }

  const date = new Date(timestamp);
  if (isNaN(date)) return 'Fecha inválida';

  return dateFormatter.format(date);
};