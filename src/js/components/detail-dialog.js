/**
 * Detail-Dialog
 * Zeigt alle Einträge eines Mitarbeiters für ein Jahr an
 * Ermöglicht das Bearbeiten und Löschen von Einträgen
 * 
 * UPDATE:
 * - Tab 1: Stammdaten (Persönliche Daten, Arbeitsbeziehung, Arbeitszeit, Buttons)
 * - Tab 2: Urlaubsplaner (mit Jahresauswahl oben)
 * - Header-Farbe = Abteilungsfarbe
 */

class DetailDialog extends DialogBase {
  constructor(dataManager) {
    super(dataManager);
    this.filterTyp = 'alle';
    this.sortierung = 'desc';
    this.herkunft = 'urlaubsplaner'; 
  }

  /**
   * Zeigt Detail-Dialog für einen Mitarbeiter
   */
async zeigeDetails(mitarbeiterId, jahr = null, herkunft = 'urlaubsplaner') {
     this.herkunft = herkunft;

      jahr = jahr || this.dataManager.aktuellesJahr;
    
    const stat = await this.dataManager.getMitarbeiterStatistik(mitarbeiterId);
    if (!stat) {
      showNotification('Fehler', 'Mitarbeiter nicht gefunden', 'danger');
      return;
    }

    const ma = stat.mitarbeiter;
    const eintraege = await this._ladeAlleEintraege(mitarbeiterId, jahr);
    const alleEintraegeSortiert = this._kombiniereUndSortiereEintraege(eintraege);
    const ueberstundenDetails = await this.dataManager.getUeberstundenDetails(mitarbeiterId, jahr);
    const anzahlNachTyp = this._zaehleEintraegeNachTyp(alleEintraegeSortiert);

    // ABTEILUNGSFARBE
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
            type="button" 
            role="tab" 
            aria-selected="${herkunft === 'stammdaten' ? 'true' : 'false'}">
      <i class="bi bi-person-badge"></i> Stammdaten
    </button>
  </li>
  <li class="nav-item" role="presentation">
    <button class="nav-link ${herkunft === 'urlaubsplaner' ? 'active' : ''}" 
            id="urlaub-tab" 
            data-bs-toggle="tab" 
            data-bs-target="#urlaub" 
            type="button" 
            role="tab" 
            aria-selected="${herkunft === 'urlaubsplaner' ? 'true' : 'false'}">
      <i class="bi bi-calendar-check"></i> Urlaubsplaner
    </button>
  </li>
</ul>

            <div class="modal-body p-0">
              <div class="tab-content" id="detailTabContent">
                
                <!-- TAB 1: STAMMDATEN -->
                <div class="tab-pane fade ${herkunft === 'stammdaten' ? 'show active' : ''}" id="stammdaten" role="tabpanel">                  <div class="row g-0" style="height: calc(100vh - 180px);">
                    <div class="col-md-12" style="overflow-y: auto; background-color: #1a1a1a;">
                      <div class="p-4">
                        
                        <div class="row">
                          <div class="col-md-6">
                            <!-- Buttons -->
                            <div class="d-flex gap-2 mb-3">
                              <button class="btn btn-outline-primary w-100" id="btnMitarbeiterBearbeiten">
                                <i class="bi bi-pencil"></i> Bearbeiten
                              </button>
                              <div class="btn-group">
                                <button type="button" class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">
                                  <i class="bi bi-download"></i>
                                </button>
                                <ul class="dropdown-menu">
                                  <li><a class="dropdown-item" href="#" id="btnExportExcel">
                                    <i class="bi bi-file-earmark-excel text-success"></i> Excel
                                  </a></li>
                                  <li><a class="dropdown-item" href="#" id="btnExportPDF">
                                    <i class="bi bi-file-earmark-pdf text-danger"></i> PDF
                                  </a></li>
                                </ul>
                              </div>
                            </div>

                            <!-- Persönliche Daten -->
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
                                  </tr>
                                  ` : ''}
                                  ${ma.geburtsdatum ? `
                                  <tr>
                                    <td class="text-muted">Geburtsdatum:</td>
                                    <td>${formatDatumAnzeige(ma.geburtsdatum)}</td>
                                  </tr>
                                  ` : ''}
                                </table>
                              </div>
                            </div>

                            <!-- Arbeitsbeziehung -->
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
                                    <td>
                                      <span class="badge bg-danger">${formatDatumAnzeige(ma.austrittsdatum)}</span>
                                    </td>
                                  </tr>
                                  ` : ''}
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
                          </div>

                          <div class="col-md-6">
                            <!-- Arbeitszeit -->
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
                                  <div class="text-muted small" style="line-height: 1.6;">
                                    Wird geladen...
                                  </div>
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
                  <!-- JAHRESAUSWAHL OBEN -->
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
                    
                    <!-- LINKE SPALTE: Urlaub & Überstunden -->
                    <div class="col-md-4 border-end" style="overflow-y: auto; background-color: #1a1a1a;">
                      <div class="p-3">
                        
                        <!-- Urlaub ${jahr} -->
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
                                <td class="text-muted" style="width: 40%;">Anspruch:</td>
                                <td class="fw-bold">${formatZahl(stat.urlaubsanspruch)} Tage</td>
                              </tr>
                              <tr>
                                <td class="text-muted">Übertrag ${jahr-1}:</td>
                                <td>
                                  <span class="clickable" id="clickUebertrag" style="cursor: pointer;" title="Klicken zum Anpassen">
                                    ${formatZahl(stat.uebertrag_vorjahr)} Tage
                                    <i class="bi bi-pencil-square text-info ms-1"></i>
                                  </span>
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

                        <!-- Überstunden ${jahr} -->
                        <div class="card bg-dark">
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

                      </div>
                    </div>

                    <!-- RECHTE SPALTE: Statistik oben + Einträge unten -->
                    <div class="col-md-8" style="display: flex; flex-direction: column;">
                      
                      <!-- Statistik horizontal (oben, fixes Layout) -->
                      <div class="p-3 border-bottom" style="flex-shrink: 0; background-color: #2d2d2d;">
                        <div class="row g-3">
                          <!-- Krankheit -->
                          <div class="col-md-4">
                            <div class="card bg-dark h-100 clickable" id="clickKrankheit" style="cursor: pointer; border-left: 3px solid #dc3545;">
                              <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start">
                                  <div>
                                    <div class="text-muted small mb-1">
                                      <i class="bi bi-bandaid"></i> Krankheit ${jahr}
                                    </div>
                                    <div class="fs-3 fw-bold text-danger">${formatZahl(stat.krankheitstage)}</div>
                                    <div class="text-muted small">Tage</div>
                                  </div>
                                  <i class="bi bi-plus-circle fs-4 text-danger opacity-50"></i>
                                </div>
                              </div>
                            </div>
                          </div>

                          <!-- Schulung -->
                          <div class="col-md-4">
                            <div class="card bg-dark h-100 clickable" id="clickSchulung" style="cursor: pointer; border-left: 3px solid #17a2b8;">
                              <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start">
                                  <div>
                                    <div class="text-muted small mb-1">
                                      <i class="bi bi-book"></i> Schulung ${jahr}
                                    </div>
                                    <div class="fs-3 fw-bold text-info">${formatZahl(stat.schulungstage)}</div>
                                    <div class="text-muted small">Tage</div>
                                  </div>
                                  <i class="bi bi-plus-circle fs-4 text-info opacity-50"></i>
                                </div>
                              </div>
                            </div>
                          </div>

                          <!-- Gesamt Einträge -->
                          <div class="col-md-4">
                            <div class="card bg-dark h-100" style="border-left: 3px solid #6c757d;">
                              <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start">
                                  <div>
                                    <div class="text-muted small mb-1">
                                      <i class="bi bi-list-ul"></i> Alle Einträge
                                    </div>
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

                      <!-- Einträge-Liste (unten, scrollbar) -->
                      <div style="flex: 1; overflow-y: auto; background-color: #1a1a1a;">
                        <div class="p-3">
                          <!-- Toolbar -->
                          <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="mb-0">
                              <i class="bi bi-list-ul"></i> Alle Einträge (${alleEintraegeSortiert.length})
                            </h6>
                            <div class="d-flex gap-2">
                              <!-- Sortierung -->
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

                          <!-- Filter Buttons -->
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

                          <!-- Einträge Container -->
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

    // Event-Listener
    this._initActionListeners(modalElement, mitarbeiterId, modal, jahr);
    this._initFilterUndSortierung(modalElement, alleEintraegeSortiert);
    this._initClickHandlers(modalElement, mitarbeiterId, modal, jahr);
    this._initJahrNavigation(modalElement, mitarbeiterId, modal, jahr);

    // Lade und zeige Arbeitszeitmodell
    await this._ladeUndZeigeArbeitszeitmodell(mitarbeiterId);

    modal.show();

    return new Promise((resolve) => {
      modalElement.addEventListener('hidden.bs.modal', () => {
        modal.dispose();
        modalElement.remove();
        resolve();
      }, { once: true });
    });
  }


  /**
   * NEU: Initialisiert Jahr-Navigation Buttons
   * FIX: Jahr wird jetzt explizit übergeben statt aus dataManager zu lesen
   */
  _initJahrNavigation(modalElement, mitarbeiterId, modal, anzeigeJahr) {
    const btnVoriges = modalElement.querySelector('#btnVorigesJahr');
    const btnNaechstes = modalElement.querySelector('#btnNaechstesJahr');

    if (btnVoriges) {
      btnVoriges.addEventListener('click', async () => {
        modal.hide();
        setTimeout(() => {
          this.zeigeDetails(mitarbeiterId, anzeigeJahr - 1);
        }, 300);
      });
    }

    if (btnNaechstes) {
      btnNaechstes.addEventListener('click', async () => {
        modal.hide();
        setTimeout(() => {
          this.zeigeDetails(mitarbeiterId, anzeigeJahr + 1);
        }, 300);
      });
    }
  }

  /**
   * Initialisiert Click-Handler für KPI-Karten und Buttons
   * FIX: Kehrt nach Aktion zur Detailansicht zurück
   */
  _initClickHandlers(modalElement, mitarbeiterId, modal, jahr) {
    // Urlaub eintragen
    const clickUrlaub = modalElement.querySelector('#clickUrlaub');
    if (clickUrlaub) {
      clickUrlaub.addEventListener('click', async () => {
        modal.hide();
        if (typeof dialogManager !== 'undefined') {
          await dialogManager.zeigeUrlaubDialog(mitarbeiterId, async () => {
            // Nach Speichern: Detailansicht wieder öffnen
            setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
          });
        }
      });
    }

    // Übertrag anpassen
    const clickUebertrag = modalElement.querySelector('#clickUebertrag');
    if (clickUebertrag) {
      clickUebertrag.addEventListener('click', async () => {
        modal.hide();
        if (typeof dialogManager !== 'undefined') {
          await dialogManager.zeigeUebertragAnpassen(mitarbeiterId, async () => {
            // Nach Speichern: Detailansicht wieder öffnen
            setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
          });
        }
      });
    }

    // Krankheit eintragen
    const clickKrankheit = modalElement.querySelector('#clickKrankheit');
    if (clickKrankheit) {
      clickKrankheit.addEventListener('click', async () => {
        modal.hide();
        if (typeof dialogManager !== 'undefined') {
          await dialogManager.zeigeKrankDialog(mitarbeiterId, async () => {
            // Nach Speichern: Detailansicht wieder öffnen
            setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
          });
        }
      });
    }

    // Schulung eintragen
    const clickSchulung = modalElement.querySelector('#clickSchulung');
    if (clickSchulung) {
      clickSchulung.addEventListener('click', async () => {
        modal.hide();
        if (typeof dialogManager !== 'undefined') {
          await dialogManager.zeigeSchulungDialog(mitarbeiterId, async () => {
            // Nach Speichern: Detailansicht wieder öffnen
            setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
          });
        }
      });
    }

    // Überstunden eintragen
    const clickUeberstunden = modalElement.querySelector('#clickUeberstunden');
    if (clickUeberstunden) {
      clickUeberstunden.addEventListener('click', async () => {
        modal.hide();
        if (typeof dialogManager !== 'undefined') {
          await dialogManager.zeigeUeberstundenDialog(mitarbeiterId, async () => {
            // Nach Speichern: Detailansicht wieder öffnen
            setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
          });
        }
      });
    }

    // Mitarbeiter bearbeiten
    const btnBearbeiten = modalElement.querySelector('#btnMitarbeiterBearbeiten');
    if (btnBearbeiten) {
      btnBearbeiten.addEventListener('click', async () => {
        modal.hide();
        if (typeof dialogManager !== 'undefined') {
          await dialogManager.zeigeStammdatenBearbeiten(mitarbeiterId, async () => {
            // Nach Speichern: Detailansicht wieder öffnen
            setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
          });
        }
      });
    }

    // Arbeitszeitmodell
    const btnArbeitszeitmodell = modalElement.querySelector('#btnArbeitszeitmodell');
    if (btnArbeitszeitmodell) {
      btnArbeitszeitmodell.addEventListener('click', async () => {
        modal.hide();
        if (typeof dialogManager !== 'undefined') {
          await dialogManager.zeigeArbeitszeitmodell(mitarbeiterId, async () => {
            // Nach Speichern: Detailansicht wieder öffnen
            setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
          });
        }
      });
    }

    // Export-Buttons
    const btnExportExcel = modalElement.querySelector('#btnExportExcel');
    if (btnExportExcel) {
      btnExportExcel.addEventListener('click', async (e) => {
        e.preventDefault();
        showNotification('Info', 'Excel-Export in Entwicklung', 'info');
      });
    }

    const btnExportPDF = modalElement.querySelector('#btnExportPDF');
    if (btnExportPDF) {
      btnExportPDF.addEventListener('click', async (e) => {
        e.preventDefault();
        showNotification('Info', 'PDF-Export in Entwicklung', 'info');
      });
    }
  }

  /**
   * Initialisiert Filter und Sortierung
   */
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

  /**
   * Aktualisiert die Einträge-Liste
   */
  _aktualisiereEintraegeListe(container, alleEintraege) {
    let gefiltert = alleEintraege;
    if (this.filterTyp !== 'alle') {
      gefiltert = alleEintraege.filter(e => e.typ === this.filterTyp);
    }

    const sortiert = [...gefiltert].sort((a, b) => {
      const dateA = new Date(a.datumSort);
      const dateB = new Date(b.datumSort);
      return this.sortierung === 'desc' ? dateB - dateA : dateA - dateB;
    });

    container.innerHTML = this._renderAlleEintraege(sortiert);
    this._initActionListenersForContainer(container, null, null, null);
  }

  /**
   * Rendert alle Einträge als Liste
   */
  _renderAlleEintraege(eintraege) {
    if (eintraege.length === 0) {
      return `
        <div class="text-center text-muted py-5">
          <i class="bi bi-inbox fs-1 d-block mb-2"></i>
          <p>Keine Einträge vorhanden</p>
        </div>
      `;
    }

    return `
      <div class="list-group list-group-flush">
        ${eintraege.map(e => this._renderEintrag(e)).join('')}
      </div>
    `;
  }

  /**
   * Rendert einen einzelnen Eintrag
   * FIX: End-Datum bei Schulungen wird jetzt angezeigt
   */
  _renderEintrag(eintrag) {
    const config = this._getEintragConfig(eintrag.typ);
    
    let hauptInfo = '';
    let nebenInfo = '';

    switch (eintrag.typ) {
      case 'urlaub':
        hauptInfo = `${formatDatumAnzeige(eintrag.von_datum)} - ${formatDatumAnzeige(eintrag.bis_datum)}`;
        nebenInfo = `<strong>${formatZahl(eintrag.tage)}</strong> Tage`;
        break;
      case 'krankheit':
        hauptInfo = `${formatDatumAnzeige(eintrag.von_datum)} - ${formatDatumAnzeige(eintrag.bis_datum)}`;
        nebenInfo = `<strong>${formatZahl(eintrag.tage)}</strong> Tage`;
        break;
      case 'schulung':
        // FIX: End-Datum berechnen und anzeigen
        const startDatum = new Date(eintrag.datum);
        const endDatum = new Date(startDatum);
        endDatum.setDate(endDatum.getDate() + Math.floor(eintrag.dauer_tage) - 1);
        const endDatumStr = endDatum.toISOString().split('T')[0];
        
        // Wenn Start = Ende, nur ein Datum anzeigen
        if (eintrag.datum === endDatumStr) {
          hauptInfo = formatDatumAnzeige(eintrag.datum);
        } else {
          hauptInfo = `${formatDatumAnzeige(eintrag.datum)} - ${formatDatumAnzeige(endDatumStr)}`;
        }
        nebenInfo = `<strong>${formatZahl(eintrag.dauer_tage)}</strong> Tage`;
        break;
      case 'ueberstunden':
        hauptInfo = formatDatumAnzeige(eintrag.datum);
        const vorzeichen = eintrag.stunden >= 0 ? '+' : '';
        nebenInfo = `<strong>${vorzeichen}${formatZahl(eintrag.stunden)}</strong> Std.`;
        break;
    }

    return `
      <div class="list-group-item list-group-item-action bg-dark border-secondary">
        <div class="d-flex w-100 justify-content-between align-items-start">
          <div class="flex-grow-1">
            <div class="d-flex align-items-center mb-1">
              <span class="badge ${config.badgeClass} me-2">
                <i class="${config.icon}"></i> ${config.label}
              </span>
              <span class="text-light">${hauptInfo}</span>
            </div>
            <div class="d-flex align-items-center">
              <span class="${config.textClass} me-3">${nebenInfo}</span>
              ${eintrag.titel ? `<span class="text-info"><i class="bi bi-tag"></i> ${eintrag.titel}</span>` : ''}
            </div>
            ${eintrag.notiz ? `
              <small class="text-muted d-block mt-1">
                <i class="bi bi-sticky"></i> ${eintrag.notiz}
              </small>
            ` : ''}
          </div>
          <div class="btn-group btn-group-sm ms-2">
            <button class="btn btn-outline-primary btn-edit" 
                    data-id="${eintrag.id}" 
                    data-typ="${eintrag.typ}" 
                    title="Bearbeiten">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger btn-delete" 
                    data-id="${eintrag.id}" 
                    data-typ="${eintrag.typ}" 
                    title="Löschen">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Initialisiert Event-Listener für Aktionen
   * FIX: Kehrt nach Bearbeitung/Löschen zur Detailansicht zurück
   */
  _initActionListeners(modalElement, mitarbeiterId, modal, jahr) {
    modalElement.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('.btn-delete');
      const editBtn = e.target.closest('.btn-edit');
      
      if (deleteBtn) {
        await this._handleDelete(deleteBtn, mitarbeiterId, modal, jahr);
      } else if (editBtn) {
        await this._handleEdit(editBtn, mitarbeiterId, modal, jahr);
      }
    });
  }

  _initActionListenersForContainer(container, mitarbeiterId, modal, jahr) {
    // Implementierung für Container-spezifische Listener
  }

  async _handleDelete(deleteBtn, mitarbeiterId, modal, jahr) {
    const id = parseInt(deleteBtn.dataset.id);
    const typ = deleteBtn.dataset.typ;

    if (!confirm(`Möchten Sie diesen ${this._getTypLabel(typ)}-Eintrag wirklich löschen?`)) {
      return;
    }

    try {
      const tabelle = typ === 'ueberstunden' ? 'ueberstunden' : typ;
      const result = await this.dataManager.db.run(`DELETE FROM ${tabelle} WHERE id = ?`, [id]);

      if (!result.success) {
        throw new Error(result.error);
      }

      showNotification('Erfolg', 'Eintrag wurde gelöscht', 'success');
      this.dataManager.invalidateCache();
      
      // FIX: Kehre zur Detailansicht zurück
      modal.hide();
      setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      showNotification('Fehler', error.message, 'danger');
    }
  }

  async _handleEdit(editBtn, mitarbeiterId, modal, jahr) {
    const id = parseInt(editBtn.dataset.id);
    const typ = editBtn.dataset.typ;
    const von = editBtn.dataset.von;
    const bis = editBtn.dataset.bis;

    // Modal verstecken
    modal.hide();

    try {
      // Je nach Typ den entsprechenden Bearbeitungs-Dialog aufrufen
      // FIX: Callback öffnet Detailansicht wieder
      if (typ === 'urlaub') {
        await this._bearbeiteUrlaub(id, mitarbeiterId, von, bis, async () => {
          setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
        });
      } else if (typ === 'krankheit') {
        await this._bearbeiteKrankheit(id, mitarbeiterId, von, bis, async () => {
          setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
        });
      } else if (typ === 'schulung') {
        await this._bearbeiteSchulung(id, mitarbeiterId, async () => {
          setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
        });
      } else if (typ === 'ueberstunden') {
        await this._bearbeiteUeberstunden(id, mitarbeiterId, async () => {
          setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
        });
      }
    } catch (error) {
      console.error('Fehler beim Bearbeiten:', error);
      showNotification('Fehler', error.message, 'danger');
      // Bei Fehler auch zur Detailansicht zurück
      setTimeout(() => this.zeigeDetails(mitarbeiterId, jahr), 300);
    }
  }

  async _bearbeiteUrlaub(id, mitarbeiterId, vonDatum, bisDatum, callback) {
    const result = await this.dataManager.db.get('SELECT * FROM urlaub WHERE id = ?', [id]);
    if (!result.success || !result.data) {
      throw new Error('Urlaubseintrag nicht gefunden');
    }

    const eintrag = result.data;

    const modalHtml = `
      <div class="modal fade" id="urlaubBearbeitenModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-success text-white">
              <h5 class="modal-title">
                <i class="bi bi-pencil"></i> Urlaub bearbeiten
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="urlaubBearbeitenForm">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Von *</label>
                    <input type="date" class="form-control" id="vonDatum" value="${eintrag.von_datum}" required>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Bis *</label>
                    <input type="date" class="form-control" id="bisDatum" value="${eintrag.bis_datum}" required>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Urlaubstage *</label>
                  <input type="number" class="form-control" id="tage" value="${eintrag.tage}" step="0.5" min="0.5" required>
                </div>

                <div class="mb-3">
                  <label class="form-label">Notiz</label>
                  <textarea class="form-control" id="notiz" rows="2">${eintrag.notiz || ''}</textarea>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
              <button type="button" class="btn btn-success" id="btnSpeichern">
                <i class="bi bi-check-lg"></i> Speichern
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.showModal(modalHtml, async () => {
      const form = document.getElementById('urlaubBearbeitenForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const daten = {
        von_datum: document.getElementById('vonDatum').value,
        bis_datum: document.getElementById('bisDatum').value,
        tage: parseFloat(document.getElementById('tage').value),
        notiz: document.getElementById('notiz').value || null
      };

      try {
        const updateResult = await this.dataManager.db.run(`
          UPDATE urlaub 
          SET von_datum = ?, bis_datum = ?, tage = ?, notiz = ?
          WHERE id = ?
        `, [daten.von_datum, daten.bis_datum, daten.tage, daten.notiz, id]);

        if (!updateResult.success) {
          throw new Error(updateResult.error);
        }

        this.dataManager.invalidateCache();
        showNotification('Erfolg', 'Urlaub wurde aktualisiert', 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });
  }

  async _bearbeiteKrankheit(id, mitarbeiterId, vonDatum, bisDatum, callback) {
    const result = await this.dataManager.db.get('SELECT * FROM krankheit WHERE id = ?', [id]);
    if (!result.success || !result.data) {
      throw new Error('Krankheitseintrag nicht gefunden');
    }

    const eintrag = result.data;

    const modalHtml = `
      <div class="modal fade" id="krankheitBearbeitenModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-danger text-white">
              <h5 class="modal-title">
                <i class="bi bi-pencil"></i> Krankheit bearbeiten
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="krankheitBearbeitenForm">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Von *</label>
                    <input type="date" class="form-control" id="vonDatum" value="${eintrag.von_datum}" required>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Bis *</label>
                    <input type="date" class="form-control" id="bisDatum" value="${eintrag.bis_datum}" required>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Krankheitstage *</label>
                  <input type="number" class="form-control" id="tage" value="${eintrag.tage}" step="0.5" min="0.5" required>
                </div>

                <div class="mb-3">
                  <label class="form-label">Notiz</label>
                  <textarea class="form-control" id="notiz" rows="2">${eintrag.notiz || ''}</textarea>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
              <button type="button" class="btn btn-danger" id="btnSpeichern">
                <i class="bi bi-check-lg"></i> Speichern
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.showModal(modalHtml, async () => {
      const form = document.getElementById('krankheitBearbeitenForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const daten = {
        von_datum: document.getElementById('vonDatum').value,
        bis_datum: document.getElementById('bisDatum').value,
        tage: parseFloat(document.getElementById('tage').value),
        notiz: document.getElementById('notiz').value || null
      };

      try {
        const updateResult = await this.dataManager.db.run(`
          UPDATE krankheit 
          SET von_datum = ?, bis_datum = ?, tage = ?, notiz = ?
          WHERE id = ?
        `, [daten.von_datum, daten.bis_datum, daten.tage, daten.notiz, id]);

        if (!updateResult.success) {
          throw new Error(updateResult.error);
        }

        this.dataManager.invalidateCache();
        showNotification('Erfolg', 'Krankheit wurde aktualisiert', 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });
  }

  async _bearbeiteSchulung(id, mitarbeiterId, callback) {
    const result = await this.dataManager.db.get('SELECT * FROM schulung WHERE id = ?', [id]);
    if (!result.success || !result.data) {
      throw new Error('Schulungseintrag nicht gefunden');
    }

    const eintrag = result.data;

    const modalHtml = `
      <div class="modal fade" id="schulungBearbeitenModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-info text-white">
              <h5 class="modal-title">
                <i class="bi bi-pencil"></i> Schulung bearbeiten
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="schulungBearbeitenForm">
                <div class="mb-3">
                  <label class="form-label">Datum *</label>
                  <input type="date" class="form-control" id="datum" value="${eintrag.datum}" required>
                </div>

                <div class="mb-3">
                  <label class="form-label">Dauer (Tage) *</label>
                  <input type="number" class="form-control" id="dauerTage" value="${eintrag.dauer_tage}" step="0.5" min="0.5" required>
                </div>

                <div class="mb-3">
                  <label class="form-label">Titel</label>
                  <input type="text" class="form-control" id="titel" value="${eintrag.titel || ''}">
                </div>

                <div class="mb-3">
                  <label class="form-label">Notiz</label>
                  <textarea class="form-control" id="notiz" rows="2">${eintrag.notiz || ''}</textarea>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
              <button type="button" class="btn btn-info" id="btnSpeichern">
                <i class="bi bi-check-lg"></i> Speichern
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.showModal(modalHtml, async () => {
      const form = document.getElementById('schulungBearbeitenForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const daten = {
        datum: document.getElementById('datum').value,
        dauer_tage: parseFloat(document.getElementById('dauerTage').value),
        titel: document.getElementById('titel').value || null,
        notiz: document.getElementById('notiz').value || null
      };

      try {
        const updateResult = await this.dataManager.db.run(`
          UPDATE schulung 
          SET datum = ?, dauer_tage = ?, titel = ?, notiz = ?
          WHERE id = ?
        `, [daten.datum, daten.dauer_tage, daten.titel, daten.notiz, id]);

        if (!updateResult.success) {
          throw new Error(updateResult.error);
        }

        this.dataManager.invalidateCache();
        showNotification('Erfolg', 'Schulung wurde aktualisiert', 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });
  }

  async _bearbeiteUeberstunden(id, mitarbeiterId, callback) {
    const result = await this.dataManager.db.get('SELECT * FROM ueberstunden WHERE id = ?', [id]);
    if (!result.success || !result.data) {
      throw new Error('Überstundeneintrag nicht gefunden');
    }

    const eintrag = result.data;

    const modalHtml = `
      <div class="modal fade" id="ueberstundenBearbeitenModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-warning text-dark">
              <h5 class="modal-title">
                <i class="bi bi-pencil"></i> Überstunden bearbeiten
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="ueberstundenBearbeitenForm">
                <div class="mb-3">
                  <label class="form-label">Datum *</label>
                  <input type="date" class="form-control" id="datum" value="${eintrag.datum}" required>
                </div>

                <div class="mb-3">
                  <label class="form-label">Stunden *</label>
                  <input type="number" class="form-control" id="stunden" value="${eintrag.stunden}" step="0.25" required>
                  <small class="text-muted">Positive Werte = Aufbau, Negative Werte = Abbau</small>
                </div>

                <div class="mb-3">
                  <label class="form-label">Notiz</label>
                  <textarea class="form-control" id="notiz" rows="2">${eintrag.notiz || ''}</textarea>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
              <button type="button" class="btn btn-warning" id="btnSpeichern">
                <i class="bi bi-check-lg"></i> Speichern
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.showModal(modalHtml, async () => {
      const form = document.getElementById('ueberstundenBearbeitenForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const daten = {
        datum: document.getElementById('datum').value,
        stunden: parseFloat(document.getElementById('stunden').value),
        notiz: document.getElementById('notiz').value || null
      };

      try {
        const updateResult = await this.dataManager.db.run(`
          UPDATE ueberstunden 
          SET datum = ?, stunden = ?, notiz = ?
          WHERE id = ?
        `, [daten.datum, daten.stunden, daten.notiz, id]);

        if (!updateResult.success) {
          throw new Error(updateResult.error);
        }

        this.dataManager.invalidateCache();
        showNotification('Erfolg', 'Überstunden wurden aktualisiert', 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });
  }

  _getEintragConfig(typ) {
    const configs = {
      urlaub: {
        label: 'Urlaub',
        icon: 'bi bi-calendar-check',
        badgeClass: 'bg-success',
        textClass: 'text-success'
      },
      krankheit: {
        label: 'Krankheit',
        icon: 'bi bi-bandaid',
        badgeClass: 'bg-danger',
        textClass: 'text-danger'
      },
      schulung: {
        label: 'Schulung',
        icon: 'bi bi-book',
        badgeClass: 'bg-info',
        textClass: 'text-info'
      },
      ueberstunden: {
        label: 'Überstunden',
        icon: 'bi bi-clock',
        badgeClass: 'bg-warning text-dark',
        textClass: 'text-warning'
      }
    };
    return configs[typ] || configs.urlaub;
  }

  _getTypLabel(typ) {
    const labels = {
      urlaub: 'Urlaub',
      krankheit: 'Krankheit',
      schulung: 'Schulung',
      ueberstunden: 'Überstunden'
    };
    return labels[typ] || typ;
  }

  _zaehleEintraegeNachTyp(eintraege) {
    return {
      urlaub: eintraege.filter(e => e.typ === 'urlaub').length,
      krankheit: eintraege.filter(e => e.typ === 'krankheit').length,
      schulung: eintraege.filter(e => e.typ === 'schulung').length,
      ueberstunden: eintraege.filter(e => e.typ === 'ueberstunden').length
    };
  }

  async _ladeAlleEintraege(mitarbeiterId, jahr) {
    const jahrStr = jahr.toString();

    const urlaubResult = await this.dataManager.db.query(`
      SELECT * FROM urlaub 
      WHERE mitarbeiter_id = ? AND strftime('%Y', von_datum) = ?
      ORDER BY von_datum DESC
    `, [mitarbeiterId, jahrStr]);

    const krankheitResult = await this.dataManager.db.query(`
      SELECT * FROM krankheit 
      WHERE mitarbeiter_id = ? AND strftime('%Y', von_datum) = ?
      ORDER BY von_datum DESC
    `, [mitarbeiterId, jahrStr]);

    const schulungResult = await this.dataManager.db.query(`
      SELECT * FROM schulung 
      WHERE mitarbeiter_id = ? AND strftime('%Y', datum) = ?
      ORDER BY datum DESC
    `, [mitarbeiterId, jahrStr]);

    const ueberstundenResult = await this.dataManager.db.query(`
      SELECT * FROM ueberstunden 
      WHERE mitarbeiter_id = ? AND strftime('%Y', datum) = ?
      ORDER BY datum DESC
    `, [mitarbeiterId, jahrStr]);

    return {
      urlaub: urlaubResult.success ? urlaubResult.data : [],
      krankheit: krankheitResult.success ? krankheitResult.data : [],
      schulung: schulungResult.success ? schulungResult.data : [],
      ueberstunden: ueberstundenResult.success ? ueberstundenResult.data : []
    };
  }

  _kombiniereUndSortiereEintraege(eintraege) {
    const alle = [];

    eintraege.urlaub.forEach(e => {
      alle.push({
        typ: 'urlaub',
        datum: e.von_datum,
        datumSort: e.von_datum,
        ...e
      });
    });

    eintraege.krankheit.forEach(e => {
      alle.push({
        typ: 'krankheit',
        datum: e.von_datum,
        datumSort: e.von_datum,
        ...e
      });
    });

    eintraege.schulung.forEach(e => {
      alle.push({
        typ: 'schulung',
        datum: e.datum,
        datumSort: e.datum,
        ...e
      });
    });

    eintraege.ueberstunden.forEach(e => {
      alle.push({
        typ: 'ueberstunden',
        datum: e.datum,
        datumSort: e.datum,
        ...e
      });
    });

    alle.sort((a, b) => new Date(b.datumSort) - new Date(a.datumSort));
    return alle;
  }

  async _ladeUndZeigeArbeitszeitmodell(mitarbeiterId) {
    const container = document.getElementById('arbeitszeitmodellAnzeige');
    if (!container) return;

    try {
      const modell = await this.dataManager.getArbeitszeitmodell(mitarbeiterId);
      
      const wochentage = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
      const labels = {
        'VOLL': 'ganz',
        'HALB': 'halb',
        'FREI': 'frei'
      };

      let html = '<small class="text-muted d-block mb-1">Wochenplan:</small>';
      html += '<div class="text-light small" style="line-height: 1.6;">';

      if (modell.length === 0) {
        html += 'Mo-Fr: <span class="text-success">ganz</span><br>';
        html += 'Sa-So: <span class="text-muted">frei</span>';
      } else {
        const gruppen = [];
        let aktuelleGruppe = null;

        for (let i = 0; i < 7; i++) {
          const tagModell = modell.find(m => m.wochentag === i);
          const arbeitszeit = tagModell ? tagModell.arbeitszeit : (i < 5 ? 'VOLL' : 'FREI');

          if (!aktuelleGruppe || aktuelleGruppe.arbeitszeit !== arbeitszeit) {
            if (aktuelleGruppe) {
              gruppen.push(aktuelleGruppe);
            }
            aktuelleGruppe = {
              start: i,
              end: i,
              arbeitszeit: arbeitszeit
            };
          } else {
            aktuelleGruppe.end = i;
          }
        }
        
        if (aktuelleGruppe) {
          gruppen.push(aktuelleGruppe);
        }

        gruppen.forEach((gruppe, index) => {
          const label = labels[gruppe.arbeitszeit] || gruppe.arbeitszeit.toLowerCase();
          const colorClass = gruppe.arbeitszeit === 'VOLL' ? 'text-success' : 
                            gruppe.arbeitszeit === 'HALB' ? 'text-warning' : 
                            'text-muted';
          
          if (gruppe.start === gruppe.end) {
            html += `${wochentage[gruppe.start]}: <span class="${colorClass}">${label}</span>`;
          } else {
            html += `${wochentage[gruppe.start]}-${wochentage[gruppe.end]}: <span class="${colorClass}">${label}</span>`;
          }
          
          if (index < gruppen.length - 1) {
            html += '<br>';
          }
        });
      }

      html += '</div>';
      container.innerHTML = html;

    } catch (error) {
      console.error('Fehler beim Laden des Arbeitszeitmodells:', error);
      container.innerHTML = `
        <small class="text-muted d-block mb-1">Wochenplan:</small>
        <div class="text-muted small">
          Standard: Mo-Fr ganz
        </div>
      `;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DetailDialog;
}