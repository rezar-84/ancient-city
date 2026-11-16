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
  placeSounds: { en: 'Places & ancient voices', tr: 'Mekân sesleri ve antik sesler' },
  uiSounds: { en: 'Interface sounds', tr: 'Arayüz sesleri' },
  volume: { en: 'Volume', tr: 'Ses düzeyi' },
  soundNote: { en: 'Move close to a monument to hear it; select it to hear a prayer or line in the language of its period. Narration plays only when you press Listen or start the tour.', tr: 'Bir anıtı duymak için ona yaklaşın; dönemin dilinde bir dua ya da dize duymak için seçin. Anlatım yalnızca Dinle’ye bastığınızda veya turu başlattığınızda çalar.' },
  scanToOpen: { en: 'Scan to open on your phone', tr: 'Telefonunuzda açmak için tarayın' },
  loading: { en: 'Raising the city from the travertine…', tr: 'Kent travertenden yükseliyor…' },
  hint: { en: 'Drag to orbit · right-drag to pan · scroll zooms to the cursor · double-click to fly there · WASD / arrows move · Q E rotate', tr: 'Döndürmek için sürükleyin · kaydırmak için sağ sürükleyin · imlece yakınlaştırmak için tekerlek · oraya uçmak için çift tıklayın · WASD / oklar hareket · Q E döndürür' },
  planHint: { en: 'Drag to move the map · right-drag to rotate · scroll to zoom · double-click to zoom in', tr: 'Haritayı taşımak için sürükleyin · döndürmek için sağ sürükleyin · yakınlaştırmak için tekerlek · yaklaşmak için çift tıklayın' },
  walk: { en: 'Walk the city', tr: 'Kentte yürü' },
  wholeCity: { en: 'City details', tr: 'Kent ayrıntıları' },
  cityDetailsOn: { en: 'On', tr: 'Açık' },
  cityDetailsOff: { en: 'Off', tr: 'Kapalı' },
  wholeCityTip: { en: 'Show the full street grid, houses and every mapped ruin', tr: 'Tüm sokak dokusunu, evleri ve haritalanmış tüm kalıntıları göster' },
  north: { en: 'Face north', tr: 'Kuzeye dön' },
  zoomIn: { en: 'Zoom in', tr: 'Yakınlaştır' },
  zoomOut: { en: 'Zoom out', tr: 'Uzaklaştır' },
  resetView: { en: 'Reset view', tr: 'Görünümü sıfırla' },
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
