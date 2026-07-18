// Generiert Open-Graph-Share-Karten (1200x630) pro Fahrzeug:
// Titelbild + Modellname + Preis im "Nacht & Messing"-Look.
// Läuft im Deploy-Workflow VOR dem Eleventy-Build. Fehler bei einzelnen
// Fahrzeugen brechen den Build nicht — dann greift der CDN-Bild-Fallback
// im Template (ogImages.json enthält nur erfolgreich gerenderte Slugs).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.join(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "src", "assets", "og");
const MANIFEST = path.join(ROOT, "src", "_data", "ogImages.json");
const W = 1200, H = 630;

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function overlaySvg(title, price) {
  // Schriftgröße an Titellänge anpassen, damit nichts abgeschnitten wird
  const size = title.length > 34 ? 44 : title.length > 26 ? 52 : 60;
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.45" stop-color="#0d0f12" stop-opacity="0"/>
      <stop offset="0.78" stop-color="#0d0f12" stop-opacity="0.82"/>
      <stop offset="1" stop-color="#0d0f12" stop-opacity="0.96"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <text x="64" y="${H - 138}" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" font-weight="600" letter-spacing="6" fill="#c9a24b">AUTOMOBILE OSTSTEINBEK</text>
  <text x="64" y="${H - 76}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${size}" font-weight="700" fill="#eef0f3">${esc(title)}</text>
  <text x="${W - 64}" y="${H - 76}" text-anchor="end" font-family="DejaVu Sans, Arial, sans-serif" font-size="54" font-weight="700" fill="#e0bd6c">${esc(price)}</text>
</svg>`;
}

async function main() {
  const vehicles = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "_data", "vehicles.json"), "utf8"));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = {};

  for (const v of vehicles) {
    if (!v.image || !v.slug) continue;
    try {
      const res = await fetch(v.image);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // Preis ohne Fußnoten-Zeichen aufs Bild
      const price = (v.price || "").replace("¹", "").trim();
      await sharp(buf)
        .resize(W, H, { fit: "cover", position: "attention" })
        .composite([{ input: Buffer.from(overlaySvg(v.title, price)) }])
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(path.join(OUT_DIR, `${v.slug}.jpg`));
      manifest[v.slug] = `/assets/og/${v.slug}.jpg`;
      console.log(`OG-Karte: ${v.slug}`);
    } catch (err) {
      console.warn(`Übersprungen (${v.slug}): ${err.message}`);
    }
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`${Object.keys(manifest).length}/${vehicles.length} OG-Karten geschrieben.`);
}

main().catch((err) => {
  // Nie den Deploy scheitern lassen — Fallback ist das CDN-Titelbild
  console.error("build-og fehlgeschlagen:", err.message);
  try { fs.writeFileSync(MANIFEST, "{}\n"); } catch {}
});
