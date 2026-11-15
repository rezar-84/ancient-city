/** Render place soundscapes with ElevenLabs:
 *  - beds:   POST /v1/sound-generation  → public/audio/sfx/<id>.mp3
 *  - voices: POST /v1/text-to-speech    → public/audio/voices/<id>.mp3
 * Skips files that exist. Run: npx -y tsx@4.19.2 --env-file=.env.local scripts/sfx_elevenlabs.ts [--only=id,id] [--force] */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { BEDS, VOICES } from '../src/content/soundscapes.ts'

const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) throw new Error('ELEVENLABS_API_KEY missing')
const force = process.argv.includes('--force')
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',')
const VOICE_IDS = { priest: 'nPczCjzI2devNBz1zQrb' /* Brian: deep, resonant */, herald: 'JBFqnCBsd6RMkjVDRZzb' /* George */ }
mkdirSync('public/audio/sfx', { recursive: true })
mkdirSync('public/audio/voices', { recursive: true })

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'xi-api-key': KEY!, 'content-type': 'application/json', accept: 'audio/mpeg' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`)
  return Buffer.from(await res.arrayBuffer())
}

for (const b of BEDS) {
  const file = `public/audio/sfx/${b.id}.mp3`
  if ((only && !only.includes(b.id)) || (existsSync(file) && !force)) continue
  process.stdout.write(`sfx ${b.id}… `)
  try {
    let buf: Buffer
    try {
      buf = await post('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', { text: b.prompt, duration_seconds: b.seconds, prompt_influence: 0.45, loop: b.loop, model_id: 'eleven_text_to_sound_v2' })
    } catch (e) {
      // older accounts/models: retry without the loop/model fields
      if (!(e as Error).message.startsWith('4')) throw e
      buf = await post('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', { text: b.prompt, duration_seconds: b.seconds, prompt_influence: 0.45 })
    }
    writeFileSync(file, buf); console.log('ok', buf.length)
  } catch (e) { console.log('FAILED', (e as Error).message) }
}

for (const v of VOICES) {
  const file = `public/audio/voices/${v.id}.mp3`
  if ((only && !only.includes(v.id)) || (existsSync(file) && !force)) continue
  process.stdout.write(`voice ${v.id}… `)
  try {
    const buf = await post(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_IDS[v.voice]}?output_format=mp3_44100_96`, {
      text: v.text,
      model_id: 'eleven_multilingual_v2',
      ...(v.lang === 'la' ? { language_code: 'it' } : { language_code: 'el' }),
      voice_settings: { stability: 0.7, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true, speed: 0.82 },
    })
    writeFileSync(file, buf); console.log('ok', buf.length)
  } catch (e) { console.log('FAILED', (e as Error).message) }
}
