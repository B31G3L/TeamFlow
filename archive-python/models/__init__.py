"""
Teamplanner Models Package - V3
"""

# V3 Imports
from .mitarbeiter import Mitarbeiter, MitarbeiterStatistik
from .data_manager_v3 import TeamplannerDataManager
from .database_v3 import TeamplannerDatabase, TeamplannerService

# V3 Entities
from .entities import (
    Abteilung,
    Urlaub,
    Krankheit,
    Schulung,
    Ueberstunden,
    Feiertag,
    MitarbeiterStatus
)

__all__ = [
    'Mitarbeiter', 
    'MitarbeiterStatistik', 
    'TeamplannerDataManager', 
    'TeamplannerDatabase',
    'TeamplannerService',
    'Abteilung',
    'Urlaub',
    'Krankheit',
    'Schulung',
    'Ueberstunden',
    'Feiertag',
    'MitarbeiterStatus'
]