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
  { id: 'dawn', ms: 75000, prompt: 'Quiet ancient Greek dawn music: a lone soft aulos (double reed pipe) melody in Dorian mode over a gently plucked kithara (lyre), slow and spacious, fresh morning light, very calm and sparse, occasional soft frame drum touch. Strictly ancient acoustic instruments only: no orchestral strings, no brass, no piano, no guitar, no synthesizer, no modern drum kit, no vocals. Seamless loop.' },
  { id: 'dusk', ms: 75000, prompt: 'Warm melancholic ancient Mediterranean dusk music: slow plucked lyre and kithara arpeggios, a soft breathy aulos melody in Phrygian mode, gentle low frame drum, golden evening fading, reflective and peaceful. Strictly ancient acoustic instruments only: no orchestral strings, no brass, no piano, no guitar, no synthesizer, no modern drum kit, no vocals. Seamless loop.' },
  { id: 'night', ms: 80000, prompt: 'Very quiet ancient Greek night music: sparse slow plucked lyre notes with long pauses, a soft low drone from a held aulos tone, distant and dreamlike, starlit, minimal and hushed. Strictly ancient acoustic instruments only: no orchestral strings, no brass, no piano, no guitar, no synthesizer, no modern drum kit, no vocals. Seamless loop.' },
  { id: 'theatre-festival', ms: 80000, prompt: 'Festive ancient Roman theatre music in Hierapolis: lively tibia (Roman double pipe) melody, bright cithara strumming, tympanon frame drums and crisp cymbala (small cymbals), the airy tones of a hydraulis water organ, celebratory and rhythmic, open-air festival. Strictly ancient acoustic instruments only: no orchestral strings, no brass, no piano, no guitar, no synthesizer, no modern drum kit, no vocals. Seamless loop.' },
  { id: 'sacred-hellenistic', ms: 80000, prompt: 'Solemn ancient Greek sanctuary music for a temple of Apollo: slow stately kithara chords, a reverent aulos melody in Dorian mode, soft deep frame drum pulse, processional and sacred, calm grandeur. Strictly ancient acoustic instruments only: no orchestral strings, no brass, no piano, no guitar, no synthesizer, no modern drum kit, no vocals. Seamless loop.' },
  { id: 'market-day', ms: 75000, prompt: 'Cheerful ancient Greco-Roman marketplace music: bouncy plucked lyre, playful double pipe aulos melody, tympanon frame drum and finger cymbals in a dance rhythm, busy daytime bustle feel, light and lively. Strictly ancient acoustic instruments only: no orchestral strings, no brass, no piano, no guitar, no synthesizer, no modern drum kit, no vocals. Seamless loop.' },
  { id: 'baths-calm', ms: 80000, prompt: 'Calm relaxing ancient Roman bathhouse music: slow gentle cithara and lyre arpeggios, a soft warm double pipe melody, very light frame drum, flowing like warm water, serene and soothing, reverberant stone hall. Strictly ancient acoustic instruments only: no orchestral strings, no brass, no piano, no guitar, no synthesizer, no modern drum kit, no vocals. Seamless loop.' },
  { id: 'necropolis-sombre', ms: 80000, prompt: 'Sombre ancient Greek funeral music for a necropolis road: slow mournful aulos lament in Phrygian mode, sparse low plucked lyre, a soft slow frame drum heartbeat, grave and respectful, quiet. Strictly ancient acoustic instruments only: no orchestral strings, no brass, no piano, no guitar, no synthesizer, no modern drum kit, no vocals. Seamless loop.' },
  { id: 'byzantine-secular', ms: 85000, prompt: 'Byzantine secular music of a 6th-century Anatolian city: bowed Byzantine lyra (pear-shaped fiddle) melody over a steady drone, modal (makam-like) melody, frame drum (def) rhythm, a soft wooden flute, earthy and medieval, calm walking pace, no choir. Strictly ancient acoustic instruments only: no orchestral strings, no brass, no piano, no guitar, no synthesizer, no modern drum kit, no vocals. Seamless loop.' },
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
