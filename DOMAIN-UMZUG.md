# Domain-Umzug: automobile-oststeinbek.de → neue Website

**Status: NOCH NICHT AUSFÜHREN.** Erst wenn Patrick die neue Seite freigegeben hat.
Diese Anleitung ist für den Moment, in dem es losgeht. Claude macht Schritt 2;
Schritt 1 und 3 passieren im Registrar-Konto (Patrick, ggf. mit Claude im Chrome).

## Wichtigster Grundsatz: E-Mail nicht anfassen

Die Adresse info@automobile-oststeinbek.de hängt an den **MX-Records** der Domain.
Die werden bei diesem Umzug **nicht verändert** – nur A/CNAME-Einträge für die
Website. Solange niemand MX-Einträge löscht, läuft die E-Mail ununterbrochen weiter.

## Schritt 0: Wo ist die Domain registriert?

Herausfinden, wo die Domain verwaltet wird (dort, wo aktuell auch Wix angebunden
wurde – möglicherweise direkt bei Wix!). Falls die Domain **bei Wix selbst**
registriert ist, empfiehlt sich ein Transfer zu einem normalen Registrar –
oder man ändert nur die DNS-Einträge in der Wix-Domainverwaltung.

## Schritt 1: DNS-Einträge setzen (im Registrar-Konto)

Folgende Einträge für die Website **ersetzen** (alte Wix-A-Records entfernen):

| Typ | Host | Wert |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | aeternuspublishing.github.io |

**NICHT anfassen:** MX-Einträge, TXT/SPF/DKIM-Einträge (E-Mail!).

## Schritt 2: GitHub Pages auf die Domain umstellen (macht Claude)

1. `src/CNAME` mit Inhalt `www.automobile-oststeinbek.de` anlegen, committen
2. Custom Domain im Repo setzen:
   `gh api --method PUT repos/AeternusPublishing/automobile-oststeinbek/pages -f cname=www.automobile-oststeinbek.de`
3. Warten bis Zertifikat ausgestellt ist, dann HTTPS erzwingen:
   `gh api --method PUT repos/AeternusPublishing/automobile-oststeinbek/pages -F https_enforced=true`
4. `pathPrefix` wird durch `configure-pages` automatisch wieder `/` (Custom Domain = Root)

## Schritt 3: Wix-Abo kündigen (Patrick)

Erst NACH erfolgreichem Umzug und ein paar Tagen Beobachtung. Wix-Abo läuft
sonst still weiter und kostet Geld.

## Prüfliste nach dem Umzug

- [ ] https://www.automobile-oststeinbek.de zeigt neue Seite mit gültigem Zertifikat
- [ ] http://automobile-oststeinbek.de leitet auf www weiter
- [ ] Test-E-Mail an info@automobile-oststeinbek.de kommt an
- [ ] Google Search Console: neue Sitemap einreichen (sitemap.xml)
