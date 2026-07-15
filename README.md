# Automobile Oststeinbek – Website

Statische Website auf Basis von [Eleventy](https://www.11ty.dev/), gehostet über GitHub Pages.
Gleicher Stack-Gedanke wie die AETERNUS-Website: Inhalte sind Code, Änderungen laufen über Git, das Deploy passiert automatisch per GitHub Actions.

## Struktur

```
src/
  _data/site.json       → Kontaktdaten, Navigation (zentral pflegbar)
  _data/vehicles.json   → Fahrzeug-Kacheln (Platzhalter, mit echten Autos ersetzen)
  _includes/base.njk    → gemeinsames Layout (Header, Footer, Navigation)
  assets/css/style.css  → gesamtes Design
  *.njk                 → einzelne Seiten
```

## Lokal entwickeln

```bash
npm install
npm run dev      # Vorschau unter http://localhost:8080
npm run build    # baut nach _site/
```

## Deploy

Push auf `main` → GitHub Actions baut und veröffentlicht automatisch (siehe `.github/workflows/deploy.yml`).

## Noch zu erledigen (Platzhalter)

- Impressum: echte Firmendaten (`src/impressum.njk`)
- Datenschutz: prüfen/ergänzen (`src/datenschutz.njk`)
- Öffnungszeiten (`src/kontakt.njk`)
- Echte Fahrzeuge + Fotos (`src/_data/vehicles.json`)
- mobile.de-Händlerlink & ggf. WhatsApp (`src/_data/site.json`)
- Eigene Domain: `src/CNAME` anlegen + DNS beim Registrar umstellen
