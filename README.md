# 🏢 Teamplanner

Moderne **Electron**-Desktop-Anwendung zur Verwaltung von Urlaub, Krankheit, Schulungen und Überstunden.

![Teamplanner](assets/logo_64.png)

## ✨ Features

- 📊 **Übersichtliche Tabelle** mit allen Mitarbeitern und Statistiken
- 🔍 **Such- und Filterfunktionen** nach Name, Abteilung
- 📈 **Automatische Berechnungen** (Urlaubsübertrag, Rest-Urlaub)
- 🎨 **Modernes Dark-Theme** mit Bootstrap 5
- 💾 **SQLite Datenbank** für zuverlässige Datenspeicherung
- 📅 **Jahres-Management** mit dynamischer Übertrag-Berechnung
- 🏭 **Abteilungsverwaltung** mit Farb-Codierung
- 📤 **CSV-Export** für Berichte
- ⚡ **Native Desktop-Performance** dank Electron
- 🖥️ **Cross-Platform**: Windows, macOS, Linux

## 🚀 Schnellstart

### Voraussetzungen

- **Node.js** 18.x oder höher (empfohlen: v22 LTS)
- **npm** (kommt mit Node.js)

### Installation

```bash
# Dependencies installieren (dauert 2-5 Minuten)
npm install

# App starten
npm start
```

**Alternative**: Automatisches Installations-Script

```bash
./install.sh
```

Das Script prüft automatisch:
- ✅ Node.js Version
- ✅ Bekannte Kompatibilitätsprobleme
- ✅ Bereinigt alte node_modules
- ✅ Installiert Dependencies korrekt

## 📦 Production Builds

### Windows Installer

```bash
npm run build:win
```

Erstellt: `dist/Teamplanner Setup.exe`

### macOS App

```bash
npm run build:mac
```

Erstellt: `dist/Teamplanner.dmg`

### Linux AppImage

```bash
npm run build:linux
```

Erstellt: `dist/Teamplanner.AppImage`

## 💡 Verwendung

### 1. Mitarbeiter hinzufügen

1. Klicke auf **"Neuer Mitarbeiter"** (grüner Button oben rechts)
2. Fülle das Formular aus:
   - Mitarbeiter-ID (z.B. "MA001")
   - Vorname, Nachname
   - Abteilung
   - Einstellungsdatum
   - Urlaubstage pro Jahr (Standard: 30)
3. **Speichern**

### 2. Urlaub eintragen

1. Klicke auf das **Kalender-Symbol** 📅 in der Zeile des Mitarbeiters
2. Wähle:
   - Von-Datum
   - Anzahl Tage
   - Optional: Notiz
3. **Speichern**

### 3. Andere Einträge

- 🩹 **Krankheit**: Rotes Pflaster-Symbol
- 📚 **Schulung**: Blaues Buch-Symbol
- ⏰ **Überstunden**: Gelbes Uhr-Symbol

### 4. Daten filtern & suchen

- **Suchfeld**: Suche nach Name, ID oder Abteilung
- **Abteilungs-Filter**: Zeige nur bestimmte Abteilung

### 5. Daten exportieren

**Menü** → **Export** → **Als CSV exportieren**

## 📊 Datenbank-Schema

Die App verwendet **SQLite** mit folgenden Tabellen:

- `mitarbeiter` - Stammdaten (ID, Name, Abteilung, Urlaubstage)
- `abteilungen` - Abteilungen mit Farben
- `urlaub` - Urlaubseinträge (Von-Bis, Tage)
- `krankheit` - Krankheitseinträge
- `schulung` - Schulungen (Datum, Dauer, Titel)
- `ueberstunden` - Überstunden (Datum, Stunden)
- `feiertage` - Feiertage (noch nicht in UI)
- `veranstaltungen` - Veranstaltungen (noch nicht in UI)

**Datenbank-Pfad**:
- **Windows**: `%APPDATA%/Teamplanner/teamplanner_v3.db`
- **macOS**: `~/Library/Application Support/Teamplanner/teamplanner_v3.db`
- **Linux**: `~/.local/share/Teamplanner/teamplanner_v3.db`

## 🔧 Technologien

### Frontend
- **Electron** 28.x - Desktop-Framework
- **Bootstrap 5** - UI-Framework (Dark Theme)
- **Bootstrap Icons** - Icon-Set
- **Vanilla JavaScript** - Kein Framework-Overhead

### Backend
- **better-sqlite3** 11.8.0 - Synchrone SQLite3 Bindings
- **Node.js** - Runtime

### Build
- **electron-builder** - Cross-Platform Packaging

## 📁 Projektstruktur

```
teamplanner/
├── package.json              # Dependencies & Scripts
├── main.js                   # Electron Main Process
├── preload.js                # Sichere IPC Bridge
├── install.sh                # Installations-Script
├── INSTALL.md                # Installations-Anleitung
├── TROUBLESHOOTING.md        # Problem-Lösungen
├── src/
│   ├── index.html            # Haupt-HTML
│   ├── styles/
│   │   └── main.css          # Custom Styles
│   ├── js/
│   │   ├── renderer.js       # App-Orchestrierung
│   │   ├── database.js       # SQLite Wrapper
│   │   ├── data-manager.js   # Business Logic
│   │   └── components/
│   │       ├── mitarbeiter-tabelle.js
│   │       └── dialogs.js
│   └── assets/               # Icons & Logos
├── database/                 # SQLite DB (automatisch erstellt)
├── dist/                     # Build-Ausgabe (ignoriert)
└── archive-python/           # Alte Python-Version (Archiv)
```

## 🎨 Anpassung

### Farben ändern

Bearbeite `src/styles/main.css`:

```css
:root {
  --primary-color: #1f538d;  /* Header */
  --success-color: #28a745;  /* Urlaub */
  --danger-color: #dc3545;   /* Krankheit */
  --warning-color: #ffc107;  /* Überstunden */
  --info-color: #17a2b8;     /* Schulung */
}
```

### Standard-Abteilungen

Bearbeite `src/js/database.js` → `createDefaultDepartments()`:

```javascript
const departments = [
  ['Werkstatt', '#dc3545', 'Werkstatt-Team'],
  ['Büro', '#1f538d', 'Büro-Team'],
  ['Lager', '#28a745', 'Lager-Team'],
  // Füge neue hinzu...
];
```

## 🐛 Troubleshooting

### Installation schlägt fehl

Siehe **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** für detaillierte Lösungen:

- Node.js v24.x C++20 Fehler
- better-sqlite3 Kompilierung
- macOS Xcode Tools
- Windows/Linux Build-Tools

**Schnell-Lösung**:

```bash
# Node.js v22 LTS verwenden (stabilste Option)
nvm install 22
nvm use 22
npm install
```

### App startet nicht

```bash
# Cache löschen
rm -rf node_modules package-lock.json
npm install
```

### Datenbank-Fehler

Datenbank zurücksetzen (⚠️ **Alle Daten gehen verloren!**):

```bash
# macOS/Linux
rm -f ~/Library/Application\ Support/Teamplanner/teamplanner_v3.db*

# Windows (PowerShell)
Remove-Item "$env:APPDATA\Teamplanner\teamplanner_v3.db*"
```

## 📚 Dokumentation

- **[INSTALL.md](INSTALL.md)** - Detaillierte Installations-Anleitung
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Problem-Lösungen & FAQ

## 🗺️ Roadmap

### In Entwicklung
- [ ] Feiertage-Verwaltung (UI)
- [ ] Veranstaltungen-Verwaltung (UI)
- [ ] Stammdaten bearbeiten/löschen (UI)
- [ ] Abteilungen bearbeiten (UI)

### Geplant
- [ ] Detaillierte Einträge-Ansicht (Historie)
- [ ] Kalender-Ansicht
- [ ] Excel-Export
- [ ] PDF-Berichte
- [ ] Benachrichtigungen (Urlaub läuft ab, etc.)
- [ ] Multi-Sprachen Support
- [ ] Auto-Update Funktion
- [ ] Dark/Light Theme Toggle

## 📝 Lizenz

MIT License

## 🤝 Beitragen

Pull Requests sind willkommen! Für größere Änderungen bitte zuerst ein Issue öffnen.

### Entwicklung

```bash
# Development Mode (mit DevTools)
npm start

# Neue Feature entwickeln
git checkout -b feature/mein-feature
# ... Änderungen machen ...
git commit -m "Add: Neue Funktion"
git push origin feature/mein-feature
```

## 📧 Support

Bei Fragen oder Problemen bitte ein **GitHub Issue** erstellen.

## 🎯 Migration von Python-Version

Die **alte Python/CustomTkinter Version** wurde nach `archive-python/` verschoben und ist nicht mehr aktiv.

**Vorteile der Electron-Version**:
- ✅ Cross-Platform (keine separaten Builds)
- ✅ Moderne UI mit Bootstrap
- ✅ Einfachere Wartung (JavaScript statt Python)
- ✅ Native Performance
- ✅ Automatische Updates möglich
- ✅ Webbasierte Technologien (einfacher zu erweitern)

---

**Viel Erfolg mit Teamplanner! 🎉**
