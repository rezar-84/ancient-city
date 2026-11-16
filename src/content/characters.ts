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
    bio: { en: 'Serves at the oracle of Apollo Archegetes above the deadly cave of Pluto. Knows every rite of the sanctuary.', tr: 'Pluton’un ölümcül mağarasının üstündeki Apollon Arkhegetes kehanet merkezinde görev yapar. Kutsal alanın her ayinini bilir.' },
    portrait: '/characters/theano.jpg', colors: { body: '#efe8dc', accent: '#c9a45c' },
    spawn: { lat: 37.92632, lon: 29.12655, heading: 95 },
  },
  {
    id: 'nikias', name: 'Nikias', gender: 'm', era: 'hellenistic', year: -150,
    role: { en: 'Wool merchant', tr: 'Yün tüccarı' },
    bio: { en: 'Buys fleece from the Lycus valley and sells cloth dyed in the city’s mineral water to traders from Pergamon.', tr: 'Lykos vadisinden yapağı alır, kentin mineralli suyuyla boyanmış kumaşları Bergamalı tüccarlara satar.' },
    portrait: '/characters/nikias.jpg', colors: { body: '#8a5a3a', accent: '#5b2a4a' },
    spawn: { lat: 37.9282, lon: 29.12459, heading: 150 },
  },
  {
    id: 'aurelia', name: 'Aurelia', gender: 'f', era: 'roman', year: 200,
    role: { en: 'Dyer of the purple-dye guild', tr: 'Mor boyacılar loncasından boyacı' },
    bio: { en: 'Member of the guild of purple-dyers, whose name is carved on tombs in the necropolis. Her hands never lose their colour.', tr: 'Adı nekropoldeki mezarlara kazınmış mor boyacılar loncasının üyesi. Elleri rengini hiç kaybetmez.' },
    portrait: '/characters/aurelia.jpg', colors: { body: '#6b2f57', accent: '#d8c6a8' },
    spawn: GATE,
  },
  {
    id: 'ammianos', name: 'Marcus Aurelius Ammianos', gender: 'm', era: 'roman', year: 200,
    role: { en: 'Scribe of the proconsul', tr: 'Prokonsülün kâtibi' },
    bio: { en: 'Copies decrees in Greek and Latin for the governor of Asia. Today he must find the theatre before the Severan festival begins.', tr: 'Asya valisi için Yunanca ve Latince kararnameleri kopyalar. Bugün Severus şenliği başlamadan tiyatroyu bulmalı.' },
    portrait: '/characters/ammianos.jpg', colors: { body: '#efe8dc', accent: '#9c2f2f' },
    spawn: GATE,
  },
  {
    id: 'eudokia', name: 'Eudokia', gender: 'f', era: 'byzantine', year: 500,
    role: { en: 'Pilgrim', tr: 'Hacı' },
    bio: { en: 'Has walked from Constantinople to pray at the shrine of the Apostle Philip and fill her flask with holy oil.', tr: 'Havari Philippos’un türbesinde dua etmek ve matarasını kutsal yağla doldurmak için Konstantinopolis’ten yürüyerek geldi.' },
    portrait: '/characters/eudokia.jpg', colors: { body: '#5a6a7a', accent: '#d8c6a8' },
    spawn: { lat: 37.92285, lon: 29.12851, heading: 330 },
  },
  {
    id: 'philippos', name: 'Brother Philippos', gender: 'm', era: 'byzantine', year: 500,
    role: { en: 'Monk', tr: 'Keşiş' },
    bio: { en: 'Keeps the lamps of the octagonal Martyrium on the hill and guides pilgrims up the stairway from the city.', tr: 'Tepedeki sekizgen Martyrion’un kandillerini yakar ve hacılara kentten çıkan merdivende rehberlik eder.' },
    portrait: '/characters/philippos.jpg', colors: { body: '#2e2620', accent: '#8a6a4a' },
    spawn: { lat: 37.9297, lon: 29.1290, heading: 60 },
  },
]
