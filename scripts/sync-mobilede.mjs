// Holt den Fahrzeugbestand über die mobile.de Search-API (Inserats-Einbindung,
// Dealer-Account: eigener Bestand) und schreibt src/_data/vehicles.json
// (inkl. aller Fotos, Ausstattung, Slug für Detailseiten).
// Verschwundene Fahrzeuge wandern automatisch nach src/_data/sold.json.
// Zugangsdaten: GitHub-Secrets MOBILEDE_USERNAME / MOBILEDE_PASSWORD.
// Bei Fehlern oder unplausiblen Daten bleibt der alte Stand unangetastet.

import { readFileSync, writeFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";

const USER = process.env.MOBILEDE_USERNAME;
const PASS = process.env.MOBILEDE_PASSWORD;
const OUT = new URL("../src/_data/vehicles.json", import.meta.url);
const SOLD = new URL("../src/_data/sold.json", import.meta.url);

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
console.log(`${ads.length} Inserate empfangen. Felder des ersten: ${Object.keys(ads[0]).join(", ").slice(0, 600)}`);

const unwrap = (x) => {
  if (x == null) return "";
  if (typeof x !== "object") return String(x);
  return String(x["@_value"] ?? x["@_key"] ?? x["#text"] ?? "");
};
const pick = (obj, ...keys) => {
  for (const k of keys) if (obj?.[k] != null) return unwrap(obj[k]);
  return "";
};
const deepNumber = (node, pattern) => {
  if (node == null || typeof node !== "object") return NaN;
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
const deepUrls = (node, out = []) => {
  if (node == null) return out;
  if (typeof node === "string") {
    if (/^(https?:)?\/\//.test(node)) out.push(node.startsWith("//") ? "https:" + node : node);
    return out;
  }
  if (typeof node === "object") for (const v of Object.values(node)) deepUrls(v, out);
  return out;
};
const biggest = (urls) => {
  const width = (u) => parseInt(u.match(/rule=mo-(\d+)/)?.[1] ?? "0", 10);
  return urls.sort((a, b) => width(b) - width(a))[0] ?? "";
};

const FUEL = {
  PETROL: "Benzin", DIESEL: "Diesel", ELECTRICITY: "Elektro",
  HYBRID: "Hybrid", HYBRID_DIESEL: "Hybrid (Diesel)", LPG: "Autogas", CNG: "Erdgas",
};
const GEARBOX = { AUTOMATIC_GEAR: "Automatik", SEMIAUTOMATIC_GEAR: "Halbautomatik", MANUAL_GEAR: "Schaltgetriebe" };
const COLORS = { BLACK: "Schwarz", WHITE: "Weiß", SILVER: "Silber", GREY: "Grau", BLUE: "Blau", RED: "Rot", GREEN: "Grün", BEIGE: "Beige", BROWN: "Braun", GOLD: "Gold", YELLOW: "Gelb", ORANGE: "Orange", PURPLE: "Violett" };
const INTERIOR = { LEATHER: "Leder", PARTIAL_LEATHER: "Teilleder", FABRIC: "Stoff", VELOUR: "Velours", ALCANTARA: "Alcantara", OTHER_INTERIOR_TYPE: "Sonstige" };
const FEATURES = {
  abs: "ABS", esp: "ESP", alloyWheels: "Leichtmetallfelgen", navigationSystem: "Navigationssystem",
  electricHeatedSeats: "Sitzheizung", airConditioning: "Klimaanlage", automaticClimatisation: "Klimaautomatik",
  cruiseControl: "Tempomat", electricWindows: "Elektr. Fensterheber", electricExteriorMirrors: "Elektr. Außenspiegel",
  electricAdjustableSeats: "Elektr. Sitzverstellung", centralLocking: "Zentralverriegelung", immobilizer: "Wegfahrsperre",
  alarmSystem: "Alarmanlage", sunroof: "Schiebedach", panoramicGlassRoof: "Panoramadach", leatherSteeringWheel: "Lederlenkrad",
  multifunctionalWheel: "Multifunktionslenkrad", onBoardComputer: "Bordcomputer", paddleShifters: "Schaltwippen",
  sportSeats: "Sportsitze", sportPackage: "Sportpaket", soundSystem: "Soundsystem", cdMultichanger: "CD-Wechsler",
  frontFogLights: "Nebelscheinwerfer", lightSensor: "Lichtsensor", rainSensor: "Regensensor", isofix: "Isofix",
  powerAssistedSteering: "Servolenkung", armRest: "Armlehne", lumbarSupport: "Lordosenstütze",
  heatedWindshield: "Beheizbare Frontscheibe", electricTailgate: "Elektr. Heckklappe", ambientLighting: "Ambientebeleuchtung",
  dimmingInteriorMirror: "Abblendender Innenspiegel", collisionAvoidance: "Kollisionswarner", skiBag: "Skisack",
  performanceHandlingSystem: "Fahrdynamiksystem",
};
const HEADLIGHTS = { BI_XENON_HEADLIGHTS: "Bi-Xenon-Scheinwerfer", XENON_HEADLIGHTS: "Xenon-Scheinwerfer", LED_HEADLIGHTS: "LED-Scheinwerfer", LASER_HEADLIGHTS: "Laserlicht" };
const PARKING = { REAR_VIEW_CAM: "Rückfahrkamera", REAR_SENSORS: "Einparkhilfe hinten", FRONT_SENSORS: "Einparkhilfe vorn", AUTOMATIC_PARKING: "Parkassistent", CAM_360_DEGREES: "360°-Kamera" };
const titleCase = (s) => !s ? "" : s.length <= 3 ? s.toUpperCase() : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const slugify = (s) => s.toLowerCase()
  .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

let existing = [];
try { existing = JSON.parse(readFileSync(OUT, "utf8")); } catch {}
let sold = [];
try { sold = JSON.parse(readFileSync(SOLD, "utf8")); } catch {}
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
  const ps = Number.isFinite(kw) && kw > 0 ? Math.round(kw * 1.35962) : 0;
  const fuel = FUEL[pick(ad, "fuel")] ?? "";
  const accidentFree = pick(ad, "damageUnrepaired") === "false" ? "Unfallfrei" : "";

  const amount = deepNumber(ad.price ?? {}, /amount|gross|consumer/i);
  const vatRate = deepNumber(ad.price ?? {}, /vat/i);
  const priceStr = Number.isFinite(amount) && amount > 0
    ? `${Math.round(amount).toLocaleString("de-DE")} €${vatRate === 19 ? "¹" : ""}`
    : "";

  // Alle Bilder: ad.images.image ist Objekt (1 Bild) oder Array
  let imgNodes = ad.images?.image ?? ad.image ?? [];
  if (!Array.isArray(imgNodes)) imgNodes = [imgNodes];
  const images = imgNodes.map((n) => biggest(deepUrls(n))).filter(Boolean);

  // Ausstattung / Eckdaten für die Detailseite
  const ccm = parseFloat(pick(ad, "cubicCapacity"));
  const specs = [
    ["Erstzulassung", firstReg],
    ["Kilometerstand", km],
    ["Leistung", ps ? `${Math.round(kw)} kW (${ps} PS)` : ""],
    ["Hubraum", Number.isFinite(ccm) && ccm > 0 ? `${ccm.toLocaleString("de-DE")} cm³` : ""],
    ["Getriebe", GEARBOX[pick(ad, "gearbox")] ?? ""],
    ["Kraftstoff", fuel],
    ["Farbe", pick(ad, "manufacturerColorName") || COLORS[pick(ad, "exteriorColor")] || ""],
    ["Innenausstattung", [INTERIOR[pick(ad, "interiorType")], COLORS[pick(ad, "interiorColor")]].filter(Boolean).join(", ")],
    ["Sitze", pick(ad, "seats")],
    ["Vorbesitzer", pick(ad, "numberOfPreviousOwners")],
    ["Schadstoffklasse", pick(ad, "emissionClass").replace("EURO", "Euro ")],
    ["HU", pick(ad, "newHuAu") === "true" ? "Neu bei Übergabe" : ""],
    ["Scheckheftgepflegt", pick(ad, "fullServiceHistory") === "true" ? "Ja" : ""],
    ["Unfallfrei", accidentFree ? "Ja" : ""],
  ].filter(([, v]) => v).map(([label, value]) => ({ label, value }));

  const features = Object.entries(FEATURES)
    .filter(([key]) => pick(ad, key) === "true")
    .map(([, label]) => label);
  const hl = HEADLIGHTS[pick(ad, "headlightType")];
  if (hl) features.push(hl);
  let park = ad.parkingAssistants?.value ?? [];
  if (!Array.isArray(park)) park = [park];
  for (const p of park) if (PARKING[unwrap(p)]) features.push(PARKING[unwrap(p)]);
  features.sort((a, b) => a.localeCompare(b, "de"));

  // Beschreibungstext des Inserats (falls vorhanden), HTML grob entfernen
  const rawDesc = pick(ad, "description", "enrichedDescription", "plainDescription");
  const description = rawDesc
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  const adId = pick(ad, "mobileAdId", "mobile-ad-id", "id");
  const kept = keepFor(title);

  return {
    id: adId,
    slug: slugify(title),
    featured: kept?.featured ?? false,
    badge: kept?.badge ?? "",
    title,
    text: [accidentFree, firstReg && `EZ ${firstReg}`, km, ps ? `${ps} PS` : "", fuel].filter(Boolean).join(" · "),
    price: priceStr,
    image: images[0] ?? "",
    images,
    specs,
    features,
    description,
    url: adId ? `https://suchen.mobile.de/fahrzeuge/details.html?id=${adId}` : "",
  };
}).filter((v) => v.title);

// Volle Fotogalerie + Beschreibung je Inserat über den Detail-Endpunkt nachladen
// (die Listen-Suche liefert nur das Titelbild)
await Promise.all(vehicles.map(async (v) => {
  if (!v.id) return;
  try {
    const r = await fetch(`https://services.mobile.de/search-api/ad/${v.id}`, {
      headers: {
        Authorization: "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64"),
        Accept: "application/vnd.de.mobile.api+xml",
      },
    });
    if (!r.ok) { console.log(`  Detail ${v.id}: HTTP ${r.status} – nutze Titelbild`); return; }
    const detail = parser.parse(await r.text());
    // Alle image-Knoten einsammeln, pro Knoten die größte Variante
    const nodes = [];
    (function findImages(node) {
      if (node == null || typeof node !== "object") return;
      for (const [key, val] of Object.entries(node)) {
        if (key === "image") nodes.push(...(Array.isArray(val) ? val : [val]));
        else findImages(val);
      }
    })(detail);
    const gallery = nodes.map((n) => biggest(deepUrls(n))).filter(Boolean);
    if (gallery.length > v.images.length) { v.images = [...new Set(gallery)]; v.image = v.images[0]; }
    if (!v.description) {
      let d = "";
      (function findDesc(node) {
        if (d || node == null || typeof node !== "object") return;
        for (const [key, val] of Object.entries(node)) {
          if (/description/i.test(key) && typeof (val?.["#text"] ?? val) === "string") { d = String(val?.["#text"] ?? val); return; }
          findDesc(val);
        }
      })(detail);
      v.description = d
        .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    }
  } catch (e) {
    console.log(`  Detail ${v.id}: ${e.message} – nutze Titelbild`);
  }
}));

// Slug-Kollisionen auflösen (zwei gleiche Modelle im Bestand)
const seenSlugs = new Set();
for (const v of vehicles) {
  if (seenSlugs.has(v.slug)) v.slug = `${v.slug}-${String(v.id).slice(-4)}`;
  seenSlugs.add(v.slug);
}

for (const v of vehicles) {
  console.log(`- ${v.title} | ${v.price || "OHNE PREIS"} | ${v.images.length} Fotos | ${v.features.length} Ausstattungen`);
}

if (vehicles.length === 0) {
  console.error("0 verwertbare Inserate – Mapping passt nicht. Struktur des ersten Inserats:");
  console.error(JSON.stringify(ads[0], null, 1).slice(0, 4000));
  process.exit(1);
}
if (vehicles.filter((v) => v.price).length < vehicles.length / 2) {
  console.error("Mehrheit der Inserate ohne Preis – schreibe nichts.");
  process.exit(1);
}

// Verkauft-Archiv: Fahrzeuge, die vorher da waren und jetzt fehlen
const activeIds = new Set(vehicles.map((v) => v.id));
const gone = existing.filter((e) => e.id && !activeIds.has(e.id) && !sold.some((s) => s.id === e.id));
if (gone.length > 0) {
  const today = new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  for (const g of gone) {
    sold.unshift({ id: g.id, title: g.title, text: g.text, image: g.image, soldDate: today });
    console.log(`→ Ins Verkauft-Archiv: ${g.title}`);
  }
  writeFileSync(SOLD, JSON.stringify(sold, null, 2) + "\n");
}

if (vehicles.filter((v) => v.featured).length < 3) {
  vehicles.slice(0, 3).forEach((v) => (v.featured = true));
}

writeFileSync(OUT, JSON.stringify(vehicles, null, 2) + "\n");
console.log(`${vehicles.length} Fahrzeuge geschrieben, ${sold.length} im Verkauft-Archiv.`);
