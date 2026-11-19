import type { L10n } from './types'

/**
 * Playable characters for the first-person "Walk the city" mode. Names and roles are invented but
 * typical of Hierapolis (its inscriptions name wool and purple-dye guilds, priests of Apollo,
 * officials of the province of Asia, and Christian pilgrims to the shrine of St Philip).
 */
export interface Character {
  id: string
  name: string
  gender: 'f' | 'm'
  era: 'hellenistic' | 'roman' | 'byzantine'
  /** timeline year the city is shown at */
  year: number
  role: L10n
  bio: L10n
  /** deeper multi-sentence backstory for the character drawer & voice narration */
  backstory: L10n
  /** personal daily objective in the city */
  goal: L10n
  /** Web Speech synthesis voice tuning */
  voice: { pitch: number; rate: number }
  /** period-language self-introduction */
  greeting: { text: string; gloss: L10n }
  /** in-character reflections when visiting specific landmarks */
  reflections: Record<string, L10n>
  /** portrait image (public/characters) */
  portrait: string
  /** clothing colours for the avatar's shadow-casting body */
  colors: { body: string; accent: string }
  /** where the walk starts: lat/lon and heading (deg, 0 = north, clockwise) */
  spawn: { lat: number; lon: number; heading: number }
}

export const ERA_LABEL: Record<Character['era'], L10n & { years: L10n }> = {
  hellenistic: { en: 'Hellenistic', tr: 'Helenistik', years: { en: 'c. 150 BC', tr: 'MÖ y. 150' } },
  roman: { en: 'Roman', tr: 'Roma', years: { en: 'c. AD 200', tr: 'MS y. 200' } },
  byzantine: { en: 'Byzantine', tr: 'Bizans', years: { en: 'c. AD 500', tr: 'MS y. 500' } },
}

// Frontinus Gate, looking down the plateia (bearing ~150°)
const GATE = { lat: 37.9314, lon: 29.12228, heading: 150 }

export const CHARACTERS: Character[] = [
  {
    id: 'theano', name: 'Theano', gender: 'f', era: 'hellenistic', year: -150,
    role: { en: 'Priestess of Apollo', tr: 'Apollon rahibesi' },
    bio: { en: 'Serves in the sanctuary of Apollo, beside the deadly cave of Pluto. Knows every rite of the sanctuary.', tr: 'Pluton’un ölümcül mağarasının yanındaki Apollon kutsal alanında görev yapar. Kutsal alanın her ayinini bilir.' },
    backstory: {
      en: 'Born into a Pergamene priestly family settled in Hierapolis under King Eumenes II, Theano tends the sacred laurel and the altars of Apollo. Each dawn she inspects the deadly mist rising from the Ploutonion beside the sanctuary, warning pilgrims where the breath of Hades pools.',
      tr: 'Kral II. Eumenes döneminde Hierapolis’e yerleşen Bergamalı bir rahip ailesinde doğan Theano, Apollon’un kutsal defnesine ve sunaklarına bakar. Her şafakta kutsal alanın yanındaki Plutonion’dan yükselen ölümcül buharı kontrol eder ve Hades’in nefesinin biriktiği yerler konusunda hacıları uyarır.',
    },
    goal: {
      en: 'Inspect the Ploutonion vapour before noon, draw spring water from the Sacred Pool, and greet the merchants along the lower street.',
      tr: 'Öğleden önce Plutonion buharını kontrol et, Kutsal Havuz’dan kaynak suyu al ve aşağı caddedeki tüccarları selamla.',
    },
    voice: { pitch: 1.06, rate: 0.93 },
    greeting: { text: 'Khaire, xene — Apollo watches over this hill.', gloss: { en: 'Greetings, stranger — Apollo watches over this hill.', tr: 'Selam yabancı — Apollon bu tepeyi gözetir.' } },
    reflections: {
      apollo: { en: 'Our Hellenistic temple sits directly on the seismic fault. Every oracle spoken here rises from the earth’s own tremor.', tr: 'Helenistik tapınağımız tam fay hattının üzerinde durur. Burada söylenen her kehanet yerin kendi sarsıntısından doğar.' },
      ploutonion: { en: 'Do not step past the low curb when the air is still; the galli priests alone know how to hold their breath above the white mist.', tr: 'Hava durgunken alçak bordürü geçme; beyaz buharın üstünde nefesini tutmayı yalnızca galli rahipleri bilir.' },
      'antique-pool': { en: 'The warm spring never freezes, even when snow lies on Mount Cadmus. Its waters bind our limestone terrace year by year.', tr: 'Sıcak kaynak, Kadmos Dağı’na kar yağdığında bile donmaz. Suları her yıl traverten teraslarımızı yeniden örer.' },
      travertines: { en: 'From the cliff edge you can see the whole Lycus valley shining below our white stone cascade.', tr: 'Uçurumun kenarından beyaz taş şelalemizin altında parlayan tüm Lykos vadisini görebilirsin.' },
    },
    portrait: '/characters/theano.jpg', colors: { body: '#efe8dc', accent: '#c9a45c' },
    spawn: { lat: 37.92632, lon: 29.12655, heading: 95 },
  },
  {
    id: 'nikias', name: 'Nikias', gender: 'm', era: 'hellenistic', year: -150,
    role: { en: 'Wool merchant', tr: 'Yün tüccarı' },
    bio: { en: 'Buys fleece from the Lycus valley and sells cloth dyed in the city’s mineral water to traders from Pergamon.', tr: 'Lykos vadisinden yapağı alır, kentin mineralli suyuyla boyanmış kumaşları Bergamalı tüccarlara satar.' },
    backstory: {
      en: 'Nikias grew up shearing glossy black and white flocks along the Lycus pastures. He discovered that Hierapolis’s lime-rich thermal channels fix madder root into a crimson almost indistinguishable from Tyrian purple—making his bolts of wool prized from Ephesus to Pergamon.',
      tr: 'Nikias, Lykos meralarında parlak siyah ve beyaz sürüleri kırkarak büyüdü. Hierapolis’in kireçli termal kanallarının kökboyayı Sur morundan ayırt edilemeyecek bir kızıla sabitlediğini keşfetti; kumaşları Efes’ten Bergama’ya kadar aranır.',
    },
    goal: {
      en: 'Check the wool-washing channels near the springs, bargain in the sanctuary forecourt, and inspect the road north toward the necropolis.',
      tr: 'Kaynakların yakınındaki yün yıkama kanallarını kontrol et, kutsal alan önünde pazarlık yap ve kuzeydeki nekropol yolunu incele.',
    },
    voice: { pitch: 0.96, rate: 1.02 },
    greeting: { text: 'Khaire! Finest Phrygian fleece, washed in warm spring water.', gloss: { en: 'Hello! Finest Phrygian fleece, washed in warm spring water.', tr: 'Merhaba! Sıcak kaynak suyunda yıkanmış en iyi Frigya yapağısı.' } },
    reflections: {
      'antique-pool': { en: 'Our dyers owe half their fortune to these mineral waters—no alum from abroad mordants wool half as fast.', tr: 'Boyacılarımız servetinin yarısını bu mineralli sulara borçludur; dışarıdan gelen hiçbir şap yünü bu kadar hızlı sabitlemez.' },
      necropolis: { en: 'Even out here among the tumuli, you can read the wealth of our wool guilds in every carved sarcophagus.', tr: 'Burada, tümülüslerin arasında bile, yün loncalarımızın zenginliğini her oyma lahitte okuyabilirsin.' },
      apollo: { en: 'Before a caravan leaves for Pergamon, every merchant drops a silver drachma at Apollo’s steps for a safe crossing.', tr: 'Bergama’ya kervan çıkmadan önce her tüccar güvenli yolculuk için Apollon’un basamaklarına bir gümüş drahmi bırakır.' },
    },
    portrait: '/characters/nikias.jpg', colors: { body: '#8a5a3a', accent: '#5b2a4a' },
    spawn: { lat: 37.9282, lon: 29.12459, heading: 150 },
  },
  {
    id: 'aurelia', name: 'Aurelia', gender: 'f', era: 'roman', year: 200,
    role: { en: 'Dyer of the purple-dye guild', tr: 'Mor boyacılar loncasından boyacı' },
    bio: { en: 'Member of the guild of purple-dyers, whose name is carved on tombs in the necropolis. Her hands never lose their colour.', tr: 'Adı nekropoldeki mezarlara kazınmış mor boyacılar loncasının üyesi. Elleri rengini hiç kaybetmez.' },
    backstory: {
      en: 'Aurelia runs a family vat-house off Frontinus Street and holds a seat in the guild of purple-dyers, the ergasia of the porphyrabaphoi, whose name is carved on Hierapolis’s tombs and statue bases. Under Septimius Severus, her guild is helping to pay for the marble decoration of the theatre’s new stage building.',
      tr: 'Aurelia, Frontinus Caddesi yakınında bir aile boyahanesi işletir ve adı Hierapolis’in mezarlarına ve heykel kaidelerine kazınmış mor boyacılar loncasının, porphyrabaphoi ergasiası’nın üyesidir. Septimius Severus döneminde loncası, tiyatronun yeni sahne binasının mermer bezemesinin masraflarına katkıda bulunuyor.',
    },
    goal: {
      en: 'Walk through Frontinus Gate down the colonnaded Plateia, check the public latrine and Great Baths, and deliver dyed wool toward the Theatre.',
      tr: 'Frontinus Kapısı’ndan sütunlu Plateia’ya yürü, umumi latrinayı ve Büyük Hamam’ı gör, boyalı yünleri Tiyatro’ya doğru ulaştır.',
    },
    voice: { pitch: 1.08, rate: 0.98 },
    greeting: { text: 'Khaire! Mind the wet carts along Frontinus Street.', gloss: { en: 'Greetings! Mind the wet carts along Frontinus Street.', tr: 'Selam! Frontinus Caddesi’ndeki ıslak arabalara dikkat et.' } },
    reflections: {
      'frontinus-gate': { en: 'Sextus Julius Frontinus raised these three travertine arches more than a century ago; every wool wagon from Tripolis and the northern roads rumbles beneath them.', tr: 'Sextus Julius Frontinus bu üç traverten kemeri bir asırdan uzun süre önce dikti; Tripolis’ten ve kuzey yollarından gelen her yün arabası altından geçer.' },
      'frontinus-street': { en: 'Fourteen metres wide, shaded on both sides—you can smell cedar timber, warm bread, and madder dye under every portico.', tr: 'On dört metre genişliğinde, iki yanı gölgeli; her portikonun altında sedir kerestesi, sıcak ekmek ve kökboya kokusu duyarsın.' },
      latrine: { en: 'Running spring water flushes the channel beneath the stone seats all day—a mark of a proud Roman city.', tr: 'Akan kaynak suyu taş oturakların altındaki kanalı gün boyu temizler; gururlu bir Roma kentinin nişanesi.' },
      baths: { en: 'After ten hours over steaming dye vats, nothing restores my shoulders like the vaulted caldarium of the Great Baths.', tr: 'Buharlı boya kazanlarının başında geçen on saatten sonra omuzlarımı Büyük Hamam’ın tonozlu sıcaklığından başka hiçbir şey açmaz.' },
      theatre: { en: 'The marble stage wall gleams all the way to the valley. Our guild is helping to pay for its marble ceilings—soon our name will be carved on the architrave!', tr: 'Mermer sahne duvarı vadiye kadar parlıyor. Loncamız mermer tavanlarının masrafına katkıda bulunuyor; yakında adımız arşitrava kazınacak!' },
      agora: { en: 'Two hundred and eighty metres of marble market—wool bales from the east, olive oil from the west, and magistrates in the basilica above.', tr: 'İki yüz seksen metrelik mermer pazar; doğudan yün balyaları, batıdan zeytinyağı ve yukarıdaki bazilikada yargıçlar.' },
    },
    portrait: '/characters/aurelia.jpg', colors: { body: '#6b2f57', accent: '#d8c6a8' },
    spawn: GATE,
  },
  {
    id: 'ammianos', name: 'Marcus Aurelius Ammianos', gender: 'm', era: 'roman', year: 200,
    role: { en: 'Scribe of the proconsul', tr: 'Prokonsülün kâtibi' },
    bio: { en: 'Copies decrees in Greek and Latin for the governor of Asia. Today he must find the theatre before the Severan festival begins.', tr: 'Asya valisi için Yunanca ve Latince kararnameleri kopyalar. Bugün Severus şenliği başlamadan tiyatroyu bulmalı.' },
    backstory: {
      en: 'Educated in Smyrna and fluent in both Attic Greek and Chancery Latin, Ammianos drafts bilingual civic decrees for the provincial governor. Greek is the language of the city, its council and its markets; Latin is kept for the emperor’s letters and the governor’s edicts.',
      tr: 'Smyrna’da eğitim görmüş, hem Attika Yunancasına hem de Latinceye hâkim olan Ammianos, eyalet valisi için iki dilli kent kararnameleri yazar. Kentin, meclisinin ve pazarlarının dili Yunancadır; Latince imparatorun mektupları ve valinin fermanları içindir.',
    },
    goal: {
      en: 'Carry the governor’s festival edict from Frontinus Gate past the North Agora and Temple of Apollo up to the Severan Theatre.',
      tr: 'Valinin şenlik fermanını Frontinus Kapısı’ndan Kuzey Agora ve Apollon Tapınağı’nı geçerek Severus Tiyatrosu’na ulaştır.',
    },
    voice: { pitch: 0.92, rate: 0.96 },
    greeting: { text: 'Ave, civis! By decree of the proconsul, the festival opens at the ninth hour.', gloss: { en: 'Hail, citizen! By decree of the proconsul, the festival opens at the ninth hour.', tr: 'Selam yurttaş! Prokonsülün fermanıyla şenlik dokuzuncu saatte başlıyor.' } },
    reflections: {
      'frontinus-gate': { en: 'Notice the dedicatory inscription on the gate—Latin and Greek cut side by side so no traveller forgets Rome’s peace.', tr: 'Kapıdaki adak yazıtına bak; hiçbir yolcu Roma barışını unutmasın diye Latince ve Yunanca yan yana kazınmış.' },
      theatre: { en: 'Some ten thousand seats in fifty rows, and new reliefs of Apollo and Artemis are being carved for the Severan stage.', tr: 'Elli sırada on bin kadar oturma yeri; Severus sahnesi için Apollon ile Artemis’in yeni kabartmaları oyuluyor.' },
      apollo: { en: 'This old precinct was built on the very fault that breathes out deadly vapours; Apollo’s oracle is still consulted here.', tr: 'Bu eski kutsal alan, ölümcül buharlar salan fay hattının tam üzerine kurulmuş; Apollon’un kehanetine hâlâ burada danışılıyor.' },
      agora: { en: 'In the two-storey Stoa-Basilica on the eastern terrace, contracts are sealed in wax before the agoranomos.', tr: 'Doğu terasındaki iki katlı Stoa-Bazilika’da sözleşmeler agoranomos huzurunda balmumuyla mühürlenir.' },
    },
    portrait: '/characters/ammianos.jpg', colors: { body: '#efe8dc', accent: '#9c2f2f' },
    spawn: GATE,
  },
  {
    id: 'eudokia', name: 'Eudokia', gender: 'f', era: 'byzantine', year: 500,
    role: { en: 'Pilgrim', tr: 'Hacı' },
    bio: { en: 'Has walked from Constantinople to pray at the shrine of the Apostle Philip and fill her flask with holy oil.', tr: 'Havari Philippos’un türbesinde dua etmek ve matarasını kutsal yağla doldurmak için Konstantinopolis’ten yürüyerek geldi.' },
    backstory: {
      en: 'For forty days Eudokia travelled the imperial post-road across Bithynia and Phrygia with a clay eulogia flask tied to her woollen belt. She carries prayers for her ailing sister back in Constantinople, trusting the Apostle Philip’s hillside shrine and the healing thermal waters below.',
      tr: 'Eudokia, yün kuşağına bağlı pişmiş toprak eulogia matarasıyla Bithynia ve Frigya boyunca kırk gün yürüdü. Konstantinopolis’teki hasta kız kardeşi için dualar taşıyor; tepedeki Havari Philippos türbesine ve aşağıdaki şifalı sulara umut bağlıyor.',
    },
    goal: {
      en: 'Pass through the South Byzantine Gate, pray in the three-aisled Cathedral, and climb the eastern hill to the Church and Martyrium of St Philip.',
      tr: 'Güney Bizans Kapısı’ndan geç, üç nefli Katedral’de dua et ve doğu tepesindeki Aziz Philippos Kilisesi ile Martyrion’una çık.',
    },
    voice: { pitch: 1.12, rate: 0.94 },
    greeting: { text: 'Eirene soi — may the Apostle bless your steps.', gloss: { en: 'Peace to you — may the Apostle bless your steps.', tr: 'Esenlik seninle olsun — Havari adımlarını kutsasın.' } },
    reflections: {
      'south-gate': { en: 'Look at the carved blocks from older buildings set right into these city walls—old pagan stone now guards a Christian town.', tr: 'Kent surlarına örülmüş, eski yapılardan kalma oyma bloklara bak; kadim taşlar artık bir Hristiyan kentini koruyor.' },
      cathedral: { en: 'Incense drifts across the marble templon screen while the choir chants beneath the timber roof.', tr: 'Ahşap çatının altında koro ilahi söylerken tütsü dumanı mermer templon paravanından süzülüyor.' },
      'philip-church': { en: 'They built the whole church around the apostle’s first-century stone tomb so every pilgrim can bow right beside it.', tr: 'Her hacı hemen yanında eğilebilsin diye bütün kiliseyi havarinin birinci yüzyıldan kalma taş mezarının çevresine kurmuşlar.' },
      martyrium: { en: 'Chapels and arches all around one radiant octagon—after forty days on the road, my feet forget every mile up here.', tr: 'Işıltılı bir sekizgenin çevresinde şapeller ve kemerler; kırk günlük yürüyüşten sonra ayaklarım burada tüm yorgunluğu unutuyor.' },
    },
    portrait: '/characters/eudokia.jpg', colors: { body: '#5a6a7a', accent: '#d8c6a8' },
    spawn: { lat: 37.92285, lon: 29.12851, heading: 330 },
  },
  {
    id: 'philippos', name: 'Brother Philippos', gender: 'm', era: 'byzantine', year: 500,
    role: { en: 'Monk', tr: 'Keşiş' },
    bio: { en: 'Keeps the lamps of the octagonal Martyrium on the hill and guides pilgrims up the stairway from the city.', tr: 'Tepedeki sekizgen Martyrion’un kandillerini yakar ve hacılara kentten çıkan merdivende rehberlik eder.' },
    backstory: {
      en: 'Once a stonecutter from Laodicea, Brother Philippos took monastic vows after the great tremors shook the Lycus valley. Now he trims olive-oil wicks in the Martyrium’s bronze polycandela, watches the valley’s weather, and welcomes weary travellers arriving through the North Byzantine Gate.',
      tr: 'Bir zamanlar Laodikeialı bir taş ustası olan Keşiş Philippos, Lykos vadisini sarsan büyük depremlerden sonra keşişlik yemini etti. Şimdi Martyrion’un bronz kandillerinin fitillerini keser, vadinin havasını gözler ve Kuzey Bizans Kapısı’ndan gelen yorgun yolcuları karşılar.',
    },
    goal: {
      en: 'Tend the lamps of the Martyrium and Tomb Church, descend to the Cathedral, and greet pilgrims arriving along the old Plateia.',
      tr: 'Martyrion ve Mezar Kilisesi’nin kandillerine bak, Katedral’e in ve eski Plateia boyunca gelen hacıları karşıla.',
    },
    voice: { pitch: 0.84, rate: 0.90 },
    greeting: { text: 'Kyrie eleison — welcome to the holy hill of Hierapolis.', gloss: { en: 'Lord have mercy — welcome to the holy hill of Hierapolis.', tr: 'Tanrım merhamet eyle — Hierapolis’in kutsal tepesine hoş geldin.' } },
    reflections: {
      martyrium: { en: 'Twenty-eight small rooms ring the central octagon—every one fills with pilgrims at the feast of St Philip.', tr: 'Merkezdeki sekizgeni yirmi sekiz küçük oda çevreler; Aziz Philippos yortusunda hepsi hacılarla dolar.' },
      'philip-church': { en: 'We keep oil lamps burning night and day over the old Roman tomb where we believe the Apostle was laid to rest.', tr: 'Havarinin defnedildiğine inandığımız eski Roma mezarının üstünde gece gündüz zeytinyağı kandilleri yakarız.' },
      cathedral: { en: 'The bishop’s synthronon curves behind the altar, facing down the nave toward the old colonnaded street.', tr: 'Piskoposun synthronon sıraları sunağın arkasında kıvrılır, neften eski sütunlu caddeye doğru bakar.' },
      'byzantine-gate-n': { en: 'Builders in the days of Theodosius raised these square towers from the stones of older buildings, and they still stand firm above the road.', tr: 'Theodosius zamanının ustaları bu kare kuleleri eski yapıların taşlarından ördü; hâlâ yolun üstünde sapasağlam duruyorlar.' },
    },
    portrait: '/characters/philippos.jpg', colors: { body: '#2e2620', accent: '#8a6a4a' },
    spawn: { lat: 37.9297, lon: 29.1290, heading: 60 },
  },
]
