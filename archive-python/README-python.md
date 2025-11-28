# 🏢 Teamplanner - Electron Edition

Moderne Desktop-Anwendung zur Verwaltung von Urlaub, Krankheit, Schulungen und Überstunden - gebaut mit **Electron** und **Bootstrap**.

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

## 🚀 Installation

### Voraussetzungen

- **Node.js** 18.x oder höher
- **npm** oder **yarn**

### Schritt 1: Dependencies installieren

```bash
cd electron-app
npm install
```

Dies installiert:
- Electron
- Bootstrap 5
- Bootstrap Icons
- better-sqlite3 (SQLite Datenbank)
- electron-builder (für Builds)

## 🎯 Verwendung

### Entwicklung starten

```bash
npm start
```

Dies startet die Anwendung im Entwicklungsmodus mit DevTools.

### Production Build erstellen

#### Windows

```bash
npm run build:win
```

Erstellt eine `.exe` Installer-Datei in `dist/`.

#### macOS

```bash
npm run build:mac
```

Erstellt eine `.dmg` Datei in `dist/`.

#### Linux

```bash
npm run build:linux
```

Erstellt eine `.AppImage` Datei in `dist/`.

## 📁 Projektstruktur

```
electron-app/
├── package.json              # Projekt-Konfiguration
├── main.js                   # Electron Main Process
├── preload.js                # IPC Bridge (sicher)
├── src/
│   ├── index.html            # Haupt-HTML
│   ├── styles/
│   │   └── main.css          # Custom Styles
│   ├── js/
│   │   ├── renderer.js       # App-Orchestrierung
│   │   ├── database.js       # SQLite Wrapper
│   │   ├── data-manager.js   # Business Logic
│   │   └── components/
│   │       ├── mitarbeiter-tabelle.js  # Tabellen-Komponente
│   │       └── dialogs.js              # Dialog-System
│   └── assets/
│       └── (Icons, Logos)
├── database/
│   └── teamplanner_v3.db     # SQLite Datenbank (automatisch erstellt)
└── dist/                     # Build-Ausgabe
```

## 🔧 Technologien

### Frontend
- **Electron** - Desktop-Framework
- **Bootstrap 5** - UI-Framework (Dark Theme)
- **Bootstrap Icons** - Icon-Set
- **Vanilla JavaScript** - Keine Framework-Abhängigkeit

### Backend
- **better-sqlite3** - Synchrone SQLite3 Bindings
- **Node.js** - Runtime

### Build
- **electron-builder** - Multi-Plattform Builds

## 💡 Hauptfunktionen

### 1. Mitarbeiter-Verwaltung

- Mitarbeiter hinzufügen
- Stammdaten bearbeiten
- Abteilungen zuweisen
- Urlaubsanspruch festlegen

### 2. Einträge erfassen

- **Urlaub**: Von-Bis mit automatischer Tagesberechnung
- **Krankheit**: Von-Bis mit Notizen
- **Schulung**: Datum, Dauer, Titel
- **Überstunden**: Plus/Minus mit Datum

### 3. Statistiken

- Urlaubsübersicht (Anspruch, Übertrag, Genommen, Rest)
- Krankheitstage
- Schulungstage
- Überstunden-Saldo

### 4. Export

- CSV-Export aller Mitarbeiter-Statistiken
- Jahr-spezifischer Export

## 📊 Datenbank-Schema

Die App verwendet SQLite mit folgenden Tabellen:

- `mitarbeiter` - Stammdaten
- `abteilungen` - Abteilungen mit Farben
- `urlaub` - Urlaubseinträge
- `krankheit` - Krankheitseinträge
- `schulung` - Schulungen
- `ueberstunden` - Überstunden
- `feiertage` - Feiertage
- `veranstaltungen` - Veranstaltungen

## 🎨 Anpassung

### Farben ändern

Bearbeite `src/styles/main.css`:

```css
:root {
  --primary-color: #1f538d;  /* Header-Farbe */
  --success-color: #28a745;  /* Urlaub */
  --danger-color: #dc3545;   /* Krankheit */
  --warning-color: #ffc107;  /* Überstunden */
  --info-color: #17a2b8;     /* Schulung */
}
```

### Standard-Abteilungen ändern

Bearbeite `src/js/database.js`, Methode `createDefaultDepartments()`:

```javascript
const departments = [
  ['Werkstatt', '#dc3545', 'Werkstatt-Team'],
  ['Büro', '#1f538d', 'Büro-Team'],
  ['Lager', '#28a745', 'Lager-Team']
];
```

## 🐛 Debugging

### DevTools öffnen

Die App öffnet automatisch die DevTools im Entwicklungsmodus (`npm start`).

Manuell öffnen: `Ctrl+Shift+I` (Windows/Linux) oder `Cmd+Option+I` (macOS)

### Logs

- **Console Logs**: In DevTools Console
- **Datenbankpfad**: Wird beim Start ausgegeben
- **Fehler**: Werden in der Console angezeigt

### Datenbank-Pfad

Die Datenbank wird gespeichert unter:

- **Windows**: `%APPDATA%/Teamplanner/teamplanner_v3.db`
- **macOS**: `~/Library/Application Support/Teamplanner/teamplanner_v3.db`
- **Linux**: `~/.local/share/Teamplanner/teamplanner_v3.db`

## 🚨 Troubleshooting

### better-sqlite3 Installation schlägt fehl

```bash
npm install --build-from-source better-sqlite3
```

Oder für spezifische Electron-Version:

```bash
npm rebuild --runtime=electron --target=28.0.0 --disturl=https://electronjs.org/headers --build-from-source
```

### App startet nicht

1. Dependencies neu installieren:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. Cache löschen:
   ```bash
   npm cache clean --force
   ```

### Datenbank-Fehler

Datenbank-Datei löschen (Achtung: Alle Daten gehen verloren):

```bash
# Finde Datenbank-Pfad (siehe oben)
# Lösche teamplanner_v3.db
```

## 📝 Lizenz

MIT License

## 🤝 Beitragen

Pull Requests sind willkommen! Für größere Änderungen bitte zuerst ein Issue öffnen.

## 📧 Support

Bei Fragen oder Problemen bitte ein GitHub Issue erstellen.

## 🎯 Roadmap

- [ ] Excel-Export
- [ ] Feiertage-Verwaltung (UI)
- [ ] Veranstaltungen-Verwaltung (UI)
- [ ] Stammdaten-Verwaltung (Bearbeiten/Löschen)
- [ ] Abteilungen-Verwaltung (UI)
- [ ] Detaillierte Einträge-Ansicht (Liste aller Urlaube, etc.)
- [ ] Kalender-Ansicht
- [ ] Benachrichtigungen (z.B. Urlaub läuft ab)
- [ ] Multi-Sprachen Support
- [ ] Auto-Update Funktion

---

**Viel Erfolg mit Teamplanner! 🎉**
