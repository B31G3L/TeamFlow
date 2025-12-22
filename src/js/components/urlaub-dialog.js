/**
 * Urlaub-Dialog
 * Urlaub eintragen mit Feiertags-Berücksichtigung
 * 
 * FIX: Halbe Tage werden jetzt korrekt als 0.5 Tage angezeigt und gespeichert
 * - Bei Auswahl "Halber Tag": Von-Datum = Bis-Datum, Anzeige = 0.5 Tage
 * - Speicherung erfolgt mit 0.5 Tagen
 */

class UrlaubDialog extends DialogBase {
  /**
   * Zeigt Urlaub Eintragen Dialog
   */
  async zeigeUrlaubDialog(mitarbeiterId, callback) {
    const heute = new Date();
    const formatDate = (date) => date.toISOString().split('T')[0];

    // Hole aktuelle Statistik für Resturlaub-Anzeige
    const statistik = await this.dataManager.getMitarbeiterStatistik(mitarbeiterId);
    const restUrlaub = statistik ? statistik.urlaub_rest : 0;

    const modalHtml = `
      <div class="modal fade" id="urlaubModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-success text-white">
              <h5 class="modal-title">
                <i class="bi bi-calendar-plus"></i> Urlaub eintragen
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <!-- Resturlaub-Anzeige -->
              <div class="alert ${restUrlaub > 5 ? 'alert-success' : restUrlaub > 0 ? 'alert-warning' : 'alert-danger'} mb-3">
                <div class="d-flex justify-content-between align-items-center">
                  <span>
                    <i class="bi bi-calendar-check"></i> 
                    <strong>Verfügbarer Resturlaub:</strong>
                  </span>
                  <span class="fs-5 fw-bold" id="restUrlaubAnzeige">${restUrlaub.toFixed(1)} Tage</span>
                </div>
              </div>

              <!-- Austrittsdatum-Warnung Container -->
              <div id="austrittsWarnung"></div>

              <form id="urlaubForm">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Von *</label>
                    <input type="date" class="form-control" id="vonDatum" value="${formatDate(heute)}" required>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Bis *</label>
                    <input type="date" class="form-control" id="bisDatum" value="${formatDate(heute)}" required>
                  </div>
                </div>

                <div class="mb-3">
                  <div class="d-flex justify-content-between align-items-center">
                    <label class="form-label mb-0">
                      Urlaubstage: <span id="dauerAnzeige" class="fw-bold text-success">1</span>
                    </label>
                    <small class="text-muted" id="berechnungsInfo">(inkl. Arbeitszeitmodell, ohne Wochenenden & Feiertage)</small>
                  </div>
                  
                  <!-- Warnung wenn zu viel Urlaub -->
                  <div id="urlaubWarnung" class="alert alert-danger mt-2 d-none">
                    <i class="bi bi-exclamation-triangle"></i>
                    <strong>Achtung:</strong> Die gewählte Anzahl Tage übersteigt den verfügbaren Resturlaub!
                  </div>
                  
                  <!-- Info zum Arbeitszeitmodell -->
                  <div id="arbeitszeitInfo" class="alert alert-info mt-2 d-none">
                    <i class="bi bi-info-circle"></i>
                    <small id="arbeitszeitInfoText"></small>
                  </div>
                  
                  <div class="mt-2">
                    <small class="text-muted d-block mb-1">Schnellauswahl:</small>
                    <div class="d-flex gap-2 flex-wrap">
                      <button type="button" class="btn btn-sm btn-outline-success dauer-btn" data-tage="0.5">Halber Tag</button>
                      <button type="button" class="btn btn-sm btn-outline-success dauer-btn" data-tage="1">1 Tag</button>
                      <button type="button" class="btn btn-sm btn-outline-success dauer-btn" data-tage="2">2 Tage</button>
                      <button type="button" class="btn btn-sm btn-outline-success dauer-btn" data-tage="3">3 Tage</button>
                      <button type="button" class="btn btn-sm btn-outline-success dauer-btn" data-tage="5">1 Woche</button>
                      <button type="button" class="btn btn-sm btn-outline-success dauer-btn" data-tage="10">2 Wochen</button>
                    </div>
                  </div>
                </div>

                <!-- Feiertags-Hinweise Container -->
                <div id="feiertagsHinweise"></div>

                <!-- Veranstaltungs-Hinweise Container -->
                <div id="veranstaltungsHinweise"></div>

                <!-- Kollegen-Hinweise Container -->
                <div id="kollegenHinweise"></div>

                <div class="mb-3">
                  <label class="form-label">Notizen</label>
                  <textarea class="form-control" id="notiz" rows="2" placeholder="Optionale Notizen..."></textarea>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
              <button type="button" class="btn btn-success" id="btnSpeichern">
                <i class="bi bi-check-lg"></i> Speichern
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.showModal(modalHtml, async () => {
      const form = document.getElementById('urlaubForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const vonDatum = document.getElementById('vonDatum').value;
      const bisDatum = document.getElementById('bisDatum').value;
      
      // FIX: Lese die angezeigte Anzahl Tage direkt aus der Anzeige
      const dauerAnzeige = document.getElementById('dauerAnzeige').textContent;
      const tage = parseFloat(dauerAnzeige);

      if (isNaN(tage) || tage <= 0) {
        showNotification('Fehler', 'Ungültige Anzahl Urlaubstage', 'danger');
        return false;
      }

      // VALIDIERUNG: Prüfe ob genug Resturlaub vorhanden ist
      if (tage > restUrlaub) {
        showNotification('Fehler', `Nicht genügend Resturlaub! Verfügbar: ${restUrlaub.toFixed(1)} Tage, Angefragt: ${tage} Tage`, 'danger');
        return false;
      }

      const eintrag = {
        typ: 'urlaub',
        mitarbeiter_id: mitarbeiterId,
        datum: vonDatum,
        wert: tage, // FIX: Verwende direkt den angezeigten Wert (0.5 bei halbem Tag)
        beschreibung: document.getElementById('notiz').value || null
      };

      try {
        await this.dataManager.speichereEintrag(eintrag);
        showNotification('Erfolg', 'Urlaub wurde eingetragen', 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });

    // Event-Listener nach Modal-Animation initialisieren
    await this._initUrlaubEventListener(mitarbeiterId, restUrlaub);
  }

  /**
   * Berechnet Urlaubstage mit Arbeitszeitmodell
   */
  async _berechneUrlaubstage(vonDatum, bisDatum, mitarbeiterId) {
    const von = new Date(vonDatum + 'T00:00:00');
    const bis = new Date(bisDatum + 'T00:00:00');
    
    // Validiere Austrittsdatum
    const mitarbeiter = await this.dataManager.getMitarbeiter(mitarbeiterId);
    if (!mitarbeiter) {
      throw new Error('Mitarbeiter nicht gefunden');
    }
    
    if (mitarbeiter.austrittsdatum) {
      const austritt = new Date(mitarbeiter.austrittsdatum + 'T00:00:00');
      
      if (von > austritt) {
        const austrittFormatiert = this._formatDatumAnzeige(mitarbeiter.austrittsdatum);
        throw new Error(
          `Urlaubsbeginn liegt nach dem Austrittsdatum (${austrittFormatiert}). ` +
          `Urlaub kann nur bis zum Austrittsdatum eingetragen werden.`
        );
      }
      
      if (bis > austritt) {
        const austrittFormatiert = this._formatDatumAnzeige(mitarbeiter.austrittsdatum);
        throw new Error(
          `Urlaubsende (${this._formatDatumAnzeige(bisDatum)}) liegt nach dem Austrittsdatum (${austrittFormatiert}). ` +
          `Bitte wählen Sie einen früheren End-Termin oder tragen Sie den Urlaub nur bis zum ${austrittFormatiert} ein.`
        );
      }
    }
    
    // Lade Arbeitszeitmodell
    const arbeitszeitmodell = await this.dataManager.getArbeitszeitmodell(mitarbeiterId);
    
    // Lade Feiertage
    const jahreSet = new Set();
    const current = new Date(von);
    while (current <= bis) {
      jahreSet.add(current.getFullYear());
      current.setDate(current.getDate() + 1);
    }
    
    const alleFeiertage = new Set();
    for (const jahr of jahreSet) {
      const feiertage = await this._ladeFeiertage(jahr);
      feiertage.forEach(f => alleFeiertage.add(f));
    }
    
    // Berechne Urlaubstage
    let urlaubstage = 0;
    const checkDate = new Date(von);
    
    while (checkDate <= bis) {
      const datumStr = this._formatDatumISO(checkDate);
      
      // Prüfe ob Feiertag (der auf einen Arbeitstag fällt)
      if (alleFeiertage.has(datumStr)) {
        const urlaubswert = this._berechneUrlaubstageWert(datumStr, arbeitszeitmodell);
        if (urlaubswert > 0) {
          checkDate.setDate(checkDate.getDate() + 1);
          continue;
        }
      }
      
      // Berechne Urlaubswert für diesen Tag
      const urlaubswert = this._berechneUrlaubstageWert(datumStr, arbeitszeitmodell);
      urlaubstage += urlaubswert;
      
      checkDate.setDate(checkDate.getDate() + 1);
    }
    
    return urlaubstage;
  }

  _berechneUrlaubstageWert(datum, arbeitszeitmodell) {
    const date = new Date(datum + 'T00:00:00');
    const wochentag = date.getDay();
    const wochentagIndex = wochentag === 0 ? 6 : wochentag - 1;
    
    if (!arbeitszeitmodell || arbeitszeitmodell.length === 0) {
      return wochentagIndex < 5 ? 1.0 : 0;
    }
    
    const tagModell = arbeitszeitmodell.find(m => m.wochentag === wochentagIndex);
    
    if (!tagModell) {
      return wochentagIndex < 5 ? 1.0 : 0;
    }
    
    switch (tagModell.arbeitszeit) {
      case 'VOLL':
        return 1.0;
      case 'HALB':
        return 1.0;
      case 'FREI':
        return 0;
      default:
        return 1.0;
    }
  }

  async _ladeFeiertage(jahr) {
    try {
      const result = await this.dataManager.db.query(`
        SELECT datum FROM feiertage 
        WHERE strftime('%Y', datum) = ?
      `, [jahr.toString()]);
      
      if (!result.success) {
        return new Set();
      }
      
      return new Set(result.data.map(f => f.datum));
    } catch (error) {
      console.error('Fehler beim Laden der Feiertage:', error);
      return new Set();
    }
  }

  _formatDatumISO(date) {
    const jahr = date.getFullYear();
    const monat = String(date.getMonth() + 1).padStart(2, '0');
    const tag = String(date.getDate()).padStart(2, '0');
    return `${jahr}-${monat}-${tag}`;
  }

  _formatDatumAnzeige(datumStr) {
    if (!datumStr) return '-';
    const [jahr, monat, tag] = datumStr.split('-').map(Number);
    return `${String(tag).padStart(2, '0')}.${String(monat).padStart(2, '0')}.${jahr}`;
  }

  async _berechneEndDatumNachUrlaubstagen(vonDatum, urlaubstage, mitarbeiterId) {
    const von = new Date(vonDatum + 'T00:00:00');
    let verbleibendeUrlaubstage = urlaubstage;
    const current = new Date(von);
    
    const arbeitszeitmodell = await this.dataManager.getArbeitszeitmodell(mitarbeiterId);
    const maxJahr = von.getFullYear() + 1;
    
    const alleFeiertage = new Set();
    for (let jahr = von.getFullYear(); jahr <= maxJahr; jahr++) {
      const feiertage = await this._ladeFeiertage(jahr);
      feiertage.forEach(f => alleFeiertage.add(f));
    }
    
    while (verbleibendeUrlaubstage > 0) {
      const datumStr = this._formatDatumISO(current);
      
      if (alleFeiertage.has(datumStr)) {
        const urlaubswert = this._berechneUrlaubstageWert(datumStr, arbeitszeitmodell);
        if (urlaubswert > 0) {
          current.setDate(current.getDate() + 1);
          continue;
        }
      }
      
      const urlaubswert = this._berechneUrlaubstageWert(datumStr, arbeitszeitmodell);
      
      if (urlaubswert > 0) {
        verbleibendeUrlaubstage -= urlaubswert;
      }
      
      if (verbleibendeUrlaubstage > 0) {
        current.setDate(current.getDate() + 1);
      }
    }
    
    return this._formatDatumISO(current);
  }

  /**
   * Initialisiert Event-Listener für Urlaub-Dialog
   * FIX: Halbe Tage werden jetzt korrekt behandelt
   */
  async _initUrlaubEventListener(mitarbeiterId, restUrlaub) {
    const vonDatumInput = document.getElementById('vonDatum');
    const bisDatumInput = document.getElementById('bisDatum');
    const dauerAnzeige = document.getElementById('dauerAnzeige');
    const feiertagsHinweiseDiv = document.getElementById('feiertagsHinweise');
    const kollegenHinweiseDiv = document.getElementById('kollegenHinweise');
    const veranstaltungsHinweiseDiv = document.getElementById('veranstaltungsHinweise');
    const urlaubWarnung = document.getElementById('urlaubWarnung');
    const arbeitszeitInfo = document.getElementById('arbeitszeitInfo');
    const arbeitszeitInfoText = document.getElementById('arbeitszeitInfoText');
    const btnSpeichern = document.getElementById('btnSpeichern');

    if (!vonDatumInput || !bisDatumInput || !dauerAnzeige) {
      console.warn('Urlaub-Dialog Elemente nicht gefunden');
      return;
    }

    const pruefeUrlaubGrenze = (tage) => {
      if (tage > restUrlaub) {
        if (urlaubWarnung) urlaubWarnung.classList.remove('d-none');
        if (btnSpeichern) {
          btnSpeichern.disabled = true;
          btnSpeichern.classList.add('btn-secondary');
          btnSpeichern.classList.remove('btn-success');
        }
        if (dauerAnzeige) {
          dauerAnzeige.classList.remove('text-success');
          dauerAnzeige.classList.add('text-danger');
        }
      } else {
        if (urlaubWarnung) urlaubWarnung.classList.add('d-none');
        if (btnSpeichern) {
          btnSpeichern.disabled = false;
          btnSpeichern.classList.remove('btn-secondary');
          btnSpeichern.classList.add('btn-success');
        }
        if (dauerAnzeige) {
          dauerAnzeige.classList.add('text-success');
          dauerAnzeige.classList.remove('text-danger');
        }
      }
    };

    const aktualisiereHinweise = async () => {
      const von = vonDatumInput.value;
      const bis = bisDatumInput.value;
      
      if (!von || !bis) return;

      if (new Date(bis) < new Date(von)) {
        bisDatumInput.value = von;
        dauerAnzeige.textContent = '1';
        if (feiertagsHinweiseDiv) feiertagsHinweiseDiv.innerHTML = '';
        pruefeUrlaubGrenze(1);
        return;
      }
      
      try {
        // Berechne Urlaubstage MIT Arbeitszeitmodell
        const urlaubstage = await this._berechneUrlaubstage(von, bis, mitarbeiterId);
        dauerAnzeige.textContent = urlaubstage;
        
        const vonDate = new Date(von + 'T00:00:00');
        const bisDate = new Date(bis + 'T00:00:00');
        const kalenderTage = Math.ceil((bisDate - vonDate) / (1000 * 60 * 60 * 24)) + 1;
        
        if (urlaubstage >= 1 && urlaubstage < kalenderTage) {
          if (arbeitszeitInfo && arbeitszeitInfoText) {
            arbeitszeitInfo.classList.remove('d-none');
            const freieTage = kalenderTage - urlaubstage;
            arbeitszeitInfoText.textContent = `Ihr Arbeitszeitmodell wurde berücksichtigt: ${freieTage} freie Tag(e) werden nicht als Urlaub gezählt.`;
          }
        } else {
          if (arbeitszeitInfo) arbeitszeitInfo.classList.add('d-none');
        }
        
        pruefeUrlaubGrenze(urlaubstage);

        if (feiertagsHinweiseDiv) {
          const feiertage = await getFeiertageImZeitraum(von, bis);
          feiertagsHinweiseDiv.innerHTML = this.erstelleFeiertagsHinweisHTML(feiertage);
        }

        if (veranstaltungsHinweiseDiv) {
          const veranstaltungen = await this.pruefeVeranstaltungen(von, bis);
          veranstaltungsHinweiseDiv.innerHTML = this.erstelleVeranstaltungsHinweisHTML(veranstaltungen);
        }

        if (kollegenHinweiseDiv) {
          const abwesenheiten = await this.pruefeKollegenAbwesenheiten(mitarbeiterId, von, bis, 'urlaub');
          kollegenHinweiseDiv.innerHTML = this.erstelleKollegenHinweisHTML(abwesenheiten);
        }
      } catch (error) {
        console.error('Fehler beim Aktualisieren der Hinweise:', error);
        if (feiertagsHinweiseDiv) {
          feiertagsHinweiseDiv.innerHTML = `
            <div class="alert alert-danger">
              <i class="bi bi-exclamation-triangle"></i>
              <strong>Fehler:</strong> ${error.message}
            </div>
          `;
        }
        if (btnSpeichern) {
          btnSpeichern.disabled = true;
          btnSpeichern.classList.add('btn-secondary');
          btnSpeichern.classList.remove('btn-success');
        }
      }
    };

    vonDatumInput.addEventListener('change', async () => {
      bisDatumInput.min = vonDatumInput.value;
      
      if (bisDatumInput.value && bisDatumInput.value < vonDatumInput.value) {
        bisDatumInput.value = vonDatumInput.value;
      }
      
      await aktualisiereHinweise();
    });

    bisDatumInput.addEventListener('change', aktualisiereHinweise);

    bisDatumInput.min = vonDatumInput.value;

    await aktualisiereHinweise();

    const mitarbeiter = await this.dataManager.getMitarbeiter(mitarbeiterId);
    if (mitarbeiter && mitarbeiter.austrittsdatum) {
      const austritt = new Date(mitarbeiter.austrittsdatum + 'T00:00:00');
      const heute = new Date();
      heute.setHours(0, 0, 0, 0);
      
      const sechsMonate = new Date(heute);
      sechsMonate.setMonth(sechsMonate.getMonth() + 6);
      
      if (austritt <= sechsMonate && austritt >= heute) {
        const austrittFormatiert = this._formatDatumAnzeige(mitarbeiter.austrittsdatum);
        const warningDiv = document.getElementById('austrittsWarnung');
        
        if (warningDiv) {
          warningDiv.innerHTML = `
            <div class="alert alert-warning">
              <i class="bi bi-exclamation-triangle"></i>
              <strong>Hinweis:</strong> Mitarbeiter tritt am <strong>${austrittFormatiert}</strong> aus. 
              Urlaub kann nur bis zu diesem Datum eingetragen werden.
            </div>
          `;
        }
      }
    }

    // FIX: Dauer-Buttons - mit korrekter Behandlung für halbe Tage
    document.querySelectorAll('.dauer-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tage = parseFloat(btn.dataset.tage);
        const von = vonDatumInput.value;
        
        if (!von) return;

        try {
          // FIX: SPEZIALFALL für halben Tag - setze Bis-Datum = Von-Datum und Anzeige = 0.5
          if (tage === 0.5) {
            bisDatumInput.value = von;
            dauerAnzeige.textContent = '0.5'; // FIX: Zeige 0.5 Tage an
            
            pruefeUrlaubGrenze(0.5);
            
            if (feiertagsHinweiseDiv) feiertagsHinweiseDiv.innerHTML = '';
            if (arbeitszeitInfo) arbeitszeitInfo.classList.add('d-none');
            
            if (kollegenHinweiseDiv) {
              const abwesenheiten = await this.pruefeKollegenAbwesenheiten(
                mitarbeiterId, 
                von, 
                von, 
                'urlaub'
              );
              kollegenHinweiseDiv.innerHTML = this.erstelleKollegenHinweisHTML(abwesenheiten);
            }
            
            return;
          }
          
          // Normaler Fall: Ganze Tage
          const bis = await this._berechneEndDatumNachUrlaubstagen(von, tage, mitarbeiterId);
          bisDatumInput.value = bis;
          
          await aktualisiereHinweise();
        } catch (error) {
          console.error('Fehler bei Dauer-Button:', error);
          showNotification('Fehler', error.message, 'danger');
        }
      });
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UrlaubDialog;
}