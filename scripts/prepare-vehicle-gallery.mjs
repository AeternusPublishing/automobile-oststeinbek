import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [sourceDir, targetDir, ...selectedNames] = process.argv.slice(2);
if (!sourceDir || !targetDir || !selectedNames.length) {
  console.error("Usage: node scripts/prepare-vehicle-gallery.mjs SOURCE TARGET IMAGE...");
  process.exit(1);
}

const available = new Set(await readdir(sourceDir));
for (const name of selectedNames) {
  if (!available.has(name)) throw new Error(`Missing image: ${name}`);
}

await mkdir(targetDir, { recursive: true });
const widths = [360, 640, 1024, 1600];

for (const name of selectedNames) {
  const stem = path.parse(name).name.toLowerCase()
    .replace(/_ohne_spiegelung$/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  for (const width of widths) {
    const output = path.join(targetDir, `${stem}-${width}.webp`);
    await sharp(path.join(sourceDir, name))
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toFile(output);
  }
  console.log(`${name} -> ${stem}-*.webp`);
}
