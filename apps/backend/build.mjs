import * as esbuild from 'esbuild'
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../..')
const outDir = path.resolve(__dirname, 'dist')

// The Rapido signer reads its WASM signing module and two JS blobs off disk at
// request time (src/lib/scraper/rapido/signer.ts). esbuild only bundles JS, so
// these have to be copied next to the bundle by hand — same problem the web app
// used to solve with a Vite plugin.
const RAPIDO_ASSETS = path.resolve(rootDir, 'packages/api/src/lib/scraper/rapido/assets')
const RAPIDO_ASSETS_OUT = path.join(outDir, 'rapido-assets')

await esbuild.build({
  entryPoints: [path.resolve(__dirname, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: path.join(outDir, 'index.js'),
  packages: 'external',
  plugins: [
    {
      name: 'bundle-repo-packages',
      setup(build) {
        // Workspace packages ship raw TS, so point esbuild at the source.
        build.onResolve({ filter: /^@repo\/api/ }, () => {
          return { path: path.resolve(rootDir, 'packages/api/src/router/index.ts') }
        })
      },
    },
  ],
})

if (existsSync(RAPIDO_ASSETS)) {
  mkdirSync(outDir, { recursive: true })
  cpSync(RAPIDO_ASSETS, RAPIDO_ASSETS_OUT, { recursive: true })
  console.log('⚡ copied Rapido signing assets -> dist/rapido-assets')
}

console.log('⚡ apps/backend built successfully to dist/index.js')
