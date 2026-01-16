/**
 * Stammdaten-Ansicht Komponente
 * Zeigt Mitarbeiter übersichtlich gruppiert nach Abteilungen
 * 
 * UPDATE:
 * - Detail-Dialog beim Klick auf Namen
 * - Buttons entfernt, Wochenstunden-Badge hinzugefügt
 */

class StammdatenAnsicht {
  constructor(dataManager, dialogManager) {
    this.dataManager = dataManager;
    this.dialogManager = dialogManager;
    this.container = document.getElementById('stammdatenAnsicht');
    this.aktuelleStatistiken = [];
    this.suchbegriff = '';
    this.abteilungFilter = null;
  }

  /**
   * Zeigt die Stammdaten-Ansicht an
   */
  async zeigen() {
    if (!this.container) return;
    
    await this.ladeDaten();
    this.render();
  }

  /**
   * Lädt Mitarbeiter-Daten
   */
  async ladeDaten() {
    this.aktuelleStatistiken = await this.dataManager.getAlleStatistiken(this.abteilungFilter);
  }

  /**
   * Rendert die Stammdaten-Ansicht
   */
  render() {
    if (!this.container) return;

    // Gruppiere nach Abteilung
    const gruppiert = this._gruppiereNachAbteilung(this.aktuelleStatistiken);

    let html = `
      <div class="stammdaten-header">
        <div class="container-fluid py-3">
          <div class="row align-items-center">
            <div class="col-md-12">
              <h4 class="mb-0">
                <i class="bi bi-people-fill"></i> Mitarbeiter-Übersicht
              </h4>
              <p class="text-muted mb-0">
                Gesamt: ${this.aktuelleStatistiken.length} Mitarbeiter
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="stammdaten-content">
    `;

    if (gruppiert.length === 0) {
      html += `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-inbox fs-1 d-block mb-3"></i>
          <h5>Keine Mitarbeiter gefunden</h5>
          <p>Legen Sie den ersten Mitarbeiter über die Subnavigation an.</p>
        </div>
      `;
    } else {
      gruppiert.forEach(gruppe => {
        html += this._renderAbteilungsGruppe(gruppe);
      });
    }

    html += `
      </div>
    `;

    this.container.innerHTML = html;
    this._initEventListeners();
  }

  /**
   * Gruppiert Mitarbeiter nach Abteilung
   */
  _gruppiereNachAbteilung(stats) {
    const gruppen = new Map();

    stats.forEach(stat => {
      const abteilungId = stat.mitarbeiter.abteilung_id;
      const abteilungName = stat.mitarbeiter.abteilung_name || 'Unbekannt';
      const abteilungFarbe = stat.mitarbeiter.abteilung_farbe || '#6c757d';

      if (!gruppen.has(abteilungId)) {
        gruppen.set(abteilungId, {
          abteilung: {
            id: abteilungId,
            name: abteilungName,
            farbe: abteilungFarbe
          },
          stats: []
        });
      }

      gruppen.get(abteilungId).stats.push(stat);
    });

    return Array.from(gruppen.values()).sort((a, b) => 
      a.abteilung.name.localeCompare(b.abteilung.name)
    );
  }

  /**
   * Rendert eine Abteilungsgruppe
   */
  _renderAbteilungsGruppe(gruppe) {
  const { abteilung, stats } = gruppe;

  let html = `
    <div class="stammdaten-abteilung stammdaten-abteilung-kompakt" style="border-left: 4px solid ${abteilung.farbe}">
      <div class="abteilung-header" style="background-color: ${abteilung.farbe}">
        <h6 class="mb-0 text-white">
          <i class="bi bi-building"></i> ${abteilung.name}
          <span class="ms-2 opacity-75">(${stats.length})</span>
        </h6>
      </div>
        <div class="abteilung-mitarbeiter">
    `;

    stats.forEach(stat => {
      html += this._renderMitarbeiterKarte(stat);
    });

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Rendert eine Mitarbeiter-Karte
   * UPDATE: Buttons entfernt, Wochenstunden-Badge hinzugefügt
   */
  _renderMitarbeiterKarte(stat) {
    const ma = stat.mitarbeiter;
    const istAusgetreten = ma.austrittsdatum != null;

    return `
      <div class="mitarbeiter-karte ${istAusgetreten ? 'ausgetreten' : ''}">
        <div class="karte-header">
          <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1 clickable" data-action="details" data-id="${ma.id}" style="cursor: pointer;">
              <h6 class="mb-1">
                <i class="bi bi-person-circle"></i> ${ma.vorname} ${ma.nachname}
                ${istAusgetreten ? '<span class="badge bg-danger ms-2"><i class="bi bi-box-arrow-right"></i> Ausgetreten</span>' : ''}
              </h6>
              <div class="text-muted small">
                ${ma.email ? `<i class="bi bi-envelope"></i> ${ma.email}<br>` : ''}
                <i class="bi bi-calendar-event"></i> Eingetreten: ${formatDatumAnzeige(ma.eintrittsdatum)}
                ${istAusgetreten ? `<br><i class="bi bi-box-arrow-right"></i> Ausgetreten: ${formatDatumAnzeige(ma.austrittsdatum)}` : ''}
              </div>
            </div>
            <div class="text-end">
              <div class="badge bg-secondary" style="font-size: 0.9rem; padding: 0.5rem 0.75rem;">
                <i class="bi bi-clock-history"></i> ${ma.wochenstunden || 40}h/Woche
              </div>
            </div>
          </div>
        </div>
        
        <div class="karte-body">
          <div class="row g-2">
            <!-- Urlaubsinfo -->
            <div class="col-md-6">
              <div class="info-box urlaub clickable" data-action="urlaub" data-id="${ma.id}">
                <div class="info-icon">
                  <i class="bi bi-calendar-check"></i>
                </div>
                <div class="info-content">
                  <div class="info-label">Urlaub ${this.dataManager.aktuellesJahr}</div>
                  <div class="info-value">${formatZahl(stat.urlaub_genommen)} / ${formatZahl(stat.urlaub_verfuegbar)}</div>
                  <div class="info-detail">Rest: <strong>${formatZahl(stat.urlaub_rest)}</strong> Tage</div>
                </div>
              </div>
            </div>

            <!-- Überstunden -->
            <div class="col-md-6">
              <div class="info-box ueberstunden clickable" data-action="ueberstunden" data-id="${ma.id}">
                <div class="info-icon">
                  <i class="bi bi-clock-history"></i>
                </div>
                <div class="info-content">
                  <div class="info-label">Überstunden</div>
                  <div class="info-value">${stat.ueberstunden >= 0 ? '+' : ''}${formatZahl(stat.ueberstunden)}h</div>
                  <div class="info-detail">Wochenstunden: ${ma.wochenstunden || 40}h</div>
                </div>
              </div>
            </div>

            <!-- Krankheit -->
            <div class="col-md-6">
              <div class="info-box krankheit clickable" data-action="krank" data-id="${ma.id}">
                <div class="info-icon">
                  <i class="bi bi-bandaid"></i>
                </div>
                <div class="info-content">
                  <div class="info-label">Krankheitstage ${this.dataManager.aktuellesJahr}</div>
                  <div class="info-value">${formatZahl(stat.krankheitstage)}</div>
                </div>
              </div>
            </div>

            <!-- Schulung -->
            <div class="col-md-6">
              <div class="info-box schulung clickable" data-action="schulung" data-id="${ma.id}">
                <div class="info-icon">
                  <i class="bi bi-book"></i>
                </div>
                <div class="info-content">
                  <div class="info-label">Schulungstage ${this.dataManager.aktuellesJahr}</div>
                  <div class="info-value">${formatZahl(stat.schulungstage)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Initialisiert Event-Listener
   */
  _initEventListeners() {
    // Event Delegation für alle Click-Actions
    this.container.addEventListener('click', async (e) => {
      const clickable = e.target.closest('[data-action]');
      if (!clickable) return;

      const action = clickable.dataset.action;
      const id = clickable.dataset.id; // String behalten - nicht zu Integer parsen!

      switch (action) {
        case 'details':
          // Detail-Dialog öffnen und danach zurück zur Stammdatenansicht
          await this.dialogManager.zeigeDetails(id, this.dataManager.aktuellesJahr, 'stammdaten');
          await this.zeigen(); // Reload nach Dialog
          break;

        case 'urlaub':
          await this.dialogManager.zeigeUrlaubDialog(id, async () => {
            await this.zeigen();
          });
          break;

        case 'krank':
          await this.dialogManager.zeigeKrankDialog(id, async () => {
            await this.zeigen();
          });
          break;

        case 'schulung':
          await this.dialogManager.zeigeSchulungDialog(id, async () => {
            await this.zeigen();
          });
          break;

        case 'ueberstunden':
          await this.dialogManager.zeigeUeberstundenDialog(id, async () => {
            await this.zeigen();
          });
          break;
      }
    });
  }

  /**
   * Filtert Mitarbeiter
   */
  async suchen(suchbegriff, abteilung = null) {
    this.suchbegriff = suchbegriff;
    this.abteilungFilter = abteilung === 'Alle' ? null : abteilung;

    let stats = await this.dataManager.getAlleStatistiken(this.abteilungFilter);

    if (suchbegriff && suchbegriff.trim() !== '') {
      const begriff = suchbegriff.toLowerCase();
      stats = stats.filter(stat => {
        const name = `${stat.mitarbeiter.vorname} ${stat.mitarbeiter.nachname}`.toLowerCase();
        const email = (stat.mitarbeiter.email || '').toLowerCase();
        return name.includes(begriff) || email.includes(begriff);
      });
    }

    this.aktuelleStatistiken = stats;
    this.render();
  }
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StammdatenAnsicht;
}