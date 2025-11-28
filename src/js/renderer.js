/**
 * Teamplanner - Renderer Process
 * Orchestriert die gesamte App
 */

// Globale Variablen
let database;
let dataManager;
let tabelle;
let dialogManager;

/**
 * App initialisieren
 */
function initApp() {
  console.log('🚀 Teamplanner wird gestartet...');

  try {
    // Datenbank initialisieren
    database = new TeamplannerDatabase();
    console.log('✅ Datenbank initialisiert');

    // DataManager initialisieren
    dataManager = new TeamplannerDataManager(database);
    console.log('✅ DataManager initialisiert');

    // Tabelle initialisieren
    tabelle = new MitarbeiterTabelle(dataManager);
    console.log('✅ Tabelle initialisiert');

    // Dialog Manager initialisieren
    dialogManager = new DialogManager(dataManager);
    console.log('✅ Dialog Manager initialisiert');

    // UI initialisieren
    initUI();

    // Initiale Daten laden
    loadData();

    console.log('✅ Teamplanner erfolgreich gestartet');

    // Willkommens-Notification
    setTimeout(() => {
      const info = database.getDatabaseInfo();
      showNotification(
        'Teamplanner geladen',
        `Jahr: ${dataManager.aktuellesJahr} | Mitarbeiter: ${info.tables.mitarbeiter}`,
        'success'
      );
    }, 500);

  } catch (error) {
    console.error('❌ Fehler beim Starten:', error);
    alert(`Fehler beim Starten: ${error.message}`);
  }
}

/**
 * UI initialisieren (Event Listener, etc.)
 */
function initUI() {
  // Jahr-Auswahl
  const jahrSelect = document.getElementById('jahrSelect');
  const verfuegbareJahre = dataManager.getVerfuegbareJahre();

  verfuegbareJahre.forEach(jahr => {
    const option = document.createElement('option');
    option.value = jahr;
    option.textContent = jahr;
    if (jahr === dataManager.aktuellesJahr) {
      option.selected = true;
    }
    jahrSelect.appendChild(option);
  });

  jahrSelect.addEventListener('change', (e) => {
    dataManager.aktuellesJahr = parseInt(e.target.value);
    dataManager.invalidateCache();
    loadData();
    showNotification('Jahr gewechselt', `Aktuelles Jahr: ${dataManager.aktuellesJahr}`, 'info');
  });

  // Abteilungs-Filter
  const abteilungFilter = document.getElementById('abteilungFilter');
  const abteilungen = dataManager.getAlleAbteilungen();

  abteilungen.forEach(abt => {
    const option = document.createElement('option');
    option.value = abt.name;
    option.textContent = abt.name;
    abteilungFilter.appendChild(option);
  });

  abteilungFilter.addEventListener('change', (e) => {
    const abteilung = e.target.value === 'Alle' ? null : e.target.value;
    const suchbegriff = document.getElementById('suchfeld').value;
    tabelle.suchen(suchbegriff, abteilung);
  });

  // Suchfeld
  const suchfeld = document.getElementById('suchfeld');
  suchfeld.addEventListener('input', (e) => {
    const abteilung = abteilungFilter.value === 'Alle' ? null : abteilungFilter.value;
    tabelle.suchen(e.target.value, abteilung);
  });

  // Menü-Items
  document.getElementById('menuStammdatenHinzufuegen').addEventListener('click', (e) => {
    e.preventDefault();
    dialogManager.zeigeStammdatenHinzufuegen(() => {
      loadData();
    });
  });

  document.getElementById('menuStammdatenVerwalten').addEventListener('click', (e) => {
    e.preventDefault();
    dialogManager.zeigeStammdatenVerwalten(() => {
      loadData();
    });
  });

  document.getElementById('menuAbteilungenVerwalten').addEventListener('click', (e) => {
    e.preventDefault();
    showNotification('Info', 'Diese Funktion ist noch nicht implementiert', 'info');
  });

  document.getElementById('menuVeranstaltungenVerwalten').addEventListener('click', (e) => {
    e.preventDefault();
    showNotification('Info', 'Diese Funktion ist noch nicht implementiert', 'info');
  });

  document.getElementById('menuFeiertageVerwalten').addEventListener('click', (e) => {
    e.preventDefault();
    showNotification('Info', 'Diese Funktion ist noch nicht implementiert', 'info');
  });

  document.getElementById('menuExportCSV').addEventListener('click', (e) => {
    e.preventDefault();
    exportToCSV();
  });

  document.getElementById('menuExportExcel').addEventListener('click', (e) => {
    e.preventDefault();
    showNotification('Info', 'Excel-Export ist noch nicht implementiert', 'info');
  });

  // Event Delegation für Tabellen-Buttons
  document.getElementById('mitarbeiterTabelleBody').addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const mitarbeiterId = button.dataset.id;
    if (!mitarbeiterId) return;

    if (button.classList.contains('btn-details')) {
      zeigeDetails(mitarbeiterId);
    } else if (button.classList.contains('btn-bearbeiten')) {
      dialogManager.zeigeStammdatenBearbeiten(mitarbeiterId, () => {
        loadData();
      });
    } else if (button.classList.contains('btn-urlaub')) {
      dialogManager.zeigeUrlaubDialog(mitarbeiterId, () => {
        loadData();
      });
    } else if (button.classList.contains('btn-krank')) {
      dialogManager.zeigeKrankDialog(mitarbeiterId, () => {
        loadData();
      });
    } else if (button.classList.contains('btn-schulung')) {
      dialogManager.zeigeSchulungDialog(mitarbeiterId, () => {
        loadData();
      });
    } else if (button.classList.contains('btn-ueberstunden')) {
      dialogManager.zeigeUeberstundenDialog(mitarbeiterId, () => {
        loadData();
      });
    }
  });
}

/**
 * Daten laden und Tabelle aktualisieren
 */
function loadData() {
  const abteilung = document.getElementById('abteilungFilter').value;
  const filter = abteilung === 'Alle' ? null : abteilung;

  tabelle.aktualisieren(filter);
}

/**
 * Zeigt Details für einen Mitarbeiter
 */
function zeigeDetails(mitarbeiterId) {
  const stat = dataManager.getMitarbeiterStatistik(mitarbeiterId);
  if (!stat) return;

  const ma = stat.mitarbeiter;

  const modalHtml = `
    <div class="modal fade" id="detailsModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-person-badge"></i> Mitarbeiter-Details
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="row">
              <div class="col-md-6">
                <h6 class="text-muted mb-3">Stammdaten</h6>
                <table class="table table-sm">
                  <tr>
                    <th>ID:</th>
                    <td><code>${ma.id}</code></td>
                  </tr>
                  <tr>
                    <th>Name:</th>
                    <td>${ma.vorname} ${ma.nachname}</td>
                  </tr>
                  <tr>
                    <th>E-Mail:</th>
                    <td>${ma.email || '-'}</td>
                  </tr>
                  <tr>
                    <th>Abteilung:</th>
                    <td>
                      <span class="abteilung-badge" style="background-color: ${ma.abteilung_farbe}">
                        ${ma.abteilung_name}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <th>Geburtsdatum:</th>
                    <td>${ma.geburtsdatum ? new Date(ma.geburtsdatum).toLocaleDateString('de-DE') : '-'}</td>
                  </tr>
                  <tr>
                    <th>Eintrittsdatum:</th>
                    <td>${new Date(ma.eintrittsdatum).toLocaleDateString('de-DE')}</td>
                  </tr>
                </table>
              </div>

              <div class="col-md-6">
                <h6 class="text-muted mb-3">Statistik ${dataManager.aktuellesJahr}</h6>
                <table class="table table-sm">
                  <tr>
                    <th>Anspruch:</th>
                    <td>${ma.urlaubstage_jahr} Tage</td>
                  </tr>
                  <tr>
                    <th>Übertrag:</th>
                    <td class="text-info">${stat.uebertrag_vorjahr.toFixed(1)} Tage</td>
                  </tr>
                  <tr>
                    <th>Verfügbar:</th>
                    <td class="fw-bold">${stat.urlaub_verfuegbar.toFixed(1)} Tage</td>
                  </tr>
                  <tr>
                    <th>Genommen:</th>
                    <td class="text-warning">${stat.urlaub_genommen.toFixed(1)} Tage</td>
                  </tr>
                  <tr>
                    <th>Rest:</th>
                    <td class="${stat.urlaub_rest < 0 ? 'text-danger' : 'text-success'} fw-bold">
                      ${stat.urlaub_rest.toFixed(1)} Tage
                    </td>
                  </tr>
                  <tr>
                    <th>Krankheitstage:</th>
                    <td class="text-danger">${stat.krankheitstage.toFixed(1)} Tage</td>
                  </tr>
                  <tr>
                    <th>Schulungstage:</th>
                    <td class="text-info">${stat.schulungstage.toFixed(1)} Tage</td>
                  </tr>
                  <tr>
                    <th>Überstunden:</th>
                    <td class="text-warning">${stat.ueberstunden.toFixed(1)} Std.</td>
                  </tr>
                </table>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Schließen</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const oldModals = document.querySelectorAll('.modal');
  oldModals.forEach(m => m.remove());

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalElement = document.querySelector('#detailsModal');
  const modal = new bootstrap.Modal(modalElement);
  modal.show();

  modalElement.addEventListener('hidden.bs.modal', () => {
    modalElement.remove();
  });
}

/**
 * Exportiert Daten als CSV
 */
async function exportToCSV() {
  try {
    const stats = dataManager.getAlleStatistiken();

    // CSV Header
    let csv = 'Mitarbeiter-ID;Vorname;Nachname;Abteilung;Anspruch;Übertrag;Verfügbar;Genommen;Rest;Krank;Schulung;Überstunden\n';

    // Daten
    stats.forEach(stat => {
      const ma = stat.mitarbeiter;
      csv += `${ma.id};${ma.vorname};${ma.nachname};${ma.abteilung_name};`;
      csv += `${ma.urlaubstage_jahr};${stat.uebertrag_vorjahr.toFixed(1)};${stat.urlaub_verfuegbar.toFixed(1)};`;
      csv += `${stat.urlaub_genommen.toFixed(1)};${stat.urlaub_rest.toFixed(1)};${stat.krankheitstage.toFixed(1)};`;
      csv += `${stat.schulungstage.toFixed(1)};${stat.ueberstunden.toFixed(1)}\n`;
    });

    // Datei speichern (Electron API)
    if (window.electronAPI) {
      const result = await window.electronAPI.saveFile({
        title: 'CSV Exportieren',
        defaultPath: `teamplanner_export_${dataManager.aktuellesJahr}.csv`,
        filters: [
          { name: 'CSV Dateien', extensions: ['csv'] },
          { name: 'Alle Dateien', extensions: ['*'] }
        ]
      });

      if (!result.canceled && result.filePath) {
        await window.electronAPI.writeFile(result.filePath, csv);
        showNotification('Export erfolgreich', `Daten wurden exportiert nach:\n${result.filePath}`, 'success');
      }
    } else {
      // Fallback für Browser (Download)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `teamplanner_export_${dataManager.aktuellesJahr}.csv`;
      link.click();
      showNotification('Export erfolgreich', 'CSV wurde heruntergeladen', 'success');
    }

  } catch (error) {
    console.error('Fehler beim Export:', error);
    showNotification('Export fehlgeschlagen', error.message, 'danger');
  }
}

/**
 * App starten wenn DOM geladen
 */
document.addEventListener('DOMContentLoaded', initApp);
