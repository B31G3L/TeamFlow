# 🔧 Troubleshooting Guide

## Problem: `better-sqlite3` kompiliert nicht

### ❌ Fehler: "C++20 or later required"

**Ursache**: Node.js v24.x erfordert C++20, aber better-sqlite3 ist nicht kompatibel.

**Lösung 1: better-sqlite3 aktualisieren** (bereits erledigt in v1.0.0)

Die `package.json` verwendet bereits `better-sqlite3@^11.8.0`, die mit Node.js v24 kompatibel ist.

```bash
cd electron-app
rm -rf node_modules package-lock.json
npm install
```

**Lösung 2: Node.js v22 LTS verwenden** (empfohlen)

```bash
# Mit nvm (Node Version Manager)
nvm install 22
nvm use 22

# Oder direkt von nodejs.org
# https://nodejs.org/en/download/
```

Dann:
```bash
npm install
```

### ❌ Fehler: "node-gyp rebuild failed"

**macOS:**

```bash
# 1. Xcode Command Line Tools neu installieren
sudo rm -rf /Library/Developer/CommandLineTools
xcode-select --install

# 2. Nach Installation:
npm install
```

**Alternative (macOS):**
```bash
# Homebrew Python installieren
brew install python@3.11

# Dann:
npm install
```

### ❌ Fehler: "No Xcode or CLT version detected"

```bash
# Xcode installieren (aus App Store) ODER
xcode-select --install

# Xcode-Lizenz akzeptieren
sudo xcodebuild -license accept
```

## Problem: Node.js Version

### Node.js zu alt (< 18.x)

```bash
# Aktuelle Version installieren
# https://nodejs.org/

# Mit nvm:
nvm install 22
nvm use 22
```

### Node.js zu neu (v24.x Probleme)

```bash
# Auf v22 LTS wechseln
nvm install 22
nvm use 22

# Als Standard setzen
nvm alias default 22
```

## Problem: Electron startet nicht

### Fehler beim Starten

**1. Cache löschen:**
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

**2. Electron neu installieren:**
```bash
npm uninstall electron
npm install electron@latest
```

**3. Mit Verbose-Output starten:**
```bash
npm start -- --verbose
```

## Problem: Datenbank-Fehler

### "SQLITE_CANTOPEN" oder "unable to open database file"

**Ursache**: Keine Schreibrechte im Datenbank-Ordner.

**Lösung:**

```bash
# Prüfe Datenbank-Pfad (wird beim Start ausgegeben)
# macOS: ~/Library/Application Support/Teamplanner/
# Windows: %APPDATA%/Teamplanner/
# Linux: ~/.local/share/Teamplanner/

# Erstelle Ordner manuell
mkdir -p ~/Library/Application\ Support/Teamplanner

# Prüfe Rechte
ls -la ~/Library/Application\ Support/Teamplanner
```

### Datenbank zurücksetzen (ALLE DATEN GEHEN VERLOREN!)

```bash
# macOS
rm -f ~/Library/Application\ Support/Teamplanner/teamplanner_v3.db*

# Windows (PowerShell)
Remove-Item "$env:APPDATA\Teamplanner\teamplanner_v3.db*"

# Linux
rm -f ~/.local/share/Teamplanner/teamplanner_v3.db*
```

## Problem: Build schlägt fehl

### "electron-builder" Fehler

**1. Dependencies installieren:**
```bash
# macOS
# Keine zusätzlichen Dependencies nötig

# Linux (Ubuntu/Debian)
sudo apt-get install -y rpm

# Windows
# Keine zusätzlichen Dependencies nötig
```

**2. Build-Cache löschen:**
```bash
rm -rf dist/
npm run build
```

## Automatisches Installations-Script

```bash
# Macht alle Checks automatisch
./install.sh
```

Das Script:
- ✅ Prüft Node.js Version
- ✅ Warnt bei bekannten Problemen
- ✅ Löscht alte node_modules
- ✅ Installiert Dependencies
- ✅ Gibt hilfreiche Fehlermeldungen

## Noch Probleme?

### Debug-Informationen sammeln

```bash
# System-Info
node --version
npm --version
electron --version
uname -a

# Build-Logs
npm install --verbose > install.log 2>&1

# Dann install.log hochladen/teilen
```

### Bekannte Kompatibilitäts-Matrix

| Node.js | better-sqlite3 | Electron | Status |
|---------|----------------|----------|--------|
| v18.x   | ^9.2.2        | ^28.0.0  | ✅ OK   |
| v20.x   | ^9.2.2        | ^28.0.0  | ✅ OK   |
| v22.x   | ^11.8.0       | ^28.0.0  | ✅ OK   |
| v24.x   | ^11.8.0       | ^28.0.0  | ✅ OK   |
| v24.x   | ^9.2.2        | ^28.0.0  | ❌ FAIL |

**Empfehlung**: Node.js **v22 LTS** + better-sqlite3 **v11.8.0**

## Kontakt

Bei weiteren Problemen bitte ein Issue erstellen mit:
- Node.js Version (`node --version`)
- npm Version (`npm --version`)
- Betriebssystem (macOS/Windows/Linux)
- Fehler-Log (`install.log`)

---

**Viel Erfolg! 🎉**
