/**
 * Detail-Dialog
 * Zeigt alle Einträge eines Mitarbeiters für ein Jahr an
 * Ermöglicht das Bearbeiten und Löschen von Einträgen
 *
 * UPDATE:
 * - Tab 1: Stammdaten (Persönliche Daten, Arbeitsbeziehung, Arbeitszeit, Buttons)
 * - Tab 2: Urlaubsplaner (mit Jahresauswahl oben)
 * - Header-Farbe = Abteilungsfarbe
 * - PDF-Export Buttons schön gestylt
 *
 * UPDATE 2:
 * - Jahresübersicht-Export öffnet Dialog (Format, Jahr, Typen)
 * - Formate: PDF und Excel (.xlsx)
 * - Einträge im Export nach Typ sortiert: Urlaub → Krankheit → Schulung → Überstunden
 *
 * FIX:
 * - zeigeDetails() lädt alle Daten parallel via Promise.all() statt seriell
 * - _bearbeiteUrlaub/Krankheit/Schulung/Ueberstunden nutzen gemeinsamen _zeigeBearbeitenModal()
 */

class DetailDialog extends DialogBase {
  constructor(dataManager) {
    super(dataManager);
    this.filterTyp = 'alle';
    this.sortierung = 'desc';
    this.herkunft = 'urlaubsplaner';
  }

  /**
   * Exportiert Mitarbeiter-Stammdaten als PDF (Stammdaten-Tab)
   */
  async _exportMitarbeiterPDF(mitarbeiterId, jahr) {
    try {
      const mitarbeiter = await this.dataManager.getMitarbeiter(mitarbeiterId);
      if (!mitarbeiter) {
        showNotification('Fehler', 'Mitarbeiter nicht gefunden', 'danger');
        return;
      }

      const exportData = {
        employee: {
          name: `${mitarbeiter.vorname} ${mitarbeiter.nachname}`,
          vorname: mitarbeiter.vorname,
          nachname: mitarbeiter.nachname,
          department: mitarbeiter.abteilung_name,
          email: mitarbeiter.email,
          geburtsdatum: mitarbeiter.geburtsdatum,
          eintrittsdatum: mitarbeiter.eintrittsdatum,
          austrittsdatum: mitarbeiter.austrittsdatum,
          status: mitarbeiter.status,
          urlaubstage_jahr: mitarbeiter.urlaubstage_jahr,
          wochenstunden: mitarbeiter.wochenstunden,
          adresse: mitarbeiter.adresse,
          gehalt: mitarbeiter.gehalt,
          arbeitszeitmodell: await this.dataManager.getArbeitszeitmodell(mitarbeiterId)
        }
      };

      showNotification('Export', 'PDF wird erstellt...', 'info');
      const result = await window.electronAPI.exportEmployeeDetailPdf(exportData);

      if (result.success) {
        showNotification('Erfolg', `PDF erfolgreich erstellt: ${mitarbeiter.vorname} ${mitarbeiter.nachname}`, 'success');
      } else {
        showNotification('Fehler', `PDF-Export fehlgeschlagen: ${result.error}`, 'danger');
      }
    } catch (error) {
      console.error('Fehler beim PDF-Export:', error);
      showNotification('Fehler', `PDF-Export fehlgeschlagen: ${error.message}`, 'danger');
    }
  }

  // ============================================================
  // EXPORT-DIALOG für Jahresübersicht (PDF + Excel)
  // ============================================================

  async _zeigeJahresExportDialog(mitarbeiterId, aktuellesJahr) {
    const aktJahr = parseInt(aktuellesJahr);
    const jahrOptionen = [-2, -1, 0, 1].map(offset => {
      const j = aktJahr + offset;
      const selected = offset === 0 ? 'selected' : '';
      return `<option value="${j}" ${selected}>${j}</option>`;
    }).join('');

    const modalHtml = `
      <div class="modal fade" id="jahresExportDialog" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">
                <i class="bi bi-box-arrow-up"></i> Jahresübersicht exportieren
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-4">
                <label class="form-label fw-bold">
                  <i class="bi bi-file-earmark"></i> Format
                </label>
                <div class="d-flex gap-3">
                  <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" name="jahresExportFormat"
                           id="jahresFormatPdf" value="pdf" checked>
                    <label class="form-check-label" for="jahresFormatPdf">
                      <i class="bi bi-file-earmark-pdf text-danger"></i> PDF
                    </label>
                  </div>
                  <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" name="jahresExportFormat"
                           id="jahresFormatExcel" value="excel">
                    <label class="form-check-label" for="jahresFormatExcel">
                      <i class="bi bi-file-earmark-excel text-success"></i> Excel (.xlsx)
                    </label>
                  </div>
                </div>
              </div>
              <hr>
              <div class="mb-4">
                <label class="form-label fw-bold">
                  <i class="bi bi-calendar-range"></i> Jahr
                </label>
                <select class="form-select" id="jahresExportJahr" style="width: 150px;">
                  ${jahrOptionen}
                </select>
              </div>
              <hr>
              <div class="mb-3">
                <label class="form-label fw-bold">
                  <i class="bi bi-funnel"></i> Abwesenheitstypen
                </label>
                <div class="d-flex gap-3 flex-wrap">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="jahresFilterUrlaub" checked>
                    <label class="form-check-label text-success" for="jahresFilterUrlaub">
                      <i class="bi bi-calendar-check"></i> Urlaub
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="jahresFilterKrankheit" checked>
                    <label class="form-check-label text-danger" for="jahresFilterKrankheit">
                      <i class="bi bi-bandaid"></i> Krankheit
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="jahresFilterSchulung" checked>
                    <label class="form-check-label text-info" for="jahresFilterSchulung">
                      <i class="bi bi-book"></i> Schulung
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="jahresFilterUeberstunden" checked>
                    <label class="form-check-label text-warning" for="jahresFilterUeberstunden">
                      <i class="bi bi-clock"></i> Überstunden
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
              <button type="button" class="btn btn-primary" id="btnJahresExportStarten">
                <i class="bi bi-box-arrow-up"></i> Export starten
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.querySelectorAll('#jahresExportDialog').forEach(m => {
      const ex = bootstrap.Modal.getInstance(m);
      if (ex) ex.dispose();
      m.remove();
    });

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalElement = document.querySelector('#jahresExportDialog');
    const modal = new bootstrap.Modal(modalElement);

    modalElement.querySelector('#btnJahresExportStarten').addEventListener('click', async () => {
      const btn = modalElement.querySelector('#btnJahresExportStarten');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Wird erstellt...';

      try {
        const format = modalElement.querySelector('[name="jahresExportFormat"]:checked').value;
        const gewaehltesJahr = parseInt(modalElement.querySelector('#jahresExportJahr').value);
        const typen = {
          urlaub:       modalElement.querySelector('#jahresFilterUrlaub').checked,
          krankheit:    modalElement.querySelector('#jahresFilterKrankheit').checked,
          schulung:     modalElement.querySelector('#jahresFilterSchulung').checked,
          ueberstunden: modalElement.querySelector('#jahresFilterUeberstunden').checked,
        };

        if (!Object.values(typen).some(v => v)) {
          showNotification('Fehler', 'Bitte mindestens einen Abwesenheitstyp auswählen', 'danger');
          btn.disabled = false;
          btn.innerHTML = '<i class="bi bi-box-arrow-up"></i> Export starten';
          return;
        }

        if (format === 'excel') {
          await this._exportJahresExcel(mitarbeiterId, gewaehltesJahr, typen);
        } else {
          await this._exportJahresPDF(mitarbeiterId, gewaehltesJahr, typen);
        }

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

  // ============================================================
  // INTERNE HILFSMETHODE: Einträge laden & sortieren
  // ============================================================

  async _ladeExportEintraege(mitarbeiterId, jahr, typen) {
    const jahrStr = jahr.toString();
    const TYP_REIHENFOLGE = { urlaub: 0, krankheit: 1, schulung: 2, ueberstunden: 3 };

    const [urlaubResult, krankheitResult, schulungResult, ueberstundenResult] = await Promise.all([
      typen.urlaub
        ? this.dataManager.db.query(
            `SELECT 'urlaub' as typ, von_datum, bis_datum, tage as wert, notiz, NULL as titel
             FROM urlaub WHERE mitarbeiter_id = ? AND strftime('%Y', von_datum) = ?
             ORDER BY von_datum`,
            [mitarbeiterId, jahrStr]
          )
        : Promise.resolve({ success: true, data: [] }),
      typen.krankheit
        ? this.dataManager.db.query(
            `SELECT 'krankheit' as typ, von_datum, bis_datum, tage as wert, notiz, NULL as titel
             FROM krankheit WHERE mitarbeiter_id = ? AND strftime('%Y', von_datum) = ?
             ORDER BY von_datum`,
            [mitarbeiterId, jahrStr]
          )
        : Promise.resolve({ success: true, data: [] }),
      typen.schulung
        ? this.dataManager.db.query(
            `SELECT 'schulung' as typ, datum as von_datum, datum as bis_datum,
                    dauer_tage as wert, notiz, titel
             FROM schulung WHERE mitarbeiter_id = ? AND strftime('%Y', datum) = ?
             ORDER BY datum`,
            [mitarbeiterId, jahrStr]
          )
        : Promise.resolve({ success: true, data: [] }),
      typen.ueberstunden
        ? this.dataManager.db.query(
            `SELECT 'ueberstunden' as typ, datum as von_datum, datum as bis_datum,
                    stunden as wert, notiz, NULL as titel
             FROM ueberstunden WHERE mitarbeiter_id = ? AND strftime('%Y', datum) = ?
             ORDER BY datum`,
            [mitarbeiterId, jahrStr]
          )
        : Promise.resolve({ success: true, data: [] }),
    ]);

    return [
      ...(urlaubResult.success      ? urlaubResult.data      : []),
      ...(krankheitResult.success   ? krankheitResult.data   : []),
      ...(schulungResult.success    ? schulungResult.data    : []),
      ...(ueberstundenResult.success ? ueberstundenResult.data : []),
    ].sort((a, b) => {
      const typDiff = (TYP_REIHENFOLGE[a.typ] ?? 99) - (TYP_REIHENFOLGE[b.typ] ?? 99);
      if (typDiff !== 0) return typDiff;
      return (a.von_datum || '').localeCompare(b.von_datum || '');
    });
  }

  async _ladeStatistikFuerJahr(mitarbeiterId, jahr) {
    const originalJahr = this.dataManager.aktuellesJahr;
    this.dataManager.aktuellesJahr = parseInt(jahr);
    this.dataManager.invalidateCache();
    const stat = await this.dataManager.getMitarbeiterStatistik(mitarbeiterId);
    this.dataManager.aktuellesJahr = originalJahr;
    this.dataManager.invalidateCache();
    return stat;
  }

  // ============================================================
  // EXPORT: PDF
  // ============================================================

  async _exportJahresPDF(mitarbeiterId, jahr, typen = null) {
    const aktiveTypen = typen || { urlaub: true, krankheit: true, schulung: true, ueberstunden: true };

    try {
      showNotification('Export', 'PDF wird erstellt...', 'info');

      const mitarbeiter = await this.dataManager.getMitarbeiter(mitarbeiterId);
      if (!mitarbeiter) {
        showNotification('Fehler', 'Mitarbeiter nicht gefunden', 'danger');
        return;
      }

      const [stat, alleEintraege] = await Promise.all([
        this._ladeStatistikFuerJahr(mitarbeiterId, jahr),
        this._ladeExportEintraege(mitarbeiterId, jahr, aktiveTypen),
      ]);

      const exportData = {
        employee: {
          name: `${mitarbeiter.vorname} ${mitarbeiter.nachname}`,
          department: mitarbeiter.abteilung_name,
        },
        jahr: jahr.toString(),
        stats: stat ? {
          urlaubsanspruch:   stat.urlaubsanspruch,
          uebertrag_vorjahr: stat.uebertrag_vorjahr,
          urlaub_verfuegbar: stat.urlaub_verfuegbar,
          urlaub_genommen:   stat.urlaub_genommen,
          urlaub_rest:       stat.urlaub_rest,
          krankheitstage:    stat.krankheitstage,
          schulungstage:     stat.schulungstage,
          ueberstunden:      stat.ueberstunden,
        } : {},
        eintraege: alleEintraege,
      };

      const result = await window.electronAPI.exportEmployeeYearPdf(exportData);

      if (result.success) {
        showNotification('Erfolg', `Jahresübersicht ${jahr} als PDF exportiert`, 'success');
      } else {
        showNotification('Fehler', `PDF-Export fehlgeschlagen: ${result.error}`, 'danger');
      }
    } catch (error) {
      console.error('Fehler beim Jahres-PDF-Export:', error);
      showNotification('Fehler', `PDF-Export fehlgeschlagen: ${error.message}`, 'danger');
    }
  }

  // ============================================================
  // EXPORT: Excel
  // ============================================================

  async _exportJahresExcel(mitarbeiterId, jahr, typen = null) {
    const aktiveTypen = typen || { urlaub: true, krankheit: true, schulung: true, ueberstunden: true };

    try {
      showNotification('Export', 'Excel wird erstellt...', 'info');

      const mitarbeiter = await this.dataManager.getMitarbeiter(mitarbeiterId);
      if (!mitarbeiter) {
        showNotification('Fehler', 'Mitarbeiter nicht gefunden', 'danger');
        return;
      }

      const [stat, alleEintraege] = await Promise.all([
        this._ladeStatistikFuerJahr(mitarbeiterId, jahr),
        this._ladeExportEintraege(mitarbeiterId, jahr, aktiveTypen),
      ]);

      const exportData = {
        employee: {
          name: `${mitarbeiter.vorname} ${mitarbeiter.nachname}`,
          department: mitarbeiter.abteilung_name,
        },
        jahr: jahr.toString(),
        stats: stat ? {
          urlaubsanspruch:   stat.urlaubsanspruch,
          uebertrag_vorjahr: stat.uebertrag_vorjahr,
          urlaub_verfuegbar: stat.urlaub_verfuegbar,
          urlaub_genommen:   stat.urlaub_genommen,
          urlaub_rest:       stat.urlaub_rest,
          krankheitstage:    stat.krankheitstage,
          schulungstage:     stat.schulungstage,
          ueberstunden:      stat.ueberstunden,
        } : {},
        eintraege: alleEintraege,
      };

      const result = await window.electronAPI.exportEmployeeYearExcel(exportData);

      if (result.success) {
        showNotification('Erfolg', `Jahresübersicht ${jahr} als Excel exportiert`, 'success');
      } else {
        showNotification('Fehler', `Excel-Export fehlgeschlagen: ${result.error}`, 'danger');
      }
    } catch (error) {
      console.error('Fehler beim Jahres-Excel-Export:', error);
      showNotification('Fehler', `Excel-Export fehlgeschlagen: ${error.message}`, 'danger');
    }
  }

  // ============================================================
  // HAUPTDIALOG
  // FIX: Alle initialen Daten werden parallel geladen (Promise.all)
  // statt seriell – reduziert Wartezeit bei vielen DB-Calls spürbar.
  // ============================================================

  async zeigeDetails(mitarbeiterId, jahr = null, herkunft = 'urlaubsplaner') {
    this.herkunft = herkunft;
    jahr = jahr || this.dataManager.aktuellesJahr;

    // FIX: stat, eintraege und überstunden parallel laden
    const [stat, eintraegeRaw, ueberstundenDetails] = await Promise.all([
      this.dataManager.getMitarbeiterStatistik(mitarbeiterId),
      this._ladeAlleEintraege(mitarbeiterId, jahr),
      this.dataManager.getUeberstundenDetails(mitarbeiterId, jahr),
    ]);

    if (!stat) {
      showNotification('Fehler', 'Mitarbeiter nicht gefunden', 'danger');
      return;
    }

    const ma = stat.mitarbeiter;
    const alleEintraegeSortiert = this._kombiniereUndSortiereEintraege(eintraegeRaw);
    const anzahlNachTyp = this._zaehleEintraegeNachTyp(alleEintraegeSortiert);
    const abteilungsFarbe = ma.abteilung_farbe || '#1f538d';

    const modalHtml = `
      <div class="modal fade" id="detailModal" tabindex="-1">
        <div class="modal-dialog modal-fullscreen">
          <div class="modal-content">
            <div class="modal-header text-white" style="background-color: ${abteilungsFarbe}">
              <h5 class="modal-title">
                <i class="bi bi-person-circle"></i> ${ma.vorname} ${ma.nachname}
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>

            <!-- TAB NAVIGATION -->
            <ul class="nav nav-tabs bg-dark px-3" id="detailTabs" role="tablist">
              <li class="nav-item" role="presentation">
                <button class="nav-link ${herkunft === 'stammdaten' ? 'active' : ''}"
                        id="stammdaten-tab"
                        data-bs-toggle="tab"
                        data-bs-target="#stammdaten"
                        type="button" role="tab"
                        aria-selected="${herkunft === 'stammdaten' ? 'true' : 'false'}">
                  <i class="bi bi-person-badge"></i> Stammdaten
                </button>
              </li>
              <li class="nav-item" role="presentation">
                <button class="nav-link ${herkunft === 'urlaubsplaner' ? 'active' : ''}"
                        id="urlaub-tab"
                        data-bs-toggle="tab"
                        data-bs-target="#urlaub"
                        type="button" role="tab"
                        aria-selected="${herkunft === 'urlaubsplaner' ? 'true' : 'false'}">
                  <i class="bi bi-calendar-check"></i> Urlaubsplaner
                </button>
              </li>
            </ul>

            <div class="modal-body p-0">
              <div class="tab-content" id="detailTabContent">

                <!-- TAB 1: STAMMDATEN -->
                <div class="tab-pane fade ${herkunft === 'stammdaten' ? 'show active' : ''}" id="stammdaten" role="tabpanel">
                  <div class="row g-0" style="height: calc(100vh - 180px);">
                    <div class="col-md-12" style="overflow-y: auto; background-color: #1a1a1a;">
                      <div class="p-4">
                        <div class="row">
                          <div class="col-md-6">
                            <div class="card bg-dark mb-3">
                              <div class="card-header">
                                <h6 class="mb-0"><i class="bi bi-gear"></i> Aktionen</h6>
                              </div>
                              <div class="card-body p-3">
                                <div class="d-grid gap-2">
                                  <button class="btn btn-primary" id="btnMitarbeiterBearbeiten">
                                    <i class="bi bi-pencil me-2"></i>Stammdaten bearbeiten
                                  </button>
                                  <button class="btn btn-outline-danger" id="btnExportStammdatenPDF">
                                    <i class="bi bi-file-earmark-pdf me-2"></i>Als PDF exportieren
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div class="card bg-dark mb-3">
                              <div class="card-header">
                                <h6 class="mb-0"><i class="bi bi-person"></i> Persönliche Daten</h6>
                              </div>
                              <div class="card-body">
                                <table class="table table-sm table-borderless mb-0">
                                  <tr>
                                    <td class="text-muted" style="width: 40%;">Vorname:</td>
                                    <td class="fw-bold">${ma.vorname}</td>
                                  </tr>
                                  <tr>
                                    <td class="text-muted">Nachname:</td>
                                    <td class="fw-bold">${ma.nachname}</td>
                                  </tr>
                                  ${ma.email ? `
                                  <tr>
                                    <td class="text-muted">Email:</td>
                                    <td><small>${ma.email}</small></td>
                                  </tr>` : ''}
                                  ${ma.geburtsdatum ? `
                                  <tr>
                                    <td class="text-muted">Geburtsdatum:</td>
                                    <td>${formatDatumAnzeige(ma.geburtsdatum)}</td>
                                  </tr>` : ''}
                                </table>
                              </div>
                            </div>

                            ${ma.adresse ? `
                            <div class="card bg-dark mb-3">
                              <div class="card-header">
                                <h6 class="mb-0"><i class="bi bi-geo-alt"></i> Adresse</h6>
                              </div>
                              <div class="card-body">
                                <div class="text-light" style="white-space: pre-line;">${ma.adresse}</div>
                              </div>
                            </div>` : ''}

                            <div class="card bg-dark mb-3">
                              <div class="card-header clickable" data-bs-toggle="collapse" data-bs-target="#gehaltCollapse" style="cursor: pointer;">
                                <div class="d-flex justify-content-between align-items-center">
                                  <h6 class="mb-0"><i class="bi bi-currency-euro"></i> Gehalt</h6>
                                  <i class="bi bi-chevron-down"></i>
                                </div>
                              </div>
                              <div id="gehaltCollapse" class="collapse">
                                <div class="card-body">
                                  ${ma.gehalt ? `
                                    <div class="text-center">
                                      <div class="display-6 fw-bold text-success">${formatWaehrung(ma.gehalt)} €</div>
                                      <small class="text-muted">Bruttogehalt pro Monat</small>
                                    </div>` : `
                                    <div class="text-center text-muted">
                                      <i class="bi bi-dash-circle fs-1 d-block mb-2"></i>
                                      Keine Gehaltsinformation hinterlegt
                                    </div>`}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div class="col-md-6">
                            <div class="card bg-dark mb-3">
                              <div class="card-header">
                                <h6 class="mb-0"><i class="bi bi-briefcase"></i> Arbeitsbeziehung</h6>
                              </div>
                              <div class="card-body">
                                <table class="table table-sm table-borderless mb-0">
                                  <tr>
                                    <td class="text-muted" style="width: 40%;">Abteilung:</td>
                                    <td>
                                      <span class="abteilung-badge" style="background-color: ${ma.abteilung_farbe}">
                                        ${ma.abteilung_name}
                                      </span>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td class="text-muted">Eintrittsdatum:</td>
                                    <td>${formatDatumAnzeige(ma.eintrittsdatum)}</td>
                                  </tr>
                                  ${ma.austrittsdatum ? `
                                  <tr>
                                    <td class="text-muted">Austrittsdatum:</td>
                                    <td><span class="badge bg-danger">${formatDatumAnzeige(ma.austrittsdatum)}</span></td>
                                  </tr>` : ''}
                                  <tr>
                                    <td class="text-muted">Status:</td>
                                    <td>
                                      <span class="badge ${ma.status === 'AKTIV' ? 'bg-success' : 'bg-secondary'}">
                                        ${ma.status}
                                      </span>
                                    </td>
                                  </tr>
                                </table>
                              </div>
                            </div>

                            <div class="card bg-dark mb-3">
                              <div class="card-header">
                                <h6 class="mb-0"><i class="bi bi-clock-history"></i> Arbeitszeit</h6>
                              </div>
                              <div class="card-body">
                                <table class="table table-sm table-borderless mb-0">
                                  <tr>
                                    <td class="text-muted" style="width: 40%;">Wochenstunden:</td>
                                    <td class="fw-bold">${ma.wochenstunden || 40}h</td>
                                  </tr>
                                </table>
                                <div id="arbeitszeitmodellAnzeige" class="mt-2">
                                  <small class="text-muted d-block mb-1">Wochenplan:</small>
                                  <div class="text-muted small" style="line-height: 1.6;">Wird geladen...</div>
                                </div>
                                <button class="btn btn-sm btn-outline-info mt-2 w-100" id="btnArbeitszeitmodell">
                                  <i class="bi bi-calendar-week"></i> Bearbeiten
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- TAB 2: URLAUB & ABWESENHEIT -->
                <div class="tab-pane fade ${herkunft === 'urlaubsplaner' ? 'show active' : ''}" id="urlaub" role="tabpanel">
                  <div class="d-flex align-items-center justify-content-center gap-3 p-3 bg-dark border-bottom">
                    <button class="btn btn-outline-light btn-sm" id="btnVorigesJahr" title="Voriges Jahr">
                      <i class="bi bi-chevron-left"></i>
                    </button>
                    <h5 class="mb-0 fw-bold" style="min-width: 100px; text-align: center;">${jahr}</h5>
                    <button class="btn btn-outline-light btn-sm" id="btnNaechstesJahr" title="Nächstes Jahr">
                      <i class="bi bi-chevron-right"></i>
                    </button>
                  </div>

                  <div class="row g-0" style="height: calc(100vh - 260px);">

                    <!-- LINKE SPALTE -->
                    <div class="col-md-4 border-end" style="overflow-y: auto; background-color: #1a1a1a;">
                      <div class="p-3">

                        <div class="card bg-dark mb-3">
                          <div class="card-header clickable" id="clickUrlaub" style="cursor: pointer;" title="Klicken um Urlaub einzutragen">
                            <div class="d-flex justify-content-between align-items-center">
                              <h6 class="mb-0"><i class="bi bi-calendar-check text-success"></i> Urlaub ${jahr}</h6>
                              <i class="bi bi-plus-circle text-success"></i>
                            </div>
                          </div>
                          <div class="card-body">
                            <table class="table table-sm table-borderless mb-0">
                              <tr>
                                <td class="text-muted" style="width: 50%;">Anspruch:</td>
                                <td class="fw-bold">${formatZahl(stat.urlaubsanspruch)} Tage</td>
                              </tr>
                              <tr>
                                <td class="text-muted">Übertrag ${jahr-1}:</td>
                                <td>
                                  <span class="clickable" id="clickUebertrag" style="cursor: pointer;" title="Klicken zum Anpassen">
                                    ${formatZahl(stat.uebertrag_original || stat.uebertrag_vorjahr)} Tage
                                    <i class="bi bi-pencil-square text-info ms-1"></i>
                                  </span>
                                </td>
                              </tr>
                              ${stat.verfallen && stat.verfallen > 0 ? `
                              <tr>
                                <td class="text-muted"><i class="bi bi-x-circle text-danger"></i> Verfallen (31.03.${jahr}):</td>
                                <td class="fw-bold text-danger">-${formatZahl(stat.verfallen)} Tage</td>
                              </tr>` : ''}
                              <tr>
                                <td class="text-muted">
                                  Verfallend (31.03.${jahr}):
                                  <i class="bi bi-info-circle" title="Übertrag der nicht bis 31.03. genommen wurde"></i>
                                </td>
                                <td class="fw-bold" id="verfallendeTage">
                                  <span class="spinner-border spinner-border-sm" role="status"></span>
                                </td>
                              </tr>
                              <tr>
                                <td class="text-muted">Verfügbar:</td>
                                <td class="fw-bold text-info">${formatZahl(stat.urlaub_verfuegbar)} Tage</td>
                              </tr>
                              <tr>
                                <td class="text-muted">Genommen:</td>
                                <td class="fw-bold text-warning">${formatZahl(stat.urlaub_genommen)} Tage</td>
                              </tr>
                              <tr class="border-top">
                                <td class="text-muted fw-bold">Resturlaub:</td>
                                <td class="fs-5 fw-bold ${stat.urlaub_rest < 0 ? 'text-danger' : stat.urlaub_rest < 5 ? 'text-warning' : 'text-success'}">
                                  ${formatZahl(stat.urlaub_rest)} Tage
                                </td>
                              </tr>
                            </table>
                          </div>
                        </div>

                        <div class="card bg-dark mb-3">
                          <div class="card-header clickable" id="clickUeberstunden" style="cursor: pointer;" title="Klicken um Überstunden einzutragen">
                            <div class="d-flex justify-content-between align-items-center">
                              <h6 class="mb-0"><i class="bi bi-clock text-warning"></i> Überstunden ${jahr}</h6>
                              <i class="bi bi-plus-circle text-warning"></i>
                            </div>
                          </div>
                          <div class="card-body">
                            <table class="table table-sm table-borderless mb-0">
                              <tr>
                                <td class="text-muted" style="width: 40%;">Übertrag ${jahr-1}:</td>
                                <td class="fw-bold ${ueberstundenDetails.uebertrag >= 0 ? 'text-success' : 'text-danger'}">
                                  ${ueberstundenDetails.uebertrag >= 0 ? '+' : ''}${formatZahl(ueberstundenDetails.uebertrag)}h
                                </td>
                              </tr>
                              <tr>
                                <td class="text-muted">Gemacht ${jahr}:</td>
                                <td class="fw-bold text-success">+${formatZahl(ueberstundenDetails.gemacht)}h</td>
                              </tr>
                              <tr>
                                <td class="text-muted">Abgebaut ${jahr}:</td>
                                <td class="fw-bold text-danger">-${formatZahl(ueberstundenDetails.abgebaut)}h</td>
                              </tr>
                              <tr class="border-top">
                                <td class="text-muted fw-bold">Saldo:</td>
                                <td class="fs-5 fw-bold ${ueberstundenDetails.saldo >= 0 ? 'text-success' : 'text-danger'}">
                                  ${ueberstundenDetails.saldo >= 0 ? '+' : ''}${formatZahl(ueberstundenDetails.saldo)}h
                                </td>
                              </tr>
                            </table>
                          </div>
                        </div>

                        <div class="export-section">
                          <button class="btn btn-outline-danger btn-sm w-100" id="btnExportPDF">
                            <i class="bi bi-box-arrow-up me-2"></i>
                            Jahresübersicht exportieren
                          </button>
                        </div>

                      </div>
                    </div>

                    <!-- RECHTE SPALTE -->
                    <div class="col-md-8" style="display: flex; flex-direction: column;">

                      <div class="p-3 border-bottom" style="flex-shrink: 0; background-color: #2d2d2d;">
                        <div class="row g-3">
                          <div class="col-md-4">
                            <div class="card bg-dark h-100 clickable" id="clickKrankheit" style="cursor: pointer; border-left: 3px solid #dc3545;">
                              <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start">
                                  <div>
                                    <div class="text-muted small mb-1"><i class="bi bi-bandaid"></i> Krankheit ${jahr}</div>
                                    <div class="fs-3 fw-bold text-danger">${formatZahl(stat.krankheitstage)}</div>
                                    <div class="text-muted small">Tage</div>
                                  </div>
                                  <i class="bi bi-plus-circle fs-4 text-danger opacity-50"></i>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div class="col-md-4">
                            <div class="card bg-dark h-100 clickable" id="clickSchulung" style="cursor: pointer; border-left: 3px solid #17a2b8;">
                              <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start">
                                  <div>
                                    <div class="text-muted small mb-1"><i class="bi bi-book"></i> Schulung ${jahr}</div>
                                    <div class="fs-3 fw-bold text-info">${formatZahl(stat.schulungstage)}</div>
                                    <div class="text-muted small">Tage</div>
                                  </div>
                                  <i class="bi bi-plus-circle fs-4 text-info opacity-50"></i>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div class="col-md-4">
                            <div class="card bg-dark h-100" style="border-left: 3px solid #6c757d;">
                              <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start">
                                  <div>
                                    <div class="text-muted small mb-1"><i class="bi bi-list-ul"></i> Alle Einträge</div>
                                    <div class="fs-3 fw-bold">${alleEintraegeSortiert.length}</div>
                                    <div class="text-muted small">Einträge insgesamt</div>
                                  </div>
                                  <i class="bi bi-collection fs-4 opacity-50"></i>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style="flex: 1; overflow-y: auto; background-color: #1a1a1a;">
                        <div class="p-3">
                          <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="mb-0"><i class="bi bi-list-ul"></i> Alle Einträge (${alleEintraegeSortiert.length})</h6>
                            <div class="d-flex gap-2">
                              <div class="btn-group btn-group-sm" role="group">
                                <button type="button" class="btn btn-outline-light sortierung-btn active" data-sort="desc" title="Neueste zuerst">
                                  <i class="bi bi-sort-down"></i>
                                </button>
                                <button type="button" class="btn btn-outline-light sortierung-btn" data-sort="asc" title="Älteste zuerst">
                                  <i class="bi bi-sort-up"></i>
                                </button>
                              </div>
                            </div>
                          </div>

                          <div class="d-flex gap-2 flex-wrap mb-3">
                            <button type="button" class="btn btn-sm btn-outline-secondary filter-btn active" data-filter="alle">
                              <i class="bi bi-list"></i> Alle <span class="badge bg-secondary">${alleEintraegeSortiert.length}</span>
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-success filter-btn" data-filter="urlaub">
                              <i class="bi bi-calendar-check"></i> Urlaub <span class="badge bg-success">${anzahlNachTyp.urlaub}</span>
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-danger filter-btn" data-filter="krankheit">
                              <i class="bi bi-bandaid"></i> Krankheit <span class="badge bg-danger">${anzahlNachTyp.krankheit}</span>
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-info filter-btn" data-filter="schulung">
                              <i class="bi bi-book"></i> Schulung <span class="badge bg-info">${anzahlNachTyp.schulung}</span>
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-warning filter-btn" data-filter="ueberstunden">
                              <i class="bi bi-clock"></i> Überstunden <span class="badge bg-warning text-dark">${anzahlNachTyp.ueberstunden}</span>
                            </button>
                          </div>

                          <div id="eintraegeContainer">
                            ${this._renderAlleEintraege(alleEintraegeSortiert)}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const oldModals = document.querySelectorAll('.modal');
    oldModals.forEach(m => {
      const existingModal = bootstrap.Modal.getInstance(m);
      if (existingModal) existingModal.dispose();
      m.remove();
    });

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modalElement = document.querySelector('#detailModal');
    const modal = new bootstrap.Modal(modalElement);

    this._initActionListeners(modalElement, mitarbeiterId, modal, jahr);
    this._initFilterUndSortierung(modalElement, alleEintraegeSortiert);
    this._initClickHandlers(modalElement, mitarbeiterId, modal, jahr);
    this._initJahrNavigation(modalElement, mitarbeiterId, modal, jahr);

    // Arbeitszeitmodell und Verfallsinfo parallel laden (nicht blockierend)
    Promise.all([
      this._ladeUndZeigeArbeitszeitmodell(mitarbeiterId),
      this._ladeVerfallsinfo(modalElement, mitarbeiterId, jahr),
    ]);

    modal.show();

    return new Promise((resolve) => {
      modalElement.addEventListener('hidden.bs.modal', () => {
        modal.dispose();
        modalElement.remove();
        resolve();
      }, { once: true });
    });
  }

  _initJahrNavigation(modalElement, mitarbeiterId, modal, anzeigeJahr) {
    const btnVoriges = modalElement.querySelector('#btnVorigesJahr');
    const btnNaechstes = modalElement.querySelector('#btnNaechstesJahr');
    if (btnVoriges) {
      btnVoriges.addEventListener('click', async () => {
        modal.hide();
        setTimeout(() => this.zeigeDetails(mitarbeiterId, anzeigeJahr - 1), 300);
      });
    }
    if (btnNaechstes) {
      btnNaechstes.addEventListener('click', async () => {
        modal.hide();
        setTimeout(() => this.zeigeDetails(mitarbeiterId, anzeigeJahr + 1), 300);
      });
    }
  }

  async _ladeVerfallsinfo(modalElement, mitarbeiterId, jahr) {
    try {
      const verfallZelle = modalElement.querySelector('#verfallendeTage');
      if (!verfallZelle) return;
      const mitarbeiter = await this.dataManager.getMitarbeiter(mitarbeiterId);
      const verfaelltAktiv = mitarbeiter && mitarbeiter.uebertrag_verfaellt !== undefined
        ? mitarbeiter.uebertrag_verfaellt === 1 : true;
      if (!verfaelltAktiv) {
        verfallZelle.innerHTML = `<span class="text-success">0 Tage</span> <small class="text-muted">(kein Verfall)</small>`;
        return;
      }
      const verfallInfo = await this.dataManager.getVerfallenderUrlaub(mitarbeiterId, jahr);
      const farbe = verfallInfo.verfaellt === 0 ? 'text-success' : 'text-danger';
      verfallZelle.innerHTML = `<span class="${farbe}">${formatZahl(verfallInfo.verfaellt)} Tage</span>`;
    } catch (error) {
      const z = modalElement.querySelector('#verfallendeTage');
      if (z) z.innerHTML = '<span class="text-muted">-</span>';
    }
  }

  _initClickHandlers(modalElement, mitarbeiterId, modal, jahr) {
    const bind = (id, fn) => {
      const el = modalElement.querySelector(id);
      if (el) el.addEventListener('click', fn);
    };

    bind('#clickUrlaub', async () => {
      modal.hide();
      if (typeof dialogManager !== 'undefined')
        await dialogManager.zeigeUrlaubDialog(mitarbeiterId, async () => setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300));
    });

    bind('#clickUebertrag', async () => {
      modal.hide();
      if (typeof dialogManager !== 'undefined')
        await dialogManager.zeigeUebertragAnpassen(mitarbeiterId, async () => setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300));
    });

    bind('#clickKrankheit', async () => {
      modal.hide();
      if (typeof dialogManager !== 'undefined')
        await dialogManager.zeigeKrankDialog(mitarbeiterId, async () => setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300));
    });

    bind('#clickSchulung', async () => {
      modal.hide();
      if (typeof dialogManager !== 'undefined')
        await dialogManager.zeigeSchulungDialog(mitarbeiterId, async () => setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300));
    });

    bind('#clickUeberstunden', async () => {
      modal.hide();
      if (typeof dialogManager !== 'undefined')
        await dialogManager.zeigeUeberstundenDialog(mitarbeiterId, async () => setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300));
    });

    bind('#btnMitarbeiterBearbeiten', async () => {
      modal.hide();
      if (typeof dialogManager !== 'undefined')
        await dialogManager.zeigeStammdatenBearbeiten(mitarbeiterId, async () => setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr, this.herkunft), 300));
    });

    bind('#btnArbeitszeitmodell', async () => {
      modal.hide();
      if (typeof dialogManager !== 'undefined')
        await dialogManager.zeigeArbeitszeitmodell(mitarbeiterId, async () => setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300));
    });

    bind('#btnExportStammdatenPDF', async (e) => {
      e.preventDefault();
      await this._exportMitarbeiterPDF(mitarbeiterId, jahr);
    });

    bind('#btnExportPDF', async (e) => {
      e.preventDefault();
      await this._zeigeJahresExportDialog(mitarbeiterId, jahr);
    });
  }

  _initFilterUndSortierung(modalElement, alleEintraege) {
    const filterButtons = modalElement.querySelectorAll('.filter-btn');
    const sortierungButtons = modalElement.querySelectorAll('.sortierung-btn');
    const container = modalElement.querySelector('#eintraegeContainer');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filterTyp = btn.dataset.filter;
        this._aktualisiereEintraegeListe(container, alleEintraege);
      });
    });
    sortierungButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        sortierungButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.sortierung = btn.dataset.sort;
        this._aktualisiereEintraegeListe(container, alleEintraege);
      });
    });
  }

  _aktualisiereEintraegeListe(container, alleEintraege) {
    let gefiltert = this.filterTyp !== 'alle'
      ? alleEintraege.filter(e => e.typ === this.filterTyp)
      : alleEintraege;
    const sortiert = [...gefiltert].sort((a, b) => {
      const dA = new Date(a.datumSort), dB = new Date(b.datumSort);
      return this.sortierung === 'desc' ? dB - dA : dA - dB;
    });
    container.innerHTML = this._renderAlleEintraege(sortiert);
  }

  _renderAlleEintraege(eintraege) {
    if (eintraege.length === 0) {
      return `<div class="text-center text-muted py-5">
        <i class="bi bi-inbox fs-1 d-block mb-2"></i><p>Keine Einträge vorhanden</p>
      </div>`;
    }
    return `<div class="list-group list-group-flush">
      ${eintraege.map(e => this._renderEintrag(e)).join('')}
    </div>`;
  }

  _renderEintrag(eintrag) {
    const config = this._getEintragConfig(eintrag.typ);
    let hauptInfo = '', nebenInfo = '';
    switch (eintrag.typ) {
      case 'urlaub':
        hauptInfo = `${formatDatumAnzeige(eintrag.von_datum)} - ${formatDatumAnzeige(eintrag.bis_datum)}`;
        nebenInfo = `<strong>${formatZahl(eintrag.tage)}</strong> Tage`; break;
      case 'krankheit':
        hauptInfo = `${formatDatumAnzeige(eintrag.von_datum)} - ${formatDatumAnzeige(eintrag.bis_datum)}`;
        nebenInfo = `<strong>${formatZahl(eintrag.tage)}</strong> Tage`; break;
      case 'schulung': {
        const s = new Date(eintrag.datum), e2 = new Date(s);
        e2.setDate(e2.getDate() + Math.floor(eintrag.dauer_tage) - 1);
        const e2Str = e2.toISOString().split('T')[0];
        hauptInfo = eintrag.datum === e2Str ? formatDatumAnzeige(eintrag.datum)
          : `${formatDatumAnzeige(eintrag.datum)} - ${formatDatumAnzeige(e2Str)}`;
        nebenInfo = `<strong>${formatZahl(eintrag.dauer_tage)}</strong> Tage`; break;
      }
      case 'ueberstunden':
        hauptInfo = formatDatumAnzeige(eintrag.datum);
        nebenInfo = `<strong>${eintrag.stunden >= 0 ? '+' : ''}${formatZahl(eintrag.stunden)}</strong> Std.`; break;
    }
    return `
      <div class="list-group-item list-group-item-action bg-dark border-secondary">
        <div class="d-flex w-100 justify-content-between align-items-start">
          <div class="flex-grow-1">
            <div class="d-flex align-items-center mb-1">
              <span class="badge ${config.badgeClass} me-2"><i class="${config.icon}"></i> ${config.label}</span>
              <span class="text-light">${hauptInfo}</span>
            </div>
            <div class="d-flex align-items-center">
              <span class="${config.textClass} me-3">${nebenInfo}</span>
              ${eintrag.titel ? `<span class="text-info"><i class="bi bi-tag"></i> ${eintrag.titel}</span>` : ''}
            </div>
            ${eintrag.notiz ? `<small class="text-muted d-block mt-1"><i class="bi bi-sticky"></i> ${eintrag.notiz}</small>` : ''}
          </div>
          <div class="btn-group btn-group-sm ms-2">
            <button class="btn btn-outline-primary btn-edit" data-id="${eintrag.id}" data-typ="${eintrag.typ}" title="Bearbeiten">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger btn-delete" data-id="${eintrag.id}" data-typ="${eintrag.typ}" title="Löschen">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>`;
  }

  _initActionListeners(modalElement, mitarbeiterId, modal, jahr) {
    modalElement.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('.btn-delete');
      const editBtn = e.target.closest('.btn-edit');
      if (deleteBtn) await this._handleDelete(deleteBtn, mitarbeiterId, modal, jahr);
      else if (editBtn) await this._handleEdit(editBtn, mitarbeiterId, modal, jahr);
    });
  }

  async _handleDelete(deleteBtn, mitarbeiterId, modal, jahr) {
    const id = parseInt(deleteBtn.dataset.id);
    const typ = deleteBtn.dataset.typ;
    if (!confirm(`Möchten Sie diesen ${this._getTypLabel(typ)}-Eintrag wirklich löschen?`)) return;
    try {
      const result = await this.dataManager.db.run(`DELETE FROM ${typ} WHERE id = ?`, [id]);
      if (!result.success) throw new Error(result.error);
      showNotification('Erfolg', 'Eintrag wurde gelöscht', 'success');
      this.dataManager.invalidateCache();
      modal.hide();
      setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
    } catch (error) {
      showNotification('Fehler', error.message, 'danger');
    }
  }

  async _handleEdit(editBtn, mitarbeiterId, modal, jahr) {
    const id = parseInt(editBtn.dataset.id);
    const typ = editBtn.dataset.typ;
    modal.hide();
    try {
      const cb = async () => setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
      if (typ === 'urlaub')        await this._bearbeiteEintrag(id, typ, cb);
      else if (typ === 'krankheit') await this._bearbeiteEintrag(id, typ, cb);
      else if (typ === 'schulung')  await this._bearbeiteEintrag(id, typ, cb);
      else if (typ === 'ueberstunden') await this._bearbeiteEintrag(id, typ, cb);
    } catch (error) {
      showNotification('Fehler', error.message, 'danger');
      setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
    }
  }

  // ============================================================
  // FIX: Generischer Bearbeiten-Modal ersetzt 4× identischen Boilerplate
  //
  // Vorher: _bearbeiteUrlaub(), _bearbeiteKrankheit(), _bearbeiteSchulung(),
  //         _bearbeiteUeberstunden() – je ~50 Zeilen, 95% identisch.
  // Jetzt:  _zeigeBearbeitenModal(config) + _bearbeiteEintrag(id, typ, cb)
  // ============================================================

  _getBearbeitenConfig(typ, eintrag) {
    switch (typ) {
      case 'urlaub':
        return {
          titel: 'Urlaub bearbeiten',
          headerClass: 'bg-success text-white',
          btnClass: 'btn-success',
          felder: [
            { label: 'Von *',          id: 'vonDatum',  type: 'date',   value: eintrag.von_datum, required: true },
            { label: 'Bis *',          id: 'bisDatum',  type: 'date',   value: eintrag.bis_datum, required: true },
            { label: 'Urlaubstage *',  id: 'tage',      type: 'number', value: eintrag.tage,      required: true, attrs: 'step="0.5" min="0.5"' },
            { label: 'Notiz',          id: 'notiz',     type: 'textarea', value: eintrag.notiz || '' },
          ],
          updateSql: 'UPDATE urlaub SET von_datum=?,bis_datum=?,tage=?,notiz=? WHERE id=?',
          getParams: () => [
            document.getElementById('vonDatum').value,
            document.getElementById('bisDatum').value,
            parseFloat(document.getElementById('tage').value),
            document.getElementById('notiz').value || null,
            eintrag.id,
          ],
        };
      case 'krankheit':
        return {
          titel: 'Krankheit bearbeiten',
          headerClass: 'bg-danger text-white',
          btnClass: 'btn-danger',
          felder: [
            { label: 'Von *',            id: 'vonDatum', type: 'date',   value: eintrag.von_datum, required: true },
            { label: 'Bis *',            id: 'bisDatum', type: 'date',   value: eintrag.bis_datum, required: true },
            { label: 'Krankheitstage *', id: 'tage',     type: 'number', value: eintrag.tage,      required: true, attrs: 'step="0.5" min="0.5"' },
            { label: 'Notiz',            id: 'notiz',    type: 'textarea', value: eintrag.notiz || '' },
          ],
          updateSql: 'UPDATE krankheit SET von_datum=?,bis_datum=?,tage=?,notiz=? WHERE id=?',
          getParams: () => [
            document.getElementById('vonDatum').value,
            document.getElementById('bisDatum').value,
            parseFloat(document.getElementById('tage').value),
            document.getElementById('notiz').value || null,
            eintrag.id,
          ],
        };
      case 'schulung':
        return {
          titel: 'Schulung bearbeiten',
          headerClass: 'bg-info text-white',
          btnClass: 'btn-info',
          felder: [
            { label: 'Datum *',       id: 'datum',     type: 'date',   value: eintrag.datum,      required: true },
            { label: 'Dauer (Tage) *', id: 'dauerTage', type: 'number', value: eintrag.dauer_tage, required: true, attrs: 'step="0.5" min="0.5"' },
            { label: 'Titel',         id: 'titel',     type: 'text',   value: eintrag.titel || '' },
            { label: 'Notiz',         id: 'notiz',     type: 'textarea', value: eintrag.notiz || '' },
          ],
          updateSql: 'UPDATE schulung SET datum=?,dauer_tage=?,titel=?,notiz=? WHERE id=?',
          getParams: () => [
            document.getElementById('datum').value,
            parseFloat(document.getElementById('dauerTage').value),
            document.getElementById('titel').value || null,
            document.getElementById('notiz').value || null,
            eintrag.id,
          ],
        };
      case 'ueberstunden':
        return {
          titel: 'Überstunden bearbeiten',
          headerClass: 'bg-warning text-dark',
          btnClass: 'btn-warning',
          btnCloseClass: '',
          felder: [
            { label: 'Datum *',   id: 'datum',   type: 'date',   value: eintrag.datum,   required: true },
            { label: 'Stunden *', id: 'stunden', type: 'number', value: eintrag.stunden, required: true, attrs: 'step="0.25"',
              hint: 'Positive Werte = Aufbau, Negative Werte = Abbau' },
            { label: 'Notiz',     id: 'notiz',   type: 'textarea', value: eintrag.notiz || '' },
          ],
          updateSql: 'UPDATE ueberstunden SET datum=?,stunden=?,notiz=? WHERE id=?',
          getParams: () => [
            document.getElementById('datum').value,
            parseFloat(document.getElementById('stunden').value),
            document.getElementById('notiz').value || null,
            eintrag.id,
          ],
        };
      default:
        throw new Error(`Unbekannter Typ: ${typ}`);
    }
  }

  _renderFeld(feld) {
    const req = feld.required ? 'required' : '';
    const attrs = feld.attrs || '';
    let input;
    if (feld.type === 'textarea') {
      input = `<textarea class="form-control" id="${feld.id}" rows="2">${feld.value}</textarea>`;
    } else {
      input = `<input type="${feld.type}" class="form-control" id="${feld.id}" value="${feld.value}" ${req} ${attrs}>`;
    }
    const hint = feld.hint ? `<small class="text-muted">${feld.hint}</small>` : '';
    return `<div class="mb-3"><label class="form-label">${feld.label}</label>${input}${hint}</div>`;
  }

  async _bearbeiteEintrag(id, typ, callback) {
    const tabelle = typ === 'ueberstunden' ? 'ueberstunden' :
                    typ === 'schulung'     ? 'schulung'     :
                    typ === 'urlaub'       ? 'urlaub'       : 'krankheit';

    const result = await this.dataManager.db.get(`SELECT * FROM ${tabelle} WHERE id = ?`, [id]);
    if (!result.success || !result.data) throw new Error(`${this._getTypLabel(typ)}-Eintrag nicht gefunden`);

    const config = this._getBearbeitenConfig(typ, result.data);
    const formId = `${typ}BearbeitenForm`;
    const felder = config.felder.map(f => this._renderFeld(f)).join('');
    const closeBtnClass = config.btnCloseClass !== undefined ? config.btnCloseClass : 'btn-close-white';

    const modalHtml = `
      <div class="modal fade" id="${typ}BearbeitenModal" tabindex="-1">
        <div class="modal-dialog"><div class="modal-content">
          <div class="modal-header ${config.headerClass}">
            <h5 class="modal-title"><i class="bi bi-pencil"></i> ${config.titel}</h5>
            <button type="button" class="btn-close ${closeBtnClass}" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="${formId}">${felder}</form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
            <button type="button" class="btn ${config.btnClass}" id="btnSpeichern">
              <i class="bi bi-check-lg"></i> Speichern
            </button>
          </div>
        </div></div>
      </div>`;

    await this.showModal(modalHtml, async () => {
      const form = document.getElementById(formId);
      if (!form.checkValidity()) { form.reportValidity(); return false; }
      const r = await this.dataManager.db.run(config.updateSql, config.getParams());
      if (!r.success) { showNotification('Fehler', r.error, 'danger'); return false; }
      this.dataManager.invalidateCache();
      showNotification('Erfolg', `${config.titel.replace(' bearbeiten', '')} wurde aktualisiert`, 'success');
      if (callback) await callback();
      return true;
    });
  }

  _getEintragConfig(typ) {
    return {
      urlaub:       { label: 'Urlaub',      icon: 'bi bi-calendar-check', badgeClass: 'bg-success',            textClass: 'text-success' },
      krankheit:    { label: 'Krankheit',    icon: 'bi bi-bandaid',        badgeClass: 'bg-danger',             textClass: 'text-danger' },
      schulung:     { label: 'Schulung',     icon: 'bi bi-book',           badgeClass: 'bg-info',               textClass: 'text-info' },
      ueberstunden: { label: 'Überstunden',  icon: 'bi bi-clock',          badgeClass: 'bg-warning text-dark',  textClass: 'text-warning' },
    }[typ] || { label: typ, icon: 'bi bi-circle', badgeClass: 'bg-secondary', textClass: 'text-muted' };
  }

  _getTypLabel(typ) {
    return { urlaub: 'Urlaub', krankheit: 'Krankheit', schulung: 'Schulung', ueberstunden: 'Überstunden' }[typ] || typ;
  }

  _zaehleEintraegeNachTyp(eintraege) {
    return {
      urlaub:       eintraege.filter(e => e.typ === 'urlaub').length,
      krankheit:    eintraege.filter(e => e.typ === 'krankheit').length,
      schulung:     eintraege.filter(e => e.typ === 'schulung').length,
      ueberstunden: eintraege.filter(e => e.typ === 'ueberstunden').length,
    };
  }

  async _ladeAlleEintraege(mitarbeiterId, jahr) {
    const j = jahr.toString();
    const q = (sql, p) => this.dataManager.db.query(sql, p);
    const [u, k, s, ue] = await Promise.all([
      q(`SELECT * FROM urlaub       WHERE mitarbeiter_id=? AND strftime('%Y',von_datum)=? ORDER BY von_datum DESC`, [mitarbeiterId, j]),
      q(`SELECT * FROM krankheit    WHERE mitarbeiter_id=? AND strftime('%Y',von_datum)=? ORDER BY von_datum DESC`, [mitarbeiterId, j]),
      q(`SELECT * FROM schulung     WHERE mitarbeiter_id=? AND strftime('%Y',datum)=?     ORDER BY datum DESC`,     [mitarbeiterId, j]),
      q(`SELECT * FROM ueberstunden WHERE mitarbeiter_id=? AND strftime('%Y',datum)=?     ORDER BY datum DESC`,     [mitarbeiterId, j]),
    ]);
    return {
      urlaub:       u.success  ? u.data  : [],
      krankheit:    k.success  ? k.data  : [],
      schulung:     s.success  ? s.data  : [],
      ueberstunden: ue.success ? ue.data : [],
    };
  }

  _kombiniereUndSortiereEintraege(eintraege) {
    const alle = [
      ...eintraege.urlaub.map(e => ({ typ: 'urlaub', datumSort: e.von_datum, ...e })),
      ...eintraege.krankheit.map(e => ({ typ: 'krankheit', datumSort: e.von_datum, ...e })),
      ...eintraege.schulung.map(e => ({ typ: 'schulung', datumSort: e.datum, ...e })),
      ...eintraege.ueberstunden.map(e => ({ typ: 'ueberstunden', datumSort: e.datum, ...e })),
    ];
    alle.sort((a, b) => new Date(b.datumSort) - new Date(a.datumSort));
    return alle;
  }

  async _ladeUndZeigeArbeitszeitmodell(mitarbeiterId) {
    const container = document.getElementById('arbeitszeitmodellAnzeige');
    if (!container) return;
    try {
      const modell = await this.dataManager.getArbeitszeitmodell(mitarbeiterId);
      const wt = ['Mo','Di','Mi','Do','Fr','Sa','So'];
      const lb = { VOLL: 'ganz', HALB: 'halb', FREI: 'frei' };
      let html = '<small class="text-muted d-block mb-1">Wochenplan:</small><div class="text-light small" style="line-height:1.6;">';
      if (!modell.length) {
        html += 'Mo-Fr: <span class="text-success">ganz</span><br>Sa-So: <span class="text-muted">frei</span>';
      } else {
        const gruppen = [];
        let g = null;
        for (let i = 0; i < 7; i++) {
          const tm = modell.find(m => m.wochentag === i);
          const az = tm ? tm.arbeitszeit : (i < 5 ? 'VOLL' : 'FREI');
          if (!g || g.arbeitszeit !== az) { if (g) gruppen.push(g); g = { start: i, end: i, arbeitszeit: az }; }
          else g.end = i;
        }
        if (g) gruppen.push(g);
        gruppen.forEach((gr, idx) => {
          const l = lb[gr.arbeitszeit] || gr.arbeitszeit.toLowerCase();
          const c = gr.arbeitszeit === 'VOLL' ? 'text-success' : gr.arbeitszeit === 'HALB' ? 'text-warning' : 'text-muted';
          html += gr.start === gr.end
            ? `${wt[gr.start]}: <span class="${c}">${l}</span>`
            : `${wt[gr.start]}-${wt[gr.end]}: <span class="${c}">${l}</span>`;
          if (idx < gruppen.length - 1) html += '<br>';
        });
      }
      html += '</div>';
      container.innerHTML = html;
    } catch (_) {
      container.innerHTML = '<small class="text-muted d-block mb-1">Wochenplan:</small><div class="text-muted small">Standard: Mo-Fr ganz</div>';
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DetailDialog;
}