"""
Utility-Funktionen für V3
"""

from datetime import date, timedelta  
from typing import List, Tuple
from models.entities import Feiertag


def berechne_werktage_simple(von: date, bis: date) -> int:
    """
    Einfache Werktage-Berechnung ohne Feiertage
    Mo-Fr = Werktage
    
    Args:
        von: Startdatum
        bis: Enddatum
    
    Returns:
        Anzahl Werktage
    """
    if von > bis:
        return 0
    
    tage = (bis - von).days + 1
    volle_wochen, rest = divmod(tage, 7)
    werktage = volle_wochen * 5
    
    for i in range(rest):
        if (von + timedelta(days=i)).weekday() < 5:
            werktage += 1
    
    return werktage


def berechne_werktage_mit_feiertagen(von: date, bis: date, 
                                     feiertage: List[Feiertag]) -> int:
    """
    Werktage-Berechnung MIT Feiertagen
    
    Args:
        von: Startdatum
        bis: Enddatum
        feiertage: Liste von Feiertagen
    
    Returns:
        Anzahl Werktage
    """
    feiertage_set = {f.datum for f in feiertage if f.aktiv}
    
    werktage = 0
    aktuell = von
    
    while aktuell <= bis:
        # Mo-Fr UND kein Feiertag
        if aktuell.weekday() < 5 and aktuell not in feiertage_set:
            werktage += 1
        
        aktuell += timedelta(days=1)
    
    return werktage


def addiere_werktage(start: date, werktage: int, 
                    feiertage: List[Feiertag] = None) -> date:
    """
    Addiert X Werktage auf ein Datum
    
    Args:
        start: Startdatum
        werktage: Anzahl Werktage
        feiertage: Optional - Liste von Feiertagen
    
    Returns:
        End-Datum
    """
    if feiertage:
        feiertage_set = {f.datum for f in feiertage if f.aktiv}
    else:
        feiertage_set = set()
    
    aktuell = start
    gezaehlt = 0
    
    while gezaehlt < werktage:
        aktuell += timedelta(days=1)
        
        # Werktag UND kein Feiertag
        if aktuell.weekday() < 5 and aktuell not in feiertage_set:
            gezaehlt += 1
    
    return aktuell


def formatiere_zeitraum(von: date, bis: date) -> str:
    """
    Formatiert Zeitraum für Anzeige
    
    Args:
        von: Von-Datum
        bis: Bis-Datum
    
    Returns:
        Formatierter String
    """
    if von == bis:
        return von.strftime("%d.%m.%Y")
    
    # Gleicher Monat
    if von.year == bis.year and von.month == bis.month:
        return f"{von.day}. - {bis.strftime('%d.%m.%Y')}"
    
    # Gleic Jahr
    if von.year == bis.year:
        return f"{von.strftime('%d.%m.')} - {bis.strftime('%d.%m.%Y')}"
    
    # Verschiedene Jahre
    return f"{von.strftime('%d.%m.%Y')} - {bis.strftime('%d.%m.%Y')}"


def validiere_zeitraum(von: date, bis: date) -> Tuple[bool, str]:
    """
    Validiert Zeitraum
    
    Args:
        von: Von-Datum
        bis: Bis-Datum
    
    Returns:
        (ist_valid, fehler_nachricht)
    """
    if von > bis:
        return False, "Von-Datum muss vor Bis-Datum liegen"
    
    # Max 1 Jahr
    if (bis - von).days > 365:
        return False, "Zeitraum darf maximal 1 Jahr sein"
    
    # Nicht zu weit in der Zukunft (2 Jahre)
    heute = date.today()
    if von > heute + timedelta(days=730):
        return False, "Datum liegt zu weit in der Zukunft"
    
    return True, ""