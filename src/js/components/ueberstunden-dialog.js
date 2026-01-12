/**
 * Überstunden-Dialog
 * Überstunden eintragen
 */

class UeberstundenDialog extends DialogBase {
  /**
   * Zeigt Überstunden Eintragen Dialog
   */
  async zeigeUeberstundenDialog(mitarbeiterId, callback) {
    const heute = new Date();
    const gestern = new Date(heute);
    gestern.setDate(gestern.getDate() - 1);
    const morgen = new Date(heute);
    morgen.setDate(morgen.getDate() + 1);

    const formatDate = (date) => date.toISOString().split('T')[0];

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
                  <input type="date" class="form-control" id="datum" value="${formatDate(heute)}" required>
                  <div class="mt-2 d-flex gap-2">
                    <button type="button" class="btn btn-sm btn-outline-secondary datum-btn" data-datum="${formatDate(gestern)}">Gestern</button>
                    <button type="button" class="btn btn-sm btn-outline-primary datum-btn" data-datum="${formatDate(heute)}">Heute</button>
                    <button type="button" class="btn btn-sm btn-outline-secondary datum-btn" data-datum="${formatDate(morgen)}">Morgen</button>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Stunden *</label>
                  <input type="number" class="form-control" id="stunden" min="-100" max="100" step="0.25" value="1" required>
                  
                  <div class="mt-2">
                    <small class="text-muted d-block mb-1">Aufbauen (+):</small>
                    <div class="d-flex gap-2 flex-wrap">
                      <button type="button" class="btn btn-sm btn-outline-success stunden-btn" data-stunden="4">+4</button>
                      <button type="button" class="btn btn-sm btn-outline-success stunden-btn" data-stunden="8">+8</button>
                    </div>
                  </div>
                  
                  <div class="mt-2">
                    <small class="text-muted d-block mb-1">Abbauen (-):</small>
                    <div class="d-flex gap-2 flex-wrap">
                      <button type="button" class="btn btn-sm btn-outline-danger stunden-btn" data-stunden="-4">- 4</button>
                      <button type="button" class="btn btn-sm btn-outline-danger stunden-btn" data-stunden="-8">- 8</button>
                    </div>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Notiz</label>
                  <textarea class="form-control" id="notiz" rows="2"></textarea>
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

      try {
        await this.dataManager.speichereEintrag(eintrag);
        showNotification('Erfolg', 'Überstunden wurden eingetragen', 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });

    // Event-Listener für Datum-Buttons und Stunden-Buttons
    setTimeout(() => {
      const datumInput = document.getElementById('datum');
      const stundenInput = document.getElementById('stunden');

      document.querySelectorAll('.datum-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          datumInput.value = btn.dataset.datum;
        });
      });

      document.querySelectorAll('.stunden-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          stundenInput.value = btn.dataset.stunden;
        });
      });
    }, 100);
  }
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UeberstundenDialog;
}