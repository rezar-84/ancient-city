import type { Lang3 } from './soundscapes'

/** Short lines townspeople say when you pass close in walk mode. Rendered by
 *  scripts/barks_elevenlabs.ts into public/audio/barks/<id>.mp3. Pronunciation is approximate. */
export interface Bark { id: string; lang: Lang3; text: string; gender: 'm' | 'f' | 'any'; gloss: { en: string; tr: string } }

export const BARKS: Bark[] = [
  // Greek (Hellenistic)
  { id: 'grc-1', lang: 'grc', gender: 'any', text: 'Χαῖρε!', gloss: { en: 'Greetings!', tr: 'Selam!' } },
  { id: 'grc-2', lang: 'grc', gender: 'm', text: 'Χαῖρε, ὦ ξένε.', gloss: { en: 'Hello, stranger.', tr: 'Merhaba, yabancı.' } },
  { id: 'grc-3', lang: 'grc', gender: 'f', text: 'Πόθεν εἶ;', gloss: { en: 'Where are you from?', tr: 'Nerelisin?' } },
  { id: 'grc-4', lang: 'grc', gender: 'm', text: 'Ἐκποδών!', gloss: { en: 'Out of the way!', tr: 'Yoldan çekil!' } },
  { id: 'grc-5', lang: 'grc', gender: 'f', text: 'Οἱ θεοί σε φυλάττοιεν.', gloss: { en: 'May the gods protect you.', tr: 'Tanrılar seni korusun.' } },
  { id: 'grc-6', lang: 'grc', gender: 'm', text: 'Θερμὸν τὸ ὕδωρ σήμερον.', gloss: { en: 'The water is warm today.', tr: 'Su bugün sıcak.' } },
  { id: 'grc-7', lang: 'grc', gender: 'f', text: 'Ὠνεῖσθε ἔρια καλά!', gloss: { en: 'Buy fine wool!', tr: 'Güzel yün alın!' } },
  { id: 'grc-8', lang: 'grc', gender: 'm', text: 'Πρὸς τὸ ἱερὸν τοῦ Ἀπόλλωνος βαδίζω.', gloss: { en: 'I am going to the sanctuary of Apollo.', tr: 'Apollon’un kutsal alanına gidiyorum.' } },
  // Latin (Roman)
  { id: 'la-1', lang: 'la', gender: 'any', text: 'Salve!', gloss: { en: 'Hello!', tr: 'Merhaba!' } },
  { id: 'la-2', lang: 'la', gender: 'm', text: 'Salve, peregrine.', gloss: { en: 'Hello, stranger.', tr: 'Merhaba, yabancı.' } },
  { id: 'la-3', lang: 'la', gender: 'm', text: 'Cave! Cede viam!', gloss: { en: 'Watch out! Make way!', tr: 'Dikkat! Yol ver!' } },
  { id: 'la-4', lang: 'la', gender: 'f', text: 'Unde venis?', gloss: { en: 'Where do you come from?', tr: 'Nereden geliyorsun?' } },
  { id: 'la-5', lang: 'la', gender: 'f', text: 'Ad thermas eo.', gloss: { en: 'I am going to the baths.', tr: 'Hamama gidiyorum.' } },
  { id: 'la-6', lang: 'la', gender: 'm', text: 'Di te servent.', gloss: { en: 'May the gods keep you.', tr: 'Tanrılar seni korusun.' } },
  { id: 'la-7', lang: 'la', gender: 'f', text: 'Emite lanam purpuream!', gloss: { en: 'Buy purple wool!', tr: 'Mor yün alın!' } },
  { id: 'la-8', lang: 'la', gender: 'm', text: 'Quid novi?', gloss: { en: 'What’s new?', tr: 'Ne var ne yok?' } },
  // Byzantine Greek
  { id: 'byz-1', lang: 'byz', gender: 'any', text: 'Εἰρήνη σοι.', gloss: { en: 'Peace be with you.', tr: 'Selam sana.' } },
  { id: 'byz-2', lang: 'byz', gender: 'm', text: 'Ὁ Κύριος μετὰ σοῦ.', gloss: { en: 'The Lord be with you.', tr: 'Rab seninle olsun.' } },
  { id: 'byz-3', lang: 'byz', gender: 'f', text: 'Πρὸς τὸν ἅγιον Φίλιππον;', gloss: { en: 'To Saint Philip?', tr: 'Aziz Philippos’a mı?' } },
  { id: 'byz-4', lang: 'byz', gender: 'm', text: 'Καλῶς ἦλθες, προσκυνητά.', gloss: { en: 'Welcome, pilgrim.', tr: 'Hoş geldin, hacı.' } },
  { id: 'byz-5', lang: 'byz', gender: 'f', text: 'Κύριε ἐλέησον.', gloss: { en: 'Lord, have mercy.', tr: 'Rab, merhamet et.' } },
  { id: 'byz-6', lang: 'byz', gender: 'f', text: 'Ὁ Θεὸς φυλάξει σε.', gloss: { en: 'God will keep you.', tr: 'Tanrı seni koruyacak.' } },
]
