#!/bin/bash

# Teamplanner Electron - Installation Script
# Prüft Voraussetzungen und installiert Dependencies

set -e

echo "🚀 Teamplanner Electron - Installation"
echo "======================================="
echo ""

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Node.js Version prüfen
echo "📦 Prüfe Node.js Version..."
NODE_VERSION=$(node -v)
echo "   Gefunden: $NODE_VERSION"

MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')

if [ "$MAJOR_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Fehler: Node.js >= 18.x erforderlich!${NC}"
    echo "   Bitte installiere eine neuere Version:"
    echo "   https://nodejs.org/"
    exit 1
fi

if [ "$MAJOR_VERSION" -eq 24 ]; then
    echo -e "${YELLOW}⚠️  Warnung: Node.js v24.x ist sehr neu${NC}"
    echo "   Falls Probleme auftreten, verwende Node.js v22 LTS"
    echo "   Mit nvm: nvm install 22 && nvm use 22"
    echo ""
fi

echo -e "${GREEN}✅ Node.js Version OK${NC}"
echo ""

# npm Version
echo "📦 npm Version: $(npm -v)"
echo ""

# Alte node_modules löschen
if [ -d "node_modules" ]; then
    echo "🧹 Lösche alte node_modules..."
    rm -rf node_modules package-lock.json
    echo -e "${GREEN}✅ Bereinigt${NC}"
    echo ""
fi

# Dependencies installieren
echo "📥 Installiere Dependencies..."
echo "   (Dies kann 2-5 Minuten dauern...)"
echo ""

if npm install; then
    echo ""
    echo -e "${GREEN}✅ Installation erfolgreich!${NC}"
    echo ""
    echo "🎉 Bereit zum Starten!"
    echo ""
    echo "Starte die App mit:"
    echo "   npm start"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Installation fehlgeschlagen${NC}"
    echo ""
    echo "Mögliche Lösungen:"
    echo ""
    echo "1️⃣  Xcode Command Line Tools neu installieren (macOS):"
    echo "   sudo rm -rf /Library/Developer/CommandLineTools"
    echo "   xcode-select --install"
    echo ""
    echo "2️⃣  Node.js v22 LTS verwenden:"
    echo "   nvm install 22"
    echo "   nvm use 22"
    echo "   npm install"
    echo ""
    echo "3️⃣  Python 3 installieren (für node-gyp):"
    echo "   brew install python@3.11"
    echo ""
    exit 1
fi
