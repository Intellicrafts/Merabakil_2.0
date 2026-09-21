/** Client-side profile photo crop, resize, and compression. */

export const PROFILE_AVATAR_SIZE = 512;
export const PROFILE_AVATAR_QUALITY = 0.85;
export const PROFILE_AVATAR_MAX_BYTES = 400_000;

export interface PreparedProfileImage {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not process image"));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

/** Center-crop to square, resize, and compress for upload. */
export async function prepareProfileImage(file: File): Promise<PreparedProfileImage> {
  const img = await loadImageFromFile(file);
  const side = Math.min(img.width, img.height);
  if (!side || !Number.isFinite(side)) {
    // Guard against 0-dimension images (corrupt/undecodable) that would make
    // ctx.drawImage throw IndexSizeError.
    throw new Error("Could not read image dimensions. Please try another photo.");
  }
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  const target = PROFILE_AVATAR_SIZE;

  const canvas = document.createElement("canvas");
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target);

  let blob = await canvasToBlob(canvas, "image/webp", PROFILE_AVATAR_QUALITY);
  if (blob.size > PROFILE_AVATAR_MAX_BYTES) {
    blob = await canvasToBlob(canvas, "image/jpeg", 0.78);
  }
  if (blob.size > PROFILE_AVATAR_MAX_BYTES) {
    blob = await canvasToBlob(canvas, "image/jpeg", 0.65);
  }

  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    width: target,
    height: target,
  };
}

export function revokePreparedProfileImage(prepared: PreparedProfileImage | null): void {
  if (prepared?.previewUrl) URL.revokeObjectURL(prepared.previewUrl);
}
