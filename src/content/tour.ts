import type { L10n } from './types'
import { audioIf } from './audio'

export interface TourStep {
  id: string
  title: L10n
  text: L10n
  /** landmark to frame, or a free position */
  landmark?: string
  at?: [number, number]
  view: { bearing: number; elev: number; dist: number }
  flight?: number
  spin?: number
  audio?: { en?: string; tr?: string }
}

/** Narrated guided tour (~6 minutes). Audio: public/audio/{en,tr}/tour-<id>.mp3 (scripts/tts_elevenlabs.py). */
const steps: TourStep[] = [
  {
    id: 'welcome',
    title: { en: 'The Holy City', tr: 'Kutsal Kent' },
    at: [37.9265, 29.1245], view: { bearing: 250, elev: 28, dist: 1700 }, flight: 4, spin: 0.35,
    text: {
      en: 'Welcome to Hierapolis, the Holy City. Two thousand years ago, on this plateau in Phrygia, hot springs bubbled out of the earth and spilled over the cliff, painting the hillside white. Here a Greek city was founded, probably by the kings of Pergamon, though some scholars credit the Seleucids. It would become one of the great spa towns of the Roman world.',
      tr: 'Kutsal Kent Hierapolis’e hoş geldiniz. İki bin yıl önce Frigya’daki bu platoda sıcak su kaynakları topraktan fışkırır, yamaçtan aşağı dökülerek tepeyi beyaza boyardı. Burada, muhtemelen Bergama kralları tarafından —bazı araştırmacılar Selevkoslara bağlasa da— bir Yunan kenti kuruldu. Bu kent Roma dünyasının büyük kaplıca kentlerinden biri olacaktı.',
    },
  },
  {
    id: 'travertines',
    title: { en: 'The white terraces', tr: 'Beyaz teraslar' },
    landmark: 'travertines', view: { bearing: 255, elev: 18, dist: 700 },
    text: {
      en: 'These are the travertines of Pamukkale — the cotton castle. As the warm, mineral-rich water cools in the air, it leaves behind layers of calcium carbonate, building pools and frozen waterfalls of stone. The springs gave the city its wealth, its healing baths, and its sacred aura.',
      tr: 'Bunlar Pamukkale’nin, yani pamuk kalenin travertenleri. Ilık ve mineralli su havada soğudukça geride kalsiyum karbonat katmanları bırakır; taştan havuzlar ve donmuş şelaleler oluşur. Kaynaklar kente zenginliğini, şifalı hamamlarını ve kutsal havasını verdi.',
    },
  },
  {
    id: 'necropolis',
    title: { en: 'City of the dead', tr: 'Ölüler kenti' },
    landmark: 'necropolis', view: { bearing: 200, elev: 26, dist: 480 },
    text: {
      en: 'Arriving from the north, on the road from Tripolis, travellers first passed through the Northern Necropolis — more than twelve hundred tombs lining the road. Many people came here hoping to be healed, and many were buried here: in earth mounds, in house-shaped tombs, and in carved stone sarcophagi.',
      tr: 'Kuzeyden, Tripolis yolundan gelen yolcular önce Kuzey Nekropol’den geçerdi — yol boyunca dizilmiş bin iki yüzden fazla mezar. Pek çok kişi şifa bulma umuduyla buraya geldi ve pek çoğu burada gömüldü: toprak tümülüslerde, ev biçimli mezarlarda ve oyma taş lahitlerde.',
    },
  },
  {
    id: 'gate',
    title: { en: 'Frontinus Gate', tr: 'Frontinus Kapısı' },
    landmark: 'frontinus-gate', view: { bearing: 315, elev: 12, dist: 100 },
    text: {
      en: 'The road ends at the Frontinus Gate: three arches between two round towers, dedicated to Emperor Domitian around AD 85. Beyond it, the colonnaded main street runs straight for more than a kilometre, and the whole city is laid out on a grid parallel to it.',
      tr: 'Yol, Frontinus Kapısı’nda sona erer: MS 85 dolaylarında İmparator Domitianus’a adanmış, iki yuvarlak kule arasında üç kemer. Ötesinde sütunlu ana cadde bir kilometreden fazla dümdüz uzanır ve tüm kent ona paralel bir ızgara üzerine kuruludur.',
    },
  },
  {
    id: 'agora',
    title: { en: 'Market and street', tr: 'Pazar ve cadde' },
    landmark: 'agora', view: { bearing: 235, elev: 30, dist: 380 },
    text: {
      en: 'Beside the street lay the vast agora, one of the largest market squares of the Roman world. Hierapolis grew rich on wool and textiles dyed with its mineral water, and its guilds of dyers, weavers and merchants left their names on inscriptions all over the city.',
      tr: 'Caddenin yanında Roma dünyasının en büyük pazar meydanlarından biri olan geniş agora uzanırdı. Hierapolis, mineralli suyuyla boyanan yün ve dokumalarla zenginleşti; boyacı, dokumacı ve tüccar loncaları adlarını kentin her yerindeki yazıtlarda bıraktı.',
    },
  },
  {
    id: 'ploutonion',
    title: { en: 'The Gate to Hell', tr: 'Cehennem Kapısı' },
    landmark: 'ploutonion', view: { bearing: 215, elev: 26, dist: 90 },
    text: {
      en: 'Just south of the Sanctuary of Apollo lies the Ploutonion, a cave sacred to Pluto, lord of the underworld. Its breath is deadly carbon dioxide. Ancient writers tell of birds dropping dead at the entrance, while priests walked in unharmed. Archaeologists identified its sanctuary in 2013.',
      tr: 'Apollon Kutsal Alanı’nın hemen güneyinde, yeraltının efendisi Pluton’a adanmış bir mağara olan Plutonion yer alır. Nefesi ölümcül karbondioksittir. Antik yazarlar girişte kuşların ölüp düştüğünü, rahiplerin ise zarar görmeden içeri girdiğini anlatır. Arkeologlar kutsal alanını 2013’te tanımladı.',
    },
  },
  {
    id: 'theatre',
    title: { en: 'The theatre', tr: 'Tiyatro' },
    landmark: 'theatre', view: { bearing: 250, elev: 38, dist: 200 },
    flight: 3, spin: 0.3,
    text: {
      en: 'Carved into the hillside, the theatre held an estimated ten to twelve thousand spectators. Its stage building, finished under Septimius Severus, was decorated with reliefs of Apollo, Artemis and Dionysus. Italian archaeologists, working here since 1957, have raised many of its columns again.',
      tr: 'Yamaca oyulmuş tiyatro tahminen on ila on iki bin seyirci alırdı. Septimius Severus döneminde tamamlanan sahne binası Apollon, Artemis ve Dionysos kabartmalarıyla süslüydü. 1957’den beri burada çalışan İtalyan arkeologlar sütunlarının çoğunu yeniden ayağa kaldırdı.',
    },
  },
  {
    id: 'martyrium',
    title: { en: 'Pilgrims of St Philip', tr: 'Aziz Philippos’un hacıları' },
    landmark: 'martyrium', view: { bearing: 225, elev: 28, dist: 230 },
    text: {
      en: 'In Christian times, Hierapolis became a pilgrimage city. Tradition holds that the Apostle Philip was martyred here, and in the fifth century an octagonal shrine was built on the hill. In 2011, excavators identified a nearby tomb, venerated by pilgrims, as the tomb of Philip himself.',
      tr: 'Hristiyanlık döneminde Hierapolis bir hac kentine dönüştü. Geleneğe göre Havari Philippos burada şehit edildi ve beşinci yüzyılda tepeye sekizgen bir türbe inşa edildi. 2011’de kazıcılar yakındaki, hacıların saygı gösterdiği bir mezarı Philippos’un mezarı olarak tanımladı.',
    },
  },
  {
    id: 'farewell',
    title: { en: 'A living heritage', tr: 'Yaşayan miras' },
    at: [37.9262, 29.1255], view: { bearing: 280, elev: 34, dist: 1500 }, flight: 4, spin: 0.4,
    text: {
      en: 'Earthquakes shook the city again and again until it was abandoned in the fourteenth century. Today Hierapolis and Pamukkale are a UNESCO World Heritage Site, where nature and history meet. Switch to “Today” to see the ruins as they stand now — and come and walk these streets yourself.',
      tr: 'Depremler kenti defalarca sarstı ve sonunda on dördüncü yüzyılda terk edildi. Bugün Hierapolis ve Pamukkale, doğa ile tarihin buluştuğu bir UNESCO Dünya Mirası Alanı. Kalıntıların bugünkü hâlini görmek için “Bugün”e geçin — ve gelin, bu sokaklarda kendiniz yürüyün.',
    },
  },
]

export const TOUR: TourStep[] = steps.map((s) => ({ ...s, audio: s.audio ?? { en: audioIf(`/audio/en/tour-${s.id}.mp3`), tr: audioIf(`/audio/tr/tour-${s.id}.mp3`) } }))
