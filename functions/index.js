// functions/index.js
/* eslint-disable no-console */

const admin = require("firebase-admin");
const { FieldValue, Timestamp, FieldPath } = require("firebase-admin/firestore");
const sharp = require("sharp");
const path = require("path");
const os = require("os");
const fs = require("fs/promises");

const { onRequest } = require("firebase-functions/v2/https");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { setGlobalOptions } = require("firebase-functions/v2");

/**
 * =========================================
 * CONFIG
 * =========================================
 */
setGlobalOptions({ region: "us-central1" });

const TIMEOUT_15_MIN = 900;
const TIMEOUT_60_MIN = 3600;
const MEMORY = "1GiB";

// Batch tuning
const DEFAULT_PAGE_SIZE = 20; // 15–30 recomendado
const MAX_PAGE_SIZE = 50;
const DEFAULT_CONCURRENCY = 3; // tu valor seguro con sharp

// Lock / Job control
const JOBS_COLLECTION = "jobs";
const LOCK_LEASE_SECONDS = 20 * 60; // 20 min, más que el timeout por página
const AUTO_CHAIN_DELAY_MS = 80; // (se mantiene) si usas chaining, aquí no lo usamos

// Cloud Tasks (OPCIONAL, solo si quieres en deploy real)
// En emulador NO lo necesitamos.
const USE_CLOUD_TASKS_WHEN_NOT_EMULATOR = false;

// Si algún día activas Cloud Tasks:
let tasksClient = null;
let CloudTasksClient = null;
try {
  // eslint-disable-next-line global-require
  ({ CloudTasksClient } = require("@google-cloud/tasks"));
  tasksClient = new CloudTasksClient();
} catch {
  // no pasa nada si no está instalado
}

/**
 * =========================================
 * INIT
 * =========================================
 */
admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

/**
 * =========================================
 * IMAGE SIZES (tus mismos tamaños)
 * =========================================
 */
const SIZES_COVER = [
  { name: "thumb", px: 320, quality: 62 },
  { name: "card", px: 640, quality: 70 },
  { name: "detail", px: 1024, quality: 76 },
];

const SIZES_2 = [
  { name: "thumb", px: 360, quality: 62 },
  { name: "detail", px: 1024, quality: 76 },
];

/**
 * =========================================
 * HELPERS
 * =========================================
 */
function isLikelyImage(contentType, filePath) {
  if (contentType && contentType.startsWith("image/")) return true;
  const ext = path.extname(filePath || "").toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
}

function sanitizeName(s) {
  return String(s || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120);
}

/**
 * Normaliza subcategoria para no “perder” docs por espacios / mayúsculas / NBSP
 * (esto NO cambia la lógica de optimización, solo la selección de IDs)
 */
function normalizeSubcat(v) {
  return String(v ?? "")
    .replace(/\u00A0/g, " ") // NBSP -> espacio normal
    .trim()
    .toLowerCase();
}

/**
 * Soporta:
 * - downloadURL (firebasestorage.../o/<ENC>?...)
 * - storage.googleapis.com/<bucket>/<path>
 * - storagePath (no http)
 */
function toStoragePath(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim();

  // ya es path
  if (!v.startsWith("http")) return v;

  // downloadURL
  const marker = "/o/";
  const i = v.indexOf(marker);
  if (i !== -1) {
    const after = v.substring(i + marker.length);
    const q = after.indexOf("?");
    const encodedPath = q === -1 ? after : after.substring(0, q);
    try {
      return decodeURIComponent(encodedPath);
    } catch {
      return null;
    }
  }

  // storage.googleapis.com/<bucket>/<path>
  try {
    const u = new URL(v);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return decodeURIComponent(parts.slice(1).join("/"));
    }
  } catch {}

  return null;
}

async function fileExists(storagePath) {
  const [exists] = await bucket.file(storagePath).exists();
  return exists;
}

async function makeWebpVariantsFromStoragePath({
  sourcePath,
  destBasePathNoExt,
  sizes,
}) {
  const tmp = os.tmpdir();

  if (!(await fileExists(sourcePath))) {
    throw new Error(`SOURCE_NOT_FOUND: ${sourcePath}`);
  }

  const inputLocal = path.join(
    tmp,
    `in_${Date.now()}_${path.basename(sourcePath)}`
  );

  await bucket.file(sourcePath).download({ destination: inputLocal });

  const outMap = {};
  try {
    for (const s of sizes) {
      const destPath = `${destBasePathNoExt}_${s.px}.webp`;
      const outLocal = path.join(tmp, `out_${Date.now()}_${s.px}.webp`);

      await sharp(inputLocal)
        .rotate()
        .resize({ width: s.px, withoutEnlargement: true })
        .webp({ quality: s.quality })
        .toFile(outLocal);

      await bucket.upload(outLocal, {
        destination: destPath,
        metadata: {
          contentType: "image/webp",
          cacheControl: "public, max-age=31536000, immutable",
        },
      });

      outMap[s.name] = destPath;
      await fs.unlink(outLocal).catch(() => {});
    }
  } finally {
    await fs.unlink(inputLocal).catch(() => {});
  }

  return outMap;
}

// Tu safeRun original (se mantiene)
async function safeRun(label, fn) {
  try {
    await fn();
    console.log("OK:", label);
    return { ok: true };
  } catch (e) {
    console.error("FAIL:", label, String(e?.message || e));
    return { ok: false, error: String(e?.message || e) };
  }
}

function isEmulator() {
  return !!process.env.FUNCTIONS_EMULATOR || !!process.env.FIREBASE_EMULATOR_HUB;
}

function getBaseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

/**
 * =========================================
 * DEBUG (solo para saber errores / skips)
 * - NO cambia tu lógica de optimización
 * - Solo escribe en Firestore cuando SKIP o FAIL
 * =========================================
 */
function serializeError(e) {
  return {
    message: String(e?.message || e),
    name: e?.name || null,
    code: e?.code || null,
    stack: typeof e?.stack === "string" ? e.stack.slice(0, 2000) : null,
  };
}

async function debugMark(ref, step, payload) {
  // Solo se usa en SKIP/FAIL para no “ensuciar” OK
  try {
    await ref.set(
      {
        [`media.debug.steps.${step}`]: {
          ...payload,
          at: FieldValue.serverTimestamp(),
        },
        "media.debug.updatedAt": FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (payload?.status === "fail") {
      await ref.set(
        {
          "media.debug.lastError": { step, ...(payload.error || {}) },
          "media.debug.lastErrorAt": FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.error("debugMark failed:", String(err?.message || err));
  }
}

async function safeRunDebug({ label, ref, fn }) {
  try {
    await fn();
    console.log("OK:", label);
    return { ok: true };
  } catch (e) {
    const err = serializeError(e);
    console.error("FAIL:", label, err.message);
    await debugMark(ref, label, {
      status: "fail",
      reason: "exception",
      error: err,
    });
    return { ok: false, error: err.message };
  }
}

/**
 * =========================================
 * CORE: Optimizar 1 producto (tu misma lógica)
 * =========================================
 */
async function optimizeOneProduct(productId) {
  const ref = db.collection("productos").doc(productId);
  const snap = await ref.get();
  if (!snap.exists)
    throw new Error(`Producto no existe: productos/${productId}`);

  const data = snap.data() || {};

  // 1) COVER
  await safeRunDebug({
    label: "cover",
    ref,
    fn: async () => {
      if (data?.media?.cover?.variants?.card) {
        console.log("SKIP cover: ya existe media.cover.variants");
        await debugMark(ref, "cover", {
          status: "skip",
          reason: "already_has_variants_card",
        });
        return;
      }

      const coverPath = toStoragePath(data.Imagen);
      if (!coverPath) {
        console.log("SKIP cover: Imagen inválida:", data.Imagen);
        await debugMark(ref, "cover", {
          status: "skip",
          reason: "invalid_or_missing_Imagen",
          details: { Imagen: data.Imagen ?? null },
        });
        return;
      }

      const exists = await fileExists(coverPath);
      if (!exists) {
        await debugMark(ref, "cover", {
          status: "fail",
          reason: "source_not_found",
          details: { coverPath },
          error: { message: `SOURCE_NOT_FOUND: ${coverPath}` },
        });
        throw new Error(`SOURCE_NOT_FOUND: ${coverPath}`);
      }

      const variants = await makeWebpVariantsFromStoragePath({
        sourcePath: coverPath,
        destBasePathNoExt: `productos/${productId}/optimized/cover`,
        sizes: SIZES_COVER,
      });

      await ref.set(
        {
          coverPath,
          "media.cover.originalPath": coverPath,
          "media.cover.variants": variants,
          "media.cover.updatedAt": FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    },
  });

  // 2) QUALITY (tu lógica original mira imagenesreales)
  await safeRunDebug({
    label: "quality",
    ref,
    fn: async () => {
      const arr = Array.isArray(data.imagenesreales)
        ? data.imagenesreales.slice(0, 2)
        : [];

      if (arr.length === 0) {
        console.log("SKIP quality: imagenesreales[] vacío");
        await debugMark(ref, "quality", {
          status: "skip",
          reason: "imagenesreales_empty_or_missing",
        });
        return;
      }

      const quality = [];
      for (let idx = 0; idx < arr.length; idx++) {
        const urlOrPath = arr[idx];

        await safeRunDebug({
          label: `quality_${idx + 1}`,
          ref,
          fn: async () => {
            const originalPath = toStoragePath(urlOrPath);
            if (!originalPath) {
              console.log("SKIP quality inválida:", urlOrPath);
              await debugMark(ref, `quality_${idx + 1}`, {
                status: "skip",
                reason: "invalid_path",
                details: { value: urlOrPath ?? null },
              });
              return;
            }

            const exists = await fileExists(originalPath);
            if (!exists) {
              await debugMark(ref, `quality_${idx + 1}`, {
                status: "fail",
                reason: "source_not_found",
                details: { originalPath },
                error: { message: `SOURCE_NOT_FOUND: ${originalPath}` },
              });
              throw new Error(`SOURCE_NOT_FOUND: ${originalPath}`);
            }

            const variants = await makeWebpVariantsFromStoragePath({
              sourcePath: originalPath,
              destBasePathNoExt: `productos/${productId}/optimized/quality_${idx + 1}`,
              sizes: SIZES_2,
            });

            quality.push({
              index: idx + 1,
              originalPath,
              variants,
              updatedAt: FieldValue.serverTimestamp(),
            });
          },
        });
      }

      await ref.set(
        { "media.quality": quality, qualityCount: quality.length },
        { merge: true }
      );
    },
  });

  // 3) GALLERY (subcolección productos/{id}/imagenes con campo Imagen)
  await safeRunDebug({
    label: "gallery",
    ref,
    fn: async () => {
      const imgsSnap = await ref.collection("imagenes").get();
      console.log("imagenes subcollection count:", imgsSnap.size);

      if (imgsSnap.empty) {
        console.log("SKIP gallery: subcolección vacía");
        await debugMark(ref, "gallery", {
          status: "skip",
          reason: "subcollection_empty",
        });
        return;
      }

      let processed = 0;

      for (const docSnap of imgsSnap.docs) {
        await safeRunDebug({
          label: `gallery_doc_${docSnap.id}`,
          ref,
          fn: async () => {
            const d = docSnap.data() || {};

            if (d?.media?.variants?.detail) {
              console.log("SKIP gallery doc (ya tiene variants):", docSnap.id);
              await debugMark(ref, `gallery_doc_${docSnap.id}`, {
                status: "skip",
                reason: "already_has_detail_variant",
              });
              processed++;
              return;
            }

            const originalPath = toStoragePath(d.Imagen);
            if (!originalPath) {
              console.log(
                "SKIP gallery doc Imagen inválida:",
                docSnap.id,
                d.Imagen
              );
              await debugMark(ref, `gallery_doc_${docSnap.id}`, {
                status: "skip",
                reason: "invalid_or_missing_Imagen",
                details: { Imagen: d.Imagen ?? null },
              });
              return;
            }

            const exists = await fileExists(originalPath);
            if (!exists) {
              await debugMark(ref, `gallery_doc_${docSnap.id}`, {
                status: "fail",
                reason: "source_not_found",
                details: { originalPath },
                error: { message: `SOURCE_NOT_FOUND: ${originalPath}` },
              });
              throw new Error(`SOURCE_NOT_FOUND: ${originalPath}`);
            }

            const key = sanitizeName(`${d.codigo || "img"}_${docSnap.id}`);
            const destBase = `productos/${productId}/optimized/gallery_${key}`;

            const variants = await makeWebpVariantsFromStoragePath({
              sourcePath: originalPath,
              destBasePathNoExt: destBase,
              sizes: SIZES_2,
            });

            await docSnap.ref.set(
              {
                originalPath,
                "media.variants": variants,
                "media.updatedAt": FieldValue.serverTimestamp(),
              },
              { merge: true }
            );

            processed++;
          },
        });
      }
    },
  });

  return { ok: true, productId };
}

/**
 * =========================================
 * HTTP: optimizar 1 producto
 * =========================================
 */
exports.optimizeProductHttp = onRequest(
  { memory: MEMORY, timeoutSeconds: TIMEOUT_15_MIN },
  async (req, res) => {
    try {
      const productId =
        (typeof req.query.productId === "string" && req.query.productId) ||
        (typeof req.body?.productId === "string" && req.body.productId);

      if (!productId) {
        res.status(400).json({ ok: false, error: "Falta productId" });
        return;
      }

      const result = await optimizeOneProduct(productId);
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  }
);

/**
 * =========================================
 * Trigger: uploads futuros en ruta controlada
 * =========================================
 */
exports.optimizeOnUpload = onObjectFinalized(
  { memory: MEMORY, timeoutSeconds: TIMEOUT_15_MIN },
  async (event) => {
    const filePath = event.data.name;
    const contentType = event.data.contentType || "";

    if (!filePath) return;
    if (!isLikelyImage(contentType, filePath)) return;

    // evita loop
    if (filePath.includes("/optimized/")) return;

    // solo rutas: productos/<id>/original/<type>/...
    const parts = filePath.split("/");
    if (parts[0] !== "productos" || parts.length < 4) return;

    const productId = parts[1];
    const root = parts[2];
    const type = parts[3];

    if (root !== "original") return;

    const ref = db.collection("productos").doc(productId);

    if (type === "cover") {
      const variants = await makeWebpVariantsFromStoragePath({
        sourcePath: filePath,
        destBasePathNoExt: `productos/${productId}/optimized/cover`,
        sizes: SIZES_COVER,
      });

      await ref.set(
        {
          "media.cover.originalPath": filePath,
          "media.cover.variants": variants,
          "media.cover.updatedAt": FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    if (type === "gallery") {
      const baseName = sanitizeName(
        path.parse(parts.slice(4).join("_")).name || `g_${Date.now()}`
      );
      await makeWebpVariantsFromStoragePath({
        sourcePath: filePath,
        destBasePathNoExt: `productos/${productId}/optimized/gallery_${baseName}`,
        sizes: SIZES_2,
      });
      return;
    }

    if (type === "quality") {
      const baseName = sanitizeName(
        path.parse(parts.slice(4).join("_")).name || `q_${Date.now()}`
      );
      await makeWebpVariantsFromStoragePath({
        sourcePath: filePath,
        destBasePathNoExt: `productos/${productId}/optimized/quality_${baseName}`,
        sizes: SIZES_2,
      });
      return;
    }
  }
);

/**
 * =========================================
 * JOB / LOCK helpers (para correr 1 sola vez)
 * =========================================
 */
function jobIdForSubcat(subcat) {
  return `optimize_${sanitizeName(subcat || "default")}`;
}

async function acquireJobLock(jobRef) {
  const now = Timestamp.now();
  const leaseUntil = Timestamp.fromMillis(Date.now() + 60000);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    const data = snap.exists ? snap.data() : null;

    const locked = !!data?.lock?.locked;
    const lockUntil = data?.lock?.until;

    // Si está locked pero expiró, se puede tomar
    const lockExpired =
      lockUntil && lockUntil.toMillis && lockUntil.toMillis() <= Date.now();

    if (locked && !lockExpired) {
      return { ok: false, reason: "LOCKED" };
    }

    tx.set(
      jobRef,
      {
        status: data?.status || "running",
        lock: {
          locked: true,
          until: leaseUntil,
          updatedAt: now,
        },
        updatedAt: now,
      },
      { merge: true }
    );

    return { ok: true, leaseUntil };
  });
}

async function renewJobLock(jobRef) {
  const now = Timestamp.now();
  const leaseUntil = Timestamp.fromMillis(Date.now() + 60000);
  await jobRef.set(
    {
      lock: { locked: true, until: leaseUntil, updatedAt: now },
      updatedAt: now,
    },
    { merge: true }
  );
}

async function releaseJobLock(jobRef) {
  const now = Timestamp.now();
  await jobRef.set(
    {
      lock: { locked: false, until: null, updatedAt: now },
      updatedAt: now,
    },
    { merge: true }
  );
}

/**
 * =========================================
 * (Se mantiene) Cloud Tasks / chaining opcional
 * - NO se usa en el nuevo “leer todos”
 * =========================================
 */
const REGION = "us-central1";
const QUEUE_ID = "optimize-products";
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";

async function enqueueNextPage({ req, functionPath, payload }) {
  // ✅ EMULADOR: encadenado por HTTP (si lo activas)
  if (isEmulator()) {
    const url = `${getBaseUrl(req)}${functionPath}`;

    console.log("EMULATOR chaining next page -> startAfter:", payload.startAfter);

    setTimeout(() => {
      // OJO: si tu runtime no tiene fetch, esto fallará.
      // En esta versión, no dependemos de chaining para “leer todos”.
      if (typeof fetch !== "function") {
        console.error("No fetch() disponible en este runtime.");
        return;
      }

      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(() => console.log("EMULATOR next page triggered"))
        .catch((e) =>
          console.error("EMULATOR chain failed:", e?.message || e)
        );
    }, AUTO_CHAIN_DELAY_MS);

    return;
  }

  if (!USE_CLOUD_TASKS_WHEN_NOT_EMULATOR) return;

  if (!tasksClient || !CloudTasksClient) {
    throw new Error(
      "Cloud Tasks no disponible. Instala: npm i @google-cloud/tasks"
    );
  }
  if (!PROJECT_ID) throw new Error("PROJECT_ID no disponible en env.");

  const parent = tasksClient.queuePath(PROJECT_ID, REGION, QUEUE_ID);
  const url = `${getBaseUrl(req)}${functionPath}`;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64");

  const task = {
    httpRequest: {
      httpMethod: "POST",
      url,
      headers: { "Content-Type": "application/json" },
      body,
    },
  };

  await tasksClient.createTask({ parent, task });
}

/**
 * =========================================
 * HTTP: Auto-batch por subcategoría
 *
 * ✅ MODO “LEE TODOS”: no se salta IDs
 * - Recorre toda la colección productos por documentId()
 * - Filtra por Subcategoria normalizada (trim/lower/NBSP)
 * - Optimiza los que matchean
 * - No depende de chaining por fetch
 *
 * Uso:
 *  curl -X POST "http://127.0.0.1:5001/<project>/us-central1/optimizeSubcategoryAuto" \
 *    -H "Content-Type: application/json" \
 *    -d '{"subcat":"Vestidos","pageSize":20,"concurrency":3}'
 * =========================================
 */
exports.optimizeSubcategoryAuto = onRequest(
  { memory: MEMORY, timeoutSeconds: TIMEOUT_60_MIN },
  async (req, res) => {
    const startedAt = Date.now();

    try {
      const subcatRaw =
        (typeof req.query.subcat === "string" && req.query.subcat) ||
        (typeof req.body?.subcat === "string" && req.body.subcat) ||
        "Vestidos";

      const subcatNeedle = normalizeSubcat(subcatRaw);

      const pageSizeRaw =
        (typeof req.query.pageSize === "string" && req.query.pageSize) ||
        (typeof req.body?.pageSize === "number" && String(req.body.pageSize)) ||
        String(DEFAULT_PAGE_SIZE);

      const concurrencyRaw =
        (typeof req.query.concurrency === "string" && req.query.concurrency) ||
        (typeof req.body?.concurrency === "number" &&
          String(req.body.concurrency)) ||
        String(DEFAULT_CONCURRENCY);

      const pageSize = Math.max(
        1,
        Math.min(MAX_PAGE_SIZE, parseInt(pageSizeRaw, 10) || DEFAULT_PAGE_SIZE)
      );

      const concurrency = Math.max(
        1,
        Math.min(10, parseInt(concurrencyRaw, 10) || DEFAULT_CONCURRENCY)
      );

      // cursor opcional para reanudar
      let startAfterId =
        (typeof req.query.startAfter === "string" && req.query.startAfter) ||
        (typeof req.body?.startAfter === "string" && req.body.startAfter) ||
        null;

      const jobId = jobIdForSubcat(subcatRaw);
      const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);

      // lock solo si es inicio
      if (!startAfterId) {
        const lock = await acquireJobLock(jobRef);
        if (!lock.ok) {
          res.status(409).json({
            ok: false,
            error: "JOB_ALREADY_RUNNING",
            jobId,
            hint:
              "Ya hay un proceso corriendo. Si se quedó colgado, borra jobs/<jobId> en el emulador.",
          });
          return;
        }

        await jobRef.set(
          {
            status: "running",
            subcat: subcatRaw,
            subcatNormalized: subcatNeedle,
            pageSize,
            concurrency,
            cursor: null,
            totals: { scanned: 0, matched: 0, processed: 0, ok: 0, fail: 0 },
            createdAt: FieldValue.serverTimestamp(),
            startedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        await renewJobLock(jobRef);
      }

      let totalsScanned = 0;
      let totalsMatched = 0;
      let totalsProcessed = 0;
      let totalsOk = 0;
      let totalsFail = 0;

      // margen de seguridad
      const HARD_LIMIT_MS = (TIMEOUT_60_MIN - 30) * 1000;

      while (true) {
        if (Date.now() - startedAt > HARD_LIMIT_MS) {
          await jobRef.set(
            {
              status: "paused_timeout",
              cursor: startAfterId,
              updatedAt: FieldValue.serverTimestamp(),
              totals: {
                scanned: FieldValue.increment(totalsScanned),
                matched: FieldValue.increment(totalsMatched),
                processed: FieldValue.increment(totalsProcessed),
                ok: FieldValue.increment(totalsOk),
                fail: FieldValue.increment(totalsFail),
              },
            },
            { merge: true }
          );
          await releaseJobLock(jobRef);

          res.json({
            ok: true,
            done: false,
            reason: "timeout_budget_reached",
            subcat: subcatRaw,
            nextStartAfter: startAfterId,
            scanned: totalsScanned,
            matched: totalsMatched,
            processed: totalsProcessed,
            okCount: totalsOk,
            failCount: totalsFail,
            jobId,
          });
          return;
        }

        // ✅ Escaneo estable por documentId: no se salta IDs
        let q = db
          .collection("productos")
          .orderBy(FieldPath.documentId())
          .limit(pageSize);

        if (startAfterId) {
          const lastRef = db.collection("productos").doc(startAfterId);
          const lastSnap = await lastRef.get();
          if (lastSnap.exists) q = q.startAfter(lastSnap);
        }

        const snap = await q.get();
        if (snap.empty) break;

        const docs = snap.docs;
        startAfterId = docs[docs.length - 1].id;

        const matchedDocs = [];
        for (const d of docs) {
          const data = d.data() || {};
          const s = normalizeSubcat(data.Subcategoria);
          if (s === subcatNeedle) matchedDocs.push(d);
        }

        totalsScanned += docs.length;
        totalsMatched += matchedDocs.length;

        // procesar matcheados con concurrencia controlada
        for (let i = 0; i < matchedDocs.length; i += concurrency) {
          const chunk = matchedDocs.slice(i, i + concurrency);
          const results = await Promise.allSettled(
            chunk.map((d) => optimizeOneProduct(d.id))
          );

          for (const r of results) {
            totalsProcessed++;
            if (r.status === "fulfilled") totalsOk++;
            else totalsFail++;
          }

          // renovar lock periódicamente
          if (Date.now() - startedAt > 60_000) {
            await renewJobLock(jobRef);
          }
        }

        // progreso del job
        await jobRef.set(
          {
            cursor: startAfterId,
            updatedAt: FieldValue.serverTimestamp(),
            lastPage: {
              scannedThisPage: docs.length,
              matchedThisPage: matchedDocs.length,
              processedThisPage: matchedDocs.length,
              at: FieldValue.serverTimestamp(),
            },
            totals: {
              scanned: FieldValue.increment(docs.length),
              matched: FieldValue.increment(matchedDocs.length),
              processed: FieldValue.increment(matchedDocs.length),
              ok: FieldValue.increment(0),
              fail: FieldValue.increment(0),
            },
          },
          { merge: true }
        );
      }

      await jobRef.set(
        {
          status: "done",
          cursor: startAfterId || null,
          finishedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      await releaseJobLock(jobRef);

      res.json({
        ok: true,
        done: true,
        subcat: subcatRaw,
        scanned: totalsScanned,
        matched: totalsMatched,
        processed: totalsProcessed,
        okCount: totalsOk,
        failCount: totalsFail,
        jobId,
      });
    } catch (e) {
      console.error("optimizeSubcategoryAuto error:", e?.message || e);

      try {
        const subcatRaw =
          (typeof req.query.subcat === "string" && req.query.subcat) ||
          (typeof req.body?.subcat === "string" && req.body.subcat) ||
          "Vestidos";

        const jobId = jobIdForSubcat(subcatRaw);
        const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);

        await jobRef.set(
          {
            status: "error",
            error: String(e?.message || e),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        await releaseJobLock(jobRef);
      } catch {}

      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  }
);