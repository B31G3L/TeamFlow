"""
Datenklassen für Teamplanner V3.0
✅ FIXED: Kompatible Property-Namen für alte GUI
Type-safe, immutable where possible
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional
from enum import Enum


class MitarbeiterStatus(Enum):
    """Status eines Mitarbeiters"""
    AKTIV = "aktiv"
    AUSGESCHIEDEN = "ausgeschieden"


@dataclass
class Abteilung:
    """Abteilung"""
    id: int
    name: str
    farbe_hex: str
    sortierung: int

    def __str__(self) -> str:
        return self.name


@dataclass
class Mitarbeiter:
    """Mitarbeiter - Stammdaten"""
    id: str
    abteilung_id: int
    vorname: str
    nachname: str
    urlaubstage_jahr: int
    eintrittsdatum: date
    status: MitarbeiterStatus

    # Optional
    email: Optional[str] = None
    geburtsdatum: Optional[date] = None
    austrittsdatum: Optional[date] = None

    # Timestamps
    erstellt_am: datetime = field(default_factory=datetime.now)
    aktualisiert_am: datetime = field(default_factory=datetime.now)
    
    @property
    def name(self) -> str:
        """Vollständiger Name"""
        return f"{self.vorname} {self.nachname}"
    
    @property
    def ist_aktiv(self) -> bool:
        """Ist Mitarbeiter aktiv? (Berücksichtigt Austrittsdatum)"""
        if self.status != MitarbeiterStatus.AKTIV:
            return False
        # Wenn austrittsdatum gesetzt ist und in der Vergangenheit liegt, ist MA nicht mehr aktiv
        if self.austrittsdatum and self.austrittsdatum < date.today():
            return False
        return True
    
    def __str__(self) -> str:
        return self.name


@dataclass
class Urlaub:
    """Urlaubseintrag"""
    id: Optional[int]
    mitarbeiter_id: str
    von_datum: date
    bis_datum: date
    tage: float
    notiz: Optional[str] = None
    erfasst_am: datetime = field(default_factory=datetime.now)
    
    @property
    def jahr(self) -> int:
        """Jahr des Eintrags"""
        return self.von_datum.year
    
    def __str__(self) -> str:
        return f"Urlaub {self.von_datum} - {self.bis_datum} ({self.tage} Tage)"


@dataclass
class Krankheit:
    """Krankheitseintrag"""
    id: Optional[int]
    mitarbeiter_id: str
    von_datum: date
    bis_datum: date
    tage: float
    notiz: Optional[str] = None
    erfasst_am: datetime = field(default_factory=datetime.now)
    
    @property
    def jahr(self) -> int:
        return self.von_datum.year
    
    def __str__(self) -> str:
        return f"Krankheit {self.von_datum} - {self.bis_datum} ({self.tage} Tage)"


@dataclass
class Schulung:
    """Schulungseintrag"""
    id: Optional[int]
    mitarbeiter_id: str
    datum: date
    dauer_tage: float
    titel: Optional[str] = None
    anbieter: Optional[str] = None
    notiz: Optional[str] = None
    erfasst_am: datetime = field(default_factory=datetime.now)
    
    @property
    def jahr(self) -> int:
        return self.datum.year
    
    def __str__(self) -> str:
        return f"Schulung {self.titel or 'Unbenannt'} ({self.dauer_tage} Tage)"


@dataclass
class Ueberstunden:
    """Überstunden-Eintrag"""
    id: Optional[int]
    mitarbeiter_id: str
    datum: date
    stunden: float
    notiz: Optional[str] = None
    erfasst_am: datetime = field(default_factory=datetime.now)
    
    @property
    def jahr(self) -> int:
        return self.datum.year
    
    def __str__(self) -> str:
        return f"Überstunden {self.datum} ({self.stunden}h)"


@dataclass
class Feiertag:
    """Feiertag"""
    id: int
    datum: date
    name: str
    bundesland: Optional[str] = None
    aktiv: bool = True
    
    @property
    def ist_bundesweit(self) -> bool:
        return self.bundesland is None
    
    def __str__(self) -> str:
        return f"{self.name} ({self.datum})"


@dataclass
class MitarbeiterStatistik:
    """
    Statistik eines Mitarbeiters für ein Jahr
    ✅ FIXED: Kompatible Properties für alte GUI
    """
    mitarbeiter: Mitarbeiter
    abteilung: Abteilung
    jahr: int
    
    # Urlaubsdaten
    urlaubstage_jahr: int
    urlaub_genommen: float
    uebertrag_vorjahr: float
    
    # Andere
    krankheitstage: float
    schulungstage: float
    ueberstunden: float
    
    @property
    def verfuegbar(self) -> float:
        """Verfügbare Urlaubstage"""
        return self.urlaubstage_jahr + self.uebertrag_vorjahr
    
    @property
    def verbleibend(self) -> float:
        """Verbleibende Urlaubstage"""
        return self.verfuegbar - self.urlaub_genommen
    
    # ✅ FIXED: Alias für alte GUI (verbleibende_urlaubstage)
    @property
    def verbleibende_urlaubstage(self) -> float:
        """
        Alias für verbleibend (Kompatibilität mit alter GUI)
        """
        return self.verbleibend
    
    # ✅ FIXED: Alias für alte GUI (verfuegbare_urlaubstage)
    @property
    def verfuegbare_urlaubstage(self) -> float:
        """
        Alias für verfuegbar (Kompatibilität mit alter GUI)
        """
        return self.verfuegbar
    
    @property
    def urlaubsquote(self) -> float:
        """Prozent genommener Urlaub"""
        if self.verfuegbar == 0:
            return 0.0
        return (self.urlaub_genommen / self.verfuegbar) * 100
    
    @property
    def status(self) -> str:
        """Status-Text"""
        verbleibend = self.verbleibend
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
            return "#e74c3c"
        elif status == "Kritisch":
            return "#e67e22"
        else:
            return "#27ae60"


@dataclass
class Veranstaltung:
    """Veranstaltung"""
    id: Optional[int]
    name: str
    von_datum: date
    bis_datum: date
    ort: Optional[str] = None
    beschreibung: Optional[str] = None
    max_teilnehmer: Optional[int] = None
    erfasst_am: datetime = field(default_factory=datetime.now)

    @property
    def jahr(self) -> int:
        """Jahr der Veranstaltung"""
        return self.von_datum.year

    @property
    def dauer_tage(self) -> int:
        """Dauer in Tagen"""
        return (self.bis_datum - self.von_datum).days + 1

    def __str__(self) -> str:
        if self.von_datum == self.bis_datum:
            return f"{self.name} ({self.von_datum})"
        return f"{self.name} ({self.von_datum} - {self.bis_datum})"


@dataclass
class TeamStatistik:
    """Team-Gesamtstatistik für ein Jahr"""
    jahr: int
    mitarbeiter_anzahl: int
    gesamt_urlaub: float
    gesamt_krank: float
    gesamt_schulung: float
    gesamt_ueberstunden: float
    durchschnitt_urlaub: float