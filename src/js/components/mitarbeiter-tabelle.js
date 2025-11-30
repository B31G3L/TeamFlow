/**
 * Mitarbeiter-Tabelle Komponente
 * Rendert die Mitarbeiter-Übersicht gruppiert nach Abteilungen
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
   * Rendert die Tabelle gruppiert nach Abteilungen
   */
  render() {
    if (!this.tbody) return;

    this.tbody.innerHTML = '';

    if (this.aktuelleStatistiken.length === 0) {
      this.tbody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center text-muted py-5">
            <i class="bi bi-inbox fs-1 d-block mb-2"></i>
            Keine Mitarbeiter gefunden
          </td>
        </tr>
      `;
      return;
    }

    // Gruppiere Mitarbeiter nach Abteilung
    const gruppiert = this.gruppiereNachAbteilung(this.aktuelleStatistiken);

    // Rendere jede Abteilungs-Gruppe
    let gesamtNr = 1;
    gruppiert.forEach((gruppe, index) => {
      // Abteilungs-Header
      const headerRow = this.createAbteilungHeader(gruppe.abteilung, gruppe.stats.length);
      this.tbody.appendChild(headerRow);

      // Mitarbeiter in dieser Abteilung
      gruppe.stats.forEach((stat) => {
        const row = this.createRow(stat, gesamtNr);
        this.tbody.appendChild(row);
        gesamtNr++;
      });
    });
  }

  /**
   * Gruppiert Statistiken nach Abteilung
   */
  gruppiereNachAbteilung(stats) {
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

    // Konvertiere Map zu Array und sortiere nach Abteilungsname
    return Array.from(gruppen.values()).sort((a, b) => 
      a.abteilung.name.localeCompare(b.abteilung.name)
    );
  }

  /**
   * Erstellt Abteilungs-Header Zeile
   */
  createAbteilungHeader(abteilung, mitarbeiterAnzahl) {
    const tr = document.createElement('tr');
    tr.className = 'abteilung-header';
    tr.style.backgroundColor = abteilung.farbe;

    tr.innerHTML = `
      <td colspan="10" class="fw-bold text-white py-2">
        <div class="d-flex align-items-center">
          <i class="bi bi-building me-2"></i>
          <span>${abteilung.name}</span>
          <span class="ms-2 opacity-75">(${mitarbeiterAnzahl} Mitarbeiter)</span>
        </div>
      </td>
    `;

    return tr;
  }

  /**
   * Erstellt eine Tabellenzeile
   */
  createRow(stat, nr) {
    const tr = document.createElement('tr');
    tr.className = 'fade-in';

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
      <td class="text-info">${stat.uebertrag_vorjahr.toFixed(1)}</td>
      <td class="fw-bold">${stat.urlaub_verfuegbar.toFixed(1)}</td>
      <td class="clickable text-success" data-id="${stat.mitarbeiter.id}" data-action="urlaub">${stat.urlaub_genommen.toFixed(1)}</td>
      <td class="${restClass}">${stat.urlaub_rest.toFixed(1)}</td>
      <td class="clickable text-danger" data-id="${stat.mitarbeiter.id}" data-action="krank">${stat.krankheitstage.toFixed(1)}</td>
      <td class="clickable text-info" data-id="${stat.mitarbeiter.id}" data-action="schulung">${stat.schulungstage.toFixed(1)}</td>
      <td class="clickable text-warning" data-id="${stat.mitarbeiter.id}" data-action="ueberstunden">${stat.ueberstunden.toFixed(1)}</td>
      <td class="clickable" data-id="${stat.mitarbeiter.id}" data-action="bearbeiten">
        <button class="btn btn-sm btn-outline-primary" title="Bearbeiten">
          <i class="bi bi-pencil"></i>
        </button>
      </td>
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