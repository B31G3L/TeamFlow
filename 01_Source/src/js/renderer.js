/**
 * TeamFlow - Renderer Process
 *
 * AUFGERÄUMT:
 * - exportToExcel() und exportToPdf() entfernt. Beide Funktionen wurden
 *   seit Einführung von export-dialog.js nie mehr aufgerufen – der Export
 *   läuft vollständig über zeigeExportDialog() / _starteExport().
 */

let database;
let dataManager;
let tabelle;
let dialogManager;
let kalenderAnsicht;
let stammdatenAnsicht;
let aktuelleAnsicht     = 'tabelle';
let aktuellesHauptmenu  = 'urlaubsplaner';

const SUBNAV_CONFIG = {
  stammdaten: [
    {
      id: 'subMitarbeiterAnlegen', icon: 'bi-plus-circle', text: 'Mitarbeiter anlegen',
      action: () => dialogManager.zeigeStammdatenHinzufuegen(async () => {
        aktuellesHauptmenu === 'stammdaten' ? await stammdatenAnsicht.zeigen() : await loadData();
      }),
    },
    { separator: true },
    {
      id: 'subAbteilungen', icon: 'bi-building', text: 'Abteilungen',
      action: () => dialogManager.zeigeAbteilungenVerwalten(async () => {
        if (aktuellesHauptmenu === 'stammdaten') await stammdatenAnsicht.zeigen();
        else { await loadData(); await updateAbteilungFilter(); }
      }),
    },
  ],
  urlaubsplaner: [
    { id: 'subTabelle',       icon: 'bi-table',          text: 'Tabelle',       action: async () => { if (aktuelleAnsicht !== 'tabelle')   await toggleAnsicht(); } },
    { id: 'subKalender',      icon: 'bi-calendar3',      text: 'Kalender',      action: async () => { if (aktuelleAnsicht !== 'kalender')  await toggleAnsicht(); } },
    { separator: true },
    { id: 'subFeiertage',     icon: 'bi-calendar-event', text: 'Feiertage',     action: () => dialogManager.zeigeFeiertagVerwalten(async () => loadData()) },
    { id: 'subVeranstaltungen',icon:'bi-calendar-check', text: 'Veranstaltungen',action: () => dialogManager.zeigeVeranstaltungVerwalten(async () => loadData()) },
    { separator: true },
    { id: 'subExport',        icon: 'bi-box-arrow-up',   text: 'Export',        action: () => zeigeExportDialog() },
  ],
};

function updateSubnavigation(hauptmenu) {
  const subnavContent   = document.getElementById('subnavContent');
  const subnavContainer = document.getElementById('subnavigation');
  if (!subnavContent || !subnavContainer) return;

  subnavContent.innerHTML = '';
  const items = SUBNAV_CONFIG[hauptmenu] || [];
  if (items.length === 0) { subnavContainer.classList.add('d-none'); return; }
  subnavContainer.classList.remove('d-none');

  items.forEach(item => {
    if (item.separator) {
      const li = document.createElement('li');
      li.className = 'nav-separator';
      li.innerHTML = '<span class="separator-line"></span>';
      subnavContent.appendChild(li);
      return;
    }
    const li = document.createElement('li');
    li.className = 'nav-item';
    const a = document.createElement('a');
    a.className = 'nav-link'; a.href = '#'; a.id = item.id;
    a.innerHTML = `<i class="bi ${item.icon}"></i> ${item.text}`;
    a.addEventListener('click', (e) => { e.preventDefault(); item.action(); });
    li.appendChild(a);
    subnavContent.appendChild(li);
  });
}

function setAktivesHauptmenu(menu) {
  document.querySelectorAll('#navbarNav .nav-link').forEach(l => l.classList.remove('active'));
  document.querySelector(`[data-nav="${menu}"]`)?.classList.add('active');
  aktuellesHauptmenu = menu;
  updateSubnavigation(menu);
  wechsleHauptansicht(menu);
}

async function wechsleHauptansicht(menu) {
  const stammdatenContainer   = document.getElementById('stammdatenAnsicht');
  const urlaubsplanerContainer = document.getElementById('urlaubsplanerAnsicht');

  if (menu === 'stammdaten') {
    urlaubsplanerContainer.classList.add('d-none');
    stammdatenContainer.classList.remove('d-none');
    await stammdatenAnsicht.zeigen();
  } else {
    stammdatenContainer.classList.add('d-none');
    urlaubsplanerContainer.classList.remove('d-none');
    aktuelleAnsicht === 'tabelle' ? await loadData() : await kalenderAnsicht.zeigen();
  }
}

async function initApp() {
  console.log('🚀 TeamFlow wird gestartet...');
  try {
    database        = new TeamFlowDatabase();
    dataManager     = new TeamFlowDataManager(database);
    tabelle         = new MitarbeiterTabelle(dataManager);
    dialogManager   = new DialogManager(dataManager);
    kalenderAnsicht = new KalenderAnsicht(dataManager);
    stammdatenAnsicht = new StammdatenAnsicht(dataManager, dialogManager);

    await initUI();
    await loadData();
    await initFooter();

    setTimeout(async () => {
      const info = await database.getDatabaseInfo();
      showNotification('TeamFlow geladen', `Jahr: ${dataManager.aktuellesJahr} | Mitarbeiter: ${info.tables.mitarbeiter}`, 'success');
    }, 500);
  } catch (error) {
    console.error('❌ Fehler beim Starten:', error);
    showNotification('Fehler', `Fehler beim Starten: ${error.message}`, 'danger');
  }
}

async function toggleAnsicht() {
  if (aktuellesHauptmenu !== 'urlaubsplaner') return;
  const tabellenDiv = document.getElementById('tabellenAnsicht');
  const kalenderDiv = document.getElementById('kalenderAnsicht');

  if (aktuelleAnsicht === 'tabelle') {
    aktuelleAnsicht = 'kalender';
    tabellenDiv.classList.add('d-none');
    kalenderDiv.classList.remove('d-none');
    kalenderAnsicht.currentYear = dataManager.aktuellesJahr;
    await kalenderAnsicht.zeigen();
  } else {
    aktuelleAnsicht = 'tabelle';
    kalenderDiv.classList.add('d-none');
    tabellenDiv.classList.remove('d-none');
  }
}

async function initUI() {
  document.querySelectorAll('[data-nav]').forEach(link => {
    link.addEventListener('click', (e) => { e.preventDefault(); setAktivesHauptmenu(link.dataset.nav); });
  });
  updateSubnavigation(aktuellesHauptmenu);

  // Jahr-Auswahl
  const jahrSelect = document.getElementById('jahrSelect');
  const verfuegbareJahre = await dataManager.getVerfuegbareJahre();
  verfuegbareJahre.forEach(jahr => {
    const o = document.createElement('option');
    o.value = jahr; o.textContent = jahr;
    if (jahr === dataManager.aktuellesJahr) o.selected = true;
    jahrSelect.appendChild(o);
  });
  jahrSelect.addEventListener('change', async (e) => {
    dataManager.aktuellesJahr = parseInt(e.target.value);
    dataManager.invalidateCache();
    if (aktuellesHauptmenu === 'stammdaten') await stammdatenAnsicht.zeigen();
    else {
      await loadData();
      if (aktuelleAnsicht === 'kalender') { kalenderAnsicht.currentYear = dataManager.aktuellesJahr; await kalenderAnsicht.zeigen(); }
    }
    showNotification('Jahr gewechselt', `Aktuelles Jahr: ${dataManager.aktuellesJahr}`, 'info');
  });

  await updateAbteilungFilter();
  const abtFilter = document.getElementById('abteilungFilter');
  abtFilter.addEventListener('change', async (e) => {
    const abt = e.target.value === 'Alle' ? null : e.target.value;
    await tabelle.suchen(document.getElementById('suchfeld').value, abt);
  });

  const suchfeld = document.getElementById('suchfeld');
  suchfeld.addEventListener('input', async (e) => {
    const abt = abtFilter.value === 'Alle' ? null : abtFilter.value;
    await tabelle.suchen(e.target.value, abt);
  });

  document.getElementById('btnAktualisieren').addEventListener('click', async (e) => {
    e.preventDefault();
    if (aktuellesHauptmenu === 'stammdaten') await stammdatenAnsicht.zeigen();
    else { await loadData(); if (aktuelleAnsicht === 'kalender') await kalenderAnsicht.zeigen(); }
    showNotification('Aktualisiert', 'Daten wurden neu geladen', 'success');
  });

  document.getElementById('mitarbeiterTabelleBody').addEventListener('click', async (e) => {
    const clickable = e.target.closest('.clickable');
    if (!clickable) return;
    const id     = clickable.dataset.id;
    const action = clickable.dataset.action;
    if (!id || !action) return;

    const reload = async () => {
      await loadData();
      if (aktuelleAnsicht === 'kalender') await kalenderAnsicht.zeigen();
    };

    switch (action) {
      case 'details':
        await dialogManager.zeigeDetails(id, dataManager.aktuellesJahr, 'urlaubsplaner');
        await loadData();
        if (aktuelleAnsicht === 'kalender') await kalenderAnsicht.zeigen();
        break;
      case 'bearbeiten':  dialogManager.zeigeStammdatenBearbeiten(id, reload); break;
      case 'urlaub':      dialogManager.zeigeUrlaubDialog(id, reload); break;
      case 'krank':       dialogManager.zeigeKrankDialog(id, reload); break;
      case 'schulung':    dialogManager.zeigeSchulungDialog(id, reload); break;
      case 'ueberstunden':dialogManager.zeigeUeberstundenDialog(id, async () => loadData()); break;
      case 'uebertrag':   dialogManager.zeigeUebertragAnpassen(id, async () => loadData()); break;
    }
  });
}

async function updateAbteilungFilter() {
  const filter = document.getElementById('abteilungFilter');
  const current = filter.value;
  while (filter.options.length > 1) filter.remove(1);
  const abteilungen = await dataManager.getAlleAbteilungen();
  abteilungen.forEach(abt => {
    const o = document.createElement('option');
    o.value = abt.name; o.textContent = abt.name;
    filter.appendChild(o);
  });
  if (current && Array.from(filter.options).some(o => o.value === current)) filter.value = current;
}

async function loadData() {
  try {
    const abt = document.getElementById('abteilungFilter').value;
    await tabelle.aktualisieren(abt === 'Alle' ? null : abt);
    await updateFooterDbInfo();
  } catch (error) {
    showNotification('Fehler', `Daten konnten nicht geladen werden: ${error.message}`, 'danger');
  }
}

async function initFooter() {
  const version = await window.electronAPI.getAppVersion();
  document.getElementById('appVersion').textContent = `TeamFlow v${version}`;
  updateFooterDate();
  setInterval(updateFooterDate, 60000);
  await updateFooterDbInfo();
  const dbPath = await window.electronAPI.getDatabasePath();
  document.getElementById('dbPath').textContent = dbPath.split(/[\\/]/).pop();
  document.getElementById('dbPath').title = dbPath;
}

function updateFooterDate() {
  document.getElementById('currentDate').textContent = new Date().toLocaleDateString('de-DE', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

async function updateFooterDbInfo() {
  try {
    const info = await database.getDatabaseInfo();
    document.getElementById('dbInfo').textContent = `Mitarbeiter: ${info.tables.mitarbeiter || 0}`;
  } catch {
    document.getElementById('dbInfo').textContent = 'DB: Fehler';
  }
}

document.addEventListener('DOMContentLoaded', initApp);