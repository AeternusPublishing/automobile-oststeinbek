// Holt den Fahrzeugbestand über die mobile.de Search-API (Inserats-Einbindung,
// Dealer-Account: eigener Bestand) und schreibt src/_data/vehicles.json.
// Zugangsdaten kommen aus GitHub-Secrets: MOBILEDE_USERNAME / MOBILEDE_PASSWORD.
// Bei Fehlern oder unplausiblen Daten bleibt die bestehende vehicles.json unangetastet.

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
console.log(`${ads.length} Inserate empfangen.`);
console.log("Preis-Struktur:", JSON.stringify(ads[0].price ?? null).slice(0, 800));
console.log("Bild-Struktur:", JSON.stringify(ads[0].images ?? ads[0].image ?? null).slice(0, 800));

// Wert auspacken: primitive direkt, sonst @_value/@_key/#text.
const unwrap = (x) => {
  if (x == null) return "";
  if (typeof x !== "object") return String(x);
  return String(x["@_value"] ?? x["@_key"] ?? x["#text"] ?? "");
};
// Ersten Wert zu einem der Schlüssel finden (direkt am Objekt).
const pick = (obj, ...keys) => {
  for (const k of keys) if (obj?.[k] != null) return unwrap(obj[k]);
  return "";
};
// Tiefensuche: erste Zahl unter Schlüsseln, die auf ein Muster passen.
const deepNumber = (node, pattern) => {
  if (node == null) return NaN;
  if (typeof node !== "object") return NaN;
  for (const [k, v] of Object.entries(node)) {
    if (pattern.test(k)) {
      const n = parseFloat(unwrap(v));
      if (Number.isFinite(n)) return n;
    }
  }
  for (const v of Object.values(node)) {
    const n = deepNumber(v, pattern);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
};
// Tiefensuche: alle URL-Strings einsammeln.
const deepUrls = (node, out = []) => {
  if (node == null) return out;
  if (typeof node === "string") {
    if (/^(https?:)?\/\//.test(node)) out.push(node.startsWith("//") ? "https:" + node : node);
    return out;
  }
  if (typeof node === "object") for (const v of Object.values(node)) deepUrls(v, out);
  return out;
};

const FUEL = {
  PETROL: "Benzin", DIESEL: "Diesel", ELECTRICITY: "Elektro",
  HYBRID: "Hybrid", HYBRID_DIESEL: "Hybrid (Diesel)", LPG: "Autogas", CNG: "Erdgas",
};
const titleCase = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

// Kuratierte Badges/Featured aus der bestehenden Datei übernehmen (Match über Titel).
let existing = [];
try { existing = JSON.parse(readFileSync(OUT, "utf8")); } catch {}
const keepFor = (title) =>
  existing.find((e) => e.title && title && (title.includes(e.title) || e.title.includes(title)));

const vehicles = ads.map((ad) => {
  const make = pick(ad, "make");
  const modelDesc = pick(ad, "modelDescription", "model-description");
  let title = modelDesc || [titleCase(make), pick(ad, "model")].filter(Boolean).join(" ");
  if (make && title && !title.toUpperCase().includes(make.toUpperCase())) {
    title = `${titleCase(make)} ${title}`;
  }

  const reg = pick(ad, "firstRegistration", "first-registration");
  const firstReg = /^\d{6}/.test(reg) ? `${reg.slice(4, 6)}/${reg.slice(0, 4)}` : "";
  const kmNum = parseFloat(pick(ad, "mileage"));
  const km = Number.isFinite(kmNum) ? kmNum.toLocaleString("de-DE") + " km" : "";
  const kw = parseFloat(pick(ad, "power"));
  const ps = Number.isFinite(kw) && kw > 0 ? `${Math.round(kw * 1.35962)} PS` : "";
  const fuel = FUEL[pick(ad, "fuel")] ?? "";
  const accidentFree = pick(ad, "damageUnrepaired", "damage-unrepaired") === "false" ? "Unfallfrei" : "";

  const amount = deepNumber(ad.price ?? {}, /amount|gross|consumer/i);
  const vatRate = deepNumber(ad.price ?? {}, /vat/i);
  const priceStr = Number.isFinite(amount) && amount > 0
    ? `${Math.round(amount).toLocaleString("de-DE")} €${vatRate === 19 ? "¹" : ""}`
    : "";

  const image = deepUrls(ad.images ?? ad.image ?? null)[0] ?? "";
  const adId = pick(ad, "mobileAdId", "mobile-ad-id", "id");
  const url = adId ? `https://suchen.mobile.de/fahrzeuge/details.html?id=${adId}` : "";

  const kept = keepFor(title);
  return {
    featured: kept?.featured ?? false,
    badge: kept?.badge ?? "",
    title,
    text: [accidentFree, firstReg && `EZ ${firstReg}`, km, ps, fuel].filter(Boolean).join(" · "),
    price: priceStr,
    image,
    url,
  };
}).filter((v) => v.title);

for (const v of vehicles) {
  console.log(`- ${v.title} | ${v.price || "OHNE PREIS"} | Foto: ${v.image ? "ja" : "nein"}`);
}

if (vehicles.length === 0) {
  console.error("0 verwertbare Inserate – Mapping passt nicht. Struktur des ersten Inserats:");
  console.error(JSON.stringify(ads[0], null, 1).slice(0, 4000));
  process.exit(1);
}
if (vehicles.filter((v) => v.price).length < vehicles.length / 2) {
  console.error("Mehrheit der Inserate ohne Preis – schreibe nichts. Preis-Struktur oben prüfen.");
  process.exit(1);
}

// Mindestens 3 Highlights für die Startseite sicherstellen.
if (vehicles.filter((v) => v.featured).length < 3) {
  vehicles.slice(0, 3).forEach((v) => (v.featured = true));
}

writeFileSync(OUT, JSON.stringify(vehicles, null, 2) + "\n");
console.log(`${vehicles.length} Fahrzeuge geschrieben (${vehicles.filter((v) => v.image).length} mit Foto).`);
