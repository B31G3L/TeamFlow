/**
 * Ehemalige-Tabelle Komponente
 * Zeigt ausgeschiedene Mitarbeiter in einer eigenen Tabelle
 */

class EhemaligeTabelle {
  constructor(dataManager, dialogManager) {
    this.dataManager = dataManager;
    this.dialogManager = dialogManager;
    this.container = null;
    this.mitarbeiterListe = [];
    this.suchbegriff = '';
  }

  /**
   * Rendert die Ehemaligen-Ansicht in einen Container
   */
  async zeigen(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    await this.ladeDaten();
    this.render();
  }

  /**
   * Lädt ausgeschiedene Mitarbeiter aus der DB
   */
  async ladeDaten() {
    const result = await this.dataManager.db.query(`
      SELECT m.*, a.name as abteilung_name, a.farbe as abteilung_farbe
      FROM mitarbeiter m
      LEFT JOIN abteilungen a ON m.abteilung_id = a.id
      WHERE m.austrittsdatum IS NOT NULL
      ORDER BY m.austrittsdatum DESC, m.nachname, m.vorname
    `);
    this.mitarbeiterListe = result.success ? result.data : [];
  }

  /**
   * Rendert die komplette Ansicht
   */
  render() {
    if (!this.container) return;

    const gefiltert = this._filtere(this.mitarbeiterListe);

    this.container.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-item">
          <input type="text" id="ehemaligenSuchfeld" class="form-control"
                 placeholder="🔍 Suche nach Name oder Abteilung..."
                 value="${this.suchbegriff}">
        </div>
        <div class="toolbar-item toolbar-right">
          <span class="text-muted small">${gefiltert.length} Einträge</span>
        </div>
      </div>

      <div style="overflow:auto; flex:1;">
        <table class="table table-hover table-striped mb-0" id="ehemaligeTabelle">
          <thead class="table-dark sticky-top">
            <tr>
              <th>Name</th>
              <th>Abteilung</th>
              <th>Eingetreten</th>
              <th>Ausgetreten</th>
              <th>Betriebszugehörigkeit</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="ehemaligenTabelleBody">
            ${this._renderZeilen(gefiltert)}
          </tbody>
        </table>
      </div>
    `;

    this._initEventListeners();
  }

  _filtere(liste) {
    if (!this.suchbegriff.trim()) return liste;
    const s = this.suchbegriff.toLowerCase();
    return liste.filter(ma =>
      `${ma.vorname} ${ma.nachname}`.toLowerCase().includes(s) ||
      (ma.abteilung_name || '').toLowerCase().includes(s)
    );
  }

  _renderZeilen(liste) {
    if (liste.length === 0) {
      return `
        <tr>
          <td colspan="6" class="text-center text-muted py-5">
            <i class="bi bi-inbox fs-1 d-block mb-2"></i>
            Keine ausgeschiedenen Mitarbeiter gefunden
          </td>
        </tr>`;
    }

    return liste.map(ma => {
      const eingetreten = formatDatumAnzeige(ma.eintrittsdatum);
      const ausgetreten = formatDatumAnzeige(ma.austrittsdatum);
      const zugehoerigkeit = this._berechneBetriebszugehoerigkeit(
        ma.eintrittsdatum, ma.austrittsdatum
      );

      return `
        <tr>
          <td class="fw-bold">
            ${ma.vorname} ${ma.nachname}
          </td>
          <td>
            <span class="abteilung-badge" style="background-color:${ma.abteilung_farbe || '#6c757d'}">
              ${ma.abteilung_name || '–'}
            </span>
          </td>
          <td>${eingetreten}</td>
          <td>
            <span class="badge bg-danger">${ausgetreten}</span>
          </td>
          <td class="text-muted small">${zugehoerigkeit}</td>
          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary btn-ehemalige-details"
                      data-id="${ma.id}" title="Details anzeigen">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-outline-secondary btn-ehemalige-reaktivieren"
                      data-id="${ma.id}" title="Wieder aktivieren">
                <i class="bi bi-arrow-counterclockwise"></i>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  _berechneBetriebszugehoerigkeit(eintrittsdatum, austrittsdatum) {
    if (!eintrittsdatum || !austrittsdatum) return '–';
    try {
      const [ej, em, et] = eintrittsdatum.split('-').map(Number);
      const [aj, am, at] = austrittsdatum.split('-').map(Number);
      const eintritt = new Date(ej, em - 1, et);
      const austritt = new Date(aj, am - 1, at);
      const diffMs   = austritt - eintritt;
      const diffJahr = diffMs / (1000 * 60 * 60 * 24 * 365.25);
      const jahre    = Math.floor(diffJahr);
      const monate   = Math.floor((diffJahr - jahre) * 12);
      if (jahre === 0) return `${monate} Monat(e)`;
      if (monate === 0) return `${jahre} Jahr(e)`;
      return `${jahre} Jahr(e), ${monate} Monat(e)`;
    } catch {
      return '–';
    }
  }

  _initEventListeners() {
    const suchfeld = document.getElementById('ehemaligenSuchfeld');
    if (suchfeld) {
      suchfeld.addEventListener('input', (e) => {
        this.suchbegriff = e.target.value;
        const tbody = document.getElementById('ehemaligenTabelleBody');
        const zaehler = this.container.querySelector('.text-muted.small');
        const gefiltert = this._filtere(this.mitarbeiterListe);
        if (tbody) tbody.innerHTML = this._renderZeilen(gefiltert);
        if (zaehler) zaehler.textContent = `${gefiltert.length} Einträge`;
      });
    }

    const tbody = document.getElementById('ehemaligenTabelleBody');
    if (!tbody) return;

    tbody.addEventListener('click', async (e) => {
      const detailsBtn     = e.target.closest('.btn-ehemalige-details');
      const reaktivierenBtn = e.target.closest('.btn-ehemalige-reaktivieren');

      if (detailsBtn) {
        const id = detailsBtn.dataset.id;
        await this.dialogManager.zeigeDetails(id, this.dataManager.aktuellesJahr, 'stammdaten');
        await this.ladeDaten();
        this.render();
      }

      if (reaktivierenBtn) {
        const id = reaktivierenBtn.dataset.id;
        const ma = this.mitarbeiterListe.find(m => m.id === id);
        if (!ma) return;

        if (!confirm(
          `Möchten Sie ${ma.vorname} ${ma.nachname} wieder aktivieren?\n` +
          `Das Austrittsdatum wird entfernt.`
        )) return;

        try {
          await this.dataManager.stammdatenAktualisieren(id, { austrittsdatum: null });
          showNotification('Erfolg',
            `${ma.vorname} ${ma.nachname} wurde wieder aktiviert`, 'success');
          await this.ladeDaten();
          this.render();
        } catch (err) {
          showNotification('Fehler', err.message, 'danger');
        }
      }
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EhemaligeTabelle;
}