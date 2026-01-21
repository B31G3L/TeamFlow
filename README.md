<div align="center">
  <img src="assets/icon.ico" alt="TeamFlow Logo" width="128" height="128">
  
  # TeamFlow
  
  ### Moderne Desktop-Anwendung zur Mitarbeiterverwaltung
  
  [![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/deinusername/teamflow)
  [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
  [![Electron](https://img.shields.io/badge/Electron-28.0.0-47848f.svg)](https://electronjs.org/)
  [![Platform](https://img.shields.io/badge/platform-Windows-0078d4.svg)](https://www.microsoft.com/windows)
  
  [Features](#features) • [Installation](#installation) • [Screenshots](#screenshots) • [Technologie](#technologie) • [Lizenz](#lizenz)
</div>

---

## 🎯 Über TeamFlow

TeamFlow ist eine leistungsstarke Desktop-Anwendung zur Verwaltung von Urlaub, Krankheit, Schulungen und Überstunden. Entwickelt mit modernen Web-Technologien bietet TeamFlow eine intuitive Benutzeroberfläche und robuste Funktionalität für kleine bis mittelgroße Teams.

## ✨ Features

### 📊 Kernfunktionen
- **Urlaubsverwaltung** - Automatische Berechnung mit Feiertagen und Übertragungen
- **Arbeitszeitmodelle** - Flexible Wochenplanung (Vollzeit, Teilzeit, individuelle Tage)
- **Krankheitstracking** - Erfassung von Krankheitstagen mit Zeitraumberechnung
- **Schulungsmanagement** - Verwaltung von Weiterbildungen und Seminaren
- **Überstundenerfassung** - Kumulatives Tracking über Jahre hinweg

### 🎨 Benutzeroberfläche
- **Dual-Navigation** - Stammdaten & Urlaubsplaner getrennt
- **Zwei Ansichten** - Tabellenansicht und Monatskalender
- **Dark Theme** - Moderne, augenfreundliche Oberfläche
- **Responsive Design** - Optimiert für verschiedene Bildschirmgrößen

### 📈 Erweiterte Funktionen
- **Detaillierte Statistiken** - Pro Mitarbeiter und Abteilung
- **Feiertags-Integration** - Deutsche Feiertage automatisch berücksichtigt
- **Veranstaltungskalender** - Firmenevents und wichtige Termine
- **Export-Funktionen** - Excel und PDF Export
- **Portable** - Keine Installation erforderlich, läuft von USB-Stick

### 🔐 Datenmanagement
- **SQLite Datenbank** - Schnell, zuverlässig, lokal
- **Portable Mode** - Datenbank liegt neben der .exe
- **Datenintegrität** - Automatische Validierung und Fehlerprüfung
- **Logging System** - Vollständige Nachverfolgbarkeit aller Aktionen

## 📸 Screenshots

<details>
<summary>🖼️ Screenshots anzeigen</summary>

### Hauptansicht - Urlaubsplaner
![Urlaubsplaner](docs/screenshots/urlaubsplaner.png)

### Kalenderansicht
![Kalender](docs/screenshots/kalender.png)

### Stammdaten-Verwaltung
![Stammdaten](docs/screenshots/stammdaten.png)

### Mitarbeiter-Details
![Details](docs/screenshots/details.png)

</details>

## 🚀 Installation

### Voraussetzungen
- Windows 10/11 (64-bit)
- Keine weiteren Abhängigkeiten erforderlich

### Download & Start

1. **Portable Version** (empfohlen)
```
   1. TeamFlow.exe von Releases herunterladen
   2. An gewünschten Ort verschieben
   3. Doppelklick auf TeamFlow.exe
```

2. **Von Source bauen**
```bash
   # Repository klonen
   git clone https://github.com/deinusername/teamflow.git
   cd teamflow/01_Source
   
   # Dependencies installieren
   npm install
   
   # App starten (Development)
   npm start
   
   # Portable bauen
   npm run build
```

## 🛠️ Technologie-Stack

### Frontend
- **Electron** 28.0.0 - Desktop-Framework
- **Bootstrap** 5.3.2 - UI Framework
- **Bootstrap Icons** 1.11.2 - Icon-Set
- **Vanilla JavaScript** - Keine zusätzlichen Frameworks

### Backend
- **Node.js** - Hauptprozess
- **better-sqlite3** 11.8.0 - SQLite Datenbank
- **Python** 3.x - Export-Scripts

### Build & Packaging
- **electron-builder** 24.9.1 - App-Packaging
- **electron-rebuild** 3.2.9 - Native Modules

## 📁 Projekt-Struktur
```
TeamFlow/
├── 01_Source/              # Quellcode
│   ├── main.js            # Electron Main Process
│   ├── preload.js         # IPC Bridge
│   ├── package.json       # Dependencies
│   ├── src/               # Frontend
│   │   ├── index.html     # Hauptseite
│   │   ├── js/            # JavaScript Module
│   │   │   ├── components/    # UI Komponenten
│   │   │   ├── data-manager.js
│   │   │   ├── database.js
│   │   │   └── renderer.js
│   │   └── styles/        # CSS Dateien
│   ├── scripts/           # Python Export-Scripts
│   └── assets/            # Icons & Bilder
├── docs/                  # Dokumentation
└── README.md
```

## 📖 Verwendung

### Erste Schritte

1. **Abteilungen anlegen**
   - Navigation: Stammdaten → Abteilungen
   - Standard-Abteilungen sind bereits vorhanden
   - Eigene Abteilungen mit Farben hinzufügen

2. **Mitarbeiter hinzufügen**
   - Navigation: Stammdaten → Mitarbeiter anlegen
   - Pflichtfelder: Vorname, Nachname, Abteilung, Eintrittsdatum
   - Optional: Geburtsdatum, Urlaubstage, Wochenstunden

3. **Arbeitszeitmodell festlegen**
   - Mitarbeiter-Details öffnen
   - "Arbeitszeitmodell bearbeiten"
   - Wochenplan definieren (VOLL/HALB/FREI pro Wochentag)

4. **Urlaub eintragen**
   - Mitarbeiter in Tabelle anklicken (Spalte "Genommen")
   - Zeitraum wählen
   - Automatische Berechnung unter Berücksichtigung von:
     - Arbeitszeitmodell
     - Feiertagen
     - Wochenenden

### Fortgeschrittene Funktionen

#### Feiertage verwalten
```
Urlaubsplaner → Feiertage → Deutsche Feiertage laden
```
Lädt automatisch alle bundesweiten und regionalen Feiertage für das gewählte Jahr.

#### Übertrag anpassen
```
Mitarbeiter-Details → Übertrag (Stift-Symbol)
```
Manuelles Setzen des Urlaubsübertrags für Sonderfälle.

#### Export erstellen
```
Urlaubsplaner → Excel Export / PDF Export
```
Erstellt formatierte Berichte im Export-Ordner.

## 🤝 Beitragen

Beiträge sind willkommen! Bitte beachte folgende Schritte:

1. Fork das Repository
2. Erstelle einen Feature-Branch (`git checkout -b feature/AmazingFeature`)
3. Commit deine Änderungen (`git commit -m 'Add some AmazingFeature'`)
4. Push zum Branch (`git push origin feature/AmazingFeature`)
5. Öffne einen Pull Request

### Entwicklungs-Guidelines
- Code-Style: JavaScript Standard Style
- Commits: Conventional Commits
- Testing: Manuelle Tests vor PR

## 🐛 Bug Reports

Bugs bitte als [Issue](https://github.com/deinusername/teamflow/issues) melden mit:
- Beschreibung des Problems
- Schritte zur Reproduktion
- Erwartetes vs. tatsächliches Verhalten
- Screenshots (falls relevant)
- Log-Datei (zu finden in `%APPDATA%/teamflow/logs/`)

## 📝 Changelog

Siehe [RELEASES](https://github.com/deinusername/teamflow/releases) für Details zu Änderungen zwischen Versionen.

### Version 1.0.0 (Januar 2026)
- ✨ Initiales Release
- 📊 Urlaubsverwaltung mit Arbeitszeitmodellen
- 📅 Kalenderansicht
- 📈 Detaillierte Statistiken
- 📄 Excel & PDF Export

## 📄 Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert - siehe [LICENSE](LICENSE) für Details.

## 👨‍💻 Autor

**Christian Beigelbeck**
- GitHub: [@deinusername](https://github.com/deinusername)

## 🙏 Danksagungen

- [Electron](https://electronjs.org/) - Desktop-Framework
- [Bootstrap](https://getbootstrap.com/) - UI Components
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite Wrapper
- [Bootstrap Icons](https://icons.getbootstrap.com/) - Icon-Set

---

<div align="center">
  Made with ❤️ in Germany
  
  ⭐ Wenn dir dieses Projekt gefällt, gib ihm einen Stern!
</div>
```

## 2. **Zusätzliche Dateien erstellen**

### LICENSE (MIT)
```
MIT License

Copyright (c) 2026 Christian Beigelbeck

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### .gitignore
```
# Dependencies
node_modules/
package-lock.json

# Build
dist/
build/

# Database
*.db
*.db-shm
*.db-wal
database/

# Logs
logs/
*.log

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Export
Export/
