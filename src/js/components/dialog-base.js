/**
 * Dialog-Basis-Klasse und Hilfsfunktionen
 * Gemeinsame Funktionalität für alle Dialoge
 * 
 * FIXES:
 * - Korrekte Behandlung von db.query() Rückgabewerten
 * - Verbesserte Fehlerbehandlung
 * - Race Condition bei Dialog-Initialisierung behoben
 * - Memory Leak bei Modals behoben
 * - Zeitzonen-Problem bei Datums-Konvertierung behoben
 */

// Globaler Cache für Feiertage (wird beim ersten Aufruf geladen)
let feiertageCache = null;
let feiertageCacheJahr = null;

/**
 * Hilfsfunktion: Formatiert Datum als YYYY-MM-DD ohne Zeitzonen-Probleme
 * FIX: Verhindert das "einen Tag später"-Problem bei toISOString()
 */
function formatDatumLokal(date) {
  const jahr = date.getFullYear();
  const monat = String(date.getMonth() + 1).padStart(2, '0');
  const tag = String(date.getDate()).padStart(2, '0');
  return `${jahr}-${monat}-${tag}`;
}

/**
 * Hilfsfunktion: Parst Datum-String ohne Zeitzonen-Verschiebung
 */
function parseDatumLokal(datumStr) {
  const [jahr, monat, tag] = datumStr.split('-').map(Number);
  return new Date(jahr, monat - 1, tag);
}

/**
 * Hilfsfunktion: Formatiert Datum für Anzeige (DD.MM.YYYY)
 */
function formatDatumAnzeige(datumStr) {
  if (!datumStr) return '-';
  const [jahr, monat, tag] = datumStr.split('-').map(Number);
  return `${String(tag).padStart(2, '0')}.${String(monat).padStart(2, '0')}.${jahr}`;
}

/**
 * Lädt Feiertage aus der Datenbank
 */
async function ladeFeiertage(jahr) {
  if (feiertageCache && feiertageCacheJahr === jahr) {
    return feiertageCache;
  }
  
  try {
    const db = window.electronAPI.db;
    const result = await db.query(`
      SELECT datum FROM feiertage 
      WHERE strftime('%Y', datum) = ?
    `, [jahr.toString()]);
    
    if (!result.success) {
      console.error('Fehler beim Laden der Feiertage:', result.error);
      return new Set();
    }
    
    // Erstelle Set für schnelle Lookups
    feiertageCache = new Set(result.data.map(f => f.datum));
    feiertageCacheJahr = jahr;
    
    return feiertageCache;
  } catch (error) {
    console.error('Fehler beim Laden der Feiertage:', error);
    return new Set();
  }
}

/**
 * Invalidiert den Feiertage-Cache (z.B. nach Änderungen)
 */
function invalidiereFeiertageCache() {
  feiertageCache = null;
  feiertageCacheJahr = null;
}

/**
 * Prüft ob ein Datum ein Feiertag ist
 */
function istFeiertag(datum, feiertageSet) {
  const datumStr = formatDatumLokal(datum);
  return feiertageSet.has(datumStr);
}

/**
 * Berechnet die Anzahl der Arbeitstage zwischen zwei Daten (ohne Wochenenden)
 * SYNCHRONE Version - ohne Feiertage (für Rückwärtskompatibilität)
 */
function berechneArbeitstage(vonDatum, bisDatum) {
  const von = parseDatumLokal(vonDatum);
  const bis = parseDatumLokal(bisDatum);
  
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
 * Berechnet die Anzahl der Arbeitstage zwischen zwei Daten (ohne Wochenenden UND Feiertage)
 * ASYNCHRONE Version - mit Feiertagen
 */
async function berechneArbeitstageAsync(vonDatum, bisDatum) {
  const von = parseDatumLokal(vonDatum);
  const bis = parseDatumLokal(bisDatum);
  
  // Lade Feiertage für alle betroffenen Jahre
  const jahreSet = new Set();
  const current = new Date(von);
  while (current <= bis) {
    jahreSet.add(current.getFullYear());
    current.setDate(current.getDate() + 1);
  }
  
  // Sammle alle Feiertage
  const alleFeiertage = new Set();
  for (const jahr of jahreSet) {
    const feiertage = await ladeFeiertage(jahr);
    feiertage.forEach(f => alleFeiertage.add(f));
  }
  
  // Berechne Arbeitstage
  let arbeitstage = 0;
  const checkDate = new Date(von);
  
  while (checkDate <= bis) {
    const dayOfWeek = checkDate.getDay();
    const datumStr = formatDatumLokal(checkDate);
    
    // Kein Wochenende UND kein Feiertag
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !alleFeiertage.has(datumStr)) {
      arbeitstage++;
    }
    checkDate.setDate(checkDate.getDate() + 1);
  }
  
  return arbeitstage;
}

/**
 * Gibt Details zu Feiertagen im Zeitraum zurück (nur Werktage)
 */
async function getFeiertageImZeitraum(vonDatum, bisDatum) {
  try {
    const db = window.electronAPI.db;
    const result = await db.query(`
      SELECT datum, name FROM feiertage 
      WHERE datum BETWEEN ? AND ?
      ORDER BY datum
    `, [vonDatum, bisDatum]);
    
    if (!result.success) {
      console.error('Fehler beim Laden der Feiertage im Zeitraum:', result.error);
      return [];
    }
    
    // Filtere nur Feiertage die auf Werktage fallen
    return result.data.filter(f => {
      const d = parseDatumLokal(f.datum);
      const dayOfWeek = d.getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6;
    });
  } catch (error) {
    console.error('Fehler beim Laden der Feiertage im Zeitraum:', error);
    return [];
  }
}

/**
 * Berechnet das End-Datum basierend auf Arbeitstagen (ohne Feiertage)
 * SYNCHRONE Version
 */
function berechneEndDatumNachArbeitstagen(vonDatum, arbeitstage) {
  const von = parseDatumLokal(vonDatum);
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
  
  return formatDatumLokal(current);
}

/**
 * Berechnet das End-Datum basierend auf Arbeitstagen (MIT Feiertagen)
 * ASYNCHRONE Version
 */
async function berechneEndDatumNachArbeitstagenAsync(vonDatum, arbeitstage) {
  const von = parseDatumLokal(vonDatum);
  let verbleibendeArbeitstage = Math.floor(arbeitstage);
  const current = new Date(von);
  
  // Schätze maximales Jahr (großzügig)
  const maxJahr = von.getFullYear() + 1;
  
  // Lade Feiertage für relevante Jahre
  const alleFeiertage = new Set();
  for (let jahr = von.getFullYear(); jahr <= maxJahr; jahr++) {
    const feiertage = await ladeFeiertage(jahr);
    feiertage.forEach(f => alleFeiertage.add(f));
  }
  
  while (verbleibendeArbeitstage > 0) {
    const dayOfWeek = current.getDay();
    const datumStr = formatDatumLokal(current);
    
    // Nur zählen wenn kein Wochenende UND kein Feiertag
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !alleFeiertage.has(datumStr)) {
      verbleibendeArbeitstage--;
    }
    if (verbleibendeArbeitstage > 0) {
      current.setDate(current.getDate() + 1);
    }
  }
  
  return formatDatumLokal(current);
}

/**
 * Zeigt Toast-Notification
 */
function showNotification(title, message, type = 'info') {
  const toast = document.getElementById('notificationToast');
  const toastTitle = document.getElementById('toastTitle');
  const toastMessage = document.getElementById('toastMessage');

  if (!toast || !toastTitle || !toastMessage) {
    console.warn('Toast-Elemente nicht gefunden:', { title, message, type });
    return;
  }

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
   * Prüft ob Veranstaltungen im Zeitraum liegen
   * FIX: Korrekte Behandlung des db.query() Rückgabewerts
   */
  async pruefeVeranstaltungen(vonDatum, bisDatum) {
    try {
      const result = await this.dataManager.db.query(`
        SELECT titel, von_datum, bis_datum
        FROM veranstaltungen
        WHERE (von_datum BETWEEN ? AND ?) 
           OR (bis_datum BETWEEN ? AND ?) 
           OR (von_datum <= ? AND bis_datum >= ?)
        ORDER BY von_datum
      `, [vonDatum, bisDatum, vonDatum, bisDatum, vonDatum, bisDatum]);

      if (!result.success) {
        console.error('Fehler beim Prüfen der Veranstaltungen:', result.error);
        return [];
      }

      return result.data || [];
    } catch (error) {
      console.error('Fehler beim Prüfen der Veranstaltungen:', error);
      return [];
    }
  }

  /**
   * Erstellt HTML für Veranstaltungs-Hinweise
   */
  erstelleVeranstaltungsHinweisHTML(veranstaltungen) {
    if (!veranstaltungen || veranstaltungen.length === 0) {
      return '';
    }

    let html = `
      <div class="alert alert-info" role="alert">
        <i class="bi bi-calendar-event"></i> <strong>Hinweis:</strong> 
        Im gewählten Zeitraum ${veranstaltungen.length === 1 ? 'findet eine Veranstaltung statt' : 'finden Veranstaltungen statt'}:
        <ul class="mb-0 mt-2">
    `;

    veranstaltungen.forEach(v => {
      const vonFormatiert = formatDatumAnzeige(v.von_datum);
      const bisFormatiert = formatDatumAnzeige(v.bis_datum);
      
      const datumText = v.von_datum === v.bis_datum 
        ? vonFormatiert 
        : `${vonFormatiert} - ${bisFormatiert}`;
      
      html += `
        <li>
          <strong>${v.titel}</strong> (${datumText})
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
   * Erstellt HTML für Feiertags-Hinweise
   */
  erstelleFeiertagsHinweisHTML(feiertage) {
    if (!feiertage || feiertage.length === 0) {
      return '';
    }

    let html = `
      <div class="alert alert-success" role="alert">
        <i class="bi bi-calendar-check"></i> <strong>Feiertage im Zeitraum:</strong> 
        ${feiertage.length === 1 ? 'Ein Feiertag wird' : `${feiertage.length} Feiertage werden`} automatisch abgezogen:
        <ul class="mb-0 mt-2">
    `;

    feiertage.forEach(f => {
      const d = parseDatumLokal(f.datum);
      const wochentage = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
      const wochentag = wochentage[d.getDay()];
      const datumFormatiert = `${wochentag}, ${formatDatumAnzeige(f.datum)}`;
      
      html += `
        <li>
          <strong>${f.name}</strong> (${datumFormatiert})
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
   * Prüft Kollegen-Abwesenheiten in der gleichen Abteilung
   * FIX: Korrekte Behandlung aller db.query() Rückgabewerte
   */
  async pruefeKollegenAbwesenheiten(mitarbeiterId, vonDatum, bisDatum, typ) {
    try {
      const mitarbeiter = await this.dataManager.getMitarbeiter(mitarbeiterId);
      if (!mitarbeiter) return [];

      const abteilungId = mitarbeiter.abteilung_id;

      const kollegenResult = await this.dataManager.db.query(`
        SELECT id, vorname, nachname
        FROM mitarbeiter
        WHERE abteilung_id = ? AND id != ? AND status = 'AKTIV'
      `, [abteilungId, mitarbeiterId]);

      if (!kollegenResult.success) {
        console.error('Fehler beim Laden der Kollegen:', kollegenResult.error);
        return [];
      }

      const kollegen = kollegenResult.data || [];
      const abwesenheiten = [];

      for (const kollege of kollegen) {
        // Prüfe Urlaub
        const urlaubResult = await this.dataManager.db.query(`
          SELECT von_datum, bis_datum, tage
          FROM urlaub
          WHERE mitarbeiter_id = ?
            AND ((von_datum BETWEEN ? AND ?) OR (bis_datum BETWEEN ? AND ?) 
                 OR (von_datum <= ? AND bis_datum >= ?))
        `, [kollege.id, vonDatum, bisDatum, vonDatum, bisDatum, vonDatum, bisDatum]);

        if (urlaubResult.success && urlaubResult.data) {
          urlaubResult.data.forEach(u => {
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
        const krankheitResult = await this.dataManager.db.query(`
          SELECT von_datum, bis_datum, tage
          FROM krankheit
          WHERE mitarbeiter_id = ?
            AND ((von_datum BETWEEN ? AND ?) OR (bis_datum BETWEEN ? AND ?) 
                 OR (von_datum <= ? AND bis_datum >= ?))
        `, [kollege.id, vonDatum, bisDatum, vonDatum, bisDatum, vonDatum, bisDatum]);

        if (krankheitResult.success && krankheitResult.data) {
          krankheitResult.data.forEach(k => {
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
        const schulungResult = await this.dataManager.db.query(`
          SELECT datum, dauer_tage, titel
          FROM schulung
          WHERE mitarbeiter_id = ?
            AND datum BETWEEN ? AND ?
        `, [kollege.id, vonDatum, bisDatum]);

        if (schulungResult.success && schulungResult.data) {
          schulungResult.data.forEach(s => {
            const start = parseDatumLokal(s.datum);
            const end = new Date(start);
            end.setDate(end.getDate() + Math.floor(s.dauer_tage) - 1);

            abwesenheiten.push({
              name: `${kollege.vorname} ${kollege.nachname}`,
              typ: 'Schulung',
              von: s.datum,
              bis: formatDatumLokal(end),
              tage: s.dauer_tage,
              titel: s.titel,
              klasse: 'text-info'
            });
          });
        }
      }

      return abwesenheiten;
    } catch (error) {
      console.error('Fehler beim Prüfen der Kollegen-Abwesenheiten:', error);
      return [];
    }
  }

  /**
   * Erstellt HTML für Kollegen-Hinweise
   */
  erstelleKollegenHinweisHTML(abwesenheiten) {
    if (!abwesenheiten || abwesenheiten.length === 0) {
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
      const vonFormatiert = formatDatumAnzeige(a.von);
      const bisFormatiert = formatDatumAnzeige(a.bis);
      
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
   * FIX: Robustere Initialisierung ohne setTimeout Race Condition
   * FIX: Memory Leak durch korrektes dispose() behoben
   */
  async showModal(html, onSave) {
    // Entferne alte Modals
    const oldModals = document.querySelectorAll('.modal');
    oldModals.forEach(m => {
      // Versuche Modal ordentlich zu schließen
      const existingModal = bootstrap.Modal.getInstance(m);
      if (existingModal) {
        existingModal.dispose();
      }
      m.remove();
    });

    // Entferne alte Backdrops
    const oldBackdrops = document.querySelectorAll('.modal-backdrop');
    oldBackdrops.forEach(b => b.remove());

    // Füge neues Modal hinzu
    document.body.insertAdjacentHTML('beforeend', html);

    // Modal initialisieren
    const modalElement = document.querySelector('.modal');
    if (!modalElement) {
      console.error('Modal-Element nicht gefunden');
      return;
    }

    const modal = new bootstrap.Modal(modalElement);

    // Speichern-Button
    const btnSpeichern = modalElement.querySelector('#btnSpeichern');
    if (btnSpeichern && onSave) {
      btnSpeichern.addEventListener('click', async () => {
        // Deaktiviere Button während des Speicherns
        btnSpeichern.disabled = true;
        btnSpeichern.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Speichern...';
        
        try {
          if (await onSave()) {
            modal.hide();
          }
        } catch (error) {
          console.error('Fehler beim Speichern:', error);
          showNotification('Fehler', error.message, 'danger');
        } finally {
          // Button wieder aktivieren
          btnSpeichern.disabled = false;
          btnSpeichern.innerHTML = '<i class="bi bi-check-lg"></i> Speichern';
        }
      });
    }

    // Modal anzeigen
    modal.show();

    // Cleanup nach Schließen - FIX: dispose() hinzugefügt
    modalElement.addEventListener('hidden.bs.modal', () => {
      modal.dispose();
      modalElement.remove();
    });

    // FIX: Warte auf Modal-Animation bevor Promise resolved
    return new Promise(resolve => {
      modalElement.addEventListener('shown.bs.modal', () => {
        resolve(modal);
      }, { once: true });
    });
  }
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    DialogBase, 
    showNotification, 
    berechneArbeitstage, 
    berechneArbeitstageAsync, 
    berechneEndDatumNachArbeitstagen, 
    berechneEndDatumNachArbeitstagenAsync, 
    getFeiertageImZeitraum, 
    invalidiereFeiertageCache,
    formatDatumLokal,
    parseDatumLokal,
    formatDatumAnzeige
  };
}