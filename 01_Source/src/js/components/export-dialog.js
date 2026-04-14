/**
 * Export-Dialog
 * Einheitlicher Export für Excel und PDF
 * mit Zeitraum-, Typ- und Mitarbeiter-Filter
 */

async function zeigeExportDialog() {
  const heute = new Date();
  const ersterDesMonats = new Date(heute.getFullYear(), heute.getMonth(), 1);
  const letzterDesMonats = new Date(heute.getFullYear(), heute.getMonth() + 1, 0);

  const formatDate = (date) => {
    const jahr = date.getFullYear();
    const monat = String(date.getMonth() + 1).padStart(2, '0');
    const tag = String(date.getDate()).padStart(2, '0');
    return `${jahr}-${monat}-${tag}`;
  };

  // Monate für Dropdown
  const monatNamen = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  const monatOptionen = monatNamen.map((name, index) => {
    const selected = index === heute.getMonth() ? 'selected' : '';
    return `<option value="${index}" ${selected}>${name}</option>`;
  }).join('');

  const jahrOptionen = [-1, 0, 1].map(offset => {
    const jahr = heute.getFullYear() + offset;
    const selected = offset === 0 ? 'selected' : '';
    return `<option value="${jahr}" ${selected}>${jahr}</option>`;
  }).join('');

  const modalHtml = `
    <div class="modal fade" id="exportDialog" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title">
              <i class="bi bi-box-arrow-up"></i> Export
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">

            <!-- FORMAT -->
            <div class="mb-4">
              <label class="form-label fw-bold">
                <i class="bi bi-file-earmark"></i> Format
              </label>
              <div class="d-flex gap-3">
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" name="exportFormat" 
                         id="formatExcel" value="excel" checked>
                  <label class="form-check-label" for="formatExcel">
                    <i class="bi bi-file-earmark-excel text-success"></i> Excel (.xlsx)
                  </label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" name="exportFormat" 
                         id="formatPdf" value="pdf">
                  <label class="form-check-label" for="formatPdf">
                    <i class="bi bi-file-earmark-pdf text-danger"></i> PDF
                  </label>
                </div>
              </div>
            </div>

            <hr>

            <!-- ZEITRAUM -->
            <div class="mb-4">
              <label class="form-label fw-bold">
                <i class="bi bi-calendar-range"></i> Zeitraum
              </label>

              <!-- Zeitraum-Modus -->
              <div class="d-flex gap-3 mb-3">
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" name="zeitraumModus" 
                         id="modusMonat" value="monat" checked>
                  <label class="form-check-label" for="modusMonat">Monat</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" name="zeitraumModus" 
                         id="modusFreieBisDatum" value="frei">
                  <label class="form-check-label" for="modusFreieBisDatum">Freie Auswahl</label>
                </div>
              </div>

              <!-- Monat-Auswahl -->
              <div id="zeitraumMonat">
                <div class="row g-2">
                  <div class="col-md-6">
                    <select class="form-select" id="exportMonat">
                      ${monatOptionen}
                    </select>
                  </div>
                  <div class="col-md-6">
                    <select class="form-select" id="exportJahr">
                      ${jahrOptionen}
                    </select>
                  </div>
                </div>
              </div>

              <!-- Freie Auswahl -->
              <div id="zeitraumFrei" class="d-none">
                <div class="row g-2">
                  <div class="col-md-6">
                    <label class="form-label">Von</label>
                    <input type="date" class="form-control" id="exportVon" 
                           value="${formatDate(ersterDesMonats)}">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Bis</label>
                    <input type="date" class="form-control" id="exportBis" 
                           value="${formatDate(letzterDesMonats)}">
                  </div>
                </div>
              </div>
            </div>

            <hr>

            <!-- ABWESENHEITSTYPEN -->
            <div class="mb-4">
              <label class="form-label fw-bold">
                <i class="bi bi-funnel"></i> Abwesenheitstypen
              </label>
              <div class="d-flex gap-3 flex-wrap">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="filterUrlaub" checked>
                  <label class="form-check-label text-success" for="filterUrlaub">
                    <i class="bi bi-calendar-check"></i> Urlaub
                  </label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="filterKrankheit" checked>
                  <label class="form-check-label text-danger" for="filterKrankheit">
                    <i class="bi bi-bandaid"></i> Krankheit
                  </label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="filterSchulung" checked>
                  <label class="form-check-label text-info" for="filterSchulung">
                    <i class="bi bi-book"></i> Schulung
                  </label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="filterUeberstunden" checked>
                  <label class="form-check-label text-warning" for="filterUeberstunden">
                    <i class="bi bi-clock"></i> Überstunden-Abbau
                  </label>
                </div>
              </div>
            </div>

            <hr>

            <!-- MITARBEITER-FILTER -->
            <div class="mb-3">
              <label class="form-label fw-bold">
                <i class="bi bi-people"></i> Mitarbeiter
              </label>
              <div class="d-flex gap-3 mb-2">
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" name="mitarbeiterFilter" 
                         id="maAlle" value="alle">
                  <label class="form-check-label" for="maAlle">Alle</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" name="mitarbeiterFilter" 
                         id="maMitEintraegen" value="mitEintraegen" checked>
                  <label class="form-check-label" for="maMitEintraegen">
                    Nur mit Einträgen im Zeitraum
                  </label>
                </div>
              </div>
            </div>

          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
            <button type="button" class="btn btn-primary" id="btnExportStarten">
              <i class="bi bi-box-arrow-up"></i> Export starten
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Alte Modals entfernen
  document.querySelectorAll('.modal').forEach(m => {
    const existing = bootstrap.Modal.getInstance(m);
    if (existing) existing.dispose();
    m.remove();
  });

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modalElement = document.querySelector('#exportDialog');
  const modal = new bootstrap.Modal(modalElement);

  // Zeitraum-Modus umschalten
  modalElement.querySelectorAll('[name="zeitraumModus"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const modus = modalElement.querySelector('[name="zeitraumModus"]:checked').value;
      modalElement.querySelector('#zeitraumMonat').classList.toggle('d-none', modus !== 'monat');
      modalElement.querySelector('#zeitraumFrei').classList.toggle('d-none', modus !== 'frei');
    });
  });

  // Export starten
  modalElement.querySelector('#btnExportStarten').addEventListener('click', async () => {
    const btn = modalElement.querySelector('#btnExportStarten');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Wird erstellt...';

    try {
      await _starteExport(modalElement);
      modal.hide();
    } catch (error) {
      showNotification('Fehler', error.message, 'danger');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-box-arrow-up"></i> Export starten';
    }
  });

  modal.show();
  modalElement.addEventListener('hidden.bs.modal', () => {
    modal.dispose();
    modalElement.remove();
  });
}

/**
 * Liest Formular aus, sammelt Daten und startet Export
 */
async function _starteExport(modalElement) {
  // Format
  const format = modalElement.querySelector('[name="exportFormat"]:checked').value;

  // Zeitraum ermitteln
  const modus = modalElement.querySelector('[name="zeitraumModus"]:checked').value;
  let vonDatum, bisDatum;

  if (modus === 'monat') {
    const monat = parseInt(modalElement.querySelector('#exportMonat').value);
    const jahr = parseInt(modalElement.querySelector('#exportJahr').value);
    const erster = new Date(jahr, monat, 1);
    const letzter = new Date(jahr, monat + 1, 0);
    vonDatum = _formatExportDatum(erster);
    bisDatum = _formatExportDatum(letzter);
  } else {
    vonDatum = modalElement.querySelector('#exportVon').value;
    bisDatum = modalElement.querySelector('#exportBis').value;
    if (!vonDatum || !bisDatum) throw new Error('Bitte Von- und Bis-Datum angeben');
    if (bisDatum < vonDatum) throw new Error('Bis-Datum muss nach Von-Datum liegen');
  }

  // Typen-Filter
  const typen = {
    urlaub:       modalElement.querySelector('#filterUrlaub').checked,
    krankheit:    modalElement.querySelector('#filterKrankheit').checked,
    schulung:     modalElement.querySelector('#filterSchulung').checked,
    ueberstunden: modalElement.querySelector('#filterUeberstunden').checked,
  };

  if (!Object.values(typen).some(v => v)) {
    throw new Error('Bitte mindestens einen Abwesenheitstyp auswählen');
  }

  // Mitarbeiter-Filter
  const nurMitEintraegen = modalElement.querySelector('[name="mitarbeiterFilter"]:checked').value === 'mitEintraegen';

  // Daten sammeln
  const exportData = await _sammleExportDaten(vonDatum, bisDatum, typen, nurMitEintraegen);

  if (exportData.mitarbeiter.length === 0) {
    throw new Error('Keine Daten für den gewählten Zeitraum und Filter gefunden');
  }

  // Export starten
  showNotification('Export', 'Wird erstellt...', 'info');

  let result;
  if (format === 'excel') {
    result = await window.electronAPI.exportExcel({ exportData, vonDatum, bisDatum });
  } else {
    result = await window.electronAPI.exportPdf({ exportData, vonDatum, bisDatum });
  }

  if (result.success) {
    showNotification('Erfolg', `Export erstellt: ${result.path}`, 'success');
  } else {
    throw new Error(result.error);
  }
}

/**
 * Sammelt alle Exportdaten aus der Datenbank
 */
async function _sammleExportDaten(vonDatum, bisDatum, typen, nurMitEintraegen) {
  const alleMitarbeiter = await dataManager.getAlleMitarbeiter();
  const ergebnis = [];

  for (const ma of alleMitarbeiter) {
    const eintraege = [];

    // Urlaub
    if (typen.urlaub) {
      const r = await database.query(`
        SELECT 'urlaub' as typ, von_datum, bis_datum, tage as wert, notiz, NULL as titel
        FROM urlaub
        WHERE mitarbeiter_id = ?
          AND ((von_datum BETWEEN ? AND ?) OR (bis_datum BETWEEN ? AND ?)
               OR (von_datum <= ? AND bis_datum >= ?))
        ORDER BY von_datum
      `, [ma.id, vonDatum, bisDatum, vonDatum, bisDatum, vonDatum, bisDatum]);
      if (r.success) eintraege.push(...r.data);
    }

    // Krankheit
    if (typen.krankheit) {
      const r = await database.query(`
        SELECT 'krankheit' as typ, von_datum, bis_datum, tage as wert, notiz, NULL as titel
        FROM krankheit
        WHERE mitarbeiter_id = ?
          AND ((von_datum BETWEEN ? AND ?) OR (bis_datum BETWEEN ? AND ?)
               OR (von_datum <= ? AND bis_datum >= ?))
        ORDER BY von_datum
      `, [ma.id, vonDatum, bisDatum, vonDatum, bisDatum, vonDatum, bisDatum]);
      if (r.success) eintraege.push(...r.data);
    }

    // Schulung
    if (typen.schulung) {
      const r = await database.query(`
        SELECT 'schulung' as typ, datum as von_datum, datum as bis_datum, 
               dauer_tage as wert, notiz, titel
        FROM schulung
        WHERE mitarbeiter_id = ? AND datum BETWEEN ? AND ?
        ORDER BY datum
      `, [ma.id, vonDatum, bisDatum]);
      if (r.success) eintraege.push(...r.data);
    }

    // Überstunden-Abbau (nur negative Werte)
    if (typen.ueberstunden) {
      const r = await database.query(`
        SELECT 'ueberstunden' as typ, datum as von_datum, datum as bis_datum,
               ABS(stunden) as wert, notiz, NULL as titel
        FROM ueberstunden
        WHERE mitarbeiter_id = ? AND datum BETWEEN ? AND ? AND stunden < 0
        ORDER BY datum
      `, [ma.id, vonDatum, bisDatum]);
      if (r.success) eintraege.push(...r.data);
    }

    // Mitarbeiter überspringen wenn keine Einträge und Filter aktiv
    if (nurMitEintraegen && eintraege.length === 0) continue;

    // Zusammenfassung berechnen
    const zusammenfassung = {
      urlaub_tage:       eintraege.filter(e => e.typ === 'urlaub').reduce((s, e) => s + e.wert, 0),
      krankheit_tage:    eintraege.filter(e => e.typ === 'krankheit').reduce((s, e) => s + e.wert, 0),
      schulung_tage:     eintraege.filter(e => e.typ === 'schulung').reduce((s, e) => s + e.wert, 0),
      ueberstunden_abbau: eintraege.filter(e => e.typ === 'ueberstunden').reduce((s, e) => s + e.wert, 0),
    };

    ergebnis.push({
      mitarbeiter: {
        id: ma.id,
        name: `${ma.vorname} ${ma.nachname}`,
        abteilung: ma.abteilung_name,
      },
      zusammenfassung,
      eintraege,
    });
  }

  // Sortiert nach Abteilung, dann Name
  ergebnis.sort((a, b) => {
    const abtVergl = (a.mitarbeiter.abteilung || '').localeCompare(b.mitarbeiter.abteilung || '');
    if (abtVergl !== 0) return abtVergl;
    return a.mitarbeiter.name.localeCompare(b.mitarbeiter.name);
  });

  return { mitarbeiter: ergebnis, vonDatum, bisDatum };
}

function _formatExportDatum(date) {
  const jahr = date.getFullYear();
  const monat = String(date.getMonth() + 1).padStart(2, '0');
  const tag = String(date.getDate()).padStart(2, '0');
  return `${jahr}-${monat}-${tag}`;
}