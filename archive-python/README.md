# 📦 Python/CustomTkinter Version (Archiviert)

Dies ist die **archivierte Python-Version** von Teamplanner.

## ⚠️ Hinweis

Diese Version wird **nicht mehr aktiv entwickelt**.

Die **aktive Entwicklung** läuft jetzt in der **Electron-Version** im Hauptverzeichnis (`../`).

## Warum wurde gewechselt?

### Vorteile der Electron-Version:

✅ **Cross-Platform**: Ein Build für alle Plattformen
✅ **Moderne UI**: Bootstrap statt CustomTkinter
✅ **Web-Technologie**: Einfacher zu erweitern
✅ **Native Performance**: Schneller & responsive
✅ **Auto-Updates**: Möglich mit Electron
✅ **Community**: Größere Entwickler-Community

### Nachteile der Python-Version:

❌ Separate Builds für Windows/macOS/Linux nötig
❌ CustomTkinter schwieriger zu stylen
❌ Keine Web-Integration möglich
❌ PyInstaller Builds oft groß

## Alte Python-Version starten

**Nur für Archiv-Zwecke!**

```bash
cd archive-python

# Virtual Environment erstellen
python -m venv venv

# Aktivieren
# Linux/macOS:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Dependencies installieren
pip install -r requirements.txt

# Starten
python main.py
```

## Dokumentation

Siehe [README-python.md](README-python.md) für die alte Dokumentation.

## Migration

Die **SQLite-Datenbank** ist kompatibel zwischen beiden Versionen!

Du kannst die Datenbank aus der Python-Version in die Electron-Version kopieren:

```bash
# macOS/Linux
cp data/teamplanner_data_2025.csv \
   ~/Library/Application\ Support/Teamplanner/teamplanner_v3.db

# Hinweis: Das Datenbankschema wurde in v3 verbessert,
# daher ist eine Migration erforderlich.
```

---

**Bitte nutze die neue Electron-Version!**

Siehe: [../README.md](../README.md)
