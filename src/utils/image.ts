/**
 * Image loading utilities using sharp.
 */
import sharp from "sharp";

export interface RawImageData {
  /** Raw pixel buffer, 3 bytes per pixel (RGB) */
  data: Buffer;
  width: number;
  height: number;
  /** Original image dimensions before resize */
  originalWidth: number;
  originalHeight: number;
}

/**
 * Load an image and return raw RGB pixel data at the given size.
 * Resizing to a small size (e.g. 100x100) makes analysis fast.
 */
export async function loadImage(
  imagePath: string,
  resizeTo: number = 100
): Promise<RawImageData> {
  const metadata = await sharp(imagePath).metadata();
  const originalWidth = metadata.width ?? resizeTo;
  const originalHeight = metadata.height ?? resizeTo;

  const { data, info } = await sharp(imagePath)
    .resize(resizeTo, resizeTo, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data,
    width: info.width,
    height: info.height,
    originalWidth,
    originalHeight,
  };
}

/** Get pixel RGB at (x, y). */
export function getPixel(
  img: RawImageData,
  x: number,
  y: number
): [number, number, number] {
  const idx = (y * img.width + x) * 3;
  return [img.data[idx], img.data[idx + 1], img.data[idx + 2]];
}
