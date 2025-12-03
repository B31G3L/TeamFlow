/**
 * Schulung-Dialog
 * Schulung eintragen mit Feiertags-Berücksichtigung
 * 
 * FIXES:
 * - Race Condition bei Event-Listener Initialisierung behoben
 * - Bessere Fehlerbehandlung
 */

class SchulungDialog extends DialogBase {
  /**
   * Zeigt Schulung Eintragen Dialog
   */
  async zeigeSchulungDialog(mitarbeiterId, callback) {
    const heute = new Date();
    const formatDate = (date) => date.toISOString().split('T')[0];

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
                  <div class="d-flex justify-content-between align-items-center">
                    <label class="form-label mb-0">
                      Schulungstage: <span id="dauerAnzeige" class="fw-bold text-info">1</span>
                    </label>
                    <small class="text-muted" id="berechnungsInfo">(ohne Wochenenden & Feiertage)</small>
                  </div>
                  <div class="mt-2">
                    <small class="text-muted d-block mb-1">Schnellauswahl:</small>
                    <div class="d-flex gap-2 flex-wrap">
                      <button type="button" class="btn btn-sm btn-outline-info dauer-btn" data-tage="0.5">Halber Tag</button>
                      <button type="button" class="btn btn-sm btn-outline-info dauer-btn" data-tage="1">1 Tag</button>
                      <button type="button" class="btn btn-sm btn-outline-info dauer-btn" data-tage="2">2 Tage</button>
                      <button type="button" class="btn btn-sm btn-outline-info dauer-btn" data-tage="3">3 Tage</button>
                      <button type="button" class="btn btn-sm btn-outline-info dauer-btn" data-tage="5">1 Woche</button>
                    </div>
                  </div>
                </div>

                <!-- Feiertags-Hinweise Container -->
                <div id="feiertagsHinweise"></div>

                <!-- Veranstaltungs-Hinweise Container -->
                <div id="veranstaltungsHinweise"></div>

                <!-- Kollegen-Hinweise Container -->
                <div id="kollegenHinweise"></div>

                <div class="mb-3">
                  <label class="form-label">Schulungstitel</label>
                  <input type="text" class="form-control" id="titel" placeholder="z.B. Erste-Hilfe-Kurs, Brandschutz...">
                </div>

                <div class="mb-3">
                  <label class="form-label">Notizen</label>
                  <textarea class="form-control" id="notiz" rows="2" placeholder="Optionale Notizen..."></textarea>
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

    // FIX: showModal gibt jetzt ein Promise zurück
    await this.showModal(modalHtml, async () => {
      const form = document.getElementById('schulungForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const vonDatum = document.getElementById('vonDatum').value;
      const dauerAnzeige = document.getElementById('dauerAnzeige').textContent;
      const tage = parseFloat(dauerAnzeige);

      if (isNaN(tage) || tage <= 0) {
        showNotification('Fehler', 'Ungültige Anzahl Schulungstage', 'danger');
        return false;
      }

      const eintrag = {
        typ: 'schulung',
        mitarbeiter_id: mitarbeiterId,
        datum: vonDatum,
        wert: tage,
        titel: document.getElementById('titel').value || null,
        beschreibung: document.getElementById('notiz').value || null
      };

      try {
        await this.dataManager.speichereEintrag(eintrag);
        showNotification('Erfolg', 'Schulung wurde eingetragen', 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });

    // FIX: Event-Listener nach Modal-Animation initialisieren
    await this._initSchulungEventListener(mitarbeiterId);
  }

  /**
   * Initialisiert Event-Listener für Schulung-Dialog
   */
  async _initSchulungEventListener(mitarbeiterId) {
    const vonDatumInput = document.getElementById('vonDatum');
    const bisDatumInput = document.getElementById('bisDatum');
    const dauerAnzeige = document.getElementById('dauerAnzeige');
    const feiertagsHinweiseDiv = document.getElementById('feiertagsHinweise');
    const kollegenHinweiseDiv = document.getElementById('kollegenHinweise');
    const veranstaltungsHinweiseDiv = document.getElementById('veranstaltungsHinweise');

    // FIX: Prüfe ob Elemente existieren
    if (!vonDatumInput || !bisDatumInput || !dauerAnzeige) {
      console.warn('Schulung-Dialog Elemente nicht gefunden');
      return;
    }

    const aktualisiereHinweise = async () => {
      const von = vonDatumInput.value;
      const bis = bisDatumInput.value;
      
      if (!von || !bis) return;

      if (new Date(bis) < new Date(von)) {
        bisDatumInput.value = von;
        dauerAnzeige.textContent = '1';
        if (feiertagsHinweiseDiv) feiertagsHinweiseDiv.innerHTML = '';
        return;
      }
      
      try {
        // Berechne Arbeitstage MIT Feiertagen (async)
        const arbeitstage = await berechneArbeitstageAsync(von, bis);
        dauerAnzeige.textContent = arbeitstage;

        // Hole Feiertage im Zeitraum für Anzeige
        if (feiertagsHinweiseDiv) {
          const feiertage = await getFeiertageImZeitraum(von, bis);
          feiertagsHinweiseDiv.innerHTML = this.erstelleFeiertagsHinweisHTML(feiertage);
        }

        // Prüfe Veranstaltungen
        if (veranstaltungsHinweiseDiv) {
          const veranstaltungen = await this.pruefeVeranstaltungen(von, bis);
          veranstaltungsHinweiseDiv.innerHTML = this.erstelleVeranstaltungsHinweisHTML(veranstaltungen);
        }

        // Prüfe Kollegen-Abwesenheiten
        if (kollegenHinweiseDiv) {
          const abwesenheiten = await this.pruefeKollegenAbwesenheiten(mitarbeiterId, von, bis, 'schulung');
          kollegenHinweiseDiv.innerHTML = this.erstelleKollegenHinweisHTML(abwesenheiten);
        }
      } catch (error) {
        console.error('Fehler beim Aktualisieren der Hinweise:', error);
      }
    };

    vonDatumInput.addEventListener('change', async () => {
      if (bisDatumInput.value < vonDatumInput.value) {
        bisDatumInput.value = vonDatumInput.value;
      }
      bisDatumInput.min = vonDatumInput.value;
      await aktualisiereHinweise();
    });

    bisDatumInput.addEventListener('change', aktualisiereHinweise);

    // Setze initiales min für Bis-Datum
    bisDatumInput.min = vonDatumInput.value;

    // Initial prüfen
    await aktualisiereHinweise();

    // Dauer-Buttons
    document.querySelectorAll('.dauer-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tage = parseFloat(btn.dataset.tage);
        const von = vonDatumInput.value;
        
        if (!von) return;

        try {
          if (tage === 0.5) {
            bisDatumInput.value = von;
            dauerAnzeige.textContent = '0.5';
            if (feiertagsHinweiseDiv) feiertagsHinweiseDiv.innerHTML = '';
          } else {
            // Berechne Enddatum MIT Feiertagen
            const bis = await berechneEndDatumNachArbeitstagenAsync(von, tage);
            bisDatumInput.value = bis;
            
            // Aktualisiere Anzeige
            const arbeitstage = await berechneArbeitstageAsync(von, bis);
            dauerAnzeige.textContent = arbeitstage;
            
            // Hole Feiertage im Zeitraum
            if (feiertagsHinweiseDiv) {
              const feiertage = await getFeiertageImZeitraum(von, bis);
              feiertagsHinweiseDiv.innerHTML = this.erstelleFeiertagsHinweisHTML(feiertage);
            }
          }

          // Aktualisiere Hinweise nach Änderung
          if (veranstaltungsHinweiseDiv) {
            const veranstaltungen = await this.pruefeVeranstaltungen(vonDatumInput.value, bisDatumInput.value);
            veranstaltungsHinweiseDiv.innerHTML = this.erstelleVeranstaltungsHinweisHTML(veranstaltungen);
          }

          if (kollegenHinweiseDiv) {
            const abwesenheiten = await this.pruefeKollegenAbwesenheiten(
              mitarbeiterId, 
              vonDatumInput.value, 
              bisDatumInput.value, 
              'schulung'
            );
            kollegenHinweiseDiv.innerHTML = this.erstelleKollegenHinweisHTML(abwesenheiten);
          }
        } catch (error) {
          console.error('Fehler bei Dauer-Button:', error);
        }
      });
    });
  }
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SchulungDialog;
}
