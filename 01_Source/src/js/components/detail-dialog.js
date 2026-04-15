/**
 * Detail-Dialog
 * Zeigt alle Einträge eines Mitarbeiters für ein Jahr.
 *
 * AUFGERÄUMT:
 * - _bearbeiteUrlaub / _bearbeiteKrankheit / _bearbeiteSchulung / _bearbeiteUeberstunden
 *   waren ~60 Zeilen identischer Modal-Boilerplate mit nur unterschiedlichen
 *   Feldnamen. Ersetzt durch eine generische _zeigeBearbeitenModal(config)-Methode.
 */

class DetailDialog extends DialogBase {
  constructor(dataManager) {
    super(dataManager);
    this.filterTyp  = 'alle';
    this.sortierung = 'desc';
    this.herkunft   = 'urlaubsplaner';
  }

  // ── Stammdaten-PDF ──────────────────────────────────────────────────────────
  async _exportMitarbeiterPDF(mitarbeiterId) {
    try {
      const mitarbeiter = await this.dataManager.getMitarbeiter(mitarbeiterId);
      if (!mitarbeiter) { showNotification('Fehler', 'Mitarbeiter nicht gefunden', 'danger'); return; }

      const exportData = {
        employee: {
          name:              `${mitarbeiter.vorname} ${mitarbeiter.nachname}`,
          vorname:           mitarbeiter.vorname,
          nachname:          mitarbeiter.nachname,
          department:        mitarbeiter.abteilung_name,
          email:             mitarbeiter.email,
          geburtsdatum:      mitarbeiter.geburtsdatum,
          eintrittsdatum:    mitarbeiter.eintrittsdatum,
          austrittsdatum:    mitarbeiter.austrittsdatum,
          status:            mitarbeiter.status,
          urlaubstage_jahr:  mitarbeiter.urlaubstage_jahr,
          wochenstunden:     mitarbeiter.wochenstunden,
          adresse:           mitarbeiter.adresse,
          gehalt:            mitarbeiter.gehalt,
          arbeitszeitmodell: await this.dataManager.getArbeitszeitmodell(mitarbeiterId),
        },
      };

      showNotification('Export', 'PDF wird erstellt...', 'info');
      const result = await window.electronAPI.exportEmployeeDetailPdf(exportData);
      if (result.success) {
        showNotification('Erfolg', `Stammdaten-PDF erstellt: ${mitarbeiter.vorname} ${mitarbeiter.nachname}`, 'success');
      } else {
        showNotification('Fehler', `PDF-Export fehlgeschlagen: ${result.error}`, 'danger');
      }
    } catch (error) {
      showNotification('Fehler', `PDF-Export fehlgeschlagen: ${error.message}`, 'danger');
    }
  }

  // ── Jahres-PDF ──────────────────────────────────────────────────────────────
  async _exportJahresPDF(mitarbeiterId, jahr) {
    try {
      showNotification('Export', 'PDF wird erstellt...', 'info');
      const mitarbeiter = await this.dataManager.getMitarbeiter(mitarbeiterId);
      if (!mitarbeiter) { showNotification('Fehler', 'Mitarbeiter nicht gefunden', 'danger'); return; }

      const stat    = await this.dataManager.getMitarbeiterStatistik(mitarbeiterId);
      const jahrStr = jahr.toString();

      const [urlaubR, krankheitR, schulungR, ueberstundenR] = await Promise.all([
        this.dataManager.db.query(
          `SELECT 'urlaub' as typ, von_datum, bis_datum, tage as wert, notiz, NULL as titel
           FROM urlaub WHERE mitarbeiter_id = ? AND strftime('%Y', von_datum) = ? ORDER BY von_datum`,
          [mitarbeiterId, jahrStr]
        ),
        this.dataManager.db.query(
          `SELECT 'krankheit' as typ, von_datum, bis_datum, tage as wert, notiz, NULL as titel
           FROM krankheit WHERE mitarbeiter_id = ? AND strftime('%Y', von_datum) = ? ORDER BY von_datum`,
          [mitarbeiterId, jahrStr]
        ),
        this.dataManager.db.query(
          `SELECT 'schulung' as typ, datum as von_datum, datum as bis_datum, dauer_tage as wert, notiz, titel
           FROM schulung WHERE mitarbeiter_id = ? AND strftime('%Y', datum) = ? ORDER BY datum`,
          [mitarbeiterId, jahrStr]
        ),
        this.dataManager.db.query(
          `SELECT 'ueberstunden' as typ, datum as von_datum, datum as bis_datum, stunden as wert, notiz, NULL as titel
           FROM ueberstunden WHERE mitarbeiter_id = ? AND strftime('%Y', datum) = ? ORDER BY datum`,
          [mitarbeiterId, jahrStr]
        ),
      ]);

      const alleEintraege = [
        ...(urlaubR.success      ? urlaubR.data      : []),
        ...(krankheitR.success   ? krankheitR.data   : []),
        ...(schulungR.success    ? schulungR.data    : []),
        ...(ueberstundenR.success ? ueberstundenR.data : []),
      ].sort((a, b) => (a.von_datum || '').localeCompare(b.von_datum || ''));

      const exportData = {
        employee:  { name: `${mitarbeiter.vorname} ${mitarbeiter.nachname}`, department: mitarbeiter.abteilung_name },
        jahr:      jahrStr,
        stats:     stat ? {
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
        showNotification('Erfolg', `Jahresübersicht ${jahr} exportiert`, 'success');
      } else {
        showNotification('Fehler', `PDF-Export fehlgeschlagen: ${result.error}`, 'danger');
      }
    } catch (error) {
      showNotification('Fehler', `PDF-Export fehlgeschlagen: ${error.message}`, 'danger');
    }
  }

  // ── Haupt-Dialog ────────────────────────────────────────────────────────────
  async zeigeDetails(mitarbeiterId, jahr = null, herkunft = 'urlaubsplaner') {
    this.herkunft = herkunft;
    jahr = jahr || this.dataManager.aktuellesJahr;

    const stat = await this.dataManager.getMitarbeiterStatistik(mitarbeiterId);
    if (!stat) { showNotification('Fehler', 'Mitarbeiter nicht gefunden', 'danger'); return; }

    const ma = stat.mitarbeiter;
    const eintraege           = await this._ladeAlleEintraege(mitarbeiterId, jahr);
    const alleEintraegeSortiert = this._kombiniereUndSortiereEintraege(eintraege);
    const ueberstundenDetails = await this.dataManager.getUeberstundenDetails(mitarbeiterId, jahr);
    const anzahlNachTyp       = this._zaehleEintraegeNachTyp(alleEintraegeSortiert);
    const abteilungsFarbe     = ma.abteilung_farbe || '#1f538d';

    const modalHtml = `
      <div class="modal fade" id="detailModal" tabindex="-1">
        <div class="modal-dialog modal-fullscreen">
          <div class="modal-content">
            <div class="modal-header text-white" style="background-color: ${abteilungsFarbe}">
              <h5 class="modal-title"><i class="bi bi-person-circle"></i> ${ma.vorname} ${ma.nachname}</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>

            <ul class="nav nav-tabs bg-dark px-3" id="detailTabs" role="tablist">
              <li class="nav-item" role="presentation">
                <button class="nav-link ${herkunft === 'stammdaten' ? 'active' : ''}"
                        id="stammdaten-tab" data-bs-toggle="tab" data-bs-target="#stammdaten"
                        type="button" role="tab" aria-selected="${herkunft === 'stammdaten'}">
                  <i class="bi bi-person-badge"></i> Stammdaten
                </button>
              </li>
              <li class="nav-item" role="presentation">
                <button class="nav-link ${herkunft === 'urlaubsplaner' ? 'active' : ''}"
                        id="urlaub-tab" data-bs-toggle="tab" data-bs-target="#urlaub"
                        type="button" role="tab" aria-selected="${herkunft === 'urlaubsplaner'}">
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
                              <div class="card-header"><h6 class="mb-0"><i class="bi bi-gear"></i> Aktionen</h6></div>
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
                              <div class="card-header"><h6 class="mb-0"><i class="bi bi-person"></i> Persönliche Daten</h6></div>
                              <div class="card-body">
                                <table class="table table-sm table-borderless mb-0">
                                  <tr><td class="text-muted" style="width:40%">Vorname:</td><td class="fw-bold">${ma.vorname}</td></tr>
                                  <tr><td class="text-muted">Nachname:</td><td class="fw-bold">${ma.nachname}</td></tr>
                                  ${ma.email ? `<tr><td class="text-muted">Email:</td><td><small>${ma.email}</small></td></tr>` : ''}
                                  ${ma.geburtsdatum ? `<tr><td class="text-muted">Geburtsdatum:</td><td>${formatDatumAnzeige(ma.geburtsdatum)}</td></tr>` : ''}
                                </table>
                              </div>
                            </div>
                            ${ma.adresse ? `
                            <div class="card bg-dark mb-3">
                              <div class="card-header"><h6 class="mb-0"><i class="bi bi-geo-alt"></i> Adresse</h6></div>
                              <div class="card-body"><div class="text-light" style="white-space:pre-line">${ma.adresse}</div></div>
                            </div>` : ''}
                            <div class="card bg-dark mb-3">
                              <div class="card-header clickable" data-bs-toggle="collapse" data-bs-target="#gehaltCollapse" style="cursor:pointer">
                                <div class="d-flex justify-content-between align-items-center">
                                  <h6 class="mb-0"><i class="bi bi-currency-euro"></i> Gehalt</h6>
                                  <i class="bi bi-chevron-down"></i>
                                </div>
                              </div>
                              <div id="gehaltCollapse" class="collapse">
                                <div class="card-body">
                                  ${ma.gehalt ? `<div class="text-center"><div class="display-6 fw-bold text-success">${formatWaehrung(ma.gehalt)} €</div><small class="text-muted">Bruttogehalt pro Monat</small></div>`
                                    : `<div class="text-center text-muted"><i class="bi bi-dash-circle fs-1 d-block mb-2"></i>Keine Gehaltsinformation hinterlegt</div>`}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div class="col-md-6">
                            <div class="card bg-dark mb-3">
                              <div class="card-header"><h6 class="mb-0"><i class="bi bi-briefcase"></i> Arbeitsbeziehung</h6></div>
                              <div class="card-body">
                                <table class="table table-sm table-borderless mb-0">
                                  <tr><td class="text-muted" style="width:40%">Abteilung:</td><td><span class="abteilung-badge" style="background-color:${ma.abteilung_farbe}">${ma.abteilung_name}</span></td></tr>
                                  <tr><td class="text-muted">Eintrittsdatum:</td><td>${formatDatumAnzeige(ma.eintrittsdatum)}</td></tr>
                                  ${ma.austrittsdatum ? `<tr><td class="text-muted">Austrittsdatum:</td><td><span class="badge bg-danger">${formatDatumAnzeige(ma.austrittsdatum)}</span></td></tr>` : ''}
                                  <tr><td class="text-muted">Status:</td><td><span class="badge ${ma.status === 'AKTIV' ? 'bg-success' : 'bg-secondary'}">${ma.status}</span></td></tr>
                                </table>
                              </div>
                            </div>
                            <div class="card bg-dark mb-3">
                              <div class="card-header"><h6 class="mb-0"><i class="bi bi-clock-history"></i> Arbeitszeit</h6></div>
                              <div class="card-body">
                                <table class="table table-sm table-borderless mb-0">
                                  <tr><td class="text-muted" style="width:40%">Wochenstunden:</td><td class="fw-bold">${ma.wochenstunden || 40}h</td></tr>
                                </table>
                                <div id="arbeitszeitmodellAnzeige" class="mt-2">
                                  <small class="text-muted d-block mb-1">Wochenplan:</small>
                                  <div class="text-muted small">Wird geladen...</div>
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

                <!-- TAB 2: URLAUBSPLANER -->
                <div class="tab-pane fade ${herkunft === 'urlaubsplaner' ? 'show active' : ''}" id="urlaub" role="tabpanel">
                  <div class="d-flex align-items-center justify-content-center gap-3 p-3 bg-dark border-bottom">
                    <button class="btn btn-outline-light btn-sm" id="btnVorigesJahr"><i class="bi bi-chevron-left"></i></button>
                    <h5 class="mb-0 fw-bold" style="min-width:100px;text-align:center">${jahr}</h5>
                    <button class="btn btn-outline-light btn-sm" id="btnNaechstesJahr"><i class="bi bi-chevron-right"></i></button>
                  </div>

                  <div class="row g-0" style="height: calc(100vh - 260px);">
                    <div class="col-md-4 border-end" style="overflow-y:auto;background-color:#1a1a1a;">
                      <div class="p-3">
                        <div class="card bg-dark mb-3">
                          <div class="card-header clickable" id="clickUrlaub" style="cursor:pointer">
                            <div class="d-flex justify-content-between align-items-center">
                              <h6 class="mb-0"><i class="bi bi-calendar-check text-success"></i> Urlaub ${jahr}</h6>
                              <i class="bi bi-plus-circle text-success"></i>
                            </div>
                          </div>
                          <div class="card-body">
                            <table class="table table-sm table-borderless mb-0">
                              <tr><td class="text-muted" style="width:50%">Anspruch:</td><td class="fw-bold">${formatZahl(stat.urlaubsanspruch)} Tage</td></tr>
                              <tr><td class="text-muted">Übertrag ${jahr-1}:</td>
                                <td><span class="clickable" id="clickUebertrag" style="cursor:pointer">${formatZahl(stat.uebertrag_original || stat.uebertrag_vorjahr)} Tage <i class="bi bi-pencil-square text-info ms-1"></i></span></td>
                              </tr>
                              ${stat.verfallen && stat.verfallen > 0 ? `<tr><td class="text-muted"><i class="bi bi-x-circle text-danger"></i> Verfallen (31.03.${jahr}):</td><td class="fw-bold text-danger">-${formatZahl(stat.verfallen)} Tage</td></tr>` : ''}
                              <tr><td class="text-muted">Verfallend (31.03.${jahr}):</td><td class="fw-bold" id="verfallendeTage"><span class="spinner-border spinner-border-sm" role="status"></span></td></tr>
                              <tr><td class="text-muted">Verfügbar:</td><td class="fw-bold text-info">${formatZahl(stat.urlaub_verfuegbar)} Tage</td></tr>
                              <tr><td class="text-muted">Genommen:</td><td class="fw-bold text-warning">${formatZahl(stat.urlaub_genommen)} Tage</td></tr>
                              <tr class="border-top"><td class="text-muted fw-bold">Resturlaub:</td>
                                <td class="fs-5 fw-bold ${stat.urlaub_rest < 0 ? 'text-danger' : stat.urlaub_rest < 5 ? 'text-warning' : 'text-success'}">${formatZahl(stat.urlaub_rest)} Tage</td>
                              </tr>
                            </table>
                          </div>
                        </div>

                        <div class="card bg-dark mb-3">
                          <div class="card-header clickable" id="clickUeberstunden" style="cursor:pointer">
                            <div class="d-flex justify-content-between align-items-center">
                              <h6 class="mb-0"><i class="bi bi-clock text-warning"></i> Überstunden ${jahr}</h6>
                              <i class="bi bi-plus-circle text-warning"></i>
                            </div>
                          </div>
                          <div class="card-body">
                            <table class="table table-sm table-borderless mb-0">
                              <tr><td class="text-muted" style="width:40%">Übertrag ${jahr-1}:</td><td class="fw-bold ${ueberstundenDetails.uebertrag >= 0 ? 'text-success' : 'text-danger'}">${ueberstundenDetails.uebertrag >= 0 ? '+' : ''}${formatZahl(ueberstundenDetails.uebertrag)}h</td></tr>
                              <tr><td class="text-muted">Gemacht ${jahr}:</td><td class="fw-bold text-success">+${formatZahl(ueberstundenDetails.gemacht)}h</td></tr>
                              <tr><td class="text-muted">Abgebaut ${jahr}:</td><td class="fw-bold text-danger">-${formatZahl(ueberstundenDetails.abgebaut)}h</td></tr>
                              <tr class="border-top"><td class="text-muted fw-bold">Saldo:</td>
                                <td class="fs-5 fw-bold ${ueberstundenDetails.saldo >= 0 ? 'text-success' : 'text-danger'}">${ueberstundenDetails.saldo >= 0 ? '+' : ''}${formatZahl(ueberstundenDetails.saldo)}h</td>
                              </tr>
                            </table>
                          </div>
                        </div>

                        <button class="btn btn-outline-danger btn-sm w-100" id="btnExportPDF">
                          <i class="bi bi-file-earmark-pdf-fill me-2"></i>Jahresübersicht exportieren
                        </button>
                      </div>
                    </div>

                    <div class="col-md-8" style="display:flex;flex-direction:column;">
                      <div class="p-3 border-bottom" style="flex-shrink:0;background-color:#2d2d2d;">
                        <div class="row g-3">
                          <div class="col-md-4">
                            <div class="card bg-dark h-100 clickable" id="clickKrankheit" style="cursor:pointer;border-left:3px solid #dc3545">
                              <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start">
                                  <div><div class="text-muted small mb-1"><i class="bi bi-bandaid"></i> Krankheit ${jahr}</div><div class="fs-3 fw-bold text-danger">${formatZahl(stat.krankheitstage)}</div><div class="text-muted small">Tage</div></div>
                                  <i class="bi bi-plus-circle fs-4 text-danger opacity-50"></i>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div class="col-md-4">
                            <div class="card bg-dark h-100 clickable" id="clickSchulung" style="cursor:pointer;border-left:3px solid #17a2b8">
                              <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start">
                                  <div><div class="text-muted small mb-1"><i class="bi bi-book"></i> Schulung ${jahr}</div><div class="fs-3 fw-bold text-info">${formatZahl(stat.schulungstage)}</div><div class="text-muted small">Tage</div></div>
                                  <i class="bi bi-plus-circle fs-4 text-info opacity-50"></i>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div class="col-md-4">
                            <div class="card bg-dark h-100" style="border-left:3px solid #6c757d">
                              <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start">
                                  <div><div class="text-muted small mb-1"><i class="bi bi-list-ul"></i> Alle Einträge</div><div class="fs-3 fw-bold">${alleEintraegeSortiert.length}</div><div class="text-muted small">Einträge insgesamt</div></div>
                                  <i class="bi bi-collection fs-4 opacity-50"></i>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style="flex:1;overflow-y:auto;background-color:#1a1a1a;">
                        <div class="p-3">
                          <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="mb-0"><i class="bi bi-list-ul"></i> Alle Einträge (${alleEintraegeSortiert.length})</h6>
                            <div class="btn-group btn-group-sm">
                              <button type="button" class="btn btn-outline-light sortierung-btn active" data-sort="desc" title="Neueste zuerst"><i class="bi bi-sort-down"></i></button>
                              <button type="button" class="btn btn-outline-light sortierung-btn" data-sort="asc" title="Älteste zuerst"><i class="bi bi-sort-up"></i></button>
                            </div>
                          </div>
                          <div class="d-flex gap-2 flex-wrap mb-3">
                            <button type="button" class="btn btn-sm btn-outline-secondary filter-btn active" data-filter="alle"><i class="bi bi-list"></i> Alle <span class="badge bg-secondary">${alleEintraegeSortiert.length}</span></button>
                            <button type="button" class="btn btn-sm btn-outline-success filter-btn" data-filter="urlaub"><i class="bi bi-calendar-check"></i> Urlaub <span class="badge bg-success">${anzahlNachTyp.urlaub}</span></button>
                            <button type="button" class="btn btn-sm btn-outline-danger filter-btn" data-filter="krankheit"><i class="bi bi-bandaid"></i> Krankheit <span class="badge bg-danger">${anzahlNachTyp.krankheit}</span></button>
                            <button type="button" class="btn btn-sm btn-outline-info filter-btn" data-filter="schulung"><i class="bi bi-book"></i> Schulung <span class="badge bg-info">${anzahlNachTyp.schulung}</span></button>
                            <button type="button" class="btn btn-sm btn-outline-warning filter-btn" data-filter="ueberstunden"><i class="bi bi-clock"></i> Überstunden <span class="badge bg-warning text-dark">${anzahlNachTyp.ueberstunden}</span></button>
                          </div>
                          <div id="eintraegeContainer">${this._renderAlleEintraege(alleEintraegeSortiert)}</div>
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

    document.querySelectorAll('.modal:not(.show)').forEach(m => {
      const i = bootstrap.Modal.getInstance(m);
      if (i) i.dispose();
      m.remove();
    });

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalElement = document.querySelector('#detailModal');
    const modal = new bootstrap.Modal(modalElement);

    this._initActionListeners(modalElement, mitarbeiterId, modal, jahr);
    this._initFilterUndSortierung(modalElement, alleEintraegeSortiert);
    this._initClickHandlers(modalElement, mitarbeiterId, modal, jahr);
    this._initJahrNavigation(modalElement, mitarbeiterId, modal, jahr);
    await this._ladeUndZeigeArbeitszeitmodell(mitarbeiterId);
    await this._ladeVerfallsinfo(modalElement, mitarbeiterId, jahr);

    modal.show();

    return new Promise(resolve => {
      modalElement.addEventListener('hidden.bs.modal', () => {
        modal.dispose();
        modalElement.remove();
        resolve();
      }, { once: true });
    });
  }

  // ── Jahr-Navigation ─────────────────────────────────────────────────────────
  _initJahrNavigation(modalElement, mitarbeiterId, modal, anzeigeJahr) {
    modalElement.querySelector('#btnVorigesJahr')?.addEventListener('click', () => {
      modal.hide();
      setTimeout(() => this.zeigeDetails(mitarbeiterId, anzeigeJahr - 1), 300);
    });
    modalElement.querySelector('#btnNaechstesJahr')?.addEventListener('click', () => {
      modal.hide();
      setTimeout(() => this.zeigeDetails(mitarbeiterId, anzeigeJahr + 1), 300);
    });
  }

  // ── Verfallsinfo ────────────────────────────────────────────────────────────
  async _ladeVerfallsinfo(modalElement, mitarbeiterId, jahr) {
    const zelle = modalElement.querySelector('#verfallendeTage');
    if (!zelle) return;
    try {
      const mitarbeiter = await this.dataManager.getMitarbeiter(mitarbeiterId);
      const verfaelltAktiv = mitarbeiter?.uebertrag_verfaellt !== undefined
        ? mitarbeiter.uebertrag_verfaellt === 1 : true;

      if (!verfaelltAktiv) {
        zelle.innerHTML = `<span class="text-success">0 Tage</span> <small class="text-muted">(kein Verfall)</small>`;
        return;
      }
      const info = await this.dataManager.getVerfallenderUrlaub(mitarbeiterId, jahr);
      zelle.innerHTML = `<span class="${info.verfaellt === 0 ? 'text-success' : 'text-danger'}">${formatZahl(info.verfaellt)} Tage</span>`;
    } catch {
      zelle.innerHTML = '<span class="text-muted">-</span>';
    }
  }

  // ── Click-Handler ───────────────────────────────────────────────────────────
  _initClickHandlers(modalElement, mitarbeiterId, modal, jahr) {
    const hide = () => modal.hide();
    const wieder = (herkunft) => setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr, herkunft || this.herkunft), 300);

    const bind = (id, fn) => modalElement.querySelector(`#${id}`)?.addEventListener('click', fn);

    bind('clickUrlaub', async () => { hide(); await dialogManager.zeigeUrlaubDialog(mitarbeiterId, async () => wieder()); });
    bind('clickUebertrag', async () => { hide(); await dialogManager.zeigeUebertragAnpassen(mitarbeiterId, async () => wieder()); });
    bind('clickKrankheit', async () => { hide(); await dialogManager.zeigeKrankDialog(mitarbeiterId, async () => wieder()); });
    bind('clickSchulung', async () => { hide(); await dialogManager.zeigeSchulungDialog(mitarbeiterId, async () => wieder()); });
    bind('clickUeberstunden', async () => { hide(); await dialogManager.zeigeUeberstundenDialog(mitarbeiterId, async () => wieder()); });
    bind('btnMitarbeiterBearbeiten', async () => { hide(); await dialogManager.zeigeStammdatenBearbeiten(mitarbeiterId, async () => wieder()); });
    bind('btnArbeitszeitmodell', async () => { hide(); await dialogManager.zeigeArbeitszeitmodell(mitarbeiterId, async () => wieder()); });
    bind('btnExportStammdatenPDF', async (e) => { e.preventDefault(); await this._exportMitarbeiterPDF(mitarbeiterId); });
    bind('btnExportPDF', async (e) => { e.preventDefault(); await this._exportJahresPDF(mitarbeiterId, jahr); });
  }

  // ── Filter & Sortierung ─────────────────────────────────────────────────────
  _initFilterUndSortierung(modalElement, alleEintraege) {
    const container = modalElement.querySelector('#eintraegeContainer');

    modalElement.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modalElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filterTyp = btn.dataset.filter;
        this._aktualisiereEintraegeListe(container, alleEintraege);
      });
    });

    modalElement.querySelectorAll('.sortierung-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modalElement.querySelectorAll('.sortierung-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.sortierung = btn.dataset.sort;
        this._aktualisiereEintraegeListe(container, alleEintraege);
      });
    });
  }

  _aktualisiereEintraegeListe(container, alleEintraege) {
    let gefiltert = this.filterTyp === 'alle' ? alleEintraege : alleEintraege.filter(e => e.typ === this.filterTyp);
    const sortiert = [...gefiltert].sort((a, b) => {
      const da = new Date(a.datumSort), db = new Date(b.datumSort);
      return this.sortierung === 'desc' ? db - da : da - db;
    });
    container.innerHTML = this._renderAlleEintraege(sortiert);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  _renderAlleEintraege(eintraege) {
    if (eintraege.length === 0) return `<div class="text-center text-muted py-5"><i class="bi bi-inbox fs-1 d-block mb-2"></i><p>Keine Einträge vorhanden</p></div>`;
    return `<div class="list-group list-group-flush">${eintraege.map(e => this._renderEintrag(e)).join('')}</div>`;
  }

  _renderEintrag(eintrag) {
    const cfg = this._getEintragConfig(eintrag.typ);
    let hauptInfo = '', nebenInfo = '';

    switch (eintrag.typ) {
      case 'urlaub':
      case 'krankheit':
        hauptInfo = `${formatDatumAnzeige(eintrag.von_datum)} - ${formatDatumAnzeige(eintrag.bis_datum)}`;
        nebenInfo = `<strong>${formatZahl(eintrag.tage)}</strong> Tage`;
        break;
      case 'schulung': {
        const start = new Date(eintrag.datum);
        const end   = new Date(start);
        end.setDate(end.getDate() + Math.floor(eintrag.dauer_tage) - 1);
        const endStr = end.toISOString().split('T')[0];
        hauptInfo = eintrag.datum === endStr ? formatDatumAnzeige(eintrag.datum) : `${formatDatumAnzeige(eintrag.datum)} - ${formatDatumAnzeige(endStr)}`;
        nebenInfo = `<strong>${formatZahl(eintrag.dauer_tage)}</strong> Tage`;
        break;
      }
      case 'ueberstunden':
        hauptInfo = formatDatumAnzeige(eintrag.datum);
        nebenInfo = `<strong>${eintrag.stunden >= 0 ? '+' : ''}${formatZahl(eintrag.stunden)}</strong> Std.`;
        break;
    }

    return `
      <div class="list-group-item list-group-item-action bg-dark border-secondary">
        <div class="d-flex w-100 justify-content-between align-items-start">
          <div class="flex-grow-1">
            <div class="d-flex align-items-center mb-1">
              <span class="badge ${cfg.badgeClass} me-2"><i class="${cfg.icon}"></i> ${cfg.label}</span>
              <span class="text-light">${hauptInfo}</span>
            </div>
            <div class="d-flex align-items-center">
              <span class="${cfg.textClass} me-3">${nebenInfo}</span>
              ${eintrag.titel ? `<span class="text-info"><i class="bi bi-tag"></i> ${eintrag.titel}</span>` : ''}
            </div>
            ${eintrag.notiz ? `<small class="text-muted d-block mt-1"><i class="bi bi-sticky"></i> ${eintrag.notiz}</small>` : ''}
          </div>
          <div class="btn-group btn-group-sm ms-2">
            <button class="btn btn-outline-primary btn-edit" data-id="${eintrag.id}" data-typ="${eintrag.typ}" title="Bearbeiten"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-outline-danger btn-delete" data-id="${eintrag.id}" data-typ="${eintrag.typ}" title="Löschen"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </div>`;
  }

  // ── Löschen / Bearbeiten ────────────────────────────────────────────────────
  _initActionListeners(modalElement, mitarbeiterId, modal, jahr) {
    modalElement.addEventListener('click', async (e) => {
      const del  = e.target.closest('.btn-delete');
      const edit = e.target.closest('.btn-edit');
      if (del)  await this._handleDelete(del,  mitarbeiterId, modal, jahr);
      if (edit) await this._handleEdit(edit, mitarbeiterId, modal, jahr);
    });
  }

  async _handleDelete(btn, mitarbeiterId, modal, jahr) {
    const id  = parseInt(btn.dataset.id);
    const typ = btn.dataset.typ;
    if (!confirm(`Möchten Sie diesen ${this._getTypLabel(typ)}-Eintrag wirklich löschen?`)) return;
    try {
      const result = await this.dataManager.db.run(`DELETE FROM ${typ === 'ueberstunden' ? 'ueberstunden' : typ} WHERE id = ?`, [id]);
      if (!result.success) throw new Error(result.error);
      showNotification('Erfolg', 'Eintrag wurde gelöscht', 'success');
      this.dataManager.invalidateCache();
      modal.hide();
      setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
    } catch (error) {
      showNotification('Fehler', error.message, 'danger');
    }
  }

  async _handleEdit(btn, mitarbeiterId, modal, jahr) {
    const id  = parseInt(btn.dataset.id);
    const typ = btn.dataset.typ;
    modal.hide();
    try {
      const cb = async () => setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
      if (typ === 'urlaub')       await this._zeigeBearbeitenModal(id, typ, cb);
      else if (typ === 'krankheit')    await this._zeigeBearbeitenModal(id, typ, cb);
      else if (typ === 'schulung')     await this._zeigeBearbeitenModal(id, typ, cb);
      else if (typ === 'ueberstunden') await this._zeigeBearbeitenModal(id, typ, cb);
    } catch (error) {
      showNotification('Fehler', error.message, 'danger');
      setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
    }
  }

  /**
   * AUFGERÄUMT: Vorher vier nahezu identische Methoden (_bearbeiteUrlaub,
   * _bearbeiteKrankheit, _bearbeiteSchulung, _bearbeiteUeberstunden) mit je
   * ~60 Zeilen Boilerplate. Jetzt eine generische Methode mit typ-spezifischer
   * Konfiguration.
   */
  async _zeigeBearbeitenModal(id, typ, callback) {
    const tabelleMap = { urlaub: 'urlaub', krankheit: 'krankheit', schulung: 'schulung', ueberstunden: 'ueberstunden' };
    const result = await this.dataManager.db.get(`SELECT * FROM ${tabelleMap[typ]} WHERE id = ?`, [id]);
    if (!result.success || !result.data) throw new Error('Eintrag nicht gefunden');
    const e = result.data;

    const configs = {
      urlaub: {
        titel:  'Urlaub bearbeiten',
        farbe:  'bg-success',
        felder: `
          <div class="row">
            <div class="col-md-6 mb-3"><label class="form-label">Von *</label><input type="date" class="form-control" id="f_von" value="${e.von_datum}" required></div>
            <div class="col-md-6 mb-3"><label class="form-label">Bis *</label><input type="date" class="form-control" id="f_bis" value="${e.bis_datum}" required></div>
          </div>
          <div class="mb-3"><label class="form-label">Urlaubstage *</label><input type="number" class="form-control" id="f_tage" value="${e.tage}" step="0.5" min="0.5" required></div>
          <div class="mb-3"><label class="form-label">Notiz</label><textarea class="form-control" id="f_notiz" rows="2">${e.notiz || ''}</textarea></div>`,
        btnClass: 'btn-success',
        save: async () => {
          const daten = { von_datum: document.getElementById('f_von').value, bis_datum: document.getElementById('f_bis').value, tage: parseFloat(document.getElementById('f_tage').value), notiz: document.getElementById('f_notiz').value || null };
          return this.dataManager.db.run('UPDATE urlaub SET von_datum=?, bis_datum=?, tage=?, notiz=? WHERE id=?', [daten.von_datum, daten.bis_datum, daten.tage, daten.notiz, id]);
        },
      },
      krankheit: {
        titel:  'Krankheit bearbeiten',
        farbe:  'bg-danger',
        felder: `
          <div class="row">
            <div class="col-md-6 mb-3"><label class="form-label">Von *</label><input type="date" class="form-control" id="f_von" value="${e.von_datum}" required></div>
            <div class="col-md-6 mb-3"><label class="form-label">Bis *</label><input type="date" class="form-control" id="f_bis" value="${e.bis_datum}" required></div>
          </div>
          <div class="mb-3"><label class="form-label">Krankheitstage *</label><input type="number" class="form-control" id="f_tage" value="${e.tage}" step="0.5" min="0.5" required></div>
          <div class="mb-3"><label class="form-label">Notiz</label><textarea class="form-control" id="f_notiz" rows="2">${e.notiz || ''}</textarea></div>`,
        btnClass: 'btn-danger',
        save: async () => {
          const daten = { von_datum: document.getElementById('f_von').value, bis_datum: document.getElementById('f_bis').value, tage: parseFloat(document.getElementById('f_tage').value), notiz: document.getElementById('f_notiz').value || null };
          return this.dataManager.db.run('UPDATE krankheit SET von_datum=?, bis_datum=?, tage=?, notiz=? WHERE id=?', [daten.von_datum, daten.bis_datum, daten.tage, daten.notiz, id]);
        },
      },
      schulung: {
        titel:  'Schulung bearbeiten',
        farbe:  'bg-info',
        felder: `
          <div class="mb-3"><label class="form-label">Datum *</label><input type="date" class="form-control" id="f_datum" value="${e.datum}" required></div>
          <div class="mb-3"><label class="form-label">Dauer (Tage) *</label><input type="number" class="form-control" id="f_dauer" value="${e.dauer_tage}" step="0.5" min="0.5" required></div>
          <div class="mb-3"><label class="form-label">Titel</label><input type="text" class="form-control" id="f_titel" value="${e.titel || ''}"></div>
          <div class="mb-3"><label class="form-label">Notiz</label><textarea class="form-control" id="f_notiz" rows="2">${e.notiz || ''}</textarea></div>`,
        btnClass: 'btn-info',
        save: async () => {
          const daten = { datum: document.getElementById('f_datum').value, dauer_tage: parseFloat(document.getElementById('f_dauer').value), titel: document.getElementById('f_titel').value || null, notiz: document.getElementById('f_notiz').value || null };
          return this.dataManager.db.run('UPDATE schulung SET datum=?, dauer_tage=?, titel=?, notiz=? WHERE id=?', [daten.datum, daten.dauer_tage, daten.titel, daten.notiz, id]);
        },
      },
      ueberstunden: {
        titel:  'Überstunden bearbeiten',
        farbe:  'bg-warning text-dark',
        felder: `
          <div class="mb-3"><label class="form-label">Datum *</label><input type="date" class="form-control" id="f_datum" value="${e.datum}" required></div>
          <div class="mb-3"><label class="form-label">Stunden *</label><input type="number" class="form-control" id="f_stunden" value="${e.stunden}" step="0.25" required><small class="text-muted">Positiv = Aufbau, Negativ = Abbau</small></div>
          <div class="mb-3"><label class="form-label">Notiz</label><textarea class="form-control" id="f_notiz" rows="2">${e.notiz || ''}</textarea></div>`,
        btnClass: 'btn-warning',
        save: async () => {
          const daten = { datum: document.getElementById('f_datum').value, stunden: parseFloat(document.getElementById('f_stunden').value), notiz: document.getElementById('f_notiz').value || null };
          return this.dataManager.db.run('UPDATE ueberstunden SET datum=?, stunden=?, notiz=? WHERE id=?', [daten.datum, daten.stunden, daten.notiz, id]);
        },
      },
    };

    const cfg = configs[typ];
    const modalHtml = `
      <div class="modal fade" id="bearbeitenModal_${typ}" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header ${cfg.farbe}">
              <h5 class="modal-title"><i class="bi bi-pencil"></i> ${cfg.titel}</h5>
              <button type="button" class="btn-close ${cfg.farbe.includes('warning') ? '' : 'btn-close-white'}" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body"><form id="bearbeitenForm">${cfg.felder}</form></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
              <button type="button" class="btn ${cfg.btnClass}" id="btnSpeichern"><i class="bi bi-check-lg"></i> Speichern</button>
            </div>
          </div>
        </div>
      </div>`;

    await this.showModal(modalHtml, async () => {
      const form = document.getElementById('bearbeitenForm');
      if (!form.checkValidity()) { form.reportValidity(); return false; }
      const updateResult = await cfg.save();
      if (!updateResult.success) throw new Error(updateResult.error);
      this.dataManager.invalidateCache();
      showNotification('Erfolg', `${this._getTypLabel(typ)} wurde aktualisiert`, 'success');
      if (callback) await callback();
      return true;
    });
  }

  // ── Hilfsmethoden ───────────────────────────────────────────────────────────
  _getEintragConfig(typ) {
    return {
      urlaub:       { label: 'Urlaub',      icon: 'bi bi-calendar-check', badgeClass: 'bg-success',          textClass: 'text-success' },
      krankheit:    { label: 'Krankheit',   icon: 'bi bi-bandaid',        badgeClass: 'bg-danger',           textClass: 'text-danger'  },
      schulung:     { label: 'Schulung',    icon: 'bi bi-book',           badgeClass: 'bg-info',             textClass: 'text-info'    },
      ueberstunden: { label: 'Überstunden', icon: 'bi bi-clock',          badgeClass: 'bg-warning text-dark',textClass: 'text-warning' },
    }[typ] || { label: typ, icon: 'bi bi-question', badgeClass: 'bg-secondary', textClass: '' };
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
    const [u, k, s, ue] = await Promise.all([
      this.dataManager.db.query(`SELECT * FROM urlaub      WHERE mitarbeiter_id = ? AND strftime('%Y', von_datum) = ? ORDER BY von_datum DESC`, [mitarbeiterId, j]),
      this.dataManager.db.query(`SELECT * FROM krankheit   WHERE mitarbeiter_id = ? AND strftime('%Y', von_datum) = ? ORDER BY von_datum DESC`, [mitarbeiterId, j]),
      this.dataManager.db.query(`SELECT * FROM schulung    WHERE mitarbeiter_id = ? AND strftime('%Y', datum)     = ? ORDER BY datum DESC`,     [mitarbeiterId, j]),
      this.dataManager.db.query(`SELECT * FROM ueberstunden WHERE mitarbeiter_id = ? AND strftime('%Y', datum)    = ? ORDER BY datum DESC`,     [mitarbeiterId, j]),
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
      ...eintraege.urlaub.map(e       => ({ typ: 'urlaub',       datumSort: e.von_datum, ...e })),
      ...eintraege.krankheit.map(e    => ({ typ: 'krankheit',    datumSort: e.von_datum, ...e })),
      ...eintraege.schulung.map(e     => ({ typ: 'schulung',     datumSort: e.datum,     ...e })),
      ...eintraege.ueberstunden.map(e => ({ typ: 'ueberstunden', datumSort: e.datum,     ...e })),
    ];
    return alle.sort((a, b) => new Date(b.datumSort) - new Date(a.datumSort));
  }

  async _ladeUndZeigeArbeitszeitmodell(mitarbeiterId) {
    const container = document.getElementById('arbeitszeitmodellAnzeige');
    if (!container) return;
    try {
      const modell = await this.dataManager.getArbeitszeitmodell(mitarbeiterId);
      const wt     = ['Mo','Di','Mi','Do','Fr','Sa','So'];
      const labels = { VOLL: 'ganz', HALB: 'halb', FREI: 'frei' };
      const colors = { VOLL: 'text-success', HALB: 'text-warning', FREI: 'text-muted' };

      let zeilen = '';
      if (modell.length === 0) {
        zeilen = `Mo-Fr: <span class="text-success">ganz</span><br>Sa-So: <span class="text-muted">frei</span>`;
      } else {
        const gruppen = [];
        let aktGruppe = null;
        for (let i = 0; i < 7; i++) {
          const az = (modell.find(m => m.wochentag === i) || { arbeitszeit: i < 5 ? 'VOLL' : 'FREI' }).arbeitszeit;
          if (!aktGruppe || aktGruppe.az !== az) { if (aktGruppe) gruppen.push(aktGruppe); aktGruppe = { start: i, end: i, az }; }
          else aktGruppe.end = i;
        }
        if (aktGruppe) gruppen.push(aktGruppe);
        zeilen = gruppen.map((g, idx) =>
          `${g.start === g.end ? wt[g.start] : `${wt[g.start]}-${wt[g.end]}`}: <span class="${colors[g.az]}">${labels[g.az]}</span>${idx < gruppen.length - 1 ? '<br>' : ''}`
        ).join('');
      }

      container.innerHTML = `<small class="text-muted d-block mb-1">Wochenplan:</small><div class="text-light small" style="line-height:1.6">${zeilen}</div>`;
    } catch {
      container.innerHTML = `<small class="text-muted d-block mb-1">Wochenplan:</small><div class="text-muted small">Standard: Mo-Fr ganz</div>`;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = DetailDialog;