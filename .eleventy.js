module.exports = function (eleventyConfig) {
  // Statische Assets 1:1 kopieren (CSS, Bilder, Schriften, CNAME etc.)
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy("src/CNAME");
  eleventyConfig.addPassthroughCopy("src/robots.txt");

  // Aktuelles Jahr für den Footer
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  // mobile.de-CDN-Bilder in passender Größe laden (rule=mo-360/640/1024/1600).
  // Unbekannte URLs bleiben unverändert.
  eleventyConfig.addFilter("imgRule", (url, size) =>
    typeof url === "string" ? url.replace(/rule=mo-\d+\.jpg/, `rule=mo-${size}.jpg`) : url
  );

  // Angereichertes schema.org-Car-Objekt aus den Fahrzeugdaten (Specs stammen aus dem
  // mobile.de-Sync; fehlende Werte werden weggelassen, nie erfunden).
  eleventyConfig.addFilter("vehicleSchema", (v, site, canonicalUrl) => {
    const spec = (label) => {
      const s = (v.specs || []).find((s) => s.label === label);
      return s ? s.value : "";
    };
    const num = (str) => {
      const n = parseInt(String(str).replace(/[^\d]/g, ""), 10);
      return Number.isFinite(n) ? n : null;
    };
    const schema = {
      "@context": "https://schema.org",
      "@type": "Car",
      name: v.title,
      image: v.images || [],
      url: canonicalUrl,
      itemCondition: "https://schema.org/UsedCondition",
    };
    if (v.description) schema.description = v.description.split("\n")[0];
    const reg = spec("Erstzulassung"); // "03/2010" → "2010-03"
    const m = reg.match(/^(\d{2})\/(\d{4})$/);
    if (m) schema.dateVehicleFirstRegistered = `${m[2]}-${m[1]}`;
    const km = num(spec("Kilometerstand"));
    if (km !== null) schema.mileageFromOdometer = { "@type": "QuantitativeValue", value: km, unitCode: "KMT" };
    if (spec("Kraftstoff")) schema.fuelType = spec("Kraftstoff");
    if (spec("Getriebe")) schema.vehicleTransmission = spec("Getriebe");
    if (spec("Farbe")) schema.color = spec("Farbe");
    const owners = num(spec("Vorbesitzer"));
    if (owners !== null) schema.numberOfPreviousOwners = owners;
    const seats = num(spec("Sitze"));
    if (seats !== null) schema.seatingCapacity = seats;
    const kwMatch = spec("Leistung").match(/^(\d+)\s*kW/);
    const ccm = num(spec("Hubraum"));
    if (kwMatch || ccm !== null) {
      schema.vehicleEngine = { "@type": "EngineSpecification" };
      if (kwMatch) schema.vehicleEngine.enginePower = { "@type": "QuantitativeValue", value: parseInt(kwMatch[1], 10), unitCode: "KWT" };
      if (ccm !== null) schema.vehicleEngine.engineDisplacement = { "@type": "QuantitativeValue", value: ccm, unitCode: "CMQ" };
    }
    const price = num(v.price);
    if (price !== null) {
      schema.offers = {
        "@type": "Offer",
        priceCurrency: "EUR",
        price: price,
        itemCondition: "https://schema.org/UsedCondition",
        availability: "https://schema.org/InStock",
        url: canonicalUrl,
        seller: { "@type": "AutoDealer", name: site.name, telephone: site.contact.phone, url: site.url },
      };
    }
    return schema;
  });

  // pathPrefix: lokal "/", auf GitHub Pages (Projektseite) via Umgebungsvariable "/automobile-oststeinbek/"
  const pathPrefix = process.env.ELEVENTY_PATH_PREFIX || "/";

  return {
    pathPrefix,
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
