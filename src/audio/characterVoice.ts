export interface VoiceProfile {
  gender: 'f' | 'm'
  pitch: number
  rate: number
}

let activeUtterance: SpeechSynthesisUtterance | null = null

export function voiceSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

export function stopCharacterVoice() {
  if (!voiceSupported()) return
  activeUtterance = null
  try { window.speechSynthesis.cancel() } catch { /* ignore unsupported cancel */ }
}

function pickVoice(lang: 'en' | 'tr', gender: 'f' | 'm'): SpeechSynthesisVoice | null {
  if (!voiceSupported()) return null
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

/** Speak a character backstory, greeting, or landmark reflection in the active UI language. */
export function speakCharacterLine(
  text: string,
  lang: 'en' | 'tr',
  profile: VoiceProfile,
  onEnd?: () => void,
): boolean {
  if (!text.trim() || !voiceSupported()) return false
  stopCharacterVoice()
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
