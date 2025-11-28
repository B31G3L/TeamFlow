/**
 * Dialog-Komponenten
 * Bootstrap Modals für alle Eingabe-Dialoge
 */

class DialogManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  /**
   * Zeigt Stammdaten Hinzufügen Dialog
   */
  zeigeStammdatenHinzufuegen(callback) {
    const abteilungen = this.dataManager.getAlleAbteilungen();

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
                <div class="mb-3">
                  <label class="form-label">Mitarbeiter-ID *</label>
                  <input type="text" class="form-control" id="mitarbeiterId" required>
                </div>

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
                  <label class="form-label">E-Mail</label>
                  <input type="email" class="form-control" id="email">
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

    this.showModal(modalHtml, () => {
      const form = document.getElementById('stammdatenForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const daten = {
        vorname: document.getElementById('vorname').value,
        nachname: document.getElementById('nachname').value,
        email: document.getElementById('email').value || null,
        abteilung: document.getElementById('abteilung').value,
        geburtsdatum: document.getElementById('geburtsdatum').value || null,
        einstellungsdatum: document.getElementById('einstellungsdatum').value,
        urlaubstage_jahr: parseFloat(document.getElementById('urlaubstageJahr').value)
      };

      const mitarbeiterId = document.getElementById('mitarbeiterId').value;
      const erfolg = this.dataManager.stammdatenHinzufuegen(mitarbeiterId, daten);

      if (erfolg) {
        showNotification('Erfolg', `${daten.vorname} ${daten.nachname} wurde hinzugefügt!`, 'success');
        if (callback) callback();
        return true;
      } else {
        showNotification('Fehler', 'Mitarbeiter konnte nicht hinzugefügt werden', 'danger');
        return false;
      }
    });

    // Heutiges Datum als Standard
    const heute = new Date().toISOString().split('T')[0];
    setTimeout(() => {
      document.getElementById('einstellungsdatum').value = heute;
    }, 100);
  }

  /**
   * Zeigt Stammdaten Bearbeiten Dialog
   */
  zeigeStammdatenBearbeiten(mitarbeiterId, callback) {
    const mitarbeiter = this.dataManager.db.db.prepare(`
      SELECT m.*, a.name as abteilung_name
      FROM mitarbeiter m
      LEFT JOIN abteilungen a ON m.abteilung_id = a.id
      WHERE m.id = ?
    `).get(mitarbeiterId);

    if (!mitarbeiter) {
      showNotification('Fehler', 'Mitarbeiter nicht gefunden', 'danger');
      return;
    }

    const abteilungen = this.dataManager.getAlleAbteilungen();

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
                <div class="mb-3">
                  <label class="form-label">Mitarbeiter-ID</label>
                  <input type="text" class="form-control" id="mitarbeiterId" value="${mitarbeiter.id}" disabled>
                </div>

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
                  <label class="form-label">E-Mail</label>
                  <input type="email" class="form-control" id="email" value="${mitarbeiter.email || ''}">
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

    this.showModal(modalHtml, () => {
      const form = document.getElementById('stammdatenBearbeitenForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const daten = {
        vorname: document.getElementById('vorname').value,
        nachname: document.getElementById('nachname').value,
        email: document.getElementById('email').value || null,
        abteilung: document.getElementById('abteilung').value,
        geburtsdatum: document.getElementById('geburtsdatum').value || null,
        einstellungsdatum: document.getElementById('einstellungsdatum').value,
        urlaubstage_jahr: parseFloat(document.getElementById('urlaubstageJahr').value),
        austrittsdatum: document.getElementById('austrittsdatum').value || null
      };

      const erfolg = this.dataManager.stammdatenAktualisieren(mitarbeiterId, daten);

      if (erfolg) {
        showNotification('Erfolg', `${daten.vorname} ${daten.nachname} wurde aktualisiert!`, 'success');
        if (callback) callback();
        return true;
      } else {
        showNotification('Fehler', 'Mitarbeiter konnte nicht aktualisiert werden', 'danger');
        return false;
      }
    });
  }

  /**
   * Zeigt Mitarbeiter-Verwaltungs-Modal
   */
  zeigeStammdatenVerwalten(callback) {
    const mitarbeiter = this.dataManager.getAlleMitarbeiter();

    const mitarbeiterRows = mitarbeiter.map((ma, index) => `
      <tr>
        <td>${index + 1}</td>
        <td><code>${ma.id}</code></td>
        <td>${ma.vorname} ${ma.nachname}</td>
        <td>
          <span class="abteilung-badge" style="background-color: ${ma.abteilung_farbe}">
            ${ma.abteilung_name}
          </span>
        </td>
        <td>${ma.email || '-'}</td>
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
                      <th>ID</th>
                      <th>Name</th>
                      <th>Abteilung</th>
                      <th>E-Mail</th>
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

    tabelleBody.addEventListener('click', (e) => {
      const bearbeitenBtn = e.target.closest('.btn-bearbeiten');
      const loeschenBtn = e.target.closest('.btn-loeschen');

      if (bearbeitenBtn) {
        const mitarbeiterId = bearbeitenBtn.dataset.id;
        modal.hide();

        // Bearbeiten-Dialog öffnen
        this.zeigeStammdatenBearbeiten(mitarbeiterId, () => {
          if (callback) callback();
          // Verwaltungs-Modal wieder öffnen nach Bearbeitung
          setTimeout(() => this.zeigeStammdatenVerwalten(callback), 300);
        });
      } else if (loeschenBtn) {
        const mitarbeiterId = loeschenBtn.dataset.id;
        const mitarbeiterData = mitarbeiter.find(m => m.id === mitarbeiterId);

        if (confirm(`Möchten Sie den Mitarbeiter ${mitarbeiterData.vorname} ${mitarbeiterData.nachname} wirklich deaktivieren?`)) {
          const erfolg = this.dataManager.mitarbeiterDeaktivieren(mitarbeiterId);

          if (erfolg) {
            showNotification('Erfolg', 'Mitarbeiter wurde deaktiviert', 'success');
            modal.hide();
            if (callback) callback();
          } else {
            showNotification('Fehler', 'Mitarbeiter konnte nicht deaktiviert werden', 'danger');
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

  /**
   * Zeigt Urlaub Eintragen Dialog
   */
  zeigeUrlaubDialog(mitarbeiterId, callback) {
    const modalHtml = `
      <div class="modal fade" id="urlaubModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-success text-white">
              <h5 class="modal-title">
                <i class="bi bi-calendar-plus"></i> Urlaub eintragen
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="urlaubForm">
                <div class="mb-3">
                  <label class="form-label">Von Datum *</label>
                  <input type="date" class="form-control" id="vonDatum" required>
                </div>

                <div class="mb-3">
                  <label class="form-label">Anzahl Tage *</label>
                  <input type="number" class="form-control" id="tage" min="0.5" step="0.5" value="1" required>
                </div>

                <div class="mb-3">
                  <label class="form-label">Notiz</label>
                  <textarea class="form-control" id="notiz" rows="3"></textarea>
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

    this.showModal(modalHtml, () => {
      const form = document.getElementById('urlaubForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const eintrag = {
        typ: 'urlaub',
        mitarbeiter_id: mitarbeiterId,
        datum: document.getElementById('vonDatum').value,
        wert: parseFloat(document.getElementById('tage').value),
        beschreibung: document.getElementById('notiz').value || null
      };

      const erfolg = this.dataManager.speichereEintrag(eintrag);

      if (erfolg) {
        showNotification('Erfolg', 'Urlaub wurde eingetragen', 'success');
        if (callback) callback();
        return true;
      } else {
        showNotification('Fehler', 'Urlaub konnte nicht eingetragen werden', 'danger');
        return false;
      }
    });
  }

  /**
   * Zeigt Krankheit Eintragen Dialog
   */
  zeigeKrankDialog(mitarbeiterId, callback) {
    const modalHtml = `
      <div class="modal fade" id="krankModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-danger text-white">
              <h5 class="modal-title">
                <i class="bi bi-bandaid"></i> Krankheit eintragen
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="krankForm">
                <div class="mb-3">
                  <label class="form-label">Von Datum *</label>
                  <input type="date" class="form-control" id="vonDatum" required>
                </div>

                <div class="mb-3">
                  <label class="form-label">Anzahl Tage *</label>
                  <input type="number" class="form-control" id="tage" min="0.5" step="0.5" value="1" required>
                </div>

                <div class="mb-3">
                  <label class="form-label">Notiz</label>
                  <textarea class="form-control" id="notiz" rows="3"></textarea>
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

    this.showModal(modalHtml, () => {
      const form = document.getElementById('krankForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const eintrag = {
        typ: 'krank',
        mitarbeiter_id: mitarbeiterId,
        datum: document.getElementById('vonDatum').value,
        wert: parseFloat(document.getElementById('tage').value),
        beschreibung: document.getElementById('notiz').value || null
      };

      const erfolg = this.dataManager.speichereEintrag(eintrag);

      if (erfolg) {
        showNotification('Erfolg', 'Krankheit wurde eingetragen', 'success');
        if (callback) callback();
        return true;
      } else {
        showNotification('Fehler', 'Krankheit konnte nicht eingetragen werden', 'danger');
        return false;
      }
    });
  }

  /**
   * Zeigt Schulung Eintragen Dialog
   */
  zeigeSchulungDialog(mitarbeiterId, callback) {
    const modalHtml = `
      <div class="modal fade" id="schulungModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-info text-white">
              <h5 class="modal-title">
                <i class="bi bi-book"></i> Schulung eintragen
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="schulungForm">
                <div class="mb-3">
                  <label class="form-label">Datum *</label>
                  <input type="date" class="form-control" id="datum" required>
                </div>

                <div class="mb-3">
                  <label class="form-label">Dauer (Tage) *</label>
                  <input type="number" class="form-control" id="tage" min="0.5" step="0.5" value="1" required>
                </div>

                <div class="mb-3">
                  <label class="form-label">Titel</label>
                  <input type="text" class="form-control" id="titel">
                </div>

                <div class="mb-3">
                  <label class="form-label">Notiz</label>
                  <textarea class="form-control" id="notiz" rows="3"></textarea>
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

    this.showModal(modalHtml, () => {
      const form = document.getElementById('schulungForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const eintrag = {
        typ: 'schulung',
        mitarbeiter_id: mitarbeiterId,
        datum: document.getElementById('datum').value,
        wert: parseFloat(document.getElementById('tage').value),
        titel: document.getElementById('titel').value || null,
        beschreibung: document.getElementById('notiz').value || null
      };

      const erfolg = this.dataManager.speichereEintrag(eintrag);

      if (erfolg) {
        showNotification('Erfolg', 'Schulung wurde eingetragen', 'success');
        if (callback) callback();
        return true;
      } else {
        showNotification('Fehler', 'Schulung konnte nicht eingetragen werden', 'danger');
        return false;
      }
    });
  }

  /**
   * Zeigt Überstunden Eintragen Dialog
   */
  zeigeUeberstundenDialog(mitarbeiterId, callback) {
    const modalHtml = `
      <div class="modal fade" id="ueberstundenModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-warning text-dark">
              <h5 class="modal-title">
                <i class="bi bi-clock"></i> Überstunden eintragen
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="ueberstundenForm">
                <div class="mb-3">
                  <label class="form-label">Datum *</label>
                  <input type="date" class="form-control" id="datum" required>
                </div>

                <div class="mb-3">
                  <label class="form-label">Stunden *</label>
                  <input type="number" class="form-control" id="stunden" min="-100" max="100" step="0.5" value="1" required>
                  <small class="form-text text-muted">Negative Werte für Abbau</small>
                </div>

                <div class="mb-3">
                  <label class="form-label">Notiz</label>
                  <textarea class="form-control" id="notiz" rows="3"></textarea>
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

    this.showModal(modalHtml, () => {
      const form = document.getElementById('ueberstundenForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const eintrag = {
        typ: 'ueberstunden',
        mitarbeiter_id: mitarbeiterId,
        datum: document.getElementById('datum').value,
        wert: parseFloat(document.getElementById('stunden').value),
        beschreibung: document.getElementById('notiz').value || null
      };

      const erfolg = this.dataManager.speichereEintrag(eintrag);

      if (erfolg) {
        showNotification('Erfolg', 'Überstunden wurden eingetragen', 'success');
        if (callback) callback();
        return true;
      } else {
        showNotification('Fehler', 'Überstunden konnten nicht eingetragen werden', 'danger');
        return false;
      }
    });
  }

  /**
   * Hilfsfunktion: Zeigt Modal an
   */
  showModal(html, onSave) {
    // Entferne alte Modals
    const oldModals = document.querySelectorAll('.modal');
    oldModals.forEach(m => m.remove());

    // Füge neues Modal hinzu
    document.body.insertAdjacentHTML('beforeend', html);

    // Modal initialisieren
    const modalElement = document.querySelector('.modal');
    const modal = new bootstrap.Modal(modalElement);

    // Speichern-Button
    const btnSpeichern = modalElement.querySelector('#btnSpeichern');
    if (btnSpeichern && onSave) {
      btnSpeichern.addEventListener('click', () => {
        if (onSave()) {
          modal.hide();
        }
      });
    }

    // Modal anzeigen
    modal.show();

    // Cleanup nach Schließen
    modalElement.addEventListener('hidden.bs.modal', () => {
      modalElement.remove();
    });
  }
}

/**
 * Zeigt Toast-Notification
 */
function showNotification(title, message, type = 'info') {
  const toast = document.getElementById('notificationToast');
  const toastTitle = document.getElementById('toastTitle');
  const toastMessage = document.getElementById('toastMessage');

  // Icon basierend auf Typ
  const icons = {
    success: 'bi-check-circle-fill',
    danger: 'bi-exclamation-triangle-fill',
    warning: 'bi-exclamation-circle-fill',
    info: 'bi-info-circle-fill'
  };

  const icon = icons[type] || icons.info;

  // Setze Inhalt
  toastTitle.innerHTML = `<i class="bi ${icon} me-2"></i>${title}`;
  toastMessage.textContent = message;

  // Setze Farbe
  const toastHeader = toast.querySelector('.toast-header');
  toastHeader.className = `toast-header bg-${type} text-white`;

  // Zeige Toast
  const bsToast = new bootstrap.Toast(toast);
  bsToast.show();
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DialogManager, showNotification };
}
