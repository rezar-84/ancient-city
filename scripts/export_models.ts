/** Export the Roman theatre for the AR viewer: public/models/theatre.glb (model-viewer, WebXR, Scene Viewer),
 * public/models/theatre.usdz (iOS Quick Look) and public/models/env-hierapolis.hdr (viewer lighting).
 *
 * Pipeline (scripts/ar/*): procedural tileable PBR stone textures (base colour / normal / ORM, 1024²) ->
 * theatre geometry (generator stage building + rebuilt profiled cavea, fluted columns, mouldings, plinth)
 * with world-space box UVs (1 tile = 4 m) -> hemisphere-raycast AO + ground dirt baked per vertex,
 * buried faces culled -> GLB (COLOR_0) and USDZ (AO quantised into material buckets).
 *
 * Run: npx -y tsx@4.19.2 scripts/export_models.ts            (about 1–2 minutes)
 *      AR_TEX=512 npx -y tsx@4.19.2 scripts/export_models.ts  (smaller textures) */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { makeStone, RECIPES, TILE } from './ar/textures.ts'
import type { StoneTextures } from './ar/textures.ts'
import { buildTheatreAR } from './ar/theatre_ar.ts'
import { bakeAll } from './ar/bake.ts'
import { writeGLB, writeUSDZ, writeSkyHDR } from './ar/writers.ts'
import type { ExportMesh } from './ar/writers.ts'
import { MAT_KEYS } from './ar/soup.ts'
import type { MatKey } from './ar/soup.ts'

const SCALE = 1 / 150 // ~0.72 m wide on a table; users can pinch-scale in AR
const TEX = Number(process.env.AR_TEX ?? 1024)
const ROUGHNESS: Record<MatKey, number> = { limestone: 1, travertine: 1, marble: 1, paving: 1 }

async function main() {
  const t0 = Date.now()
  const log = (...a: unknown[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a)
  mkdirSync('public/models', { recursive: true })

  const tex = {} as Record<MatKey, StoneTextures>
  for (const k of MAT_KEYS) {
    // textures are cached (node_modules/.cache) keyed by recipe, size and generator source
    const id = createHash('sha1').update(JSON.stringify(RECIPES[k]) + TEX + statSync('scripts/ar/textures.ts').mtimeMs).digest('hex').slice(0, 12)
    const dir = `node_modules/.cache/hierapolis-ar/${k}-${id}`
    if (existsSync(`${dir}/orm.jpg`)) {
      tex[k] = { base: readFileSync(`${dir}/base.jpg`), normal: readFileSync(`${dir}/normal.jpg`), orm: readFileSync(`${dir}/orm.jpg`), size: TEX }
    } else {
      tex[k] = makeStone(RECIPES[k], TEX)
      mkdirSync(dir, { recursive: true })
      for (const m of ['base', 'normal', 'orm'] as const) writeFileSync(`${dir}/${m}.jpg`, tex[k][m])
    }
    log(`texture ${k} ${TEX}²: base ${(tex[k].base.length / 1024) | 0} KB, normal ${(tex[k].normal.length / 1024) | 0} KB, orm ${(tex[k].orm.length / 1024) | 0} KB`)
  }

  const { soups, plinthDepth } = buildTheatreAR()
  log('geometry', MAT_KEYS.map((k) => `${k} ${soups[k].triCount} tris`).join(', '))

  const { meshes, culled } = bakeAll(soups)
  const tris = meshes.reduce((s, m) => s + m.index.length / 3, 0), verts = meshes.reduce((s, m) => s + m.pos.length / 3, 0)
  log(`baked AO: ${tris} triangles, ${verts} vertices (${culled} buried triangles culled)`)

  // centre on x/z, plinth bottom at y = 0, scale to tabletop size
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const m of meshes) for (let i = 0; i < m.pos.length; i += 3) {
    minX = Math.min(minX, m.pos[i]); maxX = Math.max(maxX, m.pos[i]); minZ = Math.min(minZ, m.pos[i + 2]); maxZ = Math.max(maxZ, m.pos[i + 2])
  }
  const offset: [number, number, number] = [-(minX + maxX) / 2, plinthDepth, -(minZ + maxZ) / 2]
  // UVs are authored at 1 unit = TILE metres; textures that cover a larger area get scaled UVs
  for (const m of meshes) {
    const f = TILE / RECIPES[m.key].tile
    if (f !== 1) for (let i = 0; i < m.uv.length; i++) m.uv[i] *= f
  }
  const out: ExportMesh[] = meshes.map((m) => ({ ...m, scale: SCALE, offset }))
  log(`footprint ${((maxX - minX) * SCALE).toFixed(2)} x ${((maxZ - minZ) * SCALE).toFixed(2)} m at 1:${Math.round(1 / SCALE)}`)

  const glb = writeGLB(out, tex, ROUGHNESS)
  writeFileSync('public/models/theatre.glb', glb)
  const usdz = writeUSDZ(out, tex, ROUGHNESS)
  writeFileSync('public/models/theatre.usdz', usdz)
  const hdr = writeSkyHDR()
  writeFileSync('public/models/env-hierapolis.hdr', hdr)
  log(`theatre.glb ${(glb.length / 1e6).toFixed(2)} MB, theatre.usdz ${(usdz.length / 1e6).toFixed(2)} MB, env-hierapolis.hdr ${(hdr.length / 1e3).toFixed(0)} KB`)
}
main().catch((e) => { console.error(e); process.exit(1) })
