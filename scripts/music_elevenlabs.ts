/** Render the score with ElevenLabs Music (POST /v1/music) into public/audio/music/<id>.mp3.
 * Run: npx -y tsx@4.19.2 --env-file=.env.local scripts/music_elevenlabs.ts [--only=id] [--force] */
import { existsSync, writeFileSync } from 'node:fs'

const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) throw new Error('ELEVENLABS_API_KEY missing')
const force = process.argv.includes('--force')
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',')

export const TRACKS = [
  { id: 'theme', ms: 95000, prompt: 'Epic dramatic cinematic orchestral main theme for a historical game set in an ancient Greco-Roman city in Anatolia. Opens with a lone ney flute and low drones, then deep taiko and frame drums, soaring strings and a wordless choir, solemn horns and brass; a noble modal Mediterranean melody (Phrygian mode) carried by a reed instrument like an aulos or duduk; builds to a majestic climax, then resolves softly so it can loop. Instrumental, no vocals with lyrics.' },
  { id: 'explore', ms: 120000, prompt: 'Calm atmospheric exploration music for walking through an ancient Roman spa city at golden hour: warm sustained strings, plucked lyre and oud, soft frame drum, gentle ney flute melody in a Phrygian mode, occasional harp; peaceful, curious, sunlit, slowly evolving, seamless loop. Instrumental.' },
  { id: 'tension', ms: 60000, prompt: 'Dark mysterious ritual music for an ancient sacred cave of the underworld: low drones, deep bowed strings, distant male choir humming, slow heavy frame drum heartbeat, eerie metallic resonances; ominous and dramatic, loopable. Instrumental.' },
  { id: 'byzantine', ms: 90000, prompt: 'Solemn early Byzantine sacred atmosphere music: deep male choir drone (ison) with slow chant-like melody without words, soft bells, reverberant stone church, warm strings underneath; contemplative and dramatic, loopable. Instrumental, no lyrics.' },
]

for (const t of TRACKS) {
  const file = `public/audio/music/${t.id}.mp3`
  if ((only && !only.includes(t.id)) || (existsSync(file) && !force)) continue
  process.stdout.write(`music ${t.id}… `)
  const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ prompt: t.prompt, music_length_ms: t.ms, model_id: 'music_v1', force_instrumental: true }),
  })
  if (!res.ok) { console.log('FAILED', res.status, (await res.text()).slice(0, 300)); continue }
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(file, buf); console.log('ok', buf.length)
}
