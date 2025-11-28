"""
Repository Pattern für Datenzugriff
Trennt Business Logic von SQL
"""

from typing import List, Optional, Dict
from datetime import date, datetime
import sqlite3
from pathlib import Path

from .entities import *


class BaseRepository:
    """Basis-Repository mit gemeinsamen Funktionen"""
    
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self.conn.row_factory = sqlite3.Row
    
    def _execute(self, query: str, params: tuple = ()) -> sqlite3.Cursor:
        """Führt Query aus"""
        cursor = self.conn.cursor()
        cursor.execute(query, params)
        return cursor
    
    def _fetchone(self, query: str, params: tuple = ()) -> Optional[sqlite3.Row]:
        """Holt eine Zeile"""
        cursor = self._execute(query, params)
        return cursor.fetchone()
    
    def _fetchall(self, query: str, params: tuple = ()) -> List[sqlite3.Row]:
        """Holt alle Zeilen"""
        cursor = self._execute(query, params)
        return cursor.fetchall()
    
    def _commit(self):
        """Commit"""
        self.conn.commit()


class AbteilungRepository(BaseRepository):
    """Repository für Abteilungen"""

    def get_all(self) -> List[Abteilung]:
        """Alle Abteilungen"""
        rows = self._fetchall("""
            SELECT * FROM abteilungen ORDER BY sortierung, name
        """)
        return [self._row_to_entity(row) for row in rows]

    def get_by_id(self, id: int) -> Optional[Abteilung]:
        """Abteilung nach ID"""
        row = self._fetchone("SELECT * FROM abteilungen WHERE id = ?", (id,))
        return self._row_to_entity(row) if row else None

    def get_by_name(self, name: str) -> Optional[Abteilung]:
        """Abteilung nach Name"""
        row = self._fetchone("SELECT * FROM abteilungen WHERE name = ? COLLATE NOCASE", (name,))
        return self._row_to_entity(row) if row else None

    def create(self, name: str, farbe_hex: str, sortierung: int = 999) -> Abteilung:
        """Erstellt Abteilung"""
        cursor = self._execute("""
            INSERT INTO abteilungen (name, farbe_hex, sortierung)
            VALUES (?, ?, ?)
        """, (name, farbe_hex, sortierung))
        self._commit()

        return Abteilung(
            id=cursor.lastrowid,
            name=name,
            farbe_hex=farbe_hex,
            sortierung=sortierung
        )

    def update(self, abteilung: Abteilung) -> bool:
        """Aktualisiert Abteilung"""
        cursor = self._execute("""
            UPDATE abteilungen SET
                name = ?,
                farbe_hex = ?,
                sortierung = ?
            WHERE id = ?
        """, (
            abteilung.name,
            abteilung.farbe_hex,
            abteilung.sortierung,
            abteilung.id
        ))
        self._commit()
        return cursor.rowcount > 0

    def delete(self, id: int) -> bool:
        """Löscht Abteilung (nur wenn keine Mitarbeiter zugeordnet)"""
        cursor = self._execute("DELETE FROM abteilungen WHERE id = ?", (id,))
        self._commit()
        return cursor.rowcount > 0

    def count_mitarbeiter(self, id: int) -> int:
        """Zählt Mitarbeiter in Abteilung"""
        row = self._fetchone("""
            SELECT COUNT(*) as anzahl FROM mitarbeiter
            WHERE abteilung_id = ? AND status = 'aktiv'
        """, (id,))
        return int(row['anzahl']) if row else 0

    def _row_to_entity(self, row: sqlite3.Row) -> Abteilung:
        """Konvertiert DB Row zu Entity"""
        return Abteilung(
            id=row['id'],
            name=row['name'],
            farbe_hex=row['farbe_hex'],
            sortierung=row['sortierung']
        )


class MitarbeiterRepository(BaseRepository):
    """Repository für Mitarbeiter"""
    
    def get_all(self, nur_aktive: bool = True) -> List[Mitarbeiter]:
        """Alle Mitarbeiter"""
        query = "SELECT * FROM mitarbeiter"
        if nur_aktive:
            # Filter: status='aktiv' UND (kein Austrittsdatum ODER Austrittsdatum in Zukunft)
            query += """ WHERE status = 'aktiv'
                         AND (austrittsdatum IS NULL OR austrittsdatum >= date('now'))"""
        query += " ORDER BY vorname, nachname"

        rows = self._fetchall(query)
        return [self._row_to_entity(row) for row in rows]
    
    def get_by_id(self, id: str) -> Optional[Mitarbeiter]:
        """Mitarbeiter nach ID"""
        row = self._fetchone("SELECT * FROM mitarbeiter WHERE id = ?", (id,))
        return self._row_to_entity(row) if row else None
    
    def get_by_abteilung(self, abteilung_id: int, nur_aktive: bool = True) -> List[Mitarbeiter]:
        """Mitarbeiter nach Abteilung"""
        query = "SELECT * FROM mitarbeiter WHERE abteilung_id = ?"
        params = [abteilung_id]
        
        if nur_aktive:
            query += " AND status = 'aktiv'"
        
        query += " ORDER BY vorname, nachname"
        
        rows = self._fetchall(query, tuple(params))
        return [self._row_to_entity(row) for row in rows]
    
    def create(self, mitarbeiter: Mitarbeiter) -> Mitarbeiter:
        """Erstellt Mitarbeiter"""
        self._execute("""
            INSERT INTO mitarbeiter (
                id, abteilung_id, vorname, nachname, email,
                geburtsdatum, eintrittsdatum, austrittsdatum, urlaubstage_jahr, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            mitarbeiter.id,
            mitarbeiter.abteilung_id,
            mitarbeiter.vorname,
            mitarbeiter.nachname,
            mitarbeiter.email,
            mitarbeiter.geburtsdatum,
            mitarbeiter.eintrittsdatum,
            mitarbeiter.austrittsdatum,
            mitarbeiter.urlaubstage_jahr,
            mitarbeiter.status.value
        ))
        self._commit()
        return mitarbeiter
    
    def update(self, mitarbeiter: Mitarbeiter) -> bool:
        """Aktualisiert Mitarbeiter"""
        cursor = self._execute("""
            UPDATE mitarbeiter SET
                abteilung_id = ?,
                vorname = ?,
                nachname = ?,
                email = ?,
                geburtsdatum = ?,
                eintrittsdatum = ?,
                austrittsdatum = ?,
                urlaubstage_jahr = ?,
                status = ?
            WHERE id = ?
        """, (
            mitarbeiter.abteilung_id,
            mitarbeiter.vorname,
            mitarbeiter.nachname,
            mitarbeiter.email,
            mitarbeiter.geburtsdatum,
            mitarbeiter.eintrittsdatum,
            mitarbeiter.austrittsdatum,
            mitarbeiter.urlaubstage_jahr,
            mitarbeiter.status.value,
            mitarbeiter.id
        ))
        self._commit()
        return cursor.rowcount > 0
    
    def delete(self, id: str) -> bool:
        """Löscht Mitarbeiter (CASCADE löscht auch alle Einträge!)"""
        cursor = self._execute("DELETE FROM mitarbeiter WHERE id = ?", (id,))
        self._commit()
        return cursor.rowcount > 0
    
    def _row_to_entity(self, row: sqlite3.Row) -> Mitarbeiter:
        """Konvertiert DB Row zu Entity"""
        # Handle austrittsdatum - might not exist in old databases
        austrittsdatum = None
        try:
            austrittsdatum = self._parse_date(row['austrittsdatum'])
        except (KeyError, IndexError):
            pass

        return Mitarbeiter(
            id=row['id'],
            abteilung_id=row['abteilung_id'],
            vorname=row['vorname'],
            nachname=row['nachname'],
            email=row['email'],
            geburtsdatum=self._parse_date(row['geburtsdatum']),
            eintrittsdatum=self._parse_date(row['eintrittsdatum']),
            austrittsdatum=austrittsdatum,
            urlaubstage_jahr=row['urlaubstage_jahr'],
            status=MitarbeiterStatus(row['status']),
            erstellt_am=self._parse_datetime(row['erstellt_am']),
            aktualisiert_am=self._parse_datetime(row['aktualisiert_am'])
        )
    
    @staticmethod
    def _parse_date(value: str) -> Optional[date]:
        """Parst Datum"""
        if not value:
            return None
        try:
            return datetime.strptime(value, '%Y-%m-%d').date()
        except:
            return None
    
    @staticmethod
    def _parse_datetime(value: str) -> datetime:
        """Parst Timestamp"""
        try:
            return datetime.strptime(value, '%Y-%m-%d %H:%M:%S')
        except:
            return datetime.now()


class UrlaubRepository(BaseRepository):
    """Repository für Urlaub"""
    
    def get_all(self, mitarbeiter_id: Optional[str] = None, 
                jahr: Optional[int] = None) -> List[Urlaub]:
        """Alle Urlaubseinträge"""
        query = "SELECT * FROM urlaub WHERE 1=1"
        params = []
        
        if mitarbeiter_id:
            query += " AND mitarbeiter_id = ?"
            params.append(mitarbeiter_id)
        
        if jahr:
            query += " AND CAST(strftime('%Y', von_datum) AS INTEGER) = ?"
            params.append(jahr)
        
        query += " ORDER BY von_datum DESC"
        
        rows = self._fetchall(query, tuple(params))
        return [self._row_to_entity(row) for row in rows]
    
    def get_by_id(self, id: int) -> Optional[Urlaub]:
        """Urlaub nach ID"""
        row = self._fetchone("SELECT * FROM urlaub WHERE id = ?", (id,))
        return self._row_to_entity(row) if row else None
    
    def create(self, urlaub: Urlaub) -> Urlaub:
        """Erstellt Urlaubseintrag"""
        cursor = self._execute("""
            INSERT INTO urlaub (mitarbeiter_id, von_datum, bis_datum, tage, notiz)
            VALUES (?, ?, ?, ?, ?)
        """, (
            urlaub.mitarbeiter_id,
            urlaub.von_datum,
            urlaub.bis_datum,
            urlaub.tage,
            urlaub.notiz
        ))
        self._commit()
        urlaub.id = cursor.lastrowid
        return urlaub
    
    def update(self, urlaub: Urlaub) -> bool:
        """Aktualisiert Urlaubseintrag"""
        cursor = self._execute("""
            UPDATE urlaub SET
                von_datum = ?,
                bis_datum = ?,
                tage = ?,
                notiz = ?
            WHERE id = ?
        """, (
            urlaub.von_datum,
            urlaub.bis_datum,
            urlaub.tage,
            urlaub.notiz,
            urlaub.id
        ))
        self._commit()
        return cursor.rowcount > 0
    
    def delete(self, id: int) -> bool:
        """Löscht Urlaubseintrag"""
        cursor = self._execute("DELETE FROM urlaub WHERE id = ?", (id,))
        self._commit()
        return cursor.rowcount > 0
    
    def get_summe_nach_jahr(self, mitarbeiter_id: str, jahr: int) -> float:
        """Summe Urlaubstage für ein Jahr"""
        row = self._fetchone("""
            SELECT COALESCE(SUM(tage), 0) as summe 
            FROM urlaub 
            WHERE mitarbeiter_id = ? 
            AND CAST(strftime('%Y', von_datum) AS INTEGER) = ?
        """, (mitarbeiter_id, jahr))
        return float(row['summe']) if row else 0.0
    
    def _row_to_entity(self, row: sqlite3.Row) -> Urlaub:
        """Konvertiert DB Row zu Entity"""
        return Urlaub(
            id=row['id'],
            mitarbeiter_id=row['mitarbeiter_id'],
            von_datum=self._parse_date(row['von_datum']),
            bis_datum=self._parse_date(row['bis_datum']),
            tage=float(row['tage']),
            notiz=row['notiz'],
            erfasst_am=self._parse_datetime(row['erfasst_am'])
        )
    
    @staticmethod
    def _parse_date(value: str) -> date:
        return datetime.strptime(value, '%Y-%m-%d').date()
    
    @staticmethod
    def _parse_datetime(value: str) -> datetime:
        return datetime.strptime(value, '%Y-%m-%d %H:%M:%S')


class KrankheitRepository(BaseRepository):
    """Repository für Krankheit"""
    
    def get_all(self, mitarbeiter_id: Optional[str] = None, 
                jahr: Optional[int] = None) -> List[Krankheit]:
        """Alle Krankheitseinträge"""
        query = "SELECT * FROM krankheit WHERE 1=1"
        params = []
        
        if mitarbeiter_id:
            query += " AND mitarbeiter_id = ?"
            params.append(mitarbeiter_id)
        
        if jahr:
            query += " AND CAST(strftime('%Y', von_datum) AS INTEGER) = ?"
            params.append(jahr)
        
        query += " ORDER BY von_datum DESC"
        
        rows = self._fetchall(query, tuple(params))
        return [self._row_to_entity(row) for row in rows]
    
    def get_by_id(self, id: int) -> Optional[Krankheit]:
        """Krankheit nach ID"""
        row = self._fetchone("SELECT * FROM krankheit WHERE id = ?", (id,))
        return self._row_to_entity(row) if row else None
    
    def create(self, krankheit: Krankheit) -> Krankheit:
        """Erstellt Krankheitseintrag"""
        cursor = self._execute("""
            INSERT INTO krankheit (mitarbeiter_id, von_datum, bis_datum, tage, notiz)
            VALUES (?, ?, ?, ?, ?)
        """, (
            krankheit.mitarbeiter_id,
            krankheit.von_datum,
            krankheit.bis_datum,
            krankheit.tage,
            krankheit.notiz
        ))
        self._commit()
        krankheit.id = cursor.lastrowid
        return krankheit
    
    def update(self, krankheit: Krankheit) -> bool:
        """Aktualisiert Krankheitseintrag"""
        cursor = self._execute("""
            UPDATE krankheit SET
                von_datum = ?,
                bis_datum = ?,
                tage = ?,
                notiz = ?
            WHERE id = ?
        """, (
            krankheit.von_datum,
            krankheit.bis_datum,
            krankheit.tage,
            krankheit.notiz,
            krankheit.id
        ))
        self._commit()
        return cursor.rowcount > 0
    
    def delete(self, id: int) -> bool:
        """Löscht Krankheitseintrag"""
        cursor = self._execute("DELETE FROM krankheit WHERE id = ?", (id,))
        self._commit()
        return cursor.rowcount > 0
    
    def get_summe_nach_jahr(self, mitarbeiter_id: str, jahr: int) -> float:
        """Summe Krankheitstage für ein Jahr"""
        row = self._fetchone("""
            SELECT COALESCE(SUM(tage), 0) as summe 
            FROM krankheit 
            WHERE mitarbeiter_id = ? 
            AND CAST(strftime('%Y', von_datum) AS INTEGER) = ?
        """, (mitarbeiter_id, jahr))
        return float(row['summe']) if row else 0.0
    
    def _row_to_entity(self, row: sqlite3.Row) -> Krankheit:
        """Konvertiert DB Row zu Entity"""
        return Krankheit(
            id=row['id'],
            mitarbeiter_id=row['mitarbeiter_id'],
            von_datum=self._parse_date(row['von_datum']),
            bis_datum=self._parse_date(row['bis_datum']),
            tage=float(row['tage']),
            notiz=row['notiz'],
            erfasst_am=self._parse_datetime(row['erfasst_am'])
        )
    
    @staticmethod
    def _parse_date(value: str) -> date:
        return datetime.strptime(value, '%Y-%m-%d').date()
    
    @staticmethod
    def _parse_datetime(value: str) -> datetime:
        return datetime.strptime(value, '%Y-%m-%d %H:%M:%S')


class SchulungRepository(BaseRepository):
    """Repository für Schulungen"""
    
    def get_all(self, mitarbeiter_id: Optional[str] = None, 
                jahr: Optional[int] = None) -> List[Schulung]:
        """Alle Schulungseinträge"""
        query = "SELECT * FROM schulung WHERE 1=1"
        params = []
        
        if mitarbeiter_id:
            query += " AND mitarbeiter_id = ?"
            params.append(mitarbeiter_id)
        
        if jahr:
            query += " AND CAST(strftime('%Y', datum) AS INTEGER) = ?"
            params.append(jahr)
        
        query += " ORDER BY datum DESC"
        
        rows = self._fetchall(query, tuple(params))
        return [self._row_to_entity(row) for row in rows]
    
    def get_by_id(self, id: int) -> Optional[Schulung]:
        """Schulung nach ID"""
        row = self._fetchone("SELECT * FROM schulung WHERE id = ?", (id,))
        return self._row_to_entity(row) if row else None
    
    def create(self, schulung: Schulung) -> Schulung:
        """Erstellt Schulungseintrag"""
        cursor = self._execute("""
            INSERT INTO schulung (mitarbeiter_id, datum, dauer_tage, titel, anbieter, notiz)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            schulung.mitarbeiter_id,
            schulung.datum,
            schulung.dauer_tage,
            schulung.titel,
            schulung.anbieter,
            schulung.notiz
        ))
        self._commit()
        schulung.id = cursor.lastrowid
        return schulung
    
    def update(self, schulung: Schulung) -> bool:
        """Aktualisiert Schulungseintrag"""
        cursor = self._execute("""
            UPDATE schulung SET
                datum = ?,
                dauer_tage = ?,
                titel = ?,
                anbieter = ?,
                notiz = ?
            WHERE id = ?
        """, (
            schulung.datum,
            schulung.dauer_tage,
            schulung.titel,
            schulung.anbieter,
            schulung.notiz,
            schulung.id
        ))
        self._commit()
        return cursor.rowcount > 0
    
    def delete(self, id: int) -> bool:
        """Löscht Schulungseintrag"""
        cursor = self._execute("DELETE FROM schulung WHERE id = ?", (id,))
        self._commit()
        return cursor.rowcount > 0
    
    def get_summe_nach_jahr(self, mitarbeiter_id: str, jahr: int) -> float:
        """Summe Schulungstage für ein Jahr"""
        row = self._fetchone("""
            SELECT COALESCE(SUM(dauer_tage), 0) as summe 
            FROM schulung 
            WHERE mitarbeiter_id = ? 
            AND CAST(strftime('%Y', datum) AS INTEGER) = ?
        """, (mitarbeiter_id, jahr))
        return float(row['summe']) if row else 0.0
    
    def _row_to_entity(self, row: sqlite3.Row) -> Schulung:
        """Konvertiert DB Row zu Entity"""
        return Schulung(
            id=row['id'],
            mitarbeiter_id=row['mitarbeiter_id'],
            datum=self._parse_date(row['datum']),
            dauer_tage=float(row['dauer_tage']),
            titel=row['titel'],
            anbieter=row['anbieter'],
            notiz=row['notiz'],
            erfasst_am=self._parse_datetime(row['erfasst_am'])
        )
    
    @staticmethod
    def _parse_date(value: str) -> date:
        return datetime.strptime(value, '%Y-%m-%d').date()
    
    @staticmethod
    def _parse_datetime(value: str) -> datetime:
        return datetime.strptime(value, '%Y-%m-%d %H:%M:%S')


class UeberstundenRepository(BaseRepository):
    """Repository für Überstunden"""
    
    def get_all(self, mitarbeiter_id: Optional[str] = None, 
                jahr: Optional[int] = None) -> List[Ueberstunden]:
        """Alle Überstundeneinträge"""
        query = "SELECT * FROM ueberstunden WHERE 1=1"
        params = []
        
        if mitarbeiter_id:
            query += " AND mitarbeiter_id = ?"
            params.append(mitarbeiter_id)
        
        if jahr:
            query += " AND CAST(strftime('%Y', datum) AS INTEGER) = ?"
            params.append(jahr)
        
        query += " ORDER BY datum DESC"
        
        rows = self._fetchall(query, tuple(params))
        return [self._row_to_entity(row) for row in rows]
    
    def get_by_id(self, id: int) -> Optional[Ueberstunden]:
        """Überstunden nach ID"""
        row = self._fetchone("SELECT * FROM ueberstunden WHERE id = ?", (id,))
        return self._row_to_entity(row) if row else None
    
    def create(self, ueberstunden: Ueberstunden) -> Ueberstunden:
        """Erstellt Überstundeneintrag"""
        cursor = self._execute("""
            INSERT INTO ueberstunden (mitarbeiter_id, datum, stunden, notiz)
            VALUES (?, ?, ?, ?)
        """, (
            ueberstunden.mitarbeiter_id,
            ueberstunden.datum,
            ueberstunden.stunden,
            ueberstunden.notiz
        ))
        self._commit()
        ueberstunden.id = cursor.lastrowid
        return ueberstunden
    
    def update(self, ueberstunden: Ueberstunden) -> bool:
        """Aktualisiert Überstundeneintrag"""
        cursor = self._execute("""
            UPDATE ueberstunden SET
                datum = ?,
                stunden = ?,
                notiz = ?
            WHERE id = ?
        """, (
            ueberstunden.datum,
            ueberstunden.stunden,
            ueberstunden.notiz,
            ueberstunden.id
        ))
        self._commit()
        return cursor.rowcount > 0
    
    def delete(self, id: int) -> bool:
        """Löscht Überstundeneintrag"""
        cursor = self._execute("DELETE FROM ueberstunden WHERE id = ?", (id,))
        self._commit()
        return cursor.rowcount > 0
    
    def get_summe_nach_jahr(self, mitarbeiter_id: str, jahr: int) -> float:
        """Summe Überstunden für ein Jahr"""
        row = self._fetchone("""
            SELECT COALESCE(SUM(stunden), 0) as summe 
            FROM ueberstunden 
            WHERE mitarbeiter_id = ? 
            AND CAST(strftime('%Y', datum) AS INTEGER) = ?
        """, (mitarbeiter_id, jahr))
        return float(row['summe']) if row else 0.0
    
    def _row_to_entity(self, row: sqlite3.Row) -> Ueberstunden:
        """Konvertiert DB Row zu Entity"""
        return Ueberstunden(
            id=row['id'],
            mitarbeiter_id=row['mitarbeiter_id'],
            datum=self._parse_date(row['datum']),
            stunden=float(row['stunden']),
            notiz=row['notiz'],
            erfasst_am=self._parse_datetime(row['erfasst_am'])
        )
    
    @staticmethod
    def _parse_date(value: str) -> date:
        return datetime.strptime(value, '%Y-%m-%d').date()
    
    @staticmethod
    def _parse_datetime(value: str) -> datetime:
        return datetime.strptime(value, '%Y-%m-%d %H:%M:%S')


class FeiertagRepository(BaseRepository):
    """Repository für Feiertage"""

    def get_all(self, jahr: Optional[int] = None, nur_aktive: bool = True) -> List[Feiertag]:
        """Alle Feiertage"""
        query = "SELECT * FROM feiertage WHERE 1=1"
        params = []

        if nur_aktive:
            query += " AND aktiv = 1"

        if jahr:
            query += " AND CAST(strftime('%Y', datum) AS INTEGER) = ?"
            params.append(jahr)

        query += " ORDER BY datum"

        rows = self._fetchall(query, tuple(params))
        return [self._row_to_entity(row) for row in rows]

    def get_by_datum(self, datum: date) -> Optional[Feiertag]:
        """Feiertag nach Datum"""
        row = self._fetchone("SELECT * FROM feiertage WHERE datum = ?", (datum,))
        return self._row_to_entity(row) if row else None

    def ist_feiertag(self, datum: date) -> bool:
        """Prüft ob Datum ein Feiertag ist"""
        return self.get_by_datum(datum) is not None

    def get_by_id(self, id: int) -> Optional[Feiertag]:
        """Feiertag nach ID"""
        row = self._fetchone("SELECT * FROM feiertage WHERE id = ?", (id,))
        return self._row_to_entity(row) if row else None

    def create(self, feiertag: Feiertag) -> Feiertag:
        """Erstellt Feiertag"""
        cursor = self._execute("""
            INSERT INTO feiertage (datum, name, bundesland, aktiv)
            VALUES (?, ?, ?, ?)
        """, (
            feiertag.datum,
            feiertag.name,
            feiertag.bundesland,
            feiertag.aktiv
        ))
        self._commit()
        feiertag.id = cursor.lastrowid
        return feiertag

    def update(self, feiertag: Feiertag) -> bool:
        """Aktualisiert Feiertag"""
        cursor = self._execute("""
            UPDATE feiertage SET
                datum = ?,
                name = ?,
                bundesland = ?,
                aktiv = ?
            WHERE id = ?
        """, (
            feiertag.datum,
            feiertag.name,
            feiertag.bundesland,
            feiertag.aktiv,
            feiertag.id
        ))
        self._commit()
        return cursor.rowcount > 0

    def delete(self, id: int) -> bool:
        """Löscht Feiertag"""
        cursor = self._execute("DELETE FROM feiertage WHERE id = ?", (id,))
        self._commit()
        return cursor.rowcount > 0

    def _row_to_entity(self, row: sqlite3.Row) -> Feiertag:
        """Konvertiert DB Row zu Entity"""
        return Feiertag(
            id=row['id'],
            datum=self._parse_date(row['datum']),
            name=row['name'],
            bundesland=row['bundesland'],
            aktiv=bool(row['aktiv'])
        )

    @staticmethod
    def _parse_date(value: str) -> date:
        return datetime.strptime(value, '%Y-%m-%d').date()


class VeranstaltungRepository(BaseRepository):
    """Repository für Veranstaltungen"""

    def get_all(self, jahr: Optional[int] = None) -> List[Veranstaltung]:
        """Alle Veranstaltungen"""
        query = "SELECT * FROM veranstaltungen WHERE 1=1"
        params = []

        if jahr:
            query += " AND CAST(strftime('%Y', von_datum) AS INTEGER) = ?"
            params.append(jahr)

        query += " ORDER BY von_datum DESC"

        rows = self._fetchall(query, tuple(params))
        return [self._row_to_entity(row) for row in rows]

    def get_by_id(self, id: int) -> Optional[Veranstaltung]:
        """Veranstaltung nach ID"""
        row = self._fetchone("SELECT * FROM veranstaltungen WHERE id = ?", (id,))
        return self._row_to_entity(row) if row else None

    def create(self, veranstaltung: Veranstaltung) -> Veranstaltung:
        """Erstellt Veranstaltung"""
        cursor = self._execute("""
            INSERT INTO veranstaltungen (name, von_datum, bis_datum, ort, beschreibung, max_teilnehmer)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            veranstaltung.name,
            veranstaltung.von_datum,
            veranstaltung.bis_datum,
            veranstaltung.ort,
            veranstaltung.beschreibung,
            veranstaltung.max_teilnehmer
        ))
        self._commit()
        veranstaltung.id = cursor.lastrowid
        return veranstaltung

    def update(self, veranstaltung: Veranstaltung) -> bool:
        """Aktualisiert Veranstaltung"""
        cursor = self._execute("""
            UPDATE veranstaltungen SET
                name = ?,
                von_datum = ?,
                bis_datum = ?,
                ort = ?,
                beschreibung = ?,
                max_teilnehmer = ?
            WHERE id = ?
        """, (
            veranstaltung.name,
            veranstaltung.von_datum,
            veranstaltung.bis_datum,
            veranstaltung.ort,
            veranstaltung.beschreibung,
            veranstaltung.max_teilnehmer,
            veranstaltung.id
        ))
        self._commit()
        return cursor.rowcount > 0

    def delete(self, id: int) -> bool:
        """Löscht Veranstaltung"""
        cursor = self._execute("DELETE FROM veranstaltungen WHERE id = ?", (id,))
        self._commit()
        return cursor.rowcount > 0

    def get_by_zeitraum(self, von_datum: date, bis_datum: date) -> List[Veranstaltung]:
        """
        Findet alle Veranstaltungen die sich mit dem gegebenen Zeitraum überschneiden

        Args:
            von_datum: Start des Zeitraums
            bis_datum: Ende des Zeitraums

        Returns:
            Liste von Veranstaltungen die überschneiden
        """
        query = """
            SELECT * FROM veranstaltungen
            WHERE NOT (bis_datum < ? OR von_datum > ?)
            ORDER BY von_datum
        """
        rows = self._fetchall(query, (von_datum, bis_datum))
        return [self._row_to_entity(row) for row in rows]

    def _row_to_entity(self, row: sqlite3.Row) -> Veranstaltung:
        """Konvertiert DB Row zu Entity"""
        return Veranstaltung(
            id=row['id'],
            name=row['name'],
            von_datum=self._parse_date(row['von_datum']),
            bis_datum=self._parse_date(row['bis_datum']),
            ort=row['ort'],
            beschreibung=row['beschreibung'],
            max_teilnehmer=row['max_teilnehmer'],
            erfasst_am=self._parse_datetime(row['erfasst_am'])
        )

    @staticmethod
    def _parse_date(value: str) -> date:
        return datetime.strptime(value, '%Y-%m-%d').date()

    @staticmethod
    def _parse_datetime(value: str) -> datetime:
        return datetime.strptime(value, '%Y-%m-%d %H:%M:%S')