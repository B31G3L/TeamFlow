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
  aktualisieren(abteilung = null) {
    this.aktuelleStatistiken = this.dataManager.getAlleStatistiken(abteilung);
    this.render();
    this.updateStatistiken();
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
          <td colspan="13" class="text-center text-muted py-5">
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
      <td><code>${stat.mitarbeiter.id}</code></td>
      <td class="fw-bold">${stat.mitarbeiter.vorname} ${stat.mitarbeiter.nachname}</td>
      <td>
        <span class="abteilung-badge" style="background-color: ${abteilungFarbe}">
          ${stat.mitarbeiter.abteilung_name || 'Unbekannt'}
        </span>
      </td>
      <td>${stat.mitarbeiter.urlaubstage_jahr}</td>
      <td class="text-info">${stat.uebertrag_vorjahr.toFixed(1)}</td>
      <td class="fw-bold">${stat.urlaub_verfuegbar.toFixed(1)}</td>
      <td class="text-warning">${stat.urlaub_genommen.toFixed(1)}</td>
      <td class="${restClass}">${stat.urlaub_rest.toFixed(1)}</td>
      <td class="text-danger">${stat.krankheitstage.toFixed(1)}</td>
      <td class="text-info">${stat.schulungstage.toFixed(1)}</td>
      <td class="text-warning">${stat.ueberstunden.toFixed(1)}</td>
      <td>
        <div class="btn-group btn-group-sm" role="group">
          <button class="btn btn-outline-primary btn-details" data-id="${stat.mitarbeiter.id}" title="Details">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-outline-success btn-urlaub" data-id="${stat.mitarbeiter.id}" title="Urlaub">
            <i class="bi bi-calendar-plus"></i>
          </button>
          <button class="btn btn-outline-danger btn-krank" data-id="${stat.mitarbeiter.id}" title="Krankheit">
            <i class="bi bi-bandaid"></i>
          </button>
          <button class="btn btn-outline-info btn-schulung" data-id="${stat.mitarbeiter.id}" title="Schulung">
            <i class="bi bi-book"></i>
          </button>
          <button class="btn btn-outline-warning btn-ueberstunden" data-id="${stat.mitarbeiter.id}" title="Überstunden">
            <i class="bi bi-clock"></i>
          </button>
        </div>
      </td>
    `;

    return tr;
  }

  /**
   * Aktualisiert die Statistik-Footer
   */
  updateStatistiken() {
    const stats = this.aktuelleStatistiken;

    // Anzahl Mitarbeiter
    document.getElementById('statMitarbeiter').textContent = stats.length;

    // Gesamt Urlaub
    const gesamtUrlaub = stats.reduce((sum, s) => sum + s.urlaub_genommen, 0);
    document.getElementById('statUrlaub').textContent = `${gesamtUrlaub.toFixed(1)} Tage`;

    // Gesamt Krank
    const gesamtKrank = stats.reduce((sum, s) => sum + s.krankheitstage, 0);
    document.getElementById('statKrank').textContent = `${gesamtKrank.toFixed(1)} Tage`;

    // Gesamt Schulung
    const gesamtSchulung = stats.reduce((sum, s) => sum + s.schulungstage, 0);
    document.getElementById('statSchulung').textContent = `${gesamtSchulung.toFixed(1)} Tage`;

    // Gesamt Überstunden
    const gesamtUeberstunden = stats.reduce((sum, s) => sum + s.ueberstunden, 0);
    document.getElementById('statUeberstunden').textContent = `${gesamtUeberstunden.toFixed(1)} Std.`;
  }

  /**
   * Sucht Mitarbeiter
   */
  suchen(suchbegriff, abteilung = null) {
    let stats = this.dataManager.getAlleStatistiken(abteilung);

    if (suchbegriff && suchbegriff.trim() !== '') {
      const begriff = suchbegriff.toLowerCase();
      stats = stats.filter(stat => {
        const name = `${stat.mitarbeiter.vorname} ${stat.mitarbeiter.nachname}`.toLowerCase();
        const id = stat.mitarbeiter.id.toLowerCase();
        const abt = (stat.mitarbeiter.abteilung_name || '').toLowerCase();

        return name.includes(begriff) || id.includes(begriff) || abt.includes(begriff);
      });
    }

    this.aktuelleStatistiken = stats;
    this.render();
    this.updateStatistiken();
  }
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MitarbeiterTabelle;
}
