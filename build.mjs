import * as esbuild from 'esbuild'
import { cpSync, mkdirSync } from 'node:fs'

mkdirSync('dist', { recursive: true })

await esbuild.build({
  entryPoints: {
    content: 'src/content.ts',
    background: 'src/background.ts',
    options: 'src/options.ts',
  },
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outdir: 'dist',
})

cpSync('public', 'dist', { recursive: true })
cpSync('manifest.json', 'dist/manifest.json')
console.log('build complete')
