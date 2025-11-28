# 🚀 Schnellstart-Anleitung

## Installation und Start in 3 Schritten

### 1️⃣ Dependencies installieren

```bash
cd electron-app
npm install
```

**Hinweis**: Der erste `npm install` kann 2-5 Minuten dauern, da `better-sqlite3` kompiliert werden muss.

### 2️⃣ App starten

```bash
npm start
```

Die Anwendung öffnet sich automatisch!

### 3️⃣ (Optional) Build für Distribution

**Windows Installer erstellen:**
```bash
npm run build:win
```

**macOS App erstellen:**
```bash
npm run build:mac
```

**Linux AppImage erstellen:**
```bash
npm run build:linux
```

Die fertigen Apps findest du dann im `dist/` Ordner.

---

## 🎯 Erste Schritte in der App

1. **Mitarbeiter hinzufügen**
   - Klicke auf "Neuer Mitarbeiter" (grüner Button)
   - Fülle das Formular aus
   - Speichern

2. **Urlaub eintragen**
   - Klicke auf das Kalender-Symbol in der Zeile des Mitarbeiters
   - Wähle Datum und Anzahl Tage
   - Speichern

3. **Daten filtern**
   - Nutze das Suchfeld oben links
   - Wähle eine Abteilung im Dropdown

4. **Daten exportieren**
   - Menü: Export → Als CSV exportieren
   - Wähle Speicherort

---

## ❓ Probleme?

### better-sqlite3 Installation schlägt fehl

**Lösung**: Build-Tools installieren

**Windows:**
```bash
npm install --global windows-build-tools
```

**macOS:**
```bash
xcode-select --install
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install build-essential python3
```

Dann nochmal:
```bash
npm install
```

### App startet nicht

1. Prüfe Node.js Version:
   ```bash
   node --version
   ```
   Sollte >= 18.x sein

2. Dependencies neu installieren:
   ```bash
   rm -rf node_modules
   npm install
   ```

### Datenbank-Fehler

Die Datenbank wird automatisch erstellt. Prüfe ob du Schreibrechte im Ordner hast:

**Windows**: `%APPDATA%/Teamplanner/`
**macOS**: `~/Library/Application Support/Teamplanner/`
**Linux**: `~/.local/share/Teamplanner/`

---

## 📚 Weitere Informationen

Siehe [README.md](README.md) für ausführliche Dokumentation.

---

**Viel Erfolg! 🎉**
