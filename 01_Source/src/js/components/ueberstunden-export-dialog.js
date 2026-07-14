/**
 * Überstunden-Export-Dialog
 * Eigenständiger Export NUR für geleistete Überstunden (Stunden > 0).
 * Zeigt: wer wann wie viele Überstunden gemacht hat, inkl. Notiz,
 * plus Gesamtsumme je Mitarbeiter und insgesamt.
 */

function _getGlobalsUeberstundenExport() {
  if (typeof dataManager === 'undefined' || !dataManager) {
    throw new Error('dataManager nicht initialisiert – bitte App neu starten');
  }
  if (typeof database === 'undefined' || !database) {
    throw new Error('database nicht initialisiert – bitte App neu starten');
  }
  return { dataManager, database };
}

function _formatDatumUeberstundenExport(date) {
  const j = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const t = String(date.getDate()).padStart(2, '0');
  return `${j}-${m}-${t}`;
}

async function zeigeUeberstundenExportDialog() {
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
    <div class="modal fade" id="ueberstundenExportDialog" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title"><i class="bi bi-clock-history"></i> Überstunden-Export</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">

            <div class="mb-4">
              <label class="form-label fw-bold"><i class="bi bi-file-earmark"></i> Format</label>
              <div class="d-flex gap-3">
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" name="ueExportFormat" id="ueFormatExcel" value="excel" checked>
                  <label class="form-check-label" for="ueFormatExcel"><i class="bi bi-file-earmark-excel text-success"></i> Excel (.xlsx)</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" name="ueExportFormat" id="ueFormatPdf" value="pdf">
                  <label class="form-check-label" for="ueFormatPdf"><i class="bi bi-file-earmark-pdf text-danger"></i> PDF</label>
                </div>
              </div>
            </div>

            <hr>

            <div class="mb-2">
              <label class="form-label fw-bold"><i class="bi bi-calendar-range"></i> Zeitraum</label>
              <div class="d-flex gap-3 mb-3">
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" name="ueZeitraumModus" id="ueModusMonat" value="monat" checked>
                  <label class="form-check-label" for="ueModusMonat">Monat</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" name="ueZeitraumModus" id="ueModusFrei" value="frei">
                  <label class="form-check-label" for="ueModusFrei">Freie Auswahl</label>
                </div>
              </div>
              <div id="ueZeitraumMonat">
                <div class="row g-2">
                  <div class="col-md-6"><select class="form-select" id="ueExportMonat">${monatOptionen}</select></div>
                  <div class="col-md-6"><select class="form-select" id="ueExportJahr">${jahrOptionen}</select></div>
                </div>
              </div>
              <div id="ueZeitraumFrei" class="d-none">
                <div class="row g-2">
                  <div class="col-md-6">
                    <label class="form-label">Von</label>
                    <input type="date" class="form-control" id="ueExportVon" value="${_formatDatumUeberstundenExport(ersterDesMonats)}">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Bis</label>
                    <input type="date" class="form-control" id="ueExportBis" value="${_formatDatumUeberstundenExport(letzterDesMonats)}">
                  </div>
                </div>
              </div>
            </div>

          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
            <button type="button" class="btn btn-primary" id="btnUeExportStarten">
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
  const modalElement = document.querySelector('#ueberstundenExportDialog');
  const modal = new bootstrap.Modal(modalElement);

  modalElement.querySelectorAll('[name="ueZeitraumModus"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const modus = modalElement.querySelector('[name="ueZeitraumModus"]:checked').value;
      modalElement.querySelector('#ueZeitraumMonat').classList.toggle('d-none', modus !== 'monat');
      modalElement.querySelector('#ueZeitraumFrei').classList.toggle('d-none', modus !== 'frei');
    });
  });

  modalElement.querySelector('#btnUeExportStarten').addEventListener('click', async () => {
    const btn = modalElement.querySelector('#btnUeExportStarten');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Wird erstellt...';
    try {
      await _starteUeberstundenExport(modalElement);
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

async function _starteUeberstundenExport(modalElement) {
  const format = modalElement.querySelector('[name="ueExportFormat"]:checked').value;
  const modus  = modalElement.querySelector('[name="ueZeitraumModus"]:checked').value;

  let vonDatum, bisDatum;
  if (modus === 'monat') {
    const monat = parseInt(modalElement.querySelector('#ueExportMonat').value);
    const jahr  = parseInt(modalElement.querySelector('#ueExportJahr').value);
    vonDatum = _formatDatumUeberstundenExport(new Date(jahr, monat, 1));
    bisDatum = _formatDatumUeberstundenExport(new Date(jahr, monat + 1, 0));
  } else {
    vonDatum = modalElement.querySelector('#ueExportVon').value;
    bisDatum = modalElement.querySelector('#ueExportBis').value;
    if (!vonDatum || !bisDatum) throw new Error('Bitte Von- und Bis-Datum angeben');
    if (bisDatum < vonDatum) throw new Error('Bis-Datum muss nach Von-Datum liegen');
  }

  showNotification('Export', 'Wird erstellt...', 'info');

  const exportData = await _sammleUeberstundenExportDaten(vonDatum, bisDatum);

  if (exportData.mitarbeiter.length === 0) {
    throw new Error('Keine geleisteten Überstunden im gewählten Zeitraum gefunden');
  }

  const payload = { exportData, vonDatum, bisDatum };

  const result = format === 'excel'
    ? await window.electronAPI.exportUeberstundenExcel(payload)
    : await window.electronAPI.exportUeberstundenPdf(payload);

  if (result.success) {
    showNotification('Erfolg', `Export erstellt: ${result.path}`, 'success');
  } else {
    throw new Error(result.error);
  }
}

/**
 * Sammelt alle geleisteten Überstunden (stunden > 0) im Zeitraum,
 * gruppiert je Mitarbeiter mit Einzeleinträgen (Datum, Stunden, Notiz) + Summe.
 */
async function _sammleUeberstundenExportDaten(vonDatum, bisDatum) {
  const { dataManager: dm, database: db } = _getGlobalsUeberstundenExport();

  const alleMitarbeiter = await dm.getAlleMitarbeiter();
  const ergebnis = [];

  await Promise.all(alleMitarbeiter.map(async (ma) => {
    const result = await db.query(
      `SELECT datum, stunden, notiz FROM ueberstunden WHERE mitarbeiter_id = ? AND datum BETWEEN ? AND ? AND stunden > 0 ORDER BY datum`,
      [ma.id, vonDatum, bisDatum]
    );
    const eintraege = (result.success && result.data) ? result.data : [];
    if (eintraege.length === 0) return;

    const gesamtStunden = eintraege.reduce((s, e) => s + e.stunden, 0);

    ergebnis.push({
      mitarbeiter: { id: ma.id, name: `${ma.vorname} ${ma.nachname}`, abteilung: ma.abteilung_name },
      eintraege,
      gesamtStunden,
    });
  }));

  ergebnis.sort((a, b) => {
    const abt = (a.mitarbeiter.abteilung || '').localeCompare(b.mitarbeiter.abteilung || '');
    return abt !== 0 ? abt : a.mitarbeiter.name.localeCompare(b.mitarbeiter.name);
  });

  const gesamtStundenAlle = ergebnis.reduce((s, e) => s + e.gesamtStunden, 0);

  return { vonDatum, bisDatum, mitarbeiter: ergebnis, gesamtStundenAlle };
}
