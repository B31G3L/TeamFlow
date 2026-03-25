/**
 * Übertrag-Dialog
 * Manuelles Anpassen des Übertrags für ein Jahr
 * 
 * NEU: Checkbox ob Übertrag am 31.03. verfällt (Default: ja)
 */

class UebertragDialog extends DialogBase {
  /**
   * Zeigt Dialog zum manuellen Anpassen des Übertrags
   */
  async zeigeUebertragAnpassen(mitarbeiterId, callback) {
    const stat = await this.dataManager.getMitarbeiterStatistik(mitarbeiterId);
    if (!stat) {
      showNotification('Fehler', 'Mitarbeiter nicht gefunden', 'danger');
      return;
    }

    const ma = stat.mitarbeiter;
    const jahr = this.dataManager.aktuellesJahr;
    
    // Prüfe ob bereits manueller Übertrag vorhanden
    const manuell = await this.dataManager.getManuellAngepassterUebertrag(mitarbeiterId, jahr);
    const aktuellAngepasst = manuell !== null;
    const aktuellerWert = aktuellAngepasst ? manuell.uebertrag_tage : stat.uebertrag_vorjahr;

    // Lade aktuelle Verfalls-Einstellung des Mitarbeiters
    const mitarbeiterData = await this.dataManager.getMitarbeiter(mitarbeiterId);
    // Default: 1 = verfällt (true), 0 = verfällt nicht
    const verfaelltAktuell = mitarbeiterData && mitarbeiterData.uebertrag_verfaellt !== undefined
      ? mitarbeiterData.uebertrag_verfaellt === 1
      : true;

    const modalHtml = `
      <div class="modal fade" id="uebertragModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-info text-white">
              <h5 class="modal-title">
                <i class="bi bi-calendar-plus"></i> Übertrag anpassen
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <p><strong>Mitarbeiter:</strong> ${ma.vorname} ${ma.nachname}</p>
                <p><strong>Jahr:</strong> ${jahr}</p>
                <p><strong>Aktueller Übertrag:</strong> ${formatZahl(aktuellerWert)} Tage
                  ${aktuellAngepasst ? '<span class="badge bg-warning text-dark ms-2">Manuell angepasst</span>' : '<span class="badge bg-secondary ms-2">Automatisch berechnet</span>'}
                </p>
              </div>

              ${aktuellAngepasst && manuell.notiz ? `
                <div class="alert alert-info mb-3">
                  <strong>Notiz:</strong> ${manuell.notiz}
                </div>
              ` : ''}

              <form id="uebertragForm">
                <div class="mb-3">
                  <label class="form-label">Neuer Übertrag (Tage) *</label>
                  <input type="number" class="form-control" id="uebertragTage" 
                         value="${formatZahl(aktuellerWert)}" 
                         step="0.5" min="0" max="100" required>
                  <small class="form-text text-muted">
                    Dieser Wert wird für ${jahr} verwendet und überschreibt die automatische Berechnung.
                  </small>
                </div>

                <!-- NEU: Verfalls-Einstellung -->
                <div class="mb-3">
                  <div class="card bg-dark border-secondary">
                    <div class="card-body py-2">
                      <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" 
                               id="uebertragVerfaellt" 
                               ${verfaelltAktuell ? 'checked' : ''}>
                        <label class="form-check-label fw-bold" for="uebertragVerfaellt">
                          Übertrag verfällt am 31.03.${jahr}
                        </label>
                      </div>
                      <small class="text-muted d-block mt-1" id="verfaelltHinweis">
                        ${verfaelltAktuell
                          ? `<i class="bi bi-exclamation-triangle text-warning"></i> Nicht bis 31.03. genutzter Übertrag verfällt automatisch.`
                          : `<i class="bi bi-check-circle text-success"></i> Übertrag läuft nicht ab – bleibt unbegrenzt gültig.`
                        }
                      </small>
                    </div>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Notiz (optional)</label>
                  <textarea class="form-control" id="notiz" rows="2" 
                            placeholder="z.B. Sondervereinbarung, Korrektur...">${aktuellAngepasst && manuell.notiz ? manuell.notiz : ''}</textarea>
                </div>

                ${aktuellAngepasst ? `
                  <div class="form-check mb-3">
                    <input class="form-check-input" type="checkbox" id="zuruecksetzen">
                    <label class="form-check-label" for="zuruecksetzen">
                      Manuelle Anpassung entfernen (zurück zur automatischen Berechnung)
                    </label>
                  </div>
                ` : ''}
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
      const zuruecksetzen = document.getElementById('zuruecksetzen');
      const verfaelltCheckbox = document.getElementById('uebertragVerfaellt');
      const verfaelltWert = verfaelltCheckbox ? (verfaelltCheckbox.checked ? 1 : 0) : 1;

      // Verfalls-Einstellung immer speichern (unabhängig vom Zurücksetzen)
      await this.dataManager.setUebertragVerfaellt(mitarbeiterId, verfaelltWert);
      
      if (zuruecksetzen && zuruecksetzen.checked) {
        // Manuelle Anpassung entfernen
        try {
          await this.dataManager.loescheManuellAngepassterUebertrag(mitarbeiterId, jahr);
          showNotification('Erfolg', 'Übertrag wurde auf automatische Berechnung zurückgesetzt', 'success');
          if (callback) await callback();
          return true;
        } catch (error) {
          showNotification('Fehler', error.message, 'danger');
          return false;
        }
      }

      const form = document.getElementById('uebertragForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const tage = parseFloat(document.getElementById('uebertragTage').value);
      const notiz = document.getElementById('notiz').value.trim() || null;

      try {
        await this.dataManager.setManuellAngepassterUebertrag(mitarbeiterId, jahr, tage, notiz);
        const verfaelltText = verfaelltWert === 1 ? 'verfällt am 31.03.' : 'verfällt nicht';
        showNotification('Erfolg', `Übertrag auf ${formatZahl(tage)} Tage angepasst (${verfaelltText})`, 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });

    // Hinweis-Text beim Umschalten der Checkbox aktualisieren
    setTimeout(() => {
      const checkbox = document.getElementById('uebertragVerfaellt');
      const hinweis = document.getElementById('verfaelltHinweis');
      if (checkbox && hinweis) {
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            hinweis.innerHTML = `<i class="bi bi-exclamation-triangle text-warning"></i> Nicht bis 31.03. genutzter Übertrag verfällt automatisch.`;
          } else {
            hinweis.innerHTML = `<i class="bi bi-check-circle text-success"></i> Übertrag läuft nicht ab – bleibt unbegrenzt gültig.`;
          }
        });
      }
    }, 100);
  }
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UebertragDialog;
}