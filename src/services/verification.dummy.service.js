const LS_VERIF = "chekea_verifications_v1";

function readV() {
  try { return JSON.parse(localStorage.getItem(LS_VERIF) || "[]"); }
  catch { return []; }
}
function writeV(list) {
  localStorage.setItem(LS_VERIF, JSON.stringify(list));
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export async function uploadVerificationImageDummy({ orderId, file }) {
  await new Promise((r) => setTimeout(r, 250));

  const base64 = await fileToBase64(file);
  const list = readV();
  const id = `verif-${Date.now()}`;

  list.unshift({
    id,
    orderId,
    status: "PENDING",
    imageBase64: base64,
    createdAt: new Date().toISOString(),
  });

  writeV(list);
  return { verificationId: id };
}
