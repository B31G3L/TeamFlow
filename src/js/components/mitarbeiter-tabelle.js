/**
 * Mitarbeiter-Tabelle Komponente
 * Rendert die Mitarbeiter-Übersicht
 */

class MitarbeiterTabelle {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.tbody = document.getElementById('mitarbeiterTabelleBody');
    this.aktuelleStatistiken = [];
  }

  /**
   * Aktualisiert die Tabelle
   */
  async aktualisieren(abteilung = null) {
    this.aktuelleStatistiken = await this.dataManager.getAlleStatistiken(abteilung);
    this.render();
  }

  /**
   * Rendert die Tabelle
   */
  render() {
    if (!this.tbody) return;

    this.tbody.innerHTML = '';

    if (this.aktuelleStatistiken.length === 0) {
      this.tbody.innerHTML = `
        <tr>
          <td colspan="12" class="text-center text-muted py-5">
            <i class="bi bi-inbox fs-1 d-block mb-2"></i>
            Keine Mitarbeiter gefunden
          </td>
        </tr>
      `;
      return;
    }

    this.aktuelleStatistiken.forEach((stat, index) => {
      const row = this.createRow(stat, index + 1);
      this.tbody.appendChild(row);
    });
  }

  /**
   * Erstellt eine Tabellenzeile
   */
  createRow(stat, nr) {
    const tr = document.createElement('tr');
    tr.className = 'fade-in';

    // Abteilungsfarbe
    const abteilungFarbe = stat.mitarbeiter.abteilung_farbe || '#1f538d';

    // Rest-Klasse basierend auf Wert
    let restClass = 'number-neutral';
    if (stat.urlaub_rest < 0) {
      restClass = 'number-negative';
    } else if (stat.urlaub_rest > 10) {
      restClass = 'number-positive';
    } else if (stat.urlaub_rest <= 5) {
      restClass = 'number-warning';
    }

    tr.innerHTML = `
      <td class="text-muted">${nr}</td>
      <td class="clickable clickable-name fw-bold" data-id="${stat.mitarbeiter.id}" data-action="details">
        ${stat.mitarbeiter.vorname} ${stat.mitarbeiter.nachname}
      </td>
      <td>
        <span class="abteilung-badge" style="background-color: ${abteilungFarbe}">
          ${stat.mitarbeiter.abteilung_name || 'Unbekannt'}
        </span>
      </td>
      <td class="clickable" data-id="${stat.mitarbeiter.id}" data-action="bearbeiten">${stat.urlaubsanspruch.toFixed(1)}</td>
      <td class="text-info">${stat.uebertrag_vorjahr.toFixed(1)}</td>
      <td class="fw-bold">${stat.urlaub_verfuegbar.toFixed(1)}</td>
      <td class="clickable text-success" data-id="${stat.mitarbeiter.id}" data-action="urlaub">${stat.urlaub_genommen.toFixed(1)}</td>
      <td class="${restClass}">${stat.urlaub_rest.toFixed(1)}</td>
      <td class="clickable text-danger" data-id="${stat.mitarbeiter.id}" data-action="krank">${stat.krankheitstage.toFixed(1)}</td>
      <td class="clickable text-info" data-id="${stat.mitarbeiter.id}" data-action="schulung">${stat.schulungstage.toFixed(1)}</td>
      <td class="clickable text-warning" data-id="${stat.mitarbeiter.id}" data-action="ueberstunden">${stat.ueberstunden.toFixed(1)}</td>
    `;

    return tr;
  }

  /**
   * Sucht Mitarbeiter
   */
  async suchen(suchbegriff, abteilung = null) {
    let stats = await this.dataManager.getAlleStatistiken(abteilung);

    if (suchbegriff && suchbegriff.trim() !== '') {
      const begriff = suchbegriff.toLowerCase();
      stats = stats.filter(stat => {
        const name = `${stat.mitarbeiter.vorname} ${stat.mitarbeiter.nachname}`.toLowerCase();
        const abt = (stat.mitarbeiter.abteilung_name || '').toLowerCase();

        return name.includes(begriff) || abt.includes(begriff);
      });
    }

    this.aktuelleStatistiken = stats;
    this.render();
  }
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MitarbeiterTabelle;
}