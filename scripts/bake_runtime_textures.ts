/** Run from any directory: npx tsx scripts/bake_runtime_textures.ts */
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import jpeg from 'jpeg-js'
import { makeStone, RECIPES, makeRuntimeSurface, RUNTIME_RECIPES } from './ar/textures.ts'

const size = 512, quality = 82
const out = fileURLToPath(new URL('../public/tex/', import.meta.url))
mkdirSync(out, { recursive: true })
let total = 0
function save(name: string, base: Uint8Array, nr: Uint8Array) {
  for (const [suffix, data] of [['albedo', base], ['nr', nr]] as const) {
    const bytes = jpeg.encode({ data, width: size, height: size }, quality).data
    writeFileSync(`${out}${name}_${suffix}.jpg`, bytes)
    total += bytes.length
    console.log(`${name}_${suffix}.jpg: ${bytes.length} bytes`)
  }
}
for (const name of Object.keys(RECIPES) as (keyof typeof RECIPES)[]) {
  const stone = makeStone(RECIPES[name], size)
  const base = jpeg.decode(stone.base).data, nr = jpeg.decode(stone.normal).data
  const orm = jpeg.decode(stone.orm).data
  for (let p = 0; p < size * size; p++) nr[p * 4 + 2] = orm[p * 4 + 1]
  save(name, base, nr)
}
for (const name of Object.keys(RUNTIME_RECIPES) as (keyof typeof RUNTIME_RECIPES)[]) {
  const maps = makeRuntimeSurface(name, size)
  save(name, maps.base, maps.nr)
}
if (total > 2_500_000) throw new Error(`Texture budget exceeded: ${total} bytes`)
console.log(`Total: ${total} bytes; 0 vertices, 0 triangles, 0 additional draw calls`)
