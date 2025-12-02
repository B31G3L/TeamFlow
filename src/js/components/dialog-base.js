/**
 * Dialog-Basis-Klasse und Hilfsfunktionen
 * Gemeinsame Funktionalität für alle Dialoge
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

/**
 * Zeigt Toast-Notification
 */
function showNotification(title, message, type = 'info') {
  const toast = document.getElementById('notificationToast');
  const toastTitle = document.getElementById('toastTitle');
  const toastMessage = document.getElementById('toastMessage');

  const icons = {
    success: 'bi-check-circle-fill',
    danger: 'bi-exclamation-triangle-fill',
    warning: 'bi-exclamation-circle-fill',
    info: 'bi-info-circle-fill'
  };

  const icon = icons[type] || icons.info;

  toastTitle.innerHTML = `<i class="bi ${icon} me-2"></i>${title}`;
  toastMessage.textContent = message;

  const toastHeader = toast.querySelector('.toast-header');
  toastHeader.className = `toast-header bg-${type} text-white`;

  const bsToast = new bootstrap.Toast(toast);
  bsToast.show();
}

/**
 * Basis-Klasse für Dialog-Manager
 */
class DialogBase {
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  /**
   * Prüft Kollegen-Abwesenheiten in der gleichen Abteilung
   */
  async pruefeKollegenAbwesenheiten(mitarbeiterId, vonDatum, bisDatum, typ) {
    const mitarbeiter = await this.dataManager.getMitarbeiter(mitarbeiterId);
    if (!mitarbeiter) return [];

    const abteilungId = mitarbeiter.abteilung_id;

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

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DialogBase, showNotification, berechneArbeitstage, berechneEndDatumNachArbeitstagen };
}