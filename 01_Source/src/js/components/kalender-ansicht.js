/**
 * Kalender-Ansicht Komponente
 * Zeigt einen Monatskalender mit allen Abwesenheiten der Mitarbeiter
 * INLINE VERSION - Wird im Hauptbereich angezeigt statt als Modal
 */

class KalenderAnsicht {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.currentDate = new Date();
    this.currentMonth = this.currentDate.getMonth();
    this.currentYear = this.currentDate.getFullYear();
    this.selectedAbteilung = null;
    this.abwesenheiten = [];
    this.feiertage = new Map();
    this.veranstaltungen = [];
    this.ansichtModus = 'monat'; // 'monat' oder 'liste'
  }

  /**
   * Zeigt die Kalenderansicht inline im Hauptbereich
   */
  async zeigen() {
    // Lade Daten
    await this.ladeDaten();

    const container = document.getElementById('kalenderAnsicht');
    if (!container) return;

    // Render den Kalender-Inhalt
    container.innerHTML = this._erstelleInlineHTML();

    // Event-Listener initialisieren
    this._initEventListeners(container);

    // Kalender rendern
    this._renderKalender();
  }

  /**
   * Lädt alle benötigten Daten
   */
  async ladeDaten() {
    const jahrStr = this.currentYear.toString();

    // Lade Feiertage
    const feiertageResult = await this.dataManager.db.query(`
      SELECT datum, name FROM feiertage 
      WHERE strftime('%Y', datum) = ?
    `, [jahrStr]);

    this.feiertage.clear();
    if (feiertageResult.success && feiertageResult.data) {
      feiertageResult.data.forEach(f => {
        this.feiertage.set(f.datum, f.name);
      });
    }

    // Lade Veranstaltungen
    const veranstaltungenResult = await this.dataManager.db.query(`
      SELECT * FROM veranstaltungen 
      WHERE strftime('%Y', von_datum) = ? OR strftime('%Y', bis_datum) = ?
      ORDER BY von_datum
    `, [jahrStr, jahrStr]);

    this.veranstaltungen = veranstaltungenResult.success ? veranstaltungenResult.data : [];

    // Lade Abwesenheiten
    await this.ladeAbwesenheiten();
  }

  /**
   * Lädt Abwesenheiten für den aktuellen Monat
   */
  async ladeAbwesenheiten() {
    const startDatum = new Date(this.currentYear, this.currentMonth, 1);
    const endDatum = new Date(this.currentYear, this.currentMonth + 1, 0);

    const startStr = startDatum.toISOString().split('T')[0];
    const endStr = endDatum.toISOString().split('T')[0];

    this.abwesenheiten = [];

    // Lade alle aktiven Mitarbeiter
    let mitarbeiterQuery = `
      SELECT m.*, a.name as abteilung_name, a.farbe as abteilung_farbe
      FROM mitarbeiter m
      LEFT JOIN abteilungen a ON m.abteilung_id = a.id
      WHERE m.status = 'AKTIV'
    `;

    if (this.selectedAbteilung) {
      mitarbeiterQuery += ` AND a.name = ?`;
    }

    mitarbeiterQuery += ` ORDER BY a.name, m.nachname, m.vorname`;

    const mitarbeiterResult = await this.dataManager.db.query(
      mitarbeiterQuery,
      this.selectedAbteilung ? [this.selectedAbteilung] : []
    );

    const mitarbeiter = mitarbeiterResult.success ? mitarbeiterResult.data : [];

    for (const ma of mitarbeiter) {
      // Urlaub
      const urlaubResult = await this.dataManager.db.query(`
        SELECT von_datum, bis_datum, tage, notiz
        FROM urlaub
        WHERE mitarbeiter_id = ?
          AND ((von_datum BETWEEN ? AND ?) OR (bis_datum BETWEEN ? AND ?) 
               OR (von_datum <= ? AND bis_datum >= ?))
      `, [ma.id, startStr, endStr, startStr, endStr, startStr, endStr]);

      if (urlaubResult.success && urlaubResult.data) {
        urlaubResult.data.forEach(u => {
          this.abwesenheiten.push({
            mitarbeiter: ma,
            typ: 'urlaub',
            von: u.von_datum,
            bis: u.bis_datum,
            tage: u.tage,
            notiz: u.notiz,
            farbe: '#28a745',
            icon: 'calendar-check'
          });
        });
      }

      // Krankheit
      const krankheitResult = await this.dataManager.db.query(`
        SELECT von_datum, bis_datum, tage, notiz
        FROM krankheit
        WHERE mitarbeiter_id = ?
          AND ((von_datum BETWEEN ? AND ?) OR (bis_datum BETWEEN ? AND ?) 
               OR (von_datum <= ? AND bis_datum >= ?))
      `, [ma.id, startStr, endStr, startStr, endStr, startStr, endStr]);

      if (krankheitResult.success && krankheitResult.data) {
        krankheitResult.data.forEach(k => {
          this.abwesenheiten.push({
            mitarbeiter: ma,
            typ: 'krankheit',
            von: k.von_datum,
            bis: k.bis_datum,
            tage: k.tage,
            notiz: k.notiz,
            farbe: '#dc3545',
            icon: 'bandaid'
          });
        });
      }

      // Schulung
      const schulungResult = await this.dataManager.db.query(`
        SELECT datum, dauer_tage, titel, notiz
        FROM schulung
        WHERE mitarbeiter_id = ?
          AND datum BETWEEN ? AND ?
      `, [ma.id, startStr, endStr]);

      if (schulungResult.success && schulungResult.data) {
        schulungResult.data.forEach(s => {
          const bisDatum = new Date(s.datum);
          bisDatum.setDate(bisDatum.getDate() + Math.floor(s.dauer_tage) - 1);

          this.abwesenheiten.push({
            mitarbeiter: ma,
            typ: 'schulung',
            von: s.datum,
            bis: bisDatum.toISOString().split('T')[0],
            tage: s.dauer_tage,
            titel: s.titel,
            notiz: s.notiz,
            farbe: '#17a2b8',
            icon: 'book'
          });
        });
      }
    }
  }

  /**
   * Erstellt das Inline HTML (ohne Modal-Wrapper)
   */
  _erstelleInlineHTML() {
    const monatNamen = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];

    return `
      <!-- Kalender-Toolbar -->
      <div class="kalender-toolbar d-flex align-items-center justify-content-between p-3 bg-dark border-bottom">
        <div class="d-flex align-items-center gap-3">
          <button class="btn btn-outline-light" id="btnVorigerMonat">
            <i class="bi bi-chevron-left"></i>
          </button>
          <h4 class="mb-0 text-white" id="kalenderTitel" style="min-width: 200px; text-align: center;">
            ${monatNamen[this.currentMonth]} ${this.currentYear}
          </h4>
          <button class="btn btn-outline-light" id="btnNaechsterMonat">
            <i class="bi bi-chevron-right"></i>
          </button>
          <button class="btn btn-outline-info ms-2" id="btnHeute">
            <i class="bi bi-calendar-date"></i> Heute
          </button>
        </div>
        
        <div class="d-flex align-items-center gap-3">
          <select class="form-select" id="kalenderAbteilungFilter" style="width: 200px;">
            <option value="">Alle Abteilungen</option>
            <!-- Wird dynamisch gefüllt -->
          </select>
          
          <div class="btn-group" role="group">
            <button class="btn btn-outline-light ${this.ansichtModus === 'monat' ? 'active' : ''}" id="btnAnsichtMonat" title="Monatsansicht">
              <i class="bi bi-grid-3x3"></i>
            </button>
            <button class="btn btn-outline-light ${this.ansichtModus === 'liste' ? 'active' : ''}" id="btnAnsichtListe" title="Listenansicht">
              <i class="bi bi-list-ul"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Legende -->
      <div class="kalender-legende d-flex align-items-center gap-4 px-3 py-2 bg-dark border-bottom">
        <span class="d-flex align-items-center gap-1">
          <span class="legende-farbe" style="background-color: #28a745;"></span>
          <small>Urlaub</small>
        </span>
        <span class="d-flex align-items-center gap-1">
          <span class="legende-farbe" style="background-color: #dc3545;"></span>
          <small>Krankheit</small>
        </span>
        <span class="d-flex align-items-center gap-1">
          <span class="legende-farbe" style="background-color: #17a2b8;"></span>
          <small>Schulung</small>
        </span>
        <span class="d-flex align-items-center gap-1">
          <span class="legende-farbe" style="background-color: #6f42c1;"></span>
          <small>Feiertag</small>
        </span>
        <span class="d-flex align-items-center gap-1">
          <span class="legende-farbe" style="background-color: #fd7e14;"></span>
          <small>Veranstaltung</small>
        </span>
      </div>

      <!-- Kalender-Container -->
      <div class="kalender-container flex-grow-1" id="kalenderContainer" style="overflow: auto;">
        <!-- Wird dynamisch gefüllt -->
      </div>
      
      <style>
        .kalender-inline-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 0;
        }
        
        .kalender-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
          background-color: #3d3d3d;
          height: 100%;
        }
        
        .kalender-header {
          background-color: #2d2d2d;
          padding: 10px;
          text-align: center;
          font-weight: bold;
          color: #e0e0e0;
          border-bottom: 2px solid #495057;
        }
        
        .kalender-header.wochenende {
          color: #6c757d;
        }
        
        .kalender-tag {
          background-color: #1a1a1a;
          min-height: 120px;
          padding: 5px;
          position: relative;
          overflow: hidden;
        }
        
        .kalender-tag.anderer-monat {
          background-color: #0d0d0d;
          opacity: 0.5;
        }
        
        .kalender-tag.wochenende {
          background-color: #1f1f1f;
        }
        
        .kalender-tag.heute {
          box-shadow: inset 0 0 0 2px #0d6efd;
        }
        
        .kalender-tag.feiertag {
          background-color: rgba(111, 66, 193, 0.2);
        }
        
        .tag-nummer {
          font-size: 1.1rem;
          font-weight: bold;
          color: #e0e0e0;
          margin-bottom: 5px;
        }
        
        .tag-nummer.wochenende {
          color: #6c757d;
        }
        
        .tag-nummer.heute {
          color: #0d6efd;
        }
        
        .feiertag-name {
          font-size: 0.7rem;
          color: #6f42c1;
          font-weight: 500;
          margin-bottom: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .veranstaltung-badge {
          font-size: 0.65rem;
          background-color: #fd7e14;
          color: white;
          padding: 1px 4px;
          border-radius: 3px;
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
        }
        
        .abwesenheit-eintrag {
          font-size: 0.7rem;
          padding: 2px 4px;
          border-radius: 3px;
          margin-bottom: 2px;
          color: white;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        
        .abwesenheit-eintrag:hover {
          opacity: 0.8;
        }
        
        .mehr-eintraege {
          font-size: 0.65rem;
          color: #6c757d;
          text-align: center;
          cursor: pointer;
        }
        
        .mehr-eintraege:hover {
          color: #e0e0e0;
        }
        
        .legende-farbe {
          width: 12px;
          height: 12px;
          border-radius: 3px;
          display: inline-block;
        }
        
        /* Listen-Ansicht */
        .kalender-liste {
          padding: 1rem;
        }
        
        .kalender-liste-tag {
          background-color: #2d2d2d;
          border-radius: 8px;
          margin-bottom: 0.5rem;
          overflow: hidden;
        }
        
        .kalender-liste-header {
          padding: 0.5rem 1rem;
          background-color: #3d3d3d;
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .kalender-liste-header.wochenende {
          background-color: #333;
        }
        
        .kalender-liste-header.feiertag {
          background-color: rgba(111, 66, 193, 0.3);
        }
        
        .kalender-liste-header.heute {
          border-left: 3px solid #0d6efd;
        }
        
        .kalender-liste-eintraege {
          padding: 0.5rem 1rem;
        }
        
        .kalender-liste-eintrag {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0;
          border-bottom: 1px solid #3d3d3d;
        }
        
        .kalender-liste-eintrag:last-child {
          border-bottom: none;
        }
        
        .kalender-container {
          flex: 1;
          overflow: auto;
        }

        /* Tooltip Styles */
.kalender-tooltip {
  position: fixed;
  z-index: 10000;
  background: #2d2d2d;
  border: 1px solid #495057;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  min-width: 280px;
  max-width: 400px;
  animation: tooltipFadeIn 0.2s ease;
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.kalender-tooltip .tooltip-header {
  padding: 0.75rem 1rem;
  color: white;
  font-weight: 600;
  border-radius: 8px 8px 0 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.kalender-tooltip .tooltip-body {
  padding: 1rem;
}

.kalender-tooltip .tooltip-row {
  padding: 0.25rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #e0e0e0;
  font-size: 0.85rem;
}

.kalender-tooltip .tooltip-row i {
  color: #6c757d;
  width: 16px;
}

/* Scrollbare Tageszellen */
.kalender-tag {
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 150px; /* Anpassbar je nach Bedarf */
}

.kalender-tag::-webkit-scrollbar {
  width: 4px;
}

.kalender-tag::-webkit-scrollbar-track {
  background: transparent;
}

.kalender-tag::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.kalender-tag::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Mehr-Button besser sichtbar */
.mehr-eintraege {
  background-color: rgba(255, 255, 255, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
  margin-top: 2px;
  transition: all 0.2s ease;
}

.mehr-eintraege:hover {
  background-color: rgba(255, 255, 255, 0.2);
  color: #fff !important;
}

/* Abwesenheit-Eintrag klickbar machen */
.abwesenheit-eintrag {
  position: relative;
}

.abwesenheit-eintrag::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.1);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.abwesenheit-eintrag:hover::after {
  opacity: 1;
}
      </style>
    `;
  }
  // Nach Zeile 113 (nach dem Erstellen des HTML) diese Methode hinzufügen:

  /**
   * Zeigt Tooltip mit Eintrag-Details
   */
  _zeigeEintragTooltip(eintrag, element) {
    // Entferne alte Tooltips
    document.querySelectorAll('.kalender-tooltip').forEach(t => t.remove());

    const tooltip = document.createElement('div');
    tooltip.className = 'kalender-tooltip';

    let inhalt = `
    <div class="tooltip-header" style="background-color: ${eintrag.farbe}">
      <i class="bi bi-${eintrag.icon}"></i>
      ${this._getTypLabel(eintrag.typ)}
    </div>
    <div class="tooltip-body">
      <div class="tooltip-row">
        <strong>${eintrag.mitarbeiter.vorname} ${eintrag.mitarbeiter.nachname}</strong>
      </div>
      <div class="tooltip-row">
        <span class="abteilung-badge" style="background-color: ${eintrag.mitarbeiter.abteilung_farbe}">
          ${eintrag.mitarbeiter.abteilung_name}
        </span>
      </div>
      <div class="tooltip-row">
        <i class="bi bi-calendar"></i>
        ${formatDatumAnzeige(eintrag.von)} - ${formatDatumAnzeige(eintrag.bis)}
      </div>
      <div class="tooltip-row">
        <i class="bi bi-hourglass"></i>
        ${formatZahl(eintrag.tage)} ${eintrag.typ === 'ueberstunden' ? 'Stunden' : 'Tage'}
      </div>
  `;

    if (eintrag.titel) {
      inhalt += `
      <div class="tooltip-row">
        <i class="bi bi-tag"></i>
        ${eintrag.titel}
      </div>
    `;
    }

    if (eintrag.notiz) {
      inhalt += `
      <div class="tooltip-row">
        <i class="bi bi-sticky"></i>
        ${eintrag.notiz}
      </div>
    `;
    }

    inhalt += `</div>`;
    tooltip.innerHTML = inhalt;

    document.body.appendChild(tooltip);

    // Position berechnen
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    let top = rect.bottom + 10;

    // Overflow rechts verhindern
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }

    // Overflow links verhindern
    if (left < 10) {
      left = 10;
    }

    // Overflow unten verhindern (zeige über dem Element)
    if (top + tooltipRect.height > window.innerHeight - 10) {
      top = rect.top - tooltipRect.height - 10;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';

    // Schließen bei Klick außerhalb
    setTimeout(() => {
      document.addEventListener('click', function closeTooltip(e) {
        if (!tooltip.contains(e.target) && !element.contains(e.target)) {
          tooltip.remove();
          document.removeEventListener('click', closeTooltip);
        }
      });
    }, 100);
  }
  /**
   * Initialisiert Event-Listener
   */
  async _initEventListeners(container) {
    const monatNamen = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];

    // Abteilungs-Filter füllen
    const abteilungen = await this.dataManager.getAlleAbteilungen();
    const abteilungFilter = container.querySelector('#kalenderAbteilungFilter');

    if (abteilungFilter) {
      abteilungen.forEach(abt => {
        const option = document.createElement('option');
        option.value = abt.name;
        option.textContent = abt.name;
        abteilungFilter.appendChild(option);
      });
    }

    // Navigation
    container.querySelector('#btnVorigerMonat')?.addEventListener('click', async () => {
      this.currentMonth--;
      if (this.currentMonth < 0) {
        this.currentMonth = 11;
        this.currentYear--;
      }
      await this.ladeAbwesenheiten();
      this._renderKalender();
      const titel = container.querySelector('#kalenderTitel');
      if (titel) titel.textContent = `${monatNamen[this.currentMonth]} ${this.currentYear}`;
    });

    container.querySelector('#btnNaechsterMonat')?.addEventListener('click', async () => {
      this.currentMonth++;
      if (this.currentMonth > 11) {
        this.currentMonth = 0;
        this.currentYear++;
      }
      await this.ladeAbwesenheiten();
      this._renderKalender();
      const titel = container.querySelector('#kalenderTitel');
      if (titel) titel.textContent = `${monatNamen[this.currentMonth]} ${this.currentYear}`;
    });

    container.querySelector('#btnHeute')?.addEventListener('click', async () => {
      const heute = new Date();
      this.currentMonth = heute.getMonth();
      this.currentYear = heute.getFullYear();
      await this.ladeDaten();
      this._renderKalender();
      const titel = container.querySelector('#kalenderTitel');
      if (titel) titel.textContent = `${monatNamen[this.currentMonth]} ${this.currentYear}`;
    });

    // Abteilungs-Filter
    abteilungFilter?.addEventListener('change', async (e) => {
      this.selectedAbteilung = e.target.value || null;
      await this.ladeAbwesenheiten();
      this._renderKalender();
    });

    // Ansicht wechseln
    const btnMonat = container.querySelector('#btnAnsichtMonat');
    const btnListe = container.querySelector('#btnAnsichtListe');

    btnMonat?.addEventListener('click', () => {
      this.ansichtModus = 'monat';
      btnMonat.classList.add('active');
      btnListe?.classList.remove('active');
      this._renderKalender();
    });

    btnListe?.addEventListener('click', () => {
      this.ansichtModus = 'liste';
      btnListe.classList.add('active');
      btnMonat?.classList.remove('active');
      this._renderKalender();
    });
  }

  /**
   * Rendert den Kalender
   */
  _renderKalender() {
    const container = document.getElementById('kalenderContainer');
    if (!container) return;

    if (this.ansichtModus === 'liste') {
      container.innerHTML = this._erstelleListenAnsicht();
    } else {
      container.innerHTML = this._erstelleMonatsAnsicht();
    }

    // Event-Listener für Einträge
    // ERSETZE die Zeilen 165-174 mit:

    // Event-Listener für Einträge UND "mehr..." Buttons
    container.addEventListener('click', (e) => {
      const eintragEl = e.target.closest('.abwesenheit-eintrag');
      const mehrBtn = e.target.closest('.mehr-eintraege');

      if (eintragEl) {
        e.stopPropagation();
        const maId = eintragEl.dataset.mitarbeiterId;
        const typ = eintragEl.dataset.typ;
        const von = eintragEl.dataset.von;

        // Finde den passenden Eintrag
        const eintrag = this.abwesenheiten.find(a =>
          a.mitarbeiter.id === maId &&
          a.typ === typ &&
          a.von === von
        );

        if (eintrag) {
          this._zeigeEintragTooltip(eintrag, eintragEl);
        }
      } else if (mehrBtn) {
        e.stopPropagation();
        this._zeigeAlleTageseintraege(mehrBtn.dataset.datum);
      }
    });
  }
  /**
   * Zeigt alle Einträge eines Tages in einem Modal
   */
  _zeigeAlleTageseintraege(datum) {
    const tagesAbwesenheiten = this._getAbwesenheitenFuerTag(datum);
    const datumFormatiert = formatDatumAnzeige(datum);

    const modalHtml = `
    <div class="modal fade" id="tageseintraegeModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-calendar-day"></i> Einträge vom ${datumFormatiert}
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="list-group">
              ${tagesAbwesenheiten.map(a => `
                <div class="list-group-item list-group-item-action bg-dark">
                  <div class="d-flex align-items-center gap-3">
                    <div class="flex-shrink-0">
                      <span class="badge" style="background-color: ${a.farbe}; padding: 0.5rem;">
                        <i class="bi bi-${a.icon}"></i>
                      </span>
                    </div>
                    <div class="flex-grow-1">
                      <h6 class="mb-1">${a.mitarbeiter.vorname} ${a.mitarbeiter.nachname}</h6>
                      <div>
                        <span class="abteilung-badge" style="background-color: ${a.mitarbeiter.abteilung_farbe}">
                          ${a.mitarbeiter.abteilung_name}
                        </span>
                        <span class="ms-2 text-muted">${this._getTypLabel(a.typ)}</span>
                      </div>
                      ${a.titel ? `<small class="text-info"><i class="bi bi-tag"></i> ${a.titel}</small>` : ''}
                      ${a.notiz ? `<small class="text-muted d-block mt-1"><i class="bi bi-sticky"></i> ${a.notiz}</small>` : ''}
                    </div>
                    <div class="flex-shrink-0 text-end">
                      <div class="fw-bold">${formatZahl(a.tage)} ${a.typ === 'ueberstunden' ? 'Std.' : 'Tage'}</div>
                      <small class="text-muted">${formatDatumAnzeige(a.von)} - ${formatDatumAnzeige(a.bis)}</small>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Schließen</button>
          </div>
        </div>
      </div>
    </div>
  `;

    // Modal anzeigen
    const oldModal = document.querySelector('#tageseintraegeModal');
    if (oldModal) oldModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalElement = document.querySelector('#tageseintraegeModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();

    modalElement.addEventListener('hidden.bs.modal', () => {
      modalElement.remove();
    }, { once: true });
  }
  /**
   * Erstellt die Monatsansicht HTML
   */
  _erstelleMonatsAnsicht() {
    const wochentage = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    // Erster Tag des Monats
    const ersterTag = new Date(this.currentYear, this.currentMonth, 1);
    // Letzter Tag des Monats
    const letzterTag = new Date(this.currentYear, this.currentMonth + 1, 0);

    // Wochentag des ersten Tags (0 = Sonntag, wir wollen Mo = 0)
    let startWochentag = ersterTag.getDay() - 1;
    if (startWochentag < 0) startWochentag = 6;

    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    const heuteStr = this._formatDatumLokal(heute);

    let html = '<div class="kalender-grid">';

    // Header
    wochentage.forEach((tag, index) => {
      const isWochenende = index >= 5;
      html += `<div class="kalender-header ${isWochenende ? 'wochenende' : ''}">${tag}</div>`;
    });

    // Tage vor dem Monat
    const vormonatLetzterTag = new Date(this.currentYear, this.currentMonth, 0).getDate();
    for (let i = startWochentag - 1; i >= 0; i--) {
      const tag = vormonatLetzterTag - i;
      html += `<div class="kalender-tag anderer-monat">
        <div class="tag-nummer">${tag}</div>
      </div>`;
    }

    // Tage des Monats
    for (let tag = 1; tag <= letzterTag.getDate(); tag++) {
      const datum = new Date(this.currentYear, this.currentMonth, tag);
      const datumStr = this._formatDatumLokal(datum);
      const wochentag = datum.getDay();
      const isWochenende = wochentag === 0 || wochentag === 6;
      const isHeute = datumStr === heuteStr;
      const isFeiertag = this.feiertage.has(datumStr);
      const feiertagName = this.feiertage.get(datumStr);

      // Finde Abwesenheiten für diesen Tag
      const tagesAbwesenheiten = this._getAbwesenheitenFuerTag(datumStr);

      // Finde Veranstaltungen für diesen Tag
      const tagesVeranstaltungen = this._getVeranstaltungenFuerTag(datumStr);

      let klassen = 'kalender-tag';
      if (isWochenende) klassen += ' wochenende';
      if (isHeute) klassen += ' heute';
      if (isFeiertag) klassen += ' feiertag';

      html += `<div class="${klassen}" data-datum="${datumStr}">
        <div class="tag-nummer ${isWochenende ? 'wochenende' : ''} ${isHeute ? 'heute' : ''}">${tag}</div>`;

      // Feiertag anzeigen
      if (isFeiertag) {
        html += `<div class="feiertag-name" title="${feiertagName}">${feiertagName}</div>`;
      }

      // Veranstaltungen anzeigen
      tagesVeranstaltungen.forEach(v => {
        html += `<div class="veranstaltung-badge" title="${v.titel}">${v.titel}</div>`;
      });

      // Abwesenheiten anzeigen (max 4, dann "mehr...")
      const maxAnzeige = 3;
      tagesAbwesenheiten.slice(0, maxAnzeige).forEach(a => {
        html += `
          <div class="abwesenheit-eintrag" 
               style="background-color: ${a.farbe};"
               data-mitarbeiter-id="${a.mitarbeiter.id}"
               data-typ="${a.typ}"
               data-von="${a.von}"
               data-bis="${a.bis}"
               title="${a.mitarbeiter.vorname} ${a.mitarbeiter.nachname} - ${this._getTypLabel(a.typ)}">
            <i class="bi bi-${a.icon}"></i>
            ${a.mitarbeiter.vorname.charAt(0)}. ${a.mitarbeiter.nachname}
          </div>`;
      });

      if (tagesAbwesenheiten.length > maxAnzeige) {
        html += `<div class="mehr-eintraege" data-datum="${datumStr}">
          +${tagesAbwesenheiten.length - maxAnzeige} weitere
        </div>`;
      }

      html += '</div>';
    }

    // Tage nach dem Monat (um das Grid zu füllen)
    const gesamtTage = startWochentag + letzterTag.getDate();
    const restTage = 7 - (gesamtTage % 7);
    if (restTage < 7) {
      for (let i = 1; i <= restTage; i++) {
        html += `<div class="kalender-tag anderer-monat">
          <div class="tag-nummer">${i}</div>
        </div>`;
      }
    }

    html += '</div>';
    return html;
  }



  /**
 * Formatiert Datum lokal ohne UTC-Konvertierung
 */
  _formatDatumLokal(date) {
    const jahr = date.getFullYear();
    const monat = String(date.getMonth() + 1).padStart(2, '0');
    const tag = String(date.getDate()).padStart(2, '0');
    return `${jahr}-${monat}-${tag}`;
  }
  /**
   * Erstellt die Listenansicht HTML
   */
  _erstelleListenAnsicht() {
    const wochentage = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const letzterTag = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    const heuteStr = this._formatDatumLokal(heute);

    let html = '<div class="kalender-liste">';

    for (let tag = 1; tag <= letzterTag; tag++) {
      const datum = new Date(this.currentYear, this.currentMonth, tag);
      const datumStr = this._formatDatumLokal(datum);
      const wochentag = datum.getDay();
      const isWochenende = wochentag === 0 || wochentag === 6;
      const isHeute = datumStr === heuteStr;
      const isFeiertag = this.feiertage.has(datumStr);
      const feiertagName = this.feiertage.get(datumStr);

      const tagesAbwesenheiten = this._getAbwesenheitenFuerTag(datumStr);
      const tagesVeranstaltungen = this._getVeranstaltungenFuerTag(datumStr);

      // Nur Tage mit Einträgen, Feiertagen oder Veranstaltungen anzeigen
      if (tagesAbwesenheiten.length === 0 && !isFeiertag && tagesVeranstaltungen.length === 0) {
        continue;
      }

      let headerKlassen = 'kalender-liste-header';
      if (isWochenende) headerKlassen += ' wochenende';
      if (isFeiertag) headerKlassen += ' feiertag';
      if (isHeute) headerKlassen += ' heute';

      html += `<div class="kalender-liste-tag">
        <div class="${headerKlassen}">
          <strong>${wochentage[wochentag]}, ${tag}. ${this._getMonatName(this.currentMonth)}</strong>
          ${isFeiertag ? `<span class="badge bg-purple text-white" style="background-color: #6f42c1;">${feiertagName}</span>` : ''}
          ${isHeute ? '<span class="badge bg-primary">Heute</span>' : ''}
        </div>`;

      if (tagesVeranstaltungen.length > 0 || tagesAbwesenheiten.length > 0) {
        html += '<div class="kalender-liste-eintraege">';

        // Veranstaltungen
        tagesVeranstaltungen.forEach(v => {
          html += `
            <div class="kalender-liste-eintrag">
              <span class="badge" style="background-color: #fd7e14;">
                <i class="bi bi-calendar-event"></i>
              </span>
              <span><strong>${v.titel}</strong></span>
              ${v.beschreibung ? `<small class="text-muted">- ${v.beschreibung}</small>` : ''}
            </div>`;
        });

        // Abwesenheiten
        tagesAbwesenheiten.forEach(a => {
          html += `
            <div class="kalender-liste-eintrag abwesenheit-eintrag" 
                 data-mitarbeiter-id="${a.mitarbeiter.id}"
                 data-typ="${a.typ}"
                 data-von="${a.von}"
                 data-bis="${a.bis}"
                 style="cursor: pointer;">
              <span class="badge" style="background-color: ${a.farbe};">
                <i class="bi bi-${a.icon}"></i>
              </span>
              <span><strong>${a.mitarbeiter.vorname} ${a.mitarbeiter.nachname}</strong></span>
              <span class="abteilung-badge" style="background-color: ${a.mitarbeiter.abteilung_farbe}; font-size: 0.7rem; padding: 2px 6px;">
                ${a.mitarbeiter.abteilung_name}
              </span>
              <small class="text-muted">${this._getTypLabel(a.typ)}</small>
              ${a.titel ? `<small class="text-info">- ${a.titel}</small>` : ''}
            </div>`;
        });

        html += '</div>';
      }

      html += '</div>';
    }

    if (html === '<div class="kalender-liste">') {
      html += `
        <div class="text-center text-muted py-5">
          <i class="bi bi-calendar-x fs-1 d-block mb-2"></i>
          Keine Einträge in diesem Monat
        </div>`;
    }

    html += '</div>';
    return html;
  }

  /**
   * Gibt Abwesenheiten für einen Tag zurück
   */
  _getAbwesenheitenFuerTag(datumStr) {
    const [jahr, monat, tag] = datumStr.split('-').map(Number);
    const datum = new Date(jahr, monat - 1, tag);
    return this.abwesenheiten.filter(a => {
      const [vonJahr, vonMonat, vonTag] = a.von.split('-').map(Number);
      const von = new Date(vonJahr, vonMonat - 1, vonTag);
      const [bisJahr, bisMonat, bisTag] = a.bis.split('-').map(Number);
      const bis = new Date(bisJahr, bisMonat - 1, bisTag);
      return datum >= von && datum <= bis;
    });
  }

  /**
   * Gibt Veranstaltungen für einen Tag zurück
   */
  _getVeranstaltungenFuerTag(datumStr) {
    const [jahr, monat, tag] = datumStr.split('-').map(Number);
    const datum = new Date(jahr, monat - 1, tag);

    return this.veranstaltungen.filter(v => {
      const [vonJahr, vonMonat, vonTag] = v.von_datum.split('-').map(Number);
      const von = new Date(vonJahr, vonMonat - 1, vonTag);
      const [bisJahr, bisMonat, bisTag] = v.bis_datum.split('-').map(Number);
      const bis = new Date(bisJahr, bisMonat - 1, bisTag);
      return datum >= von && datum <= bis;
    });
  }

  /**
   * Gibt Typ-Label zurück
   */
  _getTypLabel(typ) {
    const labels = {
      urlaub: 'Urlaub',
      krankheit: 'Krank',
      schulung: 'Schulung'
    };
    return labels[typ] || typ;
  }

  /**
   * Gibt Monatsname zurück
   */
  _getMonatName(monat) {
    const monatNamen = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    return monatNamen[monat];
  }

  /**
   * Zeigt Details zu einem Eintrag
   */
  _zeigeEintragDetails(mitarbeiterId, typ, data) {
    const von = new Date(data.von).toLocaleDateString('de-DE');
    const bis = new Date(data.bis).toLocaleDateString('de-DE');

    showNotification(
      `${this._getTypLabel(typ)}`,
      `${von} - ${bis}`,
      typ === 'urlaub' ? 'success' : typ === 'krankheit' ? 'danger' : 'info'
    );
  }
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KalenderAnsicht;
}