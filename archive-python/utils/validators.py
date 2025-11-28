"""
Input-Validierungs-System für Teamplanner
- Typ-sichere Validierungen
- Wiederverwendbare Validatoren
- Ausführliche Fehlermeldungen
"""

from typing import Optional, Tuple, List, Callable, Any
from datetime import date, datetime, timedelta
import re
from dataclasses import dataclass


@dataclass
class ValidationResult:
    """Ergebnis einer Validierung"""
    is_valid: bool
    error_message: Optional[str] = None
    error_code: Optional[str] = None
    
    def __bool__(self):
        return self.is_valid
    
    @classmethod
    def success(cls):
        return cls(is_valid=True)
    
    @classmethod
    def error(cls, message: str, code: str = "VALIDATION_ERROR"):
        return cls(is_valid=False, error_message=message, error_code=code)


class BaseValidator:
    """Basis-Validator-Klasse"""
    
    def __init__(self, error_message: Optional[str] = None):
        self.error_message = error_message
    
    def validate(self, value: Any) -> ValidationResult:
        """Zu implementieren von Subklassen"""
        raise NotImplementedError
    
    def __call__(self, value: Any) -> ValidationResult:
        return self.validate(value)


# ==================== STRING VALIDATOREN ====================

class NotEmptyValidator(BaseValidator):
    """Prüft ob String nicht leer ist"""
    
    def validate(self, value: str) -> ValidationResult:
        if not value or not value.strip():
            return ValidationResult.error(
                self.error_message or "Dieses Feld darf nicht leer sein",
                "EMPTY_VALUE"
            )
        return ValidationResult.success()


class LengthValidator(BaseValidator):
    """Prüft String-Länge"""
    
    def __init__(self, min_length: Optional[int] = None, 
                 max_length: Optional[int] = None,
                 error_message: Optional[str] = None):
        super().__init__(error_message)
        self.min_length = min_length
        self.max_length = max_length
    
    def validate(self, value: str) -> ValidationResult:
        length = len(value) if value else 0
        
        if self.min_length and length < self.min_length:
            return ValidationResult.error(
                self.error_message or f"Mindestens {self.min_length} Zeichen erforderlich",
                "TOO_SHORT"
            )
        
        if self.max_length and length > self.max_length:
            return ValidationResult.error(
                self.error_message or f"Maximal {self.max_length} Zeichen erlaubt",
                "TOO_LONG"
            )
        
        return ValidationResult.success()


class RegexValidator(BaseValidator):
    """Prüft String gegen Regex"""
    
    def __init__(self, pattern: str, error_message: str):
        super().__init__(error_message)
        self.pattern = re.compile(pattern)
    
    def validate(self, value: str) -> ValidationResult:
        if not self.pattern.match(value):
            return ValidationResult.error(self.error_message, "PATTERN_MISMATCH")
        return ValidationResult.success()


# ==================== NUMERISCHE VALIDATOREN ====================

class RangeValidator(BaseValidator):
    """Prüft ob Zahl in Range ist"""
    
    def __init__(self, min_value: Optional[float] = None,
                 max_value: Optional[float] = None,
                 error_message: Optional[str] = None):
        super().__init__(error_message)
        self.min_value = min_value
        self.max_value = max_value
    
    def validate(self, value: float) -> ValidationResult:
        try:
            num_value = float(value)
        except (ValueError, TypeError):
            return ValidationResult.error("Ungültige Zahl", "INVALID_NUMBER")
        
        if self.min_value is not None and num_value < self.min_value:
            return ValidationResult.error(
                self.error_message or f"Wert muss mindestens {self.min_value} sein",
                "BELOW_MINIMUM"
            )
        
        if self.max_value is not None and num_value > self.max_value:
            return ValidationResult.error(
                self.error_message or f"Wert darf maximal {self.max_value} sein",
                "ABOVE_MAXIMUM"
            )
        
        return ValidationResult.success()


class PositiveNumberValidator(BaseValidator):
    """Prüft ob Zahl positiv ist"""
    
    def validate(self, value: float) -> ValidationResult:
        try:
            num_value = float(value)
        except (ValueError, TypeError):
            return ValidationResult.error("Ungültige Zahl", "INVALID_NUMBER")
        
        if num_value <= 0:
            return ValidationResult.error(
                self.error_message or "Wert muss größer als 0 sein",
                "NOT_POSITIVE"
            )
        
        return ValidationResult.success()


# ==================== DATUM VALIDATOREN ====================

class DateRangeValidator(BaseValidator):
    """Prüft ob Datum in Range ist"""
    
    def __init__(self, min_date: Optional[date] = None,
                 max_date: Optional[date] = None,
                 error_message: Optional[str] = None):
        super().__init__(error_message)
        self.min_date = min_date
        self.max_date = max_date
    
    def validate(self, value: date) -> ValidationResult:
        if not isinstance(value, date):
            return ValidationResult.error("Ungültiges Datum", "INVALID_DATE")
        
        if self.min_date and value < self.min_date:
            return ValidationResult.error(
                self.error_message or f"Datum muss nach {self.min_date.strftime('%d.%m.%Y')} liegen",
                "DATE_TOO_EARLY"
            )
        
        if self.max_date and value > self.max_date:
            return ValidationResult.error(
                self.error_message or f"Datum muss vor {self.max_date.strftime('%d.%m.%Y')} liegen",
                "DATE_TOO_LATE"
            )
        
        return ValidationResult.success()


class FutureDateValidator(BaseValidator):
    """Prüft ob Datum in der Zukunft liegt"""
    
    def __init__(self, max_days_ahead: Optional[int] = None,
                 error_message: Optional[str] = None):
        super().__init__(error_message)
        self.max_days_ahead = max_days_ahead
    
    def validate(self, value: date) -> ValidationResult:
        if not isinstance(value, date):
            return ValidationResult.error("Ungültiges Datum", "INVALID_DATE")
        
        today = date.today()
        
        if value < today:
            return ValidationResult.error(
                self.error_message or "Datum darf nicht in der Vergangenheit liegen",
                "DATE_IN_PAST"
            )
        
        if self.max_days_ahead:
            max_date = today + timedelta(days=self.max_days_ahead)
            if value > max_date:
                return ValidationResult.error(
                    f"Datum darf maximal {self.max_days_ahead} Tage in der Zukunft liegen",
                    "DATE_TOO_FAR_AHEAD"
                )
        
        return ValidationResult.success()


class PastDateValidator(BaseValidator):
    """Prüft ob Datum in der Vergangenheit liegt"""
    
    def __init__(self, max_years_ago: Optional[int] = None,
                 error_message: Optional[str] = None):
        super().__init__(error_message)
        self.max_years_ago = max_years_ago
    
    def validate(self, value: date) -> ValidationResult:
        if not isinstance(value, date):
            return ValidationResult.error("Ungültiges Datum", "INVALID_DATE")
        
        today = date.today()
        
        if value > today:
            return ValidationResult.error(
                self.error_message or "Datum darf nicht in der Zukunft liegen",
                "DATE_IN_FUTURE"
            )
        
        if self.max_years_ago:
            min_date = today.replace(year=today.year - self.max_years_ago)
            if value < min_date:
                return ValidationResult.error(
                    f"Datum darf maximal {self.max_years_ago} Jahre zurückliegen",
                    "DATE_TOO_FAR_PAST"
                )
        
        return ValidationResult.success()


class DateOrderValidator(BaseValidator):
    """Prüft ob von_datum vor bis_datum liegt"""
    
    def validate(self, dates: Tuple[date, date]) -> ValidationResult:
        von_datum, bis_datum = dates
        
        if not isinstance(von_datum, date) or not isinstance(bis_datum, date):
            return ValidationResult.error("Ungültige Datumsangaben", "INVALID_DATE")
        
        if von_datum > bis_datum:
            return ValidationResult.error(
                self.error_message or "Von-Datum muss vor Bis-Datum liegen",
                "INVALID_DATE_ORDER"
            )
        
        return ValidationResult.success()
    
# ==================== BUSINESS LOGIC VALIDATOREN ====================

class UrlaubstageValidator(BaseValidator):
    """Prüft Urlaubstage gegen verfügbares Kontingent"""
    
    def __init__(self, verfuegbare_tage: float):
        super().__init__()
        self.verfuegbare_tage = verfuegbare_tage
    
    def validate(self, beantragte_tage: float) -> ValidationResult:
        try:
            tage = float(beantragte_tage)
        except (ValueError, TypeError):
            return ValidationResult.error("Ungültige Tagesanzahl", "INVALID_NUMBER")
        
        if tage <= 0:
            return ValidationResult.error(
                "Urlaubstage müssen positiv sein",
                "INVALID_DAYS"
            )
        
        if tage > self.verfuegbare_tage:
            return ValidationResult.error(
                f"Nur noch {self.verfuegbare_tage:.1f} Tage verfügbar (beantragt: {tage:.1f})",
                "INSUFFICIENT_DAYS"
            )

        # ✅ FIX: Warnung sollte nicht die Validierung stoppen
        # Die Warnung wird entfernt, da sie den Validierungsprozess blockieren würde
        # Alternativ könnte man ein separates Warning-System implementieren

        return ValidationResult.success()


class WerktageValidator(BaseValidator):
    """Prüft ob Werktage-Anzahl realistisch ist"""
    
    def __init__(self, max_werktage: int = 250):
        super().__init__()
        self.max_werktage = max_werktage
    
    def validate(self, werktage: float) -> ValidationResult:
        try:
            tage = float(werktage)
        except (ValueError, TypeError):
            return ValidationResult.error("Ungültige Tagesanzahl", "INVALID_NUMBER")
        
        if tage < 0:
            return ValidationResult.error(
                "Werktage können nicht negativ sein",
                "NEGATIVE_DAYS"
            )
        
        if tage > self.max_werktage:
            return ValidationResult.error(
                f"Unrealistisch viele Werktage: {tage} (max: {self.max_werktage})",
                "UNREALISTIC_DAYS"
            )
        
        return ValidationResult.success()


class UeberstundenValidator(BaseValidator):
    """Prüft Überstunden-Eingabe"""
    
    def __init__(self, max_stunden_pro_tag: float = 24):
        super().__init__()
        self.max_stunden = max_stunden_pro_tag
    
    def validate(self, stunden: float) -> ValidationResult:
        try:
            std = float(stunden)
        except (ValueError, TypeError):
            return ValidationResult.error("Ungültige Stundenanzahl", "INVALID_NUMBER")
        
        if std < 0:
            return ValidationResult.error(
                "Überstunden können nicht negativ sein",
                "NEGATIVE_HOURS"
            )
        
        if std > self.max_stunden:
            return ValidationResult.error(
                f"Unrealistisch viele Stunden: {std}h (max: {self.max_stunden}h pro Tag)",
                "UNREALISTIC_HOURS"
            )

        # ✅ FIX: Warnung sollte nicht die Validierung stoppen
        # Die Warnung wird entfernt, da sie den Validierungsprozess blockieren würde
        # Alternativ könnte man ein separates Warning-System implementieren

        return ValidationResult.success()


# ==================== COMPOSITE VALIDATOR ====================

class CompositeValidator(BaseValidator):
    """Führt mehrere Validatoren nacheinander aus"""
    
    def __init__(self, *validators: BaseValidator):
        super().__init__()
        self.validators = validators
    
    def validate(self, value: Any) -> ValidationResult:
        for validator in self.validators:
            result = validator.validate(value)
            if not result.is_valid:
                return result
        return ValidationResult.success()


# ==================== MITARBEITER-SPEZIFISCHE VALIDATOREN ====================

class MitarbeiterNameValidator(CompositeValidator):
    """Validiert Mitarbeiter-Namen"""
    
    def __init__(self):
        super().__init__(
            NotEmptyValidator("Name darf nicht leer sein"),
            LengthValidator(min_length=2, max_length=50,
                          error_message="Name muss zwischen 2 und 50 Zeichen lang sein")
        )


class UrlaubstageJahrValidator(CompositeValidator):
    """Validiert jährliche Urlaubstage"""
    
    def __init__(self):
        super().__init__(
            RangeValidator(min_value=0, max_value=50,
                         error_message="Urlaubstage müssen zwischen 0 und 50 liegen")
        )


class GeburtsdatumValidator(CompositeValidator):
    """Validiert Geburtsdatum"""
    
    def __init__(self):
        heute = date.today()
        min_date = heute.replace(year=heute.year - 100)  # Max 100 Jahre alt
        max_date = heute.replace(year=heute.year - 14)   # Min 14 Jahre alt
        
        super().__init__(
            PastDateValidator(max_years_ago=100,
                            error_message="Geburtsdatum liegt zu weit zurück"),
            DateRangeValidator(min_date=min_date, max_date=max_date,
                             error_message="Mitarbeiter muss zwischen 14 und 100 Jahre alt sein")
        )


class EinstellungsdatumValidator(CompositeValidator):
    """Validiert Einstellungsdatum"""
    
    def __init__(self):
        heute = date.today()
        min_date = heute.replace(year=heute.year - 50)  # Max 50 Jahre zurück
        
        super().__init__(
            DateRangeValidator(min_date=min_date, max_date=heute,
                             error_message="Einstellungsdatum muss zwischen vor 50 Jahren und heute liegen")
        )


# ==================== HELPER FUNKTIONEN ====================

def validate_mitarbeiter_daten(daten: dict) -> Tuple[bool, List[str]]:
    """
    Validiert vollständige Mitarbeiter-Daten
    
    Returns:
        (is_valid, error_messages)
    """
    errors = []
    
    # Vorname
    result = MitarbeiterNameValidator().validate(daten.get('vorname', ''))
    if not result:
        errors.append(f"Vorname: {result.error_message}")
    
    # Nachname
    result = MitarbeiterNameValidator().validate(daten.get('nachname', ''))
    if not result:
        errors.append(f"Nachname: {result.error_message}")
    
    # Geburtsdatum
    if 'geburtsdatum' in daten and daten['geburtsdatum']:
        try:
            if isinstance(daten['geburtsdatum'], str):
                geburtsdatum = datetime.strptime(daten['geburtsdatum'], '%Y-%m-%d').date()
            else:
                geburtsdatum = daten['geburtsdatum']
            
            result = GeburtsdatumValidator().validate(geburtsdatum)
            if not result:
                errors.append(f"Geburtsdatum: {result.error_message}")
        except ValueError:
            errors.append("Geburtsdatum: Ungültiges Datumsformat")
    
    # Einstellungsdatum
    if 'einstellungsdatum' in daten and daten['einstellungsdatum']:
        try:
            if isinstance(daten['einstellungsdatum'], str):
                einstellungsdatum = datetime.strptime(daten['einstellungsdatum'], '%Y-%m-%d').date()
            else:
                einstellungsdatum = daten['einstellungsdatum']
            
            result = EinstellungsdatumValidator().validate(einstellungsdatum)
            if not result:
                errors.append(f"Einstellungsdatum: {result.error_message}")
        except ValueError:
            errors.append("Einstellungsdatum: Ungültiges Datumsformat")
    
    # Urlaubstage
    if 'urlaubstage_jahr' in daten:
        result = UrlaubstageJahrValidator().validate(daten['urlaubstage_jahr'])
        if not result:
            errors.append(f"Urlaubstage: {result.error_message}")
    
    return len(errors) == 0, errors


def validate_urlaub_eintrag(von_datum: date, bis_datum: date, 
                            werktage: float, verfuegbare_tage: float) -> Tuple[bool, List[str]]:
    """
    Validiert Urlaubs-Eintrag
    
    Returns:
        (is_valid, error_messages)
    """
    errors = []
    
    # Datumsreihenfolge
    result = DateOrderValidator().validate((von_datum, bis_datum))
    if not result:
        errors.append(result.error_message)

    # ✅ FIX: Alle Fehler vom FutureDateValidator berücksichtigen, nicht nur DATE_TOO_FAR_AHEAD
    # Entfernt die Einschränkung auf einen spezifischen Fehlercode
    result = FutureDateValidator(max_days_ahead=730).validate(von_datum)
    if not result:
        errors.append(result.error_message)
    
    # Werktage
    result = WerktageValidator(max_werktage=250).validate(werktage)
    if not result:
        errors.append(result.error_message)
    
    # Verfügbarkeit
    result = UrlaubstageValidator(verfuegbare_tage).validate(werktage)
    if not result:
        errors.append(result.error_message)
    
    return len(errors) == 0, errors