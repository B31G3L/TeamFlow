/**
 * Log-Viewer Komponente
 * Zeigt System-Logs in der UI an
 */

class LogViewer {
  constructor() {
    this.currentLogFile = null;
  }

  /**
   * Zeigt Log-Viewer Modal
   */
  async zeigen() {
    // Hole verfügbare Log-Dateien
    const logFiles = await window.electronAPI.getLogFiles();
    const currentLogPath = await window.electronAPI.getLogPath();

    if (logFiles.length === 0) {
      showNotification('Info', 'Keine Log-Dateien vorhanden', 'info');
      return;
    }

    // Erstelle Datei-Liste
    const fileOptions = logFiles.map((file, index) => {
      const fileName = file.split(/[\\/]/).pop();
      const selected = file === currentLogPath ? 'selected' : '';
      return `<option value="${file}" ${selected}>${fileName}</option>`;
    }).join('');

    const modalHtml = `
      <div class="modal fade" id="logViewerModal" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header bg-dark text-white">
              <h5 class="modal-title">
                <i class="bi bi-file-text"></i> System-Logs
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <!-- Log-Datei Auswahl -->
              <div class="row mb-3">
                <div class="col-md-8">
                  <select class="form-select" id="logFileSelect">
                    ${fileOptions}
                  </select>
                </div>
                <div class="col-md-4 d-flex gap-2">
                  <button class="btn btn-outline-primary" id="btnRefreshLog" title="Aktualisieren">
                    <i class="bi bi-arrow-clockwise"></i> Aktualisieren
                  </button>
                  <button class="btn btn-outline-secondary" id="btnCopyLog" title="In Zwischenablage kopieren">
                    <i class="bi bi-clipboard"></i> Kopieren
                  </button>
                </div>
              </div>

              <!-- Filter -->
              <div class="row mb-3">
                <div class="col-md-6">
                  <input type="text" class="form-control" id="logSearchInput" 
                         placeholder="🔍 Log durchsuchen...">
                </div>
                <div class="col-md-6">
                  <div class="btn-group" role="group">
                    <input type="checkbox" class="btn-check" id="filterInfo" checked>
                    <label class="btn btn-outline-info btn-sm" for="filterInfo">INFO</label>
                    
                    <input type="checkbox" class="btn-check" id="filterWarn" checked>
                    <label class="btn btn-outline-warning btn-sm" for="filterWarn">WARN</label>
                    
                    <input type="checkbox" class="btn-check" id="filterError" checked>
                    <label class="btn btn-outline-danger btn-sm" for="filterError">ERROR</label>
                    
                    <input type="checkbox" class="btn-check" id="filterDebug">
                    <label class="btn btn-outline-secondary btn-sm" for="filterDebug">DEBUG</label>
                    
                    <input type="checkbox" class="btn-check" id="filterSuccess" checked>
                    <label class="btn btn-outline-success btn-sm" for="filterSuccess">SUCCESS</label>
                  </div>
                </div>
              </div>

              <!-- Log-Inhalt -->
              <div class="card bg-dark">
                <div class="card-body p-0">
                  <pre id="logContent" class="bg-dark text-light p-3 mb-0" 
                       style="max-height: 500px; overflow-y: auto; font-family: 'Courier New', monospace; font-size: 0.85rem;">
                    <span class="text-muted">Lade Logs...</span>
                  </pre>
                </div>
              </div>

              <!-- Statistik -->
              <div class="mt-3">
                <small class="text-muted">
                  <span id="logStats">Zeilen: 0</span>
                </small>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Schließen</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Entferne alte Modals
    const oldModals = document.querySelectorAll('#logViewerModal');
    oldModals.forEach(m => {
      const existingModal = bootstrap.Modal.getInstance(m);
      if (existingModal) existingModal.dispose();
      m.remove();
    });

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modalElement = document.querySelector('#logViewerModal');
    const modal = new bootstrap.Modal(modalElement);

    // Lade initiale Log-Datei
    this.currentLogFile = currentLogPath;
    await this.ladeLogDatei(this.currentLogFile);

    // Event-Listener
    this.initEventListeners(modalElement);

    modal.show();

    modalElement.addEventListener('hidden.bs.modal', () => {
      modal.dispose();
      modalElement.remove();
    });
  }

  /**
   * Initialisiert Event-Listener
   */
  initEventListeners(modalElement) {
    // Datei-Auswahl
    modalElement.querySelector('#logFileSelect').addEventListener('change', async (e) => {
      this.currentLogFile = e.target.value;
      await this.ladeLogDatei(this.currentLogFile);
    });

    // Aktualisieren
    modalElement.querySelector('#btnRefreshLog').addEventListener('click', async () => {
      await this.ladeLogDatei(this.currentLogFile);
      showNotification('Aktualisiert', 'Log wurde neu geladen', 'success');
    });

    // Kopieren
    modalElement.querySelector('#btnCopyLog').addEventListener('click', () => {
      const logContent = modalElement.querySelector('#logContent').textContent;
      navigator.clipboard.writeText(logContent).then(() => {
        showNotification('Kopiert', 'Log wurde in die Zwischenablage kopiert', 'success');
      }).catch(err => {
        showNotification('Fehler', 'Kopieren fehlgeschlagen', 'danger');
      });
    });

    // Suche
    modalElement.querySelector('#logSearchInput').addEventListener('input', (e) => {
      this.filterLogs(modalElement);
    });

    // Level-Filter
    ['filterInfo', 'filterWarn', 'filterError', 'filterDebug', 'filterSuccess'].forEach(id => {
      modalElement.querySelector(`#${id}`).addEventListener('change', () => {
        this.filterLogs(modalElement);
      });
    });
  }

  /**
   * Lädt Log-Datei
   */
  async ladeLogDatei(logFile) {
    try {
      const content = await window.electronAPI.readLog(logFile);
      this.displayLog(content);
    } catch (error) {
      console.error('Fehler beim Laden der Log-Datei:', error);
      showNotification('Fehler', 'Log konnte nicht geladen werden', 'danger');
    }
  }

  /**
   * Zeigt Log-Inhalt an
   */
  displayLog(content) {
    const logContent = document.getElementById('logContent');
    if (!logContent) return;

    // Speichere Original-Inhalt
    logContent.dataset.originalContent = content;

    // Formatiere und färbe Log
    const formatted = this.formatLog(content);
    logContent.innerHTML = formatted;

    // Scrolle nach unten
    logContent.scrollTop = logContent.scrollHeight;

    // Update Statistik
    const lines = content.split('\n').filter(l => l.trim()).length;
    const stats = document.getElementById('logStats');
    if (stats) {
      stats.textContent = `Zeilen: ${lines}`;
    }
  }

  /**
   * Formatiert Log mit Syntax-Highlighting
   */
  formatLog(content) {
    return content
      .split('\n')
      .map(line => {
        if (!line.trim()) return '';
        
        // Färbe nach Log-Level
        if (line.includes('[ERROR]')) {
          return `<span class="text-danger">${this.escapeHtml(line)}</span>`;
        } else if (line.includes('[WARN]')) {
          return `<span class="text-warning">${this.escapeHtml(line)}</span>`;
        } else if (line.includes('[SUCCESS]')) {
          return `<span class="text-success">${this.escapeHtml(line)}</span>`;
        } else if (line.includes('[INFO]')) {
          return `<span class="text-info">${this.escapeHtml(line)}</span>`;
        } else if (line.includes('[DEBUG]')) {
          return `<span class="text-muted">${this.escapeHtml(line)}</span>`;
        } else {
          return `<span class="text-light">${this.escapeHtml(line)}</span>`;
        }
      })
      .join('\n');
  }

  /**
   * Filtert Logs basierend auf Suche und Level
   */
  filterLogs(modalElement) {
    const logContent = document.getElementById('logContent');
    const searchInput = modalElement.querySelector('#logSearchInput');
    const originalContent = logContent.dataset.originalContent || '';

    if (!originalContent) return;

    // Hole Filter-Einstellungen
    const searchTerm = searchInput.value.toLowerCase();
    const showInfo = modalElement.querySelector('#filterInfo').checked;
    const showWarn = modalElement.querySelector('#filterWarn').checked;
    const showError = modalElement.querySelector('#filterError').checked;
    const showDebug = modalElement.querySelector('#filterDebug').checked;
    const showSuccess = modalElement.querySelector('#filterSuccess').checked;

    // Filtere Zeilen
    const lines = originalContent.split('\n');
    const filtered = lines.filter(line => {
      // Suche
      if (searchTerm && !line.toLowerCase().includes(searchTerm)) {
        return false;
      }

      // Level-Filter
      if (line.includes('[INFO]') && !showInfo) return false;
      if (line.includes('[WARN]') && !showWarn) return false;
      if (line.includes('[ERROR]') && !showError) return false;
      if (line.includes('[DEBUG]') && !showDebug) return false;
      if (line.includes('[SUCCESS]') && !showSuccess) return false;

      return true;
    });

    // Zeige gefilterte Logs
    const formatted = this.formatLog(filtered.join('\n'));
    logContent.innerHTML = formatted;

    // Update Statistik
    const stats = document.getElementById('logStats');
    if (stats) {
      stats.textContent = `Zeilen: ${filtered.length} / ${lines.length}`;
    }
  }

  /**
   * Escaped HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Global verfügbar machen
if (typeof window !== 'undefined') {
  window.LogViewer = LogViewer;
}