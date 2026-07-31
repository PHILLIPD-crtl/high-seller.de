#!/usr/bin/env python3
"""Textbausteine der Stadtteilseiten.

Getrennt vom Generator, weil hier der Inhalt entsteht und dort die Mechanik.

WARUM MEHRERE FASSUNGEN JE BAUSTEIN
Der erste Anlauf hatte je Baustein genau eine Formulierung. Ergebnis: bis zu
51,9 % Duplikation zwischen den erzeugten Seiten, gegenüber 6,9 % im Bestand.
Ein fester Satzbau auf 63 Seiten schlägt jede noch so gute Einzelrecherche.

WARUM JE BAUSTEIN EINE ANDERE KENNZAHL
Die Auswahl ist datengesteuert, nicht zufällig — gleiche Eingabe muss gleiche
Ausgabe ergeben, sonst ändert jeder Lauf sämtliche Seiten ohne fachlichen
Grund. Entscheidend ist aber, dass jeder Baustein eine ANDERE Kennzahl als
Grundlage nimmt. Sonst wählen zwei Stadtteile mit ähnlicher Einwohnerzahl
überall dieselbe Fassung und die Seiten gleichen sich wieder an.
"""


def zahl(wert, nachkomma=0):
    s = f"{wert:,.{nachkomma}f}"
    return s.replace(",", "#").replace(".", ",").replace("#", ".")


def waehle(varianten, kennzahl):
    return varianten[int(kennzahl) % len(varianten)]


# --- Einleitung nach der H1 -------------------------------------------------
# Auswahl über die Einwohnerzahl.
def einleitung(s):
    if s.wv:
        varianten = [
            f"In {s.anzeige} wurden 2025 {zahl(s.wv['faelle'])} Eigentumswohnungen "
            f"notariell verkauft. Diese Verträge sind die Grundlage, auf der wir Ihre "
            f"Immobilie einschätzen — nicht Angebotspreise aus Portalen.",

            f"Wer in {s.anzeige} verkaufen will, will wissen, was hier tatsächlich "
            f"gezahlt wird. {zahl(s.wv['faelle'])} beurkundete Kaufverträge aus dem Jahr "
            f"2025 geben darauf eine belastbare Antwort.",

            f"{s.anzeige} hat einen eigenen Markt mit eigenen Preisen. Was das für Ihre "
            f"Immobilie bedeutet, lässt sich aus {zahl(s.wv['faelle'])} notariellen "
            f"Kaufverträgen des Jahres 2025 ableiten.",

            f"Der Immobilienmarkt in {s.anzeige} lässt sich beziffern: "
            f"{zahl(s.wv['faelle'])} beurkundete Wohnungsverkäufe im Jahr 2025, dazu "
            f"amtliche Bodenrichtwerte zum Stichtag 1. Januar 2026.",

            f"Für {s.anzeige} liegen belastbare Zahlen vor — {zahl(s.wv['faelle'])} "
            f"notarielle Kaufverträge aus 2025. Damit beginnt jede seriöse Bewertung, "
            f"nicht mit einer Schätzung über den Daumen.",
        ]
    else:
        varianten = [
            f"{s.anzeige} ist zu klein, als dass der Gutachterausschuss eigene "
            f"Wohnungspreise ausweisen könnte. Für die Bewertung zählen hier die "
            f"Bodenrichtwerte und Vergleichsobjekte der Nachbarschaft.",

            f"In {s.anzeige} wechseln wenige Objekte im Jahr den Eigentümer. Das macht "
            f"die Einschätzung nicht schwieriger, aber sie stützt sich auf andere "
            f"Quellen als in den großen Veedeln.",

            f"{s.anzeige} gehört zu den kleineren Kölner Stadtteilen. Wer hier verkauft, "
            f"trifft auf wenig Vergleichsangebot — was den richtigen Preis wichtiger "
            f"macht, nicht unwichtiger.",
        ]
    return waehle(varianten, s.einwohner)


# --- Erster Absatz "Lage & Markt" -------------------------------------------
# Auswahl über die Wohnungszahl.
def einordnung(s):
    varianten = [
        f"{s.anzeige} gehört zum Stadtbezirk {s.bezirk}. Hier leben "
        f"{zahl(s.einwohner)} Menschen in {zahl(s.wohnungen)} Wohnungen.",

        f"Der Stadtteil liegt im Bezirk {s.bezirk} und zählt {zahl(s.einwohner)} "
        f"Einwohner. Der Wohnungsbestand umfasst {zahl(s.wohnungen)} Einheiten.",

        f"Mit {zahl(s.einwohner)} Einwohnern und {zahl(s.wohnungen)} Wohnungen ist "
        f"{s.anzeige} Teil des Stadtbezirks {s.bezirk}.",

        f"{zahl(s.wohnungen)} Wohnungen, {zahl(s.einwohner)} Einwohner, Stadtbezirk "
        f"{s.bezirk} — das ist der Rahmen, in dem sich der Markt hier bewegt.",

        f"Im Bezirk {s.bezirk} gelegen, bietet {s.anzeige} {zahl(s.wohnungen)} "
        f"Wohnungen für {zahl(s.einwohner)} Einwohner.",
    ]
    return waehle(varianten, s.wohnungen)


# --- Absatz zum Preisniveau -------------------------------------------------
# Auswahl über den Kaufpreis. Die Schwellen bestimmen zusaetzlich den Tonfall,
# damit ein teurer und ein guenstiger Stadtteil nicht denselben Satz bekommen.
def preisniveau(s):
    if not s.wv:
        return ""
    p, n = s.wv["eurProM2"], s.wv["faelle"]
    if p >= 5200:
        varianten = [
            f"Das Preisniveau ist gehoben: {zahl(p)} € je m² Wohnfläche im Weiterverkauf, "
            f"ermittelt aus {zahl(n)} Kaufverträgen.",
            f"Mit {zahl(p)} € je m² zählt {s.anzeige} zu den teureren Lagen der Stadt "
            f"({zahl(n)} ausgewertete Verträge).",
            f"Verkäufer profitieren hier von einem hohen Niveau — {zahl(p)} € je m² "
            f"Wohnfläche im Bestand, gemessen an {zahl(n)} Beurkundungen.",
        ]
    elif p <= 3300:
        varianten = [
            f"Mit {zahl(p)} € je m² Wohnfläche liegt {s.anzeige} im günstigeren Drittel "
            f"der Stadt. Für Käufer ein Einstieg, für Eigentümer ein Markt mit Bewegung.",
            f"Das Niveau ist mit {zahl(p)} € je m² moderat. Gerade deshalb zieht "
            f"{s.anzeige} Käufer an, denen die zentralen Veedel zu teuer geworden sind.",
            f"{zahl(p)} € je m² Wohnfläche im Weiterverkauf: ein Wert, der {s.anzeige} "
            f"für Kapitalanleger interessant macht ({zahl(n)} Verträge).",
        ]
    else:
        varianten = [
            f"Der Weiterverkauf liegt bei {zahl(p)} € je m² Wohnfläche, ermittelt aus "
            f"{zahl(n)} notariellen Kaufverträgen des Jahres 2025.",
            f"Im mittleren Preissegment: {zahl(p)} € je m² Wohnfläche, belegt durch "
            f"{zahl(n)} Beurkundungen.",
            f"{zahl(p)} € je m² Wohnfläche ist der beurkundete Mittelwert im Bestand — "
            f"weder Spitzenlage noch Schnäppchenmarkt.",
        ]
    return waehle(varianten, p)


# --- Absatz unter "Der Immobilienmarkt in X" --------------------------------
# Auswahl über den Bodenrichtwert-Median.
def markt(s):
    if not s.wv:
        return (f"Der Gutachterausschuss weist für {s.anzeige} keine gesonderten "
                f"Wohnungspreise aus — dafür braucht es mindestens drei auswertbare "
                f"Kaufverträge im Berichtsjahr. Die Bewertung stützt sich hier auf die "
                f"Bodenrichtwerte und auf Vergleichsobjekte der direkten Nachbarschaft.")

    teile = []
    if s.neubau:
        auf = round((s.neubau["eurProM2"] / s.wv["eurProM2"] - 1) * 100)
        varianten = [
            f"Neubauwohnungen erzielten {zahl(s.neubau['eurProM2'])} € je m² und lagen "
            f"damit rund {auf} % über dem Bestand ({zahl(s.neubau['faelle'])} Verträge).",
            f"Der Abstand zum Neubau beträgt rund {auf} %: "
            f"{zahl(s.neubau['eurProM2'])} € je m² bei {zahl(s.neubau['faelle'])} "
            f"beurkundeten Erstverkäufen.",
            f"Wer neu baut oder neu kauft, zahlt hier {zahl(s.neubau['eurProM2'])} € je "
            f"m² — etwa {auf} % mehr als im Bestand.",
        ]
        teile.append(waehle(varianten, s.b["brwMedian"] if s.b else s.neubau["eurProM2"]))

    if s.b:
        spanne = s.b["brw"][1] - s.b["brw"][0]
        if spanne > 400:
            teile.append(
                f"Die Bodenrichtwerte reichen von {zahl(s.b['brw'][0])} bis "
                f"{zahl(s.b['brw'][1])} € je m² über {s.b['brwZonen']} Zonen — eine "
                f"Spanne, die zeigt, wie stark die genaue Lage innerhalb des Stadtteils "
                f"zählt.")
        elif s.b["brwZonen"] == 1:
            teile.append(
                f"Der Bodenrichtwert liegt einheitlich bei {zahl(s.b['brwMedian'])} € je "
                f"m²; amtlich ist {s.anzeige} eine einzige Wohnbauzone.")
        else:
            teile.append(
                f"Die {s.b['brwZonen']} Wohnbauzonen liegen eng beieinander "
                f"({zahl(s.b['brw'][0])} bis {zahl(s.b['brw'][1])} € je m²) — der "
                f"Grundstückswert schwankt im Stadtteil wenig.")

    teile.append("Alle genannten Zahlen sind beurkundete Preise, keine Angebotspreise. "
                 "Das ist der Grund, warum sie als Grundlage taugen.")
    return " ".join(teile)


# --- Wohnungsbestand in Zahlen ----------------------------------------------
# Auswahl über die Haushaltszahl.
def bestand(s, koeln):
    k_ein = koeln["anteilEinpersonen"]["wert"]
    k_kind = koeln["anteilMitKindern"]["wert"]
    k_fl = koeln["wohnflaecheJeWohnung"]["wert"]
    h = s.w["haushalte"]["wert"]

    einstieg = waehle([
        f"{zahl(h)} Haushalte leben in {s.anzeige}, davon {zahl(s.einpersonen)} % allein "
        f"(Köln: {zahl(k_ein)} %) und {zahl(s.mit_kindern)} % mit Kindern "
        f"(Köln: {zahl(k_kind)} %).",

        f"Von den {zahl(h)} Haushalten bestehen {zahl(s.einpersonen)} % aus einer Person, "
        f"{zahl(s.mit_kindern)} % leben mit Kindern. Köln liegt bei {zahl(k_ein)} % "
        f"beziehungsweise {zahl(k_kind)} %.",

        f"Die Haushaltsstruktur: {zahl(s.einpersonen)} % Einpersonenhaushalte gegenüber "
        f"{zahl(k_ein)} % im Stadtmittel, {zahl(s.mit_kindern)} % mit Kindern gegenüber "
        f"{zahl(k_kind)} %. Insgesamt {zahl(h)} Haushalte.",
    ], h)

    if s.flaeche_je_wohnung >= k_fl + 12:
        groesse = waehle([
            f"Mit {zahl(s.flaeche_je_wohnung, 1)} m² je Wohnung liegt der Bestand weit "
            f"über dem Kölner Mittel von {zahl(k_fl, 1)} m² — hier stehen Familien"
            f"wohnungen und Häuser.",
            f"Der Bestand ist großzügig geschnitten: {zahl(s.flaeche_je_wohnung, 1)} m² je "
            f"Wohnung gegenüber {zahl(k_fl, 1)} m² in Köln insgesamt.",
        ], round(s.flaeche_je_wohnung))
    elif s.flaeche_je_wohnung <= k_fl - 8:
        groesse = waehle([
            f"Mit {zahl(s.flaeche_je_wohnung, 1)} m² je Wohnung ist der Bestand "
            f"kleinteiliger als im Kölner Mittel ({zahl(k_fl, 1)} m²).",
            f"Die Wohnungen sind klein: {zahl(s.flaeche_je_wohnung, 1)} m² im Schnitt, "
            f"gut {zahl(k_fl - s.flaeche_je_wohnung, 1)} m² unter dem Stadtwert.",
        ], round(s.flaeche_je_wohnung))
    else:
        groesse = (f"Mit {zahl(s.flaeche_je_wohnung, 1)} m² je Wohnung entspricht der "
                   f"Bestand dem Kölner Mittel von {zahl(k_fl, 1)} m².")

    folgerung = ("Gefragt sind entsprechend gut geschnittene Zwei- und Dreizimmer"
                 "wohnungen." if s.einpersonen > k_ein + 3 else
                 "Familientaugliche Grundrisse ab drei Zimmern finden hier schnell "
                 "Käufer." if s.mit_kindern > k_kind + 2 else
                 "Die Nachfrage verteilt sich breit über die Wohnungsgrößen.")

    text = f"{einstieg} {groesse} {folgerung}"

    if s.gefoerdert >= koeln["anteilGefoerdert"]["wert"] * 1.6:
        text += (f" Der Anteil geförderter Wohnungen liegt bei "
                 f"{zahl(s.gefoerdert, 1)} % und damit klar über dem Stadtwert von "
                 f"{zahl(koeln['anteilGefoerdert']['wert'], 1)} % — bei vermieteten "
                 f"Objekten gehört das in die Bewertung.")
    return text


# --- Leistungsaufzaehlung ---------------------------------------------------
# Auswahl über die Zonenzahl der Bodenrichtwerte.
def leistungen(s):
    erste = waehle([
        f"Bewertung anhand der Vergleichslagen in {s.anzeige}",
        f"Marktwert für {s.anzeige}, hergeleitet aus beurkundeten Verkäufen",
        f"Einschätzung auf Grundlage der amtlichen Werte für {s.anzeige}",
    ], s.b["brwZonen"] if s.b else s.einwohner)

    zweite = waehle([
        "Vermarktung über Portale, Netzwerk und Käuferkartei",
        "Ansprache geprüfter Interessenten aus unserer Kartei",
        "Vermarktung mit Exposé, Portalen und gezielter Käuferansprache",
    ], s.wohnungen)

    dritte = waehle([
        "Käufer auf Finanzierbarkeit geprüft, bevor besichtigt wird",
        "Finanzierungsprüfung der Interessenten vor dem ersten Termin",
        "Nur Interessenten, deren Finanzierung realistisch trägt",
    ], round(s.flaeche_je_wohnung))

    return (f"<li>{erste}</li><li>{zweite}</li><li>{dritte}</li>"
            f"<li>Auch vermietete Objekte und Kapitalanlagen</li>")


# --- Antwort auf die Preisfrage ---------------------------------------------
# Auswahl über die Wohnflaeche je Wohnung.
def preisfrage(s):
    if not s.wv:
        return (f"Für {s.anzeige} weist der Gutachterausschuss zu wenige Kaufverträge "
                f"aus, um einen Mittelwert zu bilden. Aussagekräftig sind hier die "
                f"Bodenrichtwerte und Vergleichsobjekte der direkten Nachbarschaft — "
                f"beides sehen wir uns für Ihr Objekt konkret an.")
    einstieg = waehle([
        f"Der beurkundete Mittelwert im Weiterverkauf liegt bei "
        f"{zahl(s.wv['eurProM2'])} € je m² Wohnfläche.",
        f"{zahl(s.wv['eurProM2'])} € je m² Wohnfläche wurden 2025 im Mittel gezahlt.",
        f"Als Anhaltspunkt: {zahl(s.wv['eurProM2'])} € je m² Wohnfläche im Bestand.",
    ], round(s.flaeche_je_wohnung))

    schluss = waehle([
        "Ein Mittelwert ersetzt keine Bewertung: Zustand, Schnitt, Baujahr und "
        "Vermietung verschieben den Wert im Einzelfall erheblich.",
        "Für Ihr Objekt zählt der Einzelfall — zwei Wohnungen im selben Haus können "
        "sich im Wert deutlich unterscheiden.",
        "Was Ihre Immobilie wert ist, entscheidet sich an Zustand, Lage im Stadtteil "
        "und Schnitt, nicht am Durchschnitt.",
    ], s.einwohner)
    return f"{einstieg} {schluss}"


# --- Abschlussabsatz ueber dem Wertrechner ----------------------------------
# Auswahl über den Anteil der Einpersonenhaushalte.
def abschluss(s):
    lage_erster = s.profil["lage"].split(". ")[0].rstrip(".")
    varianten = [
        f"{lage_erster}. Was Ihre Immobilie in {s.anzeige} wert ist, hängt davon ab, wo "
        f"genau sie steht und in welchem Zustand sie ist.",
        f"{lage_erster}. Für eine erste Einschätzung Ihrer Immobilie in {s.anzeige} "
        f"genügen wenige Angaben — kostenlos und unverbindlich.",
        f"{s.anzeige} im Stadtbezirk {s.bezirk}: {lage_erster}. Den Wert Ihrer Immobilie "
        f"ermitteln wir anhand der Zahlen dieses Stadtteils, nicht anhand eines "
        f"Kölner Mittelwerts.",
    ]
    return waehle(varianten, round(s.einpersonen))


# --- Satz ueber dem Marktabschnitt ------------------------------------------
# Auswahl über das Durchschnittsalter.
def zusammenfassung(s):
    erster = s.profil["bebauung"].split(". ")[0].rstrip(".")
    alter = s.w.get("durchschnittsalter", {}).get("wert", s.einwohner)
    varianten = [
        f"{erster}. Für den Verkauf zählt, was das im Einzelfall bedeutet.",
        f"{erster}. Diese Struktur bestimmt, welche Käufer sich hier umsehen.",
        f"{erster}. Wer hier verkauft, verkauft in genau dieses Umfeld hinein.",
    ]
    return waehle(varianten, round(alter))
