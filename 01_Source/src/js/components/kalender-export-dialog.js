/**
 * Kalender-Export-Dialog
 * Vereinfachter Export aus der Kalenderansicht heraus:
 * Nur Format + Zeitraum (Monat oder freie Auswahl), keine Typ-/Mitarbeiter-Filter.
 *
 * Ergebnis: Tagesweise Übersicht aller Abwesenheiten + Liste der Tage,
 * an denen alle Mitarbeiter anwesend waren (ohne Wochenenden/Feiertage).
 */

function _getGlobalsKalenderExport() {
  if (typeof dataManager === 'undefined' || !dataManager) {
    throw new Error('dataManager nicht initialisiert – bitte App neu starten');
  }
  if (typeof database === 'undefined' || !database) {
    throw new Error('database nicht initialisiert – bitte App neu starten');
  }
  return { dataManager, database };
}

function _formatDatumKalenderExport(date) {
  const j = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const t = String(date.getDate()).padStart(2, '0');
  return `${j}-${m}-${t}`;
}

async function zeigeKalenderExportDialog() {
  const heute = new Date();
  const ersterDesMonats = new Date(heute.getFullYear(), heute.getMonth(), 1);
  const letzterDesMonats = new Date(heute.getFullYear(), heute.getMonth() + 1, 0);

  const monatNamen = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const monatOptionen = monatNamen.map((name, i) =>
    `<option value="${i}" ${i === heute.getMonth() ? 'selected' : ''}>${name}</option>`
  ).join('');
  const jahrOptionen = [-1, 0, 1].map(offset => {
    const j = heute.getFullYear() + offset;
    return `<option value="${j}" ${offset === 0 ? 'selected' : ''}>${j}</option>`;
  }).join('');

  const modalHtml = `
    <div class="modal fade" id="kalenderExportDialog" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title"><i class="bi bi-calendar3"></i> Kalender-Export</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">

            <div class="mb-4">
              <label class="form-label fw-bold"><i class="bi bi-file-earmark"></i> Format</label>
              <div class="d-flex gap-3">
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" name="kalExportFormat" id="kalFormatExcel" value="excel" checked>
                  <label class="form-check-label" for="kalFormatExcel"><i class="bi bi-file-earmark-excel text-success"></i> Excel (.xlsx)</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" name="kalExportFormat" id="kalFormatPdf" value="pdf">
                  <label class="form-check-label" for="kalFormatPdf"><i class="bi bi-file-earmark-pdf text-danger"></i> PDF</label>
                </div>
              </div>
            </div>

            <hr>

            <div class="mb-2">
              <label class="form-label fw-bold"><i class="bi bi-calendar-range"></i> Zeitraum</label>
              <div class="d-flex gap-3 mb-3">
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" name="kalZeitraumModus" id="kalModusMonat" value="monat" checked>
                  <label class="form-check-label" for="kalModusMonat">Monat</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" name="kalZeitraumModus" id="kalModusFrei" value="frei">
                  <label class="form-check-label" for="kalModusFrei">Freie Auswahl</label>
                </div>
              </div>
              <div id="kalZeitraumMonat">
                <div class="row g-2">
                  <div class="col-md-6"><select class="form-select" id="kalExportMonat">${monatOptionen}</select></div>
                  <div class="col-md-6"><select class="form-select" id="kalExportJahr">${jahrOptionen}</select></div>
                </div>
              </div>
              <div id="kalZeitraumFrei" class="d-none">
                <div class="row g-2">
                  <div class="col-md-6">
                    <label class="form-label">Von</label>
                    <input type="date" class="form-control" id="kalExportVon" value="${_formatDatumKalenderExport(ersterDesMonats)}">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Bis</label>
                    <input type="date" class="form-control" id="kalExportBis" value="${_formatDatumKalenderExport(letzterDesMonats)}">
                  </div>
                </div>
              </div>
            </div>

          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
            <button type="button" class="btn btn-primary" id="btnKalExportStarten">
              <i class="bi bi-box-arrow-up"></i> Export starten
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll('.modal:not(.show)').forEach(m => {
    const existing = bootstrap.Modal.getInstance(m);
    if (existing) existing.dispose();
    m.remove();
  });

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modalElement = document.querySelector('#kalenderExportDialog');
  const modal = new bootstrap.Modal(modalElement);

  modalElement.querySelectorAll('[name="kalZeitraumModus"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const modus = modalElement.querySelector('[name="kalZeitraumModus"]:checked').value;
      modalElement.querySelector('#kalZeitraumMonat').classList.toggle('d-none', modus !== 'monat');
      modalElement.querySelector('#kalZeitraumFrei').classList.toggle('d-none', modus !== 'frei');
    });
  });

  modalElement.querySelector('#btnKalExportStarten').addEventListener('click', async () => {
    const btn = modalElement.querySelector('#btnKalExportStarten');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Wird erstellt...';
    try {
      await _starteKalenderExport(modalElement);
      modal.hide();
    } catch (error) {
      showNotification('Fehler', error.message, 'danger');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-box-arrow-up"></i> Export starten';
    }
  });

  modal.show();
  modalElement.addEventListener('hidden.bs.modal', () => { modal.dispose(); modalElement.remove(); });
}

async function _starteKalenderExport(modalElement) {
  const format = modalElement.querySelector('[name="kalExportFormat"]:checked').value;
  const modus  = modalElement.querySelector('[name="kalZeitraumModus"]:checked').value;

  let vonDatum, bisDatum;
  if (modus === 'monat') {
    const monat = parseInt(modalElement.querySelector('#kalExportMonat').value);
    const jahr  = parseInt(modalElement.querySelector('#kalExportJahr').value);
    vonDatum = _formatDatumKalenderExport(new Date(jahr, monat, 1));
    bisDatum = _formatDatumKalenderExport(new Date(jahr, monat + 1, 0));
  } else {
    vonDatum = modalElement.querySelector('#kalExportVon').value;
    bisDatum = modalElement.querySelector('#kalExportBis').value;
    if (!vonDatum || !bisDatum) throw new Error('Bitte Von- und Bis-Datum angeben');
    if (bisDatum < vonDatum) throw new Error('Bis-Datum muss nach Von-Datum liegen');
  }

  showNotification('Export', 'Wird erstellt...', 'info');

  const exportData = await _sammleKalenderExportDaten(vonDatum, bisDatum);
  const payload = { exportData, vonDatum, bisDatum };

  const result = format === 'excel'
    ? await window.electronAPI.exportKalenderExcel(payload)
    : await window.electronAPI.exportKalenderPdf(payload);

  if (result.success) {
    showNotification('Erfolg', `Export erstellt: ${result.path}`, 'success');
  } else {
    throw new Error(result.error);
  }
}

/**
 * Sammelt alle Daten für den Kalender-Export:
 * - Jeden Tag im Zeitraum (Datum, Wochentag, Wochenende/Feiertag, Einträge)
 * - Liste der Tage, an denen ALLE Mitarbeiter anwesend waren
 *   (Werktag, kein Feiertag, kein Mitarbeiter mit Eintrag an diesem Tag)
 */
async function _sammleKalenderExportDaten(vonDatum, bisDatum) {
  const { dataManager: dm, database: db } = _getGlobalsKalenderExport();

  const alleMitarbeiter = await dm.getAlleMitarbeiter();

  // Feiertage im Zeitraum
  const feiertageResult = await db.query(
    `SELECT datum, name FROM feiertage WHERE datum BETWEEN ? AND ?`,
    [vonDatum, bisDatum]
  );
  const feiertageMap = new Map();
  if (feiertageResult.success && feiertageResult.data) {
    feiertageResult.data.forEach(f => feiertageMap.set(f.datum, f.name));
  }

  // Pro-Tag Einträge sammeln
  const eintraegeProTag = new Map(); // 'YYYY-MM-DD' -> [ { mitarbeiter, abteilung, typ, wert, einheit, notiz }, ... ]

  const eintragHinzufuegen = (mitarbeiterName, abteilung, typ, vonE, bisE, wert, einheit, notiz) => {
    const start = vonE < vonDatum ? vonDatum : vonE;
    const ende  = bisE > bisDatum ? bisDatum : bisE;
    if (!start || !ende || ende < start) return;

    const cursor = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${ende}T00:00:00`);
    while (cursor <= endDate) {
      const datumStr = _formatDatumKalenderExport(cursor);
      if (!eintraegeProTag.has(datumStr)) eintraegeProTag.set(datumStr, []);
      eintraegeProTag.get(datumStr).push({
        mitarbeiter: mitarbeiterName,
        abteilung,
        typ,
        wert,
        einheit,
        notiz: notiz || '',
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  };

  await Promise.all(alleMitarbeiter.map(async (ma) => {
    const name = `${ma.vorname} ${ma.nachname}`;
    const abteilung = ma.abteilung_name || '';
    const zp = [ma.id, vonDatum, bisDatum, vonDatum, bisDatum, vonDatum, bisDatum];

    const urlaubResult = await db.query(
      `SELECT von_datum, bis_datum, tage, notiz FROM urlaub WHERE mitarbeiter_id = ? AND ((von_datum BETWEEN ? AND ?) OR (bis_datum BETWEEN ? AND ?) OR (von_datum <= ? AND bis_datum >= ?)) ORDER BY von_datum`,
      zp
    );
    if (urlaubResult.success) {
      urlaubResult.data.forEach(u => eintragHinzufuegen(name, abteilung, 'urlaub', u.von_datum, u.bis_datum, u.tage, 'T', u.notiz));
    }

    const krankheitResult = await db.query(
      `SELECT von_datum, bis_datum, tage, notiz FROM krankheit WHERE mitarbeiter_id = ? AND ((von_datum BETWEEN ? AND ?) OR (bis_datum BETWEEN ? AND ?) OR (von_datum <= ? AND bis_datum >= ?)) ORDER BY von_datum`,
      zp
    );
    if (krankheitResult.success) {
      krankheitResult.data.forEach(k => eintragHinzufuegen(name, abteilung, 'krankheit', k.von_datum, k.bis_datum, k.tage, 'T', k.notiz));
    }

    const schulungResult = await db.query(
      `SELECT datum, dauer_tage, titel, notiz FROM schulung WHERE mitarbeiter_id = ? AND datum BETWEEN ? AND ? ORDER BY datum`,
      [ma.id, vonDatum, bisDatum]
    );
    if (schulungResult.success) {
      schulungResult.data.forEach(s => {
        const bisS = new Date(`${s.datum}T00:00:00`);
        bisS.setDate(bisS.getDate() + Math.floor(s.dauer_tage) - 1);
        eintragHinzufuegen(name, abteilung, 'schulung', s.datum, _formatDatumKalenderExport(bisS), s.dauer_tage, 'T', s.titel || s.notiz);
      });
    }

    const ueResult = await db.query(
      `SELECT datum, ABS(stunden) as stunden FROM ueberstunden WHERE mitarbeiter_id = ? AND datum BETWEEN ? AND ? AND stunden < 0 ORDER BY datum`,
      [ma.id, vonDatum, bisDatum]
    );
    if (ueResult.success) {
      ueResult.data.forEach(u => eintragHinzufuegen(name, abteilung, 'ueberstunden', u.datum, u.datum, u.stunden, 'h', ''));
    }
  }));

  // Tage im Zeitraum durchgehen
  const wochentageNamen = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  const tage = [];
  const alleAnwesendTage = [];

  const cursor = new Date(`${vonDatum}T00:00:00`);
  const ende = new Date(`${bisDatum}T00:00:00`);

  while (cursor <= ende) {
    const datumStr = _formatDatumKalenderExport(cursor);
    const wtIdx = cursor.getDay();
    const istWochenende = wtIdx === 0 || wtIdx === 6;
    const istFeiertag = feiertageMap.has(datumStr);
    const feiertagName = feiertageMap.get(datumStr) || null;
    const eintraege = eintraegeProTag.get(datumStr) || [];
    const alleAnwesend = !istWochenende && !istFeiertag && eintraege.length === 0;

    const tagObjekt = {
      datum: datumStr,
      wochentagName: wochentageNamen[wtIdx],
      istWochenende,
      istFeiertag,
      feiertagName,
      alleAnwesend,
      eintraege,
    };
    tage.push(tagObjekt);

    if (alleAnwesend) {
      alleAnwesendTage.push({ datum: datumStr, wochentagName: wochentageNamen[wtIdx] });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    vonDatum,
    bisDatum,
    tage,
    alleAnwesendTage,
    mitarbeiterAnzahl: alleMitarbeiter.length,
  };
}