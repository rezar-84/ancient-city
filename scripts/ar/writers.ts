/** Minimal, dependency-free writers: binary glTF (GLB) with embedded JPEG PBR textures and COLOR_0,
 * USDZ (usda + JPEG textures, 64-byte aligned, stored zip) for iOS Quick Look, and an RGBE .hdr sky. */
import { strToU8, zipSync } from 'three/examples/jsm/libs/fflate.module.js'
import type { Baked } from './bake.ts'
import type { MatKey } from './soup.ts'
import type { StoneTextures } from './textures.ts'

export interface ExportMesh extends Baked { scale: number; offset: [number, number, number] }
type Tex = Record<MatKey, StoneTextures>

function transformed(m: ExportMesh) {
  const p = new Float32Array(m.pos.length)
  for (let i = 0; i < p.length; i += 3) {
    p[i] = (m.pos[i] + m.offset[0]) * m.scale; p[i + 1] = (m.pos[i + 1] + m.offset[1]) * m.scale; p[i + 2] = (m.pos[i + 2] + m.offset[2]) * m.scale
  }
  return p
}

// ---------------- GLB ----------------
export function writeGLB(meshes: ExportMesh[], tex: Tex, roughnessFactor: Record<MatKey, number>) {
  const chunks: Buffer[] = []
  let byteLength = 0
  const bufferViews: object[] = [], accessors: object[] = []
  const view = (data: Buffer, target?: number) => {
    const pad = (4 - (byteLength % 4)) % 4
    if (pad) { chunks.push(Buffer.alloc(pad)); byteLength += pad }
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: data.length, ...(target ? { target } : {}) })
    chunks.push(data); byteLength += data.length
    return bufferViews.length - 1
  }
  const acc = (data: Buffer, componentType: number, count: number, type: string, extra: object = {}, target?: number) => {
    accessors.push({ bufferView: view(data, target), componentType, count, type, ...extra })
    return accessors.length - 1
  }
  const images: object[] = [], textures: object[] = [], materials: object[] = []
  const matIndex = new Map<MatKey, number>()
  const image = (b: Buffer) => { images.push({ bufferView: view(b), mimeType: 'image/jpeg' }); textures.push({ sampler: 0, source: images.length - 1 }); return textures.length - 1 }
  for (const key of new Set(meshes.map((m) => m.key))) {
    const t = tex[key]
    const base = image(t.base), normal = image(t.normal), orm = image(t.orm)
    materials.push({
      name: key,
      pbrMetallicRoughness: { baseColorTexture: { index: base }, metallicRoughnessTexture: { index: orm }, metallicFactor: 0, roughnessFactor: roughnessFactor[key] },
      normalTexture: { index: normal, scale: 1 },
      occlusionTexture: { index: orm, strength: 1 },
    })
    matIndex.set(key, materials.length - 1)
  }
  const primitives = meshes.map((m) => {
    const p = transformed(m)
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[i + k]); max[k] = Math.max(max[k], p[i + k]) }
    const n = p.length / 3
    const col = Buffer.alloc(n * 4)
    for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) col[i * 4 + k] = Math.round(Math.min(1, Math.max(0, m.color[i * 3 + k])) * 255); col[i * 4 + 3] = 255 }
    const small = n < 65536
    const idx = small ? Buffer.from(new Uint16Array(m.index).buffer) : Buffer.from(m.index.buffer, m.index.byteOffset, m.index.byteLength)
    return {
      attributes: {
        POSITION: acc(Buffer.from(p.buffer), 5126, n, 'VEC3', { min, max }, 34962),
        NORMAL: acc(Buffer.from(m.nrm.buffer, m.nrm.byteOffset, m.nrm.byteLength), 5126, n, 'VEC3', {}, 34962),
        TEXCOORD_0: acc(Buffer.from(m.uv.buffer, m.uv.byteOffset, m.uv.byteLength), 5126, n, 'VEC2', {}, 34962),
        COLOR_0: acc(col, 5121, n, 'VEC4', { normalized: true }, 34962),
      },
      indices: acc(idx, small ? 5123 : 5125, m.index.length, 'SCALAR', {}, 34963),
      material: matIndex.get(m.key),
      mode: 4,
    }
  })
  const bin = Buffer.concat(chunks)
  const binPadded = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)])
  const json = {
    asset: { version: '2.0', generator: 'hierapolis scripts/export_models.ts' },
    scene: 0, scenes: [{ name: 'Theatre', nodes: [0] }],
    nodes: [{ name: 'Theatre', mesh: 0 }],
    meshes: [{ name: 'Theatre', primitives }],
    materials, textures, images,
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    accessors, bufferViews, buffers: [{ byteLength: binPadded.length }],
  }
  let jsonBuf = Buffer.from(JSON.stringify(json))
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)])
  const header = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8)
  const total = 12 + 8 + jsonBuf.length + 8 + binPadded.length
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(total, 8)
  jh.writeUInt32LE(jsonBuf.length, 0); jh.writeUInt32LE(0x4e4f534a, 4)
  bh.writeUInt32LE(binPadded.length, 0); bh.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, jh, jsonBuf, bh, binPadded])
}

// ---------------- USDZ ----------------
const f = (x: number, d: number) => { const s = x.toFixed(d).replace(/\.?0+$/, ''); return s === '-0' ? '0' : s }

/** Quick Look ignores vertex colours under textured materials, so baked AO is quantised into
 * brightness buckets: each bucket is a mesh whose material scales the base-colour texture. */
export function writeUSDZ(meshes: ExportMesh[], tex: Tex, roughness: Record<MatKey, number>, buckets = 7) {
  const lines: string[] = []
  lines.push(`#usda 1.0
(
    customLayerData = { string creator = "hierapolis scripts/export_models.ts" }
    defaultPrim = "Theatre"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "Theatre" (
    assetInfo = { string name = "Theatre" }
    kind = "component"
)
{
`)
  const lo = 0.18, hi = 1
  const mats: string[] = []
  const used = new Set<MatKey>()
  for (const m of meshes) {
    used.add(m.key)
    const p = transformed(m)
    const tris = m.index.length / 3
    // bucket triangles by mean vertex colour
    const groups: number[][] = Array.from({ length: buckets }, () => [])
    for (let t = 0; t < tris; t++) {
      let s = 0
      for (let k = 0; k < 3; k++) s += m.color[m.index[t * 3 + k] * 3]
      const b = Math.min(buckets - 1, Math.max(0, Math.round(((s / 3) - lo) / (hi - lo) * (buckets - 1))))
      groups[b].push(t)
    }
    groups.forEach((g, b) => {
      if (!g.length) return
      const name = `${m.key}_${b}`
      const remap = new Map<number, number>()
      const verts: number[] = [], idx: number[] = []
      for (const t of g) for (let k = 0; k < 3; k++) {
        const v = m.index[t * 3 + k]
        let r = remap.get(v)
        if (r === undefined) { r = verts.length; remap.set(v, r); verts.push(v) }
        idx.push(r)
      }
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
      const pts = verts.map((v) => {
        for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[v * 3 + k]); max[k] = Math.max(max[k], p[v * 3 + k]) }
        return `(${f(p[v * 3], 5)},${f(p[v * 3 + 1], 5)},${f(p[v * 3 + 2], 5)})`
      }).join(',')
      const nrm = verts.map((v) => `(${f(m.nrm[v * 3], 3)},${f(m.nrm[v * 3 + 1], 3)},${f(m.nrm[v * 3 + 2], 3)})`).join(',')
      const st = verts.map((v) => `(${f(m.uv[v * 2], 4)},${f(-m.uv[v * 2 + 1], 4)})`).join(',')
      lines.push(`    def Mesh "${name}" (
        prepend apiSchemas = ["MaterialBindingAPI"]
    )
    {
        uniform bool doubleSided = 0
        float3[] extent = [(${min.map((x) => f(x, 5)).join(',')}), (${max.map((x) => f(x, 5)).join(',')})]
        int[] faceVertexCounts = [${new Array(g.length).fill(3).join(',')}]
        int[] faceVertexIndices = [${idx.join(',')}]
        rel material:binding = </Theatre/Materials/${name}>
        normal3f[] normals = [${nrm}] (
            interpolation = "vertex"
        )
        point3f[] points = [${pts}]
        texCoord2f[] primvars:st = [${st}] (
            interpolation = "vertex"
        )
        uniform token subdivisionScheme = "none"
    }
`)
      const k = lo + (hi - lo) * b / (buckets - 1)
      mats.push(material(name, m.key, [k, k * (0.975 + 0.025 * k), k * (0.94 + 0.06 * k)], roughness[m.key]))
    })
  }
  lines.push(`    def Scope "Materials"
    {
${mats.join('\n')}
    }
}
`)
  const files: Record<string, Uint8Array | [Uint8Array, object]> = { 'theatre.usda': strToU8(lines.join('')) }
  for (const key of used) {
    files[`textures/${key}_base.jpg`] = new Uint8Array(tex[key].base)
    files[`textures/${key}_normal.jpg`] = new Uint8Array(tex[key].normal)
    files[`textures/${key}_orm.jpg`] = new Uint8Array(tex[key].orm)
  }
  // 64-byte alignment of every file's data (USDZ requirement); same trick as three's USDZExporter
  let offset = 0
  for (const name in files) {
    const file = files[name] as Uint8Array
    offset += 30 + name.length
    const mod = (offset + 4) & 63 // +4 for the extra-field header
    const pad = mod === 0 ? 0 : 64 - mod
    files[name] = [file, { extra: { 12345: new Uint8Array(pad) } }]
    offset += 4 + pad + file.length
  }
  return Buffer.from(zipSync(files as never, { level: 0 }))
}

function material(name: string, key: MatKey, scale: number[], roughness: number) {
  const base = `/Theatre/Materials/${name}`
  return `        def Material "${name}"
        {
            token outputs:surface.connect = <${base}/PBR.outputs:surface>
            def Shader "PBR"
            {
                uniform token info:id = "UsdPreviewSurface"
                color3f inputs:diffuseColor.connect = <${base}/Base.outputs:rgb>
                normal3f inputs:normal.connect = <${base}/Normal.outputs:rgb>
                float inputs:roughness.connect = <${base}/ORM.outputs:g>
                float inputs:occlusion.connect = <${base}/ORM.outputs:r>
                float inputs:metallic = 0
                int inputs:useSpecularWorkflow = 0
                token outputs:surface
            }
            def Shader "St"
            {
                uniform token info:id = "UsdPrimvarReader_float2"
                string inputs:varname = "st"
                float2 outputs:result
            }
            def Shader "Base"
            {
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @textures/${key}_base.jpg@
                float2 inputs:st.connect = <${base}/St.outputs:result>
                token inputs:sourceColorSpace = "sRGB"
                float4 inputs:scale = (${scale.map((x) => f(x, 4)).join(', ')}, 1)
                token inputs:wrapS = "repeat"
                token inputs:wrapT = "repeat"
                float3 outputs:rgb
            }
            def Shader "Normal"
            {
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @textures/${key}_normal.jpg@
                float2 inputs:st.connect = <${base}/St.outputs:result>
                token inputs:sourceColorSpace = "raw"
                float4 inputs:scale = (2, 2, 2, 1)
                float4 inputs:bias = (-1, -1, -1, 0)
                token inputs:wrapS = "repeat"
                token inputs:wrapT = "repeat"
                float3 outputs:rgb
            }
            def Shader "ORM"
            {
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @textures/${key}_orm.jpg@
                float2 inputs:st.connect = <${base}/St.outputs:result>
                token inputs:sourceColorSpace = "raw"
                float4 inputs:scale = (1, ${f(roughness, 3)}, 1, 1)
                token inputs:wrapS = "repeat"
                token inputs:wrapT = "repeat"
                float outputs:r
                float outputs:g
            }
        }`
}

// ---------------- HDR environment ----------------
/** small equirectangular RGBE sky: warm low sun, pale Aegean sky, travertine-coloured ground bounce */
export function writeSkyHDR(W = 512, H = 256) {
  const sun = norm3([0.5, 0.62, -0.6]) // from the audience side (-Z) and the right, ~38° high
  const head = Buffer.from(`#?RADIANCE\n# Hierapolis afternoon sky (generated)\nFORMAT=32-bit_rle_rgbe\n\n-Y ${H} +X ${W}\n`, 'ascii')
  const px = Buffer.alloc(W * H * 4)
  for (let j = 0; j < H; j++) {
    const lat = Math.PI / 2 - (j + 0.5) / H * Math.PI
    for (let i = 0; i < W; i++) {
      // three.js equirect convention: u = atan2(z, x) / 2π + 0.5
      const lon = ((i + 0.5) / W - 0.5) * 2 * Math.PI
      const d = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)]
      let r: number, g: number, b: number
      if (d[1] >= 0) {
        const t = Math.pow(1 - d[1], 3)
        r = 0.50 + 0.50 * t; g = 0.60 + 0.36 * t; b = 0.80 + 0.08 * t
        const k = 0.75; r *= k; g *= k; b *= k
      } else {
        const t = Math.min(1, -d[1] * 3)
        r = 0.55 - 0.15 * t; g = 0.47 - 0.13 * t; b = 0.37 - 0.11 * t
      }
      const c = d[0] * sun[0] + d[1] * sun[1] + d[2] * sun[2]
      const ang = Math.acos(Math.min(1, c))
      const core = ang < 0.035 ? 1 : Math.exp(-Math.pow((ang - 0.035) / 0.012, 2))
      const halo = Math.exp(-Math.pow(ang / 0.25, 2))
      r += core * 420 + halo * 1.8; g += core * 380 + halo * 1.5; b += core * 310 + halo * 1.1
      const o = (j * W + i) * 4, m = Math.max(r, g, b)
      if (m < 1e-32) continue
      const e = Math.ceil(Math.log2(m) + 1e-9), sc = 256 / Math.pow(2, e)
      px[o] = Math.min(255, Math.floor(r * sc)); px[o + 1] = Math.min(255, Math.floor(g * sc)); px[o + 2] = Math.min(255, Math.floor(b * sc)); px[o + 3] = e + 128
    }
  }
  return Buffer.concat([head, px])
}
function norm3(v: number[]) { const l = Math.hypot(v[0], v[1], v[2]); return v.map((x) => x / l) }
