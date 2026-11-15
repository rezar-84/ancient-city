"""Build research/landmarks.json. Coordinates: OpenStreetMap (Overpass extract in geo/, osm_base 2026-11-15T15:36:51Z),
cross-checked against Wikidata P625 (SPARQL query saved in raw/wikidata_around.json). Footprints measured from OSM
geometry with scripts/measure.py (minimum-area oriented rectangle, long-axis bearing from true north).
Run: python3 -I scripts/build_landmarks.py  (from research/)"""
import json, math

W = "https://en.wikipedia.org/wiki/Hierapolis"
U = "https://whc.unesco.org/en/list/485/"
TAN = "https://www.turkisharchaeonews.net/site/hierapolis"
ATA = "https://ancienttheatrearchive.com/theatre/hieropolis-modern-pamukkale-turkey"
PLW = "https://en.wikipedia.org/wiki/Ploutonion_at_Hierapolis"
A13a = "https://archaeology.org/news/2013/04/02/130403-turkey-hierapolis-pluto-s-gate/"
A13b = "https://archaeology.org/news/2013/11/18/131118-turkey-hierapolis-plutonium-statues/"
A18 = "https://archaeology.org/news/2018/02/16/180216-turkey-plutonium-gas/"
PFANZ = "https://doi.org/10.1007/s12520-018-0599-5"
JRA = "https://journalofromanarchaeology.com/wp-content/uploads/2020/03/JRA31_04_DAndria.pdf"
PHW = "https://en.wikipedia.org/wiki/Philip_the_Apostle"
PAM = "https://en.wikipedia.org/wiki/Pamukkale"
SAC = "https://www.thiasos.eu/wp-content/uploads/2020/05/14.Sacchi.pdf"
THAYER = "https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Frontinus/MKDahm**/body.html"
HUM = "https://archive.org/details/bub_gb_sjTgAAAAMAAJ"
OSMN = "https://www.openstreetmap.org/node/"
OSMW = "https://www.openstreetmap.org/way/"
OSMR = "https://www.openstreetmap.org/relation/"
WD = "https://www.wikidata.org/wiki/"
RAD = "https://commons.wikimedia.org/wiki/"  # Carole Raddato captions (transcribe on-site panels) - secondary


def dist(a, b):
    R = 6371008.8
    la = math.radians((a[0] + b[0]) / 2)
    return round(math.hypot((b[1] - a[1]) * math.radians(1) * R * math.cos(la), (b[0] - a[0]) * math.radians(1) * R))


def F(text, *src):
    return {"fact": text, "sources": list(src)}


L = []


def add(**k):
    osm = k.pop("osm")
    wd = k.pop("wd", [])
    k["lat"], k["lon"] = osm["lat"], osm["lon"]
    k["coord_source"] = osm["src"]
    k["coord_crosscheck"] = []
    for q, lat, lon, label in wd:
        k["coord_crosscheck"].append({"wikidata": WD + q, "label": label, "lat": lat, "lon": lon,
                                      "offset_from_osm_m": dist((osm["lat"], osm["lon"]), (lat, lon))})
    L.append(k)


add(id="travertines", name_en="Pamukkale travertine terraces and thermal springs", name_tr="Pamukkale Travertenleri",
    name_tr_source="OSM way 15494594 name:tr; Wikidata Q123014534",
    osm={"lat": 37.923800, "lon": 29.123786, "src": "OSM node 4889959123 (tourism=attraction 'Travertines', main viewing point at the head of the terraces); the whole travertine polygon is OSM way 15494594 (centroid 37.924342, 29.122056)"},
    wd=[("Q123014534", 37.92431, 29.1235, "Travertines of Pamukkale"), ("Q105893254", 37.9236, 29.1223, "Pamukkale (natural site)")],
    footprint={"osm_polygon_way_15494594": "oriented bbox approx. 1374 x 673 m, long axis ~156 deg (NNW-SSE) - mapped tourist/protected terrace zone, not the full geological deposit",
               "literature": "travertine formation in total about 2,700 m long, 600 m wide and 160 m high (Wikipedia/Pamukkale); UNESCO: springs emerge from a cliff almost 200 m high"},
    period="Natural; deposited over millennia by calcite-laden hot springs; the springs drew visitors from antiquity (spa from at least the 2nd c. BC)",
    phases=["Natural deposition, ongoing", "Ancient spa use from Hellenistic period", "Modern hotels built on the terraces later removed; water flow now regulated and sections closed for regeneration"],
    key_facts=[
        F("UNESCO: calcite-laden waters from springs in a cliff almost 200 m high created 'mineral forests, petrified waterfalls and a series of terraced basins'; Pamukkale means 'Cotton Palace/Castle'.", U),
        F("Hierapolis-Pamukkale was inscribed on the World Heritage List in 1988 under criteria (iii)(iv)(vii); property 1,077 ha.", U),
        F("17 hot springs with temperatures of 35-100 C feed the area; water emerging from the spring is carried 320 m to the head of the terraces.", PAM),
        F("When the CaCO3-supersaturated water reaches the surface, CO2 degasses and calcium carbonate is deposited as a soft gel that crystallises into travertine.", PAM),
        F("UNESCO notes the springs feed a hydraulic system extending 70 km north-west to Alasehir and west along the Menderes valley, and were used in antiquity for scouring and drying wool.", U),
    ],
    disputed=["Dimensions of the travertine body (2,700 x 600 x 160 m) come from Wikipedia without a primary geological citation - verify before quoting.", "Spring temperature range (35-100 C) is from Wikipedia; the Antique Pool spring is about 36 C (various sources)."],
    coord_uncertainty="Area feature; point is a representative viewpoint, not a centroid of the geology.")

add(id="frontinus_gate", name_en="Frontinus Gate (Gate of Domitian)", name_tr="Frontinus Kapısı",
    name_tr_source="Wikidata Q134728635 Turkish label 'Hierapolis Frontinus Kapısı'; OSM info node 7913048775 'Frontinus kapisi'",
    osm={"lat": 37.931747, "lon": 29.121977, "src": "OSM way 847804943 (historic=city_gate 'Frontinus Gate (Gate of Domitian)') centroid; flanking round towers ways 847804941/847804942"},
    wd=[("Q134728635", 37.9317436, 29.1220093, "Hierapolis Frontinus Kapısı")],
    footprint={"osm": "gate body mapped ~15 x 3 m, long axis ~60 deg (gate facade runs ENE-WSW, perpendicular to the street at ~150 deg); with towers the mapped complex spans ~25 m",
               "openings": "three arched openings flanked by two round towers (Wikipedia)"},
    orientation="Facade faces NNW toward the Northern Necropolis road; street axis through the gate ~150/330 deg",
    period="Flavian, AD 84-86 (dedication to Domitian; built under proconsul Sextus Julius Frontinus)",
    phases=["c. AD 84-86 construction as monumental entrance to the Roman city", "Late 4th c.: left outside the new Theodosian circuit wall; the North Byzantine Gate ~170 m further south became the city entrance"],
    key_facts=[
        F("Triple-arched gate of squared travertine blocks flanked by two round towers, recalling Hellenistic gates such as Perge.", W),
        F("Built by the proconsul Julius Frontinus (AD 84-86) and dedicated to Domitian.", W, "https://www.worldhistory.org/image/4410/frontinus-gate-in-hierapolis-phrygia/"),
        F("A bilingual (Latin/Greek) inscription on the gate names Sextus Julius Frontinus.", THAYER),
        F("Beside the gate stands the Tomb of Flavius Zeuxis, a textile merchant whose inscription says he made 72 sea voyages (to Italy).", TAN),
        F("Humann's 1887 survey drew the north gate and colonnaded street at 1:1500 (Altertümer von Hierapolis, 1898).", HUM),
    ],
    disputed=["Date given variously as AD 83, 84, 84-86 or 86 depending on reading of the Frontinus proconsulship; use 'c. AD 84-86'.", "Name: 'Frontinus Gate' vs 'Gate of Domitian'/'Domitian's Arch' - same monument."])

add(id="plateia", name_en="Plateia / Frontinus Street (main colonnaded street)", name_tr="Frontinus Caddesi",
    name_tr_source="Wikidata Q139435627 'Hierapolis Frontinus Caddesi'",
    osm={"lat": 37.930711, "lon": 29.122764, "src": "OSM way 847804947 (historic=street 'Colonnaded (Frontinus) Street') centroid - northern excavated stretch only (ends 37.931746,29.121988 -> 37.929361,29.123719); southern stretches mapped as ways 848667728 and 848667727"},
    wd=[("Q139435627", 37.9310226, 29.1224804, "Hierapolis Frontinus Caddesi")],
    footprint={"mapped_north_segment": "306 m long, bearing ~150 deg (NNW-SSE)",
               "Frontinus Gate to South Byzantine Gate (straight line, OSM)": "~1,205 m",
               "literature_length": "about 1,500 m (Wikipedia)",
               "width": "about 13.5 m (Wikipedia) / 14 m originally, narrowed in early Byzantine period (Turkish Archaeological News)",
               "side_streets": "about 3 m wide (Wikipedia)"},
    orientation="NNW-SSE, ~150 deg, parallel to the travertine cliff edge",
    period="Street grid Hellenistic; colonnaded Frontinus Street 1st c. AD (Flavian), later rebuilt",
    phases=["Hellenistic orthogonal (Hippodamian) grid", "Flavian monumentalisation with porticoes and shops", "Early Byzantine narrowing; late-4th-c. walls cut the street with N and S Byzantine gates"],
    key_facts=[
        F("The main street ran N-S close to the cliff with the travertine terraces, about 1,500 m long and 13.5 m wide, bordered on both sides by an arcade.", W),
        F("Frontinus Street was originally 14 m wide, named after Sextus Julius Frontinus (AD 86), and narrowed in the early Byzantine period.", TAN),
        F("The Hellenistic city was laid out on a grid with streets parallel or perpendicular to the main thoroughfare.", W),
        F("Shops, a latrine and the Nymphaeum of the Tritons line the excavated northern stretch (OSM mapping and site panels).", OSMW + "847804947", OSMN + "7913048880"),
    ],
    disputed=["Width 13.5 m (Wikipedia) vs 14 m (TAN/Frontinus Gate article).", "Total length 1,500 m (Wikipedia) exceeds the ~1.2 km straight-line distance between the two Roman gates measured on OSM; the larger figure may include the extramural road."])

add(id="north_necropolis", name_en="Northern Necropolis", name_tr="Kuzey Nekropolü",
    name_tr_source="Wikidata Q139435628 'Hierapolis Kuzey Nekropolü'",
    osm={"lat": 37.937444, "lon": 29.120081, "src": "OSM way 15494489 (archaeological_site=necropolis) centroid"},
    wd=[("Q139435628", 37.937336, 29.1204109, "Hierapolis Kuzey Nekropolü"), ("Q135960572", 37.9379959, 29.120882, "Tumuli tombs")],
    footprint={"osm_polygon": "~678 x 241 m, long axis ~175 deg", "literature": "extends over 2 km along the ancient road to Tripolis (UNESCO/Wikipedia)"},
    period="Mostly 2nd c. BC - 3rd c. AD, with early Christian burials",
    phases=["Hellenistic tumuli (1st-2nd c. BC)", "Roman house-tombs, heroa and sarcophagi (1st-3rd c. AD)", "Early Christian burials"],
    key_facts=[
        F("The necropolis extends over 2 km and affords a vast panorama of Greco-Roman funerary practice.", U),
        F("About 1,200 tombs; over 300 inscriptions read; mostly 2nd c. BC - 3rd c. AD.", W, TAN),
        F("Tomb types: simple graves, sarcophagi (often on podia), circular tumuli with dromos and vaulted chamber, and temple-like family tombs.", W),
        F("Tomb 163D is an early-1st-c. AD Jewish family tomb; Tomb 148B carries a menorah - evidence of the Jewish community.", TAN),
        F("The sarcophagus of Marcus Aurelius Ammianos, with the relief of a water-powered stone sawmill (earliest known crank-and-connecting-rod machine, 2nd half 3rd c. AD), comes from this necropolis.", "https://en.wikipedia.org/wiki/Hierapolis_sawmill"),
        F("Iron Age round huts were found in 2016 excavations at the park entrance in the Northern Necropolis area.", W),
    ],
    disputed=["Tomb count 'about 1,200' is widely repeated; the Italian Nuovo Atlante (2015) is the authoritative catalogue - not consulted here."])

add(id="latrine", name_en="Latrine (Frontinus Street)", name_tr="Latrina",
    name_tr_source="Wikidata Q139435626 'Hierapolis Latrina'",
    osm={"lat": 37.931653, "lon": 29.122181, "src": "OSM way 1560987393 (building=ruins 'Latrinae') centroid"},
    wd=[("Q139435626", 37.9315796, 29.1222458, "Hierapolis Latrina")],
    footprint={"osm": "~24 x 9 m, long axis ~147 deg (parallel to street)", "literature": "about 20 x 6 m, Doric order (TAN)"},
    period="End of 1st c. AD",
    phases=["Late 1st c. AD construction", "Later reused for storage; fire and earthquake damage"],
    key_facts=[
        F("Built at the end of the 1st c. AD; about 20 x 6 m; Doric order; later used as storage, damaged by fire and earthquake.", TAN),
        F("The room is divided lengthwise by a row of columns that supported a roof of travertine blocks (site panel as captioned).", RAD + "File:The_latrine_along_Frontinus_Street_(colonnaded_street),_the_room_is_divided_longitudinally_by_a_row_of_columns_that_supported_a_roof_composed_of_travertine_blocks,_built_in_the_end_of_the_1st_century_AD,_Hierapolis_(Phrygia),_Turkey.jpg"),
        F("Located just inside (south of) the Frontinus Gate on the east side of the street.", OSMW + "1560987393"),
    ],
    disputed=["Seat count/capacity not found in accessible sources."])

add(id="north_byzantine_gate", name_en="North Byzantine Gate", name_tr="Kuzey Bizans Kapısı",
    name_tr_source="Wikidata Q134728634 'Hierapolis Kuzey Bizans Kapısı'",
    osm={"lat": 37.930426, "lon": 29.122940, "src": "OSM way 847804944 (historic=city_gate) centroid; towers ways 847804945/847804946"},
    wd=[("Q134728634", 37.9304314, 29.122942, "Hierapolis Kuzey Bizans Kapısı")],
    footprint={"osm": "gate passage ~13 x 2 m mapped, facade axis ~63 deg; flanked by two square towers"},
    period="Late 4th c. AD (Theodosian), possibly into early 5th c.",
    phases=["Late 4th c. construction with spolia from the Agora"],
    key_facts=[
        F("Part of the Theodosian (late 4th c.) fortification, monumental entrance matched by a symmetrical gate to the south.", W),
        F("Built of reused material from the demolition of the Agora; flanked by two square towers.", W),
        F("Four marble brackets with heads of lions, a panther and a Gorgon, reused as apotropaic elements, were found collapsed in front of the gate.", W),
        F("Arched lintel carries a cross.", TAN),
    ],
    disputed=["Date 'late 4th c.' (Wikipedia/TAN) vs 'late 4th - early 5th c.' (site panel per Raddato caption)."])

add(id="north_agora", name_en="North (Commercial) Agora and Stoa-Basilica", name_tr="Hierapolis Agorası",
    name_tr_source="Wikidata Q116671557 / Q139435624 Turkish label",
    osm={"lat": 37.931242, "lon": 29.123348, "src": "OSM way 116720703 ('Agora') centroid; Stoa-basilica point OSM node 7911252888 (37.931214, 29.124481)"},
    wd=[("Q116671557", 37.931277777, 29.124194444, "Agora of Hierapolis"), ("Q139435624", 37.9313545, 29.1230183, "Hierapolis Agora")],
    footprint={"literature": "square of 280 x 170 m (Sacchi 2020; TAN)", "osm_polygon": "~265 x 144 m, long axis ~150 deg",
               "stoa_basilica": "on the E side, atop a stepped podium 5 m high and 280 m long; building about 19-20 m high, just under 18 m deep (Sacchi 2020)"},
    period="2nd c. AD; Stoa-basilica late Hadrianic - early Antonine",
    phases=["2nd c. AD construction", "Damaged in 4th-c. earthquake; stone reused in the late-4th-c. walls and North Byzantine Gate"],
    key_facts=[
        F("The North Agora (280 x 170 m) was built during the 2nd c. AD; single-storey porticoes on three sides.", SAC, TAN),
        F("The Stoa-basilica on the E side rose on a monumental stair 5 m high and 280 m long; dated late Hadrianic-early Antonine; a statue base dedicated to Antoninus Pius was found in its propylon collapse.", SAC),
        F("Capitals with lions attacking bulls and Ionic capitals with masks come from the Antonine Stoa-basilica.", JRA),
        F("The Agora was largely destroyed by a 4th-c. earthquake; its stone was reused for the city walls.", TAN),
        F("It may have hosted gladiatorial shows on occasion (Sacchi, citing earlier studies).", SAC),
    ],
    disputed=["Distinguish from the 'Civil/Central Agora' under the Antique Pool (Ismaelli et al. 2017)."])

add(id="theatre", name_en="Roman Theatre", name_tr="Hierapolis Tiyatrosu",
    name_tr_source="Wikidata Q3982324; official site panel 'Tiyatro' (OSM node 11800249337)",
    osm={"lat": 37.926782, "lon": 29.129254, "src": "OSM way 52287248 (ruins=theatre) centroid"},
    wd=[("Q3982324", 37.9267, 29.1292, "Theatre of Hierapolis")],
    footprint={"cavea_width": "103 m (Ancient Theatre Archive)", "orchestra": "21.65 m diameter (ATA)", "stage": "40 m long, 7.6-9.65 m deep; proscaenium 3.25 m high (ATA)",
               "facade": "about 91 m (300 ft) long (Wikipedia)", "osm_polygon": "~94 x 79 m",
               "rows": "ima cavea 23 rows / 9 cunei, summa cavea 27 rows / 10 cunei (ATA); Wikipedia gives 50 rows",
               "capacity": "10,050-12,550 (ATA) / c.10,000 (TAN) / 15,000 (Wikipedia)"},
    orientation="Built into the hillside E of the plateia; cavea opens toward the W/SW (Lycus valley) - from site topography and OSM geometry. NOTE: Ancient Theatre Archive lists 'facing east-northeast' - conflicting, verify.",
    period="Late 1st c. AD start, completed Hadrianic (c. 117-138; often given as AD 129); Severan scaenae frons (193-211)",
    phases=["Post-AD 60 earthquake rebuild begun (late 1st c.)", "Hadrianic completion (inscription naming Tiberius Julius Myndius)", "Severan three-storey scaenae frons with relief friezes; marble seats; podium for venationes", "AD 352 repairs; orchestra made watertight (kolymbethra) for aquatic shows", "Constantius II restorations; last repair c. 532", "Collapse in 7th-c. earthquake", "Restored by the Italian mission 2004-2014"],
    key_facts=[
        F("Under Septimius Severus the old scaenae frons was replaced by a three-storey one flanked by two side buildings, decorated with mythological reliefs and dedicatory inscriptions.", W),
        F("A relief shows Septimius Severus with Julia Domna, Caracalla, Geta and Jupiter; friezes depict cycles of Apollo and Artemis and a festival of Dionysus.", W),
        F("UNESCO highlights the Severan theatre's frieze of a ritual procession and sacrifice to the Ephesian Artemis.", U),
        F("The orchestra was probably converted in AD 352 for aquatic shows.", W, ATA),
        F("Collapsed in the 7th-c. earthquake; a recurring subject for European travellers' engravings from the 18th c.; restored 2004-2014.", W),
        F("Humann's 1887 survey produced a 1:750 plan of the theatre.", HUM),
    ],
    disputed=["Construction date: '129 AD for Hadrian's visit' (Wikipedia/TAN) is not securely attested; ATA gives late 1st c. start, Hadrianic completion.", "Capacity 10,000-15,000 depending on source.", "Row count 50 vs 45 vs 23+27.", "Orientation: ATA 'east-northeast' conflicts with the W-facing topography."])

add(id="temple_apollo", name_en="Temple of Apollo (Sanctuary of Apollo Lairbenos)", name_tr="Apollon Tapınağı",
    name_tr_source="OSM way 116720715 name:tr; official panel 'APOLLON KUTSAL ALANI' (OSM node 11800284625)",
    osm={"lat": 37.926858, "lon": 29.126827, "src": "OSM way 848667742 ('Temple of Apollo Lairbenos') centroid; sanctuary precinct OSM way 116720715 (37.926945, 29.126447)"},
    wd=[("Q135581916", 37.9268837, 29.1265373, "Hierapolis Apollon Kutsal Alanı")],
    footprint={"osm_temple": "~24 x 18 m, long axis ~67 deg", "osm_sanctuary": "~60 x 60 m", "literature": "temple within a peribolos ~15 x 20 m; sacred area about 70 m long (Wikipedia)"},
    orientation="Back of temple built against the hill (E); temple long axis ~ENE-WSW per OSM",
    period="Hellenistic temple; visible remains 3rd c. AD rebuild on old podium",
    phases=["Earlier (Hellenistic / 1st c. AD) temple implied by Ionic and Corinthian capitals", "3rd c. AD reconstruction reusing older blocks, smaller footprint", "4th c. desecration; part of peribolos dismantled for the Nymphaeum"],
    key_facts=[
        F("Dedicated to Apollo Lairbenos, the city's principal god, linked with the Anatolian sun god Lairbenos and the oracle god Kareios.", W),
        F("Built, like the Ploutonion, on the surface trace of a seismic fault revered as a gateway of Hades (Piccardi, CNR, 1998 study).", W, PLW),
        F("UNESCO: the Temple of Apollo, which includes several chthonian divinities, was erected on a geological fault from which noxious vapours escaped.", U),
        F("Rebuilt in the 3rd c. AD in Roman fashion reusing blocks from the older temple; only the marble floor of the reconstruction remains.", W, TAN),
    ],
    disputed=["Peribolos dimensions in Wikipedia are garbled ('15 by 20 m' and 'about 70 m long') - verify against MAIER publications."])

add(id="ploutonion", name_en="Ploutonion (Pluto's Gate / Sanctuary of Hades)", name_tr="Ploutonion (Cehennem Kapısı)",
    name_tr_source="Official bilingual site panel 'PLOUTONION (CEHENNEM KAPISI)' transcribed in OSM node 11800249343; Wikidata Q139435613 'Hierapolis Plütonyum'",
    osm={"lat": 37.926342, "lon": 29.126924, "src": "OSM relation 19365954 ('Plutonium', wikidata Q12901539) centroid; cave entrance OSM node 3930850889 (37.926278, 29.127040); Hades-Cerberus replica OSM node 7918565307"},
    wd=[("Q139435613", 37.9262161, 29.1270409, "Hierapolis Plütonyum"), ("Q12901539", 37.92666667, 29.12611111, "Ploutonion at Hierapolis (enwiki item)")],
    footprint={"osm_multipolygon": "~54 x 42 m, long axis ~156 deg", "literature": "cave chamber about 3 m2; an enclosed area of 2,000 m2 in front of the entrance (Wikipedia, from ancient descriptions)"},
    period="Phrygian/Archaic cult origin; monumental phase 2nd half of 1st c. AD (Neronian-Flavian, after AD 60 earthquake)",
    phases=["Ia Archaic (Phrygian): stepped altar carved in the rock above the cave",
            "Ib Hellenistic: temenos and Doric portico on N side",
            "IIa Augustan/Julio-Claudian: facade with Ionic semi-columns framing the cave; theatron on E side",
            "IIb Neronian and after (post-AD 60 earthquake): monumentalisation - Ionic portico and sacellum housing the colossal marble Hades statue, tholos, theatron extended N and S, abaton",
            "IIIa Imperial: Stoa of the Springs to the S; monumental entrance N of the temenos",
            "IIIb Late Roman: repairs after 4th-c. earthquake; votive deposits",
            "IV Early Byzantine (5th-7th c.): sanctuary obliterated, residential district built over it",
            "V Middle Byzantine (9th-10th c.): houses and olive-processing facility (molae oleariae)",
            "VI 10th-early 11th c.: collapse of Wall A in a powerful earthquake",
            "VII Seljuq (12th-14th c.) and later: frequented by nomadic herders"],
    phases_source="https://journalofromanarchaeology.com/wp-content/uploads/2020/03/JRA32_24_DAndria.pdf (D'Andria, JRA 32, first page, publicly accessible)",
    key_facts=[
        F("Strabo: 'Any animal that passes inside meets instant death. I threw in sparrows and they immediately breathed their last and fell.'", PLW),
        F("Excavations began in 2008 under the Italian mission; the discovery was announced by Francesco D'Andria (Univ. of Salento) in Istanbul in March 2013: a temple, a pool, steps above the gas-emitting cave, and a dedication to Pluto and Kore.", JRA, A13a),
        F("In 2013 two marble statues - Cerberus and a coiled snake - were found in the thermal springs; they had been damaged in the 4th-6th c., probably by Christian pilgrims.", A13b),
        F("Pfanz et al. measured CO2 up to 91% inside the grotto and 4-53% near the mouth depending on height; the gas pools at night and is strongest at dawn, explaining why sacrificed animals died while taller priests survived.", PFANZ, A18),
        F("Castrated priests of Cybele (Galli) were said to enter the cave unharmed; priests sold birds to visitors to test the gas.", PLW),
        F("A replica of the Hades-and-Cerberus statue has been placed at its original position.", PLW, OSMN + "7918565307"),
    ],
    disputed=["Two locations have been called 'Ploutonion': the cave by the Temple of Apollo (identified in the 1960s; Wikidata Q12901539 coordinates point here, ~80 m NW of OSM relation) and the sanctuary ~ to the SE excavated 2008-2013 with the dedicatory inscription. Use the OSM relation for the 2013 sanctuary.",
              "Discovery year: '1965' (Wikipedia, for the cave by the Apollo temple) vs 2013 (announcement of the sanctuary).",
              "Whether priests performed sacrifices at dawn (Pfanz) or at night (D'Andria, oil lamps) is debated."],
    coord_uncertainty="Wikidata Q12901539 is offset ~80 m from OSM relation - reflects the older identification.")

add(id="antique_pool", name_en="Antique Pool / Sacred Pool (\"Cleopatra's Pool\")", name_tr="Antik Havuz",
    name_tr_source="OSM way 116720718 name:tr 'Antik Havuz'; Wikidata Q139435610 'Hierapolis Kleopatra Havuzu'",
    osm={"lat": 37.926149, "lon": 29.125579, "src": "OSM way 116720718 (leisure=swimming_pool + historic=archaeological_site) centroid"},
    wd=[("Q139435610", 37.9262657, 29.1255283, "Hierapolis Kleopatra Havuzu")],
    footprint={"osm": "~54 x 27 m, long axis ~159 deg"},
    period="Natural thermal spring; present pool shaped by 7th-c. AD earthquake; overlies the Roman Civil (Central) Agora",
    phases=["Thermal spring at heart of Roman city", "7th-c. earthquake toppled an Ionic marble portico into the spring", "Modern thermal pool facility (Pamukkale Termal)"],
    key_facts=[
        F("The present pool was shaped by the 7th-c. earthquake, when a marble Ionic portico fell into the spring; visitors swim among the columns.", W),
        F("Recent research attributes the submerged marble structures to the Civil (Central) Agora, buried beneath thick travertine.", JRA),
        F("Water about 36-57 C (sources vary), pH 5.8, rich in bicarbonate, sulphate and CO2.", W),
        F("UNESCO flags the pool as particularly threatened: swimming causes biological pollution and erosion of ancient marble.", U),
    ],
    disputed=["Name 'Cleopatra's Pool' is a modern tourist label with no ancient basis.", "Water temperature figures vary (36 C vs 36-57 C)."])

add(id="martyrium_philip", name_en="Martyrium of St Philip", name_tr="Aziz Philippus Martyrion Kilisesi",
    name_tr_source="Wikidata Q131527084 Turkish label",
    osm={"lat": 37.931278, "lon": 29.130210, "src": "OSM way 116720727 ('Martyrion of St. Philip the Apostle') centroid"},
    wd=[("Q131527084", 37.9312439, 29.1301098, "Aziz Philippus Martyrion Kilisesi")],
    footprint={"osm": "~71 x 65 m (square outer building)", "central_octagon": "20 m diameter, wooden dome covered with lead tiles (Wikipedia)", "stairway": "processional stairs about 70 m long, 4 m wide (later 3 m), ~16 m rise (TAN)"},
    period="Early 5th c. AD",
    phases=["Early 5th c. construction on hilltop NE of the city walls", "Burned at end of 5th / early 6th c. (fire marks on columns)", "Pilgrimage complex with bridge, stairs, octagonal baths and church of the tomb"],
    key_facts=[
        F("Central octagon (20 m) surrounded by eight rectangular rooms; heptagonal chapels fill the gaps; whole enclosed by a square of rooms with marble porticoes.", W, U),
        F("UNESCO singles it out as the most important Christian monument, remarkable for its ingenious spatial organisation, at the top of a monumental stairway.", U),
        F("Burned at the end of the 5th or early 6th c., as attested by fire marks on the columns.", W),
        F("An inscription records a church dedicated to 'the holy and glorious apostle and theologian Philip'.", W),
    ],
    disputed=["Philip of Hierapolis: Apostle vs Philip the Evangelist - confused since antiquity (Polycrates vs Proclus).", "Martyrdom 'in AD 80' (UNESCO/Wikipedia) is tradition, not historical fact; method (crucified upside-down vs hung by ankles) varies."])

add(id="tomb_philip", name_en="Tomb and Church of St Philip (Church of the Sepulchre)", name_tr="Aziz Philippus Mezarı",
    name_tr_source="Wikidata Q134728121 'Hierapolis Aziz Philippus Mezarı'; church Q131527086 'Hierapolis Aziz Philippus Mezar Kilisesi'",
    osm={"lat": 37.930796, "lon": 29.130614, "src": "OSM node 13461967102 (historic=tomb 'Tomb of Saint Philip'); church OSM way 848005831 (37.930697, 29.130653)"},
    wd=[("Q134728121", 37.9307594, 29.1306362, "Hierapolis Aziz Philippus Mezarı"), ("Q131527086", 37.9307365, 29.1305275, "Aziz Philippus Mezar Kilisesi")],
    footprint={"church_osm": "~31 x 20 m, long axis ~111 deg (E-W basilica)", "tomb_chamber": "3.50 x 4 m with three stone benches (TAN)", "distance_to_martyrium": "about 40 m (Wikipedia); ~64 m centroid-to-point on OSM"},
    period="Tomb 1st c. AD; church 4th/5th c. AD",
    phases=["1st c. AD Roman tomb", "4th-5th c. three-aisled church built around the tomb", "Pilgrimage focus; tomb found empty of relics"],
    key_facts=[
        F("Announced 26 July 2011 by Francesco D'Andria: a church found about 40 m from the Martyrium, built around a 1st-c. Roman tomb he identified as Philip's.", W, "https://www.johnsanidopoulos.com/2011/07/tomb-of-apostle-philip-discovered-in.html"),
        F("The tomb, empty of relics, stood at the centre of a three-naved basilica (Church of the Sepulchre); Greek prayers venerating Philip are carved on tomb and church walls.", PHW),
        F("A 6th-c. bread stamp (signum pistoris) shows Philip; pilgrims reached the hill along a processional street identified in 2008.", PHW, "https://ssjc.uk/?p=2484"),
        F("Tomb chamber 3.50 x 4 m with three stone benches; church unearthed in 2011.", TAN),
    ],
    disputed=["The identification as Philip's tomb is D'Andria's interpretation; no relics or bones; not independently confirmed."])

add(id="great_baths_museum", name_en="Great (Central) Baths - Hierapolis Archaeology Museum", name_tr="Hierapolis Arkeoloji Müzesi (Büyük Hamam)",
    name_tr_source="OSM way 52287241 name 'Hierapolis Arkeoloji Müzesi'; Wikidata Q131738536 'Hierapolis Büyük Hamam'; Q116511018 'Pamukkale Arkeoloji Müzesi'",
    osm={"lat": 37.924835, "lon": 29.124211, "src": "OSM way 848667722 ('Central Baths') centroid; museum grounds OSM way 52287241 (37.924869, 29.124439)"},
    wd=[("Q131738536", 37.9252357, 29.1240368, "Central Baths (Hierapolis)"), ("Q116511018", 37.925, 29.124, "Pamukkale Archeology Museum")],
    footprint={"osm_baths": "~110 x 55 m, long axis ~147 deg", "palaestra": "36 x 52 m (TAN)"},
    period="2nd c. AD (Roman imperial); museum since 1984",
    phases=["2nd c. AD baths with palaestra, frigidarium, barrel-vaulted caldaria, hypocausts", "Renovated after late-4th-c. earthquake (columns reused from Temple of Apollo)", "Archaeology Museum opened in the vaulted halls in 1984"],
    key_facts=[
        F("The museum has occupied the great baths since 1984; three closed halls plus open-air areas.", W),
        F("Theatre Gallery displays the Severan scaenae frons reliefs (Apollo and Artemis cycle, Dionysus festival, coronation of Septimius Severus) and statues.", W),
        F("Collections also include finds from Laodicea, Colossae, Tripolis, Attuda and Bronze Age Beycesultan.", W),
        F("Baths built in travertine; 36 x 52 m palaestra; frigidarium and three barrel-vaulted caldarium rooms.", TAN),
        F("Humann's 1887 survey produced a 1:750 plan of the 'grosse Thermen'.", HUM),
    ],
    disputed=["Naming: 'Great Baths', 'Central Baths', 'Roman Baths' are used interchangeably; another 'Roman Baths' (OSM way 848005836) lies near the Cathedral."])

add(id="nymphaeum_tritons", name_en="Nymphaeum of the Tritons", name_tr=None,
    name_tr_source="No official Turkish name found in Wikidata/OSM/panels (Turkish literature sometimes 'Tritonlu Nymphaeum' - unverified)",
    osm={"lat": 37.930239, "lon": 29.123198, "src": "OSM way 848005822 centroid"},
    wd=[],
    footprint={"osm": "~62 x 7 m along the street, long axis ~151 deg", "literature": "facade about 60 m long (TAN)"},
    period="Severan, reign of Severus Alexander (AD 222-235), dated by architrave inscription",
    phases=["Early 3rd c. construction facing the plateia", "Collapsed (earthquake); partially re-erected by the Italian mission"],
    key_facts=[
        F("Monumental fountain on Frontinus Street built under Severus Alexander (222-235), as the architrave inscription attests (site panel as captioned).", RAD + "Category:Nymphaeum_of_the_Tritons_in_Hierapolis", TAN),
        F("Named after reliefs of Tritons blowing sea-shell horns.", RAD + "File:Hierapolis_Nymphaeum_of_the_Tritons_5051.jpg"),
        F("Facade about 60 m long - one of the largest fountains of the city.", TAN),
    ],
    disputed=["No Wikidata item; no Turkish name confirmed."])

add(id="temple_nymphaeum", name_en="Nymphaeum of the Sanctuary of Apollo (Temple Nymphaeum)", name_tr="Tapınak Çeşmesi",
    name_tr_source="Wikidata Q116675996 Turkish label",
    osm={"lat": 37.926913, "lon": 29.126244, "src": "OSM way 664220587 ('Monumental Nymphaeum', wikidata Q116675996) centroid"},
    wd=[("Q116675996", 37.92693, 29.1263062, "Temple Nymphaeum")],
    footprint={"osm": "~34 x 20 m, long axis ~148 deg", "plan": "U-shaped, two storeys, two wings enclosing a large basin"},
    period="2nd c. AD (Wikipedia/TAN) or 3rd c. AD (site panel per Raddato); repaired 5th c.",
    phases=["2nd/3rd c. AD construction in front of the Apollo sanctuary", "5th c. repair with a retaining wall built of peribolos blocks, cutting off the view of the temple"],
    key_facts=[
        F("U-shaped monumental fountain in the sacred area in front of the Temple of Apollo, distributing water via a network of pipes.", W),
        F("Repaired in the 5th c.; a wall built with elements of the Apollo peribolos cut off the view of the pagan temple.", W, TAN),
        F("Two statues of priestesses from here are displayed in the museum.", W),
    ],
    disputed=["Date: 2nd c. AD (Wikipedia, TAN) vs 3rd c. AD (on-site panel as transcribed by Raddato)."])

add(id="south_byzantine_gate", name_en="South Byzantine Gate (and South Roman/Frontinus Gate)", name_tr="Güney Bizans Kapısı",
    name_tr_source="Official panel 'GÜNEY BİZANS KAPISI' (OSM node 11800204504); Wikidata Q134728633",
    osm={"lat": 37.922372, "lon": 29.128861, "src": "OSM way 848005842 (historic=city_gate, wikidata Q134728633) centroid"},
    wd=[("Q134728633", 37.922348, 29.1288643, "South Byzantine Gate")],
    footprint={"osm": "gate ~13 x 2 m, facade axis ~64 deg; flanking towers ways 848005841/848005843"},
    period="End of 4th c. AD",
    phases=["Late-4th-c. Theodosian circuit gate", "A southern Roman (Frontinus-type) gate lies further south outside the walls (Commons 'Southern Frontinus Gate')"],
    key_facts=[
        F("Built of travertine with flanking towers at the end of the 4th c.; restored.", TAN),
        F("Symmetrical counterpart of the North Byzantine Gate in the Theodosian fortification.", W),
        F("Official bilingual site panel 'GÜNEY BİZANS KAPISI / THE SOUTHERN BYZANTINE GATE' stands at the gate.", OSMN + "11800204504"),
    ],
    disputed=["The 'South Gate' of tourist maps may refer to the modern ticket entrance rather than the ancient gate."])

add(id="city_walls", name_en="City walls (Theodosian circuit)", name_tr="Sur duvarları (generic)",
    name_tr_source="Generic Turkish term; no official proper name found",
    osm={"lat": 37.926200, "lon": 29.126160, "src": "Representative midpoint of the bbox of all 14 OSM historic=citywalls ways (lat 37.92172-37.93067, lon 29.12110-29.13122); not on a wall - use geo/city_walls.geojson for geometry"},
    wd=[],
    footprint={"osm_mapped_length": "~1,916 m of wall segments mapped (14 ways)", "extent": "~1.0 km N-S x ~0.9 km E-W"},
    period="End of 4th c. AD (Theodosian), expanded 5th c.",
    phases=["Late 4th c. circuit with N and S Byzantine gates, St Philip Gate (NE) and East Gate (OSM node 7918637723)", "5th c. extensions"],
    key_facts=[
        F("The walls and gates date to the end of the 4th c.; built partly with stone from the Agora; expanded in the 5th c.", TAN, W),
        F("A Gate of St Philip with two towers stands in the NE walls, toward the Martyrium.", TAN, OSMN + "4513631397"),
        F("The Martyrium of St Philip stands outside the city walls (UNESCO: outside the north-west wall - sic; it lies NE on the map).", U),
    ],
    disputed=["UNESCO text says 'north-west wall' for the Martyrium location, but it lies NE of the city on maps."],
    coord_uncertainty="Point is a nominal centre; the walls are linear features.")

add(id="cathedral", name_en="Cathedral (with Baptistery)", name_tr="Katedral Kilise",
    name_tr_source="OSM way 116720702 name:tr; Wikidata Q139435619 'Hierapolis Katedrali'",
    osm={"lat": 37.929377, "lon": 29.124638, "src": "OSM way 116720702 ('Basilica (Cathedral)') centroid; Baptistery OSM way 848005837"},
    wd=[("Q139435619", 37.9292793, 29.1244774, "Hierapolis Katedrali")],
    footprint={"osm": "~49 x 25 m, long axis ~59 deg (ENE-WSW, apse to E)"},
    period="6th c. AD (1st half per site panel)",
    phases=["6th c. three-aisled basilica with narthex and baptistery"],
    key_facts=[
        F("Three-aisled church with baptistery and narthex; apse semicircular inside, polygonal outside.", TAN),
        F("UNESCO: the 4th-6th c. Christian monuments - cathedral, baptistery and churches - are an outstanding Early Christian group (criterion iv).", U),
        F("Justinian raised the bishop of Hierapolis to metropolitan in 531.", W),
    ],
    disputed=["Date 'first half of 6th c.' only from site panel transcription; TAN says 6th c."])

add(id="stoa_springs", name_en="Stoa (Portico) of the Springs", name_tr="Kaynaklar Portikosu",
    name_tr_source="Official bilingual panel 'Ploutonion. Kaynaklar Portikosu / The Portico of the Springs' (OSM node 11800249350)",
    osm={"lat": 37.925918, "lon": 29.126888, "src": "OSM node 11800249350 = position of the information panel only; no building outline mapped"},
    wd=[],
    footprint={"unknown": "No dimensions found in accessible sources"},
    period="Imperial period (D'Andria phase IIIa, after the Neronian rebuilding), S of the Ploutonion",
    phases=["Phase IIIa of the Ploutonion sanctuary sequence"],
    key_facts=[
        F("D'Andria's phase chronology of the Ploutonion includes construction of the 'Stoa of the Springs' to the south of the Ploutonion in the Imperial era (phase IIIa).", "https://journalofromanarchaeology.com/wp-content/uploads/2020/03/JRA32_24_DAndria.pdf"),
        F("The sanctuary area was earlier called the 'Santuario delle Sorgenti' (Sanctuary of the Springs) before the 2013 identification as the Ploutonion.", JRA),
    ],
    disputed=["Location, plan and dimensions not documented in open sources; images/stoa_springs_1.jpg is a marble portico of uncertain identification."],
    coord_uncertainty="HIGH - panel location, not the monument centroid (likely within ~30 m).")

for l in L:
    l["coord_note"] = "lat/lon WGS84 from OpenStreetMap (Overpass, osm_base 2026-11-15); cross-check offsets in metres vs Wikidata P625."
    if "coord_uncertainty" not in l:
        offs = [c["offset_from_osm_m"] for c in l["coord_crosscheck"]]
        if not offs: l["coord_uncertainty"] = "Medium - OSM only, no independent cross-check found"
        elif max(offs) < 40: l["coord_uncertainty"] = f"Low - OSM and Wikidata agree within {max(offs)} m"
        else: l["coord_uncertainty"] = f"Low-medium - large feature; Wikidata points differ by up to {max(offs)} m from the OSM centroid (different reference points, not an error)"
json.dump(L, open("landmarks.json", "w"), ensure_ascii=False, indent=1)
for l in L:
    print(f"{l['id']:22} {l['lat']:.6f} {l['lon']:.6f}  xchk:{[c['offset_from_osm_m'] for c in l['coord_crosscheck']]}  {l['coord_uncertainty'][:40]}")
