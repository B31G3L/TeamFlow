/**
 * Stammdaten-Dialoge
 * Mitarbeiter hinzufügen, bearbeiten und verwalten
 */

class StammdatenDialog extends DialogBase {
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
        urlaubstage_jahr: parseFloat(document.getElementById('urlaubstageJahr').value)
      };

      // Generiere automatische ID
      const vorname = daten.vorname.substring(0, 3).toUpperCase();
      const nachname = daten.nachname.substring(0, 3).toUpperCase();
      const timestamp = Date.now().toString().slice(-4);
      const mitarbeiterId = `${nachname}${vorname}${timestamp}`;

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

    // Heutiges Datum als Standard
    const heute = new Date().toISOString().split('T')[0];
    setTimeout(() => {
      const einstellungsdatumField = document.getElementById('einstellungsdatum');
      if (einstellungsdatumField) {
        einstellungsdatumField.value = heute;
      }
    }, 100);
  }

  /**
   * Zeigt Stammdaten Bearbeiten Dialog
   */
  async zeigeStammdatenBearbeiten(mitarbeiterId, callback) {
    const mitarbeiter = await this.dataManager.getMitarbeiter(mitarbeiterId);

    if (!mitarbeiter) {
      showNotification('Fehler', 'Mitarbeiter nicht gefunden', 'danger');
      return;
    }

    const abteilungen = await this.dataManager.getAlleAbteilungen();

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
  }

  /**
   * Zeigt Mitarbeiter-Verwaltungs-Modal
   */
  async zeigeStammdatenVerwalten(callback) {
    const mitarbeiter = await this.dataManager.getAlleMitarbeiter();

    const mitarbeiterRows = mitarbeiter.map((ma, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${ma.vorname} ${ma.nachname}</td>
        <td>
          <span class="abteilung-badge" style="background-color: ${ma.abteilung_farbe}">
            ${ma.abteilung_name}
          </span>
        </td>
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
              <div class="table-responsive">
                <table class="table table-hover table-striped">
                  <thead class="table-dark">
                    <tr>
                      <th>Nr.</th>
                      <th>Name</th>
                      <th>Abteilung</th>
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
    oldModals.forEach(m => m.remove());

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
      modalElement.remove();
    });
  }
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StammdatenDialog;
}