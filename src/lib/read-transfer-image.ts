"use client";
export async function readTransferImage(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 8_000_000) throw new Error("INVALID_IMAGE");
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 25_000_000) throw new Error("INVALID_IMAGE");
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d", {willReadFrequently:true}); if (!context) throw new Error("INVALID_IMAGE");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height), {default:jsQR} = await import("jsqr");
    const qr = jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:"attemptBoth"});
    if (!qr) throw new Error("QR_NOT_FOUND"); return qr.data;
  } finally { bitmap.close(); }
}
