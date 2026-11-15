import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdirSync, writeFileSync } from 'node:fs'

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
  plugins: [react(), saveRenders()],
  build: { chunkSizeWarningLimit: 1500 },
})
