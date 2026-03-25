/**
 * TeamFlow Data Manager
 * Business Logic Layer - Async Version für IPC
 * 
 * NEU: uebertrag_verfaellt - pro Mitarbeiter konfigurierbar ob
 *      Übertrag am 31.03. verfällt (Default: ja)
 */

class TeamFlowDataManager {
  constructor(database, jahr = null) {
    this.db = database;
    this.aktuellesJahr = jahr || new Date().getFullYear();
    this.cache = new Map();
    this.cacheValid = false;

    console.log(`✅ DataManager initialisiert (Jahr: ${this.aktuellesJahr})`);
  }

  invalidateCache() {
    this.cacheValid = false;
    this.cache.clear();
  }

  _formatDatumLokal(date) {
    const jahr = date.getFullYear();
    const monat = String(date.getMonth() + 1).padStart(2, '0');
    const tag = String(date.getDate()).padStart(2, '0');
    return `${jahr}-${monat}-${tag}`;
  }

  _parseDatumLokal(datumStr) {
    const [jahr, monat, tag] = datumStr.split('-').map(Number);
    return new Date(jahr, monat - 1, tag);
  }

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

  async getAlleAbteilungen() {
    const result = await this.db.query('SELECT * FROM abteilungen ORDER BY name');
    return result.success ? result.data : [];
  }

  async getAbteilung(abteilungId) {
    const result = await this.db.get('SELECT * FROM abteilungen WHERE id = ?', [abteilungId]);
    return result.success ? result.data : null;
  }

  async getMitarbeiterAnzahlInAbteilung(abteilungId) {
    const result = await this.db.get(`
      SELECT COUNT(*) as count 
      FROM mitarbeiter 
      WHERE abteilung_id = ? AND status = 'AKTIV'
    `, [abteilungId]);
    return (result.success && result.data) ? result.data.count : 0;
  }

  async abteilungHinzufuegen(daten) {
    try {
      const existingResult = await this.db.get('SELECT id FROM abteilungen WHERE name = ?', [daten.name]);
      if (existingResult.success && existingResult.data) {
        throw new Error(`Eine Abteilung mit dem Namen "${daten.name}" existiert bereits`);
      }
      const sql = `INSERT INTO abteilungen (name, farbe, beschreibung) VALUES (?, ?, ?)`;
      const result = await this.db.run(sql, [daten.name, daten.farbe, daten.beschreibung]);
      if (!result.success) throw new Error(result.error);
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Hinzufügen der Abteilung:', error);
      throw error;
    }
  }

  async abteilungAktualisieren(abteilungId, daten) {
    try {
      const existingResult = await this.db.get(
        'SELECT id FROM abteilungen WHERE name = ? AND id != ?', 
        [daten.name, abteilungId]
      );
      if (existingResult.success && existingResult.data) {
        throw new Error(`Eine Abteilung mit dem Namen "${daten.name}" existiert bereits`);
      }
      const sql = `UPDATE abteilungen SET name = ?, farbe = ?, beschreibung = ? WHERE id = ?`;
      const result = await this.db.run(sql, [daten.name, daten.farbe, daten.beschreibung, abteilungId]);
      if (!result.success) throw new Error(result.error);
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Abteilung:', error);
      throw error;
    }
  }

  async abteilungLoeschen(abteilungId) {
    try {
      const count = await this.getMitarbeiterAnzahlInAbteilung(abteilungId);
      if (count > 0) {
        throw new Error(`Die Abteilung kann nicht gelöscht werden, da noch ${count} Mitarbeiter zugeordnet sind`);
      }
      const result = await this.db.run('DELETE FROM abteilungen WHERE id = ?', [abteilungId]);
      if (!result.success) throw new Error(result.error);
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Löschen der Abteilung:', error);
      throw error;
    }
  }

  async getManuellAngepassterUebertrag(mitarbeiterId, jahr) {
    const result = await this.db.get(`
      SELECT uebertrag_tage, notiz 
      FROM uebertrag_manuell 
      WHERE mitarbeiter_id = ? AND jahr = ?
    `, [mitarbeiterId, jahr]);
    return result.success && result.data ? result.data : null;
  }

  async setManuellAngepassterUebertrag(mitarbeiterId, jahr, tage, notiz = null) {
    const result = await this.db.run(`
      INSERT OR REPLACE INTO uebertrag_manuell (mitarbeiter_id, jahr, uebertrag_tage, notiz)
      VALUES (?, ?, ?, ?)
    `, [mitarbeiterId, jahr, tage, notiz]);
    if (!result.success) throw new Error(result.error);
    this.invalidateCache();
    return true;
  }

  async loescheManuellAngepassterUebertrag(mitarbeiterId, jahr) {
    const result = await this.db.run(`
      DELETE FROM uebertrag_manuell WHERE mitarbeiter_id = ? AND jahr = ?
    `, [mitarbeiterId, jahr]);
    if (!result.success) throw new Error(result.error);
    this.invalidateCache();
    return true;
  }

  /**
   * NEU: Setzt die Verfalls-Einstellung für den Übertrag
   * 1 = verfällt am 31.03. (Default), 0 = verfällt nicht
   */
  async setUebertragVerfaellt(mitarbeiterId, wert) {
    const result = await this.db.run(
      'UPDATE mitarbeiter SET uebertrag_verfaellt = ? WHERE id = ?',
      [wert ? 1 : 0, mitarbeiterId]
    );
    if (!result.success) throw new Error(result.error);
    this.invalidateCache();
    return true;
  }

  async berechneUebertrag(mitarbeiterId, jahr, tiefe = 0) {
    const manuell = await this.getManuellAngepassterUebertrag(mitarbeiterId, jahr);
    if (manuell) return manuell.uebertrag_tage;
    
    if (tiefe > 50) {
      console.warn('Übertrag-Berechnung: Maximale Tiefe erreicht');
      return 0;
    }

    const mitarbeiterResult = await this.db.get('SELECT * FROM mitarbeiter WHERE id = ?', [mitarbeiterId]);
    if (!mitarbeiterResult.success || !mitarbeiterResult.data) return 0;
    const mitarbeiter = mitarbeiterResult.data;

    const vorjahr = jahr - 1;
    const eintrittsjahr = new Date(mitarbeiter.eintrittsdatum).getFullYear();
    if (vorjahr < eintrittsjahr) return 0;

    const uebertragVorvorjahr = await this.berechneUebertrag(mitarbeiterId, vorjahr, tiefe + 1);
    const urlaubsanspruchVorjahr = this.berechneAnteiligenUrlaub(mitarbeiter, vorjahr);
    const verfuegbarVorjahr = urlaubsanspruchVorjahr + uebertragVorvorjahr;
    const genommenVorjahr = await this.getUrlaubSummeNachJahr(mitarbeiterId, vorjahr);
    const rest = verfuegbarVorjahr - genommenVorjahr;
    return Math.min(Math.max(rest, 0), 30);
  }

  async getUrlaubSummeNachJahr(mitarbeiterId, jahr) {
    const sql = `
      SELECT COALESCE(SUM(tage), 0) as summe
      FROM urlaub
      WHERE mitarbeiter_id = ? AND strftime('%Y', von_datum) = ?
    `;
    const result = await this.db.get(sql, [mitarbeiterId, jahr.toString()]);
    return (result.success && result.data) ? result.data.summe : 0;
  }

  berechneAnteiligenUrlaub(mitarbeiter, jahr) {
    const eintrittsdatum = new Date(mitarbeiter.eintrittsdatum);
    const eintrittsjahr = eintrittsdatum.getFullYear();
    const urlaubstageJahr = mitarbeiter.urlaubstage_jahr;
    if (jahr !== eintrittsjahr) return urlaubstageJahr;
    const eintrittsmonat = eintrittsdatum.getMonth() + 1;
    const verbleibendeMonate = 12 - eintrittsmonat + 1;
    const anteiligerUrlaub = (urlaubstageJahr / 12) * verbleibendeMonate;
    return Math.round(anteiligerUrlaub * 2) / 2;
  }

  async getUeberstundenUebertrag(mitarbeiterId, jahr) {
    const vorjahr = jahr - 1;
    const result = await this.db.get(`
      SELECT COALESCE(SUM(stunden), 0) as summe
      FROM ueberstunden
      WHERE mitarbeiter_id = ? AND strftime('%Y', datum) <= ?
    `, [mitarbeiterId, vorjahr.toString()]);
    return (result.success && result.data) ? result.data.summe : 0;
  }

  async getUeberstundenGemachtImJahr(mitarbeiterId, jahr) {
    const result = await this.db.get(`
      SELECT COALESCE(SUM(stunden), 0) as summe
      FROM ueberstunden
      WHERE mitarbeiter_id = ? AND strftime('%Y', datum) = ? AND stunden > 0
    `, [mitarbeiterId, jahr.toString()]);
    return (result.success && result.data) ? result.data.summe : 0;
  }

  async getUeberstundenAbbauImJahr(mitarbeiterId, jahr) {
    const result = await this.db.get(`
      SELECT COALESCE(ABS(SUM(stunden)), 0) as summe
      FROM ueberstunden
      WHERE mitarbeiter_id = ? AND strftime('%Y', datum) = ? AND stunden < 0
    `, [mitarbeiterId, jahr.toString()]);
    return (result.success && result.data) ? result.data.summe : 0;
  }

  async getUeberstundenDetails(mitarbeiterId, jahr) {
    const uebertrag = await this.getUeberstundenUebertrag(mitarbeiterId, jahr);
    const gemacht = await this.getUeberstundenGemachtImJahr(mitarbeiterId, jahr);
    const abgebaut = await this.getUeberstundenAbbauImJahr(mitarbeiterId, jahr);
    return { uebertrag, gemacht, abgebaut, saldo: uebertrag + gemacht - abgebaut };
  }

  async getVerfallenderUrlaub(mitarbeiterId, jahr) {
    const uebertrag = await this.berechneUebertrag(mitarbeiterId, jahr);
    if (uebertrag <= 0) {
      return { uebertrag: 0, genommenBisMaerz: 0, verfaellt: 0, stichtag: `31.03.${jahr}` };
    }
    const result = await this.db.get(`
      SELECT COALESCE(SUM(tage), 0) as summe
      FROM urlaub
      WHERE mitarbeiter_id = ? AND von_datum >= ? AND von_datum <= ?
    `, [mitarbeiterId, `${jahr}-01-01`, `${jahr}-03-31`]);
    const genommenBisMaerz = (result.success && result.data) ? result.data.summe : 0;
    const verfaellt = Math.max(uebertrag - genommenBisMaerz, 0);
    return { uebertrag, genommenBisMaerz, verfaellt, stichtag: `31.03.${jahr}` };
  }

  /**
   * Gibt Statistik für einen Mitarbeiter zurück
   * NEU: uebertrag_verfaellt wird pro Mitarbeiter berücksichtigt
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

    let uebertrag = await this.berechneUebertrag(mitarbeiterId, this.aktuellesJahr);

    const heute = new Date();
    const stichtag = new Date(this.aktuellesJahr, 2, 31); // 31. März

    let verfallenderUebertrag = 0;

    // NEU: Verfall nur wenn uebertrag_verfaellt === 1 (oder undefined → Default true)
    const verfaelltAktiv = mitarbeiter.uebertrag_verfaellt !== undefined
      ? mitarbeiter.uebertrag_verfaellt === 1
      : true;

    if (verfaelltAktiv && heute > stichtag && uebertrag > 0) {
      const verfallInfo = await this.getVerfallenderUrlaub(mitarbeiterId, this.aktuellesJahr);
      verfallenderUebertrag = verfallInfo.verfaellt;
      uebertrag = Math.max(0, uebertrag - verfallenderUebertrag);
    }

    const urlaubsanspruch = this.berechneAnteiligenUrlaub(mitarbeiter, this.aktuellesJahr);
    const urlaubGenommen = await this.getUrlaubSummeNachJahr(mitarbeiterId, this.aktuellesJahr);

    const krankheitResult = await this.db.get(`
      SELECT COALESCE(SUM(tage), 0) as summe FROM krankheit
      WHERE mitarbeiter_id = ? AND strftime('%Y', von_datum) = ?
    `, [mitarbeiterId, this.aktuellesJahr.toString()]);

    const schulungResult = await this.db.get(`
      SELECT COALESCE(SUM(dauer_tage), 0) as summe FROM schulung
      WHERE mitarbeiter_id = ? AND strftime('%Y', datum) = ?
    `, [mitarbeiterId, this.aktuellesJahr.toString()]);

    const ueberstundenResult = await this.db.get(`
      SELECT COALESCE(SUM(stunden), 0) as summe FROM ueberstunden
      WHERE mitarbeiter_id = ? AND strftime('%Y', datum) <= ?
    `, [mitarbeiterId, this.aktuellesJahr.toString()]);

    const uebertragVorVerfall = await this.berechneUebertrag(mitarbeiterId, this.aktuellesJahr);

    return {
      mitarbeiter,
      urlaubsanspruch,
      uebertrag_vorjahr: uebertrag,
      uebertrag_original: uebertragVorVerfall,
      verfallen: verfallenderUebertrag,
      // NEU: Gibt an ob Verfall für diesen Mitarbeiter aktiv ist
      verfaellt_aktiv: verfaelltAktiv,
      urlaub_verfuegbar: urlaubsanspruch + uebertrag,
      urlaub_genommen: urlaubGenommen,
      urlaub_rest: urlaubsanspruch + uebertrag - urlaubGenommen,
      krankheitstage: (krankheitResult.success && krankheitResult.data) ? krankheitResult.data.summe : 0,
      schulungstage: (schulungResult.success && schulungResult.data) ? schulungResult.data.summe : 0,
      ueberstunden: (ueberstundenResult.success && ueberstundenResult.data) ? ueberstundenResult.data.summe : 0
    };
  }

  async getAlleStatistiken(abteilung = null) {
    let mitarbeiter = [];

    if (abteilung && abteilung !== 'Alle') {
      const abtResult = await this.db.get('SELECT id FROM abteilungen WHERE name = ?', [abteilung]);
      if (!abtResult.success || !abtResult.data) return [];
      const maResult = await this.db.query(`
        SELECT * FROM mitarbeiter
        WHERE abteilung_id = ? AND status = 'AKTIV'
          AND (austrittsdatum IS NULL OR CAST(strftime('%Y', austrittsdatum) AS INTEGER) >= ?)
        ORDER BY nachname, vorname
      `, [abtResult.data.id, this.aktuellesJahr]);
      mitarbeiter = maResult.success ? maResult.data : [];
    } else {
      const maResult = await this.db.query(`
        SELECT * FROM mitarbeiter
        WHERE status = 'AKTIV'
          AND (austrittsdatum IS NULL OR CAST(strftime('%Y', austrittsdatum) AS INTEGER) >= ?)
        ORDER BY nachname, vorname
      `, [this.aktuellesJahr]);
      mitarbeiter = maResult.success ? maResult.data : [];
    }

    const statistiken = [];
    for (const ma of mitarbeiter) {
      const stat = await this.getMitarbeiterStatistik(ma.id);
      if (stat) statistiken.push(stat);
    }
    return statistiken;
  }

  _sanitizeForId(str) {
    return str
      .replace(/ä/gi, 'ae').replace(/ö/gi, 'oe').replace(/ü/gi, 'ue')
      .replace(/ß/gi, 'ss').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  }

  async stammdatenHinzufuegen(mitarbeiterId, daten) {
    try {
      const abteilungResult = await this.db.get('SELECT id FROM abteilungen WHERE name = ?', [daten.abteilung]);
      if (!abteilungResult.success || !abteilungResult.data) {
        throw new Error(`Abteilung '${daten.abteilung}' nicht gefunden`);
      }
      const sql = `
        INSERT INTO mitarbeiter (
          id, abteilung_id, vorname, nachname, email,
          geburtsdatum, eintrittsdatum, urlaubstage_jahr, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AKTIV')
      `;
      const result = await this.db.run(sql, [
        mitarbeiterId, abteilungResult.data.id,
        daten.vorname, daten.nachname, daten.email || null,
        daten.geburtsdatum || null,
        daten.einstellungsdatum || new Date().toISOString().split('T')[0],
        daten.urlaubstage_jahr || 30
      ]);
      if (!result.success) throw new Error(result.error);
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Hinzufügen:', error);
      throw error;
    }
  }

  async stammdatenAktualisieren(mitarbeiterId, daten) {
    try {
      const updates = [];
      const values = [];

      if (daten.vorname !== undefined) { updates.push('vorname = ?'); values.push(daten.vorname); }
      if (daten.nachname !== undefined) { updates.push('nachname = ?'); values.push(daten.nachname); }
      if (daten.email !== undefined) { updates.push('email = ?'); values.push(daten.email || null); }
      if (daten.abteilung !== undefined) {
        const abtResult = await this.db.get('SELECT id FROM abteilungen WHERE name = ?', [daten.abteilung]);
        if (abtResult.success && abtResult.data) { updates.push('abteilung_id = ?'); values.push(abtResult.data.id); }
      }
      if (daten.geburtsdatum !== undefined) { updates.push('geburtsdatum = ?'); values.push(daten.geburtsdatum || null); }
      if (daten.einstellungsdatum !== undefined) { updates.push('eintrittsdatum = ?'); values.push(daten.einstellungsdatum); }
      if (daten.austrittsdatum !== undefined) { updates.push('austrittsdatum = ?'); values.push(daten.austrittsdatum || null); }
      if (daten.urlaubstage_jahr !== undefined) { updates.push('urlaubstage_jahr = ?'); values.push(daten.urlaubstage_jahr); }
      if (daten.wochenstunden !== undefined) { updates.push('wochenstunden = ?'); values.push(daten.wochenstunden); }
      if (daten.adresse !== undefined) { updates.push('adresse = ?'); values.push(daten.adresse || null); }
      if (daten.gehalt !== undefined) { updates.push('gehalt = ?'); values.push(daten.gehalt ? parseFloat(daten.gehalt) : null); }

      if (updates.length === 0) return true;

      updates.push('aktualisiert_am = CURRENT_TIMESTAMP');
      values.push(mitarbeiterId);

      const sql = `UPDATE mitarbeiter SET ${updates.join(', ')} WHERE id = ?`;
      const result = await this.db.run(sql, values);
      if (!result.success) throw new Error(result.error);
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      throw error;
    }
  }

  async mitarbeiterDeaktivieren(mitarbeiterId) {
    try {
      const result = await this.db.run(`
        UPDATE mitarbeiter SET status = 'INAKTIV', aktualisiert_am = CURRENT_TIMESTAMP WHERE id = ?
      `, [mitarbeiterId]);
      if (!result.success) throw new Error(result.error);
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Deaktivieren:', error);
      throw error;
    }
  }

  async pruefeUeberlappung(tabelle, mitarbeiterId, vonDatum, bisDatum) {
    const erlaubteTabellem = ['urlaub', 'krankheit'];
    if (!erlaubteTabellem.includes(tabelle)) throw new Error(`Ungültiger Tabellenname: ${tabelle}`);
    const sql = `
      SELECT COUNT(*) as count FROM ${tabelle}
      WHERE mitarbeiter_id = ?
        AND ((von_datum BETWEEN ? AND ?) OR (bis_datum BETWEEN ? AND ?)
             OR (von_datum <= ? AND bis_datum >= ?))
    `;
    const result = await this.db.get(sql, [mitarbeiterId, vonDatum, bisDatum, vonDatum, bisDatum, vonDatum, bisDatum]);
    return (result.success && result.data && result.data.count > 0);
  }

  async speichereEintrag(eintrag) {
    try {
      const typ = eintrag.typ;
      const mitarbeiterId = eintrag.mitarbeiter_id;
      const datum = eintrag.datum;
      const wert = parseFloat(eintrag.wert);
      const notiz = eintrag.beschreibung || null;
      let result;

      if (typ === 'urlaub') {
        let bisDatumStr;
        if (eintrag.bis_datum) {
          bisDatumStr = eintrag.bis_datum;
        } else {
          const vonDatum = this._parseDatumLokal(datum);
          const bisDatum = new Date(vonDatum);
          if (wert > 1) bisDatum.setDate(bisDatum.getDate() + Math.floor(wert) - 1);
          bisDatumStr = this._formatDatumLokal(bisDatum);
        }
        const hatUeberlappung = await this.pruefeUeberlappung('urlaub', mitarbeiterId, datum, bisDatumStr);
        if (hatUeberlappung) throw new Error('Im gewählten Zeitraum existiert bereits ein Urlaubseintrag.');
        result = await this.db.run(`
          INSERT INTO urlaub (mitarbeiter_id, von_datum, bis_datum, tage, notiz) VALUES (?, ?, ?, ?, ?)
        `, [mitarbeiterId, datum, bisDatumStr, wert, notiz]);
      } else if (typ === 'krank') {
        const vonDatum = this._parseDatumLokal(datum);
        const bisDatum = new Date(vonDatum);
        if (wert > 1) bisDatum.setDate(bisDatum.getDate() + Math.floor(wert) - 1);
        const bisDatumStr = this._formatDatumLokal(bisDatum);
        const hatUeberlappung = await this.pruefeUeberlappung('krankheit', mitarbeiterId, datum, bisDatumStr);
        if (hatUeberlappung) throw new Error('Im gewählten Zeitraum existiert bereits ein Krankheitseintrag.');
        result = await this.db.run(`
          INSERT INTO krankheit (mitarbeiter_id, von_datum, bis_datum, tage, notiz) VALUES (?, ?, ?, ?, ?)
        `, [mitarbeiterId, datum, bisDatumStr, wert, notiz]);
      } else if (typ === 'schulung') {
        result = await this.db.run(`
          INSERT INTO schulung (mitarbeiter_id, datum, dauer_tage, titel, notiz) VALUES (?, ?, ?, ?, ?)
        `, [mitarbeiterId, datum, wert, eintrag.titel || null, notiz]);
      } else if (typ === 'ueberstunden') {
        result = await this.db.run(`
          INSERT INTO ueberstunden (mitarbeiter_id, datum, stunden, notiz) VALUES (?, ?, ?, ?)
        `, [mitarbeiterId, datum, wert, notiz]);
      } else {
        throw new Error(`Unbekannter Typ: ${typ}`);
      }

      if (!result.success) throw new Error(result.error);
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      throw error;
    }
  }

  async getArbeitszeitmodell(mitarbeiterId) {
    const result = await this.db.query(`
      SELECT wochentag, arbeitszeit FROM arbeitszeitmodell WHERE mitarbeiter_id = ? ORDER BY wochentag
    `, [mitarbeiterId]);
    return result.success ? result.data : [];
  }

  async speichereArbeitszeitmodell(mitarbeiterId, modell) {
    try {
      await this.db.run('DELETE FROM arbeitszeitmodell WHERE mitarbeiter_id = ?', [mitarbeiterId]);
      for (const tag of modell) {
        await this.db.run(`
          INSERT INTO arbeitszeitmodell (mitarbeiter_id, wochentag, arbeitszeit) VALUES (?, ?, ?)
        `, [mitarbeiterId, tag.wochentag, tag.arbeitszeit]);
      }
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Fehler beim Speichern des Arbeitszeitmodells:', error);
      throw error;
    }
  }

  async getVerfuegbareJahre() {
    const result = await this.db.query(`
      SELECT DISTINCT CAST(strftime('%Y', von_datum) AS INTEGER) as jahr FROM urlaub
      UNION
      SELECT DISTINCT CAST(strftime('%Y', von_datum) AS INTEGER) as jahr FROM krankheit
      UNION
      SELECT DISTINCT CAST(strftime('%Y', datum) AS INTEGER) as jahr FROM schulung
      UNION
      SELECT DISTINCT CAST(strftime('%Y', datum) AS INTEGER) as jahr FROM ueberstunden
      ORDER BY jahr DESC
    `);
    const data = result.success ? result.data : [];
    const jahre = new Set(data.map(r => r.jahr).filter(j => j != null));
    const aktuellesJahr = new Date().getFullYear();
    jahre.add(aktuellesJahr);
    jahre.add(aktuellesJahr + 1);
    return Array.from(jahre).sort((a, b) => b - a);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TeamFlowDataManager;
}