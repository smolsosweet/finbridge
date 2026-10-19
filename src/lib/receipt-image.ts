import { AI_IMAGE_DATA_URL_LENGTH as maximumDataUrlLength } from "./ai-limits";
export function receiptImageDimensions(width: number, height: number, maximumEdge = 2560) {
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw new Error("INVALID_RECEIPT_IMAGE");
  const scale = Math.min(1, maximumEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("INVALID_RECEIPT_IMAGE"));
    reader.onerror = () => reject(new Error("INVALID_RECEIPT_IMAGE")); reader.readAsDataURL(file);
  });
}
/** Keep small originals unchanged. Bound larger OCR/attachment payloads before
 * upload rather than increasing server limits or discarding a saved receipt. */
export async function prepareReceiptImage(file: File) {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) throw new Error("INVALID_RECEIPT_IMAGE");
  if (file.size * 4 / 3 + 100 <= maximumDataUrlLength) return readDataUrl(file);
  const bitmap = await createImageBitmap(file);
  try {
    for (const maximumEdge of [2560, 2048, 1600]) {
      const size = receiptImageDimensions(bitmap.width, bitmap.height, maximumEdge);
      const canvas = document.createElement("canvas"); canvas.width = size.width; canvas.height = size.height;
      const context = canvas.getContext("2d"); if (!context) throw new Error("INVALID_RECEIPT_IMAGE");
      context.fillStyle = "white"; context.fillRect(0, 0, size.width, size.height); context.drawImage(bitmap, 0, 0, size.width, size.height);
      for (const quality of [0.92, 0.84]) {
        const result = canvas.toDataURL("image/jpeg", quality);
        if (result.startsWith("data:image/jpeg;base64,") && result.length <= maximumDataUrlLength) return result;
      }
    }
    throw new Error("RECEIPT_IMAGE_TOO_LARGE");
  } finally { bitmap.close(); }
}
