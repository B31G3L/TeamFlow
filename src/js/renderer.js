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
async function initApp() {
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
    await initUI();

    // Initiale Daten laden
    await loadData();

    console.log('✅ Teamplanner erfolgreich gestartet');

    // Willkommens-Notification
    setTimeout(async () => {
      const info = await database.getDatabaseInfo();
      showNotification(
        'Teamplanner geladen',
        `Jahr: ${dataManager.aktuellesJahr} | Mitarbeiter: ${info.tables.mitarbeiter}`,
        'success'
      );
    }, 500);

  } catch (error) {
    console.error('❌ Fehler beim Starten:', error);
    showNotification('Fehler', `Fehler beim Starten: ${error.message}`, 'danger');
  }
}

/**
 * UI initialisieren (Event Listener, etc.)
 */
async function initUI() {
  // Jahr-Auswahl
  const jahrSelect = document.getElementById('jahrSelect');
  const verfuegbareJahre = await dataManager.getVerfuegbareJahre();

  verfuegbareJahre.forEach(jahr => {
    const option = document.createElement('option');
    option.value = jahr;
    option.textContent = jahr;
    if (jahr === dataManager.aktuellesJahr) {
      option.selected = true;
    }
    jahrSelect.appendChild(option);
  });

  jahrSelect.addEventListener('change', async (e) => {
    dataManager.aktuellesJahr = parseInt(e.target.value);
    dataManager.invalidateCache();
    await loadData();
    showNotification('Jahr gewechselt', `Aktuelles Jahr: ${dataManager.aktuellesJahr}`, 'info');
  });

  // Abteilungs-Filter
  await updateAbteilungFilter();

  const abteilungFilter = document.getElementById('abteilungFilter');
  abteilungFilter.addEventListener('change', async (e) => {
    const abteilung = e.target.value === 'Alle' ? null : e.target.value;
    const suchbegriff = document.getElementById('suchfeld').value;
    await tabelle.suchen(suchbegriff, abteilung);
  });

  // Suchfeld
  const suchfeld = document.getElementById('suchfeld');
  suchfeld.addEventListener('input', async (e) => {
    const abteilung = abteilungFilter.value === 'Alle' ? null : abteilungFilter.value;
    await tabelle.suchen(e.target.value, abteilung);
  });

  // Menü-Items
  document.getElementById('menuStammdatenHinzufuegen').addEventListener('click', (e) => {
    e.preventDefault();
    dialogManager.zeigeStammdatenHinzufuegen(async () => {
      await loadData();
    });
  });

  document.getElementById('menuStammdatenVerwalten').addEventListener('click', (e) => {
    e.preventDefault();
    dialogManager.zeigeStammdatenVerwalten(async () => {
      await loadData();
    });
  });

  document.getElementById('menuAbteilungenVerwalten').addEventListener('click', (e) => {
    e.preventDefault();
    dialogManager.zeigeAbteilungenVerwalten(async () => {
      await loadData();
      await updateAbteilungFilter();
    });
  });

  document.getElementById('menuFeiertageVerwalten').addEventListener('click', (e) => {
    e.preventDefault();
    dialogManager.zeigeFeiertagVerwalten(async () => {
      await loadData();
    });
  });

  document.getElementById('menuVeranstaltungenVerwalten').addEventListener('click', (e) => {
    e.preventDefault();
    dialogManager.zeigeVeranstaltungVerwalten(async () => {
      await loadData();
    });
  });

  document.getElementById('menuExportCSV').addEventListener('click', (e) => {
    e.preventDefault();
    exportToCSV();
  });

  document.getElementById('menuExportExcel').addEventListener('click', (e) => {
    e.preventDefault();
    showNotification('Info', 'Excel-Export ist noch nicht implementiert', 'info');
  });

  // Toolbar-Buttons
  document.getElementById('btnAktualisieren').addEventListener('click', async (e) => {
    e.preventDefault();
    await loadData();
    showNotification('Aktualisiert', 'Daten wurden neu geladen', 'success');
  });

  // Event Delegation für klickbare Tabellenzellen
  document.getElementById('mitarbeiterTabelleBody').addEventListener('click', (e) => {
    const clickable = e.target.closest('.clickable');
    if (!clickable) return;

    const mitarbeiterId = clickable.dataset.id;
    const action = clickable.dataset.action;
    if (!mitarbeiterId || !action) return;

    switch (action) {
      case 'details':
        zeigeDetails(mitarbeiterId);
        break;
      case 'bearbeiten':
        dialogManager.zeigeStammdatenBearbeiten(mitarbeiterId, async () => {
          await loadData();
        });
        break;
      case 'urlaub':
        dialogManager.zeigeUrlaubDialog(mitarbeiterId, async () => {
          await loadData();
        });
        break;
      case 'krank':
        dialogManager.zeigeKrankDialog(mitarbeiterId, async () => {
          await loadData();
        });
        break;
      case 'schulung':
        dialogManager.zeigeSchulungDialog(mitarbeiterId, async () => {
          await loadData();
        });
        break;
      case 'ueberstunden':
        dialogManager.zeigeUeberstundenDialog(mitarbeiterId, async () => {
          await loadData();
        });
        break;
    }
  });
}

/**
 * Aktualisiert den Abteilungs-Filter
 */
async function updateAbteilungFilter() {
  const abteilungFilter = document.getElementById('abteilungFilter');
  const currentValue = abteilungFilter.value;
  
  // Lösche alle Optionen außer "Alle"
  while (abteilungFilter.options.length > 1) {
    abteilungFilter.remove(1);
  }
  
  // Lade Abteilungen neu
  const abteilungen = await dataManager.getAlleAbteilungen();
  
  abteilungen.forEach(abt => {
    const option = document.createElement('option');
    option.value = abt.name;
    option.textContent = abt.name;
    abteilungFilter.appendChild(option);
  });
  
  // Versuche den vorherigen Wert wiederherzustellen
  if (currentValue && Array.from(abteilungFilter.options).some(o => o.value === currentValue)) {
    abteilungFilter.value = currentValue;
  }
}

/**
 * Daten laden und Tabelle aktualisieren
 */
async function loadData() {
  try {
    const abteilung = document.getElementById('abteilungFilter').value;
    const filter = abteilung === 'Alle' ? null : abteilung;

    await tabelle.aktualisieren(filter);
  } catch (error) {
    console.error('Fehler beim Laden:', error);
    showNotification('Fehler', `Daten konnten nicht geladen werden: ${error.message}`, 'danger');
  }
}

/**
 * Zeigt Details für einen Mitarbeiter
 */
async function zeigeDetails(mitarbeiterId) {
  const stat = await dataManager.getMitarbeiterStatistik(mitarbeiterId);
  if (!stat) {
    showNotification('Fehler', 'Mitarbeiter nicht gefunden', 'danger');
    return;
  }

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
                    <th>Name:</th>
                    <td>${ma.vorname} ${ma.nachname}</td>
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
                    <td>${stat.urlaubsanspruch.toFixed(1)} Tage ${stat.urlaubsanspruch < ma.urlaubstage_jahr ? '<small class="text-muted">(anteilig)</small>' : ''}</td>
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
    const stats = await dataManager.getAlleStatistiken();

    if (stats.length === 0) {
      showNotification('Info', 'Keine Daten zum Exportieren vorhanden', 'warning');
      return;
    }

    // CSV Header
    let csv = 'Vorname;Nachname;Abteilung;Anspruch;Übertrag;Verfügbar;Genommen;Rest;Krank;Schulung;Überstunden\n';

    // Daten
    stats.forEach(stat => {
      const ma = stat.mitarbeiter;
      csv += `${ma.vorname};${ma.nachname};${ma.abteilung_name};`;
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
        showNotification('Export erfolgreich', `Daten wurden exportiert`, 'success');
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