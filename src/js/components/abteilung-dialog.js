/**
 * Abteilungs-Dialoge
 * Abteilungen hinzufügen, bearbeiten und verwalten
 */

class AbteilungDialog extends DialogBase {
  /**
   * Zeigt Abteilungs-Verwaltungs-Modal
   */
  async zeigeAbteilungenVerwalten(callback) {
    const abteilungen = await this.dataManager.getAlleAbteilungen();

    // Zähle Mitarbeiter pro Abteilung
    const mitarbeiterCount = {};
    for (const abt of abteilungen) {
      const count = await this.dataManager.getMitarbeiterAnzahlInAbteilung(abt.id);
      mitarbeiterCount[abt.id] = count;
    }

    const abteilungRows = abteilungen.map((abt, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>
          <span class="abteilung-badge" style="background-color: ${abt.farbe}">
            ${abt.name}
          </span>
        </td>
        <td>
          <input type="color" class="form-control form-control-color" value="${abt.farbe}" disabled style="width: 40px; height: 30px;">
        </td>
        <td>${abt.beschreibung || '-'}</td>
        <td class="text-center">${mitarbeiterCount[abt.id] || 0}</td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary btn-abt-bearbeiten" data-id="${abt.id}" title="Bearbeiten">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger btn-abt-loeschen" data-id="${abt.id}" 
                    ${mitarbeiterCount[abt.id] > 0 ? 'disabled' : ''} 
                    title="${mitarbeiterCount[abt.id] > 0 ? 'Abteilung hat noch Mitarbeiter' : 'Löschen'}">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    const modalHtml = `
      <div class="modal fade" id="abteilungenVerwaltungModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-building"></i> Abteilungen verwalten
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <button class="btn btn-success" id="btnNeueAbteilung">
                  <i class="bi bi-plus-circle"></i> Neue Abteilung
                </button>
              </div>
              <div class="table-responsive">
                <table class="table table-hover table-striped">
                  <thead class="table-dark">
                    <tr>
                      <th>Nr.</th>
                      <th>Name</th>
                      <th>Farbe</th>
                      <th>Beschreibung</th>
                      <th class="text-center">Mitarbeiter</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody id="abteilungenTabelleBody">
                    ${abteilungRows}
                  </tbody>
                </table>
              </div>
              ${abteilungen.length === 0 ? `
                <div class="text-center text-muted py-4">
                  <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                  Keine Abteilungen vorhanden
                </div>
              ` : ''}
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
    const modalElement = document.querySelector('#abteilungenVerwaltungModal');
    const modal = new bootstrap.Modal(modalElement);

    // Event-Listener für Neue Abteilung
    modalElement.querySelector('#btnNeueAbteilung').addEventListener('click', async () => {
      modal.hide();
      await this.zeigeAbteilungHinzufuegen(async () => {
        if (callback) await callback();
        setTimeout(() => this.zeigeAbteilungenVerwalten(callback), 300);
      });
    });

    // Event-Listener für Bearbeiten und Löschen
    const tabelleBody = modalElement.querySelector('#abteilungenTabelleBody');

    tabelleBody.addEventListener('click', async (e) => {
      const bearbeitenBtn = e.target.closest('.btn-abt-bearbeiten');
      const loeschenBtn = e.target.closest('.btn-abt-loeschen');

      if (bearbeitenBtn) {
        const abteilungId = parseInt(bearbeitenBtn.dataset.id);
        modal.hide();

        await this.zeigeAbteilungBearbeiten(abteilungId, async () => {
          if (callback) await callback();
          setTimeout(() => this.zeigeAbteilungenVerwalten(callback), 300);
        });
      } else if (loeschenBtn && !loeschenBtn.disabled) {
        const abteilungId = parseInt(loeschenBtn.dataset.id);
        const abteilung = abteilungen.find(a => a.id === abteilungId);

        if (confirm(`Möchten Sie die Abteilung "${abteilung.name}" wirklich löschen?`)) {
          try {
            await this.dataManager.abteilungLoeschen(abteilungId);
            showNotification('Erfolg', `Abteilung "${abteilung.name}" wurde gelöscht`, 'success');
            modal.hide();
            if (callback) await callback();
            setTimeout(() => this.zeigeAbteilungenVerwalten(callback), 300);
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

  /**
   * Erstellt Farb-Presets HTML
   */
  _getFarbPresetsHTML() {
    return `
      <div class="mt-2">
        <small class="text-muted">Schnellauswahl:</small>
        <div class="d-flex gap-2 mt-1 flex-wrap">
          <button type="button" class="btn btn-sm farbe-preset" style="background-color: #dc3545; width: 30px; height: 30px; border: none;" data-farbe="#dc3545"></button>
          <button type="button" class="btn btn-sm farbe-preset" style="background-color: #1f538d; width: 30px; height: 30px; border: none;" data-farbe="#1f538d"></button>
          <button type="button" class="btn btn-sm farbe-preset" style="background-color: #28a745; width: 30px; height: 30px; border: none;" data-farbe="#28a745"></button>
          <button type="button" class="btn btn-sm farbe-preset" style="background-color: #ffc107; width: 30px; height: 30px; border: none;" data-farbe="#ffc107"></button>
          <button type="button" class="btn btn-sm farbe-preset" style="background-color: #17a2b8; width: 30px; height: 30px; border: none;" data-farbe="#17a2b8"></button>
          <button type="button" class="btn btn-sm farbe-preset" style="background-color: #6f42c1; width: 30px; height: 30px; border: none;" data-farbe="#6f42c1"></button>
          <button type="button" class="btn btn-sm farbe-preset" style="background-color: #fd7e14; width: 30px; height: 30px; border: none;" data-farbe="#fd7e14"></button>
          <button type="button" class="btn btn-sm farbe-preset" style="background-color: #20c997; width: 30px; height: 30px; border: none;" data-farbe="#20c997"></button>
          <button type="button" class="btn btn-sm farbe-preset" style="background-color: #e83e8c; width: 30px; height: 30px; border: none;" data-farbe="#e83e8c"></button>
          <button type="button" class="btn btn-sm farbe-preset" style="background-color: #6c757d; width: 30px; height: 30px; border: none;" data-farbe="#6c757d"></button>
        </div>
      </div>
    `;
  }

  /**
   * Initialisiert Farb-Event-Listener
   */
  _initFarbEventListener() {
    const farbeInput = document.getElementById('abteilungFarbe');
    const nameInput = document.getElementById('abteilungName');
    const preview = document.getElementById('abteilungPreview');
    const farbePreview = document.getElementById('farbePreview');

    if (farbeInput && preview) {
      farbeInput.addEventListener('input', () => {
        preview.style.backgroundColor = farbeInput.value;
        farbePreview.textContent = farbeInput.value;
      });

      nameInput.addEventListener('input', () => {
        preview.textContent = nameInput.value || 'Abteilung';
      });

      // Farb-Presets
      document.querySelectorAll('.farbe-preset').forEach(btn => {
        btn.addEventListener('click', () => {
          const farbe = btn.dataset.farbe;
          farbeInput.value = farbe;
          preview.style.backgroundColor = farbe;
          farbePreview.textContent = farbe;
        });
      });
    }
  }

  /**
   * Zeigt Dialog zum Hinzufügen einer neuen Abteilung
   */
  async zeigeAbteilungHinzufuegen(callback) {
    const modalHtml = `
      <div class="modal fade" id="abteilungHinzufuegenModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-success text-white">
              <h5 class="modal-title">
                <i class="bi bi-plus-circle"></i> Neue Abteilung
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="abteilungForm">
                <div class="mb-3">
                  <label class="form-label">Name *</label>
                  <input type="text" class="form-control" id="abteilungName" required 
                         placeholder="z.B. Werkstatt, Büro, Lager...">
                </div>

                <div class="mb-3">
                  <label class="form-label">Farbe *</label>
                  <div class="d-flex align-items-center gap-3">
                    <input type="color" class="form-control form-control-color" id="abteilungFarbe" 
                           value="#1f538d" style="width: 60px; height: 40px;">
                    <span class="text-muted" id="farbePreview">#1f538d</span>
                  </div>
                  ${this._getFarbPresetsHTML()}
                </div>

                <div class="mb-3">
                  <label class="form-label">Beschreibung</label>
                  <textarea class="form-control" id="abteilungBeschreibung" rows="2" 
                            placeholder="Optionale Beschreibung..."></textarea>
                </div>

                <div class="mb-3">
                  <label class="form-label">Vorschau</label>
                  <div>
                    <span class="abteilung-badge" id="abteilungPreview" style="background-color: #1f538d">
                      Abteilung
                    </span>
                  </div>
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
      const form = document.getElementById('abteilungForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const daten = {
        name: document.getElementById('abteilungName').value.trim(),
        farbe: document.getElementById('abteilungFarbe').value,
        beschreibung: document.getElementById('abteilungBeschreibung').value.trim() || null
      };

      try {
        await this.dataManager.abteilungHinzufuegen(daten);
        showNotification('Erfolg', `Abteilung "${daten.name}" wurde angelegt!`, 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });

    setTimeout(() => this._initFarbEventListener(), 100);
  }

  /**
   * Zeigt Dialog zum Bearbeiten einer Abteilung
   */
  async zeigeAbteilungBearbeiten(abteilungId, callback) {
    const abteilung = await this.dataManager.getAbteilung(abteilungId);

    if (!abteilung) {
      showNotification('Fehler', 'Abteilung nicht gefunden', 'danger');
      return;
    }

    const modalHtml = `
      <div class="modal fade" id="abteilungBearbeitenModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">
                <i class="bi bi-pencil-square"></i> Abteilung bearbeiten
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="abteilungBearbeitenForm">
                <div class="mb-3">
                  <label class="form-label">Name *</label>
                  <input type="text" class="form-control" id="abteilungName" value="${abteilung.name}" required>
                </div>

                <div class="mb-3">
                  <label class="form-label">Farbe *</label>
                  <div class="d-flex align-items-center gap-3">
                    <input type="color" class="form-control form-control-color" id="abteilungFarbe" 
                           value="${abteilung.farbe}" style="width: 60px; height: 40px;">
                    <span class="text-muted" id="farbePreview">${abteilung.farbe}</span>
                  </div>
                  ${this._getFarbPresetsHTML()}
                </div>

                <div class="mb-3">
                  <label class="form-label">Beschreibung</label>
                  <textarea class="form-control" id="abteilungBeschreibung" rows="2">${abteilung.beschreibung || ''}</textarea>
                </div>

                <div class="mb-3">
                  <label class="form-label">Vorschau</label>
                  <div>
                    <span class="abteilung-badge" id="abteilungPreview" style="background-color: ${abteilung.farbe}">
                      ${abteilung.name}
                    </span>
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
      const form = document.getElementById('abteilungBearbeitenForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const daten = {
        name: document.getElementById('abteilungName').value.trim(),
        farbe: document.getElementById('abteilungFarbe').value,
        beschreibung: document.getElementById('abteilungBeschreibung').value.trim() || null
      };

      try {
        await this.dataManager.abteilungAktualisieren(abteilungId, daten);
        showNotification('Erfolg', `Abteilung "${daten.name}" wurde aktualisiert!`, 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });

    setTimeout(() => this._initFarbEventListener(), 100);
  }
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AbteilungDialog;
}