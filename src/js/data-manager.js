/**
 * Teamplanner Data Manager
 * Business Logic Layer - Async Version für IPC
 * 
 * FIXES:
 * - Korrekte Behandlung von db.query()/db.get() Rückgabewerten
 * - Konsistente Fehlerbehandlung
 * - Zeitzonen-Problem bei Datums-Konvertierung behoben
 * - Bis-Datum bei halben Tagen korrigiert
 * - Überlappungs-Validierung hinzugefügt
 * 
 * NEU:
 * - Filter für Mitarbeiter nach Austrittsjahr
 * - Manueller Übertrag kann gesetzt werden
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
   * Hilfsfunktion: Formatiert Datum als YYYY-MM-DD ohne Zeitzonen-Probleme
   */
  _formatDatumLokal(date) {
    const jahr = date.getFullYear();
    const monat = String(date.getMonth() + 1).padStart(2, '0');
    const tag = String(date.getDate()).padStart(2, '0');
    return `${jahr}-${monat}-${tag}`;
  }

  /**
   * Hilfsfunktion: Parst Datum-String ohne Zeitzonen-Verschiebung
   */
  _parseDatumLokal(datumStr) {
    const [jahr, monat, tag] = datumStr.split('-').map(Number);
    return new Date(jahr, monat - 1, tag);
  }

  /**
   * Gibt alle Mitarbeiter zurück (nur aktive ODER im aktuellen Jahr ausgetretene)
   * FIX: Korrekte Extraktion der Daten
   * NEU: Filtert nach Austrittsjahr
   */
  async getAlleMitarbeiter() {
    const sql = `
      SELECT m.*, a.name as abteilung_name, a.farbe as abteilung_farbe
      FROM mitarbeiter m
      LEFT JOIN abteilungen a ON m.abteilung_id = a.id
      WHERE m.status = 'AKTIV'
        AND (
          m.austrittsdatum IS NULL 
          OR CAST(strftime('%Y', m.austrittsdatum) AS INTEGER) >= ?
        )
      ORDER BY m.nachname, m.vorname
    `;

    const result = await this.db.query(sql, [this.aktuellesJahr]);
    return result.success ? result.data : [];
  }

  /**
   * Gibt einen einzelnen Mitarbeiter zurück
   * FIX: Korrekte Extraktion der Daten
   */
  async getMitarbeiter(mitarbeiterId) {
    const sql = `
      SELECT m.*, a.name as abteilung_name, a.farbe as abteilung_farbe
      FROM mitarbeiter m
      LEFT JOIN abteilungen a ON m.abteilung_id = a.id
      WHERE m.id = ?
    `;

    const result = await this.db.get(sql, [mitarbeiterId]);
    return result.success ? result.data : null;
  }

  /**
   * Gibt alle Abteilungen zurück
   * FIX: Korrekte Extraktion der Daten
   */
  async getAlleAbteilungen() {
    const result = await this.db.query('SELECT * FROM abteilungen ORDER BY name');
    return result.success ? result.data : [];
  }

  /**
   * Gibt eine einzelne Abteilung zurück
   * FIX: Korrekte Extraktion der Daten
   */
  async getAbteilung(abteilungId) {
    const result = await this.db.get('SELECT * FROM abteilungen WHERE id = ?', [abteilungId]);
    return result.success ? result.data : null;
  }

  /**
   * Gibt die Anzahl der Mitarbeiter in einer Abteilung zurück
   * FIX: Korrekte Extraktion der Daten
   */
  async getMitarbeiterAnzahlInAbteilung(abteilungId) {
    const result = await this.db.get(`
      SELECT COUNT(*) as count 
      FROM mitarbeiter 
      WHERE abteilung_id = ? AND status = 'AKTIV'
    `, [abteilungId]);
    return (result.success && result.data) ? result.data.count : 0;
  }

  /**
   * Fügt eine neue Abteilung hinzu
   * FIX: Korrekte Fehlerbehandlung
   */
  async abteilungHinzufuegen(daten) {
    try {
      // Prüfe ob Name bereits existiert
      const existingResult = await this.db.get('SELECT id FROM abteilungen WHERE name = ?', [daten.name]);
      if (existingResult.success && existingResult.data) {
        throw new Error(`Eine Abteilung mit dem Namen "${daten.name}" existiert bereits`);
      }

      const sql = `
        INSERT INTO abteilungen (name, farbe, beschreibung)
        VALUES (?, ?, ?)
      `;

      const result = await this.db.run(sql, [daten.name, daten.farbe, daten.beschreibung]);
      if (!result.success) {
        throw new Error(result.error);
      }

      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Hinzufügen der Abteilung:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert eine Abteilung
   * FIX: Korrekte Fehlerbehandlung
   */
  async abteilungAktualisieren(abteilungId, daten) {
    try {
      // Prüfe ob Name bereits von einer anderen Abteilung verwendet wird
      const existingResult = await this.db.get(
        'SELECT id FROM abteilungen WHERE name = ? AND id != ?', 
        [daten.name, abteilungId]
      );
      if (existingResult.success && existingResult.data) {
        throw new Error(`Eine Abteilung mit dem Namen "${daten.name}" existiert bereits`);
      }

      const sql = `
        UPDATE abteilungen 
        SET name = ?, farbe = ?, beschreibung = ?
        WHERE id = ?
      `;

      const result = await this.db.run(sql, [daten.name, daten.farbe, daten.beschreibung, abteilungId]);
      if (!result.success) {
        throw new Error(result.error);
      }

      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Abteilung:', error);
      throw error;
    }
  }

  /**
   * Löscht eine Abteilung (nur wenn keine Mitarbeiter zugeordnet sind)
   * FIX: Korrekte Fehlerbehandlung
   */
  async abteilungLoeschen(abteilungId) {
    try {
      // Prüfe ob noch Mitarbeiter in der Abteilung sind
      const count = await this.getMitarbeiterAnzahlInAbteilung(abteilungId);
      if (count > 0) {
        throw new Error(`Die Abteilung kann nicht gelöscht werden, da noch ${count} Mitarbeiter zugeordnet sind`);
      }

      const result = await this.db.run('DELETE FROM abteilungen WHERE id = ?', [abteilungId]);
      if (!result.success) {
        throw new Error(result.error);
      }

      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Löschen der Abteilung:', error);
      throw error;
    }
  }

  /**
   * Gibt manuellen Übertrag für ein Jahr zurück (falls vorhanden)
   * NEU: Für manuelle Übertrag-Anpassung
   */
  async getManuellAngepassterUebertrag(mitarbeiterId, jahr) {
    const result = await this.db.get(`
      SELECT uebertrag_tage, notiz 
      FROM uebertrag_manuell 
      WHERE mitarbeiter_id = ? AND jahr = ?
    `, [mitarbeiterId, jahr]);
    
    return result.success && result.data ? result.data : null;
  }

  /**
   * Setzt manuellen Übertrag für ein Jahr
   * NEU: Für manuelle Übertrag-Anpassung
   */
  async setManuellAngepassterUebertrag(mitarbeiterId, jahr, tage, notiz = null) {
    const result = await this.db.run(`
      INSERT OR REPLACE INTO uebertrag_manuell (mitarbeiter_id, jahr, uebertrag_tage, notiz)
      VALUES (?, ?, ?, ?)
    `, [mitarbeiterId, jahr, tage, notiz]);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    this.invalidateCache();
    return true;
  }

  /**
   * Löscht manuellen Übertrag (zurück zur automatischen Berechnung)
   * NEU: Für manuelle Übertrag-Anpassung
   */
  async loescheManuellAngepassterUebertrag(mitarbeiterId, jahr) {
    const result = await this.db.run(`
      DELETE FROM uebertrag_manuell 
      WHERE mitarbeiter_id = ? AND jahr = ?
    `, [mitarbeiterId, jahr]);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    this.invalidateCache();
    return true;
  }

  /**
   * Berechnet Urlaubsübertrag rekursiv
   * NEU: Verwendet manuellen Übertrag falls vorhanden
   * FIX: Korrekte Datenextraktion + Tiefenbegrenzung
   */
  async berechneUebertrag(mitarbeiterId, jahr, tiefe = 0) {
    // Prüfe zuerst ob es einen manuellen Übertrag gibt
    const manuell = await this.getManuellAngepassterUebertrag(mitarbeiterId, jahr);
    if (manuell) {
      return manuell.uebertrag_tage;
    }
    
    // Sicherheit: Max 50 Jahre zurück berechnen
    if (tiefe > 50) {
      console.warn('Übertrag-Berechnung: Maximale Tiefe erreicht');
      return 0;
    }

    // Mitarbeiter laden
    const mitarbeiterResult = await this.db.get('SELECT * FROM mitarbeiter WHERE id = ?', [mitarbeiterId]);
    if (!mitarbeiterResult.success || !mitarbeiterResult.data) return 0;
    
    const mitarbeiter = mitarbeiterResult.data;

    const vorjahr = jahr - 1;
    const eintrittsjahr = new Date(mitarbeiter.eintrittsdatum).getFullYear();

    // Kein Übertrag im Eintrittsjahr oder davor
    if (vorjahr < eintrittsjahr) return 0;

    // Rekursiv: Übertrag vom Vorvorjahr
    const uebertragVorvorjahr = await this.berechneUebertrag(mitarbeiterId, vorjahr, tiefe + 1);

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
   * FIX: Korrekte Datenextraktion
   */
  async getUrlaubSummeNachJahr(mitarbeiterId, jahr) {
    const sql = `
      SELECT COALESCE(SUM(tage), 0) as summe
      FROM urlaub
      WHERE mitarbeiter_id = ?
        AND strftime('%Y', von_datum) = ?
    `;

    const result = await this.db.get(sql, [mitarbeiterId, jahr.toString()]);
    return (result.success && result.data) ? result.data.summe : 0;
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
   * FIX: Korrekte Datenextraktion überall
   */
  async getMitarbeiterStatistik(mitarbeiterId) {
    const mitarbeiterResult = await this.db.get(`
      SELECT m.*, a.name as abteilung_name, a.farbe as abteilung_farbe
      FROM mitarbeiter m
      LEFT JOIN abteilungen a ON m.abteilung_id = a.id
      WHERE m.id = ?
    `, [mitarbeiterId]);

    if (!mitarbeiterResult.success || !mitarbeiterResult.data) return null;
    
    const mitarbeiter = mitarbeiterResult.data;

    // Übertrag berechnen
    const uebertrag = await this.berechneUebertrag(mitarbeiterId, this.aktuellesJahr);

    // Anteiligen Urlaubsanspruch berechnen (nur im Eintrittsjahr relevant)
    const urlaubsanspruch = this.berechneAnteiligenUrlaub(mitarbeiter, this.aktuellesJahr);

    // Urlaub genommen
    const urlaubGenommen = await this.getUrlaubSummeNachJahr(mitarbeiterId, this.aktuellesJahr);

    // Krankheitstage - FIX
    const krankheitResult = await this.db.get(`
      SELECT COALESCE(SUM(tage), 0) as summe
      FROM krankheit
      WHERE mitarbeiter_id = ?
        AND strftime('%Y', von_datum) = ?
    `, [mitarbeiterId, this.aktuellesJahr.toString()]);

    // Schulungstage - FIX
    const schulungResult = await this.db.get(`
      SELECT COALESCE(SUM(dauer_tage), 0) as summe
      FROM schulung
      WHERE mitarbeiter_id = ?
        AND strftime('%Y', datum) = ?
    `, [mitarbeiterId, this.aktuellesJahr.toString()]);

    // Überstunden - FIX
    const ueberstundenResult = await this.db.get(`
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
      krankheitstage: (krankheitResult.success && krankheitResult.data) ? krankheitResult.data.summe : 0,
      schulungstage: (schulungResult.success && schulungResult.data) ? schulungResult.data.summe : 0,
      ueberstunden: (ueberstundenResult.success && ueberstundenResult.data) ? ueberstundenResult.data.summe : 0
    };
  }

  /**
   * Gibt alle Statistiken zurück (gefiltert nach Austrittsjahr)
   * FIX: Korrekte Datenextraktion
   * NEU: Zeigt nur Mitarbeiter die im aktuellen Jahr aktiv/ausgetreten sind
   */
  async getAlleStatistiken(abteilung = null) {
    let mitarbeiter = [];

    if (abteilung && abteilung !== 'Alle') {
      const abtResult = await this.db.get('SELECT id FROM abteilungen WHERE name = ?', [abteilung]);
      if (!abtResult.success || !abtResult.data) return [];

      const maResult = await this.db.query(`
        SELECT * FROM mitarbeiter
        WHERE abteilung_id = ? 
          AND status = 'AKTIV'
          AND (
            austrittsdatum IS NULL 
            OR CAST(strftime('%Y', austrittsdatum) AS INTEGER) >= ?
          )
        ORDER BY nachname, vorname
      `, [abtResult.data.id, this.aktuellesJahr]);
      
      mitarbeiter = maResult.success ? maResult.data : [];
    } else {
      const maResult = await this.db.query(`
        SELECT * FROM mitarbeiter
        WHERE status = 'AKTIV'
          AND (
            austrittsdatum IS NULL 
            OR CAST(strftime('%Y', austrittsdatum) AS INTEGER) >= ?
          )
        ORDER BY nachname, vorname
      `, [this.aktuellesJahr]);
      
      mitarbeiter = maResult.success ? maResult.data : [];
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
   * Sanitiert einen String für die ID-Generierung
   * FIX: Umlaute und Sonderzeichen werden korrekt behandelt
   */
  _sanitizeForId(str) {
    return str
      .replace(/ä/gi, 'ae')
      .replace(/ö/gi, 'oe')
      .replace(/ü/gi, 'ue')
      .replace(/ß/gi, 'ss')
      .replace(/[^A-Z0-9]/gi, '')
      .toUpperCase();
  }

  /**
   * Fügt Mitarbeiter hinzu
   * FIX: Korrekte Fehlerbehandlung + ID-Sanitierung
   */
  async stammdatenHinzufuegen(mitarbeiterId, daten) {
    try {
      // Abteilung finden
      const abteilungResult = await this.db.get('SELECT id FROM abteilungen WHERE name = ?', [daten.abteilung]);
      if (!abteilungResult.success || !abteilungResult.data) {
        throw new Error(`Abteilung '${daten.abteilung}' nicht gefunden`);
      }

      // Mitarbeiter einfügen
      const sql = `
        INSERT INTO mitarbeiter (
          id, abteilung_id, vorname, nachname, email,
          geburtsdatum, eintrittsdatum, urlaubstage_jahr, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AKTIV')
      `;

      const result = await this.db.run(sql, [
        mitarbeiterId,
        abteilungResult.data.id,
        daten.vorname,
        daten.nachname,
        daten.email || null,
        daten.geburtsdatum || null,
        daten.einstellungsdatum || new Date().toISOString().split('T')[0],
        daten.urlaubstage_jahr || 30
      ]);

      if (!result.success) {
        throw new Error(result.error);
      }

      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Hinzufügen:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert Mitarbeiter
   * FIX: Korrekte Fehlerbehandlung
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
        const abtResult = await this.db.get('SELECT id FROM abteilungen WHERE name = ?', [daten.abteilung]);
        if (abtResult.success && abtResult.data) {
          updates.push('abteilung_id = ?');
          values.push(abtResult.data.id);
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
      const result = await this.db.run(sql, values);

      if (!result.success) {
        throw new Error(result.error);
      }

      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      throw error;
    }
  }

  /**
   * Deaktiviert einen Mitarbeiter
   * FIX: Korrekte Fehlerbehandlung
   */
  async mitarbeiterDeaktivieren(mitarbeiterId) {
    try {
      const result = await this.db.run(`
        UPDATE mitarbeiter
        SET status = 'INAKTIV', aktualisiert_am = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [mitarbeiterId]);

      if (!result.success) {
        throw new Error(result.error);
      }

      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Deaktivieren:', error);
      throw error;
    }
  }

  /**
   * Prüft ob bereits ein Eintrag im gleichen Zeitraum existiert
   * NEU: Verhindert doppelte Buchungen
   */
  async pruefeUeberlappung(tabelle, mitarbeiterId, vonDatum, bisDatum) {
    // Nur erlaubte Tabellennamen zulassen (SQL-Injection-Schutz)
    const erlaubteTabellem = ['urlaub', 'krankheit'];
    if (!erlaubteTabellem.includes(tabelle)) {
      throw new Error(`Ungültiger Tabellenname: ${tabelle}`);
    }

    const sql = `
      SELECT COUNT(*) as count FROM ${tabelle}
      WHERE mitarbeiter_id = ?
        AND (
          (von_datum BETWEEN ? AND ?)
          OR (bis_datum BETWEEN ? AND ?)
          OR (von_datum <= ? AND bis_datum >= ?)
        )
    `;
    
    const result = await this.db.get(sql, [
      mitarbeiterId,
      vonDatum, bisDatum,
      vonDatum, bisDatum,
      vonDatum, bisDatum
    ]);
    
    return (result.success && result.data && result.data.count > 0);
  }

  /**
   * Speichert einen Eintrag (Urlaub, Krankheit, etc.)
   * FIX: Korrekte Fehlerbehandlung + Zeitzonen-Fix + Halbe-Tage-Fix + Überlappungs-Check
   */
  async speichereEintrag(eintrag) {
    try {
      const typ = eintrag.typ;
      const mitarbeiterId = eintrag.mitarbeiter_id;
      const datum = eintrag.datum;
      const wert = parseFloat(eintrag.wert);
      const notiz = eintrag.beschreibung || null;

      let result;

      if (typ === 'urlaub') {
        // FIX: Datum lokal parsen (ohne UTC-Konvertierung)
        const vonDatum = this._parseDatumLokal(datum);
        const bisDatum = new Date(vonDatum);
        
        // FIX: Bei halben Tagen (0.5) oder 1 Tag bleibt bisDatum = vonDatum
        // Bei mehr als 1 Tag: bisDatum = vonDatum + (aufgerundete Tage - 1)
        const ganzeTage = Math.ceil(wert);
        if (ganzeTage > 1) {
          bisDatum.setDate(bisDatum.getDate() + ganzeTage - 1);
        }

        const bisDatumStr = this._formatDatumLokal(bisDatum);

        // NEU: Prüfe auf Überlappungen
        const hatUeberlappung = await this.pruefeUeberlappung('urlaub', mitarbeiterId, datum, bisDatumStr);
        if (hatUeberlappung) {
          throw new Error('Im gewählten Zeitraum existiert bereits ein Urlaubseintrag. Bitte prüfen Sie die bestehenden Einträge.');
        }

        result = await this.db.run(`
          INSERT INTO urlaub (mitarbeiter_id, von_datum, bis_datum, tage, notiz)
          VALUES (?, ?, ?, ?, ?)
        `, [
          mitarbeiterId,
          datum,
          bisDatumStr,
          wert,
          notiz
        ]);
      } else if (typ === 'krank') {
        // FIX: Datum lokal parsen (ohne UTC-Konvertierung)
        const vonDatum = this._parseDatumLokal(datum);
        const bisDatum = new Date(vonDatum);
        
        // FIX: Gleiche Logik wie bei Urlaub
        const ganzeTage = Math.ceil(wert);
        if (ganzeTage > 1) {
          bisDatum.setDate(bisDatum.getDate() + ganzeTage - 1);
        }

        const bisDatumStr = this._formatDatumLokal(bisDatum);

        // NEU: Prüfe auf Überlappungen
        const hatUeberlappung = await this.pruefeUeberlappung('krankheit', mitarbeiterId, datum, bisDatumStr);
        if (hatUeberlappung) {
          throw new Error('Im gewählten Zeitraum existiert bereits ein Krankheitseintrag. Bitte prüfen Sie die bestehenden Einträge.');
        }

        result = await this.db.run(`
          INSERT INTO krankheit (mitarbeiter_id, von_datum, bis_datum, tage, notiz)
          VALUES (?, ?, ?, ?, ?)
        `, [
          mitarbeiterId,
          datum,
          bisDatumStr,
          wert,
          notiz
        ]);
      } else if (typ === 'schulung') {
        result = await this.db.run(`
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
        result = await this.db.run(`
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

      if (!result.success) {
        throw new Error(result.error);
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
   * FIX: Korrekte Datenextraktion
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

    const data = result.success ? result.data : [];
    const jahre = new Set(data.map(r => r.jahr).filter(j => j != null));

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