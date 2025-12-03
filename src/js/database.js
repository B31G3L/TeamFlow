/**
 * Teamplanner Database Layer (Renderer)
 * IPC Wrapper für Datenbank-Kommunikation mit Main Process
 * 
 * FIXES:
 * - Verbesserte Fehlerbehandlung
 * - Konsistente Rückgabewerte
 */

class TeamplannerDatabase {
  constructor() {
    if (!window.electronAPI || !window.electronAPI.db) {
      throw new Error('Electron API nicht verfügbar! Stelle sicher, dass preload.js geladen wurde.');
    }

    this.api = window.electronAPI.db;
    console.log('✅ Database Wrapper initialisiert');
  }

  /**
   * Führt Query aus und gibt alle Ergebnisse zurück
   * FIX: Gibt immer ein konsistentes Objekt zurück
   */
  async query(sql, params = []) {
    try {
      const result = await this.api.query(sql, params);
      if (!result.success) {
        console.error('DB Query Error:', result.error, { sql, params });
        return { success: false, error: result.error, data: [] };
      }
      return { success: true, data: result.data || [] };
    } catch (error) {
      console.error('DB Query Exception:', error, { sql, params });
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Führt Query aus und gibt erstes Ergebnis zurück
   * FIX: Gibt immer ein konsistentes Objekt zurück
   */
  async get(sql, params = []) {
    try {
      const result = await this.api.get(sql, params);
      if (!result.success) {
        console.error('DB Get Error:', result.error, { sql, params });
        return { success: false, error: result.error, data: null };
      }
      return { success: true, data: result.data || null };
    } catch (error) {
      console.error('DB Get Exception:', error, { sql, params });
      return { success: false, error: error.message, data: null };
    }
  }

  /**
   * Führt INSERT/UPDATE/DELETE aus
   * FIX: Gibt immer ein konsistentes Objekt zurück mit changes-Info
   */
  async run(sql, params = []) {
    try {
      const result = await this.api.run(sql, params);
      if (!result.success) {
        console.error('DB Run Error:', result.error, { sql, params });
        return { success: false, error: result.error, data: null };
      }
      return { 
        success: true, 
        data: result.data || { changes: 0, lastInsertRowid: null }
      };
    } catch (error) {
      console.error('DB Run Exception:', error, { sql, params });
      return { success: false, error: error.message, data: null };
    }
  }

  /**
   * Führt mehrere SQL-Statements aus (kein Prepared Statement)
   * FIX: Verbesserte Fehlerbehandlung
   */
  async exec(sql) {
    try {
      const result = await this.api.exec(sql);
      if (!result.success) {
        console.error('DB Exec Error:', result.error, { sql });
        return { success: false, error: result.error };
      }
      return { success: true };
    } catch (error) {
      console.error('DB Exec Exception:', error, { sql });
      return { success: false, error: error.message };
    }
  }

  /**
   * Gibt Datenbank-Informationen zurück
   * FIX: Robustere Fehlerbehandlung
   */
  async getDatabaseInfo() {
    const tables = {};
    const tableNames = ['mitarbeiter', 'abteilungen', 'urlaub', 'krankheit', 'schulung', 'ueberstunden', 'feiertage', 'veranstaltungen'];

    for (const tableName of tableNames) {
      try {
        const result = await this.get(`SELECT COUNT(*) as count FROM ${tableName}`);
        tables[tableName] = result.success && result.data ? result.data.count : 0;
      } catch (error) {
        tables[tableName] = 0;
      }
    }

    return {
      path: 'userData/teamplanner_v3.db',
      tables
    };
  }
}

// Export für ES6 Module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TeamplannerDatabase;
}
