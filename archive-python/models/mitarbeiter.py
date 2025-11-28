"""
Mitarbeiter-Datenmodelle mit Urlaubsübertrag
✅ FIXED: Kompatible Properties für V3-Migration
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class Mitarbeiter:
    """Basis-Mitarbeiterdaten"""
    id: str
    name: str
    urlaubstage_jahr: int = 30
    abteilung: str = ""
    
    @property
    def vorname(self) -> str:
        """Extrahiert Vorname aus dem Namen"""
        return self.name.split()[0] if self.name else ""
    
    @property
    def nachname(self) -> str:
        """Extrahiert Nachname aus dem Namen"""
        parts = self.name.split()
        return parts[-1] if len(parts) > 1 else ""


@dataclass
class MitarbeiterStatistik:
    """
    Statistiken eines Mitarbeiters mit Urlaubsübertrag
    ✅ FIXED: Kompatible Properties für V3
    """
    mitarbeiter: Mitarbeiter
    urlaub_genommen: float = 0.0
    krankheitstage: float = 0.0
    schulungstage: float = 0.0
    ueberstunden: float = 0.0
    uebertrag_vorjahr: float = 0.0
    
    @property
    def verfuegbare_urlaubstage(self) -> float:
        """Berechnet verfügbare Urlaubstage inkl. Übertrag"""
        return self.mitarbeiter.urlaubstage_jahr + self.uebertrag_vorjahr
    
    # ✅ FIXED: Alias für V3 (verfuegbar)
    @property
    def verfuegbar(self) -> float:
        """
        Alias für verfuegbare_urlaubstage (Kompatibilität mit V3)
        """
        return self.verfuegbare_urlaubstage
    
    @property
    def verbleibende_urlaubstage(self) -> float:
        """Berechnet verbleibende Urlaubstage"""
        return self.verfuegbare_urlaubstage - self.urlaub_genommen
    
    # ✅ FIXED: Alias für V3 (verbleibend)
    @property
    def verbleibend(self) -> float:
        """
        Alias für verbleibende_urlaubstage (Kompatibilität mit V3)
        """
        return self.verbleibende_urlaubstage
    
    @property
    def urlaubsquote(self) -> float:
        """Prozentsatz des genommenen Urlaubs"""
        if self.verfuegbare_urlaubstage == 0:
            return 0.0
        return (self.urlaub_genommen / self.verfuegbare_urlaubstage) * 100
    
    @property
    def status(self) -> str:
        """Status-Beschreibung"""
        verbleibend = self.verbleibende_urlaubstage
        if verbleibend < 0:
            return "Überzogen"
        elif verbleibend < 5:
            return "Kritisch"
        else:
            return "OK"
    
    @property
    def status_farbe(self) -> str:
        """Farbe für Status"""
        status = self.status
        if status == "Überzogen":
            return "#e74c3c"  # Rot
        elif status == "Kritisch":
            return "#e67e22"  # Orange
        else:
            return "#27ae60"  # Grün