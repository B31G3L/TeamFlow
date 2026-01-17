/**
 * Teamplanner - Renderer Process
 * Orchestriert die gesamte App
 * 
 * NEU: Zweistufige Navigation - Stammdaten & Urlaubsplaner
 * UPDATE: Excel und PDF Export statt CSV
 * UPDATE: Tabellen-Button in Subnavigation
 */

// Globale Variablen
let database;
let dataManager;
let tabelle;
let dialogManager;
let kalenderAnsicht;
let stammdatenAnsicht;
let aktuelleAnsicht = 'tabelle'; // 'tabelle' oder 'kalender'
let aktuellesHauptmenu = 'urlaubsplaner'; // 'stammdaten' oder 'urlaubsplaner'

/**
 * Subnavigation-Konfiguration
 */
const SUBNAV_CONFIG = {
  stammdaten: [
    {
      id: 'subMitarbeiterAnlegen',
      icon: 'bi-plus-circle',
      text: 'Mitarbeiter anlegen',
      action: () => dialogManager.zeigeStammdatenHinzufuegen(async () => {
        if (aktuellesHauptmenu === 'stammdaten') {
          await stammdatenAnsicht.zeigen();
        } else {
          await loadData();
        }
      })
    },
    { separator: true },  // ← NEU: Separator hinzugefügt
    {
      id: 'subAbteilungen',
      icon: 'bi-building',
      text: 'Abteilungen',
      action: () => dialogManager.zeigeAbteilungenVerwalten(async () => {
        if (aktuellesHauptmenu === 'stammdaten') {
          await stammdatenAnsicht.zeigen();
        } else {
          await loadData();
          await updateAbteilungFilter();
        }
      })
    }
  ],
  
  urlaubsplaner: [
    {
      id: 'subTabelle',
      icon: 'bi-table',
      text: 'Tabelle',
      action: async () => {
        if (aktuelleAnsicht !== 'tabelle') {
          await toggleAnsicht();
        }
      }
    },
    {
      id: 'subKalender',
      icon: 'bi-calendar3',
      text: 'Kalender',
      action: async () => {
        if (aktuelleAnsicht !== 'kalender') {
          await toggleAnsicht();
        }
      }
    },
    { separator: true }, // Separator nach Ansichten
    {
      id: 'subFeiertage',
      icon: 'bi-calendar-event',
      text: 'Feiertage',
      action: () => dialogManager.zeigeFeiertagVerwalten(async () => await loadData())
    },
    {
      id: 'subVeranstaltungen',
      icon: 'bi-calendar-check',
      text: 'Veranstaltungen',
      action: () => dialogManager.zeigeVeranstaltungVerwalten(async () => await loadData())
    },
    { separator: true }, // Separator nach Verwaltung
    {
      id: 'subExportExcel',
      icon: 'bi-file-earmark-excel',
      text: 'Excel Export',
      action: () => exportToExcel()
    },
    {
      id: 'subExportPDF',
      icon: 'bi-file-earmark-pdf',
      text: 'PDF Export',
      action: () => exportToPdf()
    }
  ]
};

/**
 * Aktualisiert die Subnavigation basierend auf dem aktiven Hauptmenü
 */
function updateSubnavigation(hauptmenu) {
  const subnavContent = document.getElementById('subnavContent');
  const subnavContainer = document.getElementById('subnavigation');
  
  if (!subnavContent || !subnavContainer) return;
  
  // Leere Subnavigation
  subnavContent.innerHTML = '';
  
  // Hole Submenü-Items
  const items = SUBNAV_CONFIG[hauptmenu] || [];
  
  if (items.length === 0) {
    subnavContainer.classList.add('d-none');
    return;
  }
  
  // Zeige Subnavigation
  subnavContainer.classList.remove('d-none');
  
  // Erstelle Submenü-Items
  items.forEach((item, index) => {
    // Separator
    if (item.separator) {
      const separator = document.createElement('li');
      separator.className = 'nav-separator';
      separator.innerHTML = '<span class="separator-line"></span>';
      subnavContent.appendChild(separator);
      return;
    }
    
    // Normales Nav-Item
    const li = document.createElement('li');
    li.className = 'nav-item';
    
    const a = document.createElement('a');
    a.className = 'nav-link';
    a.href = '#';
    a.id = item.id;
    a.innerHTML = `<i class="bi ${item.icon}"></i> ${item.text}`;
    
    a.addEventListener('click', (e) => {
      e.preventDefault();
      item.action();
    });
    
    li.appendChild(a);
    subnavContent.appendChild(li);
  });
}

/**
 * Setzt das aktive Hauptmenü und wechselt die Ansicht
 */
function setAktivesHauptmenu(menu) {
  // Entferne 'active' von allen Hauptmenü-Items
  document.querySelectorAll('#navbarNav .nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  // Setze 'active' auf gewähltes Item
  const activeLink = document.querySelector(`[data-nav="${menu}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }
  
  // Speichere aktuelles Hauptmenü
  aktuellesHauptmenu = menu;
  
  // Aktualisiere Subnavigation
  updateSubnavigation(menu);
  
  // Wechsle Hauptansicht
  wechsleHauptansicht(menu);
}

/**
 * Wechselt zwischen Stammdaten und Urlaubsplaner-Ansicht
 */
async function wechsleHauptansicht(menu) {
  const stammdatenContainer = document.getElementById('stammdatenAnsicht');
  const urlaubsplanerContainer = document.getElementById('urlaubsplanerAnsicht');

  if (menu === 'stammdaten') {
    // Zeige Stammdaten-Ansicht
    urlaubsplanerContainer.classList.add('d-none');
    stammdatenContainer.classList.remove('d-none');
    
    // Lade Stammdaten
    await stammdatenAnsicht.zeigen();
    
  } else {
    // Zeige Urlaubsplaner-Ansicht
    stammdatenContainer.classList.add('d-none');
    urlaubsplanerContainer.classList.remove('d-none');
    
    // Lade Urlaubsplaner-Daten (falls noch nicht geladen)
    if (aktuelleAnsicht === 'tabelle') {
      await loadData();
    } else {
      await kalenderAnsicht.zeigen();
    }
  }
}

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

    // Stammdaten-Ansicht initialisieren
    stammdatenAnsicht = new StammdatenAnsicht(dataManager, dialogManager);
    console.log('✅ Stammdaten-Ansicht initialisiert');

    // UI initialisieren
    await initUI();

    // Initiale Daten laden (Urlaubsplaner ist initial aktiv)
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
 * Wechselt zwischen Tabellen- und Kalenderansicht (nur im Urlaubsplaner)
 */
async function toggleAnsicht() {
  if (aktuellesHauptmenu !== 'urlaubsplaner') return;

  const tabellenAnsicht = document.getElementById('tabellenAnsicht');
  const kalenderAnsichtDiv = document.getElementById('kalenderAnsicht');

  if (aktuelleAnsicht === 'tabelle') {
    // Wechsle zu Kalender
    aktuelleAnsicht = 'kalender';
    
    tabellenAnsicht.classList.add('d-none');
    kalenderAnsichtDiv.classList.remove('d-none');
    
    // Kalender-Jahr synchronisieren und anzeigen
    kalenderAnsicht.currentYear = dataManager.aktuellesJahr;
    await kalenderAnsicht.zeigen();
    
  } else {
    // Wechsle zu Tabelle
    aktuelleAnsicht = 'tabelle';
    
    kalenderAnsichtDiv.classList.add('d-none');
    tabellenAnsicht.classList.remove('d-none');
  }
}

/**
 * UI initialisieren (Event Listener, etc.)
 */
async function initUI() {
  // Hauptnavigation Event-Listener
  document.querySelectorAll('[data-nav]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const menu = link.dataset.nav;
      setAktivesHauptmenu(menu);
    });
  });
  
  // Initiale Subnavigation setzen
  updateSubnavigation(aktuellesHauptmenu);

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
    
    if (aktuellesHauptmenu === 'stammdaten') {
      await stammdatenAnsicht.zeigen();
    } else {
      await loadData();
      if (aktuelleAnsicht === 'kalender') {
        kalenderAnsicht.currentYear = dataManager.aktuellesJahr;
        await kalenderAnsicht.zeigen();
      }
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

  // Toolbar-Buttons
  document.getElementById('btnAktualisieren').addEventListener('click', async (e) => {
    e.preventDefault();
    
    if (aktuellesHauptmenu === 'stammdaten') {
      await stammdatenAnsicht.zeigen();
    } else {
      await loadData();
      if (aktuelleAnsicht === 'kalender') {
        await kalenderAnsicht.zeigen();
      }
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
        await dialogManager.zeigeDetails(mitarbeiterId, dataManager.aktuellesJahr, 'urlaubsplaner');
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
// Excel-Export
async function exportToExcel() {
  try {
    showNotification('Export', 'Excel-Export wird erstellt...', 'info');
    const stats = await dataManager.getAlleStatistiken();

    if (stats.length === 0) {
      showNotification('Info', 'Keine Daten zum Exportieren vorhanden', 'warning');
      return;
    }
    
    const exportData = stats.map(stat => ({
      mitarbeiter: `${stat.mitarbeiter.vorname} ${stat.mitarbeiter.nachname}`,
      abteilung: stat.mitarbeiter.abteilung_name,
      urlaub_anspruch: stat.urlaubsanspruch,
      urlaub_uebertrag: stat.uebertrag_vorjahr,
      urlaub_verfuegbar: stat.urlaub_verfuegbar,
      urlaub_genommen: stat.urlaub_genommen,
      urlaub_rest: stat.urlaub_rest,
      krankheit: stat.krankheitstage,
      schulung: stat.schulungstage,
      ueberstunden: stat.ueberstunden
    }));
    
    const result = await window.electronAPI.exportExcel(exportData);
    
    if (result.success) {
      showNotification('Erfolg', `Excel wurde erstellt: ${result.path}`, 'success');
    } else {
      showNotification('Fehler', `Export fehlgeschlagen: ${result.error}`, 'danger');
    }
  } catch (error) {
    console.error('Excel-Export Fehler:', error);
    showNotification('Fehler', `Export fehlgeschlagen: ${error.message}`, 'danger');
  }
}

// PDF-Export
async function exportToPdf() {
  try {
    showNotification('Export', 'PDF-Export wird erstellt...', 'info');
    const stats = await dataManager.getAlleStatistiken();

    if (stats.length === 0) {
      showNotification('Info', 'Keine Daten zum Exportieren vorhanden', 'warning');
      return;
    }
    
    const exportData = stats.map(stat => ({
      mitarbeiter: `${stat.mitarbeiter.vorname} ${stat.mitarbeiter.nachname}`,
      abteilung: stat.mitarbeiter.abteilung_name,
      urlaub_anspruch: stat.urlaubsanspruch,
      urlaub_uebertrag: stat.uebertrag_vorjahr,
      urlaub_verfuegbar: stat.urlaub_verfuegbar,
      urlaub_genommen: stat.urlaub_genommen,
      urlaub_rest: stat.urlaub_rest,
      krankheit: stat.krankheitstage,
      schulung: stat.schulungstage,
      ueberstunden: stat.ueberstunden
    }));
    
    const result = await window.electronAPI.exportPdf(exportData);
    
    if (result.success) {
      showNotification('Erfolg', `PDF wurde erstellt: ${result.path}`, 'success');
    } else {
      showNotification('Fehler', `Export fehlgeschlagen: ${result.error}`, 'danger');
    }
  } catch (error) {
    console.error('PDF-Export Fehler:', error);
    showNotification('Fehler', `Export fehlgeschlagen: ${error.message}`, 'danger');
  }
}
/**
 * App starten wenn DOM geladen
 */
document.addEventListener('DOMContentLoaded', initApp);