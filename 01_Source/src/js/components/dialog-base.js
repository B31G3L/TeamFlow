/**
 * Dialog-Basis-Klasse und Hilfsfunktionen
 *
 * FIX showModal():
 *   Die alte Version entfernte mit document.querySelectorAll('.modal')
 *   ALLE Modals auf einmal und dispose()d ihre Bootstrap-Instanzen.
 *   Das führte bei schnell hintereinander geöffneten Dialogen zu einem
 *   Memory-Leak (Bootstrap hält Event-Listener auf bereits entfernten
 *   Elementen) und konnte den aktuell sichtbaren Dialog zerstören.
 *   Fix: nur Modal-Elemente entfernen die NICHT gerade sichtbar sind
 *   (kein 'show'-Class und nicht im DOM aktiv).
 */

let feiertageCache = null;
let feiertageCacheJahr = null;

function formatDatumLokal(date) {
  const j = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const t = String(date.getDate()).padStart(2, '0');
  return `${j}-${m}-${t}`;
}

function parseDatumLokal(datumStr) {
  const [j, m, t] = datumStr.split('-').map(Number);
  return new Date(j, m - 1, t);
}

function formatDatumAnzeige(datumStr) {
  if (!datumStr) return '-';
  const [j, m, t] = datumStr.split('-').map(Number);
  return `${String(t).padStart(2, '0')}.${String(m).padStart(2, '0')}.${j}`;
}

async function ladeFeiertage(jahr) {
  if (feiertageCache && feiertageCacheJahr === jahr) return feiertageCache;
  try {
    const result = await window.electronAPI.db.query(
      `SELECT datum FROM feiertage WHERE strftime('%Y', datum) = ?`,
      [jahr.toString()]
    );
    feiertageCache = new Set(result.success ? result.data.map(f => f.datum) : []);
    feiertageCacheJahr = jahr;
    return feiertageCache;
  } catch {
    return new Set();
  }
}

function invalidiereFeiertageCache() {
  feiertageCache = null;
  feiertageCacheJahr = null;
}

async function ladeArbeitszeitmodell(mitarbeiterId) {
  try {
    const result = await window.electronAPI.db.query(
      'SELECT wochentag, arbeitszeit FROM arbeitszeitmodell WHERE mitarbeiter_id = ? ORDER BY wochentag',
      [mitarbeiterId]
    );
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function berechneUrlaubstageWert(datum, arbeitszeitmodell) {
  const date = parseDatumLokal(datum);
  const wochentag = date.getDay();
  const idx = wochentag === 0 ? 6 : wochentag - 1;

  if (!arbeitszeitmodell || arbeitszeitmodell.length === 0) return idx < 5 ? 1.0 : 0;

  const tagModell = arbeitszeitmodell.find(m => m.wochentag === idx);
  if (!tagModell) return idx < 5 ? 1.0 : 0;

  switch (tagModell.arbeitszeit) {
    case 'VOLL': return 1.0;
    case 'HALB': return 0.5;
    case 'FREI': return 0;
    default:     return 1.0;
  }
}

function berechneArbeitstage(vonDatum, bisDatum) {
  const von = parseDatumLokal(vonDatum);
  const bis = parseDatumLokal(bisDatum);
  let arbeitstage = 0;
  const cur = new Date(von);
  while (cur <= bis) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) arbeitstage++;
    cur.setDate(cur.getDate() + 1);
  }
  return arbeitstage;
}

async function berechneUrlaubstageAsync(vonDatum, bisDatum, mitarbeiterId) {
  const von = parseDatumLokal(vonDatum);
  const bis = parseDatumLokal(bisDatum);
  const arbeitszeitmodell = mitarbeiterId ? await ladeArbeitszeitmodell(mitarbeiterId) : null;

  const jahreSet = new Set();
  const cur = new Date(von);
  while (cur <= bis) { jahreSet.add(cur.getFullYear()); cur.setDate(cur.getDate() + 1); }

  const alleFeiertage = new Set();
  for (const j of jahreSet) (await ladeFeiertage(j)).forEach(f => alleFeiertage.add(f));

  let urlaubstage = 0;
  const check = new Date(von);
  while (check <= bis) {
    const ds = formatDatumLokal(check);
    if (!alleFeiertage.has(ds)) urlaubstage += berechneUrlaubstageWert(ds, arbeitszeitmodell);
    check.setDate(check.getDate() + 1);
  }
  return urlaubstage;
}

async function berechneArbeitstageAsync(vonDatum, bisDatum) {
  const von = parseDatumLokal(vonDatum);
  const bis = parseDatumLokal(bisDatum);

  const jahreSet = new Set();
  const cur = new Date(von);
  while (cur <= bis) { jahreSet.add(cur.getFullYear()); cur.setDate(cur.getDate() + 1); }

  const alleFeiertage = new Set();
  for (const j of jahreSet) (await ladeFeiertage(j)).forEach(f => alleFeiertage.add(f));

  let arbeitstage = 0;
  const check = new Date(von);
  while (check <= bis) {
    const d = check.getDay();
    const ds = formatDatumLokal(check);
    if (d !== 0 && d !== 6 && !alleFeiertage.has(ds)) arbeitstage++;
    check.setDate(check.getDate() + 1);
  }
  return arbeitstage;
}

async function getFeiertageImZeitraum(vonDatum, bisDatum) {
  try {
    const result = await window.electronAPI.db.query(
      'SELECT datum, name FROM feiertage WHERE datum BETWEEN ? AND ? ORDER BY datum',
      [vonDatum, bisDatum]
    );
    if (!result.success) return [];
    return result.data.filter(f => { const d = parseDatumLokal(f.datum).getDay(); return d !== 0 && d !== 6; });
  } catch { return []; }
}

async function berechneEndDatumNachArbeitstagenAsync(vonDatum, arbeitstage) {
  const von = parseDatumLokal(vonDatum);
  let rest = Math.floor(arbeitstage);
  const cur = new Date(von);
  const alleFeiertage = new Set();
  for (let j = von.getFullYear(); j <= von.getFullYear() + 1; j++) {
    (await ladeFeiertage(j)).forEach(f => alleFeiertage.add(f));
  }
  while (rest > 0) {
    const d = cur.getDay();
    const ds = formatDatumLokal(cur);
    if (d !== 0 && d !== 6 && !alleFeiertage.has(ds)) rest--;
    if (rest > 0) cur.setDate(cur.getDate() + 1);
  }
  return formatDatumLokal(cur);
}

async function berechneEndDatumNachUrlaubstagenAsync(vonDatum, urlaubstage, mitarbeiterId) {
  const von = parseDatumLokal(vonDatum);
  let rest = urlaubstage;
  const cur = new Date(von);
  const arbeitszeitmodell = await ladeArbeitszeitmodell(mitarbeiterId);
  const alleFeiertage = new Set();
  for (let j = von.getFullYear(); j <= von.getFullYear() + 1; j++) {
    (await ladeFeiertage(j)).forEach(f => alleFeiertage.add(f));
  }
  while (rest > 0) {
    const ds = formatDatumLokal(cur);
    if (!alleFeiertage.has(ds)) {
      const wert = berechneUrlaubstageWert(ds, arbeitszeitmodell);
      if (wert > 0) rest -= wert;
    }
    if (rest > 0) cur.setDate(cur.getDate() + 1);
  }
  return formatDatumLokal(cur);
}

function berechneEndDatumNachArbeitstagen(vonDatum, arbeitstage) {
  const von = parseDatumLokal(vonDatum);
  let rest = Math.floor(arbeitstage);
  const cur = new Date(von);
  while (rest > 0) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) rest--;
    if (rest > 0) cur.setDate(cur.getDate() + 1);
  }
  return formatDatumLokal(cur);
}

function showNotification(title, message, type = 'info') {
  const toast = document.getElementById('notificationToast');
  const toastTitle = document.getElementById('toastTitle');
  const toastMessage = document.getElementById('toastMessage');
  if (!toast || !toastTitle || !toastMessage) { console.warn('Toast nicht gefunden:', { title, message }); return; }

  const icons = { success: 'bi-check-circle-fill', danger: 'bi-exclamation-triangle-fill', warning: 'bi-exclamation-circle-fill', info: 'bi-info-circle-fill' };
  toastTitle.innerHTML = `<i class="bi ${icons[type] || icons.info} me-2"></i>${title}`;
  toastMessage.textContent = message;
  toast.querySelector('.toast-header').className = `toast-header bg-${type} text-white`;
  new bootstrap.Toast(toast).show();
}

class DialogBase {
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  async pruefeVeranstaltungen(vonDatum, bisDatum) {
    try {
      const result = await this.dataManager.db.query(
        `SELECT titel, von_datum, bis_datum FROM veranstaltungen
         WHERE (von_datum BETWEEN ? AND ?) OR (bis_datum BETWEEN ? AND ?)
                OR (von_datum <= ? AND bis_datum >= ?)
         ORDER BY von_datum`,
        [vonDatum, bisDatum, vonDatum, bisDatum, vonDatum, bisDatum]
      );
      return result.success ? result.data || [] : [];
    } catch { return []; }
  }

  erstelleVeranstaltungsHinweisHTML(veranstaltungen) {
    if (!veranstaltungen || veranstaltungen.length === 0) return '';
    const liste = veranstaltungen.map(v => {
      const von = formatDatumAnzeige(v.von_datum);
      const bis = formatDatumAnzeige(v.bis_datum);
      return `<li><strong>${v.titel}</strong> (${v.von_datum === v.bis_datum ? von : `${von} - ${bis}`})</li>`;
    }).join('');
    return `<div class="alert alert-info"><i class="bi bi-calendar-event"></i> <strong>Hinweis:</strong> Im Zeitraum ${veranstaltungen.length === 1 ? 'findet eine Veranstaltung statt' : 'finden Veranstaltungen statt'}:<ul class="mb-0 mt-2">${liste}</ul></div>`;
  }

  erstelleFeiertagsHinweisHTML(feiertage) {
    if (!feiertage || feiertage.length === 0) return '';
    const liste = feiertage.map(f => {
      const d = parseDatumLokal(f.datum);
      const wt = ['So','Mo','Di','Mi','Do','Fr','Sa'][d.getDay()];
      return `<li><strong>${f.name}</strong> (${wt}, ${formatDatumAnzeige(f.datum)})</li>`;
    }).join('');
    return `<div class="alert alert-success"><i class="bi bi-calendar-check"></i> <strong>Feiertage im Zeitraum:</strong> ${feiertage.length === 1 ? 'Ein Feiertag wird' : `${feiertage.length} Feiertage werden`} automatisch abgezogen:<ul class="mb-0 mt-2">${liste}</ul></div>`;
  }

  async pruefeKollegenAbwesenheiten(mitarbeiterId, vonDatum, bisDatum) {
    try {
      const mitarbeiter = await this.dataManager.getMitarbeiter(mitarbeiterId);
      if (!mitarbeiter) return [];

      const kollegenResult = await this.dataManager.db.query(
        `SELECT id, vorname, nachname FROM mitarbeiter
         WHERE abteilung_id = ? AND id != ? AND status = 'AKTIV'`,
        [mitarbeiter.abteilung_id, mitarbeiterId]
      );
      if (!kollegenResult.success) return [];

      const abwesenheiten = [];
      const zeitraumParams = [vonDatum, bisDatum, vonDatum, bisDatum, vonDatum, bisDatum];

      await Promise.all(kollegenResult.data.map(async (kollege) => {
        const [urlaubR, krankheitR, schulungR] = await Promise.all([
          this.dataManager.db.query(
            `SELECT von_datum, bis_datum, tage FROM urlaub WHERE mitarbeiter_id = ?
             AND ((von_datum BETWEEN ? AND ?) OR (bis_datum BETWEEN ? AND ?) OR (von_datum <= ? AND bis_datum >= ?))`,
            [kollege.id, ...zeitraumParams]
          ),
          this.dataManager.db.query(
            `SELECT von_datum, bis_datum, tage FROM krankheit WHERE mitarbeiter_id = ?
             AND ((von_datum BETWEEN ? AND ?) OR (bis_datum BETWEEN ? AND ?) OR (von_datum <= ? AND bis_datum >= ?))`,
            [kollege.id, ...zeitraumParams]
          ),
          this.dataManager.db.query(
            `SELECT datum, dauer_tage, titel FROM schulung WHERE mitarbeiter_id = ? AND datum BETWEEN ? AND ?`,
            [kollege.id, vonDatum, bisDatum]
          ),
        ]);

        const name = `${kollege.vorname} ${kollege.nachname}`;
        if (urlaubR.success) urlaubR.data.forEach(u => abwesenheiten.push({ name, typ: 'Urlaub', von: u.von_datum, bis: u.bis_datum, tage: u.tage, klasse: 'text-success' }));
        if (krankheitR.success) krankheitR.data.forEach(k => abwesenheiten.push({ name, typ: 'Krank', von: k.von_datum, bis: k.bis_datum, tage: k.tage, klasse: 'text-danger' }));
        if (schulungR.success) schulungR.data.forEach(s => {
          const end = new Date(parseDatumLokal(s.datum));
          end.setDate(end.getDate() + Math.floor(s.dauer_tage) - 1);
          abwesenheiten.push({ name, typ: 'Schulung', von: s.datum, bis: formatDatumLokal(end), tage: s.dauer_tage, titel: s.titel, klasse: 'text-info' });
        });
      }));

      return abwesenheiten;
    } catch { return []; }
  }

  erstelleKollegenHinweisHTML(abwesenheiten) {
    if (!abwesenheiten || abwesenheiten.length === 0) {
      return `<div class="alert alert-success"><i class="bi bi-check-circle"></i> <strong>Keine Überschneidungen:</strong> Alle Kollegen sind verfügbar.</div>`;
    }
    const liste = abwesenheiten.map(a =>
      `<li class="${a.klasse}"><strong>${a.name}</strong> - ${a.typ} (${formatDatumAnzeige(a.von)} - ${formatDatumAnzeige(a.bis)}, ${formatZahl(a.tage)} Tage)${a.titel ? `<br><small class="text-muted">${a.titel}</small>` : ''}</li>`
    ).join('');
    return `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle"></i> <strong>Achtung:</strong> Folgende Kollegen sind ebenfalls abwesend:<ul class="mb-0 mt-2">${liste}</ul></div>`;
  }

  /**
   * FIX: showModal() entfernte vorher mit querySelectorAll('.modal') ALLE
   * Modals auf der Seite, inkl. aktuell sichtbarer. Das führte zu
   * Memory-Leaks weil Bootstrap Event-Listener auf entfernten Elementen
   * zurückblieben.
   *
   * Fix: nur Modals entfernen die weder sichtbar (keine .show-Klasse)
   * noch aktiv sind. Bootstrap-Instanz wird korrekt dispose()d bevor
   * das Element aus dem DOM entfernt wird.
   */
  async showModal(html, onSave) {
    // Nur nicht-sichtbare, verwaiste Modals aufräumen
    document.querySelectorAll('.modal:not(.show)').forEach(m => {
      const instance = bootstrap.Modal.getInstance(m);
      if (instance) instance.dispose();
      m.remove();
    });
    // Verwaiste Backdrops entfernen
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());

    document.body.insertAdjacentHTML('beforeend', html);
    const modalElement = document.querySelector('.modal:not(.show)');
    if (!modalElement) { console.error('Modal-Element nicht gefunden'); return; }

    const modal = new bootstrap.Modal(modalElement);

    const btnSpeichern = modalElement.querySelector('#btnSpeichern');
    if (btnSpeichern && onSave) {
      btnSpeichern.addEventListener('click', async () => {
        btnSpeichern.disabled = true;
        btnSpeichern.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Speichern...';
        try {
          if (await onSave()) modal.hide();
        } catch (error) {
          console.error('Fehler beim Speichern:', error);
          showNotification('Fehler', error.message, 'danger');
        } finally {
          btnSpeichern.disabled = false;
          btnSpeichern.innerHTML = '<i class="bi bi-check-lg"></i> Speichern';
        }
      });
    }

    modal.show();
    modalElement.addEventListener('hidden.bs.modal', () => { modal.dispose(); modalElement.remove(); });

    return new Promise(resolve => {
      modalElement.addEventListener('shown.bs.modal', () => resolve(modal), { once: true });
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DialogBase, showNotification,
    berechneArbeitstage, berechneArbeitstageAsync,
    berechneUrlaubstageAsync,
    berechneEndDatumNachArbeitstagen, berechneEndDatumNachArbeitstagenAsync,
    berechneEndDatumNachUrlaubstagenAsync,
    getFeiertageImZeitraum, invalidiereFeiertageCache,
    formatDatumLokal, parseDatumLokal, formatDatumAnzeige,
  };
}