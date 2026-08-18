// Standalone tsdown config: builds the host half (lib/index.js) and the
// browser client half (lib/client.js) in one pass, no DSH-repo dependency.
import { defineConfig } from 'tsdown'

const banner = `window.__ModuleLoader__.load({ id: "dsh-eyes", factory: (require) => {`
const footer = 'return module.exports; } });'
const intro = 'var module = { exports: {} }; var exports = module.exports;'

export default defineConfig([
  {
    name: 'dsh-eyes',
    entry: ['lib/types/index.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    dts: false,
    clean: false,
    outputOptions: { entryFileNames: 'index.js' },
  },
  {
    name: 'dsh-eyes/client',
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    outputOptions: {
      entryFileNames: 'client.js',
      banner,
      footer,
      intro,
    },
  },
])
