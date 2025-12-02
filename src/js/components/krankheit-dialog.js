/**
 * Krankheit-Dialog
 * Krankheit eintragen
 */

class KrankheitDialog extends DialogBase {
  /**
   * Zeigt Krankheit Eintragen Dialog
   */
  async zeigeKrankDialog(mitarbeiterId, callback) {
    const heute = new Date();
    const formatDate = (date) => date.toISOString().split('T')[0];

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
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Von *</label>
                    <input type="date" class="form-control" id="vonDatum" value="${formatDate(heute)}" required>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Bis *</label>
                    <input type="date" class="form-control" id="bisDatum" value="${formatDate(heute)}" required>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Arbeitstage (ohne Wochenende): <span id="dauerAnzeige" class="fw-bold">1</span></label>
                  <div class="mt-2">
                    <small class="text-muted d-block mb-1">Schnellauswahl:</small>
                    <div class="d-flex gap-2 flex-wrap">
                      <button type="button" class="btn btn-sm btn-outline-danger dauer-btn" data-tage="0.5">Halber Tag</button>
                      <button type="button" class="btn btn-sm btn-outline-danger dauer-btn" data-tage="1">1 Tag</button>
                      <button type="button" class="btn btn-sm btn-outline-danger dauer-btn" data-tage="2">2 Tage</button>
                      <button type="button" class="btn btn-sm btn-outline-danger dauer-btn" data-tage="3">3 Tage</button>
                      <button type="button" class="btn btn-sm btn-outline-danger dauer-btn" data-tage="5">1 Woche</button>
                    </div>
                  </div>
                </div>

                <!-- Kollegen-Hinweise Container -->
                <div id="kollegenHinweise"></div>

                <div class="mb-3">
                  <label class="form-label">Notizen</label>
                  <textarea class="form-control" id="notiz" rows="2" placeholder="Optionale Notizen..."></textarea>
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
      const form = document.getElementById('krankForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const vonDatum = document.getElementById('vonDatum').value;
      const dauerAnzeige = document.getElementById('dauerAnzeige').textContent;
      const tage = parseFloat(dauerAnzeige);

      const eintrag = {
        typ: 'krank',
        mitarbeiter_id: mitarbeiterId,
        datum: vonDatum,
        wert: tage,
        beschreibung: document.getElementById('notiz').value || null
      };

      try {
        await this.dataManager.speichereEintrag(eintrag);
        showNotification('Erfolg', 'Krankheit wurde eingetragen', 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });

    // Event-Listener für Datum-Validierung und Dauer-Berechnung
    setTimeout(async () => {
      const vonDatumInput = document.getElementById('vonDatum');
      const bisDatumInput = document.getElementById('bisDatum');
      const dauerAnzeige = document.getElementById('dauerAnzeige');
      const kollegenHinweiseDiv = document.getElementById('kollegenHinweise');

      const berechneDauer = async () => {
        const von = vonDatumInput.value;
        const bis = bisDatumInput.value;
        
        if (new Date(bis) < new Date(von)) {
          bisDatumInput.value = von;
          dauerAnzeige.textContent = '1';
        } else {
          const arbeitstage = berechneArbeitstage(von, bis);
          dauerAnzeige.textContent = arbeitstage;

          // Prüfe Kollegen-Abwesenheiten
          const abwesenheiten = await this.pruefeKollegenAbwesenheiten(mitarbeiterId, von, bis, 'krank');
          kollegenHinweiseDiv.innerHTML = this.erstelleKollegenHinweisHTML(abwesenheiten);
        }
      };

      vonDatumInput.addEventListener('change', async () => {
        if (bisDatumInput.value < vonDatumInput.value) {
          bisDatumInput.value = vonDatumInput.value;
        }
        bisDatumInput.min = vonDatumInput.value;
        await berechneDauer();
      });

      bisDatumInput.addEventListener('change', berechneDauer);

      // Setze initiales min für Bis-Datum
      bisDatumInput.min = vonDatumInput.value;

      // Initial prüfen
      await berechneDauer();

      // Dauer-Buttons
      document.querySelectorAll('.dauer-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const tage = parseFloat(btn.dataset.tage);
          const von = vonDatumInput.value;
          
          if (tage === 0.5) {
            bisDatumInput.value = von;
            dauerAnzeige.textContent = '0.5';
          } else {
            const bis = berechneEndDatumNachArbeitstagen(von, tage);
            bisDatumInput.value = bis;
            dauerAnzeige.textContent = tage;
          }

          // Prüfe Kollegen nach Änderung
          const abwesenheiten = await this.pruefeKollegenAbwesenheiten(
            mitarbeiterId, 
            vonDatumInput.value, 
            bisDatumInput.value, 
            'krank'
          );
          kollegenHinweiseDiv.innerHTML = this.erstelleKollegenHinweisHTML(abwesenheiten);
        });
      });
    }, 100);
  }
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KrankheitDialog;
}