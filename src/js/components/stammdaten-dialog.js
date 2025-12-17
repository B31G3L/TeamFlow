/**
 * Stammdaten-Dialoge
 * Mitarbeiter hinzufügen, bearbeiten und verwalten
 * 
 * FIX: ID-Sanitierung für Umlaute und Sonderzeichen
 * NEU: Gesamtanzahl Mitarbeiter wird angezeigt
 * NEU: Arbeitszeitmodell Button hinzugefügt
 * NEU: Switch für Vollzeit (40h) / Angepasst
 */

class StammdatenDialog extends DialogBase {
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
   * Initialisiert den Arbeitszeit-Switch
   */
  _initArbeitszeitSwitch() {
    const switchElement = document.getElementById('arbeitszeitSwitch');
    const container = document.getElementById('angepassteStundenContainer');
    const label = document.getElementById('arbeitszeitLabel');
    const stundenInput = document.getElementById('wochenstunden');

    if (!switchElement || !container || !label || !stundenInput) return;

    const updateUI = () => {
      if (switchElement.checked) {
        // Vollzeit
        container.classList.add('d-none');
        label.innerHTML = '<i class="bi bi-check-circle text-success"></i> Vollzeit (40h)';
        stundenInput.value = 40;
      } else {
        // Angepasst
        container.classList.remove('d-none');
        const stunden = parseFloat(stundenInput.value) || 40;
        label.innerHTML = `<i class="bi bi-clock-history text-info"></i> Angepasst (${stunden}h)`;
      }
    };

    // Event-Listener für Switch
    switchElement.addEventListener('change', updateUI);

    // Event-Listener für Stunden-Input (aktualisiert Label)
    stundenInput.addEventListener('input', () => {
      if (!switchElement.checked) {
        const stunden = parseFloat(stundenInput.value) || 40;
        label.innerHTML = `<i class="bi bi-clock-history text-info"></i> Angepasst (${stunden}h)`;
      }
    });

    // Initial UI setzen
    updateUI();
  }

  /**
   * Zeigt Stammdaten Hinzufügen Dialog
   */
  async zeigeStammdatenHinzufuegen(callback) {
    const abteilungen = await this.dataManager.getAlleAbteilungen();

    const modalHtml = `
      <div class="modal fade" id="stammdatenModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-person-plus"></i> Neuer Mitarbeiter
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="stammdatenForm">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Vorname *</label>
                    <input type="text" class="form-control" id="vorname" required>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Nachname *</label>
                    <input type="text" class="form-control" id="nachname" required>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Abteilung *</label>
                  <select class="form-select" id="abteilung" required>
                    ${abteilungen.map(a => `<option value="${a.name}">${a.name}</option>`).join('')}
                  </select>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Geburtsdatum</label>
                    <input type="date" class="form-control" id="geburtsdatum">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Einstellungsdatum *</label>
                    <input type="date" class="form-control" id="einstellungsdatum" required>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Urlaubstage pro Jahr *</label>
                  <input type="number" class="form-control" id="urlaubstageJahr" value="30" min="0" max="50" required>
                </div>

                <!-- NEU: Arbeitszeit-Switch -->
                <div class="mb-3">
                  <label class="form-label">Arbeitszeit *</label>
                  <div class="d-flex align-items-center gap-3 mb-2">
                    <div class="form-check form-switch">
                      <input class="form-check-input" type="checkbox" id="arbeitszeitSwitch" checked>
                      <label class="form-check-label fw-bold" for="arbeitszeitSwitch" id="arbeitszeitLabel">
                        <i class="bi bi-check-circle text-success"></i> Vollzeit (40h)
                      </label>
                    </div>
                  </div>
                  
                  <!-- Angepasste Stunden (initial versteckt) -->
                  <div id="angepassteStundenContainer" class="d-none mt-2">
                    <div class="input-group">
                      <input type="number" class="form-control" id="wochenstunden" value="40" min="0" max="60" step="0.5" required>
                      <span class="input-group-text">Stunden/Woche</span>
                    </div>
                    <small class="text-muted">Geben Sie die individuelle Wochenstundenzahl ein</small>
                  </div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
              <button type="button" class="btn btn-primary" id="btnSpeichern">
                <i class="bi bi-check-lg"></i> Speichern
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.showModal(modalHtml, async () => {
      const form = document.getElementById('stammdatenForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const daten = {
        vorname: document.getElementById('vorname').value,
        nachname: document.getElementById('nachname').value,
        email: null,
        abteilung: document.getElementById('abteilung').value,
        geburtsdatum: document.getElementById('geburtsdatum').value || null,
        einstellungsdatum: document.getElementById('einstellungsdatum').value,
        urlaubstage_jahr: parseFloat(document.getElementById('urlaubstageJahr').value),
        wochenstunden: parseFloat(document.getElementById('wochenstunden').value)
      };

      // FIX: Generiere automatische ID mit Sanitierung
      const vornameClean = this._sanitizeForId(daten.vorname).substring(0, 3);
      const nachnameClean = this._sanitizeForId(daten.nachname).substring(0, 3);
      const timestamp = Date.now().toString().slice(-4);
      
      // Falls Name zu kurz, mit X auffüllen
      const vornamePadded = vornameClean.padEnd(3, 'X');
      const nachnamePadded = nachnameClean.padEnd(3, 'X');
      
      const mitarbeiterId = `${nachnamePadded}${vornamePadded}${timestamp}`;

      try {
        await this.dataManager.stammdatenHinzufuegen(mitarbeiterId, daten);
        showNotification('Erfolg', `${daten.vorname} ${daten.nachname} wurde hinzugefügt!`, 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });

    // Initialisiere Switch nach Modal-Animation
    setTimeout(() => {
      // Heutiges Datum als Standard
      const heute = new Date().toISOString().split('T')[0];
      const einstellungsdatumField = document.getElementById('einstellungsdatum');
      if (einstellungsdatumField) {
        einstellungsdatumField.value = heute;
      }

      // Initialisiere Arbeitszeit-Switch
      this._initArbeitszeitSwitch();
    }, 100);
  }

  /**
   * Zeigt Stammdaten Bearbeiten Dialog
   * NEU: Arbeitszeitmodell Button hinzugefügt
   * NEU: Switch für Vollzeit/Angepasst
   */
  async zeigeStammdatenBearbeiten(mitarbeiterId, callback) {
    const mitarbeiter = await this.dataManager.getMitarbeiter(mitarbeiterId);

    if (!mitarbeiter) {
      showNotification('Fehler', 'Mitarbeiter nicht gefunden', 'danger');
      return;
    }

    const abteilungen = await this.dataManager.getAlleAbteilungen();
    const wochenstunden = mitarbeiter.wochenstunden || 40;
    const istVollzeit = wochenstunden === 40;

    const modalHtml = `
      <div class="modal fade" id="stammdatenBearbeitenModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-pencil-square"></i> Mitarbeiter bearbeiten
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <!-- Arbeitszeitmodell-Karte -->
              <div class="alert alert-info d-flex justify-content-between align-items-center mb-3">
                <div>
                  <i class="bi bi-calendar-week"></i>
                  <strong>Arbeitszeitmodell</strong>
                  <div class="small text-muted mt-1">Detaillierter Wochenplan mit Halbtagen</div>
                </div>
                <button type="button" class="btn btn-sm btn-outline-info" id="btnArbeitszeitmodell">
                  <i class="bi bi-pencil"></i> Bearbeiten
                </button>
              </div>

              <form id="stammdatenBearbeitenForm">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Vorname *</label>
                    <input type="text" class="form-control" id="vorname" value="${mitarbeiter.vorname}" required>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Nachname *</label>
                    <input type="text" class="form-control" id="nachname" value="${mitarbeiter.nachname}" required>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Abteilung *</label>
                  <select class="form-select" id="abteilung" required>
                    ${abteilungen.map(a => `<option value="${a.name}" ${a.name === mitarbeiter.abteilung_name ? 'selected' : ''}>${a.name}</option>`).join('')}
                  </select>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Geburtsdatum</label>
                    <input type="date" class="form-control" id="geburtsdatum" value="${mitarbeiter.geburtsdatum || ''}">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Einstellungsdatum *</label>
                    <input type="date" class="form-control" id="einstellungsdatum" value="${mitarbeiter.eintrittsdatum}" required>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Urlaubstage pro Jahr *</label>
                  <input type="number" class="form-control" id="urlaubstageJahr" value="${mitarbeiter.urlaubstage_jahr}" min="0" max="50" required>
                </div>

                <!-- NEU: Arbeitszeit-Switch -->
                <div class="mb-3">
                  <label class="form-label">Arbeitszeit *</label>
                  <div class="d-flex align-items-center gap-3 mb-2">
                    <div class="form-check form-switch">
                      <input class="form-check-input" type="checkbox" id="arbeitszeitSwitch" ${istVollzeit ? 'checked' : ''}>
                      <label class="form-check-label fw-bold" for="arbeitszeitSwitch" id="arbeitszeitLabel">
                        ${istVollzeit ? '<i class="bi bi-check-circle text-success"></i> Vollzeit (40h)' : `<i class="bi bi-clock-history text-info"></i> Angepasst (${wochenstunden}h)`}
                      </label>
                    </div>
                  </div>
                  
                  <!-- Angepasste Stunden -->
                  <div id="angepassteStundenContainer" class="${istVollzeit ? 'd-none' : ''} mt-2">
                    <div class="input-group">
                      <input type="number" class="form-control" id="wochenstunden" value="${wochenstunden}" min="0" max="60" step="0.5" required>
                      <span class="input-group-text">Stunden/Woche</span>
                    </div>
                    <small class="text-muted">Geben Sie die individuelle Wochenstundenzahl ein</small>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Austrittsdatum</label>
                  <input type="date" class="form-control" id="austrittsdatum" value="${mitarbeiter.austrittsdatum || ''}">
                  <small class="form-text text-muted">Optional - leer lassen wenn noch beschäftigt</small>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
              <button type="button" class="btn btn-primary" id="btnSpeichern">
                <i class="bi bi-check-lg"></i> Speichern
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.showModal(modalHtml, async () => {
      const form = document.getElementById('stammdatenBearbeitenForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const daten = {
        vorname: document.getElementById('vorname').value,
        nachname: document.getElementById('nachname').value,
        email: null,
        abteilung: document.getElementById('abteilung').value,
        geburtsdatum: document.getElementById('geburtsdatum').value || null,
        einstellungsdatum: document.getElementById('einstellungsdatum').value,
        urlaubstage_jahr: parseFloat(document.getElementById('urlaubstageJahr').value),
        wochenstunden: parseFloat(document.getElementById('wochenstunden').value),
        austrittsdatum: document.getElementById('austrittsdatum').value || null
      };

      try {
        await this.dataManager.stammdatenAktualisieren(mitarbeiterId, daten);
        showNotification('Erfolg', `${daten.vorname} ${daten.nachname} wurde aktualisiert!`, 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });

    // Event-Listener und Switch initialisieren
    setTimeout(() => {
      // Arbeitszeitmodell Button
      const btnArbeitszeitmodell = document.getElementById('btnArbeitszeitmodell');
      if (btnArbeitszeitmodell) {
        btnArbeitszeitmodell.addEventListener('click', async () => {
          const modal = bootstrap.Modal.getInstance(document.getElementById('stammdatenBearbeitenModal'));
          if (modal) modal.hide();
          
          if (typeof dialogManager !== 'undefined') {
            await dialogManager.zeigeArbeitszeitmodell(mitarbeiterId, async () => {
              // Neu laden nach Änderung
              if (callback) await callback();
              setTimeout(() => this.zeigeStammdatenBearbeiten(mitarbeiterId, callback), 300);
            });
          }
        });
      }

      // Initialisiere Arbeitszeit-Switch
      this._initArbeitszeitSwitch();
    }, 100);
  }

  /**
   * Zeigt Mitarbeiter-Verwaltungs-Modal
   * NEU: Mit Gesamtanzahl der Mitarbeiter und Wochenstunden
   */
  async zeigeStammdatenVerwalten(callback) {
    const mitarbeiter = await this.dataManager.getAlleMitarbeiter();

    const mitarbeiterRows = mitarbeiter.map((ma, index) => `
      <tr>
        <td>${ma.vorname} ${ma.nachname}</td>
        <td>
          <span class="abteilung-badge" style="background-color: ${ma.abteilung_farbe}">
            ${ma.abteilung_name}
          </span>
        </td>
        <td class="text-center">${ma.wochenstunden || 40}h</td>
        <td>${new Date(ma.eintrittsdatum).toLocaleDateString('de-DE')}</td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary btn-bearbeiten" data-id="${ma.id}" title="Bearbeiten">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger btn-loeschen" data-id="${ma.id}" title="Deaktivieren">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    const modalHtml = `
      <div class="modal fade" id="stammdatenVerwaltungModal" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-people"></i> Mitarbeiter verwalten
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <!-- NEU: Gesamtanzahl anzeigen -->
              <div class="mb-3">
                <strong>Gesamt:</strong> ${mitarbeiter.length} Mitarbeiter
              </div>

              <div class="table-responsive">
                <table class="table table-hover table-striped">
                  <thead class="table-dark">
                    <tr>
                      <th>Name</th>
                      <th>Abteilung</th>
                      <th class="text-center">Wochenstunden</th>
                      <th>Eintrittsdatum</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody id="verwaltungTabelleBody">
                    ${mitarbeiterRows}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Schließen</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Entferne alte Modals
    const oldModals = document.querySelectorAll('.modal');
    oldModals.forEach(m => {
      const existingModal = bootstrap.Modal.getInstance(m);
      if (existingModal) existingModal.dispose();
      m.remove();
    });

    // Füge neues Modal hinzu
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Modal initialisieren
    const modalElement = document.querySelector('#stammdatenVerwaltungModal');
    const modal = new bootstrap.Modal(modalElement);

    // Event-Listener für Bearbeiten und Löschen
    const tabelleBody = modalElement.querySelector('#verwaltungTabelleBody');

    tabelleBody.addEventListener('click', async (e) => {
      const bearbeitenBtn = e.target.closest('.btn-bearbeiten');
      const loeschenBtn = e.target.closest('.btn-loeschen');

      if (bearbeitenBtn) {
        const mitarbeiterId = bearbeitenBtn.dataset.id;
        modal.hide();

        await this.zeigeStammdatenBearbeiten(mitarbeiterId, async () => {
          if (callback) await callback();
          setTimeout(() => this.zeigeStammdatenVerwalten(callback), 300);
        });
      } else if (loeschenBtn) {
        const mitarbeiterId = loeschenBtn.dataset.id;
        const mitarbeiterData = mitarbeiter.find(m => m.id === mitarbeiterId);

        if (confirm(`Möchten Sie den Mitarbeiter ${mitarbeiterData.vorname} ${mitarbeiterData.nachname} wirklich deaktivieren?`)) {
          try {
            await this.dataManager.mitarbeiterDeaktivieren(mitarbeiterId);
            showNotification('Erfolg', 'Mitarbeiter wurde deaktiviert', 'success');
            modal.hide();
            if (callback) await callback();
          } catch (error) {
            showNotification('Fehler', error.message, 'danger');
          }
        }
      }
    });

    // Modal anzeigen
    modal.show();

    // Cleanup nach Schließen
    modalElement.addEventListener('hidden.bs.modal', () => {
      modal.dispose();
      modalElement.remove();
    });
  }
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StammdatenDialog;
}