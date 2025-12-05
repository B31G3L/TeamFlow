/**
 * Feiertag-Dialog
 * Feiertage hinzufügen, bearbeiten und verwalten
 * 
 * FIXES:
 * - Zeitzonen-Problem behoben (Datum wird nicht mehr einen Tag verschoben)
 * - Verbesserte Fehlerbehandlung beim Import von Standard-Feiertagen
 * - Korrekte db.query() Rückgabewert-Behandlung
 */

class FeiertagDialog extends DialogBase {
  /**
   * Formatiert ein Datum lokal ohne Zeitzonen-Verschiebung
   * FIX: Verhindert das "einen Tag später"-Problem
   */
  _formatDatumLokal(datumStr) {
    if (!datumStr) return '-';
    // Datum als String parsen, nicht als Date-Objekt (vermeidet UTC-Konvertierung)
    const [jahr, monat, tag] = datumStr.split('-').map(Number);
    const wochentage = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const datum = new Date(jahr, monat - 1, tag);
    const wochentag = wochentage[datum.getDay()];
    return `${wochentag}, ${String(tag).padStart(2, '0')}.${String(monat).padStart(2, '0')}.${jahr}`;
  }

  /**
   * Zeigt Feiertage-Verwaltungs-Modal
   */
  async zeigeFeiertagVerwalten(callback) {
    const jahr = this.dataManager.aktuellesJahr;
    
    // FIX: Korrekte Extraktion der Daten
    let feiertage = [];
    try {
      const result = await this.dataManager.db.query(`
        SELECT * FROM feiertage 
        WHERE strftime('%Y', datum) = ?
        ORDER BY datum
      `, [jahr.toString()]);
      
      if (result.success) {
        feiertage = result.data || [];
      } else {
        console.error('Fehler beim Laden der Feiertage:', result.error);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Feiertage:', error);
    }

    const feiertagRows = feiertage.map((ft, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${this._formatDatumLokal(ft.datum)}</td>
        <td>${ft.name}</td>
        <td>${ft.bundesland || 'Bundesweit'}</td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary btn-ft-bearbeiten" data-id="${ft.id}" title="Bearbeiten">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger btn-ft-loeschen" data-id="${ft.id}" title="Löschen">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    const modalHtml = `
      <div class="modal fade" id="feiertageVerwaltungModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-danger text-white">
              <h5 class="modal-title">
                <i class="bi bi-calendar3"></i> Feiertage verwalten (${jahr})
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="d-flex gap-2 mb-3">
                <button class="btn btn-success" id="btnNeuerFeiertag">
                  <i class="bi bi-plus-circle"></i> Neuer Feiertag
                </button>
                <button class="btn btn-outline-primary" id="btnStandardFeiertage">
                  <i class="bi bi-calendar-check"></i> Deutsche Feiertage ${jahr} laden
                </button>
              </div>
              <div class="alert alert-info" role="alert">
                <i class="bi bi-info-circle"></i> <strong>Hinweis:</strong> 
                Feiertage werden bei der Urlaubsplanung automatisch berücksichtigt und von den Urlaubstagen abgezogen.
              </div>
              <div class="table-responsive">
                <table class="table table-hover table-striped">
                  <thead class="table-dark">
                    <tr>
                      <th>Nr.</th>
                      <th>Datum</th>
                      <th>Name</th>
                      <th>Bundesland</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody id="feiertageTabelle">
                    ${feiertagRows}
                  </tbody>
                </table>
              </div>
              ${feiertage.length === 0 ? `
                <div class="text-center text-muted py-4">
                  <i class="bi bi-calendar-x fs-1 d-block mb-2"></i>
                  Keine Feiertage für ${jahr} vorhanden
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

    const modalElement = document.querySelector('#feiertageVerwaltungModal');
    const modal = new bootstrap.Modal(modalElement);

    // Event-Listener für Neuer Feiertag
    modalElement.querySelector('#btnNeuerFeiertag').addEventListener('click', async () => {
      modal.hide();
      await this.zeigeFeiertagHinzufuegen(async () => {
        if (callback) await callback();
        setTimeout(() => this.zeigeFeiertagVerwalten(callback), 300);
      });
    });

    // Event-Listener für Standard-Feiertage laden
    const btnStandardFeiertage = modalElement.querySelector('#btnStandardFeiertage');
    btnStandardFeiertage.addEventListener('click', async () => {
      if (confirm(`Möchten Sie die deutschen Feiertage für ${jahr} laden? Bereits vorhandene Feiertage werden nicht überschrieben.`)) {
        // FIX: Loading-State für Button
        btnStandardFeiertage.disabled = true;
        btnStandardFeiertage.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Laden...';
        
        try {
          const result = await this.ladeStandardFeiertage(jahr);
          // Cache invalidieren
          invalidiereFeiertageCache();
          showNotification('Erfolg', `Deutsche Feiertage für ${jahr} wurden geladen (${result.added} hinzugefügt, ${result.skipped} bereits vorhanden)`, 'success');
          modal.hide();
          if (callback) await callback();
          setTimeout(() => this.zeigeFeiertagVerwalten(callback), 300);
        } catch (error) {
          console.error('Fehler beim Laden der Standard-Feiertage:', error);
          showNotification('Fehler', `Feiertage konnten nicht geladen werden: ${error.message}`, 'danger');
        } finally {
          btnStandardFeiertage.disabled = false;
          btnStandardFeiertage.innerHTML = `<i class="bi bi-calendar-check"></i> Deutsche Feiertage ${jahr} laden`;
        }
      }
    });

    // Event-Listener für Bearbeiten und Löschen
    const tabelleBody = modalElement.querySelector('#feiertageTabelle');

    tabelleBody.addEventListener('click', async (e) => {
      const bearbeitenBtn = e.target.closest('.btn-ft-bearbeiten');
      const loeschenBtn = e.target.closest('.btn-ft-loeschen');

      if (bearbeitenBtn) {
        const feiertagId = parseInt(bearbeitenBtn.dataset.id);
        modal.hide();

        await this.zeigeFeiertagBearbeiten(feiertagId, async () => {
          if (callback) await callback();
          setTimeout(() => this.zeigeFeiertagVerwalten(callback), 300);
        });
      } else if (loeschenBtn) {
        const feiertagId = parseInt(loeschenBtn.dataset.id);
        const feiertag = feiertage.find(f => f.id === feiertagId);

        if (confirm(`Möchten Sie den Feiertag "${feiertag.name}" wirklich löschen?`)) {
          try {
            const result = await this.dataManager.db.run('DELETE FROM feiertage WHERE id = ?', [feiertagId]);
            if (!result.success) {
              throw new Error(result.error);
            }
            // Cache invalidieren
            invalidiereFeiertageCache();
            showNotification('Erfolg', `Feiertag "${feiertag.name}" wurde gelöscht`, 'success');
            modal.hide();
            if (callback) await callback();
            setTimeout(() => this.zeigeFeiertagVerwalten(callback), 300);
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
   * Zeigt Dialog zum Hinzufügen eines neuen Feiertags
   */
  async zeigeFeiertagHinzufuegen(callback) {
    const jahr = this.dataManager.aktuellesJahr;

    const modalHtml = `
      <div class="modal fade" id="feiertagHinzufuegenModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-success text-white">
              <h5 class="modal-title">
                <i class="bi bi-plus-circle"></i> Neuer Feiertag
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="feiertagForm">
                <div class="mb-3">
                  <label class="form-label">Datum *</label>
                  <input type="date" class="form-control" id="feiertagDatum" value="${jahr}-01-01" required>
                </div>

                <div class="mb-3">
                  <label class="form-label">Name *</label>
                  <input type="text" class="form-control" id="feiertagName" required 
                         placeholder="z.B. Neujahr, Karfreitag, Tag der Arbeit...">
                </div>

                <div class="mb-3">
                  <label class="form-label">Bundesland</label>
                  <select class="form-select" id="feiertagBundesland">
                    <option value="">Bundesweit</option>
                    <option value="BW">Baden-Württemberg</option>
                    <option value="BY">Bayern</option>
                    <option value="BE">Berlin</option>
                    <option value="BB">Brandenburg</option>
                    <option value="HB">Bremen</option>
                    <option value="HH">Hamburg</option>
                    <option value="HE">Hessen</option>
                    <option value="MV">Mecklenburg-Vorpommern</option>
                    <option value="NI">Niedersachsen</option>
                    <option value="NW">Nordrhein-Westfalen</option>
                    <option value="RP">Rheinland-Pfalz</option>
                    <option value="SL">Saarland</option>
                    <option value="SN">Sachsen</option>
                    <option value="ST">Sachsen-Anhalt</option>
                    <option value="SH">Schleswig-Holstein</option>
                    <option value="TH">Thüringen</option>
                  </select>
                </div>

                <div class="mb-3">
                  <label class="form-label">Beschreibung</label>
                  <textarea class="form-control" id="feiertagBeschreibung" rows="2" 
                            placeholder="Optionale Beschreibung..."></textarea>
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
      const form = document.getElementById('feiertagForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const daten = {
        datum: document.getElementById('feiertagDatum').value,
        name: document.getElementById('feiertagName').value.trim(),
        bundesland: document.getElementById('feiertagBundesland').value || null,
        beschreibung: document.getElementById('feiertagBeschreibung').value.trim() || null
      };

      try {
        const result = await this.dataManager.db.run(`
          INSERT INTO feiertage (datum, name, bundesland, beschreibung)
          VALUES (?, ?, ?, ?)
        `, [daten.datum, daten.name, daten.bundesland, daten.beschreibung]);

        if (!result.success) {
          if (result.error && result.error.includes('UNIQUE')) {
            throw new Error('An diesem Datum existiert bereits ein Feiertag');
          }
          throw new Error(result.error);
        }

        // Cache invalidieren
        invalidiereFeiertageCache();
        
        showNotification('Erfolg', `Feiertag "${daten.name}" wurde angelegt!`, 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });
  }

  /**
   * Zeigt Dialog zum Bearbeiten eines Feiertags
   */
  async zeigeFeiertagBearbeiten(feiertagId, callback) {
    // FIX: Korrekte Extraktion
    let feiertag = null;
    try {
      const result = await this.dataManager.db.get('SELECT * FROM feiertage WHERE id = ?', [feiertagId]);
      if (result.success) {
        feiertag = result.data;
      }
    } catch (error) {
      console.error('Fehler beim Laden des Feiertags:', error);
    }

    if (!feiertag) {
      showNotification('Fehler', 'Feiertag nicht gefunden', 'danger');
      return;
    }

    const modalHtml = `
      <div class="modal fade" id="feiertagBearbeitenModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">
                <i class="bi bi-pencil-square"></i> Feiertag bearbeiten
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="feiertagBearbeitenForm">
                <div class="mb-3">
                  <label class="form-label">Datum *</label>
                  <input type="date" class="form-control" id="feiertagDatum" value="${feiertag.datum}" required>
                </div>

                <div class="mb-3">
                  <label class="form-label">Name *</label>
                  <input type="text" class="form-control" id="feiertagName" value="${feiertag.name}" required>
                </div>

                <div class="mb-3">
                  <label class="form-label">Bundesland</label>
                  <select class="form-select" id="feiertagBundesland">
                    <option value="" ${!feiertag.bundesland ? 'selected' : ''}>Bundesweit</option>
                    <option value="BW" ${feiertag.bundesland === 'BW' ? 'selected' : ''}>Baden-Württemberg</option>
                    <option value="BY" ${feiertag.bundesland === 'BY' ? 'selected' : ''}>Bayern</option>
                    <option value="BE" ${feiertag.bundesland === 'BE' ? 'selected' : ''}>Berlin</option>
                    <option value="BB" ${feiertag.bundesland === 'BB' ? 'selected' : ''}>Brandenburg</option>
                    <option value="HB" ${feiertag.bundesland === 'HB' ? 'selected' : ''}>Bremen</option>
                    <option value="HH" ${feiertag.bundesland === 'HH' ? 'selected' : ''}>Hamburg</option>
                    <option value="HE" ${feiertag.bundesland === 'HE' ? 'selected' : ''}>Hessen</option>
                    <option value="MV" ${feiertag.bundesland === 'MV' ? 'selected' : ''}>Mecklenburg-Vorpommern</option>
                    <option value="NI" ${feiertag.bundesland === 'NI' ? 'selected' : ''}>Niedersachsen</option>
                    <option value="NW" ${feiertag.bundesland === 'NW' ? 'selected' : ''}>Nordrhein-Westfalen</option>
                    <option value="RP" ${feiertag.bundesland === 'RP' ? 'selected' : ''}>Rheinland-Pfalz</option>
                    <option value="SL" ${feiertag.bundesland === 'SL' ? 'selected' : ''}>Saarland</option>
                    <option value="SN" ${feiertag.bundesland === 'SN' ? 'selected' : ''}>Sachsen</option>
                    <option value="ST" ${feiertag.bundesland === 'ST' ? 'selected' : ''}>Sachsen-Anhalt</option>
                    <option value="SH" ${feiertag.bundesland === 'SH' ? 'selected' : ''}>Schleswig-Holstein</option>
                    <option value="TH" ${feiertag.bundesland === 'TH' ? 'selected' : ''}>Thüringen</option>
                  </select>
                </div>

                <div class="mb-3">
                  <label class="form-label">Beschreibung</label>
                  <textarea class="form-control" id="feiertagBeschreibung" rows="2">${feiertag.beschreibung || ''}</textarea>
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
      const form = document.getElementById('feiertagBearbeitenForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const daten = {
        datum: document.getElementById('feiertagDatum').value,
        name: document.getElementById('feiertagName').value.trim(),
        bundesland: document.getElementById('feiertagBundesland').value || null,
        beschreibung: document.getElementById('feiertagBeschreibung').value.trim() || null
      };

      try {
        const result = await this.dataManager.db.run(`
          UPDATE feiertage 
          SET datum = ?, name = ?, bundesland = ?, beschreibung = ?
          WHERE id = ?
        `, [daten.datum, daten.name, daten.bundesland, daten.beschreibung, feiertagId]);

        if (!result.success) {
          throw new Error(result.error);
        }

        // Cache invalidieren
        invalidiereFeiertageCache();

        showNotification('Erfolg', `Feiertag "${daten.name}" wurde aktualisiert!`, 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });
  }

  /**
   * Berechnet das Osterdatum nach der Gaußschen Osterformel
   */
  berechneOstersonntag(jahr) {
    const a = jahr % 19;
    const b = Math.floor(jahr / 100);
    const c = jahr % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const monat = Math.floor((h + l - 7 * m + 114) / 31);
    const tag = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(jahr, monat - 1, tag);
  }

  /**
   * Formatiert ein Datum als YYYY-MM-DD String (ohne Zeitzonen-Probleme)
   */
  _formatDatumISO(date) {
    const jahr = date.getFullYear();
    const monat = String(date.getMonth() + 1).padStart(2, '0');
    const tag = String(date.getDate()).padStart(2, '0');
    return `${jahr}-${monat}-${tag}`;
  }

  /**
   * Lädt deutsche Standard-Feiertage für ein Jahr
   * FIX: Verbesserte Fehlerbehandlung und Rückgabewert
   */
  async ladeStandardFeiertage(jahr) {
    const ostersonntag = this.berechneOstersonntag(jahr);
    
    // Hilfsfunktion für Datumsberechnung relativ zu Ostern
    const osterOffset = (tage) => {
      const datum = new Date(ostersonntag);
      datum.setDate(datum.getDate() + tage);
      return this._formatDatumISO(datum);
    };

    const formatDatum = (monat, tag) => {
      return `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
    };

    // Bundesweite Feiertage
    const feiertage = [
      { datum: formatDatum(1, 1), name: 'Neujahr', bundesland: null },
      { datum: osterOffset(-2), name: 'Karfreitag', bundesland: null },
      { datum: osterOffset(0), name: 'Ostersonntag', bundesland: null },
      { datum: osterOffset(1), name: 'Ostermontag', bundesland: null },
      { datum: formatDatum(5, 1), name: 'Tag der Arbeit', bundesland: null },
      { datum: osterOffset(39), name: 'Christi Himmelfahrt', bundesland: null },
      { datum: osterOffset(49), name: 'Pfingstsonntag', bundesland: null },
      { datum: osterOffset(50), name: 'Pfingstmontag', bundesland: null },
      { datum: formatDatum(10, 3), name: 'Tag der Deutschen Einheit', bundesland: null },
      { datum: formatDatum(12, 25), name: '1. Weihnachtstag', bundesland: null },
      { datum: formatDatum(12, 26), name: '2. Weihnachtstag', bundesland: null },
      // Regionale Feiertage
      { datum: formatDatum(1, 6), name: 'Heilige Drei Könige', bundesland: 'BY' },
      { datum: osterOffset(60), name: 'Fronleichnam', bundesland: 'NW' },
      { datum: formatDatum(8, 15), name: 'Mariä Himmelfahrt', bundesland: 'BY' },
      { datum: formatDatum(10, 31), name: 'Reformationstag', bundesland: 'SN' },
      { datum: formatDatum(11, 1), name: 'Allerheiligen', bundesland: 'NW' },
    ];

    let added = 0;
    let skipped = 0;
    const errors = [];

    // Feiertage einfügen (ignoriere Duplikate)
    for (const ft of feiertage) {
      try {
        const result = await this.dataManager.db.run(`
          INSERT OR IGNORE INTO feiertage (datum, name, bundesland)
          VALUES (?, ?, ?)
        `, [ft.datum, ft.name, ft.bundesland]);

        if (result.success) {
          // Prüfe ob tatsächlich eingefügt wurde (changes > 0)
          if (result.data && result.data.changes > 0) {
            added++;
          } else {
            skipped++;
          }
        } else {
          errors.push(`${ft.name}: ${result.error}`);
          skipped++;
        }
      } catch (error) {
        errors.push(`${ft.name}: ${error.message}`);
        skipped++;
      }
    }

    if (errors.length > 0) {
      console.warn('Einige Feiertage konnten nicht hinzugefügt werden:', errors);
    }

    return { added, skipped, errors };
  }
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FeiertagDialog;
}