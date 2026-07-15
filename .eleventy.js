module.exports = function (eleventyConfig) {
  // Statische Assets 1:1 kopieren (CSS, Bilder, Schriften, CNAME etc.)
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy("src/CNAME");
  eleventyConfig.addPassthroughCopy("src/robots.txt");

  // Aktuelles Jahr für den Footer
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

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
