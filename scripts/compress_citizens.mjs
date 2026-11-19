/** Lossless re-compression of the citizen/horse GLBs: dedup, resample, WebP 1024 px, meshopt (no quantization —
 *  the outfit code reads raw float positions/weights). Needs: npm i --no-save @gltf-transform/core @gltf-transform/extensions
 *  @gltf-transform/functions meshoptimizer sharp. Run: node scripts/compress_citizens.mjs <in.glb> <out.glb> [method] */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { textureCompress, resample, dedup } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'
import sharp from 'sharp'
const [input, output, method] = process.argv.slice(2)
await MeshoptEncoder.ready; await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(input)
// No quantize(): runtime outfit code copies raw float position/normal/skin arrays in bind-space metres.
await doc.transform(
  dedup(),
  resample({ tolerance: 1e-4 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }),
)
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({
  method: method === 'filter' ? EXTMeshoptCompression.EncoderMethod.FILTER : EXTMeshoptCompression.EncoderMethod.QUANTIZE,
})
await io.write(output, doc)
