from typing import List, Optional, Dict
from datetime import datetime, date, timedelta  

from .database_v3 import TeamplannerDatabase, TeamplannerService
from .entities import *


class TeamplannerDataManager:
    
    def __init__(self, jahr: Optional[int] = None, db_path: str = "teamplanner_v3.db"):
        self.aktuelles_jahr = jahr or datetime.now().year
        
        # V3 Database & Service
        self.db = TeamplannerDatabase(db_path)
        self.service = TeamplannerService(self.db)
        
        # Cache
        self._cache_valid = False
        self._stats_cache: Dict[str, MitarbeiterStatistik] = {}
        
        # Kompatibilität: Stammdaten-Dict (für alte GUI)
        self.stammdaten: Dict[str, Dict] = {}
        self.abteilungen: set = set()
        
        # Initial laden
        self._lade_stammdaten()
        
        print(f"✅ DataManager V3 initialisiert (Jahr: {self.aktuelles_jahr})")
    
    # ==================== KOMPATIBILITÄTS-LAYER ====================
    
    def _lade_stammdaten(self):
        """Lädt Stammdaten in Kompatibilitäts-Format"""
        mitarbeiter_liste = self.db.mitarbeiter.get_all()
        
        self.stammdaten.clear()
        self.abteilungen.clear()
        
        for ma in mitarbeiter_liste:
            abteilung = self.db.abteilungen.get_by_id(ma.abteilung_id)
            
            # Format für alte GUI
            self.stammdaten[ma.id] = {
                'vorname': ma.vorname,
                'nachname': ma.nachname,
                'geburtsdatum': ma.geburtsdatum.strftime('%Y-%m-%d') if ma.geburtsdatum else None,
                'einstellungsdatum': ma.eintrittsdatum.strftime('%Y-%m-%d'),
                'austrittsdatum': ma.austrittsdatum.strftime('%Y-%m-%d') if ma.austrittsdatum else None,
                'abteilung': abteilung.name if abteilung else None,
                'urlaubstage_jahr': ma.urlaubstage_jahr
            }
            
            if abteilung:
                self.abteilungen.add(abteilung.name)
    
    def _invalidate_cache(self):
        """Markiert Cache als ungültig"""
        self._cache_valid = False
        self._stats_cache.clear()
    
    def _rebuild_cache(self):
        """Baut Cache neu auf"""
        if self._cache_valid:
            return
        
        # Stammdaten aktualisieren
        self._lade_stammdaten()
        
        # Statistiken laden
        alle_stats = self.service.get_alle_statistiken(self.aktuelles_jahr)
        
        self._stats_cache = {stat.mitarbeiter.id: stat for stat in alle_stats}
        self._cache_valid = True
    
    # ==================== GUI API (Kompatibel mit alter Version) ====================
    
    def get_alle_mitarbeiter(self) -> List:
        """
        Kompatibilität: Gibt Mitarbeiter-Liste zurück
        
        Returns:
            Liste von Mitarbeiter-Objekten (alte Struktur)
        """
        from models.mitarbeiter import Mitarbeiter as OldMitarbeiter
        
        mitarbeiter_liste = self.db.mitarbeiter.get_all()
        abteilungen_dict = {a.id: a for a in self.db.abteilungen.get_all()}
        
        result = []
        for ma in mitarbeiter_liste:
            abt = abteilungen_dict.get(ma.abteilung_id)
            
            old_ma = OldMitarbeiter(
                id=ma.id,
                name=ma.name,
                urlaubstage_jahr=ma.urlaubstage_jahr,
                abteilung=abt.name if abt else ""
            )
            result.append(old_ma)
        
        return result
    
    def get_alle_statistiken(self, abteilung: Optional[str] = None):
        """
        Kompatibilität: Gibt Statistiken zurück
        
        Args:
            abteilung: Optional - Filter nach Abteilung
        
        Returns:
            Liste von MitarbeiterStatistik (alte Struktur)
        """
        from models.mitarbeiter import Mitarbeiter as OldMitarbeiter
        from models.mitarbeiter import MitarbeiterStatistik as OldStatistik
        
        if not self._cache_valid:
            self._rebuild_cache()
        
        # Filtern
        if abteilung and abteilung != "Alle":
            stats = [s for s in self._stats_cache.values() 
                    if s.abteilung.name == abteilung]
        else:
            stats = list(self._stats_cache.values())
        
        # In altes Format konvertieren
        result = []
        for stat in stats:
            old_ma = OldMitarbeiter(
                id=stat.mitarbeiter.id,
                name=stat.mitarbeiter.name,
                urlaubstage_jahr=stat.mitarbeiter.urlaubstage_jahr,
                abteilung=stat.abteilung.name
            )
            
            old_stat = OldStatistik(
                mitarbeiter=old_ma,
                urlaub_genommen=stat.urlaub_genommen,
                krankheitstage=stat.krankheitstage,
                schulungstage=stat.schulungstage,
                ueberstunden=stat.ueberstunden,
                uebertrag_vorjahr=stat.uebertrag_vorjahr
            )
            result.append(old_stat)
        
        return result
    
    def get_mitarbeiter_statistik(self, mitarbeiter_id: str):
        """
        Kompatibilität: Gibt Statistik für einen Mitarbeiter zurück
        
        Args:
            mitarbeiter_id: Mitarbeiter ID
        
        Returns:
            MitarbeiterStatistik (alte Struktur) oder None
        """
        if not self._cache_valid:
            self._rebuild_cache()
        
        stat = self._stats_cache.get(mitarbeiter_id)
        if not stat:
            return None
        
        # In altes Format konvertieren
        from models.mitarbeiter import Mitarbeiter as OldMitarbeiter
        from models.mitarbeiter import MitarbeiterStatistik as OldStatistik
        
        old_ma = OldMitarbeiter(
            id=stat.mitarbeiter.id,
            name=stat.mitarbeiter.name,
            urlaubstage_jahr=stat.mitarbeiter.urlaubstage_jahr,
            abteilung=stat.abteilung.name
        )
        
        return OldStatistik(
            mitarbeiter=old_ma,
            urlaub_genommen=stat.urlaub_genommen,
            krankheitstage=stat.krankheitstage,
            schulungstage=stat.schulungstage,
            ueberstunden=stat.ueberstunden,
            uebertrag_vorjahr=stat.uebertrag_vorjahr
        )
    
    def get_team_statistiken(self) -> Dict:
        """
        Kompatibilität: Gibt Team-Statistiken zurück
        
        Returns:
            Dict mit Statistiken
        """
        team_stat = self.service.get_team_statistik(self.aktuelles_jahr)
        
        return {
            'mitarbeiter_anzahl': team_stat.mitarbeiter_anzahl,
            'gesamt_urlaub': team_stat.gesamt_urlaub,
            'gesamt_krank': team_stat.gesamt_krank,
            'gesamt_schulung': team_stat.gesamt_schulung,
            'gesamt_ueberstunden': team_stat.gesamt_ueberstunden
        }
    

    def speichere_eintrag(self, eintrag: Dict) -> bool:
        """
        Kompatibilität: Speichert Eintrag
        """
        try:
            typ = eintrag['typ']
            mitarbeiter_id = eintrag['mitarbeiter_id']
            datum_str = eintrag['datum']
            wert = float(eintrag['wert'])
            notiz = eintrag.get('beschreibung', '')
            
            if not notiz or not notiz.strip():
                notiz = None
            
            datum = datetime.strptime(datum_str, '%Y-%m-%d').date()
            
            if typ == 'urlaub':
                bis_datum = datum + timedelta(days=int(wert) - 1)
                
                urlaub = Urlaub(
                    id=None,
                    mitarbeiter_id=mitarbeiter_id,
                    von_datum=datum,
                    bis_datum=bis_datum,
                    tage=wert,
                    notiz=notiz
                )
                self.db.urlaub.create(urlaub)
                
            elif typ == 'krank':
                bis_datum = datum + timedelta(days=int(wert) - 1)
                
                krankheit = Krankheit(
                    id=None,
                    mitarbeiter_id=mitarbeiter_id,
                    von_datum=datum,
                    bis_datum=bis_datum,
                    tage=wert,
                    notiz=notiz
                )
                self.db.krankheit.create(krankheit)
                
            elif typ == 'schulung':
                titel = eintrag.get('titel', '').strip()
                if not titel:
                    titel = None
                
                schulung = Schulung(
                    id=None,
                    mitarbeiter_id=mitarbeiter_id,
                    datum=datum,
                    dauer_tage=wert,
                    titel=titel,
                    notiz=notiz
                )
                self.db.schulung.create(schulung)
                
            elif typ == 'ueberstunden':
                ueberstunden = Ueberstunden(
                    id=None,
                    mitarbeiter_id=mitarbeiter_id,
                    datum=datum,
                    stunden=wert,
                    notiz=notiz
                )
                self.db.ueberstunden.create(ueberstunden)
            
            else:
                print(f"⚠️ Unbekannter Typ: {typ}")
                return False
            
            # ✅ FIX: Cache SOFORT invalidieren
            self._invalidate_cache()
            
            # ✅ FIX: Statistik für diesen Mitarbeiter NEU laden
            self._stats_cache.pop(mitarbeiter_id, None)
            
            # ✅ FIX: Stammdaten neu laden (falls nötig)
            self._lade_stammdaten()
            
            print(f"✅ Eintrag gespeichert: {typ} für {mitarbeiter_id}")
            
            return True
            
        except Exception as e:
            print(f"❌ Fehler beim Speichern: {e}")
            import traceback
            traceback.print_exc()
            return False


    
    def stammdaten_hinzufuegen(self, ma_id: str, daten: Dict) -> bool:
        """
        Kompatibilität: Fügt Mitarbeiter hinzu
        
        Args:
            ma_id: Mitarbeiter ID
            daten: Dict mit Mitarbeiterdaten
        
        Returns:
            True bei Erfolg
        """
        try:
            # Abteilung finden
            abteilung_name = daten.get('abteilung', 'Werkstatt')
            abteilung = self.db.abteilungen.get_by_name(abteilung_name)

            if not abteilung:
                print(f"⚠️ Abteilung '{abteilung_name}' nicht gefunden")
                return False

            # Daten parsen
            geburtsdatum = None
            if daten.get('geburtsdatum'):
                try:
                    geburtsdatum = datetime.strptime(daten['geburtsdatum'], '%Y-%m-%d').date()
                except:
                    pass

            eintrittsdatum = date.today()
            if daten.get('einstellungsdatum'):
                try:
                    eintrittsdatum = datetime.strptime(daten['einstellungsdatum'], '%Y-%m-%d').date()
                except:
                    pass

            # Mitarbeiter erstellen
            mitarbeiter = Mitarbeiter(
                id=ma_id,
                abteilung_id=abteilung.id,
                vorname=daten['vorname'],
                nachname=daten['nachname'],
                email=daten.get('email'),
                geburtsdatum=geburtsdatum,
                eintrittsdatum=eintrittsdatum,
                urlaubstage_jahr=daten.get('urlaubstage_jahr', 30),
                status=MitarbeiterStatus.AKTIV
            )
            
            self.db.mitarbeiter.create(mitarbeiter)
            self._invalidate_cache()
            
            return True
            
        except Exception as e:
            print(f"❌ Fehler beim Hinzufügen: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def stammdaten_aktualisieren(self, ma_id: str, daten: Dict):
        """
        Kompatibilität: Aktualisiert Mitarbeiter
        
        Args:
            ma_id: Mitarbeiter ID
            daten: Dict mit neuen Daten
        """
        try:
            mitarbeiter = self.db.mitarbeiter.get_by_id(ma_id)
            if not mitarbeiter:
                return
            
            # Abteilung
            if 'abteilung' in daten:
                abteilung = self.db.abteilungen.get_by_name(daten['abteilung'])
                if abteilung:
                    mitarbeiter.abteilung_id = abteilung.id
            
            # Andere Felder
            if 'vorname' in daten:
                mitarbeiter.vorname = daten['vorname']
            if 'nachname' in daten:
                mitarbeiter.nachname = daten['nachname']
            if 'email' in daten:
                mitarbeiter.email = daten['email']
            if 'urlaubstage_jahr' in daten:
                mitarbeiter.urlaubstage_jahr = daten['urlaubstage_jahr']
            
            # Datum-Felder
            if 'geburtsdatum' in daten and daten['geburtsdatum']:
                try:
                    mitarbeiter.geburtsdatum = datetime.strptime(
                        daten['geburtsdatum'], '%Y-%m-%d'
                    ).date()
                except:
                    pass

            if 'einstellungsdatum' in daten and daten['einstellungsdatum']:
                try:
                    mitarbeiter.eintrittsdatum = datetime.strptime(
                        daten['einstellungsdatum'], '%Y-%m-%d'
                    ).date()
                except:
                    pass

            # ✅ NEU: Austrittsdatum
            if 'austrittsdatum' in daten:
                if daten['austrittsdatum']:
                    try:
                        mitarbeiter.austrittsdatum = datetime.strptime(
                            daten['austrittsdatum'], '%Y-%m-%d'
                        ).date()
                    except:
                        pass
                else:
                    # Leerer Wert = Austrittsdatum löschen
                    mitarbeiter.austrittsdatum = None
            
            self.db.mitarbeiter.update(mitarbeiter)
            self._invalidate_cache()
            
        except Exception as e:
            print(f"❌ Fehler beim Aktualisieren: {e}")
    
    def erstelle_neues_jahr(self, jahr: int) -> bool:
        """
        Kompatibilität: Erstellt neues Jahr
        
        Args:
            jahr: Neues Jahr
        
        Returns:
            True bei Erfolg
        """
        try:
            # Jahreswechsel durchführen
            result = self.service.erstelle_jahreswechsel(jahr - 1, jahr)
            
            print(f"✅ Jahr {jahr} erstellt")
            print(f"   Überträge: {result['uebertraege_anzahl']}")
            
            return True
            
        except Exception as e:
            print(f"❌ Fehler beim Jahreswechsel: {e}")
            return False
    
    def suche_mitarbeiter(self, suchbegriff: str):
        """
        Kompatibilität: Sucht Mitarbeiter
        
        Args:
            suchbegriff: Suchstring
        
        Returns:
            Liste von MitarbeiterStatistik
        """
        if not suchbegriff:
            return self.get_alle_statistiken()
        
        alle = self.get_alle_statistiken()
        suchbegriff = suchbegriff.lower()
        
        return [
            stat for stat in alle
            if suchbegriff in stat.mitarbeiter.name.lower() or
               suchbegriff in stat.mitarbeiter.abteilung.lower()
        ]
    
    def _berechne_uebertrag(self, mitarbeiter_id: str, jahr: int) -> float:
        """
        ✅ DYNAMISCH: Berechnet Urlaubsübertrag aus Vorjahr
        
        Args:
            mitarbeiter_id: Mitarbeiter ID
            jahr: Jahr für das Übertrag berechnet wird
        
        Returns:
            Übertragbare Tage (0-30)
        """
        mitarbeiter = self.db.mitarbeiter.get_by_id(mitarbeiter_id)
        if not mitarbeiter:
            return 0.0
        
        vorjahr = jahr - 1
        
        # Kein Übertrag im Eintrittsjahr oder davor
        if vorjahr < mitarbeiter.eintrittsdatum.year:
            return 0.0
        
        # ✅ REKURSIV: Hole Übertrag vom Vorvorjahr
        uebertrag_vorvorjahr = self._berechne_uebertrag(mitarbeiter_id, vorjahr)
        
        # Verfügbar im Vorjahr = Jahr-Anspruch + Übertrag
        verfuegbar_vorjahr = mitarbeiter.urlaubstage_jahr + uebertrag_vorvorjahr
        
        # Genommen im Vorjahr
        genommen_vorjahr = self.db.urlaub.get_summe_nach_jahr(mitarbeiter_id, vorjahr)
        
        # Rest = Verfügbar - Genommen
        rest = verfuegbar_vorjahr - genommen_vorjahr
        
        # Max 30 Tage (gesetzlich), Min 0
        return min(max(rest, 0.0), 30.0)