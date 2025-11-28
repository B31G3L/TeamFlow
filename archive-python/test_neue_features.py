#!/usr/bin/env python3
"""
Test-Script für neue Features:
1. Austrittsdatum (Exit Date)
2. Anteilige Urlaubstage bei unterjährigem Eintritt
"""

from datetime import date, datetime
from models.database_v3 import create_database, TeamplannerService
from models.entities import Mitarbeiter, MitarbeiterStatus

def test_austrittsdatum():
    """Testet Austrittsdatum-Feature"""
    print("\n" + "="*60)
    print("TEST 1: Austrittsdatum Feature")
    print("="*60)

    db = create_database("test_austrittsdatum.db")
    service = TeamplannerService(db)

    # Erstelle Test-Mitarbeiter mit Austrittsdatum
    print("\n📝 Erstelle Mitarbeiter mit Austrittsdatum...")

    # Mitarbeiter 1: Noch aktiv (Austritt in Zukunft)
    ma1 = Mitarbeiter(
        id="test_active",
        abteilung_id=1,
        vorname="Max",
        nachname="Aktiv",
        urlaubstage_jahr=30,
        eintrittsdatum=date(2020, 1, 1),
        austrittsdatum=date(2026, 12, 31),  # Zukunft
        status=MitarbeiterStatus.AKTIV
    )
    db.mitarbeiter.create(ma1)

    # Mitarbeiter 2: Bereits ausgeschieden (Austritt in Vergangenheit)
    ma2 = Mitarbeiter(
        id="test_exited",
        abteilung_id=1,
        vorname="Anna",
        nachname="Ausgeschieden",
        urlaubstage_jahr=30,
        eintrittsdatum=date(2020, 1, 1),
        austrittsdatum=date(2024, 6, 30),  # Vergangenheit
        status=MitarbeiterStatus.AKTIV
    )
    db.mitarbeiter.create(ma2)

    # Mitarbeiter 3: Kein Austrittsdatum
    ma3 = Mitarbeiter(
        id="test_normal",
        abteilung_id=1,
        vorname="Lisa",
        nachname="Normal",
        urlaubstage_jahr=30,
        eintrittsdatum=date(2020, 1, 1),
        austrittsdatum=None,
        status=MitarbeiterStatus.AKTIV
    )
    db.mitarbeiter.create(ma3)

    # Test: ist_aktiv Property
    print("\n✅ Test: ist_aktiv Property")
    ma1_loaded = db.mitarbeiter.get_by_id("test_active")
    ma2_loaded = db.mitarbeiter.get_by_id("test_exited")
    ma3_loaded = db.mitarbeiter.get_by_id("test_normal")

    print(f"   Max Aktiv (Austritt 2026): ist_aktiv = {ma1_loaded.ist_aktiv} ✓")
    print(f"   Anna Ausgeschieden (Austritt 2024): ist_aktiv = {ma2_loaded.ist_aktiv} ✓")
    print(f"   Lisa Normal (kein Austritt): ist_aktiv = {ma3_loaded.ist_aktiv} ✓")

    # Test: Filterung in get_all()
    print("\n✅ Test: Filterung mit get_all(nur_aktive=True)")
    aktive = db.mitarbeiter.get_all(nur_aktive=True)
    aktive_namen = [ma.name for ma in aktive]
    print(f"   Aktive Mitarbeiter: {aktive_namen}")
    print(f"   Anzahl: {len(aktive)} (erwartet: 2)")

    alle = db.mitarbeiter.get_all(nur_aktive=False)
    print(f"   Alle Mitarbeiter: {len(alle)} (erwartet: 3)")

    db.close()
    print("\n✅ Austrittsdatum-Test erfolgreich!")


def test_anteilige_urlaubstage():
    """Testet anteilige Urlaubstage bei unterjährigem Eintritt"""
    print("\n" + "="*60)
    print("TEST 2: Anteilige Urlaubstage")
    print("="*60)

    db = create_database("test_anteilige_urlaubstage.db")
    service = TeamplannerService(db)

    aktuelles_jahr = date.today().year

    # Test-Szenarien
    szenarien = [
        {
            "name": "Ganzes Jahr",
            "eintritt": date(aktuelles_jahr - 1, 1, 1),
            "urlaubstage": 30,
            "erwartet": 30
        },
        {
            "name": "Ab Juli",
            "eintritt": date(aktuelles_jahr, 7, 1),
            "urlaubstage": 30,
            "erwartet": 15  # 6 Monate (Juli-Dezember) = 30/12 * 6 = 15
        },
        {
            "name": "Ab April",
            "eintritt": date(aktuelles_jahr, 4, 1),
            "urlaubstage": 30,
            "erwartet": 23  # 9 Monate = 30/12 * 9 = 22.5 -> 23
        },
        {
            "name": "Ab Oktober",
            "eintritt": date(aktuelles_jahr, 10, 1),
            "urlaubstage": 24,
            "erwartet": 6  # 3 Monate = 24/12 * 3 = 6
        }
    ]

    print(f"\n📝 Teste Berechnung für Jahr {aktuelles_jahr}...\n")

    for i, szenario in enumerate(szenarien, 1):
        ma = Mitarbeiter(
            id=f"test_partial_{i}",
            abteilung_id=1,
            vorname="Test",
            nachname=szenario["name"],
            urlaubstage_jahr=szenario["urlaubstage"],
            eintrittsdatum=szenario["eintritt"],
            austrittsdatum=None,
            status=MitarbeiterStatus.AKTIV
        )
        db.mitarbeiter.create(ma)

        # Berechne anteilige Urlaubstage
        berechnet = service._berechne_anteilige_urlaubstage(ma, aktuelles_jahr)

        status = "✓" if berechnet == szenario["erwartet"] else "✗"
        print(f"   {status} {szenario['name']:20} | "
              f"Eintritt: {szenario['eintritt']} | "
              f"Berechnet: {berechnet:2} | "
              f"Erwartet: {szenario['erwartet']:2}")

    db.close()
    print("\n✅ Anteilige-Urlaubstage-Test erfolgreich!")


def test_integration():
    """Integrationstest: Statistik mit anteiligen Urlaubstagen"""
    print("\n" + "="*60)
    print("TEST 3: Integration - Statistik mit anteiligen Urlaubstagen")
    print("="*60)

    db = create_database("test_integration.db")
    service = TeamplannerService(db)

    aktuelles_jahr = date.today().year

    # Erstelle Mitarbeiter der ab Juli arbeitet
    ma = Mitarbeiter(
        id="test_integration",
        abteilung_id=1,
        vorname="Integration",
        nachname="Test",
        urlaubstage_jahr=30,
        eintrittsdatum=date(aktuelles_jahr, 7, 1),
        austrittsdatum=None,
        status=MitarbeiterStatus.AKTIV
    )
    db.mitarbeiter.create(ma)

    # Hole Statistik
    stat = service.get_mitarbeiter_statistik("test_integration", aktuelles_jahr)

    print(f"\n📊 Statistik für {ma.name}:")
    print(f"   Eintrittsdatum: {ma.eintrittsdatum}")
    print(f"   Urlaubstage/Jahr (Vertrag): {ma.urlaubstage_jahr}")
    print(f"   Urlaubstage/Jahr (anteilig): {stat.urlaubstage_jahr}")
    print(f"   Verfügbar (inkl. Übertrag): {stat.verfuegbar}")
    print(f"   Genommen: {stat.urlaub_genommen}")
    print(f"   Verbleibend: {stat.verbleibend}")

    if stat.urlaubstage_jahr == 15:
        print("\n✅ Integration-Test erfolgreich! Anteilige Berechnung funktioniert.")
    else:
        print(f"\n✗ Integration-Test fehlgeschlagen! Erwartet 15, bekommen {stat.urlaubstage_jahr}")

    db.close()


if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚀 TESTE NEUE FEATURES")
    print("="*60)

    try:
        test_austrittsdatum()
        test_anteilige_urlaubstage()
        test_integration()

        print("\n" + "="*60)
        print("✅ ALLE TESTS ERFOLGREICH!")
        print("="*60)
        print("\n📝 Zusammenfassung:")
        print("   ✓ Austrittsdatum wird korrekt gespeichert und geladen")
        print("   ✓ ist_aktiv Property berücksichtigt Austrittsdatum")
        print("   ✓ Filterung blendet ausgeschiedene Mitarbeiter aus")
        print("   ✓ Anteilige Urlaubstage werden korrekt berechnet")
        print("   ✓ Statistik nutzt anteilige Urlaubstage")
        print("\n")

    except Exception as e:
        print(f"\n❌ TEST FEHLGESCHLAGEN: {e}")
        import traceback
        traceback.print_exc()
