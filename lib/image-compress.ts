/**
 * Client-side image compression for 3G/4G uploads (plan § Screen 2).
 * Resizes phone photos > 2048px to JPEG ~quality 0.8, target <= 800 KB when possible.
 */
export async function compressImageFile(file: File, maxEdge = 2048, quality = 0.8): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  if (file.size <= 800 * 1024) {
    // still downscale huge dimensions
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= 800 * 1024) {
    bitmap.close();
    return file;
  }

  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
  );
  if (!blob) return file;
  const name = file.name.replace(/\.\w+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
}

export async function compressUploadList(files: FileList | File[]): Promise<File[]> {
  const out: File[] = [];
  for (const f of Array.from(files)) {
    out.push(await compressImageFile(f));
  }
  return out;
}
