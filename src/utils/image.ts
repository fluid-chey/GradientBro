/**
 * Image loading utilities using jimp (pure JS, zero native deps).
 * Only the formats and plugins GradientBro needs are loaded.
 */
import { createJimp } from "@jimp/core";
import png from "@jimp/js-png";
import jpeg from "@jimp/js-jpeg";
import * as resize from "@jimp/plugin-resize";

const Jimp = createJimp({ formats: [png, jpeg], plugins: [resize.methods] });

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
  const image = await Jimp.read(imagePath);
  const originalWidth = image.width;
  const originalHeight = image.height;

  // Resize to target dimensions
  image.resize({ w: resizeTo, h: resizeTo });

  const width = image.bitmap.width;
  const height = image.bitmap.height;

  // Convert RGBA (4 bytes/pixel from jimp) to RGB (3 bytes/pixel)
  const rgba = image.bitmap.data;
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i]; // R
    rgb[j + 1] = rgba[i + 1]; // G
    rgb[j + 2] = rgba[i + 2]; // B
  }

  return {
    data: rgb,
    width,
    height,
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
