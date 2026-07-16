// Holt den Fahrzeugbestand über die mobile.de Search-API (Inserats-Einbindung,
// Dealer-Account: eigener Bestand) und schreibt src/_data/vehicles.json.
// Zugangsdaten kommen aus GitHub-Secrets: MOBILEDE_USERNAME / MOBILEDE_PASSWORD.
// Bei 0 Treffern oder Fehlern bleibt die bestehende vehicles.json unangetastet.

import { readFileSync, writeFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";

const USER = process.env.MOBILEDE_USERNAME;
const PASS = process.env.MOBILEDE_PASSWORD;
const OUT = new URL("../src/_data/vehicles.json", import.meta.url);

if (!USER || !PASS) {
  console.log("MOBILEDE_USERNAME/MOBILEDE_PASSWORD nicht gesetzt – Sync übersprungen.");
  process.exit(0);
}

const res = await fetch(
  "https://services.mobile.de/search-api/search?page.size=100",
  {
    headers: {
      Authorization: "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64"),
      Accept: "application/vnd.de.mobile.api+xml",
    },
  }
);

const body = await res.text();
if (!res.ok) {
  console.error(`Search-API antwortete mit HTTP ${res.status}.`);
  console.error(body.slice(0, 3000));
  process.exit(1);
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
});
const doc = parser.parse(body);

// Alle <ad>-Knoten einsammeln, egal wie tief sie liegen.
const ads = [];
(function walk(node) {
  if (node == null || typeof node !== "object") return;
  for (const [key, val] of Object.entries(node)) {
    if (key === "ad") ads.push(...(Array.isArray(val) ? val : [val]));
    else walk(val);
  }
})(doc);

if (ads.length === 0) {
  console.error("Keine Inserate in der Antwort gefunden. Antwortauszug:");
  console.error(body.slice(0, 3000));
  process.exit(1);
}

const attr = (node, name) => {
  if (node == null) return "";
  const v = node[`@_${name}`];
  return v == null ? "" : String(v);
};
const val = (node) => attr(node, "value") || attr(node, "key");
const first = (x) => (Array.isArray(x) ? x[0] : x);

const FUEL = {
  PETROL: "Benzin", DIESEL: "Diesel", ELECTRICITY: "Elektro",
  HYBRID: "Hybrid", HYBRID_DIESEL: "Hybrid (Diesel)", LPG: "Autogas", CNG: "Erdgas",
};

// Kuratierte Badges/Featured aus der bestehenden Datei übernehmen (Match über Titel).
let existing = [];
try { existing = JSON.parse(readFileSync(OUT, "utf8")); } catch {}
const keepFor = (title) =>
  existing.find((e) => e.title && title && (title.includes(e.title) || e.title.includes(title)));

const vehicles = ads.map((ad) => {
  const vehicle = ad.vehicle ?? {};
  const specifics = vehicle.specifics ?? vehicle;

  const make = val(vehicle.make) || val(specifics.make);
  const modelDesc = val(vehicle["model-description"]) || val(specifics["model-description"]);
  let title = modelDesc || [make, val(vehicle.model)].filter(Boolean).join(" ");
  if (make && title && !title.toUpperCase().includes(make.toUpperCase())) {
    title = `${make.charAt(0) + make.slice(1).toLowerCase()} ${title}`;
  }

  const firstReg = val(specifics["first-registration"]).replace(/^(\d{4})(\d{2}).*$/, "$2/$1");
  const km = val(specifics.mileage) && Number(val(specifics.mileage)).toLocaleString("de-DE") + " km";
  const kw = Number(val(specifics.power));
  const ps = kw ? `${Math.round(kw * 1.35962)} PS` : "";
  const fuel = FUEL[val(specifics.fuel)] ?? "";
  const accidentFree = val(specifics["damage-unrepaired"]) === "false" ? "Unfallfrei" : "";

  const price = first(ad.price) ?? {};
  const amount = Number(val(price["consumer-price-amount"]) || attr(price, "consumer-price-amount"));
  const vatDeductible = /19/.test(attr(price, "vat-rate") + val(price.vat ?? {}));
  const priceStr = amount ? `${amount.toLocaleString("de-DE")} €${vatDeductible ? "¹" : ""}` : "";

  const images = [];
  (function collectImages(node) {
    if (node == null || typeof node !== "object") return;
    for (const [key, v] of Object.entries(node)) {
      if (key === "representation") {
        for (const rep of Array.isArray(v) ? v : [v]) {
          images.push({ size: attr(rep, "size"), url: attr(rep, "url") });
        }
      } else if (key === "images" || key === "image") collectImages(v);
    }
  })(ad);
  const pref = ["XL", "L", "M", "ICON", "S"];
  images.sort((a, b) => pref.indexOf(a.size) - pref.indexOf(b.size));
  let image = images[0]?.url ?? "";
  if (image.startsWith("//")) image = "https:" + image;

  const detailUrl = attr(ad["detail-page"] ?? {}, "url") || val(ad["detail-page"] ?? {});
  const kept = keepFor(title);

  return {
    featured: kept?.featured ?? false,
    badge: kept?.badge ?? "",
    title,
    text: [accidentFree, firstReg && `EZ ${firstReg}`, km, ps, fuel].filter(Boolean).join(" · "),
    price: priceStr,
    image,
    url: detailUrl,
  };
}).filter((v) => v.title);

if (vehicles.length === 0) {
  console.error(`${ads.length} Inserate empfangen, aber 0 verwertbar – Mapping passt nicht.`);
  console.error("Struktur des ersten Inserats:");
  console.error(JSON.stringify(ads[0], null, 1).slice(0, 4000));
  process.exit(1);
}

// Mindestens 3 Highlights für die Startseite sicherstellen.
if (vehicles.filter((v) => v.featured).length < 3) {
  vehicles.slice(0, 3).forEach((v) => (v.featured = true));
}

writeFileSync(OUT, JSON.stringify(vehicles, null, 2) + "\n");
console.log(`${vehicles.length} Fahrzeuge geschrieben (${vehicles.filter((v) => v.image).length} mit Foto).`);
