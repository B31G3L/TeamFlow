/**
 * Teamplanner Data Manager
 * Business Logic Layer - Async Version für IPC
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
  async getAlleMitarbeiter() {
    const sql = `
      SELECT m.*, a.name as abteilung_name, a.farbe as abteilung_farbe
      FROM mitarbeiter m
      LEFT JOIN abteilungen a ON m.abteilung_id = a.id
      WHERE m.status = 'AKTIV'
      ORDER BY m.nachname, m.vorname
    `;

    return await this.db.query(sql);
  }

  /**
   * Gibt einen einzelnen Mitarbeiter zurück
   */
  async getMitarbeiter(mitarbeiterId) {
    const sql = `
      SELECT m.*, a.name as abteilung_name, a.farbe as abteilung_farbe
      FROM mitarbeiter m
      LEFT JOIN abteilungen a ON m.abteilung_id = a.id
      WHERE m.id = ?
    `;

    return await this.db.get(sql, [mitarbeiterId]);
  }

  /**
   * Gibt alle Abteilungen zurück
   */
  async getAlleAbteilungen() {
    return await this.db.query('SELECT * FROM abteilungen ORDER BY name');
  }

  /**
   * Gibt eine einzelne Abteilung zurück
   */
  async getAbteilung(abteilungId) {
    return await this.db.get('SELECT * FROM abteilungen WHERE id = ?', [abteilungId]);
  }

  /**
   * Gibt die Anzahl der Mitarbeiter in einer Abteilung zurück
   */
  async getMitarbeiterAnzahlInAbteilung(abteilungId) {
    const result = await this.db.get(`
      SELECT COUNT(*) as count 
      FROM mitarbeiter 
      WHERE abteilung_id = ? AND status = 'AKTIV'
    `, [abteilungId]);
    return result ? result.count : 0;
  }

  /**
   * Fügt eine neue Abteilung hinzu
   */
  async abteilungHinzufuegen(daten) {
    try {
      // Prüfe ob Name bereits existiert
      const existing = await this.db.get('SELECT id FROM abteilungen WHERE name = ?', [daten.name]);
      if (existing) {
        throw new Error(`Eine Abteilung mit dem Namen "${daten.name}" existiert bereits`);
      }

      const sql = `
        INSERT INTO abteilungen (name, farbe, beschreibung)
        VALUES (?, ?, ?)
      `;

      await this.db.run(sql, [daten.name, daten.farbe, daten.beschreibung]);
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Hinzufügen der Abteilung:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert eine Abteilung
   */
  async abteilungAktualisieren(abteilungId, daten) {
    try {
      // Prüfe ob Name bereits von einer anderen Abteilung verwendet wird
      const existing = await this.db.get(
        'SELECT id FROM abteilungen WHERE name = ? AND id != ?', 
        [daten.name, abteilungId]
      );
      if (existing) {
        throw new Error(`Eine Abteilung mit dem Namen "${daten.name}" existiert bereits`);
      }

      const sql = `
        UPDATE abteilungen 
        SET name = ?, farbe = ?, beschreibung = ?
        WHERE id = ?
      `;

      await this.db.run(sql, [daten.name, daten.farbe, daten.beschreibung, abteilungId]);
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Abteilung:', error);
      throw error;
    }
  }

  /**
   * Löscht eine Abteilung (nur wenn keine Mitarbeiter zugeordnet sind)
   */
  async abteilungLoeschen(abteilungId) {
    try {
      // Prüfe ob noch Mitarbeiter in der Abteilung sind
      const count = await this.getMitarbeiterAnzahlInAbteilung(abteilungId);
      if (count > 0) {
        throw new Error(`Die Abteilung kann nicht gelöscht werden, da noch ${count} Mitarbeiter zugeordnet sind`);
      }

      await this.db.run('DELETE FROM abteilungen WHERE id = ?', [abteilungId]);
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Löschen der Abteilung:', error);
      throw error;
    }
  }

  /**
   * Berechnet Urlaubsübertrag rekursiv
   */
  async berechneUebertrag(mitarbeiterId, jahr) {
    // Mitarbeiter laden
    const mitarbeiter = await this.db.get('SELECT * FROM mitarbeiter WHERE id = ?', [mitarbeiterId]);
    if (!mitarbeiter) return 0;

    const vorjahr = jahr - 1;
    const eintrittsjahr = new Date(mitarbeiter.eintrittsdatum).getFullYear();

    // Kein Übertrag im Eintrittsjahr oder davor
    if (vorjahr < eintrittsjahr) return 0;

    // Rekursiv: Übertrag vom Vorvorjahr
    const uebertragVorvorjahr = await this.berechneUebertrag(mitarbeiterId, vorjahr);

    // Urlaubsanspruch im Vorjahr (anteilig wenn Eintrittsjahr)
    const urlaubsanspruchVorjahr = this.berechneAnteiligenUrlaub(mitarbeiter, vorjahr);

    // Verfügbar im Vorjahr
    const verfuegbarVorjahr = urlaubsanspruchVorjahr + uebertragVorvorjahr;

    // Genommen im Vorjahr
    const genommenVorjahr = await this.getUrlaubSummeNachJahr(mitarbeiterId, vorjahr);

    // Rest berechnen
    const rest = verfuegbarVorjahr - genommenVorjahr;

    // Max 30 Tage, min 0
    return Math.min(Math.max(rest, 0), 30);
  }

  /**
   * Gibt Urlaubssumme für ein Jahr zurück
   */
  async getUrlaubSummeNachJahr(mitarbeiterId, jahr) {
    const sql = `
      SELECT COALESCE(SUM(tage), 0) as summe
      FROM urlaub
      WHERE mitarbeiter_id = ?
        AND strftime('%Y', von_datum) = ?
    `;

    const result = await this.db.get(sql, [mitarbeiterId, jahr.toString()]);
    return result.summe || 0;
  }

  /**
   * Berechnet den anteiligen Urlaubsanspruch im Eintrittsjahr
   * Ab Folgejahr gilt der volle Anspruch
   */
  berechneAnteiligenUrlaub(mitarbeiter, jahr) {
    const eintrittsdatum = new Date(mitarbeiter.eintrittsdatum);
    const eintrittsjahr = eintrittsdatum.getFullYear();
    const urlaubstageJahr = mitarbeiter.urlaubstage_jahr;

    // Volles Jahr wenn nicht Eintrittsjahr
    if (jahr !== eintrittsjahr) {
      return urlaubstageJahr;
    }

    // Im Eintrittsjahr: Anteilig berechnen
    // Eintrittsmonat zählt voll mit (Januar = 1, Dezember = 12)
    const eintrittsmonat = eintrittsdatum.getMonth() + 1; // 0-basiert -> 1-basiert
    
    // Anzahl der verbleibenden Monate (inkl. Eintrittsmonat)
    const verbleibendeMonate = 12 - eintrittsmonat + 1;
    
    // Anteiliger Urlaub = Jahresurlaub / 12 * verbleibende Monate
    const anteiligerUrlaub = (urlaubstageJahr / 12) * verbleibendeMonate;
    
    // Auf 0.5 Tage runden
    return Math.round(anteiligerUrlaub * 2) / 2;
  }

  /**
   * Gibt Statistik für einen Mitarbeiter zurück
   */
  async getMitarbeiterStatistik(mitarbeiterId) {
    const mitarbeiter = await this.db.get(`
      SELECT m.*, a.name as abteilung_name, a.farbe as abteilung_farbe
      FROM mitarbeiter m
      LEFT JOIN abteilungen a ON m.abteilung_id = a.id
      WHERE m.id = ?
    `, [mitarbeiterId]);

    if (!mitarbeiter) return null;

    // Übertrag berechnen
    const uebertrag = await this.berechneUebertrag(mitarbeiterId, this.aktuellesJahr);

    // Anteiligen Urlaubsanspruch berechnen (nur im Eintrittsjahr relevant)
    const urlaubsanspruch = this.berechneAnteiligenUrlaub(mitarbeiter, this.aktuellesJahr);

    // Urlaub genommen
    const urlaubGenommen = await this.getUrlaubSummeNachJahr(mitarbeiterId, this.aktuellesJahr);

    // Krankheitstage
    const krankheit = await this.db.get(`
      SELECT COALESCE(SUM(tage), 0) as summe
      FROM krankheit
      WHERE mitarbeiter_id = ?
        AND strftime('%Y', von_datum) = ?
    `, [mitarbeiterId, this.aktuellesJahr.toString()]);

    // Schulungstage
    const schulung = await this.db.get(`
      SELECT COALESCE(SUM(dauer_tage), 0) as summe
      FROM schulung
      WHERE mitarbeiter_id = ?
        AND strftime('%Y', datum) = ?
    `, [mitarbeiterId, this.aktuellesJahr.toString()]);

    // Überstunden
    const ueberstunden = await this.db.get(`
      SELECT COALESCE(SUM(stunden), 0) as summe
      FROM ueberstunden
      WHERE mitarbeiter_id = ?
        AND strftime('%Y', datum) = ?
    `, [mitarbeiterId, this.aktuellesJahr.toString()]);

    return {
      mitarbeiter,
      urlaubsanspruch: urlaubsanspruch, // Anteilig im Eintrittsjahr
      uebertrag_vorjahr: uebertrag,
      urlaub_verfuegbar: urlaubsanspruch + uebertrag,
      urlaub_genommen: urlaubGenommen,
      urlaub_rest: urlaubsanspruch + uebertrag - urlaubGenommen,
      krankheitstage: krankheit.summe,
      schulungstage: schulung.summe,
      ueberstunden: ueberstunden.summe
    };
  }

  /**
   * Gibt alle Statistiken zurück
   */
  async getAlleStatistiken(abteilung = null) {
    let mitarbeiter;

    if (abteilung && abteilung !== 'Alle') {
      const abt = await this.db.get('SELECT id FROM abteilungen WHERE name = ?', [abteilung]);
      if (!abt) return [];

      mitarbeiter = await this.db.query(`
        SELECT * FROM mitarbeiter
        WHERE abteilung_id = ? AND status = 'AKTIV'
        ORDER BY nachname, vorname
      `, [abt.id]);
    } else {
      mitarbeiter = await this.db.query(`
        SELECT * FROM mitarbeiter
        WHERE status = 'AKTIV'
        ORDER BY nachname, vorname
      `);
    }

    const statistiken = [];
    for (const ma of mitarbeiter) {
      const stat = await this.getMitarbeiterStatistik(ma.id);
      if (stat) {
        statistiken.push(stat);
      }
    }

    return statistiken;
  }

  /**
   * Fügt Mitarbeiter hinzu
   */
  async stammdatenHinzufuegen(mitarbeiterId, daten) {
    try {
      // Abteilung finden
      const abteilung = await this.db.get('SELECT id FROM abteilungen WHERE name = ?', [daten.abteilung]);
      if (!abteilung) {
        throw new Error(`Abteilung '${daten.abteilung}' nicht gefunden`);
      }

      // Mitarbeiter einfügen
      const sql = `
        INSERT INTO mitarbeiter (
          id, abteilung_id, vorname, nachname, email,
          geburtsdatum, eintrittsdatum, urlaubstage_jahr, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AKTIV')
      `;

      await this.db.run(sql, [
        mitarbeiterId,
        abteilung.id,
        daten.vorname,
        daten.nachname,
        daten.email || null,
        daten.geburtsdatum || null,
        daten.einstellungsdatum || new Date().toISOString().split('T')[0],
        daten.urlaubstage_jahr || 30
      ]);

      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Hinzufügen:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert Mitarbeiter
   */
  async stammdatenAktualisieren(mitarbeiterId, daten) {
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
        const abt = await this.db.get('SELECT id FROM abteilungen WHERE name = ?', [daten.abteilung]);
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
      await this.db.run(sql, values);

      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      throw error;
    }
  }

  /**
   * Deaktiviert einen Mitarbeiter
   */
  async mitarbeiterDeaktivieren(mitarbeiterId) {
    try {
      await this.db.run(`
        UPDATE mitarbeiter
        SET status = 'INAKTIV', aktualisiert_am = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [mitarbeiterId]);

      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Deaktivieren:', error);
      throw error;
    }
  }

  /**
   * Speichert einen Eintrag (Urlaub, Krankheit, etc.)
   */
  async speichereEintrag(eintrag) {
    try {
      const typ = eintrag.typ;
      const mitarbeiterId = eintrag.mitarbeiter_id;
      const datum = eintrag.datum;
      const wert = parseFloat(eintrag.wert);
      const notiz = eintrag.beschreibung || null;

      if (typ === 'urlaub') {
        const vonDatum = new Date(datum);
        const bisDatum = new Date(vonDatum);
        bisDatum.setDate(bisDatum.getDate() + Math.floor(wert) - 1);

        await this.db.run(`
          INSERT INTO urlaub (mitarbeiter_id, von_datum, bis_datum, tage, notiz)
          VALUES (?, ?, ?, ?, ?)
        `, [
          mitarbeiterId,
          datum,
          bisDatum.toISOString().split('T')[0],
          wert,
          notiz
        ]);
      } else if (typ === 'krank') {
        const vonDatum = new Date(datum);
        const bisDatum = new Date(vonDatum);
        bisDatum.setDate(bisDatum.getDate() + Math.floor(wert) - 1);

        await this.db.run(`
          INSERT INTO krankheit (mitarbeiter_id, von_datum, bis_datum, tage, notiz)
          VALUES (?, ?, ?, ?, ?)
        `, [
          mitarbeiterId,
          datum,
          bisDatum.toISOString().split('T')[0],
          wert,
          notiz
        ]);
      } else if (typ === 'schulung') {
        await this.db.run(`
          INSERT INTO schulung (mitarbeiter_id, datum, dauer_tage, titel, notiz)
          VALUES (?, ?, ?, ?, ?)
        `, [
          mitarbeiterId,
          datum,
          wert,
          eintrag.titel || null,
          notiz
        ]);
      } else if (typ === 'ueberstunden') {
        await this.db.run(`
          INSERT INTO ueberstunden (mitarbeiter_id, datum, stunden, notiz)
          VALUES (?, ?, ?, ?)
        `, [
          mitarbeiterId,
          datum,
          wert,
          notiz
        ]);
      } else {
        throw new Error(`Unbekannter Typ: ${typ}`);
      }

      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      throw error;
    }
  }

  /**
   * Gibt verfügbare Jahre zurück
   */
  async getVerfuegbareJahre() {
    const result = await this.db.query(`
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
    `);

    const jahre = new Set(result.map(r => r.jahr));

    // Aktuelles Jahr immer hinzufügen
    const aktuellesJahr = new Date().getFullYear();
    jahre.add(aktuellesJahr);
    jahre.add(aktuellesJahr + 1);

    return Array.from(jahre).sort((a, b) => b - a);
  }
}

// Export für ES6 Module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TeamplannerDataManager;
}