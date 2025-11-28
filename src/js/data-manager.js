/**
 * Teamplanner Data Manager
 * Business Logic Layer - Portiert von Python DataManager
 */

class TeamplannerDataManager {
  constructor(database, jahr = null) {
    this.db = database;
    this.aktuellesJahr = jahr || new Date().getFullYear();
    this.cache = new Map();
    this.cacheValid = false;

    console.log(`✅ DataManager initialisiert (Jahr: ${this.aktuellesJahr})`);
  }

  /**
   * Invalidiert den Cache
   */
  invalidateCache() {
    this.cacheValid = false;
    this.cache.clear();
  }

  /**
   * Gibt alle Mitarbeiter zurück
   */
  getAlleMitarbeiter() {
    const stmt = this.db.db.prepare(`
      SELECT m.*, a.name as abteilung_name, a.farbe as abteilung_farbe
      FROM mitarbeiter m
      LEFT JOIN abteilungen a ON m.abteilung_id = a.id
      WHERE m.status = 'AKTIV'
      ORDER BY m.nachname, m.vorname
    `);

    return stmt.all();
  }

  /**
   * Gibt einen einzelnen Mitarbeiter zurück
   */
  getMitarbeiter(mitarbeiterId) {
    const stmt = this.db.db.prepare(`
      SELECT m.*, a.name as abteilung_name, a.farbe as abteilung_farbe
      FROM mitarbeiter m
      LEFT JOIN abteilungen a ON m.abteilung_id = a.id
      WHERE m.id = ?
    `);

    return stmt.get(mitarbeiterId);
  }

  /**
   * Gibt alle Abteilungen zurück
   */
  getAlleAbteilungen() {
    return this.db.db.prepare('SELECT * FROM abteilungen ORDER BY name').all();
  }

  /**
   * Berechnet Urlaubsübertrag rekursiv
   */
  berechneUebertrag(mitarbeiterId, jahr) {
    // Mitarbeiter laden
    const mitarbeiter = this.db.db.prepare('SELECT * FROM mitarbeiter WHERE id = ?').get(mitarbeiterId);
    if (!mitarbeiter) return 0;

    const vorjahr = jahr - 1;
    const eintrittsjahr = new Date(mitarbeiter.eintrittsdatum).getFullYear();

    // Kein Übertrag im Eintrittsjahr oder davor
    if (vorjahr < eintrittsjahr) return 0;

    // Rekursiv: Übertrag vom Vorvorjahr
    const uebertragVorvorjahr = this.berechneUebertrag(mitarbeiterId, vorjahr);

    // Verfügbar im Vorjahr
    const verfuegbarVorjahr = mitarbeiter.urlaubstage_jahr + uebertragVorvorjahr;

    // Genommen im Vorjahr
    const genommenVorjahr = this.getUrlaubSummeNachJahr(mitarbeiterId, vorjahr);

    // Rest berechnen
    const rest = verfuegbarVorjahr - genommenVorjahr;

    // Max 30 Tage, min 0
    return Math.min(Math.max(rest, 0), 30);
  }

  /**
   * Gibt Urlaubssumme für ein Jahr zurück
   */
  getUrlaubSummeNachJahr(mitarbeiterId, jahr) {
    const stmt = this.db.db.prepare(`
      SELECT COALESCE(SUM(tage), 0) as summe
      FROM urlaub
      WHERE mitarbeiter_id = ?
        AND strftime('%Y', von_datum) = ?
    `);

    const result = stmt.get(mitarbeiterId, jahr.toString());
    return result.summe || 0;
  }

  /**
   * Gibt Statistik für einen Mitarbeiter zurück
   */
  getMitarbeiterStatistik(mitarbeiterId) {
    const mitarbeiter = this.db.db.prepare(`
      SELECT m.*, a.name as abteilung_name, a.farbe as abteilung_farbe
      FROM mitarbeiter m
      LEFT JOIN abteilungen a ON m.abteilung_id = a.id
      WHERE m.id = ?
    `).get(mitarbeiterId);

    if (!mitarbeiter) return null;

    // Übertrag berechnen
    const uebertrag = this.berechneUebertrag(mitarbeiterId, this.aktuellesJahr);

    // Urlaub genommen
    const urlaubGenommen = this.getUrlaubSummeNachJahr(mitarbeiterId, this.aktuellesJahr);

    // Krankheitstage
    const krankheit = this.db.db.prepare(`
      SELECT COALESCE(SUM(tage), 0) as summe
      FROM krankheit
      WHERE mitarbeiter_id = ?
        AND strftime('%Y', von_datum) = ?
    `).get(mitarbeiterId, this.aktuellesJahr.toString());

    // Schulungstage
    const schulung = this.db.db.prepare(`
      SELECT COALESCE(SUM(dauer_tage), 0) as summe
      FROM schulung
      WHERE mitarbeiter_id = ?
        AND strftime('%Y', datum) = ?
    `).get(mitarbeiterId, this.aktuellesJahr.toString());

    // Überstunden
    const ueberstunden = this.db.db.prepare(`
      SELECT COALESCE(SUM(stunden), 0) as summe
      FROM ueberstunden
      WHERE mitarbeiter_id = ?
        AND strftime('%Y', datum) = ?
    `).get(mitarbeiterId, this.aktuellesJahr.toString());

    return {
      mitarbeiter,
      uebertrag_vorjahr: uebertrag,
      urlaub_verfuegbar: mitarbeiter.urlaubstage_jahr + uebertrag,
      urlaub_genommen: urlaubGenommen,
      urlaub_rest: mitarbeiter.urlaubstage_jahr + uebertrag - urlaubGenommen,
      krankheitstage: krankheit.summe,
      schulungstage: schulung.summe,
      ueberstunden: ueberstunden.summe
    };
  }

  /**
   * Gibt alle Statistiken zurück
   */
  getAlleStatistiken(abteilung = null) {
    let mitarbeiter;

    if (abteilung && abteilung !== 'Alle') {
      const abt = this.db.db.prepare('SELECT id FROM abteilungen WHERE name = ?').get(abteilung);
      if (!abt) return [];

      mitarbeiter = this.db.db.prepare(`
        SELECT * FROM mitarbeiter
        WHERE abteilung_id = ? AND status = 'AKTIV'
        ORDER BY nachname, vorname
      `).all(abt.id);
    } else {
      mitarbeiter = this.db.db.prepare(`
        SELECT * FROM mitarbeiter
        WHERE status = 'AKTIV'
        ORDER BY nachname, vorname
      `).all();
    }

    return mitarbeiter.map(ma => this.getMitarbeiterStatistik(ma.id));
  }

  /**
   * Fügt Mitarbeiter hinzu
   */
  stammdatenHinzufuegen(mitarbeiterId, daten) {
    try {
      // Abteilung finden
      const abteilung = this.db.db.prepare('SELECT id FROM abteilungen WHERE name = ?').get(daten.abteilung);
      if (!abteilung) {
        console.error(`Abteilung '${daten.abteilung}' nicht gefunden`);
        return false;
      }

      // Mitarbeiter einfügen
      const stmt = this.db.db.prepare(`
        INSERT INTO mitarbeiter (
          id, abteilung_id, vorname, nachname, email,
          geburtsdatum, eintrittsdatum, urlaubstage_jahr, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AKTIV')
      `);

      stmt.run(
        mitarbeiterId,
        abteilung.id,
        daten.vorname,
        daten.nachname,
        daten.email || null,
        daten.geburtsdatum || null,
        daten.einstellungsdatum || new Date().toISOString().split('T')[0],
        daten.urlaubstage_jahr || 30
      );

      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Hinzufügen:', error);
      return false;
    }
  }

  /**
   * Aktualisiert Mitarbeiter
   */
  stammdatenAktualisieren(mitarbeiterId, daten) {
    try {
      const updates = [];
      const values = [];

      if (daten.vorname !== undefined) {
        updates.push('vorname = ?');
        values.push(daten.vorname);
      }
      if (daten.nachname !== undefined) {
        updates.push('nachname = ?');
        values.push(daten.nachname);
      }
      if (daten.email !== undefined) {
        updates.push('email = ?');
        values.push(daten.email || null);
      }
      if (daten.abteilung !== undefined) {
        const abt = this.db.db.prepare('SELECT id FROM abteilungen WHERE name = ?').get(daten.abteilung);
        if (abt) {
          updates.push('abteilung_id = ?');
          values.push(abt.id);
        }
      }
      if (daten.geburtsdatum !== undefined) {
        updates.push('geburtsdatum = ?');
        values.push(daten.geburtsdatum || null);
      }
      if (daten.einstellungsdatum !== undefined) {
        updates.push('eintrittsdatum = ?');
        values.push(daten.einstellungsdatum);
      }
      if (daten.austrittsdatum !== undefined) {
        updates.push('austrittsdatum = ?');
        values.push(daten.austrittsdatum || null);
      }
      if (daten.urlaubstage_jahr !== undefined) {
        updates.push('urlaubstage_jahr = ?');
        values.push(daten.urlaubstage_jahr);
      }

      if (updates.length === 0) return true;

      updates.push('aktualisiert_am = CURRENT_TIMESTAMP');
      values.push(mitarbeiterId);

      const sql = `UPDATE mitarbeiter SET ${updates.join(', ')} WHERE id = ?`;
      this.db.db.prepare(sql).run(...values);

      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      return false;
    }
  }

  /**
   * Deaktiviert einen Mitarbeiter
   */
  mitarbeiterDeaktivieren(mitarbeiterId) {
    try {
      this.db.db.prepare(`
        UPDATE mitarbeiter
        SET status = 'INAKTIV', aktualisiert_am = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(mitarbeiterId);

      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Deaktivieren:', error);
      return false;
    }
  }

  /**
   * Speichert einen Eintrag (Urlaub, Krankheit, etc.)
   */
  speichereEintrag(eintrag) {
    try {
      const typ = eintrag.typ;
      const mitarbeiterId = eintrag.mitarbeiter_id;
      const datum = eintrag.datum;
      const wert = parseFloat(eintrag.wert);
      const notiz = eintrag.beschreibung || null;

      if (typ === 'urlaub') {
        // Bis-Datum berechnen
        const vonDatum = new Date(datum);
        const bisDatum = new Date(vonDatum);
        bisDatum.setDate(bisDatum.getDate() + Math.floor(wert) - 1);

        this.db.db.prepare(`
          INSERT INTO urlaub (mitarbeiter_id, von_datum, bis_datum, tage, notiz)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          mitarbeiterId,
          datum,
          bisDatum.toISOString().split('T')[0],
          wert,
          notiz
        );
      } else if (typ === 'krank') {
        const vonDatum = new Date(datum);
        const bisDatum = new Date(vonDatum);
        bisDatum.setDate(bisDatum.getDate() + Math.floor(wert) - 1);

        this.db.db.prepare(`
          INSERT INTO krankheit (mitarbeiter_id, von_datum, bis_datum, tage, notiz)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          mitarbeiterId,
          datum,
          bisDatum.toISOString().split('T')[0],
          wert,
          notiz
        );
      } else if (typ === 'schulung') {
        this.db.db.prepare(`
          INSERT INTO schulung (mitarbeiter_id, datum, dauer_tage, titel, notiz)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          mitarbeiterId,
          datum,
          wert,
          eintrag.titel || null,
          notiz
        );
      } else if (typ === 'ueberstunden') {
        this.db.db.prepare(`
          INSERT INTO ueberstunden (mitarbeiter_id, datum, stunden, notiz)
          VALUES (?, ?, ?, ?)
        `).run(
          mitarbeiterId,
          datum,
          wert,
          notiz
        );
      } else {
        console.error(`Unbekannter Typ: ${typ}`);
        return false;
      }

      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      return false;
    }
  }

  /**
   * Gibt verfügbare Jahre zurück
   */
  getVerfuegbareJahre() {
    const result = this.db.db.prepare(`
      SELECT DISTINCT CAST(strftime('%Y', von_datum) AS INTEGER) as jahr
      FROM urlaub
      UNION
      SELECT DISTINCT CAST(strftime('%Y', von_datum) AS INTEGER) as jahr
      FROM krankheit
      UNION
      SELECT DISTINCT CAST(strftime('%Y', datum) AS INTEGER) as jahr
      FROM schulung
      UNION
      SELECT DISTINCT CAST(strftime('%Y', datum) AS INTEGER) as jahr
      FROM ueberstunden
      ORDER BY jahr DESC
    `).all();

    const jahre = new Set(result.map(r => r.jahr));

    // Aktuelles Jahr immer hinzufügen
    const aktuellesJahr = new Date().getFullYear();
    jahre.add(aktuellesJahr);
    jahre.add(aktuellesJahr + 1);

    return Array.from(jahre).sort((a, b) => b - a);
  }
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TeamplannerDataManager;
}
