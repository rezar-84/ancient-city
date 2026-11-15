import { useApp, type Lang } from './store'

const STRINGS = {
  title: { en: 'Hierapolis', tr: 'Hierapolis' },
  subtitle: { en: 'The Holy City above the white terraces of Pamukkale', tr: 'Pamukkale\'nin beyaz travertenleri üzerindeki Kutsal Kent' },
  tagline: { en: 'Phrygia · c. 190 BC – AD 1354 · UNESCO World Heritage since 1988', tr: 'Frigya · MÖ y. 190 – MS 1354 · 1988\'den beri UNESCO Dünya Mirası' },
  explore: { en: 'Explore the city', tr: 'Kenti keşfet' },
  tour: { en: 'Guided tour', tr: 'Rehberli tur' },
  plan: { en: 'Archaeological plan', tr: 'Arkeolojik plan' },
  map3d: { en: '3D city', tr: '3B kent' },
  ancient: { en: 'Ancient', tr: 'Antik' },
  today: { en: 'Today', tr: 'Bugün' },
  guide: { en: 'Print guide', tr: 'Rehberi yazdır' },
  ar: { en: 'View in AR', tr: 'AR\'da gör' },
  listen: { en: 'Listen', tr: 'Dinle' },
  stop: { en: 'Stop', tr: 'Durdur' },
  facts: { en: 'Key facts', tr: 'Öne çıkanlar' },
  didYouKnow: { en: 'Did you know?', tr: 'Biliyor muydunuz?' },
  disputed: { en: 'Debated by scholars', tr: 'Akademisyenler arasında tartışmalı' },
  sources: { en: 'Sources', tr: 'Kaynaklar' },
  close: { en: 'Close', tr: 'Kapat' },
  legend: { en: 'Monuments', tr: 'Anıtlar' },
  year: { en: 'Year', tr: 'Yıl' },
  bc: { en: 'BC', tr: 'MÖ' },
  ad: { en: 'AD', tr: 'MS' },
  planNote: { en: 'Schematic plan drawn after published excavation plans (Italian Archaeological Mission, MAIER) and satellite imagery. Contours every 5 m.', tr: 'Yayımlanmış kazı planları (İtalyan Arkeoloji Heyeti, MAIER) ve uydu görüntülerinden çizilmiş şematik plan. Eş yükselti eğrileri 5 m aralıklı.' },
  reconstruction: { en: 'Reconstruction is an interpretation for illustration', tr: 'Canlandırma, açıklama amaçlı bir yorumdur' },
  todayLoading: { en: 'Loading today\'s site in 3D…', tr: 'Alanın bugünkü 3B görünümü yükleniyor…' },
  todayFallback: { en: 'Showing satellite view of today (3D photo mesh needs internet)', tr: 'Bugünün uydu görünümü gösteriliyor (3B foto model için internet gerekir)' },
  next: { en: 'Next', tr: 'İleri' },
  prev: { en: 'Back', tr: 'Geri' },
  pause: { en: 'Pause', tr: 'Duraklat' },
  play: { en: 'Play', tr: 'Oynat' },
  exitTour: { en: 'Exit tour', tr: 'Turdan çık' },
  sound: { en: 'Sound', tr: 'Ses' },
  ambience: { en: 'Ambient sound', tr: 'Ortam sesi' },
  volume: { en: 'Volume', tr: 'Ses düzeyi' },
  soundNote: { en: 'Narration plays only when you press Listen or start the tour.', tr: 'Anlatım yalnızca Dinle’ye bastığınızda veya turu başlattığınızda çalar.' },
  scanToOpen: { en: 'Scan to open on your phone', tr: 'Telefonunuzda açmak için tarayın' },
  loading: { en: 'Raising the city from the travertine…', tr: 'Kent travertenden yükseliyor…' },
  hint: { en: 'Drag to orbit · scroll to zoom · right-drag to pan · click a marker', tr: 'Döndürmek için sürükleyin · yakınlaştırmak için kaydırın · kaydırmak için sağ tık · bir işarete tıklayın' },
  author: { en: 'Created by Ferial Ara · Master’s programme, Yaşar University, İzmir · Fall 2026', tr: 'Hazırlayan: Ferial Ara · Yüksek Lisans, Yaşar Üniversitesi, İzmir · Güz 2026' },
  tabRender: { en: '3D reconstruction', tr: '3B canlandırma' },
  tabToday: { en: 'Today', tr: 'Bugün' },
  tabArchive: { en: 'Archive & finds', tr: 'Arşiv ve buluntular' },
  historicMaps: { en: 'Historic maps', tr: 'Tarihi haritalar' },
  seeIn3d: { en: 'See in 3D', tr: '3B’de gör' },
  credits: { en: 'Credits', tr: 'Emeği geçenler' },
} satisfies Record<string, Record<Lang, string>>

export type StrKey = keyof typeof STRINGS

export function useT() {
  const lang = useApp((s) => s.lang)
  return (k: StrKey) => STRINGS[k][lang]
}

export function formatYear(y: number, lang: Lang) {
  if (y < 0) return lang === 'tr' ? `MÖ ${-y}` : `${-y} BC`
  return lang === 'tr' ? `MS ${y}` : `AD ${y}`
}
