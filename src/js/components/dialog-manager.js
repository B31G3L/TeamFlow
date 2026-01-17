/**
 * Dialog Manager
 * Zentrale Klasse die alle Dialog-Funktionen zusammenführt
 * 
 * UPDATE: Übertrag-Dialog hinzugefügt
 * UPDATE: Arbeitszeitmodell-Dialog hinzugefügt
 */

class DialogManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
    
    // Initialisiere alle Dialog-Handler
    this.stammdatenDialog = new StammdatenDialog(dataManager);
    this.abteilungDialog = new AbteilungDialog(dataManager);
    this.urlaubDialog = new UrlaubDialog(dataManager);
    this.krankheitDialog = new KrankheitDialog(dataManager);
    this.schulungDialog = new SchulungDialog(dataManager);
    this.ueberstundenDialog = new UeberstundenDialog(dataManager);
    this.feiertagDialog = new FeiertagDialog(dataManager);
    this.veranstaltungDialog = new VeranstaltungDialog(dataManager);
    this.detailDialog = new DetailDialog(dataManager);
    this.uebertragDialog = new UebertragDialog(dataManager);
    this.arbeitszeitmodellDialog = new ArbeitszeitmodellDialog(dataManager); // NEU
  }

  // === Stammdaten-Dialoge ===
  
  async zeigeStammdatenHinzufuegen(callback) {
    return this.stammdatenDialog.zeigeStammdatenHinzufuegen(callback);
  }

  async zeigeStammdatenBearbeiten(mitarbeiterId, callback) {
    return this.stammdatenDialog.zeigeStammdatenBearbeiten(mitarbeiterId, callback);
  }

  async zeigeStammdatenVerwalten(callback) {
    return this.stammdatenDialog.zeigeStammdatenVerwalten(callback);
  }

  // === Abteilungs-Dialoge ===
  
  async zeigeAbteilungenVerwalten(callback) {
    return this.abteilungDialog.zeigeAbteilungenVerwalten(callback);
  }

  async zeigeAbteilungHinzufuegen(callback) {
    return this.abteilungDialog.zeigeAbteilungHinzufuegen(callback);
  }

  async zeigeAbteilungBearbeiten(abteilungId, callback) {
    return this.abteilungDialog.zeigeAbteilungBearbeiten(abteilungId, callback);
  }

  // === Eintrags-Dialoge ===
  
  async zeigeUrlaubDialog(mitarbeiterId, callback) {
    return this.urlaubDialog.zeigeUrlaubDialog(mitarbeiterId, callback);
  }

  async zeigeKrankDialog(mitarbeiterId, callback) {
    return this.krankheitDialog.zeigeKrankDialog(mitarbeiterId, callback);
  }

  async zeigeSchulungDialog(mitarbeiterId, callback) {
    return this.schulungDialog.zeigeSchulungDialog(mitarbeiterId, callback);
  }

  async zeigeUeberstundenDialog(mitarbeiterId, callback) {
    return this.ueberstundenDialog.zeigeUeberstundenDialog(mitarbeiterId, callback);
  }

  // === Feiertage-Dialoge ===
  
  async zeigeFeiertagVerwalten(callback) {
    return this.feiertagDialog.zeigeFeiertagVerwalten(callback);
  }

  async zeigeFeiertagHinzufuegen(callback) {
    return this.feiertagDialog.zeigeFeiertagHinzufuegen(callback);
  }

  async zeigeFeiertagBearbeiten(feiertagId, callback) {
    return this.feiertagDialog.zeigeFeiertagBearbeiten(feiertagId, callback);
  }

  // === Veranstaltungs-Dialoge ===
  
  async zeigeVeranstaltungVerwalten(callback) {
    return this.veranstaltungDialog.zeigeVeranstaltungVerwalten(callback);
  }

  async zeigeVeranstaltungHinzufuegen(callback) {
    return this.veranstaltungDialog.zeigeVeranstaltungHinzufuegen(callback);
  }

  async zeigeVeranstaltungBearbeiten(veranstaltungId, callback) {
    return this.veranstaltungDialog.zeigeVeranstaltungBearbeiten(veranstaltungId, callback);
  }

  // === Detail-Dialog ===
  
 async zeigeDetails(mitarbeiterId, jahr = null, herkunft = null) {
  return this.detailDialog.zeigeDetails(mitarbeiterId, jahr, herkunft);
}

  // === Übertrag-Dialog ===
  
  async zeigeUebertragAnpassen(mitarbeiterId, callback) {
    return this.uebertragDialog.zeigeUebertragAnpassen(mitarbeiterId, callback);
  }

  // === Arbeitszeitmodell-Dialog (NEU) ===
  
  async zeigeArbeitszeitmodell(mitarbeiterId, callback) {
    return this.arbeitszeitmodellDialog.zeigeArbeitszeitmodell(mitarbeiterId, callback);
  }
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DialogManager;
}