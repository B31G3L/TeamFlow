/**
 * Urlaub-Dialog
 * Urlaub eintragen mit Feiertags-Berücksichtigung
 * 
 * NEU: Berücksichtigt Arbeitszeitmodell (freie Tage = kein Urlaub, Halbtage = 0.5 Urlaub)
 * - Bei 4-Tage-Woche: ganze Woche = nur 4 Urlaubstage
 * - Bei Halbtagen: wird entsprechend anteilig berechnet
 */

class UrlaubDialog extends DialogBase {
  /**
   * Zeigt Urlaub Eintragen Dialog
   */
  async zeigeUrlaubDialog(mitarbeiterId, callback) {
    const heute = new Date();
    const formatDate = (date) => date.toISOString().split('T')[0];

    // Hole aktuelle Statistik für Resturlaub-Anzeige
    const statistik = await this.dataManager.getMitarbeiterStatistik(mitarbeiterId);
    const restUrlaub = statistik ? statistik.urlaub_rest : 0;

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
              <!-- Resturlaub-Anzeige -->
              <div class="alert ${restUrlaub > 5 ? 'alert-success' : restUrlaub > 0 ? 'alert-warning' : 'alert-danger'} mb-3">
                <div class="d-flex justify-content-between align-items-center">
                  <span>
                    <i class="bi bi-calendar-check"></i> 
                    <strong>Verfügbarer Resturlaub:</strong>
                  </span>
                  <span class="fs-5 fw-bold" id="restUrlaubAnzeige">${restUrlaub.toFixed(1)} Tage</span>
                </div>
              </div>

              <form id="urlaubForm">
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
                      Urlaubstage: <span id="dauerAnzeige" class="fw-bold text-success">1</span>
                    </label>
                    <small class="text-muted" id="berechnungsInfo">(inkl. Arbeitszeitmodell, ohne Wochenenden & Feiertage)</small>
                  </div>
                  
                  <!-- Warnung wenn zu viel Urlaub -->
                  <div id="urlaubWarnung" class="alert alert-danger mt-2 d-none">
                    <i class="bi bi-exclamation-triangle"></i>
                    <strong>Achtung:</strong> Die gewählte Anzahl Tage übersteigt den verfügbaren Resturlaub!
                  </div>
                  
                  <!-- Info zum Arbeitszeitmodell -->
                  <div id="arbeitszeitInfo" class="alert alert-info mt-2 d-none">
                    <i class="bi bi-info-circle"></i>
                    <small id="arbeitszeitInfoText"></small>
                  </div>
                  
                  <div class="mt-2">
                    <small class="text-muted d-block mb-1">Schnellauswahl:</small>
                    <div class="d-flex gap-2 flex-wrap">
                      <button type="button" class="btn btn-sm btn-outline-success dauer-btn" data-tage="0.5">Halber Tag</button>
                      <button type="button" class="btn btn-sm btn-outline-success dauer-btn" data-tage="1">1 Tag</button>
                      <button type="button" class="btn btn-sm btn-outline-success dauer-btn" data-tage="2">2 Tage</button>
                      <button type="button" class="btn btn-sm btn-outline-success dauer-btn" data-tage="3">3 Tage</button>
                      <button type="button" class="btn btn-sm btn-outline-success dauer-btn" data-tage="5">1 Woche</button>
                      <button type="button" class="btn btn-sm btn-outline-success dauer-btn" data-tage="10">2 Wochen</button>
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
                  <label class="form-label">Notizen</label>
                  <textarea class="form-control" id="notiz" rows="2" placeholder="Optionale Notizen..."></textarea>
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
      const form = document.getElementById('urlaubForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const vonDatum = document.getElementById('vonDatum').value;
      const dauerAnzeige = document.getElementById('dauerAnzeige').textContent;
      const tage = parseFloat(dauerAnzeige);

      if (isNaN(tage) || tage <= 0) {
        showNotification('Fehler', 'Ungültige Anzahl Urlaubstage', 'danger');
        return false;
      }

      // VALIDIERUNG: Prüfe ob genug Resturlaub vorhanden ist
      if (tage > restUrlaub) {
        showNotification('Fehler', `Nicht genügend Resturlaub! Verfügbar: ${restUrlaub.toFixed(1)} Tage, Angefragt: ${tage} Tage`, 'danger');
        return false;
      }

      const eintrag = {
        typ: 'urlaub',
        mitarbeiter_id: mitarbeiterId,
        datum: vonDatum,
        wert: tage,
        beschreibung: document.getElementById('notiz').value || null
      };

      try {
        await this.dataManager.speichereEintrag(eintrag);
        showNotification('Erfolg', 'Urlaub wurde eingetragen', 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });

    // Event-Listener nach Modal-Animation initialisieren
    await this._initUrlaubEventListener(mitarbeiterId, restUrlaub);
  }

  /**
   * Initialisiert Event-Listener für Urlaub-Dialog
   * NEU: Verwendet berechneUrlaubstageAsync mit Arbeitszeitmodell
   */
  async _initUrlaubEventListener(mitarbeiterId, restUrlaub) {
    const vonDatumInput = document.getElementById('vonDatum');
    const bisDatumInput = document.getElementById('bisDatum');
    const dauerAnzeige = document.getElementById('dauerAnzeige');
    const feiertagsHinweiseDiv = document.getElementById('feiertagsHinweise');
    const kollegenHinweiseDiv = document.getElementById('kollegenHinweise');
    const veranstaltungsHinweiseDiv = document.getElementById('veranstaltungsHinweise');
    const urlaubWarnung = document.getElementById('urlaubWarnung');
    const arbeitszeitInfo = document.getElementById('arbeitszeitInfo');
    const arbeitszeitInfoText = document.getElementById('arbeitszeitInfoText');
    const btnSpeichern = document.getElementById('btnSpeichern');

    if (!vonDatumInput || !bisDatumInput || !dauerAnzeige) {
      console.warn('Urlaub-Dialog Elemente nicht gefunden');
      return;
    }

    /**
     * Prüft ob die gewählten Tage den Resturlaub übersteigen
     */
    const pruefeUrlaubGrenze = (tage) => {
      if (tage > restUrlaub) {
        if (urlaubWarnung) urlaubWarnung.classList.remove('d-none');
        if (btnSpeichern) {
          btnSpeichern.disabled = true;
          btnSpeichern.classList.add('btn-secondary');
          btnSpeichern.classList.remove('btn-success');
        }
        if (dauerAnzeige) {
          dauerAnzeige.classList.remove('text-success');
          dauerAnzeige.classList.add('text-danger');
        }
      } else {
        if (urlaubWarnung) urlaubWarnung.classList.add('d-none');
        if (btnSpeichern) {
          btnSpeichern.disabled = false;
          btnSpeichern.classList.remove('btn-secondary');
          btnSpeichern.classList.add('btn-success');
        }
        if (dauerAnzeige) {
          dauerAnzeige.classList.add('text-success');
          dauerAnzeige.classList.remove('text-danger');
        }
      }
    };

    const aktualisiereHinweise = async () => {
      const von = vonDatumInput.value;
      const bis = bisDatumInput.value;
      
      if (!von || !bis) return;

      if (new Date(bis) < new Date(von)) {
        bisDatumInput.value = von;
        dauerAnzeige.textContent = '1';
        if (feiertagsHinweiseDiv) feiertagsHinweiseDiv.innerHTML = '';
        pruefeUrlaubGrenze(1);
        return;
      }
      
      try {
        // NEU: Berechne Urlaubstage MIT Arbeitszeitmodell
        const urlaubstage = await berechneUrlaubstageAsync(von, bis, mitarbeiterId);
        dauerAnzeige.textContent = urlaubstage.toFixed(1);
        
        // Zeige Info wenn Arbeitszeitmodell Auswirkungen hat
        const kalenderTage = Math.ceil((new Date(bis) - new Date(von)) / (1000 * 60 * 60 * 24)) + 1;
        if (urlaubstage < kalenderTage) {
          if (arbeitszeitInfo && arbeitszeitInfoText) {
            arbeitszeitInfo.classList.remove('d-none');
            const freieTage = kalenderTage - urlaubstage;
            arbeitszeitInfoText.textContent = `Ihr Arbeitszeitmodell wurde berücksichtigt: ${freieTage.toFixed(1)} freie Tag(e) werden nicht als Urlaub gezählt.`;
          }
        } else {
          if (arbeitszeitInfo) arbeitszeitInfo.classList.add('d-none');
        }
        
        // Prüfe Urlaubsgrenze
        pruefeUrlaubGrenze(urlaubstage);

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
          const abwesenheiten = await this.pruefeKollegenAbwesenheiten(mitarbeiterId, von, bis, 'urlaub');
          kollegenHinweiseDiv.innerHTML = this.erstelleKollegenHinweisHTML(abwesenheiten);
        }
      } catch (error) {
        console.error('Fehler beim Aktualisieren der Hinweise:', error);
      }
    };

    // Event-Listener
    vonDatumInput.addEventListener('change', async () => {
      bisDatumInput.min = vonDatumInput.value;
      
      if (bisDatumInput.value && bisDatumInput.value < vonDatumInput.value) {
        bisDatumInput.value = vonDatumInput.value;
      }
      
      await aktualisiereHinweise();
    });

    bisDatumInput.addEventListener('change', aktualisiereHinweise);

    // Setze initiales min für Bis-Datum
    bisDatumInput.min = vonDatumInput.value;

    // Initial prüfen
    await aktualisiereHinweise();

    // Dauer-Buttons - NEU: mit Arbeitszeitmodell
    document.querySelectorAll('.dauer-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tage = parseFloat(btn.dataset.tage);
        const von = vonDatumInput.value;
        
        if (!von) return;

        try {
          if (tage === 0.5) {
            bisDatumInput.value = von;
            // Für halben Tag: prüfe ob das ein Arbeitstag ist
            const urlaubstage = await berechneUrlaubstageAsync(von, von, mitarbeiterId);
            dauerAnzeige.textContent = urlaubstage.toFixed(1);
            if (feiertagsHinweiseDiv) feiertagsHinweiseDiv.innerHTML = '';
            pruefeUrlaubGrenze(urlaubstage);
            
            if (urlaubstage === 0) {
              if (arbeitszeitInfo && arbeitszeitInfoText) {
                arbeitszeitInfo.classList.remove('d-none');
                arbeitszeitInfoText.textContent = 'Dieser Tag ist laut Ihrem Arbeitszeitmodell kein Arbeitstag.';
              }
            } else if (arbeitszeitInfo) {
              arbeitszeitInfo.classList.add('d-none');
            }
          } else {
            // Berechne Enddatum MIT Arbeitszeitmodell
            const bis = await berechneEndDatumNachUrlaubstagenAsync(von, tage, mitarbeiterId);
            bisDatumInput.value = bis;
            
            // Aktualisiere Anzeige
            const urlaubstage = await berechneUrlaubstageAsync(von, bis, mitarbeiterId);
            dauerAnzeige.textContent = urlaubstage.toFixed(1);
            
            // Prüfe Urlaubsgrenze
            pruefeUrlaubGrenze(urlaubstage);
            
            // Hole Feiertage im Zeitraum
            if (feiertagsHinweiseDiv) {
              const feiertage = await getFeiertageImZeitraum(von, bis);
              feiertagsHinweiseDiv.innerHTML = this.erstelleFeiertagsHinweisHTML(feiertage);
            }
            
            // Zeige Info wenn nötig
            const kalenderTage = Math.ceil((new Date(bis) - new Date(von)) / (1000 * 60 * 60 * 24)) + 1;
            if (urlaubstage < kalenderTage) {
              if (arbeitszeitInfo && arbeitszeitInfoText) {
                arbeitszeitInfo.classList.remove('d-none');
                const freieTage = kalenderTage - urlaubstage;
                arbeitszeitInfoText.textContent = `Ihr Arbeitszeitmodell wurde berücksichtigt: ${freieTage.toFixed(1)} freie Tag(e) werden nicht als Urlaub gezählt.`;
              }
            } else {
              if (arbeitszeitInfo) arbeitszeitInfo.classList.add('d-none');
            }
          }

          // Aktualisiere Hinweise
          if (veranstaltungsHinweiseDiv) {
            const veranstaltungen = await this.pruefeVeranstaltungen(vonDatumInput.value, bisDatumInput.value);
            veranstaltungsHinweiseDiv.innerHTML = this.erstelleVeranstaltungsHinweisHTML(veranstaltungen);
          }

          if (kollegenHinweiseDiv) {
            const abwesenheiten = await this.pruefeKollegenAbwesenheiten(
              mitarbeiterId, 
              vonDatumInput.value, 
              bisDatumInput.value, 
              'urlaub'
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
  module.exports = UrlaubDialog;
}