import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, relative } from 'node:path'

/** Build-only: write a { "/path": contentHash } manifest of public media into dist/sw.js, so the service
 *  worker serves those files cache-first and re-downloads only files whose content changed. */
function mediaManifest(): Plugin {
  const DIRS = ['terrain', 'models', 'tex', 'img', 'renders', 'art', 'characters', 'audio', 'brand']
  const SKIP = /\.(md|txt|json|usdz)$/i // docs/licences, small JSON meta, and AR Quick Look files (opened outside the page)
  let outDir = 'dist'
  return {
    name: 'media-manifest',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir },
    closeBundle() {
      const manifest: Record<string, string> = {}
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const p = join(dir, name)
          if (statSync(p).isDirectory()) walk(p)
          else if (!SKIP.test(name)) manifest['/' + relative('public', p).split('\\').join('/')] = createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 12)
        }
      }
      for (const d of DIRS) { try { walk(join('public', d)) } catch { /* dir absent */ } }
      const sw = join(outDir, 'sw.js')
      writeFileSync(sw, `self.__MEDIA_MANIFEST__ = ${JSON.stringify(manifest)};\n` + readFileSync(sw, 'utf8'))
    },
  }
}

/** Dev-only: POST /__save-render?id=<slug> with a JPEG data URL body -> public/renders/<slug>.jpg */
function saveRenders(): Plugin {
  return {
    name: 'save-renders',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-render', (req, res) => {
        const id = new URL(req.url ?? '', 'http://x').searchParams.get('id') ?? ''
        if (req.method !== 'POST' || !/^[a-z0-9-]+$/.test(id)) { res.statusCode = 400; res.end('bad'); return }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          const b64 = body.replace(/^data:image\/jpeg;base64,/, '')
          mkdirSync('public/renders', { recursive: true })
          writeFileSync(`public/renders/${id}.jpg`, Buffer.from(b64, 'base64'))
          res.end('ok')
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), saveRenders(), mediaManifest()],
  build: { chunkSizeWarningLimit: 1500 },
})
