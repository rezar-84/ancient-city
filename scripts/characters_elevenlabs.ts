/** Render playable character intros and landmark reflections (src/content/characters.ts) with ElevenLabs TTS
 *  → public/audio/characters/<id>-intro-<lang>.mp3 and <id>-<landmark>-<lang>.mp3
 *  Run: npx -y tsx@4.19.2 --env-file=.env.local scripts/characters_elevenlabs.ts */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { CHARACTERS } from '../src/content/characters.ts'

const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) throw new Error('ELEVENLABS_API_KEY missing')

mkdirSync('public/audio/characters', { recursive: true })

// Distinct ElevenLabs voice per character (matching barks_elevenlabs.ts palette)
const VOICE_FOR: Record<string, { id: string; speed: number; stability: number; style: number }> = {
  theano:    { id: 'EXAVITQu4vr4xnSDxMaL', speed: 0.94, stability: 0.52, style: 0.35 }, // Sarah — calm oracle priestess
  nikias:    { id: 'JBFqnCBsd6RMkjVDRZzb', speed: 1.00, stability: 0.45, style: 0.42 }, // George — lively merchant
  aurelia:   { id: 'XrExE9yKIg1WjnnlVkGX', speed: 0.97, stability: 0.48, style: 0.38 }, // Matilda — warm artisan
  ammianos:  { id: 'JBFqnCBsd6RMkjVDRZzb', speed: 0.95, stability: 0.56, style: 0.30 }, // George — measured scribe
  eudokia:   { id: 'EXAVITQu4vr4xnSDxMaL', speed: 0.93, stability: 0.50, style: 0.40 }, // Sarah — earnest pilgrim
  philippos: { id: 'pqHfZKP75CvOlQylNhV4', speed: 0.89, stability: 0.60, style: 0.28 }, // Bill — deep elder monk
}

async function render(file: string, text: string, lang: 'en' | 'tr', v: { id: string; speed: number; stability: number; style: number }) {
  if (existsSync(file)) return 'skip'
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.id}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY!, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      language_code: lang,
      voice_settings: { stability: v.stability, similarity_boost: 0.78, style: v.style, use_speaker_boost: true, speed: v.speed },
    }),
  })
  if (!res.ok) {
    console.error(file, 'FAILED', res.status, (await res.text()).slice(0, 200))
    return 'fail'
  }
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  console.log(file, 'ok')
  return 'ok'
}

let ok = 0, skipped = 0, failed = 0
for (const c of CHARACTERS) {
  const v = VOICE_FOR[c.id] ?? VOICE_FOR.aurelia
  for (const lang of ['en', 'tr'] as const) {
    // 1) Character intro + backstory + daily objective
    const introText = `${c.greeting.gloss[lang]} ${c.backstory[lang]}`
    const r1 = await render(`public/audio/characters/${c.id}-intro-${lang}.mp3`, introText, lang, v)
    if (r1 === 'ok') ok++; else if (r1 === 'skip') skipped++; else failed++

    // 2) In-character landmark reflections
    for (const [lmId, text] of Object.entries(c.reflections)) {
      const r2 = await render(`public/audio/characters/${c.id}-${lmId}-${lang}.mp3`, text[lang], lang, v)
      if (r2 === 'ok') ok++; else if (r2 === 'skip') skipped++; else failed++
    }
  }
}
console.log(`Done: ${ok} generated, ${skipped} skipped, ${failed} failed`)
if (failed > 0) process.exit(1)
