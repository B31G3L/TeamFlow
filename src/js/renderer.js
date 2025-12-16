/**
 * Teamplanner - Renderer Process
 * Orchestriert die gesamte App
 * 
 * FIX: CSV-Export mit BOM für Excel-Kompatibilität
 * FIX: Memory Leak bei Blob-URL behoben
 * FIX: Haupttabelle wird nach Detail-Dialog-Änderungen aktualisiert
 * NEU: Übertrag-Anpassung hinzugefügt
 * NEU: Log-Viewer und App-Info Menü implementiert
 */

// Globale Variablen
let database;
let dataManager;
let tabelle;
let dialogManager;
let kalenderAnsicht;
let aktuelleAnsicht = 'tabelle'; // 'tabelle' oder 'kalender'

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

    // Kalender-Ansicht initialisieren
    kalenderAnsicht = new KalenderAnsicht(dataManager);
    console.log('✅ Kalender-Ansicht initialisiert');

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
 * Wechselt zwischen Tabellen- und Kalenderansicht
 */
async function toggleAnsicht() {
  const tabellenAnsicht = document.getElementById('tabellenAnsicht');
  const kalenderAnsichtDiv = document.getElementById('kalenderAnsicht');
  const toggleBtn = document.getElementById('btnAnsichtToggle');
  const toggleIcon = document.getElementById('ansichtToggleIcon');
  const toggleText = document.getElementById('ansichtToggleText');

  if (aktuelleAnsicht === 'tabelle') {
    // Wechsle zu Kalender
    aktuelleAnsicht = 'kalender';
    
    tabellenAnsicht.classList.add('d-none');
    kalenderAnsichtDiv.classList.remove('d-none');
    
    // Button anpassen
    toggleIcon.className = 'bi bi-table';
    toggleText.textContent = 'Tabelle';
    toggleBtn.title = 'Zur Tabellenansicht';
    
    // Kalender-Jahr synchronisieren und anzeigen
    kalenderAnsicht.currentYear = dataManager.aktuellesJahr;
    await kalenderAnsicht.zeigen();
    
  } else {
    // Wechsle zu Tabelle
    aktuelleAnsicht = 'tabelle';
    
    kalenderAnsichtDiv.classList.add('d-none');
    tabellenAnsicht.classList.remove('d-none');
    
    // Button anpassen
    toggleIcon.className = 'bi bi-calendar3';
    toggleText.textContent = 'Kalender';
    toggleBtn.title = 'Zur Kalenderansicht';
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
    
    // Wenn Kalender aktiv ist, auch dort aktualisieren
    if (aktuelleAnsicht === 'kalender') {
      kalenderAnsicht.currentYear = dataManager.aktuellesJahr;
      await kalenderAnsicht.zeigen();
    }
    
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

  // Kalender-Menü - jetzt Toggle statt Modal
  document.getElementById('menuKalender').addEventListener('click', async (e) => {
    e.preventDefault();
    if (aktuelleAnsicht !== 'kalender') {
      await toggleAnsicht();
    }
  });

  // Ansicht-Toggle Button in Toolbar
  document.getElementById('btnAnsichtToggle').addEventListener('click', async (e) => {
    e.preventDefault();
    await toggleAnsicht();
  });

  // Log-Viewer Menü (NEU)
  document.getElementById('menuLogs').addEventListener('click', async (e) => {
    e.preventDefault();
    const logViewer = new LogViewer();
    await logViewer.zeigen();
  });

  // App-Info Menü (NEU)
  document.getElementById('menuInfo').addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const version = await window.electronAPI.getAppVersion();
      const dbPath = await window.electronAPI.getDatabasePath();
      const info = await database.getDatabaseInfo();
      
      const infoText = `Teamplanner Version: ${version}
Datenbank: ${dbPath}

Statistik:
- Mitarbeiter: ${info.tables.mitarbeiter}
- Abteilungen: ${info.tables.abteilungen}
- Urlaub: ${info.tables.urlaub}
- Krankheit: ${info.tables.krankheit}
- Schulung: ${info.tables.schulung}
- Überstunden: ${info.tables.ueberstunden}
- Feiertage: ${info.tables.feiertage}
- Veranstaltungen: ${info.tables.veranstaltungen}`;
      
      alert(infoText);
    } catch (error) {
      console.error('Fehler beim Laden der App-Info:', error);
      showNotification('Fehler', 'App-Info konnte nicht geladen werden', 'danger');
    }
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
    
    // Wenn Kalender aktiv ist, auch dort aktualisieren
    if (aktuelleAnsicht === 'kalender') {
      await kalenderAnsicht.zeigen();
    }
    
    showNotification('Aktualisiert', 'Daten wurden neu geladen', 'success');
  });

  // Event Delegation für klickbare Tabellenzellen
  document.getElementById('mitarbeiterTabelleBody').addEventListener('click', async (e) => {
    const clickable = e.target.closest('.clickable');
    if (!clickable) return;

    const mitarbeiterId = clickable.dataset.id;
    const action = clickable.dataset.action;
    if (!mitarbeiterId || !action) return;

    switch (action) {
      case 'details':
        // Zeige Detail-Dialog und warte auf Schließen
        await dialogManager.zeigeDetails(mitarbeiterId, dataManager.aktuellesJahr);
        // Detail-Dialog wurde geschlossen, lade Daten neu
        console.log('🔄 Detail-Dialog geschlossen - aktualisiere Haupttabelle');
        await loadData();
        if (aktuelleAnsicht === 'kalender') {
          await kalenderAnsicht.zeigen();
        }
        break;
      case 'bearbeiten':
        dialogManager.zeigeStammdatenBearbeiten(mitarbeiterId, async () => {
          await loadData();
        });
        break;
      case 'urlaub':
        dialogManager.zeigeUrlaubDialog(mitarbeiterId, async () => {
          await loadData();
          if (aktuelleAnsicht === 'kalender') {
            await kalenderAnsicht.zeigen();
          }
        });
        break;
      case 'krank':
        dialogManager.zeigeKrankDialog(mitarbeiterId, async () => {
          await loadData();
          if (aktuelleAnsicht === 'kalender') {
            await kalenderAnsicht.zeigen();
          }
        });
        break;
      case 'schulung':
        dialogManager.zeigeSchulungDialog(mitarbeiterId, async () => {
          await loadData();
          if (aktuelleAnsicht === 'kalender') {
            await kalenderAnsicht.zeigen();
          }
        });
        break;
      case 'ueberstunden':
        dialogManager.zeigeUeberstundenDialog(mitarbeiterId, async () => {
          await loadData();
        });
        break;
      case 'uebertrag':
        dialogManager.zeigeUebertragAnpassen(mitarbeiterId, async () => {
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
 * Exportiert Daten als CSV
 * FIX: BOM hinzugefügt für korrekte Umlaut-Darstellung in Excel
 * FIX: Memory Leak bei Blob-URL behoben
 */
async function exportToCSV() {
  try {
    const stats = await dataManager.getAlleStatistiken();

    if (stats.length === 0) {
      showNotification('Info', 'Keine Daten zum Exportieren vorhanden', 'warning');
      return;
    }

    // FIX: BOM (Byte Order Mark) für UTF-8 mit Excel-Kompatibilität
    const BOM = '\uFEFF';
    
    // CSV Header
    let csv = BOM + 'Vorname;Nachname;Abteilung;Anspruch;Übertrag;Verfügbar;Genommen;Rest;Krank;Schulung;Überstunden\n';

    // Hilfsfunktion: Escape Semikolons in Feldern
    const escapeField = (field) => {
      if (field && field.toString().includes(';')) {
        return `"${field}"`;
      }
      return field;
    };

    // Daten
    stats.forEach(stat => {
      const ma = stat.mitarbeiter;
      csv += `${escapeField(ma.vorname)};${escapeField(ma.nachname)};${escapeField(ma.abteilung_name)};`;
      csv += `${ma.urlaubstage_jahr};${stat.uebertrag_vorjahr.toFixed(1)};${stat.urlaub_verfuegbar.toFixed(1)};`;
      csv += `${stat.urlaub_genommen.toFixed(1)};${stat.urlaub_rest.toFixed(1)};${stat.krankheitstage.toFixed(1)};`;
      csv += `${stat.schulungstage.toFixed(1)};${stat.ueberstunden.toFixed(1)}\n`;
    });

    // Datei speichern (Electron API)
    if (window.electronAPI) {
      const result = await window.electronAPI.showSaveDialog({
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
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `teamplanner_export_${dataManager.aktuellesJahr}.csv`;
      link.click();
      // FIX: URL wieder freigeben um Memory Leak zu verhindern
      setTimeout(() => URL.revokeObjectURL(url), 100);
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