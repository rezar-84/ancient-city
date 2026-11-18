import type { Landmark } from './types'
import { IMAGES } from './images'
import { audioIf } from './audio'

/**
 * Monuments of Hierapolis. Positions: OpenStreetMap archaeological mapping (research/geo/archaeology.geojson).
 * Facts: see `sources` on each entry and research/landmarks.json. Order = numbering on the plan.
 * Rotation: the Roman street grid runs ~30° east of south, so most buildings use 30°.
 */
const base: Landmark[] = [
  {
    id: 'travertines',
    name: { en: 'Travertine Terraces', tr: 'Traverten Terasları' },
    lat: 37.9236, lon: 29.1212,
    category: 'nature', built: -200, period: { en: 'Natural wonder', tr: 'Doğa harikası' },
    summary: {
      en: 'Hot springs on the plateau carry calcium-rich water at about 35 °C. As it flows over the cliff edge, carbon dioxide escapes and calcium carbonate is deposited, building the brilliant white basins that gave Pamukkale — the “cotton castle” — its name. The springs are the reason a city was founded here.',
      tr: 'Platodaki sıcak su kaynakları yaklaşık 35 °C sıcaklıkta, kalsiyumca zengin su taşır. Su yamaçtan akarken karbondioksit açığa çıkar ve kalsiyum karbonat çökelerek Pamukkale’ye — “pamuk kale” — adını veren bembeyaz havuzları oluşturur. Kentin burada kurulmasının nedeni bu kaynaklardır.',
    },
    facts: {
      en: ['Terraces about 2.7 km long and up to 160 m high', 'Inscribed with Hierapolis as a mixed (cultural + natural) UNESCO World Heritage Site in 1988', 'Hotels built on the travertines were removed after the UNESCO listing to protect them'],
      tr: ['Teraslar yaklaşık 2,7 km uzunluğunda ve 160 m yüksekliğe kadar', 'Hierapolis ile birlikte 1988’de karma (kültürel + doğal) UNESCO Dünya Mirası', 'UNESCO listesinden sonra travertenleri korumak için üzerlerindeki oteller kaldırıldı'],
    },
    didYouKnow: { en: 'Visitors walk the terraces barefoot to protect the soft travertine surface.', tr: 'Ziyaretçiler yumuşak traverten yüzeyi korumak için teraslarda çıplak ayakla yürür.' },
    images: [], sources: [{ title: 'UNESCO World Heritage Centre — Hierapolis-Pamukkale (485)', url: 'https://whc.unesco.org/en/list/485/' }, { title: 'Wikipedia — Pamukkale', url: 'https://en.wikipedia.org/wiki/Pamukkale' }],
    view: { bearing: 250, elev: 22, dist: 900 }, pinHeight: 30,
  },
  {
    id: 'frontinus-gate',
    name: { en: 'Frontinus Gate', tr: 'Frontinus Kapısı' },
    lat: 37.93175, lon: 29.12198,
    category: 'gate', built: 85, period: { en: 'Roman · Flavian', tr: 'Roma · Flavius dönemi' },
    summary: {
      en: 'The monumental northern entrance to the Roman city: three equal arches flanked by two round towers. An inscription dedicates it to Emperor Domitian and names the proconsul of Asia, Sextus Julius Frontinus, who had it built. Travellers from Laodicea passed the tombs of the necropolis and entered the city here.',
      tr: 'Roma kentinin anıtsal kuzey girişi: iki yuvarlak kuleyle çevrili üç eşit kemer. Yazıtı onu İmparator Domitianus’a adar ve yaptıran Asya prokonsülü Sextus Julius Frontinus’u anar. Laodikeia’dan gelen yolcular nekropolün mezarları arasından geçerek kente buradan girerdi.',
    },
    facts: {
      en: ['Built c. AD 84–86 under Domitian', 'Three arches between two round towers', 'Opens onto the colonnaded Frontinus Street'],
      tr: ['MS y. 84–86’da Domitianus döneminde yapıldı', 'İki yuvarlak kule arasında üç kemer', 'Sütunlu Frontinus Caddesi’ne açılır'],
    },
    didYouKnow: { en: 'Frontinus later became water commissioner of Rome and wrote a famous book on its aqueducts.', tr: 'Frontinus daha sonra Roma’nın su işleri sorumlusu oldu ve su kemerleri üzerine ünlü bir kitap yazdı.' },
    disputed: { en: 'Sources give slightly different dates (AD 84–86, sometimes AD 82–83) depending on how Frontinus’s proconsulship is dated.', tr: 'Frontinus’un prokonsüllüğünün tarihlendirilmesine göre kaynaklar biraz farklı tarihler verir (MS 84–86, bazen MS 82–83).' },
    images: [], sources: [{ title: 'Wikipedia — Hierapolis', url: 'https://en.wikipedia.org/wiki/Hierapolis' }, { title: 'Turkish Archaeological News — Hierapolis', url: 'https://turkisharchaeonews.net/site/hierapolis' }],
    builder: 'frontinusGate', rotation: 30, view: { bearing: 315, elev: 14, dist: 95 },
  },
  {
    id: 'frontinus-street',
    name: { en: 'Frontinus Street (Plateia)', tr: 'Frontinus Caddesi (Plateia)' },
    lat: 37.93089, lon: 29.12264,
    category: 'civic', built: 85, period: { en: 'Roman', tr: 'Roma' },
    summary: {
      en: 'The city’s main avenue ran straight for over a kilometre from the Frontinus Gate to the southern gate. Paved with large limestone slabs over a drain, it was lined with porticoes sheltering shops, and the whole grid of the city was laid out parallel to it.',
      tr: 'Kentin ana caddesi Frontinus Kapısı’ndan güney kapısına kadar bir kilometreden fazla dümdüz uzanırdı. Bir kanalizasyonun üzerine büyük kireçtaşı levhalarla döşenmiş, iki yanı dükkânları koruyan revaklarla çevriliydi; kentin tüm ızgara planı buna paralel düzenlenmişti.',
    },
    facts: {
      en: ['Roughly 14 m wide carriageway', 'Shops opened behind colonnades on both sides', 'Defines the orthogonal (grid) plan of the Roman city'],
      tr: ['Yaklaşık 14 m genişliğinde yol', 'İki yandaki sütunların ardında dükkânlar açılırdı', 'Roma kentinin dik açılı (ızgara) planını belirler'],
    },
    images: [], sources: [{ title: 'Wikipedia — Hierapolis', url: 'https://en.wikipedia.org/wiki/Hierapolis' }],
    view: { bearing: 150, elev: 14, dist: 160 }, pinHeight: 18,
  },
  {
    id: 'necropolis',
    name: { en: 'Northern Necropolis', tr: 'Kuzey Nekropol' },
    lat: 37.9372, lon: 29.1203,
    category: 'funerary', built: -150, until: 600, period: { en: 'Hellenistic – Early Christian', tr: 'Helenistik – Erken Hristiyan' },
    summary: {
      en: 'One of the largest ancient cemeteries in Anatolia stretches for about two kilometres along the road to Laodicea. Many people came to Hierapolis to take the healing waters and died here, so tombs of every kind crowd the roadside: earth tumuli, house-shaped tombs and hundreds of sarcophagi.',
      tr: 'Anadolu’nun en büyük antik mezarlıklarından biri Laodikeia yolu boyunca yaklaşık iki kilometre uzanır. Şifalı sulardan yararlanmak için Hierapolis’e gelen pek çok kişi burada öldü; bu yüzden yol kenarı her türden mezarla doludur: toprak tümülüsler, ev biçimli mezarlar ve yüzlerce lahit.',
    },
    facts: {
      en: ['About 1,200 tombs recorded', 'Tumuli, sarcophagi, house tombs and heroa — including Jewish tombs marked with menorahs', 'The merchant Flavius Zeuxis boasted on his tomb of sailing 72 times around Cape Malea to Italy'],
      tr: ['Yaklaşık 1.200 mezar kaydedildi', 'Tümülüsler, lahitler, ev tipi mezarlar ve heroonlar — menoralı Yahudi mezarları dahil', 'Tüccar Flavius Zeuxis mezarında Malea Burnu’nu dolaşarak İtalya’ya 72 kez yelken açtığını övünerek anlatır'],
    },
    didYouKnow: {
      en: 'The sarcophagus of Marcus Aurelius Ammianos shows a water-powered stone saw — the oldest known picture of a machine using a crank and connecting rod (3rd century AD).',
      tr: 'Marcus Aurelius Ammianos’un lahdinde suyla çalışan bir taş testeresi tasvir edilir — krank ve biyel kolu kullanan bir makinenin bilinen en eski resmi (MS 3. yüzyıl).',
    },
    images: [], sources: [{ title: 'Wikipedia — Hierapolis', url: 'https://en.wikipedia.org/wiki/Hierapolis' }, { title: 'Wikipedia — Hierapolis sawmill', url: 'https://en.wikipedia.org/wiki/Hierapolis_sawmill' }],
    view: { bearing: 200, elev: 30, dist: 520 },
  },
  {
    id: 'latrine',
    name: { en: 'Public Latrine', tr: 'Umumi Tuvalet (Latrina)' },
    lat: 37.93163, lon: 29.12223,
    category: 'civic', built: 95, until: 600, period: { en: 'Roman · late 1st century AD', tr: 'Roma · MS 1. yüzyıl sonu' },
    summary: {
      en: 'Just inside the Frontinus Gate stood a long public latrine. Marble seats lined the walls over a channel of running water, while two rows of columns held up the roof — a reminder that Roman city life was surprisingly social.',
      tr: 'Frontinus Kapısı’nın hemen içinde uzun bir umumi tuvalet bulunuyordu. Mermer oturaklar akan su kanalının üzerinde duvar boyunca dizilir, iki sıra sütun çatıyı taşırdı — Roma kent yaşamının şaşırtıcı derecede toplumsal olduğunun bir hatırlatıcısı.',
    },
    facts: {
      en: ['Two internal rows of columns', 'Flushed by water channelled from the springs'],
      tr: ['İçeride iki sıra sütun', 'Kaynaklardan getirilen suyla temizlenirdi'],
    },
    images: [], sources: [{ title: 'Turkish Archaeological News — Hierapolis', url: 'https://turkisharchaeonews.net/site/hierapolis' }],
    // The latrine's 40 m axis is local X; its entrance faces local +Z.
    // Run it along the plateia with the door facing the portico. Set back the
    // reconstructed footprint while retaining the archaeological map pin.
    builder: 'latrine', builderOpts: { back: 6 }, rotation: -60, view: { bearing: 230, elev: 22, dist: 90 },
  },
  {
    id: 'agora',
    name: { en: 'North Agora', tr: 'Kuzey Agora' },
    lat: 37.93104, lon: 29.12379,
    category: 'civic', built: 100, until: 650, period: { en: 'Roman · 2nd century AD', tr: 'Roma · MS 2. yüzyıl' },
    summary: {
      en: 'The great market square of Hierapolis was one of the largest in the Roman world. Marble porticoes surrounded it on three sides, and its eastern side was closed by a towering stoa-basilica. Merchants sold the city’s famous dyed wool and textiles here.',
      tr: 'Hierapolis’in büyük pazar meydanı Roma dünyasının en büyüklerinden biriydi. Üç yanını mermer revaklar çevirir, doğu yanını yüksek bir stoa-bazilika kapatırdı. Tüccarlar kentin ünlü boyalı yün ve dokumalarını burada satardı.',
    },
    facts: {
      en: ['About 280 × 170 m', 'Stoa-basilica on the east side: 280 m long, on a 5 m podium (late Hadrianic – early Antonine)', 'Textile and dyeing guilds made Hierapolis rich'],
      tr: ['Yaklaşık 280 × 170 m', 'Doğu yanında 5 m’lik podyum üzerinde 280 m uzunluğunda stoa-bazilika (geç Hadrianus – erken Antoninler)', 'Dokuma ve boyacı loncaları Hierapolis’i zenginleştirdi'],
    },
    images: [], sources: [{ title: 'Wikipedia — Hierapolis', url: 'https://en.wikipedia.org/wiki/Hierapolis' }],
    builder: 'agora', builderOpts: { width: 134, length: 230 }, rotation: 30, view: { bearing: 240, elev: 34, dist: 420 },
  },
  {
    id: 'byzantine-gate-n',
    name: { en: 'North Byzantine Gate', tr: 'Kuzey Bizans Kapısı' },
    lat: 37.93043, lon: 29.12294,
    category: 'defence', built: 400, until: 1354, period: { en: 'Late Roman / Byzantine', tr: 'Geç Roma / Bizans' },
    summary: {
      en: 'Around AD 400 the city was enclosed by a new defensive wall. Its northern gate, with two square towers, cut across Frontinus Street — so the older Frontinus Gate and the latrine were left outside the walls.',
      tr: 'MS 400 dolaylarında kent yeni bir savunma suruyla çevrildi. İki kare kuleli kuzey kapısı Frontinus Caddesi’ni kesiyordu — böylece eski Frontinus Kapısı ve tuvalet surların dışında kaldı.',
    },
    facts: {
      en: ['Part of the late-4th / early-5th century wall circuit', 'Built with reused blocks from older buildings'],
      tr: ['4. yüzyıl sonu / 5. yüzyıl başı sur hattının parçası', 'Eski yapılardan devşirme bloklarla inşa edildi'],
    },
    images: [], sources: [{ title: 'Wikipedia — Hierapolis', url: 'https://en.wikipedia.org/wiki/Hierapolis' }],
    builder: 'byzantineGate', rotation: 30, view: { bearing: 160, elev: 20, dist: 110 },
  },
  {
    id: 'tritons',
    name: { en: 'Nymphaeum of the Tritons', tr: 'Tritonlar Nymphaeumu' },
    lat: 37.93024, lon: 29.1232,
    category: 'leisure', built: 225, until: 650, period: { en: 'Roman · Severus Alexander (AD 222–235)', tr: 'Roma · Severus Alexander (MS 222–235)' },
    summary: {
      en: 'A grand public fountain on the main street, its two-storey columned façade decorated with reliefs of Tritons — sea creatures half man, half fish. Water from the city’s aqueducts poured into a long basin in front.',
      tr: 'Ana cadde üzerinde büyük bir halk çeşmesi; iki katlı sütunlu cephesi yarı insan yarı balık deniz yaratıkları Tritonların kabartmalarıyla süslüydü. Kentin su kemerlerinden gelen su öndeki uzun havuza dökülürdü.',
    },
    facts: {
      en: ['Façade about 60 m long, facing Frontinus Street', 'Dated by its architrave inscription to Emperor Severus Alexander (AD 222–235)', 'Named after its Triton reliefs'],
      tr: ['Frontinus Caddesi’ne bakan yaklaşık 60 m uzunluğunda cephe', 'Arşitrav yazıtıyla İmparator Severus Alexander dönemine (MS 222–235) tarihlenir', 'Adını Triton kabartmalarından alır'],
    },
    images: [], sources: [{ title: 'Turkish Archaeological News — Hierapolis', url: 'https://turkisharchaeonews.net/site/hierapolis' }],
    builder: 'nymphaeum', rotation: 120, builderOpts: { back: 23 }, view: { bearing: 60, elev: 18, dist: 120 },
  },
  {
    id: 'baths',
    name: { en: 'Great Baths', tr: 'Büyük Hamam' },
    nameToday: { en: 'Hierapolis Archaeology Museum (Great Baths)', tr: 'Hierapolis Arkeoloji Müzesi (Büyük Hamam)' },
    lat: 37.92484, lon: 29.12421,
    category: 'leisure', built: 150, period: { en: 'Roman · 2nd century AD', tr: 'Roma · MS 2. yüzyıl' },
    summary: {
      en: 'Hierapolis was a spa town, and its great baths were among its largest buildings: vaulted halls for hot, warm and cold bathing beside an open exercise court (palaestra). Since 1984 the restored halls have housed the Hierapolis Archaeology Museum, with sarcophagi, statues and the theatre reliefs.',
      tr: 'Hierapolis bir kaplıca kentiydi ve büyük hamamı en büyük yapılarındandı: açık bir spor avlusunun (palaestra) yanında sıcak, ılık ve soğuk yıkanma için tonozlu salonlar. 1984’ten beri onarılmış salonlarda lahitler, heykeller ve tiyatro kabartmalarıyla Hierapolis Arkeoloji Müzesi bulunur.',
    },
    facts: {
      en: ['Massive vaulted halls of travertine blocks', 'Museum displays finds from Hierapolis, Laodicea and Tripolis'],
      tr: ['Traverten bloklardan dev tonozlu salonlar', 'Müzede Hierapolis, Laodikeia ve Tripolis buluntuları sergilenir'],
    },
    images: [], sources: [{ title: 'Wikipedia — Hierapolis Archaeology Museum', url: 'https://en.wikipedia.org/wiki/Hierapolis_Archaeology_Museum' }],
    builder: 'baths', builderOpts: { width: 55, depth: 100 }, rotation: 30, view: { bearing: 230, elev: 26, dist: 200 },
  },
  {
    id: 'cathedral',
    name: { en: 'Cathedral', tr: 'Katedral' },
    lat: 37.92938, lon: 29.12464,
    category: 'christian', built: 520, until: 1354, period: { en: 'Byzantine · 6th century', tr: 'Bizans · 6. yüzyıl' },
    summary: {
      en: 'As Hierapolis became a Christian bishopric, a large basilica with a nave and two aisles, plus a baptistery, rose just east of the main street. Pilgrims on their way to the shrine of St Philip passed through this Christian heart of the city.',
      tr: 'Hierapolis bir piskoposluk merkezi olunca, ana caddenin hemen doğusunda bir orta nef ve iki yan neften oluşan büyük bir bazilika ile bir vaftizhane yükseldi. Aziz Philippos türbesine giden hacılar kentin bu Hristiyan merkezinden geçerdi.',
    },
    facts: {
      en: ['Three-aisled basilica with an apse to the east', 'Baptistery nearby'],
      tr: ['Doğuda apsisli üç nefli bazilika', 'Yakınında vaftizhane'],
    },
    images: [], sources: [{ title: 'Wikipedia — Hierapolis', url: 'https://en.wikipedia.org/wiki/Hierapolis' }],
    builder: 'church', builderOpts: { width: 30, length: 50 }, rotation: 30, view: { bearing: 200, elev: 24, dist: 130 },
  },
  {
    id: 'antique-pool',
    name: { en: 'Antique (Sacred) Pool', tr: 'Antik Havuz' },
    lat: 37.92615, lon: 29.12558,
    category: 'nature', built: -100, period: { en: 'Sacred spring', tr: 'Kutsal kaynak' },
    summary: {
      en: 'The thermal spring that feeds the travertines rises here, inside the sacred area of Apollo. Earthquakes toppled the marble columns of a portico into the water, and today visitors still swim among them in the warm, fizzy spring water.',
      tr: 'Travertenleri besleyen termal kaynak burada, Apollon’un kutsal alanı içinde yükselir. Depremler bir revakın mermer sütunlarını suya devirdi; bugün ziyaretçiler hâlâ sıcak ve gazlı kaynak suyunda bu sütunların arasında yüzer.',
    },
    facts: {
      en: ['Water at about 36 °C, rich in calcium and CO₂', 'Columns toppled by a 7th-century earthquake lie in the pool', 'The pool covers part of the city’s Roman civic agora'],
      tr: ['Su yaklaşık 36 °C, kalsiyum ve CO₂ bakımından zengin', '7. yüzyıl depreminin devirdiği sütunlar havuzda yatar', 'Havuz kentin Roma dönemi sivil agorasının bir bölümünü örter'],
    },
    disputed: { en: 'The popular name “Cleopatra’s Pool” is a modern legend: there is no evidence that Cleopatra ever bathed here.', tr: 'Yaygın “Kleopatra Havuzu” adı modern bir efsanedir: Kleopatra’nın burada yıkandığına dair hiçbir kanıt yoktur.' },
    images: [], sources: [{ title: 'Wikipedia — Pamukkale', url: 'https://en.wikipedia.org/wiki/Pamukkale' }],
    view: { bearing: 230, elev: 30, dist: 110 }, pinHeight: 16,
  },
  {
    id: 'apollo',
    name: { en: 'Temple of Apollo', tr: 'Apollon Tapınağı' },
    lat: 37.92695, lon: 29.12675,
    category: 'sacred', built: 200, until: 400, period: { en: 'Roman (on Hellenistic foundations)', tr: 'Roma (Helenistik temeller üzerinde)' },
    summary: {
      en: 'Apollo Archegetes — “the founder” — was the chief god of Hierapolis, and his temple stood in a sanctuary at the heart of the city, right above the cave of the Ploutonion. Here the god’s oracle was consulted; the visible remains date to the 3rd century AD.',
      tr: 'Apollon Arkhegetes — “kurucu” — Hierapolis’in baş tanrısıydı; tapınağı kentin kalbindeki kutsal alanda, Plutonion mağarasının hemen üstünde yükselirdi. Tanrının kehanet merkezine burada danışılırdı; görülen kalıntılar MS 3. yüzyıla aittir.',
    },
    facts: {
      en: ['Temple on a high podium reached by a stair', 'Oracle inscriptions found in the sanctuary'],
      tr: ['Merdivenle çıkılan yüksek podyum üzerinde tapınak', 'Kutsal alanda kehanet yazıtları bulundu'],
    },
    images: [], sources: [{ title: 'Wikipedia — Hierapolis', url: 'https://en.wikipedia.org/wiki/Hierapolis' }],
    builder: 'temple', builderOpts: { width: 18, length: 30, columnHeight: 9 }, rotation: -60, view: { bearing: 240, elev: 24, dist: 120 },
  },
  {
    id: 'ploutonion',
    name: { en: 'Ploutonion — Gate to Hell', tr: 'Plutonion — Cehennem Kapısı' },
    lat: 37.92628, lon: 29.12704,
    category: 'sacred', built: -650, until: 400, period: { en: 'Phrygian cult – Roman sanctuary', tr: 'Frig kültü – Roma kutsal alanı' },
    summary: {
      en: 'A cave sacred to Pluto, god of the underworld, that breathes out deadly carbon dioxide. The geographer Strabo wrote that birds thrown in died instantly, while the god’s eunuch priests could enter unharmed. Pilgrims watched sacrificed bulls collapse from stepped seats around the misty arena in front of the cave.',
      tr: 'Yeraltı tanrısı Pluton’a adanmış, ölümcül karbondioksit soluyan bir mağara. Coğrafyacı Strabon içine atılan kuşların anında öldüğünü, tanrının hadım rahiplerinin ise zarar görmeden girebildiğini yazmıştır. Hacılar mağaranın önündeki sisli arenanın etrafındaki basamaklı oturma yerlerinden kurban edilen boğaların yığılışını izlerdi.',
    },
    facts: {
      en: ['Rediscovered by the Italian Archaeological Mission led by Francesco D’Andria in 2013', 'Statues of Pluto and of Cerberus, the three-headed guardian dog, were found here', 'CO₂ collects in a lethal layer above the floor at night and at dawn'],
      tr: ['2013’te Francesco D’Andria başkanlığındaki İtalyan Arkeoloji Heyeti tarafından yeniden bulundu', 'Burada Pluton ve üç başlı bekçi köpek Kerberos heykelleri bulundu', 'CO₂ gece ve şafakta zeminin üzerinde ölümcül bir katman oluşturur'],
    },
    didYouKnow: { en: 'Scientists measured CO₂ concentrations high enough to kill a bull within minutes — but only close to the ground, which explains how the tall priests survived.', tr: 'Bilim insanları bir boğayı dakikalar içinde öldürecek CO₂ yoğunlukları ölçtü — ama yalnızca yere yakın; bu da uzun boylu rahiplerin nasıl hayatta kaldığını açıklar.' },
    images: [], sources: [{ title: 'Wikipedia — Ploutonion at Hierapolis', url: 'https://en.wikipedia.org/wiki/Ploutonion_at_Hierapolis' }, { title: 'D’Andria, “The Ploutonion of Hierapolis in light of recent research (2013–17)”', url: 'https://www.academia.edu/117925833/The_Ploutonion_of_Hierapolis_in_light_of_recent_research_2013_17_' }],
    builder: 'temple', builderOpts: { width: 9, length: 13, columnHeight: 5, frontColumns: 4, podiumHeight: 1.5 }, rotation: 120, view: { bearing: 210, elev: 28, dist: 80 }, pinHeight: 16,
  },
  {
    id: 'theatre',
    name: { en: 'Theatre', tr: 'Tiyatro' },
    lat: 37.9268, lon: 29.12903,
    category: 'leisure', built: 90, until: 620, period: { en: 'Roman · Flavian – Hadrianic – Severan', tr: 'Roma · Flavius – Hadrianus – Severus' },
    summary: {
      en: 'Begun in the late 1st century AD, completed under Hadrian and crowned with a richly carved stage building under Septimius Severus, the theatre seated over 10,000 people. Reliefs on the stage front tell the stories of Apollo, Artemis and Dionysus. It is one of the best-preserved theatres of Anatolia, and Italian archaeologists have re-erected much of its stage façade.',
      tr: 'MS 1. yüzyılın sonunda başlanan, Hadrianus döneminde tamamlanan ve Septimius Severus döneminde zengin bezemeli bir sahne binasıyla taçlandırılan tiyatro 10.000’den fazla kişi alırdı. Sahne cephesindeki kabartmalar Apollon, Artemis ve Dionysos’un öykülerini anlatır. Anadolu’nun en iyi korunmuş tiyatrolarından biridir ve İtalyan arkeologlar sahne cephesinin büyük bölümünü yeniden ayağa kaldırmıştır.',
    },
    facts: {
      en: ['Cavea about 103 m wide: 23 lower + 27 upper rows divided by a walkway (diazoma)', 'Three-storey stage façade built under Septimius Severus (AD 193–211); one frieze shows his coronation', 'In AD 352 the orchestra was made watertight for aquatic shows'],
      tr: ['Cavea yaklaşık 103 m genişliğinde: bir geçitle (diazoma) ayrılan 23 alt + 27 üst sıra', 'Üç katlı sahne cephesi Septimius Severus döneminde (MS 193–211) yapıldı; bir friz onun taç giyişini gösterir', 'MS 352’de orkestra su gösterileri için su geçirmez hâle getirildi'],
    },
    didYouKnow: { en: 'An earlier Hellenistic theatre stood north of the city; this “new” theatre replaced it in Roman times.', tr: 'Kentin kuzeyinde daha eski bir Helenistik tiyatro vardı; bu “yeni” tiyatro Roma döneminde onun yerini aldı.' },
    disputed: { en: 'Capacity estimates range from 10,000 to 15,000, and the popular claim that it was finished for Hadrian’s visit in AD 129 is not securely attested.', tr: 'Kapasite tahminleri 10.000 ile 15.000 arasında değişir; Hadrianus’un MS 129 ziyareti için bitirildiği iddiası kesin olarak kanıtlanmış değildir.' },
    images: [], sources: [{ title: 'Wikipedia — Hierapolis', url: 'https://en.wikipedia.org/wiki/Hierapolis' }, { title: 'World History Encyclopedia — Roman Theatre of Hierapolis', url: 'https://www.worldhistory.org/image/3834/roman-theatre-of-hierapolis/' }, { title: 'Ancient Theatre Archive — Hierapolis', url: 'https://www.whitman.edu/theatre/theatretour/hierapolis/commentary/hierapolis.commentary.htm' }],
    builder: 'theatre', rotation: -97, view: { bearing: 255, elev: 42, dist: 210 },
    model: { glb: '/models/theatre.glb', usdz: '/models/theatre.usdz', credit: 'Hierapolis Theatre 3D model' },
  },
  {
    id: 'martyrium',
    name: { en: 'Martyrium of St Philip', tr: 'Aziz Philippos Martyrionu' },
    lat: 37.93128, lon: 29.13021,
    category: 'christian', built: 410, until: 1354, period: { en: 'Early Byzantine · 5th century', tr: 'Erken Bizans · 5. yüzyıl' },
    summary: {
      en: 'On the hill east of the city, an extraordinary octagonal shrine honoured the Apostle Philip, who according to tradition was martyred in Hierapolis. A central octagon, once domed, was surrounded by chapels and rooms forming a square of about 60 m — a great pilgrimage destination of the Byzantine world.',
      tr: 'Kentin doğusundaki tepede, geleneğe göre Hierapolis’te şehit edilen Havari Philippos’u onurlandıran olağanüstü sekizgen bir türbe yükseliyordu. Bir zamanlar kubbeli merkezi sekizgen, yaklaşık 60 m’lik bir kare oluşturan şapel ve odalarla çevriliydi — Bizans dünyasının büyük bir hac merkezi.',
    },
    facts: {
      en: ['Central octagon about 20 m across', 'Reached by a processional stairway and bridge from the city', 'Built in the early 5th century'],
      tr: ['Merkezi sekizgen yaklaşık 20 m çapında', 'Kentten bir tören merdiveni ve köprüyle ulaşılırdı', '5. yüzyılın başında inşa edildi'],
    },
    images: [], sources: [{ title: 'Wikipedia — Hierapolis', url: 'https://en.wikipedia.org/wiki/Hierapolis' }],
    disputed: { en: 'Ancient writers already confused Philip the Apostle with Philip the Evangelist; the martyrdom in AD 80 is church tradition, not documented history.', tr: 'Antik yazarlar bile Havari Philippos ile Müjdeci Philippos’u karıştırıyordu; MS 80’deki şehitlik tarihsel bir kayıt değil, kilise geleneğidir.' },
    builder: 'martyrium', rotation: 30, view: { bearing: 220, elev: 30, dist: 190 },
  },
  {
    id: 'philip-church',
    name: { en: 'Church & Tomb of St Philip', tr: 'Aziz Philippos Kilisesi ve Mezarı' },
    lat: 37.9308, lon: 29.13061,
    category: 'christian', built: 450, until: 1354, period: { en: 'Byzantine', tr: 'Bizans' },
    summary: {
      en: 'In 2011 the excavation team announced that a Roman tomb found inside a three-aisled church below the Martyrium was the burial place of the Apostle Philip, venerated by Byzantine pilgrims. Bronze seals of pilgrims and the church built around the tomb support its importance as a shrine.',
      tr: '2011’de kazı ekibi, Martyrion’un altındaki üç nefli bir kilisenin içinde bulunan Roma dönemi mezarının Bizans hacılarınca saygı gösterilen Havari Philippos’un mezarı olduğunu duyurdu. Hacıların bronz mühürleri ve mezarın çevresine inşa edilen kilise bunun önemli bir türbe olduğunu destekler.',
    },
    facts: {
      en: ['Discovery announced by Prof. Francesco D’Andria in 2011', 'A church was built around the earlier Roman tomb'],
      tr: ['Keşif 2011’de Prof. Francesco D’Andria tarafından duyuruldu', 'Daha eski Roma mezarının çevresine bir kilise inşa edildi'],
    },
    disputed: { en: 'That this is Philip’s actual tomb is the excavator’s interpretation based on pilgrimage evidence; the tomb was empty and the claim cannot be proven scientifically.', tr: 'Bunun gerçekten Philippos’un mezarı olduğu, kazı başkanının hac kanıtlarına dayanan yorumudur; mezar boştu ve iddia bilimsel olarak kanıtlanamaz.' },
    images: [], sources: [{ title: 'Wikipedia — Hierapolis', url: 'https://en.wikipedia.org/wiki/Hierapolis' }],
    builder: 'church', builderOpts: { width: 20, length: 36 }, rotation: 30, view: { bearing: 230, elev: 26, dist: 120 },
  },
  {
    id: 'south-gate',
    name: { en: 'South Byzantine Gate', tr: 'Güney Bizans Kapısı' },
    lat: 37.92237, lon: 29.12886,
    category: 'defence', built: 400, until: 1354, period: { en: 'Late Roman / Byzantine', tr: 'Geç Roma / Bizans' },
    summary: {
      en: 'The southern end of Frontinus Street was closed by a gate in the Byzantine wall, flanked by towers. Beyond it lay the road towards Tripolis and the southern cemeteries.',
      tr: 'Frontinus Caddesi’nin güney ucu, kulelerle çevrili bir Bizans sur kapısıyla kapanıyordu. Ötesinde Tripolis’e giden yol ve güney mezarlıkları uzanırdı.',
    },
    facts: {
      en: ['Twin towers guard the passage', 'Marks the end of the 1.2 km main street'],
      tr: ['İkiz kuleler geçişi korur', '1,2 km’lik ana caddenin sonunu belirler'],
    },
    images: [], sources: [{ title: 'Wikipedia — Hierapolis', url: 'https://en.wikipedia.org/wiki/Hierapolis' }],
    builder: 'byzantineGate', rotation: 30, view: { bearing: 20, elev: 20, dist: 110 },
  },
]

export const LANDMARKS: Landmark[] = base.map((l) => ({
  ...l,
  images: IMAGES[l.id] ?? l.images,
  renders: l.builder ? [`/renders/${l.id}.jpg`, `/renders/${l.id}-2.jpg`] : [], audio: { en: audioIf(`/audio/en/${l.id}.mp3`), tr: audioIf(`/audio/tr/${l.id}.mp3`) } }))
