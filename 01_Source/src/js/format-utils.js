/**
 * Formatiert eine Zahl intelligent:
 * - Ganzzahlen ohne Nachkommastellen (5 statt 5.0)
 * - Dezimalzahlen mit genau 2 Nachkommastellen (7.50)
 * 
 * @param {number} zahl - Die zu formatierende Zahl
 * @returns {string} Die formatierte Zahl als String
 */
function formatZahl(zahl) {
  if (zahl === null || zahl === undefined || isNaN(zahl)) {
    return '0';
  }
const num = parseFloat(zahl);
// Prüfe ob Ganzzahl (keine Nachkommastellen oder nur .0)
if (Number.isInteger(num)) {
return num.toString();
}
// Dezimalzahl mit 2 Nachkommastellen
return num.toFixed(2);
}
/**

Formatiert eine Zahl als Währung mit Tausendertrennzeichen

@param {number} betrag - Der zu formatierende Betrag
@returns {string} Formatierter Betrag (z.B. "2.500,00")
*/
function formatWaehrung(betrag) {
if (betrag === null || betrag === undefined || isNaN(betrag)) {
return '0,00';
}

const num = parseFloat(betrag);
// Formatierung mit deutscher Lokalisierung
return new Intl.NumberFormat('de-DE', {
minimumFractionDigits: 2,
maximumFractionDigits: 2
}).format(num);
}
// Beispiele:
// formatZahl(5)     → "5"
// formatZahl(5.0)   → "5"
// formatZahl(5.5)   → "5.50"
// formatZahl(5.75)  → "5.75"
// formatZahl(10.2)  → "10.20"
// formatWaehrung(2500)      → "2.500,00"
// formatWaehrung(2500.50)   → "2.500,50"
// formatWaehrung(45000)     → "45.000,00"