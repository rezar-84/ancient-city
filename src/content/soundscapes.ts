/**
 * Place soundscapes. Beds are ElevenLabs sound-generation loops; voices are ElevenLabs TTS of
 * ancient texts (rendered by scripts/sfx_elevenlabs.ts into public/audio/sfx and public/audio/voices).
 *
 * Language rule: Hellenistic → Greek, Roman → Koine Greek, Byzantine → (Byzantine) Greek.
 * Hierapolis stayed Greek-speaking under Rome; Latin was the language of the emperor's
 * administration, the army and some official inscriptions (e.g. the bilingual Frontinus Gate
 * dedication), so in the Roman era Latin is heard only at the gate and from soldiers on guard.
 * Pronunciation is the TTS voice's approximation, not a reconstruction of ancient phonology.
 */
export type Lang3 = 'grc' | 'koi' | 'la' | 'byz'

export interface Bed { id: string; prompt: string; seconds: number; loop: boolean }
export interface VoiceLine { id: string; lang: Lang3; text: string; voice: 'priest' | 'herald'; source: string; gloss: { en: string; tr: string } }

export const BEDS: Bed[] = [
  { id: 'street', seconds: 22, loop: true, prompt: 'Ancient Roman city street ambience, busy crowd chatter in the distance, footsteps on stone paving, horse hooves clopping and wooden cart wheels rolling on stone, a donkey brays, merchants calling, no music, no modern sounds' },
  { id: 'market', seconds: 22, loop: true, prompt: 'Bustling ancient marketplace, dense crowd talking and haggling, coins clinking, sheep bleating, chickens, clay pots clinking, footsteps on stone, lively but not loud, no music, no modern sounds' },
  { id: 'gate', seconds: 22, loop: true, prompt: 'Ancient stone city gate, horses and donkeys walking through, cart wheels rumbling over paving stones, travellers talking, guards calling out, wind, no music, no modern sounds' },
  { id: 'temple', seconds: 22, loop: true, prompt: 'Ancient Greek sanctuary courtyard, crackling sacrificial fire, slow plucked lyre in the distance, soft murmured prayers, doves, gentle wind, sacred calm atmosphere' },
  { id: 'theatre', seconds: 22, loop: true, prompt: 'Large ancient open-air stone theatre full of spectators, crowd murmuring, scattered applause and laughter, double-reed aulos melody echoing, distant actor declaiming, outdoor acoustics' },
  { id: 'baths', seconds: 22, loop: true, prompt: 'Roman thermal baths, warm water pouring and splashing into stone pools, voices echoing in vaulted stone halls, dripping water, faint steam hiss' },
  { id: 'fountain', seconds: 22, loop: true, prompt: 'Monumental stone fountain, water flowing from spouts and splashing into a large basin, birds chirping, light crowd nearby' },
  { id: 'spring', seconds: 22, loop: true, prompt: 'Warm thermal spring water trickling and cascading over white mineral terraces, small streams, gentle breeze, birds' },
  { id: 'necropolis-wind', seconds: 22, loop: true, prompt: 'Quiet ancient cemetery road outside a city, soft wind through dry grass and cypress trees, a few distant crows, slow footsteps on gravel, calm and sparse, no insects, no cicadas, no crickets' },
  { id: 'ploutonion', seconds: 22, loop: true, prompt: 'Sacred cave entrance, deep subterranean rumble, hissing gas vents, low eerie drone, distant chanting priests, birds fluttering away' },
  { id: 'church', seconds: 22, loop: true, prompt: 'Early Byzantine stone church interior, large reverberant space, soft footsteps of pilgrims, whispering, distant monks humming a slow chant, candles' },
  { id: 'latrine', seconds: 18, loop: true, prompt: 'Roman public latrine, water flowing through a stone channel, people chatting casually, stone room echo' },
  { id: 'breeze', seconds: 22, loop: true, prompt: 'Very gentle soft breeze over an open hillside with olive trees and dry grass, faint rustling leaves, calm and subtle, mostly quiet, no insects, no cicadas, no crickets, no birds' },
  { id: 'gust', seconds: 4, loop: false, prompt: 'single soft wind gust rising and fading through olive trees and grass, gentle and natural, no insects' },
  { id: 'birds', seconds: 5, loop: false, prompt: 'a few distant songbirds chirping briefly in the open countryside, gentle and sparse, no insects' },
  { id: 'ui-click', seconds: 0.6, loop: false, prompt: 'single soft short click of a small stone tapping on marble, subtle user interface sound' },
  { id: 'whoosh', seconds: 1.6, loop: false, prompt: 'soft gentle wind whoosh, airy camera movement, subtle and smooth' },
  { id: 'drum', seconds: 3, loop: false, prompt: 'single deep cinematic frame drum and taiko hit with a long dark reverb tail and a low brass swell, epic and dramatic, for an ancient historical game menu transition' },
  { id: 'shimmer', seconds: 2.5, loop: false, prompt: 'magical time-shift shimmer: rising airy chimes and a soft reversed cymbal swell, then a gentle sparkle, as if travelling through time' },
  { id: 'open', seconds: 1.2, loop: false, prompt: 'old parchment scroll being unrolled quickly, soft paper rustle, subtle' },
  { id: 'hover', seconds: 0.5, loop: false, prompt: 'very soft short wooden tick, tiny subtle interface hover sound' },
]

// footsteps (4 variants per surface) and landing — sandals / leather shoes of the period
const STEP_PROMPT = {
  stone: 'a single footstep of a leather sandal on smooth limestone paving, close, dry, short',
  gravel: 'a single footstep of a leather sandal on gravel and packed dirt, close, short crunch',
  grass: 'a single soft footstep on dry grass and earth, close, short rustle',
  water: 'a single footstep wading through knee-deep warm pool water, gentle slosh and splash, close, short',
}
for (const surf of ['stone', 'gravel', 'grass', 'water'] as const)
  for (let i = 1; i <= 4; i++) BEDS.push({ id: `step-${surf}-${i}`, seconds: 0.5, loop: false, prompt: STEP_PROMPT[surf] + (i > 1 ? `, variation ${i}` : '') })
BEDS.push({ id: 'splash', seconds: 1.2, loop: false, prompt: 'a person stepping and dropping into a calm outdoor stone pool, one soft splash then water settling, close, natural' })
for (let i = 1; i <= 2; i++) BEDS.push({ id: `swim-${i}`, seconds: 1.1, loop: false, prompt: 'one slow breaststroke swimming stroke in calm warm water, gentle swish and drip, close, quiet' + (i > 1 ? ', variation 2' : '') })
BEDS.push({ id: 'land', seconds: 0.6, loop: false, prompt: 'a person landing on both feet after a small jump onto stone, soft thud with sandal slap, close, short' })

export const VOICES: VoiceLine[] = [
  {
    id: 'apollo-grc', lang: 'grc', voice: 'priest', source: 'Homeric Hymn 21, To Apollo',
    text: 'Φοῖβε, σὲ μὲν καὶ κύκνος ὑπὸ πτερύγων λίγ᾽ ἀείδει, ὄχθῃ ἐπιθρῴσκων ποταμὸν πάρα δινήεντα, Πηνειόν· σὲ δ᾽ ἀοιδὸς ἔχων φόρμιγγα λίγειαν ἡδυεπὴς πρῶτόν τε καὶ ὕστατον αἰὲν ἀείδει. Καὶ σὺ μὲν οὕτω χαῖρε, ἄναξ· ἵλαμαι δέ σ᾽ ἀοιδῇ.',
    gloss: { en: 'Phoebus, of you even the swan sings… and so hail to you, lord; I seek your favour with my song.', tr: 'Phoibos, kuğu bile seni söyler… selam sana, efendim; şarkımla lütfunu dilerim.' },
  },
  {
    id: 'apollo-la', lang: 'la', voice: 'priest', source: 'Horace, Carmen Saeculare (17 BC)',
    text: 'Phoebe silvarumque potens Diana, lucidum caeli decus, o colendi semper et culti, date quae precamur tempore sacro.',
    gloss: { en: 'Phoebus, and Diana queen of the woods, bright glory of the sky… grant what we pray for at this sacred time.', tr: 'Phoebus ve ormanların hâkimi Diana, göğün parlak süsü… bu kutsal zamanda dileklerimizi verin.' },
  },
  {
    id: 'ploutonion-grc', lang: 'grc', voice: 'priest', source: 'Orphic Hymn 18, To Plouton',
    text: 'Ὦ τὸν ὑποχθόνιον ναίων δόμον, ὀμβριμόθυμε, Ταρτάρειον λειμῶνα βαθύσκιον ἠδὲ λιπαυγῆ, Ζεῦ χθόνιε, σκηπτοῦχε, τάδ᾽ ἱερὰ δέξο προθύμως.',
    gloss: { en: 'You who dwell in the house beneath the earth, strong-spirited… Zeus of the underworld, receive these rites with good will.', tr: 'Yerin altındaki evde oturan güçlü ruhlu… yeraltının Zeus’u, bu ayinleri gönülden kabul et.' },
  },
  {
    id: 'ploutonion-la', lang: 'la', voice: 'priest', source: 'Invocation in Latin (reconstructed for this presentation)',
    text: 'Dis Pater, rex inferorum, et tu, Proserpina, audite preces nostras, et placati estote huic urbi.',
    gloss: { en: 'Father Dis, king of the underworld, and you, Proserpina, hear our prayers and be at peace with this city.', tr: 'Baba Dis, yeraltının kralı, ve sen Proserpina, dualarımızı duyun ve bu kente barışla bakın.' },
  },
  {
    id: 'theatre-grc', lang: 'grc', voice: 'herald', source: 'Sophocles, Antigone 332–333',
    text: 'Πολλὰ τὰ δεινὰ κοὐδὲν ἀνθρώπου δεινότερον πέλει.',
    gloss: { en: 'Many things are wondrous, and none more wondrous than man.', tr: 'Dünyada nice harika var, ama hiçbiri insandan daha harika değil.' },
  },
  {
    id: 'theatre-la', lang: 'la', voice: 'herald', source: 'Terence, Heauton Timorumenos 77',
    text: 'Homo sum: humani nihil a me alienum puto.',
    gloss: { en: 'I am human: I consider nothing human foreign to me.', tr: 'İnsanım: insana dair hiçbir şeyi kendime yabancı saymam.' },
  },
  {
    id: 'gate-la', lang: 'la', voice: 'herald', source: 'Dedication to Domitian by the proconsul Frontinus (after the gate inscription)',
    text: 'Imperatori Caesari Domitiano Augusto, Sextus Iulius Frontinus, proconsul, portam et turres dedicavit.',
    gloss: { en: 'To the Emperor Caesar Domitian Augustus: Sextus Julius Frontinus, proconsul, dedicated the gate and towers.', tr: 'İmparator Caesar Domitianus Augustus’a: prokonsül Sextus Iulius Frontinus kapıyı ve kuleleri adadı.' },
  },
  {
    id: 'market-grc', lang: 'grc', voice: 'herald', source: 'Market calls (reconstructed for this presentation)',
    text: 'Ὠνεῖσθε, ὠνεῖσθε! Ἔρια καλά, πορφύρα Ἱεραπολιτική! Ἐλαῖον καὶ οἶνος!',
    gloss: { en: 'Buy, buy! Fine wool, Hierapolitan purple! Oil and wine!', tr: 'Alın, alın! Güzel yün, Hierapolis moru! Zeytinyağı ve şarap!' },
  },
  {
    id: 'market-la', lang: 'la', voice: 'herald', source: 'Market calls (reconstructed for this presentation)',
    text: 'Emite, emite! Lana optima, purpura Hierapolitana! Oleum et vinum!',
    gloss: { en: 'Buy, buy! The finest wool, Hierapolitan purple! Oil and wine!', tr: 'Alın, alın! En iyi yün, Hierapolis moru! Zeytinyağı ve şarap!' },
  },
  {
    id: 'church-byz', lang: 'byz', voice: 'priest', source: 'Kyrie eleison and the Trisagion (5th-century liturgy)',
    text: 'Κύριε ἐλέησον. Κύριε ἐλέησον. Κύριε ἐλέησον. Ἅγιος ὁ Θεός, Ἅγιος ἰσχυρός, Ἅγιος ἀθάνατος, ἐλέησον ἡμᾶς.',
    gloss: { en: 'Lord, have mercy. Holy God, Holy Mighty, Holy Immortal, have mercy on us.', tr: 'Rab, merhamet et. Kutsal Tanrı, Kutsal Kudretli, Kutsal Ölümsüz, bize merhamet et.' },
  },
]

/** Place → bed and voice per language era. */
export const PLACE_SOUND: Record<string, { bed: string; voice?: Partial<Record<Lang3, string>> }> = {
  travertines: { bed: 'spring' },
  'frontinus-gate': { bed: 'gate', voice: { la: 'gate-la', koi: 'gate-la' } },
  'frontinus-street': { bed: 'street', voice: { grc: 'market-grc', koi: 'market-grc', la: 'market-la' } },
  necropolis: { bed: 'necropolis-wind' },
  latrine: { bed: 'latrine' },
  agora: { bed: 'market', voice: { grc: 'market-grc', koi: 'market-grc', la: 'market-la' } },
  'byzantine-gate-n': { bed: 'gate' },
  tritons: { bed: 'fountain' },
  baths: { bed: 'baths' },
  cathedral: { bed: 'church', voice: { byz: 'church-byz' } },
  'antique-pool': { bed: 'spring' },
  apollo: { bed: 'temple', voice: { grc: 'apollo-grc', koi: 'apollo-grc', la: 'apollo-la' } },
  ploutonion: { bed: 'ploutonion', voice: { grc: 'ploutonion-grc', koi: 'ploutonion-grc', la: 'ploutonion-la' } },
  theatre: { bed: 'theatre', voice: { grc: 'theatre-grc', koi: 'theatre-grc', la: 'theatre-la' } },
  martyrium: { bed: 'church', voice: { byz: 'church-byz' } },
  'philip-church': { bed: 'church', voice: { byz: 'church-byz' } },
  'south-gate': { bed: 'gate' },
}

/** Year → language era (Rome takes over Asia in 133 BC; Constantinople founded AD 330).
 *  The Roman era is Koine Greek: the city kept speaking Greek; Latin is chosen per speaker (soldiers). */
export function langForYear(year: number): Lang3 {
  if (year < -133) return 'grc'
  if (year < 330) return 'koi'
  return 'byz'
}

export const LANG_LABEL: Record<Lang3, { en: string; tr: string }> = {
  grc: { en: 'Ancient Greek', tr: 'Antik Yunanca' },
  koi: { en: 'Koine Greek', tr: 'Koine Yunancası' },
  la: { en: 'Latin', tr: 'Latince' },
  byz: { en: 'Byzantine Greek', tr: 'Bizans Yunancası' },
}
