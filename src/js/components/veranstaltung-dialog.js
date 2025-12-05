/**
 * Veranstaltung-Dialog
 * Veranstaltungen hinzufügen, bearbeiten und verwalten
 * 
 * FIX: Korrekte Behandlung der db.query() Rückgabewerte
 */

class VeranstaltungDialog extends DialogBase {
  /**
   * Zeigt Veranstaltungs-Verwaltungs-Modal
   */
  async zeigeVeranstaltungVerwalten(callback) {
    const jahr = this.dataManager.aktuellesJahr;
    
    // FIX: Korrekte Extraktion der Daten aus dem Result-Objekt
    const result = await this.dataManager.db.query(`
      SELECT * FROM veranstaltungen 
      WHERE strftime('%Y', von_datum) = ? OR strftime('%Y', bis_datum) = ?
      ORDER BY von_datum
    `, [jahr.toString(), jahr.toString()]);

    const veranstaltungen = result.success ? result.data : [];

    const veranstaltungRows = veranstaltungen.map((va, index) => {
      // FIX: Datum korrekt parsen ohne Zeitzonen-Verschiebung
      const vonDatum = this._formatDatumLokal(va.von_datum);
      const bisDatum = this._formatDatumLokal(va.bis_datum);
      const dauerTage = this._berechneTage(va.von_datum, va.bis_datum);

      return `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${va.titel}</strong></td>
          <td>${vonDatum}</td>
          <td>${bisDatum}</td>
          <td class="text-center">${dauerTage}</td>
          <td>${va.beschreibung || '-'}</td>
          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary btn-va-bearbeiten" data-id="${va.id}" title="Bearbeiten">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger btn-va-loeschen" data-id="${va.id}" title="Löschen">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    const modalHtml = `
      <div class="modal fade" id="veranstaltungenVerwaltungModal" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header bg-info text-white">
              <h5 class="modal-title">
                <i class="bi bi-calendar-event"></i> Veranstaltungen verwalten (${jahr})
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <button class="btn btn-success" id="btnNeueVeranstaltung">
                  <i class="bi bi-plus-circle"></i> Neue Veranstaltung
                </button>
              </div>

              <div class="table-responsive">
                <table class="table table-hover table-striped">
                  <thead class="table-dark">
                    <tr>
                      <th>Nr.</th>
                      <th>Titel</th>
                      <th>Von</th>
                      <th>Bis</th>
                      <th class="text-center">Tage</th>
                      <th>Beschreibung</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody id="veranstaltungenTabelle">
                    ${veranstaltungRows}
                  </tbody>
                </table>
              </div>
              ${veranstaltungen.length === 0 ? `
                <div class="text-center text-muted py-4">
                  <i class="bi bi-calendar-x fs-1 d-block mb-2"></i>
                  Keine Veranstaltungen für ${jahr} vorhanden
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
    oldModals.forEach(m => {
      const existingModal = bootstrap.Modal.getInstance(m);
      if (existingModal) existingModal.dispose();
      m.remove();
    });

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modalElement = document.querySelector('#veranstaltungenVerwaltungModal');
    const modal = new bootstrap.Modal(modalElement);

    // Event-Listener für Neue Veranstaltung
    modalElement.querySelector('#btnNeueVeranstaltung').addEventListener('click', async () => {
      modal.hide();
      await this.zeigeVeranstaltungHinzufuegen(async () => {
        if (callback) await callback();
        setTimeout(() => this.zeigeVeranstaltungVerwalten(callback), 300);
      });
    });

    // Event-Listener für Bearbeiten und Löschen
    const tabelleBody = modalElement.querySelector('#veranstaltungenTabelle');

    tabelleBody.addEventListener('click', async (e) => {
      const bearbeitenBtn = e.target.closest('.btn-va-bearbeiten');
      const loeschenBtn = e.target.closest('.btn-va-loeschen');

      if (bearbeitenBtn) {
        const veranstaltungId = parseInt(bearbeitenBtn.dataset.id);
        modal.hide();

        await this.zeigeVeranstaltungBearbeiten(veranstaltungId, async () => {
          if (callback) await callback();
          setTimeout(() => this.zeigeVeranstaltungVerwalten(callback), 300);
        });
      } else if (loeschenBtn) {
        const veranstaltungId = parseInt(loeschenBtn.dataset.id);
        const veranstaltung = veranstaltungen.find(v => v.id === veranstaltungId);

        if (confirm(`Möchten Sie die Veranstaltung "${veranstaltung.titel}" wirklich löschen?`)) {
          try {
            const deleteResult = await this.dataManager.db.run('DELETE FROM veranstaltungen WHERE id = ?', [veranstaltungId]);
            if (!deleteResult.success) {
              throw new Error(deleteResult.error);
            }
            showNotification('Erfolg', `Veranstaltung "${veranstaltung.titel}" wurde gelöscht`, 'success');
            modal.hide();
            if (callback) await callback();
            setTimeout(() => this.zeigeVeranstaltungVerwalten(callback), 300);
          } catch (error) {
            showNotification('Fehler', error.message, 'danger');
          }
        }
      }
    });

    modal.show();

    modalElement.addEventListener('hidden.bs.modal', () => {
      modal.dispose();
      modalElement.remove();
    });
  }

  /**
   * Formatiert ein Datum lokal ohne Zeitzonen-Verschiebung
   * FIX: Verhindert das "einen Tag später"-Problem
   */
  _formatDatumLokal(datumStr) {
    if (!datumStr) return '-';
    // Datum als lokales Datum parsen (nicht als UTC)
    const [jahr, monat, tag] = datumStr.split('-').map(Number);
    return `${String(tag).padStart(2, '0')}.${String(monat).padStart(2, '0')}.${jahr}`;
  }

  /**
   * Berechnet die Anzahl der Tage zwischen zwei Daten
   */
  _berechneTage(vonDatum, bisDatum) {
    const [vonJahr, vonMonat, vonTag] = vonDatum.split('-').map(Number);
    const [bisJahr, bisMonat, bisTag] = bisDatum.split('-').map(Number);
    
    const von = new Date(vonJahr, vonMonat - 1, vonTag);
    const bis = new Date(bisJahr, bisMonat - 1, bisTag);
    
    return Math.ceil((bis - von) / (1000 * 60 * 60 * 24)) + 1;
  }

  /**
   * Zeigt Dialog zum Hinzufügen einer neuen Veranstaltung
   */
  async zeigeVeranstaltungHinzufuegen(callback) {
    const heute = new Date();
    const formatDate = (date) => date.toISOString().split('T')[0];

    const modalHtml = `
      <div class="modal fade" id="veranstaltungHinzufuegenModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-success text-white">
              <h5 class="modal-title">
                <i class="bi bi-plus-circle"></i> Neue Veranstaltung
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="veranstaltungForm">
                <div class="mb-3">
                  <label class="form-label">Titel *</label>
                  <input type="text" class="form-control" id="veranstaltungTitel" required 
                         placeholder="z.B. Weihnachtsfeier, Sommerfest, Messebesuch...">
                </div>

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
                  <label class="form-label">Dauer: <span id="dauerAnzeige" class="fw-bold">1</span> Tag(e)</label>
                  <div class="mt-2">
                    <small class="text-muted d-block mb-1">Schnellauswahl:</small>
                    <div class="d-flex gap-2 flex-wrap">
                      <button type="button" class="btn btn-sm btn-outline-info dauer-btn" data-tage="1">1 Tag</button>
                      <button type="button" class="btn btn-sm btn-outline-info dauer-btn" data-tage="2">2 Tage</button>
                      <button type="button" class="btn btn-sm btn-outline-info dauer-btn" data-tage="3">3 Tage</button>
                      <button type="button" class="btn btn-sm btn-outline-info dauer-btn" data-tage="5">5 Tage</button>
                      <button type="button" class="btn btn-sm btn-outline-info dauer-btn" data-tage="7">1 Woche</button>
                      <button type="button" class="btn btn-sm btn-outline-info dauer-btn" data-tage="14">2 Wochen</button>
                    </div>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Beschreibung</label>
                  <textarea class="form-control" id="veranstaltungBeschreibung" rows="3" 
                            placeholder="Optionale Beschreibung, Details, Ort..."></textarea>
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
      const form = document.getElementById('veranstaltungForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const daten = {
        titel: document.getElementById('veranstaltungTitel').value.trim(),
        von_datum: document.getElementById('vonDatum').value,
        bis_datum: document.getElementById('bisDatum').value,
        beschreibung: document.getElementById('veranstaltungBeschreibung').value.trim() || null
      };

      try {
        const result = await this.dataManager.db.run(`
          INSERT INTO veranstaltungen (von_datum, bis_datum, titel, beschreibung, typ)
          VALUES (?, ?, ?, ?, 'SONSTIGES')
        `, [daten.von_datum, daten.bis_datum, daten.titel, daten.beschreibung]);

        if (!result.success) {
          throw new Error(result.error);
        }

        showNotification('Erfolg', `Veranstaltung "${daten.titel}" wurde angelegt!`, 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });

    // Event-Listener für Datum-Validierung
    setTimeout(() => {
      const vonDatumInput = document.getElementById('vonDatum');
      const bisDatumInput = document.getElementById('bisDatum');
      const dauerAnzeige = document.getElementById('dauerAnzeige');

      if (!vonDatumInput || !bisDatumInput || !dauerAnzeige) return;

      const berechneDauer = () => {
        const von = vonDatumInput.value;
        const bis = bisDatumInput.value;
        
        if (!von || !bis) return;
        
        if (bis < von) {
          bisDatumInput.value = von;
          dauerAnzeige.textContent = '1';
        } else {
          const tage = this._berechneTage(von, bis);
          dauerAnzeige.textContent = tage;
        }
      };

      vonDatumInput.addEventListener('change', () => {
        if (bisDatumInput.value < vonDatumInput.value) {
          bisDatumInput.value = vonDatumInput.value;
        }
        bisDatumInput.min = vonDatumInput.value;
        berechneDauer();
      });

      bisDatumInput.addEventListener('change', berechneDauer);
      bisDatumInput.min = vonDatumInput.value;

      // Dauer-Buttons
      document.querySelectorAll('.dauer-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tage = parseInt(btn.dataset.tage);
          const von = vonDatumInput.value;
          if (!von) return;
          
          // Berechne Bis-Datum korrekt
          const [jahr, monat, tag] = von.split('-').map(Number);
          const vonDate = new Date(jahr, monat - 1, tag);
          vonDate.setDate(vonDate.getDate() + tage - 1);
          
          const bisJahr = vonDate.getFullYear();
          const bisMonat = String(vonDate.getMonth() + 1).padStart(2, '0');
          const bisTag = String(vonDate.getDate()).padStart(2, '0');
          
          bisDatumInput.value = `${bisJahr}-${bisMonat}-${bisTag}`;
          dauerAnzeige.textContent = tage;
        });
      });
    }, 100);
  }

  /**
   * Zeigt Dialog zum Bearbeiten einer Veranstaltung
   */
  async zeigeVeranstaltungBearbeiten(veranstaltungId, callback) {
    // FIX: Korrekte Extraktion der Daten
    const result = await this.dataManager.db.get('SELECT * FROM veranstaltungen WHERE id = ?', [veranstaltungId]);
    
    if (!result.success || !result.data) {
      showNotification('Fehler', 'Veranstaltung nicht gefunden', 'danger');
      return;
    }

    const veranstaltung = result.data;

    const modalHtml = `
      <div class="modal fade" id="veranstaltungBearbeitenModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">
                <i class="bi bi-pencil-square"></i> Veranstaltung bearbeiten
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="veranstaltungBearbeitenForm">
                <div class="mb-3">
                  <label class="form-label">Titel *</label>
                  <input type="text" class="form-control" id="veranstaltungTitel" value="${veranstaltung.titel}" required>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Von *</label>
                    <input type="date" class="form-control" id="vonDatum" value="${veranstaltung.von_datum}" required>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Bis *</label>
                    <input type="date" class="form-control" id="bisDatum" value="${veranstaltung.bis_datum}" required>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Dauer: <span id="dauerAnzeige" class="fw-bold">1</span> Tag(e)</label>
                </div>

                <div class="mb-3">
                  <label class="form-label">Beschreibung</label>
                  <textarea class="form-control" id="veranstaltungBeschreibung" rows="3">${veranstaltung.beschreibung || ''}</textarea>
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
      const form = document.getElementById('veranstaltungBearbeitenForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const daten = {
        titel: document.getElementById('veranstaltungTitel').value.trim(),
        von_datum: document.getElementById('vonDatum').value,
        bis_datum: document.getElementById('bisDatum').value,
        beschreibung: document.getElementById('veranstaltungBeschreibung').value.trim() || null
      };

      try {
        const updateResult = await this.dataManager.db.run(`
          UPDATE veranstaltungen 
          SET von_datum = ?, bis_datum = ?, titel = ?, beschreibung = ?
          WHERE id = ?
        `, [daten.von_datum, daten.bis_datum, daten.titel, daten.beschreibung, veranstaltungId]);

        if (!updateResult.success) {
          throw new Error(updateResult.error);
        }

        showNotification('Erfolg', `Veranstaltung "${daten.titel}" wurde aktualisiert!`, 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });

    // Event-Listener für Datum-Validierung
    setTimeout(() => {
      const vonDatumInput = document.getElementById('vonDatum');
      const bisDatumInput = document.getElementById('bisDatum');
      const dauerAnzeige = document.getElementById('dauerAnzeige');

      if (!vonDatumInput || !bisDatumInput || !dauerAnzeige) return;

      const berechneDauer = () => {
        const von = vonDatumInput.value;
        const bis = bisDatumInput.value;
        
        if (!von || !bis) return;
        
        const tage = this._berechneTage(von, bis);
        dauerAnzeige.textContent = Math.max(1, tage);
      };

      vonDatumInput.addEventListener('change', () => {
        if (bisDatumInput.value < vonDatumInput.value) {
          bisDatumInput.value = vonDatumInput.value;
        }
        bisDatumInput.min = vonDatumInput.value;
        berechneDauer();
      });

      bisDatumInput.addEventListener('change', berechneDauer);

      // Initial berechnen
      berechneDauer();
    }, 100);
  }
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VeranstaltungDialog;
}