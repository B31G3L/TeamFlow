/**
 * Arbeitszeitmodell-Dialog
 * 
 * Verwaltet das Arbeitszeitmodell für Mitarbeiter
 * Definiert Arbeitstage pro Woche (VOLL/HALB/FREI)
 * 
 * VERBESSERT: Sollstunden-Anzeige entfernt für mehr Klarheit
 */

class ArbeitszeitmodellDialog extends DialogBase {
  /**
   * Zeigt Arbeitszeitmodell-Dialog
   */
  async zeigeArbeitszeitmodell(mitarbeiterId, callback) {
    // Lade Mitarbeiter-Daten
    const mitarbeiter = await this.dataManager.getMitarbeiter(mitarbeiterId);
    if (!mitarbeiter) {
      showNotification('Fehler', 'Mitarbeiter nicht gefunden', 'danger');
      return;
    }

    // Lade bestehendes Arbeitszeitmodell
    const bestehendesModell = await this.dataManager.getArbeitszeitmodell(mitarbeiterId);

    const modalHtml = `
      <div class="modal fade" id="arbeitszeitmodellModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">
                <i class="bi bi-calendar-week"></i> Arbeitszeitmodell - ${mitarbeiter.vorname} ${mitarbeiter.nachname}
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="arbeitszeitmodellForm">
                <!-- Wochenstunden Info -->
                <div class="alert alert-info mb-3">
                  <i class="bi bi-info-circle"></i>
                  <strong>Vertragszeit:</strong> ${mitarbeiter.wochenstunden || 40} Stunden pro Woche
                  <br>
                  <small class="text-muted">
                    Legen Sie hier fest, an welchen Wochentagen der Mitarbeiter arbeitet.
                    Dies wird bei der Urlaubsberechnung berücksichtigt.
                  </small>
                </div>

                <!-- Wochenplan -->
                <div class="mb-3">
                  <label class="form-label fw-bold">Wochenplan</label>
                  <div class="table-responsive">
                    <table class="table table-bordered">
                      <thead class="table-light">
                        <tr>
                          <th style="width: 30%">Wochentag</th>
                          <th style="width: 70%">Arbeitszeit</th>
                        </tr>
                      </thead>
                      <tbody id="wochenplanTbody">
                        ${this._erstelleWochenplanZeilen(bestehendesModell)}
                      </tbody>
                    </table>
                  </div>
                  
                  <small class="text-muted">
                    <strong>VOLL</strong> = Ganztägige Arbeit (zählt als 1 Urlaubstag)<br>
                    <strong>HALB</strong> = Halbtägige Arbeit (zählt als 1 Urlaubstag)<br>
                    <strong>FREI</strong> = Freier Tag (zählt nicht als Urlaubstag)
                  </small>
                </div>

                <!-- Schnellauswahl -->
                <div class="mb-3">
                  <label class="form-label fw-bold">Schnellauswahl</label>
                  <div class="d-flex gap-2 flex-wrap">
                    <button type="button" class="btn btn-sm btn-outline-primary" data-preset="5-tage">
                      <i class="bi bi-calendar-check"></i> 5-Tage-Woche (Mo-Fr)
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-primary" data-preset="4-tage">
                      <i class="bi bi-calendar-check"></i> 4-Tage-Woche (Mo-Do)
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-primary" data-preset="6-tage">
                      <i class="bi bi-calendar-check"></i> 6-Tage-Woche (Mo-Sa)
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-preset="reset">
                      <i class="bi bi-arrow-clockwise"></i> Zurücksetzen
                    </button>
                  </div>
                </div>

                <!-- Info zur Urlaubsberechnung -->
                <div class="alert alert-success">
                  <i class="bi bi-calculator"></i>
                  <strong>Urlaubsberechnung:</strong>
                  <div id="urlaubsberechnungInfo" class="mt-2">
                    <div class="d-flex justify-content-between">
                      <span>Arbeitstage pro Woche:</span>
                      <strong id="arbeitstageProWoche">5</strong>
                    </div>
                    <div class="d-flex justify-content-between">
                      <span>Freie Tage pro Woche:</span>
                      <strong id="freieTageProWoche">2</strong>
                    </div>
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
      const modell = this._leseWochenplan();
      
      try {
        await this.dataManager.speichereArbeitszeitmodell(mitarbeiterId, modell);
        showNotification('Erfolg', 'Arbeitszeitmodell gespeichert', 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });

    // Event-Listener initialisieren
    this._initWochenplan();
    this._initPresetButtons();
  }

  /**
   * Erstellt Wochenplan-Zeilen HTML
   */
  _erstelleWochenplanZeilen(bestehendesModell) {
    const wochentage = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const modellMap = new Map();
    
    if (bestehendesModell && bestehendesModell.length > 0) {
      bestehendesModell.forEach(tag => {
        modellMap.set(tag.wochentag, tag.arbeitszeit);
      });
    }

    return wochentage.map((tag, index) => {
      // Standard: Mo-Fr = VOLL, Sa-So = FREI
      let defaultArbeitszeit = 'VOLL';
      if (index >= 5) { // Samstag, Sonntag
        defaultArbeitszeit = 'FREI';
      }
      
      const arbeitszeit = modellMap.get(index) || defaultArbeitszeit;

      return `
        <tr data-wochentag="${index}">
          <td>
            <strong>${tag}</strong>
          </td>
          <td>
            <div class="btn-group w-100" role="group">
              <input type="radio" class="btn-check" name="tag_${index}" id="voll_${index}" 
                     value="VOLL" ${arbeitszeit === 'VOLL' ? 'checked' : ''}>
              <label class="btn btn-outline-success" for="voll_${index}">
                <i class="bi bi-sun"></i> VOLL
              </label>

              <input type="radio" class="btn-check" name="tag_${index}" id="halb_${index}" 
                     value="HALB" ${arbeitszeit === 'HALB' ? 'checked' : ''}>
              <label class="btn btn-outline-warning" for="halb_${index}">
                <i class="bi bi-cloud-sun"></i> HALB
              </label>

              <input type="radio" class="btn-check" name="tag_${index}" id="frei_${index}" 
                     value="FREI" ${arbeitszeit === 'FREI' ? 'checked' : ''}>
              <label class="btn btn-outline-secondary" for="frei_${index}">
                <i class="bi bi-moon"></i> FREI
              </label>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Initialisiert Wochenplan Event-Listener
   */
  _initWochenplan() {
    const tbody = document.getElementById('wochenplanTbody');
    if (!tbody) return;

    // Event-Listener für Radio-Buttons
    tbody.addEventListener('change', (e) => {
      if (e.target.type === 'radio') {
        this._updateUrlaubsberechnungInfo();
      }
    });

    // Initial aktualisieren
    this._updateUrlaubsberechnungInfo();
  }

  /**
   * Aktualisiert Urlaubsberechnungs-Info
   */
  _updateUrlaubsberechnungInfo() {
    const modell = this._leseWochenplan();
    
    let arbeitstage = 0;
    let freieTage = 0;
    
    modell.forEach(tag => {
      if (tag.arbeitszeit === 'VOLL' || tag.arbeitszeit === 'HALB') {
        arbeitstage++;
      } else {
        freieTage++;
      }
    });

    const arbeitstageSpan = document.getElementById('arbeitstageProWoche');
    const freieTageSpan = document.getElementById('freieTageProWoche');
    
    if (arbeitstageSpan) arbeitstageSpan.textContent = arbeitstage;
    if (freieTageSpan) freieTageSpan.textContent = freieTage;
  }

  /**
   * Initialisiert Preset-Buttons
   */
  _initPresetButtons() {
    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        this._wendePresetAn(preset);
        this._updateUrlaubsberechnungInfo();
      });
    });
  }

  /**
   * Wendet ein Preset auf den Wochenplan an
   */
  _wendePresetAn(preset) {
    const wochentage = 7;
    
    for (let i = 0; i < wochentage; i++) {
      let wert = 'FREI';
      
      switch (preset) {
        case '5-tage':
          // Mo-Fr = VOLL, Sa-So = FREI
          wert = i < 5 ? 'VOLL' : 'FREI';
          break;
          
        case '4-tage':
          // Mo-Do = VOLL, Fr-So = FREI
          wert = i < 4 ? 'VOLL' : 'FREI';
          break;
          
        case '6-tage':
          // Mo-Sa = VOLL, So = FREI
          wert = i < 6 ? 'VOLL' : 'FREI';
          break;
          
        case 'reset':
          // Standard: Mo-Fr = VOLL, Sa-So = FREI
          wert = i < 5 ? 'VOLL' : 'FREI';
          break;
      }
      
      // Setze Radio-Button
      const radio = document.querySelector(`input[name="tag_${i}"][value="${wert}"]`);
      if (radio) {
        radio.checked = true;
      }
    }
  }

  /**
   * Liest Wochenplan aus dem Formular
   */
  _leseWochenplan() {
    const modell = [];
    
    for (let i = 0; i < 7; i++) {
      const checked = document.querySelector(`input[name="tag_${i}"]:checked`);
      if (checked) {
        modell.push({
          wochentag: i,
          arbeitszeit: checked.value
        });
      }
    }
    
    return modell;
  }
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArbeitszeitmodellDialog;
}