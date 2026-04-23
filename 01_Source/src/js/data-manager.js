/**
 * TeamFlow Data Manager
 * Business Logic Layer - Async Version für IPC
 *
 * FIXES:
 * - berechneUebertrag(): Rekursion durch iterative Schleife ersetzt;
 *   der alte tiefe-Guard konnte bei korruptem eintrittsdatum nicht greifen.
 * - Cache-Infrastruktur entfernt: this.cache / cacheValid wurden nie
 *   befüllt (nur geleert) – tote Map entfernt, invalidateCache() bleibt
 *   als No-op damit bestehende Aufrufer nicht brechen.
 * - getAlleStatistiken(): Promise.all() statt serieller for-Schleife –
 *   bei N Mitarbeitern N×8 parallele IPC-Calls statt sequenziell.
 */

class TeamFlowDataManager {
  constructor(database, jahr = null) {
    this.db = database;
    this.aktuellesJahr = jahr || new Date().getFullYear();
    console.log(`✅ DataManager initialisiert (Jahr: ${this.aktuellesJahr})`);
  }

  // FIX: Cache war nie befüllt (nur geleert). Methode bleibt als No-op
  // damit alle Aufrufer im restlichen Code nicht brechen.
  invalidateCache() {}

  _formatDatumLokal(date) {
    const j = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const t = String(date.getDate()).padStart(2, '0');
    return `${j}-${m}-${t}`;
  }

  _parseDatumLokal(datumStr) {
    const [j, m, t] = datumStr.split('-').map(Number);
    return new Date(j, m - 1, t);
  }

  async getAlleMitarbeiter() {
    const result = await this.db.query(`
      SELECT m.*, a.name as abteilung_name, a.farbe as abteilung_farbe
      FROM mitarbeiter m
      LEFT JOIN abteilungen a ON m.abteilung_id = a.id
      WHERE m.status = 'AKTIV'
  AND m.austrittsdatum IS NULL
      ORDER BY m.nachname, m.vorname
    `, [this.aktuellesJahr]);
    return result.success ? result.data : [];
  }

  async getMitarbeiter(mitarbeiterId) {
    const result = await this.db.get(`
      SELECT m.*, a.name as abteilung_name, a.farbe as abteilung_farbe
      FROM mitarbeiter m
      LEFT JOIN abteilungen a ON m.abteilung_id = a.id
      WHERE m.id = ?
    `, [mitarbeiterId]);
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
    const result = await this.db.get(
      `SELECT COUNT(*) as count FROM mitarbeiter WHERE abteilung_id = ? AND status = 'AKTIV'`,
      [abteilungId]
    );
    return (result.success && result.data) ? result.data.count : 0;
  }

  async abteilungHinzufuegen(daten) {
    const existing = await this.db.get('SELECT id FROM abteilungen WHERE name = ?', [daten.name]);
    if (existing.success && existing.data) throw new Error(`Abteilung "${daten.name}" existiert bereits`);
    const result = await this.db.run(
      'INSERT INTO abteilungen (name, farbe, beschreibung) VALUES (?, ?, ?)',
      [daten.name, daten.farbe, daten.beschreibung]
    );
    if (!result.success) throw new Error(result.error);
    return true;
  }

  async abteilungAktualisieren(abteilungId, daten) {
    const existing = await this.db.get(
      'SELECT id FROM abteilungen WHERE name = ? AND id != ?', [daten.name, abteilungId]
    );
    if (existing.success && existing.data) throw new Error(`Abteilung "${daten.name}" existiert bereits`);
    const result = await this.db.run(
      'UPDATE abteilungen SET name = ?, farbe = ?, beschreibung = ? WHERE id = ?',
      [daten.name, daten.farbe, daten.beschreibung, abteilungId]
    );
    if (!result.success) throw new Error(result.error);
    return true;
  }

  async abteilungLoeschen(abteilungId) {
    const count = await this.getMitarbeiterAnzahlInAbteilung(abteilungId);
    if (count > 0) throw new Error(`Abteilung hat noch ${count} Mitarbeiter`);
    const result = await this.db.run('DELETE FROM abteilungen WHERE id = ?', [abteilungId]);
    if (!result.success) throw new Error(result.error);
    return true;
  }

  async getManuellAngepassterUebertrag(mitarbeiterId, jahr) {
    const result = await this.db.get(
      'SELECT uebertrag_tage, notiz FROM uebertrag_manuell WHERE mitarbeiter_id = ? AND jahr = ?',
      [mitarbeiterId, jahr]
    );
    return result.success && result.data ? result.data : null;
  }

  async setManuellAngepassterUebertrag(mitarbeiterId, jahr, tage, notiz = null) {
    const result = await this.db.run(
      'INSERT OR REPLACE INTO uebertrag_manuell (mitarbeiter_id, jahr, uebertrag_tage, notiz) VALUES (?, ?, ?, ?)',
      [mitarbeiterId, jahr, tage, notiz]
    );
    if (!result.success) throw new Error(result.error);
    return true;
  }

  async loescheManuellAngepassterUebertrag(mitarbeiterId, jahr) {
    const result = await this.db.run(
      'DELETE FROM uebertrag_manuell WHERE mitarbeiter_id = ? AND jahr = ?',
      [mitarbeiterId, jahr]
    );
    if (!result.success) throw new Error(result.error);
    return true;
  }

  async setUebertragVerfaellt(mitarbeiterId, wert) {
    const result = await this.db.run(
      'UPDATE mitarbeiter SET uebertrag_verfaellt = ? WHERE id = ?',
      [wert ? 1 : 0, mitarbeiterId]
    );
    if (!result.success) throw new Error(result.error);
    return true;
  }

  async getUrlaubSummeNachJahr(mitarbeiterId, jahr) {
    const result = await this.db.get(
      `SELECT COALESCE(SUM(tage), 0) as summe FROM urlaub
       WHERE mitarbeiter_id = ? AND strftime('%Y', von_datum) = ?`,
      [mitarbeiterId, jahr.toString()]
    );
    return (result.success && result.data) ? result.data.summe : 0;
  }

  berechneAnteiligenUrlaub(mitarbeiter, jahr) {
    const eintrittsdatum = new Date(mitarbeiter.eintrittsdatum);
    const eintrittsjahr = eintrittsdatum.getFullYear();
    if (jahr !== eintrittsjahr) return mitarbeiter.urlaubstage_jahr;
    const verbleibendeMonate = 12 - (eintrittsdatum.getMonth() + 1) + 1;
    return Math.round((mitarbeiter.urlaubstage_jahr / 12) * verbleibendeMonate * 2) / 2;
  }

  /**
   * FIX: Rekursion entfernt.
   *
   * Die alte Implementierung rief sich selbst für jedes Vorjahr auf und
   * konnte bei einem korrupten eintrittsdatum (z.B. NULL oder weit in der
   * Zukunft) in eine Endlosschleife laufen – der tiefe-Guard bei 50
   * verhinderte das nur teilweise.
   *
   * Neue Implementierung: iterative Schleife vom Eintrittsjahr bis zum
   * gewünschten Jahr. Pro Durchlauf wird geprüft ob ein manueller Übertrag
   * existiert; falls ja, wird dieser als Ausgangsbasis genommen und die
   * Schleife setzt ab diesem Punkt fort. Das Ergebnis ist identisch zur
   * alten Logik, aber sicher und ohne Stack-Risiko.
   */
  async berechneUebertrag(mitarbeiterId, zielJahr) {
    // Manuellen Übertrag direkt zurückgeben wenn vorhanden
    const manuell = await this.getManuellAngepassterUebertrag(mitarbeiterId, zielJahr);
    if (manuell) return manuell.uebertrag_tage;

    const mitarbeiterResult = await this.db.get('SELECT * FROM mitarbeiter WHERE id = ?', [mitarbeiterId]);
    if (!mitarbeiterResult.success || !mitarbeiterResult.data) return 0;
    const mitarbeiter = mitarbeiterResult.data;

    // Eintrittsdatum absichern
    if (!mitarbeiter.eintrittsdatum) return 0;
    const eintrittsjahr = new Date(mitarbeiter.eintrittsdatum).getFullYear();

    // Kein Übertrag wenn Zieljahr <= Eintrittsjahr
    if (zielJahr <= eintrittsjahr) return 0;

    // Iterativ vom Eintrittsjahr bis (zielJahr - 1) aufbauen
    let uebertrag = 0;

    for (let jahr = eintrittsjahr; jahr < zielJahr; jahr++) {
      // Manueller Übertrag für dieses Jahr als Sprungpunkt?
      const manuellDiesesJahr = await this.getManuellAngepassterUebertrag(mitarbeiterId, jahr + 1);
      if (manuellDiesesJahr) {
        // Ab diesem Punkt übernehmen wir den manuellen Wert und iterieren weiter
        uebertrag = manuellDiesesJahr.uebertrag_tage;
        // Wenn das bereits das Zieljahr ist, fertig
        if (jahr + 1 === zielJahr) return uebertrag;
        continue;
      }

      const anspruch   = this.berechneAnteiligenUrlaub(mitarbeiter, jahr);
      const verfuegbar = anspruch + uebertrag;
      const genommen   = await this.getUrlaubSummeNachJahr(mitarbeiterId, jahr);
      const rest       = verfuegbar - genommen;
      uebertrag        = Math.min(Math.max(rest, 0), 30);
    }

    return uebertrag;
  }

  async getUeberstundenUebertrag(mitarbeiterId, jahr) {
    const result = await this.db.get(
      `SELECT COALESCE(SUM(stunden), 0) as summe FROM ueberstunden
       WHERE mitarbeiter_id = ? AND strftime('%Y', datum) <= ?`,
      [mitarbeiterId, (jahr - 1).toString()]
    );
    return (result.success && result.data) ? result.data.summe : 0;
  }

  async getUeberstundenGemachtImJahr(mitarbeiterId, jahr) {
    const result = await this.db.get(
      `SELECT COALESCE(SUM(stunden), 0) as summe FROM ueberstunden
       WHERE mitarbeiter_id = ? AND strftime('%Y', datum) = ? AND stunden > 0`,
      [mitarbeiterId, jahr.toString()]
    );
    return (result.success && result.data) ? result.data.summe : 0;
  }

  async getUeberstundenAbbauImJahr(mitarbeiterId, jahr) {
    const result = await this.db.get(
      `SELECT COALESCE(ABS(SUM(stunden)), 0) as summe FROM ueberstunden
       WHERE mitarbeiter_id = ? AND strftime('%Y', datum) = ? AND stunden < 0`,
      [mitarbeiterId, jahr.toString()]
    );
    return (result.success && result.data) ? result.data.summe : 0;
  }

  async getUeberstundenDetails(mitarbeiterId, jahr) {
    const [uebertrag, gemacht, abgebaut] = await Promise.all([
      this.getUeberstundenUebertrag(mitarbeiterId, jahr),
      this.getUeberstundenGemachtImJahr(mitarbeiterId, jahr),
      this.getUeberstundenAbbauImJahr(mitarbeiterId, jahr),
    ]);
    return { uebertrag, gemacht, abgebaut, saldo: uebertrag + gemacht - abgebaut };
  }

  async getVerfallenderUrlaub(mitarbeiterId, jahr) {
    const uebertrag = await this.berechneUebertrag(mitarbeiterId, jahr);
    if (uebertrag <= 0) return { uebertrag: 0, genommenBisMaerz: 0, verfaellt: 0, stichtag: `31.03.${jahr}` };
    const result = await this.db.get(
      `SELECT COALESCE(SUM(tage), 0) as summe FROM urlaub
       WHERE mitarbeiter_id = ? AND von_datum >= ? AND von_datum <= ?`,
      [mitarbeiterId, `${jahr}-01-01`, `${jahr}-03-31`]
    );
    const genommenBisMaerz = (result.success && result.data) ? result.data.summe : 0;
    const verfaellt = Math.max(uebertrag - genommenBisMaerz, 0);
    return { uebertrag, genommenBisMaerz, verfaellt, stichtag: `31.03.${jahr}` };
  }

  async getMitarbeiterStatistik(mitarbeiterId) {
    const mitarbeiterResult = await this.db.get(`
      SELECT m.*, a.name as abteilung_name, a.farbe as abteilung_farbe
      FROM mitarbeiter m LEFT JOIN abteilungen a ON m.abteilung_id = a.id
      WHERE m.id = ?
    `, [mitarbeiterId]);
    if (!mitarbeiterResult.success || !mitarbeiterResult.data) return null;
    const mitarbeiter = mitarbeiterResult.data;

    let uebertrag = await this.berechneUebertrag(mitarbeiterId, this.aktuellesJahr);

    const heute    = new Date();
    const stichtag = new Date(this.aktuellesJahr, 2, 31);

    let verfallenderUebertrag = 0;
    const verfaelltAktiv = mitarbeiter.uebertrag_verfaellt !== undefined
      ? mitarbeiter.uebertrag_verfaellt === 1
      : true;

    if (verfaelltAktiv && heute > stichtag && uebertrag > 0) {
      const verfallInfo = await this.getVerfallenderUrlaub(mitarbeiterId, this.aktuellesJahr);
      verfallenderUebertrag = verfallInfo.verfaellt;
      uebertrag = Math.max(0, uebertrag - verfallenderUebertrag);
    }

    const urlaubsanspruch = this.berechneAnteiligenUrlaub(mitarbeiter, this.aktuellesJahr);

    // Restliche Queries parallel ausführen
    const [
      urlaubRow, krankheitRow, schulungRow, ueberstundenRow,
    ] = await Promise.all([
      this.db.get(
        `SELECT COALESCE(SUM(tage), 0) as summe FROM urlaub
         WHERE mitarbeiter_id = ? AND strftime('%Y', von_datum) = ?`,
        [mitarbeiterId, this.aktuellesJahr.toString()]
      ),
      this.db.get(
        `SELECT COALESCE(SUM(tage), 0) as summe FROM krankheit
         WHERE mitarbeiter_id = ? AND strftime('%Y', von_datum) = ?`,
        [mitarbeiterId, this.aktuellesJahr.toString()]
      ),
      this.db.get(
        `SELECT COALESCE(SUM(dauer_tage), 0) as summe FROM schulung
         WHERE mitarbeiter_id = ? AND strftime('%Y', datum) = ?`,
        [mitarbeiterId, this.aktuellesJahr.toString()]
      ),
      this.db.get(
        `SELECT COALESCE(SUM(stunden), 0) as summe FROM ueberstunden
         WHERE mitarbeiter_id = ? AND strftime('%Y', datum) <= ?`,
        [mitarbeiterId, this.aktuellesJahr.toString()]
      ),
    ]);

    const uebertragVorVerfall = await this.berechneUebertrag(mitarbeiterId, this.aktuellesJahr);
    const urlaubGenommen      = (urlaubRow.success && urlaubRow.data) ? urlaubRow.data.summe : 0;

    return {
      mitarbeiter,
      urlaubsanspruch,
      uebertrag_vorjahr:  uebertrag,
      uebertrag_original: uebertragVorVerfall,
      verfallen:          verfallenderUebertrag,
      verfaellt_aktiv:    verfaelltAktiv,
      urlaub_verfuegbar:  urlaubsanspruch + uebertrag,
      urlaub_genommen:    urlaubGenommen,
      urlaub_rest:        urlaubsanspruch + uebertrag - urlaubGenommen,
      krankheitstage:  (krankheitRow.success  && krankheitRow.data)  ? krankheitRow.data.summe  : 0,
      schulungstage:   (schulungRow.success   && schulungRow.data)   ? schulungRow.data.summe   : 0,
      ueberstunden:    (ueberstundenRow.success && ueberstundenRow.data) ? ueberstundenRow.data.summe : 0,
    };
  }

  /**
   * FIX: Serieller for-Loop durch Promise.all() ersetzt.
   * Bei 20 Mitarbeitern reduziert das ~160 sequenzielle IPC-Roundtrips
   * auf eine parallele Batch-Ausführung.
   */
  async getAlleStatistiken(abteilung = null) {
    let mitarbeiter = [];
    if (abteilung && abteilung !== 'Alle') {
      const abtResult = await this.db.get('SELECT id FROM abteilungen WHERE name = ?', [abteilung]);
      if (!abtResult.success || !abtResult.data) return [];
      const maResult = await this.db.query(
        `SELECT * FROM mitarbeiter WHERE abteilung_id = ? AND status = 'AKTIV'
           AND austrittsdatum IS NULL
         ORDER BY nachname, vorname`,
        [abtResult.data.id, this.aktuellesJahr]
      );
      mitarbeiter = maResult.success ? maResult.data : [];
    } else {
      const maResult = await this.db.query(
        `SELECT * FROM mitarbeiter WHERE status = 'AKTIV'
           AND austrittsdatum IS NULL
         ORDER BY nachname, vorname`,
        [this.aktuellesJahr]
      );
      mitarbeiter = maResult.success ? maResult.data : [];
    }

    // FIX: parallel statt seriell
    const results = await Promise.all(mitarbeiter.map(ma => this.getMitarbeiterStatistik(ma.id)));
    return results.filter(Boolean);
  }

  _sanitizeForId(str) {
    return str
      .replace(/ä/gi, 'ae').replace(/ö/gi, 'oe').replace(/ü/gi, 'ue')
      .replace(/ß/gi, 'ss').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  }

  async stammdatenHinzufuegen(mitarbeiterId, daten) {
    const abtResult = await this.db.get('SELECT id FROM abteilungen WHERE name = ?', [daten.abteilung]);
    if (!abtResult.success || !abtResult.data) throw new Error(`Abteilung '${daten.abteilung}' nicht gefunden`);
    const result = await this.db.run(
      `INSERT INTO mitarbeiter
         (id, abteilung_id, vorname, nachname, email, geburtsdatum, eintrittsdatum, urlaubstage_jahr, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AKTIV')`,
      [mitarbeiterId, abtResult.data.id, daten.vorname, daten.nachname,
       daten.email || null, daten.geburtsdatum || null,
       daten.einstellungsdatum || new Date().toISOString().split('T')[0],
       daten.urlaubstage_jahr || 30]
    );
    if (!result.success) throw new Error(result.error);
    return true;
  }

  async stammdatenAktualisieren(mitarbeiterId, daten) {
    const updates = [], values = [];
    const add = (col, val) => { updates.push(`${col} = ?`); values.push(val); };

    if (daten.vorname        !== undefined) add('vorname',        daten.vorname);
    if (daten.nachname       !== undefined) add('nachname',       daten.nachname);
    if (daten.email          !== undefined) add('email',          daten.email || null);
    if (daten.geburtsdatum   !== undefined) add('geburtsdatum',   daten.geburtsdatum || null);
    if (daten.einstellungsdatum !== undefined) add('eintrittsdatum', daten.einstellungsdatum);
    if (daten.austrittsdatum !== undefined) add('austrittsdatum', daten.austrittsdatum || null);
    if (daten.urlaubstage_jahr !== undefined) add('urlaubstage_jahr', daten.urlaubstage_jahr);
    if (daten.wochenstunden  !== undefined) add('wochenstunden',  daten.wochenstunden);
    if (daten.adresse        !== undefined) add('adresse',        daten.adresse || null);
    if (daten.gehalt         !== undefined) add('gehalt',         daten.gehalt ? parseFloat(daten.gehalt) : null);

    if (daten.abteilung !== undefined) {
      const abtResult = await this.db.get('SELECT id FROM abteilungen WHERE name = ?', [daten.abteilung]);
      if (abtResult.success && abtResult.data) add('abteilung_id', abtResult.data.id);
    }

    if (updates.length === 0) return true;
    updates.push('aktualisiert_am = CURRENT_TIMESTAMP');
    values.push(mitarbeiterId);

    const result = await this.db.run(`UPDATE mitarbeiter SET ${updates.join(', ')} WHERE id = ?`, values);
    if (!result.success) throw new Error(result.error);
    return true;
  }

  async mitarbeiterDeaktivieren(mitarbeiterId) {
    const result = await this.db.run(
      `UPDATE mitarbeiter SET status = 'INAKTIV', aktualisiert_am = CURRENT_TIMESTAMP WHERE id = ?`,
      [mitarbeiterId]
    );
    if (!result.success) throw new Error(result.error);
    return true;
  }

  async pruefeUeberlappung(tabelle, mitarbeiterId, vonDatum, bisDatum) {
    const erlaubt = ['urlaub', 'krankheit'];
    if (!erlaubt.includes(tabelle)) throw new Error(`Ungültiger Tabellenname: ${tabelle}`);
    const result = await this.db.get(
      `SELECT COUNT(*) as count FROM ${tabelle}
       WHERE mitarbeiter_id = ?
         AND ((von_datum BETWEEN ? AND ?) OR (bis_datum BETWEEN ? AND ?)
              OR (von_datum <= ? AND bis_datum >= ?))`,
      [mitarbeiterId, vonDatum, bisDatum, vonDatum, bisDatum, vonDatum, bisDatum]
    );
    return result.success && result.data && result.data.count > 0;
  }

  async speichereEintrag(eintrag) {
    const { typ, mitarbeiter_id, datum, beschreibung: notiz } = eintrag;
    const wert = parseFloat(eintrag.wert);
    let result;

    const bisDatumStr = eintrag.bis_datum || (() => {
      const d = this._parseDatumLokal(datum);
      if (wert > 1) d.setDate(d.getDate() + Math.floor(wert) - 1);
      return this._formatDatumLokal(d);
    })();

    if (typ === 'urlaub') {
      if (await this.pruefeUeberlappung('urlaub', mitarbeiter_id, datum, bisDatumStr))
        throw new Error('Im gewählten Zeitraum existiert bereits ein Urlaubseintrag.');
      result = await this.db.run(
        'INSERT INTO urlaub (mitarbeiter_id, von_datum, bis_datum, tage, notiz) VALUES (?, ?, ?, ?, ?)',
        [mitarbeiter_id, datum, bisDatumStr, wert, notiz || null]
      );
    } else if (typ === 'krank') {
      if (await this.pruefeUeberlappung('krankheit', mitarbeiter_id, datum, bisDatumStr))
        throw new Error('Im gewählten Zeitraum existiert bereits ein Krankheitseintrag.');
      result = await this.db.run(
        'INSERT INTO krankheit (mitarbeiter_id, von_datum, bis_datum, tage, notiz) VALUES (?, ?, ?, ?, ?)',
        [mitarbeiter_id, datum, bisDatumStr, wert, notiz || null]
      );
    } else if (typ === 'schulung') {
      result = await this.db.run(
        'INSERT INTO schulung (mitarbeiter_id, datum, dauer_tage, titel, notiz) VALUES (?, ?, ?, ?, ?)',
        [mitarbeiter_id, datum, wert, eintrag.titel || null, notiz || null]
      );
    } else if (typ === 'ueberstunden') {
      result = await this.db.run(
        'INSERT INTO ueberstunden (mitarbeiter_id, datum, stunden, notiz) VALUES (?, ?, ?, ?)',
        [mitarbeiter_id, datum, wert, notiz || null]
      );
    } else {
      throw new Error(`Unbekannter Typ: ${typ}`);
    }

    if (!result.success) throw new Error(result.error);
    return true;
  }

  async getArbeitszeitmodell(mitarbeiterId) {
    const result = await this.db.query(
      'SELECT wochentag, arbeitszeit FROM arbeitszeitmodell WHERE mitarbeiter_id = ? ORDER BY wochentag',
      [mitarbeiterId]
    );
    return result.success ? result.data : [];
  }

  async speichereArbeitszeitmodell(mitarbeiterId, modell) {
    await this.db.run('DELETE FROM arbeitszeitmodell WHERE mitarbeiter_id = ?', [mitarbeiterId]);
    for (const tag of modell) {
      await this.db.run(
        'INSERT INTO arbeitszeitmodell (mitarbeiter_id, wochentag, arbeitszeit) VALUES (?, ?, ?)',
        [mitarbeiterId, tag.wochentag, tag.arbeitszeit]
      );
    }
    return true;
  }

  async getVerfuegbareJahre() {
    const result = await this.db.query(`
      SELECT DISTINCT CAST(strftime('%Y', von_datum) AS INTEGER) as jahr FROM urlaub
      UNION SELECT DISTINCT CAST(strftime('%Y', von_datum) AS INTEGER) FROM krankheit
      UNION SELECT DISTINCT CAST(strftime('%Y', datum)    AS INTEGER) FROM schulung
      UNION SELECT DISTINCT CAST(strftime('%Y', datum)    AS INTEGER) FROM ueberstunden
      ORDER BY jahr DESC
    `);
    const jahre = new Set((result.success ? result.data : []).map(r => r.jahr).filter(Boolean));
    const jetzt = new Date().getFullYear();
    jahre.add(jetzt);
    jahre.add(jetzt + 1);
    return Array.from(jahre).sort((a, b) => b - a);
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = TeamFlowDataManager;