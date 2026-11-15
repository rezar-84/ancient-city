import type { L10n, TimelineEvent } from './types'

export const ERAS: Array<{ id: string; from: number; to: number; color: string; label: L10n }> = [
  { id: 'hellenistic', from: -200, to: -129, color: '#8a6f4e', label: { en: 'Hellenistic (Pergamon)', tr: 'Helenistik (Bergama)' } },
  { id: 'roman', from: -129, to: 330, color: '#b5653f', label: { en: 'Roman', tr: 'Roma' } },
  { id: 'byzantine', from: 330, to: 1190, color: '#6c7f8f', label: { en: 'Byzantine', tr: 'Bizans' } },
  { id: 'seljuk', from: 1190, to: 1400, color: '#4f6e5a', label: { en: 'Seljuk / Turkish', tr: 'Selçuklu / Türk' } },
]

/** Key dates. Sources: Wikipedia (Hierapolis), UNESCO WHC 485, MAIER publications — see research/timeline.json. */
export const TIMELINE: TimelineEvent[] = [
  { year: -650, label: { en: 'Phrygian cult place of the Mother Goddess at the springs', tr: 'Kaynakların yanında Ana Tanrıça’nın Frig kült yeri' } },
  { year: -188, label: { en: 'Treaty of Apamea: the region passes to Pergamon (Eumenes II); city founded', tr: 'Apameia Antlaşması: bölge Bergama’ya (II. Eumenes) geçer; kent kurulur' } },
  { year: -133, label: { en: 'Attalus III bequeaths his kingdom to Rome', tr: 'III. Attalos krallığını Roma’ya bırakır' } },
  { year: -129, label: { en: 'Part of the Roman province of Asia', tr: 'Roma’nın Asya eyaletinin parçası' } },
  { year: 17, label: { en: 'Earthquake under Tiberius (damage at Hierapolis uncertain)', tr: 'Tiberius döneminde deprem (Hierapolis’teki hasar belirsiz)' } },
  { year: 50, label: { en: 'Birth of the Stoic philosopher Epictetus, a slave from Hierapolis', tr: 'Stoacı filozof Epiktetos Hierapolis’te köle olarak doğar' } },
  { year: 60, label: { en: 'Great earthquake under Nero — rebuilt as a Roman city', tr: 'Nero döneminde büyük deprem — Roma kenti olarak yeniden inşa' } },
  { year: 80, label: { en: 'Martyrdom of the Apostle Philip (tradition)', tr: 'Havari Philippos’un şehit edilişi (gelenek)' } },
  { year: 85, label: { en: 'Frontinus Gate and the main street built', tr: 'Frontinus Kapısı ve ana cadde inşa edildi' } },
  { year: 130, label: { en: 'Theatre completed under Hadrian; North Agora rebuilt', tr: 'Tiyatro Hadrianus döneminde tamamlanır; Kuzey Agora yeniden yapılır' } },
  { year: 200, label: { en: 'Severan stage façade of the theatre', tr: 'Tiyatronun Severuslar dönemi sahne cephesi' } },
  { year: 215, label: { en: 'Caracalla visits; city becomes neokoros (imperial temple warden)', tr: 'Caracalla ziyaret eder; kent neokoros olur' } },
  { year: 228, label: { en: 'Nymphaeum of the Tritons built (Severus Alexander)', tr: 'Tritonlar Nymphaeumu yapılır (Severus Alexander)' } },
  { year: 270, label: { en: 'Ammianos sarcophagus shows a water-powered sawmill', tr: 'Ammianos lahdi suyla çalışan bir hızar gösterir' } },
  { year: 352, label: { en: 'Theatre orchestra converted for water shows', tr: 'Tiyatro orkestrası su gösterileri için dönüştürülür' } },
  { year: 390, label: { en: 'Theodosian walls enclose a smaller city; Ploutonion closed', tr: 'Theodosius surları daha küçük bir kenti çevreler; Plutonion kapatılır' } },
  { year: 410, label: { en: 'Martyrium of St Philip built', tr: 'Aziz Philippos Martyrionu inşa edildi' } },
  { year: 531, label: { en: 'Justinian makes Hierapolis a metropolitan see', tr: 'Justinianus Hierapolis’i metropolitlik yapar' } },
  { year: 620, label: { en: 'Persian raids and a great earthquake: the theatre collapses', tr: 'Pers akınları ve büyük deprem: tiyatro çöker' } },
  { year: 1190, label: { en: 'Third Crusade passes; region soon under the Seljuks of Konya', tr: 'Üçüncü Haçlı Seferi geçer; bölge kısa süre sonra Konya Selçuklularının olur' } },
  { year: 1354, label: { en: 'Major earthquake; the site is abandoned', tr: 'Büyük deprem; alan terk edilir' } },
]

/** Modern research — shown in the tour and guide, outside the slider range. */
export const MODERN: TimelineEvent[] = [
  { year: 1838, label: { en: 'Léon de Laborde publishes a plan and views', tr: 'Léon de Laborde bir plan ve gravürler yayımlar' } },
  { year: 1887, label: { en: 'Carl Humann’s German survey (published 1898)', tr: 'Carl Humann’ın Alman araştırması (1898’de yayımlandı)' } },
  { year: 1957, label: { en: 'Italian Archaeological Mission begins (P. Verzone)', tr: 'İtalyan Arkeoloji Heyeti çalışmaya başlar (P. Verzone)' } },
  { year: 1988, label: { en: 'UNESCO World Heritage Site', tr: 'UNESCO Dünya Mirası' } },
  { year: 2011, label: { en: 'Tomb of St Philip identified', tr: 'Aziz Philippos’un mezarı tanımlandı' } },
  { year: 2013, label: { en: 'Ploutonion rediscovered', tr: 'Plutonion yeniden bulundu' } },
]
