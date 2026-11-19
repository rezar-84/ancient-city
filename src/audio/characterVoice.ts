export interface VoiceProfile {
  gender: 'f' | 'm'
  pitch: number
  rate: number
}

let activeAudio: HTMLAudioElement | null = null
let activeUtterance: SpeechSynthesisUtterance | null = null

export function voiceSupported(): boolean {
  return typeof window !== 'undefined' && (typeof Audio !== 'undefined' || ('speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'))
}

function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

export function stopCharacterVoice() {
  if (activeAudio) {
    try { activeAudio.pause(); activeAudio.currentTime = 0 } catch { /* ignore */ }
    activeAudio = null
  }
  if (ttsSupported()) {
    activeUtterance = null
    try { window.speechSynthesis.cancel() } catch { /* ignore unsupported cancel */ }
  }
}

function pickVoice(lang: 'en' | 'tr', gender: 'f' | 'm'): SpeechSynthesisVoice | null {
  if (!ttsSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const prefix = lang === 'tr' ? 'tr' : 'en'
  const matches = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix))
  if (!matches.length) return voices[0] ?? null
  const femaleHints = /female|woman|samantha|victoria|karen|zira|yelda|emine|sara|aria|jenny|hazel|susan|eva|natural/i
  const maleHints = /male|man|daniel|alex|david|mark|george|cem|tolga|guy|ryan|christopher|arthur/i
  const want = gender === 'f' ? femaleHints : maleHints
  return matches.find((v) => want.test(v.name)) ?? matches[0]
}

function speakFallbackTTS(text: string, lang: 'en' | 'tr', profile: VoiceProfile, onEnd?: () => void): boolean {
  if (!text.trim() || !ttsSupported()) return false
  try {
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = lang === 'tr' ? 'tr-TR' : 'en-US'
    utt.pitch = profile.pitch
    utt.rate = profile.rate
    utt.volume = 0.92
    const voice = pickVoice(lang, profile.gender)
    if (voice) utt.voice = voice
    utt.onend = () => { if (activeUtterance === utt) activeUtterance = null; onEnd?.() }
    utt.onerror = () => { if (activeUtterance === utt) activeUtterance = null; onEnd?.() }
    activeUtterance = utt
    window.speechSynthesis.speak(utt)
    return true
  } catch {
    return false
  }
}

/** Play a pre-rendered ElevenLabs character voiceover MP3 if available, falling back to browser speech synthesis. */
export function playCharacterClip(
  characterId: string,
  clipKey: string,
  lang: 'en' | 'tr',
  fallbackText: string,
  profile: VoiceProfile,
  onEnd?: () => void,
): boolean {
  if (typeof window === 'undefined') return false
  stopCharacterVoice()
  if (typeof Audio !== 'undefined') {
    const url = `/audio/characters/${characterId}-${clipKey}-${lang}.mp3`
    const el = new Audio(url)
    el.volume = 0.95
    activeAudio = el
    el.onended = () => { if (activeAudio === el) activeAudio = null; onEnd?.() }
    el.onerror = () => {
      if (activeAudio !== el) return
      activeAudio = null
      if (!speakFallbackTTS(fallbackText, lang, profile, onEnd)) onEnd?.()
    }
    void el.play().catch(() => {
      if (activeAudio !== el) return
      activeAudio = null
      if (!speakFallbackTTS(fallbackText, lang, profile, onEnd)) onEnd?.()
    })
    return true
  }
  return speakFallbackTTS(fallbackText, lang, profile, onEnd)
}

/** Speak a dynamic character line using browser speech synthesis (used when no pre-rendered clip exists). */
export function speakCharacterLine(
  text: string,
  lang: 'en' | 'tr',
  profile: VoiceProfile,
  onEnd?: () => void,
): boolean {
  stopCharacterVoice()
  return speakFallbackTTS(text, lang, profile, onEnd)
}
