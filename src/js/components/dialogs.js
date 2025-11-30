/**
 * Dialog-Komponenten
 * Bootstrap Modals für alle Eingabe-Dialoge
 */

/**
 * Berechnet die Anzahl der Arbeitstage zwischen zwei Daten (ohne Wochenenden)
 */
function berechneArbeitstage(vonDatum, bisDatum) {
  const von = new Date(vonDatum);
  const bis = new Date(bisDatum);
  
  let arbeitstage = 0;
  const current = new Date(von);
  
  while (current <= bis) {
    const dayOfWeek = current.getDay();
    // 0 = Sonntag, 6 = Samstag
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      arbeitstage++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return arbeitstage;
}

/**
 * Berechnet das End-Datum basierend auf Arbeitstagen
 */
function berechneEndDatumNachArbeitstagen(vonDatum, arbeitstage) {
  const von = new Date(vonDatum);
  let verbleibendeArbeitstage = Math.floor(arbeitstage);
  const current = new Date(von);
  
  while (verbleibendeArbeitstage > 0) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      verbleibendeArbeitstage--;
    }
    if (verbleibendeArbeitstage > 0) {
      current.setDate(current.getDate() + 1);
    }
  }
  
  return current.toISOString().split('T')[0];
}

class DialogManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  /**
   * Prüft Kollegen-Abwesenheiten in der gleichen Abteilung
   */
  async pruefeKollegenAbwesenheiten(mitarbeiterId, vonDatum, bisDatum, typ) {
    // Mitarbeiter laden um Abteilung zu ermitteln
    const mitarbeiter = await this.dataManager.getMitarbeiter(mitarbeiterId);
    if (!mitarbeiter) return [];

    const abteilungId = mitarbeiter.abteilung_id;

    // Alle Mitarbeiter in der gleichen Abteilung außer dem aktuellen
    const kollegen = await this.dataManager.db.query(`
      SELECT id, vorname, nachname
      FROM mitarbeiter
      WHERE abteilung_id = ? AND id != ? AND status = 'AKTIV'
    `, [abteilungId, mitarbeiterId]);

    const abwesenheiten = [];

    for (const kollege of kollegen) {
      // Prüfe Urlaub
      const urlaub = await this.dataManager.db.query(`
        SELECT von_datum, bis_datum, tage
        FROM urlaub
        WHERE mitarbeiter_id = ?
          AND ((von_datum BETWEEN ? AND ?) OR (bis_datum BETWEEN ? AND ?) 
               OR (von_datum <= ? AND bis_datum >= ?))
      `, [kollege.id, vonDatum, bisDatum, vonDatum, bisDatum, vonDatum, bisDatum]);

      if (urlaub.length > 0) {
        urlaub.forEach(u => {
          abwesenheiten.push({
            name: `${kollege.vorname} ${kollege.nachname}`,
            typ: 'Urlaub',
            von: u.von_datum,
            bis: u.bis_datum,
            tage: u.tage,
            klasse: 'text-success'
          });
        });
      }

      // Prüfe Krankheit
      const krankheit = await this.dataManager.db.query(`
        SELECT von_datum, bis_datum, tage
        FROM krankheit
        WHERE mitarbeiter_id = ?
          AND ((von_datum BETWEEN ? AND ?) OR (bis_datum BETWEEN ? AND ?) 
               OR (von_datum <= ? AND bis_datum >= ?))
      `, [kollege.id, vonDatum, bisDatum, vonDatum, bisDatum, vonDatum, bisDatum]);

      if (krankheit.length > 0) {
        krankheit.forEach(k => {
          abwesenheiten.push({
            name: `${kollege.vorname} ${kollege.nachname}`,
            typ: 'Krank',
            von: k.von_datum,
            bis: k.bis_datum,
            tage: k.tage,
            klasse: 'text-danger'
          });
        });
      }

      // Prüfe Schulung
      const schulung = await this.dataManager.db.query(`
        SELECT datum, dauer_tage, titel
        FROM schulung
        WHERE mitarbeiter_id = ?
          AND datum BETWEEN ? AND ?
      `, [kollege.id, vonDatum, bisDatum]);

      if (schulung.length > 0) {
        schulung.forEach(s => {
          // Berechne End-Datum
          const start = new Date(s.datum);
          const end = new Date(start);
          end.setDate(end.getDate() + Math.floor(s.dauer_tage) - 1);

          abwesenheiten.push({
            name: `${kollege.vorname} ${kollege.nachname}`,
            typ: 'Schulung',
            von: s.datum,
            bis: end.toISOString().split('T')[0],
            tage: s.dauer_tage,
            titel: s.titel,
            klasse: 'text-info'
          });
        });
      }
    }

    return abwesenheiten;
  }

  /**
   * Erstellt HTML für Kollegen-Hinweise
   */
  erstelleKollegenHinweisHTML(abwesenheiten) {
    if (abwesenheiten.length === 0) {
      return `
        <div class="alert alert-success" role="alert">
          <i class="bi bi-check-circle"></i> <strong>Keine Überschneidungen:</strong> 
          Alle Kollegen in deiner Abteilung sind verfügbar.
        </div>
      `;
    }

    let html = `
      <div class="alert alert-warning" role="alert">
        <i class="bi bi-exclamation-triangle"></i> <strong>Achtung:</strong> 
        Folgende Kollegen aus deiner Abteilung sind ebenfalls abwesend:
        <ul class="mb-0 mt-2">
    `;

    abwesenheiten.forEach(a => {
      const vonFormatiert = new Date(a.von).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
      const bisFormatiert = new Date(a.bis).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
      
      html += `
        <li class="${a.klasse}">
          <strong>${a.name}</strong> - ${a.typ} 
          (${vonFormatiert} - ${bisFormatiert}, ${a.tage.toFixed(1)} Tage)
          ${a.titel ? `<br><small class="text-muted">${a.titel}</small>` : ''}
        </li>
      `;
    });

    html += `
        </ul>
      </div>
    `;

    return html;
  }

  /**
   * Zeigt Stammdaten Hinzufügen Dialog
   */
  async zeigeStammdatenHinzufuegen(callback) {
    const abteilungen = await this.dataManager.getAlleAbteilungen();

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

    await this.showModal(modalHtml, async () => {
      const form = document.getElementById('stammdatenForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const daten = {
        vorname: document.getElementById('vorname').value,
        nachname: document.getElementById('nachname').value,
        email: null,
        abteilung: document.getElementById('abteilung').value,
        geburtsdatum: document.getElementById('geburtsdatum').value || null,
        einstellungsdatum: document.getElementById('einstellungsdatum').value,
        urlaubstage_jahr: parseFloat(document.getElementById('urlaubstageJahr').value)
      };

      // Generiere automatische ID: Nachname + Vorname (erste 3 Buchstaben jeweils)
      const vorname = daten.vorname.substring(0, 3).toUpperCase();
      const nachname = daten.nachname.substring(0, 3).toUpperCase();
      const timestamp = Date.now().toString().slice(-4); // Letzte 4 Ziffern Timestamp
      const mitarbeiterId = `${nachname}${vorname}${timestamp}`;

      try {
        await this.dataManager.stammdatenHinzufuegen(mitarbeiterId, daten);
        showNotification('Erfolg', `${daten.vorname} ${daten.nachname} wurde hinzugefügt!`, 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });

    // Heutiges Datum als Standard
    const heute = new Date().toISOString().split('T')[0];
    setTimeout(() => {
      const einstellungsdatumField = document.getElementById('einstellungsdatum');
      if (einstellungsdatumField) {
        einstellungsdatumField.value = heute;
      }
    }, 100);
  }

  /**
   * Zeigt Stammdaten Bearbeiten Dialog
   */
  async zeigeStammdatenBearbeiten(mitarbeiterId, callback) {
    const mitarbeiter = await this.dataManager.getMitarbeiter(mitarbeiterId);

    if (!mitarbeiter) {
      showNotification('Fehler', 'Mitarbeiter nicht gefunden', 'danger');
      return;
    }

    const abteilungen = await this.dataManager.getAlleAbteilungen();

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

    await this.showModal(modalHtml, async () => {
      const form = document.getElementById('stammdatenBearbeitenForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const daten = {
        vorname: document.getElementById('vorname').value,
        nachname: document.getElementById('nachname').value,
        email: null,
        abteilung: document.getElementById('abteilung').value,
        geburtsdatum: document.getElementById('geburtsdatum').value || null,
        einstellungsdatum: document.getElementById('einstellungsdatum').value,
        urlaubstage_jahr: parseFloat(document.getElementById('urlaubstageJahr').value),
        austrittsdatum: document.getElementById('austrittsdatum').value || null
      };

      try {
        await this.dataManager.stammdatenAktualisieren(mitarbeiterId, daten);
        showNotification('Erfolg', `${daten.vorname} ${daten.nachname} wurde aktualisiert!`, 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });
  }

  /**
   * Zeigt Mitarbeiter-Verwaltungs-Modal
   */
  async zeigeStammdatenVerwalten(callback) {
    const mitarbeiter = await this.dataManager.getAlleMitarbeiter();

    const mitarbeiterRows = mitarbeiter.map((ma, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${ma.vorname} ${ma.nachname}</td>
        <td>
          <span class="abteilung-badge" style="background-color: ${ma.abteilung_farbe}">
            ${ma.abteilung_name}
          </span>
        </td>
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
                      <th>Name</th>
                      <th>Abteilung</th>
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

    tabelleBody.addEventListener('click', async (e) => {
      const bearbeitenBtn = e.target.closest('.btn-bearbeiten');
      const loeschenBtn = e.target.closest('.btn-loeschen');

      if (bearbeitenBtn) {
        const mitarbeiterId = bearbeitenBtn.dataset.id;
        modal.hide();

        // Bearbeiten-Dialog öffnen
        await this.zeigeStammdatenBearbeiten(mitarbeiterId, async () => {
          if (callback) await callback();
          // Verwaltungs-Modal wieder öffnen nach Bearbeitung
          setTimeout(() => this.zeigeStammdatenVerwalten(callback), 300);
        });
      } else if (loeschenBtn) {
        const mitarbeiterId = loeschenBtn.dataset.id;
        const mitarbeiterData = mitarbeiter.find(m => m.id === mitarbeiterId);

        if (confirm(`Möchten Sie den Mitarbeiter ${mitarbeiterData.vorname} ${mitarbeiterData.nachname} wirklich deaktivieren?`)) {
          try {
            await this.dataManager.mitarbeiterDeaktivieren(mitarbeiterId);
            showNotification('Erfolg', 'Mitarbeiter wurde deaktiviert', 'success');
            modal.hide();
            if (callback) await callback();
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

    // Event-Listener für Farbe und Vorschau
    setTimeout(() => {
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
    }, 100);
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

    // Event-Listener für Farbe und Vorschau
    setTimeout(() => {
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
    }, 100);
  }

  /**
   * Zeigt Urlaub Eintragen Dialog
   */
  async zeigeUrlaubDialog(mitarbeiterId, callback) {
    const heute = new Date();
    const formatDate = (date) => date.toISOString().split('T')[0];

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
                      <button type="button" class="btn btn-sm btn-outline-success dauer-btn" data-tage="0.5">Halber Tag</button>
                      <button type="button" class="btn btn-sm btn-outline-success dauer-btn" data-tage="1">1 Tag</button>
                      <button type="button" class="btn btn-sm btn-outline-success dauer-btn" data-tage="2">2 Tage</button>
                      <button type="button" class="btn btn-sm btn-outline-success dauer-btn" data-tage="3">3 Tage</button>
                      <button type="button" class="btn btn-sm btn-outline-success dauer-btn" data-tage="5">1 Woche</button>
                      <button type="button" class="btn btn-sm btn-outline-success dauer-btn" data-tage="10">2 Wochen</button>
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
      const bisDatum = document.getElementById('bisDatum').value;

      // Berechne Arbeitstage (ohne Wochenenden)
      const dauerAnzeige = document.getElementById('dauerAnzeige').textContent;
      const tage = parseFloat(dauerAnzeige);

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
          const abwesenheiten = await this.pruefeKollegenAbwesenheiten(mitarbeiterId, von, bis, 'urlaub');
          kollegenHinweiseDiv.innerHTML = this.erstelleKollegenHinweisHTML(abwesenheiten);
        }
      };

      vonDatumInput.addEventListener('change', async () => {
        // Bis-Datum mindestens Von-Datum
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
            // Halber Tag: Von und Bis gleich, aber Dauer 0.5
            bisDatumInput.value = von;
            dauerAnzeige.textContent = '0.5';
          } else {
            // Berechne Bis-Datum basierend auf Arbeitstagen
            const bis = berechneEndDatumNachArbeitstagen(von, tage);
            bisDatumInput.value = bis;
            dauerAnzeige.textContent = tage;
          }

          // Prüfe Kollegen nach Änderung
          const abwesenheiten = await this.pruefeKollegenAbwesenheiten(
            mitarbeiterId, 
            vonDatumInput.value, 
            bisDatumInput.value, 
            'urlaub'
          );
          kollegenHinweiseDiv.innerHTML = this.erstelleKollegenHinweisHTML(abwesenheiten);
        });
      });
    }, 100);
  }

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
      const bisDatum = document.getElementById('bisDatum').value;

      // Berechne Arbeitstage (ohne Wochenenden)
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
                  <label class="form-label">Arbeitstage (ohne Wochenende): <span id="dauerAnzeige" class="fw-bold">1</span></label>
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

    await this.showModal(modalHtml, async () => {
      const form = document.getElementById('schulungForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const vonDatum = document.getElementById('vonDatum').value;
      const bisDatum = document.getElementById('bisDatum').value;

      // Berechne Arbeitstage (ohne Wochenenden)
      const dauerAnzeige = document.getElementById('dauerAnzeige').textContent;
      const tage = parseFloat(dauerAnzeige);

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
          const abwesenheiten = await this.pruefeKollegenAbwesenheiten(mitarbeiterId, von, bis, 'schulung');
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
            'schulung'
          );
          kollegenHinweiseDiv.innerHTML = this.erstelleKollegenHinweisHTML(abwesenheiten);
        });
      });
    }, 100);
  }

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
                      <button type="button" class="btn btn-sm btn-outline-success stunden-btn" data-stunden="0.25">+0,25</button>
                      <button type="button" class="btn btn-sm btn-outline-success stunden-btn" data-stunden="0.5">+0,5</button>
                      <button type="button" class="btn btn-sm btn-outline-success stunden-btn" data-stunden="0.75">+0,75</button>
                      <button type="button" class="btn btn-sm btn-outline-success stunden-btn" data-stunden="1">+1</button>
                      <button type="button" class="btn btn-sm btn-outline-success stunden-btn" data-stunden="1.5">+1,5</button>
                      <button type="button" class="btn btn-sm btn-outline-success stunden-btn" data-stunden="2">+2</button>
                    </div>
                  </div>
                  
                  <div class="mt-2">
                    <small class="text-muted d-block mb-1">Abbauen (-):</small>
                    <div class="d-flex gap-2 flex-wrap">
                      <button type="button" class="btn btn-sm btn-outline-danger stunden-btn" data-stunden="-0.25">-0,25</button>
                      <button type="button" class="btn btn-sm btn-outline-danger stunden-btn" data-stunden="-0.5">-0,5</button>
                      <button type="button" class="btn btn-sm btn-outline-danger stunden-btn" data-stunden="-0.75">-0,75</button>
                      <button type="button" class="btn btn-sm btn-outline-danger stunden-btn" data-stunden="-1">-1</button>
                      <button type="button" class="btn btn-sm btn-outline-danger stunden-btn" data-stunden="-1.5">-1,5</button>
                      <button type="button" class="btn btn-sm btn-outline-danger stunden-btn" data-stunden="-2">-2</button>
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

    // Event-Listener für Datum-Buttons
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

  /**
   * Hilfsfunktion: Zeigt Modal an
   */
  async showModal(html, onSave) {
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
      btnSpeichern.addEventListener('click', async () => {
        if (await onSave()) {
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