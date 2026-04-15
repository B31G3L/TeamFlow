/**
 * Urlaub-Dialog
 *
 * AUFGERÄUMT:
 * - _berechneUrlaubstage(), _berechneUrlaubstageWert(), _ladeFeiertage(),
 *   _berechneEndDatumNachUrlaubstagen() waren Duplikate der identischen
 *   Funktionen in dialog-base.js. Alle entfernt; die Klasse nutzt jetzt
 *   direkt berechneUrlaubstageAsync() und berechneEndDatumNachUrlaubstagenAsync()
 *   aus dialog-base.js.
 */

class UrlaubDialog extends DialogBase {

  async zeigeUrlaubDialog(mitarbeiterId, callback) {
    const heute     = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];

    const statistik  = await this.dataManager.getMitarbeiterStatistik(mitarbeiterId);
    const restUrlaub = statistik ? statistik.urlaub_rest : 0;

    const modalHtml = `
      <div class="modal fade" id="urlaubModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-success text-white">
              <h5 class="modal-title"><i class="bi bi-calendar-plus"></i> Urlaub eintragen</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="alert ${restUrlaub > 5 ? 'alert-success' : restUrlaub > 0 ? 'alert-warning' : 'alert-danger'} mb-3">
                <div class="d-flex justify-content-between align-items-center">
                  <span><i class="bi bi-calendar-check"></i> <strong>Verfügbarer Resturlaub:</strong></span>
                  <span class="fs-5 fw-bold" id="restUrlaubAnzeige">${formatZahl(restUrlaub)} Tage</span>
                </div>
              </div>
              <div id="austrittsWarnung"></div>
              <form id="urlaubForm">
                <div class="row">
                  <div class="col-md-6 mb-3"><label class="form-label">Von *</label><input type="date" class="form-control" id="vonDatum" value="${formatDate(heute)}" required></div>
                  <div class="col-md-6 mb-3"><label class="form-label">Bis *</label><input type="date" class="form-control" id="bisDatum" value="${formatDate(heute)}" required></div>
                </div>
                <div class="mb-3">
                  <div class="d-flex justify-content-between align-items-center">
                    <label class="form-label mb-0">Urlaubstage: <span id="dauerAnzeige" class="fw-bold text-success">1</span></label>
                    <small class="text-muted">(inkl. Arbeitszeitmodell, ohne Wochenenden & Feiertage)</small>
                  </div>
                  <div id="urlaubWarnung" class="alert alert-danger mt-2 d-none">
                    <i class="bi bi-exclamation-triangle"></i> <strong>Achtung:</strong> Übersteigt den verfügbaren Resturlaub!
                  </div>
                  <div id="arbeitszeitInfo" class="alert alert-info mt-2 d-none">
                    <i class="bi bi-info-circle"></i> <small id="arbeitszeitInfoText"></small>
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
                <div id="feiertagsHinweise"></div>
                <div id="veranstaltungsHinweise"></div>
                <div id="kollegenHinweise"></div>
                <div class="mb-3">
                  <label class="form-label">Notizen</label>
                  <textarea class="form-control" id="notiz" rows="2" placeholder="Optionale Notizen..."></textarea>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
              <button type="button" class="btn btn-success" id="btnSpeichern"><i class="bi bi-check-lg"></i> Speichern</button>
            </div>
          </div>
        </div>
      </div>`;

    await this.showModal(modalHtml, async () => {
      const form = document.getElementById('urlaubForm');
      if (!form.checkValidity()) { form.reportValidity(); return false; }

      const vonDatum = document.getElementById('vonDatum').value;
      const bisDatum = document.getElementById('bisDatum').value;
      const tage     = parseFloat(document.getElementById('dauerAnzeige').textContent);

      if (isNaN(tage) || tage <= 0) { showNotification('Fehler', 'Ungültige Anzahl Urlaubstage', 'danger'); return false; }
      if (tage > restUrlaub) { showNotification('Fehler', `Nicht genügend Resturlaub! Verfügbar: ${formatZahl(restUrlaub)} Tage`, 'danger'); return false; }

      try {
        await this.dataManager.speichereEintrag({
          typ: 'urlaub', mitarbeiter_id: mitarbeiterId,
          datum: vonDatum, bis_datum: bisDatum, wert: tage,
          beschreibung: document.getElementById('notiz').value || null,
        });
        showNotification('Erfolg', 'Urlaub wurde eingetragen', 'success');
        if (callback) await callback();
        return true;
      } catch (error) {
        showNotification('Fehler', error.message, 'danger');
        return false;
      }
    });

    await this._initUrlaubEventListener(mitarbeiterId, restUrlaub);
  }

  // ── Event-Listener ──────────────────────────────────────────────────────────
  async _initUrlaubEventListener(mitarbeiterId, restUrlaub) {
    const vonEl          = document.getElementById('vonDatum');
    const bisEl          = document.getElementById('bisDatum');
    const dauerEl        = document.getElementById('dauerAnzeige');
    const warnEl         = document.getElementById('urlaubWarnung');
    const azInfoEl       = document.getElementById('arbeitszeitInfo');
    const azInfoTextEl   = document.getElementById('arbeitszeitInfoText');
    const feiertagsEl    = document.getElementById('feiertagsHinweise');
    const veranstEl      = document.getElementById('veranstaltungsHinweise');
    const kollegenEl     = document.getElementById('kollegenHinweise');
    const btnSpeichern   = document.getElementById('btnSpeichern');

    if (!vonEl || !bisEl || !dauerEl) return;

    const setGrenzeUI = (tage) => {
      const ueber = tage > restUrlaub;
      warnEl?.classList.toggle('d-none', !ueber);
      if (btnSpeichern) {
        btnSpeichern.disabled = ueber;
        btnSpeichern.classList.toggle('btn-secondary', ueber);
        btnSpeichern.classList.toggle('btn-success', !ueber);
      }
      dauerEl.classList.toggle('text-success', !ueber);
      dauerEl.classList.toggle('text-danger', ueber);
    };

    const aktualisiere = async () => {
      const von = vonEl.value, bis = bisEl.value;
      if (!von || !bis || bis < von) { bisEl.value = von; dauerEl.textContent = '1'; setGrenzeUI(1); return; }

      try {
        // AUFGERÄUMT: berechneUrlaubstageAsync() aus dialog-base.js statt
        // eigener privater Kopie _berechneUrlaubstage()
        const tage = await berechneUrlaubstageAsync(von, bis, mitarbeiterId);
        dauerEl.textContent = tage;
        setGrenzeUI(tage);

        const kalTage = Math.ceil((new Date(bis + 'T00:00:00') - new Date(von + 'T00:00:00')) / 86400000) + 1;
        if (azInfoEl && azInfoTextEl) {
          const freieTage = kalTage - tage;
          const zeige = tage >= 1 && freieTage > 0;
          azInfoEl.classList.toggle('d-none', !zeige);
          if (zeige) azInfoTextEl.textContent = `Arbeitszeitmodell berücksichtigt: ${freieTage} freie Tag(e) werden nicht als Urlaub gezählt.`;
        }

        if (feiertagsEl) feiertagsEl.innerHTML = this.erstelleFeiertagsHinweisHTML(await getFeiertageImZeitraum(von, bis));
        if (veranstEl)   veranstEl.innerHTML   = this.erstelleVeranstaltungsHinweisHTML(await this.pruefeVeranstaltungen(von, bis));
        if (kollegenEl)  kollegenEl.innerHTML  = this.erstelleKollegenHinweisHTML(await this.pruefeKollegenAbwesenheiten(mitarbeiterId, von, bis));

      } catch (error) {
        if (feiertagsEl) feiertagsEl.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> <strong>Fehler:</strong> ${error.message}</div>`;
        if (btnSpeichern) { btnSpeichern.disabled = true; btnSpeichern.classList.replace('btn-success', 'btn-secondary'); }
      }
    };

    vonEl.addEventListener('change', async () => {
      bisEl.min = vonEl.value;
      if (bisEl.value < vonEl.value) bisEl.value = vonEl.value;
      await aktualisiere();
    });
    bisEl.addEventListener('change', aktualisiere);
    bisEl.min = vonEl.value;
    await aktualisiere();

    // Austrittsdatum-Warnung
    const ma = await this.dataManager.getMitarbeiter(mitarbeiterId);
    if (ma?.austrittsdatum) {
      const austritt    = new Date(ma.austrittsdatum + 'T00:00:00');
      const heute       = new Date(); heute.setHours(0,0,0,0);
      const sechsMonate = new Date(heute); sechsMonate.setMonth(sechsMonate.getMonth() + 6);
      if (austritt >= heute && austritt <= sechsMonate) {
        const warningDiv = document.getElementById('austrittsWarnung');
        if (warningDiv) warningDiv.innerHTML = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle"></i> <strong>Hinweis:</strong> Mitarbeiter tritt am <strong>${formatDatumAnzeige(ma.austrittsdatum)}</strong> aus.</div>`;
      }
    }

    // Schnellauswahl-Buttons
    document.querySelectorAll('.dauer-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tage = parseFloat(btn.dataset.tage);
        const von  = vonEl.value;
        if (!von) return;
        try {
          if (tage === 0.5) {
            bisEl.value = von;
            dauerEl.textContent = '0.5';
            setGrenzeUI(0.5);
            if (feiertagsEl) feiertagsEl.innerHTML = '';
            if (azInfoEl) azInfoEl.classList.add('d-none');
            if (kollegenEl) kollegenEl.innerHTML = this.erstelleKollegenHinweisHTML(await this.pruefeKollegenAbwesenheiten(mitarbeiterId, von, von));
          } else {
            // AUFGERÄUMT: berechneEndDatumNachUrlaubstagenAsync() aus dialog-base.js
            bisEl.value = await berechneEndDatumNachUrlaubstagenAsync(von, tage, mitarbeiterId);
            await aktualisiere();
          }
        } catch (error) {
          showNotification('Fehler', error.message, 'danger');
        }
      });
    });
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = UrlaubDialog;