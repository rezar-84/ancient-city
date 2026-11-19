/** Render NPC barks (src/content/barks.ts) with ElevenLabs TTS → public/audio/barks/<id>.mp3 and
 *  <id>-f.mp3 for lines either gender may say. Run: npx -y tsx@4.19.2 --env-file=.env.local scripts/barks_elevenlabs.ts */
import { existsSync, writeFileSync } from 'node:fs'
import { BARKS } from '../src/content/barks.ts'

const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) throw new Error('ELEVENLABS_API_KEY missing')
const V = { m: ['JBFqnCBsd6RMkjVDRZzb', 'pqHfZKP75CvOlQylNhV4'], f: ['EXAVITQu4vr4xnSDxMaL', 'XrExE9yKIg1WjnnlVkGX'] } // George, Bill / Sarah, Matilda
let i = 0
for (const b of BARKS) {
  const genders = b.gender === 'any' ? (['m', 'f'] as const) : [b.gender]
  for (const g of genders) {
    const file = `public/audio/barks/${b.id}${b.gender === 'any' && g === 'f' ? '-f' : ''}.mp3`
    if (existsSync(file)) continue
    const voice = V[g][i++ % 2]
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_96`, {
      method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: b.text, model_id: 'eleven_multilingual_v2', language_code: b.lang === 'la' ? 'it' : 'el' /* grc, koi, byz → Greek */, voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.45, use_speaker_boost: true, speed: 0.95 } }),
    })
    if (!res.ok) { console.log(file, 'FAILED', res.status, (await res.text()).slice(0, 200)); continue }
    writeFileSync(file, Buffer.from(await res.arrayBuffer())); console.log(file, 'ok')
  }
}
