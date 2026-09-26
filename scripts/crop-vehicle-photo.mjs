import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [source, destination, rectArg] = process.argv.slice(2);
if (!source || !destination || !rectArg) {
  console.error("Usage: node crop-vehicle-photo.mjs SOURCE DESTINATION x,y,width,height");
  process.exit(1);
}
const [left, top, width, height] = rectArg.split(",").map(Number);
const meta = await sharp(source).metadata();
if (![left, top, width, height].every(Number.isInteger) ||
    left < 0 || top < 0 || width < 1 || height < 1 ||
    left + width > meta.width || top + height > meta.height) {
  throw new Error("Invalid crop rectangle");
}
await mkdir(path.dirname(destination), { recursive: true });
await sharp(source).extract({ left, top, width, height }).webp({ quality: 91, effort: 5 }).toFile(destination);
console.log(destination);
