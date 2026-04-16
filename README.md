# TeamFlow

Moderne Desktop-Anwendung zur Verwaltung von **Urlaub, Krankheit, Schulungen und Überstunden** – gebaut mit Electron, SQLite und Bootstrap.

## Features

- **Urlaubsplaner** – Jahresübersicht je Mitarbeiter mit Resturlaub, Übertrag und Verfallslogik (31.03.)
- **Abwesenheitsverwaltung** – Urlaub, Krankheit, Schulungen und Überstunden erfassen und bearbeiten
- **Kalenderansicht** – Monats- und Listenansicht aller Abwesenheiten mit Abteilungsfilter
- **Stammdaten** – Mitarbeiter mit Arbeitszeitmodell, Adresse, Gehalt und Wochenplan
- **Export** – Excel (.xlsx) und PDF für Zeitraums- und Jahresübersichten
- **Feiertage & Veranstaltungen** – werden bei der Urlaubsberechnung automatisch berücksichtigt
- **Abteilungen** – farbcodiert, beliebig konfigurierbar
- **Portable** – läuft als einzelne `.exe` ohne Installation, Datenbank liegt neben der `.exe`

## Voraussetzungen

- [Node.js](https://nodejs.org/) ≥ 18
- Python 3 mit `reportlab` und `openpyxl` (für Exporte im Entwicklungsmodus)

```bash
pip install reportlab openpyxl
```

## Installation & Start (Entwicklung)

```bash
git clone https://github.com/youruser/teamflow.git
cd teamflow/01_Source
npm install
npm start
```

## Build (Windows Portable .exe)

```bash
npm run build
```

Die fertige `TeamFlow.exe` liegt anschließend im `dist/`-Ordner. Die Python-Export-Skripte müssen vorher mit PyInstaller kompiliert werden:

```bash
cd scripts
pyinstaller export_to_excel.spec
pyinstaller export_to_pdf.spec
pyinstaller export_employee_detail.spec
pyinstaller export_employee_year.spec
pyinstaller export_employee_year_excel.spec
```

Die erzeugten `.exe`-Dateien kommen in den `scripts/`-Ordner, bevor `npm run build` ausgeführt wird.

## Projektstruktur

```
01_Source/
├── main.js              # Electron Main Process
├── preload.js           # IPC Bridge
├── src/
│   ├── index.html
│   ├── js/
│   │   ├── renderer.js          # App-Einstiegspunkt
│   │   ├── data-manager.js      # Business Logic
│   │   ├── database.js          # IPC-Wrapper
│   │   ├── format-utils.js
│   │   └── components/          # Dialoge & Ansichten
│   └── styles/
└── scripts/             # Python-Exportskripte
```

## Lizenz

GNU General Public License v3.0 – siehe [LICENSE](LICENSE).