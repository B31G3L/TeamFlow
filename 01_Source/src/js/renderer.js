/**
 * TeamFlow - Renderer Process
 * Orchestriert die gesamte App
 *
 * NEU: Zweistufige Navigation - Stammdaten & Urlaubsplaner
 * UPDATE: Excel und PDF Export statt CSV
 * UPDATE: Tabellen-Button in Subnavigation
 * FIX: Ladeindikator nur beim ersten Ladevorgang
 */

// Globale Variablen
let database;
let dataManager;
let tabelle;
let dialogManager;
let kalenderAnsicht;
let stammdatenAnsicht;
let ehemaligeTabelle;
let aktuelleAnsicht = 'tabelle'; // 'tabelle' oder 'kalender'
let aktuellesHauptmenu = 'urlaubsplaner'; // 'stammdaten' oder 'urlaubsplaner'
let ersterLadevorgang = true; // FIX: Spinner nur beim ersten Laden

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
    { separator: true },
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
    { separator: true },
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
    { separator: true },
    {
      id: 'subExport',
      icon: 'bi-box-arrow-up',
      text: 'Export',
      action: () => zeigeExportDialog()
    },
    { separator: true },
{
  id: 'subEhemalige',
  icon: 'bi-person-x',
  text: 'Ehemalige',
  action: async () => {
    if (aktuelleAnsicht !== 'ehemalige') {
      await zeigeEhemaligeAnsicht();
    }
  }
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

  subnavContent.innerHTML = '';

  const items = SUBNAV_CONFIG[hauptmenu] || [];

  if (items.length === 0) {
    subnavContainer.classList.add('d-none');
    return;
  }

  subnavContainer.classList.remove('d-none');

  items.forEach((item) => {
    if (item.separator) {
      const separator = document.createElement('li');
      separator.className = 'nav-separator';
      separator.innerHTML = '<span class="separator-line"></span>';
      subnavContent.appendChild(separator);
      return;
    }

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
// Neue Hilfsfunktion – irgendwo oben im renderer.js
function updateSubnavAktiv() {
  // Alle Subnav-Links zurücksetzen
  document.querySelectorAll('#subnavContent .nav-link').forEach(link => {
    link.classList.remove('active');
  });

  // Aktiven Link setzen
  const idMap = {
    tabelle:   'subTabelle',
    kalender:  'subKalender',
    ehemalige: 'subEhemalige',
  };
  const aktivId = idMap[aktuelleAnsicht];
  if (aktivId) {
    const aktivLink = document.getElementById(aktivId);
    if (aktivLink) aktivLink.classList.add('active');
  }
}
/**
 * Setzt das aktive Hauptmenü und wechselt die Ansicht
 */
function setAktivesHauptmenu(menu) {
  document.querySelectorAll('#navbarNav .nav-link').forEach(link => {
    link.classList.remove('active');
  });

  const activeLink = document.querySelector(`[data-nav="${menu}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }

  aktuellesHauptmenu = menu;
  updateSubnavigation(menu);
  wechsleHauptansicht(menu);
}

/**
 * Wechselt zwischen Stammdaten und Urlaubsplaner-Ansicht
 */
async function wechsleHauptansicht(menu) {
  const stammdatenContainer = document.getElementById('stammdatenAnsicht');
  const urlaubsplanerContainer = document.getElementById('urlaubsplanerAnsicht');

  if (menu === 'stammdaten') {
    urlaubsplanerContainer.classList.add('d-none');
    stammdatenContainer.classList.remove('d-none');
    await stammdatenAnsicht.zeigen();
  } else {
    stammdatenContainer.classList.add('d-none');
    urlaubsplanerContainer.classList.remove('d-none');

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
  console.log('🚀 TeamFlow wird gestartet...');

  try {
    database = new TeamFlowDatabase();
    console.log('✅ Datenbank initialisiert');

    dataManager = new TeamFlowDataManager(database);
    console.log('✅ DataManager initialisiert');

    tabelle = new MitarbeiterTabelle(dataManager);
    console.log('✅ Tabelle initialisiert');

    dialogManager = new DialogManager(dataManager);
    console.log('✅ Dialog Manager initialisiert');

    kalenderAnsicht = new KalenderAnsicht(dataManager);
    console.log('✅ Kalender-Ansicht initialisiert');

    stammdatenAnsicht = new StammdatenAnsicht(dataManager, dialogManager);
    console.log('✅ Stammdaten-Ansicht initialisiert');
// ehemaligeTabelle wird lazy initialisiert beim ersten Aufruf

    await initUI();
    await loadData();
    await initFooter();

    console.log('✅ TeamFlow erfolgreich gestartet');

    setTimeout(async () => {
      const info = await database.getDatabaseInfo();
      showNotification(
        'TeamFlow geladen',
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
    aktuelleAnsicht = 'kalender';
    tabellenAnsicht.classList.add('d-none');
    kalenderAnsichtDiv.classList.remove('d-none');
    kalenderAnsicht.currentYear = dataManager.aktuellesJahr;
    await kalenderAnsicht.zeigen();
  } else {
    aktuelleAnsicht = 'tabelle';
    kalenderAnsichtDiv.classList.add('d-none');
    tabellenAnsicht.classList.remove('d-none');
  }
    updateSubnavAktiv(); // NEU

}

/**
 * UI initialisieren (Event Listener, etc.)
 */
async function initUI() {
  document.querySelectorAll('[data-nav]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const menu = link.dataset.nav;
      setAktivesHauptmenu(menu);
    });
  });

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

  // NEU: Suchfeld leeren beim Jahreswechsel
  document.getElementById('suchfeld').value = '';

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

  await updateAbteilungFilter();

  const abteilungFilter = document.getElementById('abteilungFilter');
  abteilungFilter.addEventListener('change', async (e) => {
    const abteilung = e.target.value === 'Alle' ? null : e.target.value;
    const suchbegriff = document.getElementById('suchfeld').value;
    await tabelle.suchen(suchbegriff, abteilung);
  });

  const suchfeld = document.getElementById('suchfeld');
  suchfeld.addEventListener('input', async (e) => {
    const abteilung = abteilungFilter.value === 'Alle' ? null : abteilungFilter.value;
    await tabelle.suchen(e.target.value, abteilung);
  });

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

  while (abteilungFilter.options.length > 1) {
    abteilungFilter.remove(1);
  }

  const abteilungen = await dataManager.getAlleAbteilungen();

  abteilungen.forEach(abt => {
    const option = document.createElement('option');
    option.value = abt.name;
    option.textContent = abt.name;
    abteilungFilter.appendChild(option);
  });

  if (currentValue && Array.from(abteilungFilter.options).some(o => o.value === currentValue)) {
    abteilungFilter.value = currentValue;
  }
}

/**
 * Daten laden und Tabelle aktualisieren
 * FIX: Ladeindikator nur beim ersten Aufruf – danach stille Aktualisierung
 */
async function loadData() {
  const tbody = document.getElementById('mitarbeiterTabelleBody');

  if (ersterLadevorgang && tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4 text-muted">
          <div class="spinner-border spinner-border-sm me-2" role="status"></div>
          Daten werden geladen...
        </td>
      </tr>`;
  }

  try {
    const abteilung = document.getElementById('abteilungFilter').value;
    const filter = abteilung === 'Alle' ? null : abteilung;

    await tabelle.aktualisieren(filter);
    await updateFooterDbInfo();

    ersterLadevorgang = false;
      updateSubnavAktiv();

  } catch (error) {
    console.error('Fehler beim Laden:', error);
    showNotification('Fehler', `Daten konnten nicht geladen werden: ${error.message}`, 'danger');
  }
}

/**
 * Initialisiert und aktualisiert den Footer
 */
async function initFooter() {
  const version = await window.electronAPI.getAppVersion();
  document.getElementById('appVersion').textContent = `TeamFlow v${version}`;

  updateFooterDate();
  setInterval(updateFooterDate, 60000);

  await updateFooterDbInfo();

  const dbPath = await window.electronAPI.getDatabasePath();
  const dbPathShort = dbPath.split(/[\\/]/).pop();
  document.getElementById('dbPath').textContent = dbPathShort;
  document.getElementById('dbPath').title = dbPath;
}

/**
 * Aktualisiert das Datum im Footer
 */
function updateFooterDate() {
  const now = new Date();
  const options = {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  const dateStr = now.toLocaleDateString('de-DE', options);
  document.getElementById('currentDate').textContent = dateStr;
}

/**
 * Aktualisiert die Datenbank-Info im Footer
 */
async function updateFooterDbInfo() {
  try {
    const info = await database.getDatabaseInfo();
    const mitarbeiterCount = info.tables.mitarbeiter || 0;
    document.getElementById('dbInfo').textContent = `Mitarbeiter: ${mitarbeiterCount}`;
  } catch (error) {
    console.error('Fehler beim Laden der DB-Info:', error);
    document.getElementById('dbInfo').textContent = 'DB: Fehler';
  }
}
async function zeigeEhemaligeAnsicht() {
  aktuelleAnsicht = 'ehemalige';

  document.getElementById('tabellenAnsicht').classList.add('d-none');
  document.getElementById('kalenderAnsicht').classList.add('d-none');
  document.getElementById('ehemaligeAnsicht').classList.remove('d-none');

  if (!ehemaligeTabelle) {
    ehemaligeTabelle = new EhemaligeTabelle(dataManager, dialogManager);
  }
  await ehemaligeTabelle.zeigen('ehemaligeAnsicht');
    updateSubnavAktiv(); // NEU

}
async function toggleAnsicht() {
  if (aktuellesHauptmenu !== 'urlaubsplaner') return;

  const tabellenAnsicht  = document.getElementById('tabellenAnsicht');
  const kalenderAnsichtDiv = document.getElementById('kalenderAnsicht');
  const ehemaligeAnsichtDiv = document.getElementById('ehemaligeAnsicht');

  // Ehemalige immer ausblenden beim Ansichtswechsel
  ehemaligeAnsichtDiv?.classList.add('d-none');

  if (aktuelleAnsicht === 'tabelle' || aktuelleAnsicht === 'ehemalige') {
    aktuelleAnsicht = 'kalender';
    tabellenAnsicht.classList.add('d-none');
    kalenderAnsichtDiv.classList.remove('d-none');
    kalenderAnsicht.currentYear = dataManager.aktuellesJahr;
    await kalenderAnsicht.zeigen();
  } else {
    aktuelleAnsicht = 'tabelle';
    kalenderAnsichtDiv.classList.add('d-none');
    tabellenAnsicht.classList.remove('d-none');
  }
    updateSubnavAktiv(); // NEU

}
async function wechsleHauptansicht(menu) {
  const stammdatenContainer    = document.getElementById('stammdatenAnsicht');
  const urlaubsplanerContainer = document.getElementById('urlaubsplanerAnsicht');

  if (menu === 'stammdaten') {
    urlaubsplanerContainer.classList.add('d-none');
    stammdatenContainer.classList.remove('d-none');
    // Ehemaligen-Ansicht beim Wechsel zu Stammdaten zurücksetzen
    if (aktuelleAnsicht === 'ehemalige') {
      aktuelleAnsicht = 'tabelle';
      document.getElementById('ehemaligeAnsicht')?.classList.add('d-none');
      document.getElementById('tabellenAnsicht')?.classList.remove('d-none');
    }
    await stammdatenAnsicht.zeigen();
  } else {
    stammdatenContainer.classList.add('d-none');
    urlaubsplanerContainer.classList.remove('d-none');

    if (aktuelleAnsicht === 'tabelle') {
      await loadData();
    } else if (aktuelleAnsicht === 'kalender') {
      await kalenderAnsicht.zeigen();
    } else if (aktuelleAnsicht === 'ehemalige') {
      if (!ehemaligeTabelle) {
        ehemaligeTabelle = new EhemaligeTabelle(dataManager, dialogManager);
      }
      await ehemaligeTabelle.zeigen('ehemaligeAnsicht');
    }
  }
}
/**
 * App starten wenn DOM geladen
 */
document.addEventListener('DOMContentLoaded', initApp);