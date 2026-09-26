import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [backgroundPath, cutoutPath, outputPath, widthArg, shadowArg] = process.argv.slice(2);
if (!backgroundPath || !cutoutPath || !outputPath) {
  console.error("Usage: node compose-car-on-background.mjs BACKGROUND CUTOUT OUTPUT [car-width]");
  process.exit(1);
}

const W = 1600;
const H = 1067;
const carWidth = Number(widthArg || 1480);
if (!Number.isFinite(carWidth) || carWidth < 500 || carWidth > W) {
  throw new Error("car-width must be between 500 and 1600");
}

const { data, info } = await sharp(cutoutPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
let left = width;
let top = height;
let right = 0;
let bottom = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * channels + 3] < 96) continue;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
}
if (left >= right || top >= bottom) throw new Error("No opaque vehicle found");

const trimmed = sharp(cutoutPath).extract({ left, top, width: right - left + 1, height: bottom - top + 1 });
const cropWidth = right - left + 1;
const cropHeight = bottom - top + 1;
const scale = Math.min(carWidth / cropWidth, 900 / cropHeight);
const targetWidth = Math.round(cropWidth * scale);
const targetHeight = Math.round(cropHeight * scale);
const vehicle = await trimmed.resize(targetWidth, targetHeight).png().toBuffer();
const x = Math.round((W - targetWidth) / 2);
const y = H - targetHeight - 42;

// Contact shadows are separate layers; the vehicle pixels remain untouched.
const shadowPoints = shadowArg
  ? shadowArg.split("/").map((item) => item.split(",").map(Number))
  : [[W / 2, H - 46, targetWidth * 0.4, 29]];
if (shadowPoints.some((point) => point.length !== 4 || point.some((n) => !Number.isFinite(n)))) {
  throw new Error("Shadows must be x,y,rx,ry/x,y,rx,ry");
}
const ellipses = shadowPoints.map(([cx, cy, rx, ry]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#111a23" opacity="0.52" filter="url(#b)"/>`).join("");
const shadow = Buffer.from(`<svg width="${W}" height="${H}"><defs><filter id="b"><feGaussianBlur stdDeviation="10"/></filter></defs>${ellipses}</svg>`);
await mkdir(path.dirname(outputPath), { recursive: true });
await sharp(backgroundPath)
  .resize(W, H, { fit: "cover" })
  .composite([{ input: shadow }, { input: vehicle, left: x, top: y }])
  .webp({ quality: 90, effort: 5 })
  .toFile(outputPath);
console.log(`${outputPath}: ${targetWidth}x${targetHeight} at ${x},${y}`);
